# Simulation quick start

The standard demo: 3 SITL drones, scenario from the config.

## A1. Containers (host)

```bash
cd ~/AirStack
git checkout yikuan/SVG_ground_control
./airstack.sh setup                         # FIRST TIME on a machine only — see note
./airstack.sh image-build robot-desktop     # REQUIRED after pulling this branch — see note
# .env: COMPOSE_PROFILES="desktop,isaac-sim", AUTOLAUNCH="false", NUM_ROBOTS="1"
grep -E '^(COMPOSE_PROFILES|AUTOLAUNCH|NUM_ROBOTS)' .env
./airstack.sh up
./airstack.sh status        # robot-desktop-1 and isaac-sim Up
```

> **First time on a machine: `./airstack.sh setup`.** It adds the `airstack`
> command to your shell profile (open a new terminal afterwards) and runs
> `config`, which creates two git-ignored files the Isaac Sim compose mounts:
> `simulation/isaac-sim/docker/omni_pass.env` and `user.config.json`. Without
> them `./airstack.sh up` fails with `env file ... omni_pass.env not found`.
> Press Enter at the Nucleus API-token prompt to keep the `guest` defaults, or
> copy the two `*_TEMPLATE*` files yourself (`omni_pass_TEMPLATE.env →
> omni_pass.env`, `user_TEMPLATE.config.json → user.config.json`). Also make
> sure your user is in the `docker` group (`sudo usermod -aG docker $USER`,
> then log out/in) — otherwise every command reports
> `Docker daemon is not running` even though it is.
>
> **⚠️ Always rebuild the robot image after pulling this branch.** This branch
> changes the robot **Docker image** itself (not just the bind-mounted workspace) —
> e.g. `MicroXRCEAgent` is now baked into the image
> ([`Dockerfile.robot`](https://github.com/castacks/AirStack/blob/yikuan/SVG_ground_control/robot/docker/Dockerfile.robot)), and the container
> [`.bashrc`](https://github.com/castacks/AirStack/blob/yikuan/SVG_ground_control/robot/docker/.bashrc) hard-pins `ROS_DOMAIN_ID=1`. Image contents
> only update on a rebuild, so a stale image will be missing the agent and may sit on
> the wrong domain. Rebuild with `./airstack.sh image-build robot-desktop` (or
> `./airstack.sh up --build`); add `--no-cache` if a layer looks stale. A plain
> `git pull` + `./airstack.sh up` is **not** enough. (Editing `.py`/`.yaml` inside the
> workspace still only needs `bws` — that's the bind mount, §4 — but anything that
> touches the Dockerfile or `.bashrc` needs an image rebuild.)

## A2. Isaac Sim — spawn drones (fresh terminal)

```bash
cd ~/AirStack && ./airstack.sh connect isaac-sim --command=bash
```
Inside (`PLAY_SIM_ON_START=true` is REQUIRED — PX4 SITL only launches when the
timeline plays; `ISAAC_SIM_HEADLESS=true` is REQUIRED unless you specifically
need the Isaac window — see note below):
```bash
NUM_ROBOTS=3 SVG_DOMAIN_ID=1 PLAY_SIM_ON_START=true ISAAC_SIM_HEADLESS=true \
PYTHONPATH="$ISAAC_SIM_PYTHONPATH" \
/isaac-sim/python.sh /isaac-sim/AirStack/simulation/isaac-sim/launch_scripts/svg_multi_drone_single_domain.py \
  --ext-folder ~/.local/share/ov/data/documents/Kit/shared/exts
```
Expect `Spawning 3 drone(s) on ROS domain 1` then `PX4 Autolaunch: True` per
drone. Drones spawn at x = −2, 0, +2 (this is why the sim configs set
`drone_position_offsets: [-2,0,0, 0,0,0, 2,0,0]`).

> **Real-drone avatars (`DRONE_MODES`).** For a hybrid run, tell the sim which
> drones are real so it spawns a SITL body only for the sim ones and a
> visual-only **avatar** for each real one — the avatar is teleported every
> step to that drone's `…/odometry_conversion/odometry`, so a real (mocap)
> drone appears in the Isaac viewport at its live pose. Add
> `DRONE_MODES="real,real,sim"` (length `NUM_ROBOTS`, matching the commander's
> `drone_modes`) to the launch, and run with a **GUI** viewport
> (`ISAAC_SIM_HEADLESS=false`) so you can see it. Used by the hybrid squeeze in
> [Part C](../experiments/index.md). The avatar's rclpy node joins
> the drones' domain automatically (it sets `ROS_DOMAIN_ID=SVG_DOMAIN_ID`); for
> true hardware the Isaac container must also be able to reach the real drones'
> DDS traffic (host networking / discovery server) — see Troubleshooting.

> **Run headless.** For SVG ground control you never need the Isaac viewport —
> physics, PX4 SITL, and the ROS topics all run headless, and you watch the
> drones in RViz (`/svg/viz/markers`) instead. The launcher defaults to GUI
> mode (`ISAAC_SIM_HEADLESS` unset → `false`), which opens a viewport window;
> running headless avoids the viewport entirely and is the right default. Pass
> `ISAAC_SIM_HEADLESS=true`. (When launched via `./airstack.sh up` with
> `AUTOLAUNCH=true`, set `ISAAC_SIM_HEADLESS=true` in `.env` instead.)
>
> ⚠️ **Headless does NOT fix an RTX renderer segfault.** If Isaac crashes with a
> `Segmentation fault` whose backtrace is in `librtx.scenedb.plugin.so` /
> `libcarb.scenerenderer-rtx.plugin.so` at `carbOnPluginStartup` — and it still
> crashes headless, and even a bare empty `SimulationApp({"headless":True})`
> crashes the same way — that is a **GPU driver ↔ Isaac Sim version
> incompatibility**, not an AirStack bug. Seen on RTX 5080 / Blackwell with
> NVIDIA driver 595.x and Isaac Sim 5.1.0: the app boots to `app ready`, then
> the RTX renderer faults on the first frame. Clearing the shader cache does
> not help. Fix = run a driver Isaac Sim 5.1 supports (Linux **580.65.06**, or
> **591.74** which a Blackwell user confirmed works — driver **595.x crashes**),
> or move to a newer Isaac Sim release. See Troubleshooting below.

## A3. Build + per-drone MAVROS interfaces (fresh terminal)

```bash
cd ~/AirStack && ./airstack.sh connect robot --command=bash
echo $ROS_DOMAIN_ID                       # 1
cd ~/AirStack/robot/ros_ws && bws && sws  # bws first time / after edits
./src/svg_ground_control/scripts/launch_sim_interfaces.sh 3
```
Verify (any other shell): `ros2 topic echo /drone_1/interface/mavros/state
--once` → `connected: true`, then `ros2 topic hz
/drone_1/odometry_conversion/odometry` (~30 Hz after EKF converges, ~30 s).

## A4. Ground controller (fresh terminal)

> **Prerequisite — the per-drone interfaces must already be running.** The
> commander reads each drone's state from `/{name}/odometry_conversion/odometry`,
> produced by the interface layer — start it **before** this step:
> * **sim** → `./src/svg_ground_control/scripts/launch_sim_interfaces.sh N` (A3, MAVROS)
> * **real** → `ros2 launch svg_ground_control real_interfaces.launch.py drones:=drone_1,...`
>   (px4_interface, uXRCE-DDS — see [C0](../experiments/index.md#c0-start-the-per-drone-interfaces-required-before-any-task))
>
> Without it the commander logs `no drone eligible for takeoff (missing odometry)`.

```bash
cd ~/AirStack/robot/ros_ws && sws
ros2 launch svg_ground_control ground_control.launch.py            # default (hover, all-auto)
# or pick a scenario:
ros2 launch svg_ground_control ground_control.launch.py scenario:=head_on
# or the squeeze profile:
ros2 launch svg_ground_control ground_control.launch.py \
  config:=$(ros2 pkg prefix svg_ground_control)/share/svg_ground_control/config/squeeze_3drone.yaml
```

## A5. Gamepad teleop (optional — NOT used by any standard experiment)

> In the standard experiments a drone is **sim**, **real**, or **external**
> (RC-flown, tracked-only); the one Part C task that uses teleop is
> [C5](../experiments/hand-flown-intruder.md), the
> hardware squeeze with a gamepad-flown intruder. Hand-flying otherwise has
> its own configs (`teleop_single.yaml` sim, `teleop_real.yaml` one real
> drone via `./svg_teleop.sh real`) — see [teleop.md](../teleop/index.md). The
> keyboard teleop has been removed.

Any config takes a hand-flown drone by listing it in `teleop_drones` (or
`teleop_drones:=` on the commander launch). Teleop has its own launch: start
it FIRST, check the pad line it prints once a second, then start the
commander in a second terminal. Which device is the **`teleop_controller`**
parameter (config `safe_teleop` block or `teleop_controller:=`), an entry of
`svg_ground_control/safe_teleop/controllers.py`: `dragonrise_usb` (the generic
SHANWAN/DragonRise "Android gamepad" on the bench — the configs' default) or
`xbox_usb` (a real Xbox 360 pad); new devices are added there. The two differ
in axis numbers, not in how they fly. Identify an unknown pad with
`ros2 run svg_ground_control joy_map` before flying it — see
[teleop.md](../teleop/index.md).

The pad must be visible **inside the container**: `docker exec
airstack-robot-desktop-1 ls /dev/input/js0`. If it is missing, recreate the
container (`AUTOLAUNCH=false airstack up robot-desktop`); `/dev` is populated
once at container start, so a pad plugged in later needs the `/dev/input`
bind mount that `robot-base-docker-compose.yaml` now sets.

```bash
# terminal 1: the pad (prints "pad: fwd .. left .. climb .. yaw .. | cmd vx .." — move the sticks)
cd ~/AirStack/robot/ros_ws && sws
ros2 launch svg_ground_control teleop.launch.py drone:=drone_3
# terminal 2: the commander, same config
ros2 launch svg_ground_control ground_control.launch.py scenario:=squeeze teleop_drones:=drone_3
# right stick = move, left stick = up/down + yaw, LB = lock. Position mode: release
# the sticks and the commander holds the drone where it is (teleop_kp / teleop_lead_m).
```

## A6. Fly (fresh terminal)

```bash
cd ~/AirStack/robot/ros_ws && sws
ros2 service call /swarm_commander/takeoff std_srvs/srv/Trigger   # arm+ascend+hold
ros2 service call /swarm_commander/start   std_srvs/srv/Trigger   # scenario live
ros2 service call /swarm_commander/hold    std_srvs/srv/Trigger   # PANIC freeze
ros2 service call /swarm_commander/land    std_srvs/srv/Trigger   # descend+disarm
```

---

Source: [`robot/ros_ws/src/svg_ground_control/experiment.md`](https://github.com/castacks/AirStack/blob/yikuan/SVG_ground_control/robot/ros_ws/src/svg_ground_control/experiment.md) on the `yikuan/SVG_ground_control` branch of AirStack.
