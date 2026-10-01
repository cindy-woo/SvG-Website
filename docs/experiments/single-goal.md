# C1 · Single-drone goal

One drone flies to a goal you set, at a speed you set. **One config does both
sim and real — `drone_modes` is the only switch** (`"sim"` → SITL/MAVROS,
`"real"` → hardware/`/fmu/`). Launch with **`use_mocap:=true` always**: on a
`real` drone the mocap bridge feeds PX4 EKF2 the external vision it needs to arm
(mocap → `/drone_1/fmu/in/vehicle_visual_odometry`, the **only** way EKF2 fuses a
position indoors — see [B4b](../hardware/external-vision.md)); in
`sim` it's a harmless no-op (no `/drone_1/pose`, SITL self-estimates). For a
1-drone sim, spawn with `NUM_ROBOTS=1` in A2 and `./launch_sim_interfaces.sh 1`
in A3; for `real`, connect the drone per [Part B](../hardware/index.md)
and set the EKF2 params (B4b) first.

Before flying:
```bash
# REAL drones — px4_interface stack (uXRCE-DDS, no MAVROS); comma-separate names.
# target_system = MAV_SYS_ID is taken from the name (drone_2 -> 2), see C0:
ros2 launch svg_ground_control real_interfaces.launch.py drones:=drone_1   # ,drone_2,...
```
If flying Drone 1:
```bash
MicroXRCEAgent udp4 -p 8888 -v4
```
If flying Drone 2:
```bash
MicroXRCEAgent udp4 -p 8889 -v4
```
If flying Drone 3:
```bash
MicroXRCEAgent udp4 -p 8892 -v4
```
```bash
ros2 launch svg_ground_control ground_control.launch.py \
  config:=$(ros2 pkg prefix svg_ground_control)/share/svg_ground_control/config/goal_single.yaml \
  use_mocap:=true
```
**How it flies (since 2026-09-20).** Real drones no longer get a bare
velocity setpoint. The commander keeps a *reference point* per drone (where
it was told to be, integrated from the published velocity) and flies an
acceleration-limited profile toward the goal from it, using PX4's own
braking law `v = -aL + sqrt((aL)² + 2ad)`; the reference, the velocity and
the acceleration go to PX4 in one `trajectory_command`, so PX4 closes the
position loop onboard with feedforward — the same structure as its Position
mode. Measured on drone_2 (px4_logs/, bag `drone_2_auto_goal_0920_192853`):
the old `1.5 × distance` P-law overshot a 7 m / 5 m/s leg by **1.0 m** and
needed 4.7 s to settle; PX4 Position mode stops from 5.8 m/s in 4.2 m with
0.35 m overshoot; the new law stops on the goal within ~0.05 m in the same
plant model (`test/test_trajectory.py`). Knobs, all live with
`ros2 param set /swarm_commander …`:

| param | default | meaning |
|---|---|---|
| `scenario_speed_mps` / `speed_command` | config | cruise cap; reached only if the goal is farther than `v²/(2a) + v·settle` (the commander logs this distance for every speed it receives) |
| `goal_accel_mps2` | 3.0 | acceleration and braking of the profile (drone_2 managed 5.5 in the logs; PX4 auto uses 3) |
| `goal_settle_s` | 0.3 | exponential tail into the goal; larger = softer stop, slower arrival |
| `goal_lead_m` | 2.0 | leash: how far the reference may get ahead of the drone (tracking lag at speed, a wall, a gust) before it is pulled back and the profile restarts from the drone's speed; the CBF does not need it (the reference only moves by the *published* velocity). PX4's `MPC_XY_ERR_MAX` |
| `real_command_mode` | `trajectory` | `velocity` sends the old TwistStamped instead (the px4_interface must be rebuilt for `trajectory`: `bws --packages-select px4_interface`) |
| `takeoff_speed_mps` | 0.5 | climb speed of the takeoff profile (braking law into the takeoff target, no P-law step) |
| `hold_lead_m` | 0.2 | reference leash while taking off / landing / holding outside a mission — keep small, PX4's altitude loop is stiff |

**Top speed the room allows.** A leg of length S needs `v²/a` to accelerate
and brake plus `v·settle` to ease in: `v² / goal_accel + v·goal_settle = S`.
Fence box 10 × 9.7 m, goals 0.5 m inside the walls: along y (8 m) 5.9 m/s at
6 m/s², 6.9 at 8; on the diagonal (−4,−4.7) → (5,4) = 12.5 m: **7.8 m/s at
6 m/s², 8.9 at 8**. 10 m/s needs ~15.5 m even at 8 m/s² — not in this room.
Keep `fence_brake_accel_mps2 >= goal_accel_mps2`, or the wall envelope caps
the cruise first (it did in run_035852: 4.7 m/s with brake 4).

Braking distance is `v²/(2·goal_accel_mps2) + v·goal_settle_s`: to brake later,
raise `goal_accel_mps2` (the airframe did 5.5 m/s² in the logs; PX4's own
manual braking asks up to 8) and/or lower `goal_settle_s` (0.2 is still a
clean stop in the plant model; below that the tail gets sharp). At 5 m/s:
3.0/0.3 → 5.7 m, 4.0/0.2 → 4.1 m, 5.5/0.2 → 3.3 m.

```bash
# control terminal:
ros2 service call /swarm_commander/takeoff std_srvs/srv/Trigger
ros2 service call /swarm_commander/start   std_srvs/srv/Trigger
# goal with heading: [x, y, z, theta]; theta in DEGREES, 0 = +X, CLOCKWISE
ros2 topic pub --once /svg/drone_1/goal_xyzt std_msgs/msg/Float64MultiArray "{data: [1.0, 0.5, 1.4, 90.0]}"
# (position-only form still works; its heading is +X = 0 deg)
ros2 topic pub --once /svg/drone_1/goal_command geometry_msgs/msg/PoseStamped \
  "{header: {frame_id: map}, pose: {position: {x: 1.0, y: 0.5, z: 1.4}}}"
ros2 topic pub --once /svg/drone_1/speed_command std_msgs/msg/Float32 "{data: 0.8}"
ros2 service call /swarm_commander/land std_srvs/srv/Trigger
```
**Safety with the CBF.** The CBF still filters velocities, and that is
still everything that moves a drone: the reference point (PX4's position
setpoint) is integrated from the *published*, filtered velocity, so it stops
when the CBF says stop; a CBF-corrected command carries as acceleration
feedforward the rate of change of the published command (capped at
`goal_accel_mps2`), so the evasion is flown with feedforward instead of
~0.5 s behind it (bag `run_020444`: every close pass — 0.52, 0.65, 0.79 m
against 1.1-1.3 m required — was that lag, the commanded closing speed was
already zero where the barrier says); the fence's braking feedforward owns
the axes a wall limited; and while the CBF corrects, the reference is held
on the short `hold_lead_m` leash so PX4's own, unfiltered pull toward the
reference stays below ~0.2 m/s.

**Heading.** Real drones on the trajectory output get an absolute yaw with
every setpoint: the goal's `theta` in the goal scenario, and **nose on +X
(0°) in every other scenario** (hover, squeeze, random goals, …) and while
taking off / holding. `theta` is degrees, 0 = +X of the mocap frame,
clockwise positive seen from above (90 = nose on −Y). A `goal_command`
PoseStamped may carry the heading as its quaternion (ENU yaw, the usual ROS
sense); an all-zero quaternion means 0°. Teleop drones yaw with the stick:
while it is deflected the setpoint carries the yaw *rate* and an all-zero
rotation (x, y, z **and** w — a `Quaternion` message defaults to w = 1,
which px4_interface read as "hold ENU yaw 0" and dropped the rate, so the
yaw stick did nothing in bag `run_053740`); the moment it is centred the
measured heading is adopted and held as an absolute yaw, as PX4's own
Position mode does. RViz shows the commanded heading as a white arrow. Sim /
velocity-only drones are not heading-controlled.

**Stick acceleration.** `teleop_accel_mps2` (live) ramps the stick velocity
at that rate and feeds the ramp's acceleration forward with the setpoint —
PX4's own Position mode (`MPC_ACC_HOR_MAX`, default 5). Without it a stick
step is followed at only ~4 m/s² by the velocity loop, which is why drone_2
peaked at 3.9 m/s with an 8 m/s stick in the 7.7 m teleop box (bag
`run_053740`): it never reached the wall's cap. Plant model, that box, brake
4: step 4.3 m/s, ramp 5 → 5.2 m/s, ramp 8 → 5.4 m/s (~40° bank); in the
9.7 m geofence span 5.0 / 5.8 / 6.1 m/s. Note that
8 m/s is not reachable there with a stop at the wall — from wall to wall the
drone accelerates for half the span and brakes for the other half, 6.2 m/s
at 5 m/s² with no lag at all — so a faster run needs a bigger box. Keep the
wall's `fence_brake_accel_mps2` at 4 with the ramp: 5-6 buy only
+0.2-0.4 m/s of peak in the model, and a slow-responding vehicle (0.2 s
attitude lag) then overshoots 0.2-0.7 m where 4 stays within 0.05 m.
**LEDs:** the strip is **green** throughout (daemon default + `led_controller`
block in `goal_single.yaml`; a single drone is never CBF-corrected). Recolor at
**any** time — armed or not, before takeoff, on the bench — the same way you
retarget a formation:
```bash
ros2 topic pub --once /svg/led_command std_msgs/msg/String "{data: 'drone_1 blue'}"        # name …
ros2 topic pub --once /svg/led_command std_msgs/msg/String "{data: 'drone_1 255,60,0'}"    # … or r,g,b[,w]
ros2 topic pub --once /svg/led_command std_msgs/msg/String "{data: 'drone_1 red blink'}"   # blink
ros2 topic pub --once /svg/led_command std_msgs/msg/String "{data: 'all green'}"           # every drone
```
Or as a **service call** (`airstack_msgs/srv/SetLedColor`: `color` = a name or
`"r,g,b[,w]"`, `mode` 0 = solid / 1 = blink; the reply says whether the strip
took it):
```bash
ros2 service call /svg/drone_1/set_led_color airstack_msgs/srv/SetLedColor "{color: blue}"
ros2 service call /svg/drone_1/set_led_color airstack_msgs/srv/SetLedColor "{color: '255,60,0', mode: 0}"
ros2 service call /svg/drone_1/set_led_color airstack_msgs/srv/SetLedColor "{color: red, mode: 1}"   # blink
ros2 service call /svg/set_led_color         airstack_msgs/srv/SetLedColor "{color: green}"          # every drone
```
(`ros2 service list | grep led` shows one `/svg/<drone>/set_led_color` per
drone in the `led_controller` block; quote the `r,g,b` form so YAML does not
read it as a list.)
Colors: off red green blue white yellow cyan magenta orange purple. Setup per
drone: [B1(d)](../hardware/voxl-setup.md); disable with `use_led:=false`.

---

Source: [`robot/ros_ws/src/svg_ground_control/experiment.md`](https://github.com/castacks/AirStack/blob/yikuan/SVG_ground_control/robot/ros_ws/src/svg_ground_control/experiment.md) on the `yikuan/SVG_ground_control` branch of AirStack.
