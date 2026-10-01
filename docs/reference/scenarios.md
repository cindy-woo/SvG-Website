# Scenarios

Ported from drone_soccer plus goal-tracking and a squeeze profile:

- `hover` — hold configured positions
- `goal` — each drone seeks a per-drone goal you set live via
  `/svg/{name}/goal_xyzt` (`[x, y, z, theta_deg]`, theta 0 = +X, clockwise)
  or `/svg/{name}/goal_command` (PoseStamped) + `/svg/{name}/speed_command`
  (Float32); backs the single- and multi-drone tracking tests
- `random_walk` — fixed-speed drift with wall bounces
- `random_goals` — random goal seeking, resampled on arrival
- `head_on` — two facing groups swap sides repeatedly
- `antipodal` — sphere-to-antipode crossings through the center
- `squeeze` — **3-drone CBF showcase** ([config/squeeze_3drone.yaml](https://github.com/castacks/AirStack/blob/yikuan/SVG_ground_control/robot/ros_ws/src/svg_ground_control/config/squeeze_3drone.yaml)):
  two holders goal-track explicit posts; the intruder shuttles through the
  gap; the holders must yield and return. Order: `[holder, holder, intruder]`.

`teleop_drones` (comma-separated string) lists operator-driven drones — empty
= fully autonomous. Teleop is a control-source role, not a safety exemption:
a teleop drone's commanded velocity is still passed through the CBF filter
like any autonomous drone unless it is also listed in `cbf_exempt_drones`
(separate, opt-in, empty by default). `external_drones` are tracked for the
filter but never commanded (e.g. RC-flown).

The maintained way to hand-fly a drone is the **`safe_teleop`** gamepad driver
(sticks = velocity, flown in position mode by the commander so released
sticks hold position; stick lock), brought up end to end by `scripts/svg_teleop.sh` — sim experiments
(`solo`/`squeeze`/`hover`) and one real drone (`real`,
[config/teleop_real.yaml](https://github.com/castacks/AirStack/blob/yikuan/SVG_ground_control/robot/ros_ws/src/svg_ground_control/config/teleop_real.yaml)). See
**[teleop.md](../teleop/index.md)** for controls, pad diagnostics, axis signs, and the
real-drone ground check. `teleop.launch.py` starts the input driver and
`safe_teleop` in their own terminal (printing the pad reading, so it is
checked before the commander comes up); the device is the
`teleop_controller` parameter (`dragonrise_usb`, `xbox_usb`; registry in
[safe_teleop/controllers.py](https://github.com/castacks/AirStack/blob/yikuan/SVG_ground_control/robot/ros_ws/src/svg_ground_control/svg_ground_control/safe_teleop/controllers.py)).
The old keyboard teleop has been removed; `xbox_teleop` (direct stick-to-
velocity, no altitude hold) remains as an ad-hoc utility.

---

Source: [`robot/ros_ws/src/svg_ground_control/README.md`](https://github.com/castacks/AirStack/blob/yikuan/SVG_ground_control/robot/ros_ws/src/svg_ground_control/README.md) on the `yikuan/SVG_ground_control` branch of AirStack.
