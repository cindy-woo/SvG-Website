# Tasks: any drone in any mode

One framework, not "sim tests vs hardware tests". Every task is a config; each
config exposes the **three per-drone axes** (see §2) and you pick them freely:

```yaml
drone_modes:        "sim,sim,sim"   # per drone: sim -> SITL/MAVROS, real -> hardware/fmu
teleop_drones:      ""              # operator-driven (else scenario-driven)
external_drones:    ""              # tracked by CBF, never commanded
cbf_exempt_drones:  ""              # CBF won't correct these (still obstacles)
```

"Pure sim", "all real", and "hybrid" are just different `drone_modes` vectors on
the **same** task. To make a drone real: set its slot to `real` (commands route
to `/fmu/…`; it must be connected per [Part B](../hardware/index.md),
and Isaac shows it as an avatar). Nothing else in the task changes.

All-sim tasks assume Part A (A1–A3) is up; any `real` drone assumes Part B.

## C0. Start the per-drone interfaces (required before any task)

The commander reads every drone's state from `/{name}/odometry_conversion/odometry`
— which is **always** produced by an interface node, in *both* modes. `drone_modes`
only switches the *command* routing; the *state* side still needs the matching
interface running, or the commander reports `no drone eligible for takeoff (missing
odometry)`:

```bash
# SIM drones — MAVROS/SITL interfaces (same as A3); arg = number of sim drones:
./src/svg_ground_control/scripts/launch_sim_interfaces.sh 1

# REAL drones — px4_interface stack (uXRCE-DDS, no MAVROS); comma-separate names:
ros2 launch svg_ground_control real_interfaces.launch.py drones:=drone_1   # ,drone_2,...
# target_system (= the drone's MAV_SYS_ID) defaults to the name's number (drone_2 -> 2);
# override with target_systems:=1,2,3 if your ids differ. Check the startup line:
#   [drone_2.fmu.px4_interface]: PX4Interface initialized (uXRCE-DDS), target_system=2
```

For a **real** drone this is the analogue of A3 — it brings up `px4_interface`
(converts `/{name}/fmu/out/vehicle_odometry` → `…/odometry_conversion/odometry`) and
`odometry_conversion`. Confirm it before launching the commander:
```bash
ros2 node list | grep -E 'px4_interface|odometry_conversion'   # both present, per drone
ros2 topic echo /drone_1/odometry_conversion/odometry --once   # a pose appears (tracks reality)
```
If `odometry_conversion/odometry` is empty even though `/{name}/fmu/out/vehicle_odometry`
streams, check the interface stack is actually up (a dead `microdds_client` or a
crashed `px4_interface` is the usual cause).

---

Source: [`robot/ros_ws/src/svg_ground_control/experiment.md`](https://github.com/castacks/AirStack/blob/yikuan/SVG_ground_control/robot/ros_ws/src/svg_ground_control/experiment.md) on the `yikuan/SVG_ground_control` branch of AirStack.
