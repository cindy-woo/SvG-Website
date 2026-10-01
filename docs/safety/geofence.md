# Geofence

The box `[fence_min, fence_max]` (world ENU) in `swarm_commander`, watched
for every role — commanded drones once they are ACTIVE (climb-out and landing
pass through the floor on purpose), external RC-flown drones whenever they
are airborne (above `land_complete_altitude_m`, fresh odometry). What a
breach does is `fence_behavior`:

- **`hold_all`** (default, every autonomous config): a safety latch. Any
  watched drone outside the box freezes *every* drone at its current
  position, stops the scenario, and refuses `start` until `~/reset_fence`.
  An external drone trips it too — the holders stop; the RC pilot must bring
  their own drone back.
- **`keep_in`** (the teleop configs): nobody stops. Each commanded drone's
  velocity is clipped per axis so it cannot cross a wall, and a drone found
  outside is pushed back in. The wall is a **braking envelope**
  (`fence.wall_speed`, PX4's own braking law): the outward speed may not
  exceed the speed from which a stop *at* the wall is still reachable
  decelerating at `fence_brake_accel_mps2` — `sqrt(2·a·d)` far out, so the
  cruise speed is kept until the true braking distance
  `v²/(2a) + v/gain` and the brake is then firm — and, in the last stretch,
  `fence_keep_in_gain` × the distance left (the tail into the wall and the
  push-back rate from outside). `1/gain` is the response lag the envelope
  allows for. On the trajectory output the envelope's deceleration goes to
  PX4 as the acceleration feedforward on the limited axes
  (`fence.keep_in_acceleration`), so the vehicle brakes with the command
  instead of a velocity-loop lag later. A hand-flown drone's position target
  is clamped into the box as well. External drones cannot be steered; keep_in
  only logs them. `fence_margin_m` shrinks the box so the wall is met that
  early. All three dynamics are live (`ros2 param set`).

  *Why the envelope:* bag `run_045417` (drone_2, 8 m/s stick, keep_in, gain
  1, brake 0) went **0.35-0.68 m past the wall on every one of eleven
  approaches at ~6 m/s**. The old `gain × distance` cap starts falling 6 m
  out and is zero *at* the wall, but PX4 follows a bare velocity setpoint
  with ~0.1 s of delay and a ~0.55 s velocity-loop time constant (no
  feedforward was sent while the fence was active), so the drone was still
  doing 1.5 m/s when it crossed. Raising that gain makes it worse — the
  command drops faster than the vehicle can follow. In the plant model of
  `test_trajectory.py` (which overshoots 0.4 m at 6 m/s and 2.3 m at 8 m/s
  with the old cap), brake 4 m/s² + gain 2 + feedforward stops within
  0.02 m from 0.5-8 m/s and is at rest on the wall in 2.4-4.3 s, sooner
  than the old cap needs to overshoot and come back
  (`test_fence_and_position_hold.py`). The gain is also the stiffness of
  the last stretch: 3 rings at the wall through the 0.3 s loop delay, so
  use 2 on the trajectory output. Sim (velocity-only) drones get no
  feedforward and lag ~0.7 s: gain 0.7 (a 1.4 s margin) and brake 2.

- **Teleop fence** (`teleop_fence_enabled`, `teleop_fence_min` /
  `teleop_fence_max`): a second, smaller box for **hand-flown drones only**,
  which must lie inside the geofence (the commander refuses to start
  otherwise). The sticks meet it as a keep_in wall — same envelope, gain and
  margin as above — *whatever* `fence_behavior` is, so a pilot never reaches
  the geofence and the geofence stays the outer safety net (a `hold_all`
  geofence still latches if something else goes wrong). Scenario-driven and
  external drones ignore it. Drawn amber in the 3D view; the status snapshot
  carries both boxes (`fence`, `teleop_fence`). A floor above the ground is
  fine: only an ACTIVE drone is held inside a keep_in box — velocity clip
  *and* reference clamp — so take-off and landing pass through it. (The
  reference used to be clamped in every state, and a landing drone with
  `teleop_fence_min` z = 0.3 hovered at 0.3 m: PX4's stiff altitude loop
  held the clamped position setpoint against the descent command.)

Config (per profile):
```yaml
fence_enabled: true
fence_behavior: "hold_all"      # or "keep_in"
fence_brake_accel_mps2: 4.0     # keep_in: braking deceleration of the envelope (m/s2); 0 = plain gain*d
fence_keep_in_gain: 2.0         # keep_in: near-wall speed <= gain*distance (1/s); 1/gain = lag margin (sim: 0.7, brake 2)
fence_margin_m: 0.0             # keep_in: m
fence_min: [-2.5, -2.5, 0.3]    # x,y,z lower limits (world ENU, m)
fence_max: [ 2.5,  2.5, 2.5]    # x,y,z upper limits
teleop_fence_enabled: true      # hand-flown drones: a smaller keep_in box inside the geofence
teleop_fence_min: [-1.5, -1.5, 0.5]
teleop_fence_max: [ 1.5,  1.5, 2.0]
```
Recover — **no relaunch needed**:
```bash
ros2 service call /swarm_commander/reset_fence std_srvs/srv/Trigger
# or the "Reset Fence" button in the SVG Basestation panel
```
`reset_fence` only clears the `hold_all` latch — it does not move anything. If
a drone is **still hovering outside** the box, clearing is not enough: the
check runs every control tick and re-latches immediately (the reply warns
`still outside: drone_1`). The recovery is:

1. `land` — descent is fence-exempt; the drone touches down where it is and
   disarms.
2. `takeoff` — the climb-out is fence-exempt too and flies to the drone's
   takeoff target (`hover_positions` / the initial goal), which is inside the
   box, so it arrives holding inside and `start` is accepted again.

(`land` / `takeoff` act on every commanded drone, so the others cycle with it.)
A drone that **landed** outside needs only step 2. Also fix what sent it out —
a `goal_command` or formation profile beyond the wall will do it again on the
next `start`; under `hold_all` the commander does not clamp goals to the fence.

`hold_all` is a freeze-in-place, not a motor cutoff, and `keep_in` is a
velocity clip, not a wall — the RC kill switch remains the true cutoff. The
fence box is drawn in RViz / Foxglove (green normally, red when latched),
together with a **ground grid on the fence floor** clipped to the fence
footprint: lines on world multiples of `fence_grid_cell_m` (default 0.5 m; `0`
disables), whole metres brighter, so x=0 / y=0 are on the grid and a drone's
position reads straight off it. It follows whatever fence the loaded config
has — the 3D panel's own grid is a fixed 8 m square on the origin and is
turned off in `svg_basestation.json` for that reason.

---

Source: [`robot/ros_ws/src/svg_ground_control/experiment.md`](https://github.com/castacks/AirStack/blob/yikuan/SVG_ground_control/robot/ros_ws/src/svg_ground_control/experiment.md) on the `yikuan/SVG_ground_control` branch of AirStack.
