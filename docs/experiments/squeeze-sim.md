# C3 · Squeeze rehearsal

Holders (drone_1,2) hold their posts; the intruder (drone_3) shuttles through
the gap. drone_3 is **CBF-exempt** (`cbf_exempt_drones: "drone_3"`) so it
presses through and the holders alone yield.

**Why no `use_mocap` here (unlike C1/C2):** this config is the deliberately
**all-sim rehearsal** — `drone_modes: "sim,sim,sim"`, no real drone anywhere,
so no PX4 EKF needs external vision and `mocap_bridge` would have no
`/{name}/pose` inputs to forward. `use_mocap` only matters when at least one
drone is `real`. The two **hardware** squeeze variants are the next sections:
* real holders + **sim** intruder → [C4](hybrid-squeeze.md)
* real holders + **hand-flown (gamepad) teleop** intruder → [C5](hand-flown-intruder.md)

```bash
ros2 launch svg_ground_control ground_control.launch.py \
  config:=$(ros2 pkg prefix svg_ground_control)/share/svg_ground_control/config/squeeze_3drone.yaml
ros2 service call /swarm_commander/takeoff std_srvs/srv/Trigger
ros2 service call /swarm_commander/start   std_srvs/srv/Trigger
```

Run this rehearsal before either hardware variant — same scenario geometry,
zero risk.

---

Source: [`robot/ros_ws/src/svg_ground_control/experiment.md`](https://github.com/castacks/AirStack/blob/yikuan/SVG_ground_control/robot/ros_ws/src/svg_ground_control/experiment.md) on the `yikuan/SVG_ground_control` branch of AirStack.
