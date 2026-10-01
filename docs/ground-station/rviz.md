# RViz

The commander publishes all drones' **world** positions (offset-corrected, so
real + simulated share one frame) as a `MarkerArray` on `/svg/viz/markers`:
an Iris body mesh per drone coloured by planner status — green = planner not
launched, blue = running, red = stopped after running, dim gray = landing; with
overrides orange = frozen-on-breach, yellow = teleop, gray = external —
translucent safety sphere (2r), name/mode/role label, goal points, and the
geofence box. The mesh is
`package://robot_descriptions/iris/meshes/base_link_body_body.stl`, so
`robot_descriptions` must be built in this workspace (`bws` does it).

```bash
# from a robot-container shell (./airstack.sh connect robot --command=bash):
# ROS_DOMAIN_ID + workspace are already set by .bashrc. Needs an X display.
rviz2 -d $(ros2 pkg prefix svg_ground_control)/share/svg_ground_control/config/svg_drones.rviz
```
The config sets fixed frame `map` and adds the MarkerArray display. If you
open a bare `rviz2`: set Fixed Frame = `map`, Add → By topic →
`/svg/viz/markers`. This is the unified "see all drones" view for hybrid runs.

For the operator view with the safety stop and telemetry, see
[Foxglove visualization](foxglove.md) — same markers, plus the
SVG Basestation panel.

**Hand-carry / preflight (no flight needed).** The markers come from
`swarm_commander`, not the drones directly, so the chain is: interface layer
→ `/{name}/odometry_conversion/odometry` → commander → `/svg/viz/markers` →
RViz. To watch drones move by hand with nothing armed:
1. bring up the per-drone interfaces (Part A A3 for sim, or Part B for
   hardware: px4_interface + NatNet + mocap bridge) so odometry flows;
2. launch `ground_control.launch.py` but **do NOT call takeoff** — the
   commander idles in IDLE, publishes zero commands, and still publishes
   markers every tick;
3. launch RViz.
Now move each drone by hand and its sphere tracks live — the ideal hardware
preflight to confirm mocap→odometry matches reality before arming. If RViz is
empty: `ros2 topic hz /svg/viz/markers` (should be ~20 Hz; if silent the
commander isn't running) and `ros2 topic echo
/{name}/odometry_conversion/odometry --once` (a drone with no odometry is
skipped in the markers).

---

Source: [`robot/ros_ws/src/svg_ground_control/experiment.md`](https://github.com/castacks/AirStack/blob/yikuan/SVG_ground_control/robot/ros_ws/src/svg_ground_control/experiment.md) on the `yikuan/SVG_ground_control` branch of AirStack.
