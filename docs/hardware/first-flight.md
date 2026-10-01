# Preflight and first flight

## B5. See the drone in RViz (no flight)

Bring up the commander **without taking off** + the mocap bridge, then watch
the drone's marker track as you carry it. Confirms mocap → odometry → world
before anything arms.

```bash
cd ~/AirStack && ./airstack.sh connect robot --command=bash
ros2 launch svg_ground_control ground_control.launch.py \
  config:=$(ros2 pkg prefix svg_ground_control)/share/svg_ground_control/config/swarm_real.yaml \
  use_mocap:=true
# in another shell — does odometry track your hand?
ros2 topic echo /drone_1/odometry_conversion/odometry --once
```
Open RViz (see [RViz visualization](../ground-station/rviz.md)) and move the drone by
hand: its **red** sphere should follow on `/svg/viz/markers`. (To also see it in
the Isaac 3D viewport, launch Isaac with `DRONE_MODES` set — see Part A and the
flagship in C4.) Do **not** call `takeoff` here — this is preflight only.

## Part D — Real hardware: first flight & reference

Once [Part B](index.md) confirms tracking,
fly. The flight services are identical to sim ([A6](../getting-started/simulation.md#a6-fly-fresh-terminal)) —
only the config (real modes) and the safety discipline differ.

#### D1. Preflight + fly (fresh terminal)

```bash
cd ~/AirStack && ./airstack.sh connect robot --command=bash
ros2 topic hz   /drone_1/pose                                  # mocap arriving?
ros2 topic echo /drone_1/odometry_conversion/odometry --once   # tracks reality?
ros2 service call /swarm_commander/takeoff std_srvs/srv/Trigger
ros2 service call /swarm_commander/start   std_srvs/srv/Trigger
ros2 service call /swarm_commander/land    std_srvs/srv/Trigger
```

#### D2. First-flight safety

- **One drone first.** `drone_names: ["drone_1"]`, `drone_modes: "real"`,
  scenario `hover`, thumb on the **RC kill switch**. Then two. Then the demo.
- The geofence is a freeze-in-place, **not** a motor cutoff — the RC kill
  switch is the true cutoff ([Geofence](../safety/geofence.md)).
- Fit `arena_*` and `fence_*` to your capture volume before arming.
- Keep `cbf_max_speed_mps` conservative on hardware (`swarm_real.yaml` uses
  1.0).

---

Source: [`robot/ros_ws/src/svg_ground_control/experiment.md`](https://github.com/castacks/AirStack/blob/yikuan/SVG_ground_control/robot/ros_ws/src/svg_ground_control/experiment.md) on the `yikuan/SVG_ground_control` branch of AirStack.
