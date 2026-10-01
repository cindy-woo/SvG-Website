# How SVG ground control is structured

```
 OptiTrack Motive ──▶ natnet_ros2 ──▶ /{name}/pose   (hardware only)
                                          │
                          ┌───────────────▼────────────────────────────┐
                          │ mocap_bridge → /{name}/fmu/visual_odometry │
                          └────────────────────────────────────────────┘
                          ┌────────────────────────────────────────────┐
 /{name}/odometry_        │ swarm_commander  (20 Hz)                   │
 conversion/odometry ──▶  │  scenario nominal | per-drone teleop       │
 /svg/{name}/teleop ───▶  │  → cbf_filter.filter_velocities()  [REAL]  │
                          │  → real: /{name}/fmu/trajectory_command    │
                          │          (reference + velocity + accel)    │
                          │    sim:  /{name}/interface/velocity_command│
                          │  services: takeoff / start / hold / land   │
                          └────────────────────────────────────────────┘
                                   │ per-drone robot_interface
                          sim: MAVROS          real: px4_interface (uXRCE-DDS)
```

Sim and hardware differ **only in the topic templates** in the config YAML
(`config/swarm_sim.yaml` vs `config/swarm_real.yaml`).

## 2. How SVG ground control is structured

Five executables (`robot/ros_ws/src/svg_ground_control/svg_ground_control/`):

| Script | Node | What it does |
|---|---|---|
| `swarm_commander.py` | `swarm_commander` | **The brain.** 20 Hz loop: build each drone's *nominal* velocity (from the scenario or teleop) → run the **CBF safety filter** → publish a per-drone command (real: reference position + velocity + acceleration; sim: velocity). Owns each drone's reference point, takeoff/start/hold/land/reset_fence services, the geofence, and the RViz markers. |
| `scenarios.py` | (library) | Nominal-velocity policies: `hover`, `goal`, `random_walk`, `random_goals`, `head_on`, `antipodal`, `squeeze`. Pure NumPy, ported from `~/drone_soccer`. |
| `trajectory.py` | (library) | The go-to-goal law: PX4-style braking law + acceleration-limited reference profile (`goal_accel_mps2`, `goal_settle_s`). See [C1](../experiments/single-goal.md). |
| `cbf_filter.py` | (library) | The velocity-CBF collision filter (`filter_velocities`), a verbatim port of `drone_soccer/cbf.py`. |
| `mocap_bridge.py` | `mocap_bridge` | Hardware only: `/{name}/pose` (mocap) → `/{name}/fmu/visual_odometry_in` for the PX4 EKF. |
| `safe_teleop/` | `safe_teleop` | Gamepad teleop for one `teleop_drones` drone: `/joy` → altitude-held ENU velocity on the teleop topic. Device = `teleop_controller` (`xbox_usb`; registry `safe_teleop/controllers.py`). See [teleop.md](../teleop/index.md). |

**Data flow inside `swarm_commander` each tick:**

```
 per-drone odometry  ──► (add drone_position_offsets → shared world frame)
        │
        ▼
   reference point per drone (where it was told to be; PX4 holds it)
        │
        ▼
   scenario.nominal_velocity()   ── OR ──  teleop / goal-command input
        │  (per-drone desired velocity + acceleration feedforward, ENU;
        │   accel-limited profile evaluated at the reference, trajectory.py)
        ▼
   cbf_filter.filter_velocities()   ◄── sees ALL drones' world positions
        │  (collision-safe velocities; cbf_exempt rows restored after)
        ▼
   geofence check (hold_all: latch + freeze all if any drone outside the box;
                   keep_in: clip each command at the walls instead)
        │
        ▼
   publish  real: /{name}/fmu/trajectory_command (reference + velocity + accel)
            sim:  /{name}/interface/velocity_command
         +  /svg/viz/markers (RViz)
```

**Three independent per-drone axes** — set any combination in *any* task
config (see [Part C](../experiments/index.md)):

- **Mode** (`drone_modes`): `sim` (commands via MAVROS `/interface/…`) or
  `real` (commands via px4_interface `/fmu/…`). A `real` drone also shows up in
  the Isaac viewport at its live pose via an avatar (Part A `DRONE_MODES`).
  Mixed per run → hybrid.
- **Role** (`teleop_drones`, `external_drones`): `auto` (scenario-driven),
  `teleop` (operator-driven via a teleop topic), `external` (tracked for the
  CBF but never commanded — e.g. RC-flown). Unlisted = `auto`.
  **Convention: the standard experiments never use teleop** — a drone is
  `sim`, `real`, or `external`; teleop remains a debugging utility only (A5).
- **CBF-exempt** (`cbf_exempt_drones`): the filter still *sees* these drones
  (so everyone else avoids them) but leaves their *own* command uncorrected —
  they play the moving obstacle. Independent of role: a policy-driven (`auto`)
  drone or a `teleop` drone can be exempt. Teleop is **not** auto-exempt; list
  it here if you want its manual commands left unfiltered. (The `squeeze`
  scenario additionally self-designates its intruder via
  `squeeze_intruder_cbf_exempt`; the two union.)

**Lifecycle services** (`std_srvs/Trigger`):
`~/takeoff` (arm+offboard+ascend to the scenario's initial layout, then hold)
→ `~/start` (scenario goes live) → `~/hold` (panic freeze) →
`~/land` (descend+disarm). Plus `~/reset_fence` (clear a geofence latch).

---

Source: [`robot/ros_ws/src/svg_ground_control/README.md`](https://github.com/castacks/AirStack/blob/yikuan/SVG_ground_control/robot/ros_ws/src/svg_ground_control/README.md), [`robot/ros_ws/src/svg_ground_control/experiment.md`](https://github.com/castacks/AirStack/blob/yikuan/SVG_ground_control/robot/ros_ws/src/svg_ground_control/experiment.md) on the `yikuan/SVG_ground_control` branch of AirStack.
