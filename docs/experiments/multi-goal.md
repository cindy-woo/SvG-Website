# C2 · Multi-drone goals

Assign different goals/speeds to different drones while flying; the CBF keeps
them apart when paths cross. Same dual-mode design as C1: **one config,
`drone_modes` is the only switch, per drone** (`"real,real"` = both hardware;
mix like `"real,sim"` for hybrid). Launch with **`use_mocap:=true` always** —
the config's `mocap_bridge` block feeds every real drone's EKF2 (sim drones
are a no-op, same as C1).

**Real-drone prerequisites, PER DRONE — for EVERY drone in the config's
`drone_names`** (the multi-drone part people miss; each drone needs its own
full chain in THIS session):
* each drone connected per [Part B](../hardware/index.md)
  on its **own agent port** (drone_1→8888, drone_2→8889, drone_3→8892) → run
  **one `MicroXRCEAgent udp4 -p <port> -v4` per drone** on the ground PC —
  including any agent you had running for a previous single-drone test (a
  closed C1 terminal ≠ a running agent);
* EKF2/mag params set on **each** drone (B4b.1 — they are per-drone, saved,
  rebooted);
* one `natnet_ros2` instance serves all bodies (`/drone_1/pose`, …);
* interfaces up **for all listed drones**:
  `ros2 launch svg_ground_control real_interfaces.launch.py drones:=drone_1,drone_2,drone_3`
  ([C0](index.md#c0-start-the-per-drone-interfaces-required-before-any-task)) —
  a name missing here is exactly "drone_X: no odometry / odometry stale,
  refuses takeoff" while the others fly. Per-drone triage:
  `ros2 node list | grep drone_X` → `ros2 topic hz /drone_X/pose` →
  best_effort echo `/drone_X/fmu/out/vehicle_odometry` →
  `ros2 topic hz /drone_X/odometry_conversion/odometry`;
* `drone_position_offsets` is **per drone**: a `real` slot is `0,0,0` (mocap is
  absolute — all real drones share the mocap origin), a `sim` slot is that
  drone's Isaac spawn (`x = 2*(i-1)-(N-1)`), e.g. hybrid `"real,sim"` →
  `[0,0,0, 1,0,0]`. All-real (current config) = all zeros; the commander's
  "offsets are all zero" startup warning is expected/benign in that case.
Before flying:
```bash
# REAL drones — px4_interface stack (uXRCE-DDS, no MAVROS); comma-separate names:
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
  config:=$(ros2 pkg prefix svg_ground_control)/share/svg_ground_control/config/goal_tracking.yaml \
  use_mocap:=true
# takeoff BOTH drones together + start, then retarget any drone any time:
ros2 service call /swarm_commander/takeoff std_srvs/srv/Trigger
ros2 service call /swarm_commander/start   std_srvs/srv/Trigger
ros2 topic pub --once /svg/drone_1/goal_command geometry_msgs/msg/PoseStamped \
  "{header: {frame_id: map}, pose: {position: {x: 1.5, y: 0.0, z: 1.2}}}"
ros2 topic pub --once /svg/drone_2/goal_command geometry_msgs/msg/PoseStamped \
  "{header: {frame_id: map}, pose: {position: {x: -1.5, y: 0.0, z: 1.2}}}"
ros2 topic pub --once /svg/drone_1/speed_command std_msgs/msg/Float32 "{data: 0.6}"
ros2 topic pub --once /svg/drone_2/speed_command std_msgs/msg/Float32 "{data: 1.0}"
```
**LEDs:** all real drones **green**; a drone turns **red for as long as the CBF
is altering its command** (paths crossing — the same moments the commander logs
`CBF active on: …`), then back to green. Recolor any time (works disarmed too), formation-style:
`ros2 topic pub --once /svg/led_command std_msgs/msg/String "{data: 'drone_2 blue'}"`,
`"{data: 'all white'}"`, `"{data: 'drone_1 red blink'}"` (per-drone topic
`/svg/<name>/led_command` takes just `"<color> [blink]"`; services
`/svg/<name>/set_led_color` still exist). Only drones listed in the config's
`led_controller.drone_names` (the real ones) are driven — setup per drone in
[B1(d)](../hardware/voxl-setup.md).

**Formation profiles — retarget the whole swarm with ONE command.** The config
defines named profiles (`formation_profiles` + one `formation_<name>` array
each, one x,y,z row per drone in `drone_names` order — edit/add/remove freely
in `goal_tracking.yaml`; keep pairs > 2*`cbf_safety_radius_m` apart and inside
the fence). Publishing a profile name sends every scenario-driven drone to its
slot simultaneously (any time after `start`; the CBF deconflicts the crossing;
external drones are skipped). Shipped examples: `home` (= the takeoff layout),
`line`, `triangle`, `diagonal`:

```bash
ros2 topic pub --once /svg/formation_command std_msgs/msg/String "{data: triangle}"
ros2 topic pub --once /svg/formation_command std_msgs/msg/String "{data: home}"   # back to start
ros2 topic pub --once /svg/formation_command std_msgs/msg/String "{data: next}"   # roll to the next profile
```

`next` cycles through the profiles in their `formation_profiles` order,
wrapping around — repeat the same command to step through the whole set. An
explicit profile name re-anchors the cycle there (`next` continues from it).
An unknown name is ignored with a warning listing the available profiles (check
the commander log). Per-drone `goal_command` / `speed_command` still work and
can fine-tune individual drones after a formation switch.

---

Source: [`robot/ros_ws/src/svg_ground_control/experiment.md`](https://github.com/castacks/AirStack/blob/yikuan/SVG_ground_control/robot/ros_ws/src/svg_ground_control/experiment.md) on the `yikuan/SVG_ground_control` branch of AirStack.
