# CBF filter and safety

`svg_ground_control/cbf_filter.py` is a verbatim port of
`drone_soccer/cbf.py`: pairwise barrier `h = ||p_i−p_j||² − (2r)²`,
constraint `ḣ + αh ≥ 0` (linear in velocities), least-squares projection via
parallel Dykstra + Gauss-Seidel polish, constraint pruning, and an emergency
push-apart fallback when the QP is infeasible. `cbf_alpha` is the class-K
gain: lower = gentler (yields earlier, softer corrections), higher = more
aggressive (approaches closer, corrects harder). Tests:
[test/test_cbf.py](https://github.com/castacks/AirStack/blob/yikuan/SVG_ground_control/robot/ros_ws/src/svg_ground_control/test/test_cbf.py) (kinematic suite from drone_soccer),
[test/test_scenarios.py](https://github.com/castacks/AirStack/blob/yikuan/SVG_ground_control/robot/ros_ws/src/svg_ground_control/test/test_scenarios.py) (includes a kinematic
squeeze rollout), [test/test_runtime_params.py](https://github.com/castacks/AirStack/blob/yikuan/SVG_ground_control/robot/ros_ws/src/svg_ground_control/test/test_runtime_params.py)
(runtime `cbf_alpha` set/reject and the status snapshot), and
[test/functional_squeeze_test.py](https://github.com/castacks/AirStack/blob/yikuan/SVG_ground_control/robot/ros_ws/src/svg_ground_control/test/functional_squeeze_test.py)
(closed-loop ROS test against fake drones — barrier held at exactly 2r).

## Safety notes

- Teleop drones are CBF-protected by default, same as autonomous ones — the
  filter corrects an operator's command like any other drone's. Add a drone
  to `cbf_exempt_drones` if you deliberately want it uncorrected (e.g. it
  should act as the moving obstacle the others dodge); in that case the
  operator becomes the safety authority for it instead of the filter.
- This stack bypasses `drone_safety_monitor`; PX4 failsafes and the RC kill
  switch are the safety net. Configure them before flying.
- Stale odometry (> `state_timeout_s`) → zero-velocity command. A stale
  *teleop topic* (> `teleop_timeout_s`, i.e. the teleop node died) or a dead
  *gamepad* (safe_teleop publishes zeros) both mean "sticks at rest": the
  commander keeps holding the drone at its position-mode target — see
  teleop.md "Safety". `~/hold` is the panic button.
- `CBF emergency push-apart engaged` in the log means the QP went infeasible
  (drones inside each other's safety spheres) — land and investigate.

---

Source: [`robot/ros_ws/src/svg_ground_control/README.md`](https://github.com/castacks/AirStack/blob/yikuan/SVG_ground_control/robot/ros_ws/src/svg_ground_control/README.md) on the `yikuan/SVG_ground_control` branch of AirStack.
