# Commander features

- **Per-drone sim/real routing** (`drone_modes: "real,real,sim"`): each drone's
  commands route to MAVROS (`/{name}/interface/…`, sim) or px4_interface
  (`/{name}/fmu/…`, hardware), all under one CBF. See
  [config/hybrid_squeeze.yaml](https://github.com/castacks/AirStack/blob/yikuan/SVG_ground_control/robot/ros_ws/src/svg_ground_control/config/hybrid_squeeze.yaml).
- **Geofence**: `fence_enabled` + `fence_min`/`fence_max`, watched for every
  role. `fence_behavior: hold_all` — any airborne drone leaving the box
  latches a swarm-wide freeze until `~/reset_fence`; `keep_in` — commanded
  drones are braked at the walls and pushed back in, nobody stops. The wall
  is a braking envelope (`fence_brake_accel_mps2`, `fence_keep_in_gain`:
  cruise until the true braking distance, then a firm brake sent to PX4 as
  the acceleration feedforward — the old `gain × distance` cap overshot by
  0.5 m at 6 m/s, bag `run_045417`). A separate, smaller **teleop fence**
  (`teleop_fence_enabled`, `teleop_fence_min`/`max`, inside the geofence)
  bounds hand-flown drones the same way whatever `fence_behavior` is. The
  boxes and a fence-clipped ground grid (`fence_grid_cell_m`, world-aligned,
  whole metres brighter) are published with the drone markers.
- **Position hold and trajectories** (`trajectory.py`, `position_hold.py`):
  every commanded drone has a reference point (where it was told to be),
  which real drones receive as PX4's position setpoint together with the
  velocity and acceleration feedforward, so PX4 holds position onboard and
  tracks like its own Position mode. Scenario drones fly an
  acceleration-limited profile with PX4's braking law toward their goal
  (`goal_accel_mps2`, `goal_settle_s`, `goal_lead_m`); hand-flown drones move
  the reference with the sticks, so released sticks hold position on all
  axes (`teleop_lead_m`; horizontal and vertical lead leashed separately, so
  x-y lag never moves the altitude reference). A CBF-corrected command keeps
  a feedforward — the rate of change of the published command, capped at
  `goal_accel_mps2` — so an evasion is flown with it rather than ~0.5 s
  behind it (`command_feedforward`; bag `run_020444`). The climb and the
  non-mission hold evaluate their braking law at the reference point too
  (`profile_point`), so the setpoint settles on the spot instead of
  swinging ±0.15 m around it at ~4 s (bags `run_042957`, `run_042433`). Measured on drone_2: the old `1.5 × distance`
  velocity P-law overshot a 5 m/s leg by 1 m; see experiment.md C1.
- **Heading**: real drones are told an absolute yaw with every setpoint —
  the goal's `theta` in the goal scenario, nose on +X everywhere else
  (0° = +X, clockwise positive). Teleop yaws at the stick's rate (all-zero
  rotation in the setpoint) and holds the measured heading when it is
  centred. The stick velocity is ramped at `teleop_accel_mps2` with the
  acceleration fed forward, like PX4's own Position mode.
- **RViz**: all drones' world positions on `/svg/viz/markers`
  (`rviz2 -d $(ros2 pkg prefix svg_ground_control)/share/svg_ground_control/config/svg_drones.rviz`).
- **Status snapshot** (`status_topic`, default `/svg/commander_status`,
  `std_msgs/String` JSON at `status_rate_hz` = 5 Hz): mission state
  (`mission_active`, `mission_ever_started`, `mission_started_at`,
  `fence_breached`), the outcome of the last lifecycle service
  (`last_command` + a `command_seq` counter), the live CBF gains and which
  drones the CBF is correcting, and per drone its `FlightState`, world
  position, speed, odometry freshness, DDS reception counters
  (`odom_rx_total` / `odom_lost_total` from the reader's `message_lost`
  event — a measured drop count, not a timing guess) and the result of its
  last `robot_command` (offboard / arm / disarm). Built by `build_status()`; the
  [SVG Basestation Foxglove panel](../ground-station/basestation.md)
  (in this package's `foxglove/` directory, with the `svg_basestation.json`
  layout and its `install.py`) uses it to confirm Start really took effect
  and to show numeric positions.
- **Runtime tuning**: the CBF gains (`cbf_alpha`, `cbf_safety_radius_m`,
  `cbf_max_speed_mps`) can be changed while flying and apply on the next
  control tick (`ros2 param set /swarm_commander cbf_alpha 4.0`, or the
  panel's CBF sliders via `set_parameters`); non-positive / non-finite
  values are rejected. The speed and tracking gains (`scenario_speed_mps`,
  `teleop_max_speed_mps`, `goal_accel_mps2`, `goal_settle_s`, `goal_lead_m`,
  `goal_velocity_only_settle_s`, `teleop_kp`, `teleop_lead_m`, `hover_kp`,
  `hold_lead_m`, `takeoff_speed_mps`) are live too. Everything else is read
  once at startup; a `ros2 param set` on it is refused with a reason.

Full how-to for all of the above: **[experiment.md](../getting-started/simulation.md)**.

---

Source: [`robot/ros_ws/src/svg_ground_control/README.md`](https://github.com/castacks/AirStack/blob/yikuan/SVG_ground_control/robot/ros_ws/src/svg_ground_control/README.md) on the `yikuan/SVG_ground_control` branch of AirStack.
