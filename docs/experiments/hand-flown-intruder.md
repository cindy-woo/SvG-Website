# C5 · Hand-flown intruder

Your experiment plan #2: **drone_1,2 real holders** (commander-flown, hold the
posts and yield via the CBF) + **drone_3 real, flown by a human pilot on the
gamepad** as the intruder. drone_3 is a **`teleop_drones`** entry: the
commander arms it, lifts it to intruder waypoint A at `takeoff`, hands it to
the sticks at `start` (position mode — released sticks hold), and lands it
with the holders. It is listed in **`cbf_exempt_drones`**, so its stick goes
out uncorrected and the holders alone yield; the CBF sees its *commanded*
(ramped, capped) velocity as a fixed row, so the holders start moving before
it arrives. A **teleop fence** (amber box inside the geofence) is the soft
wall the pilot meets; the keep_in geofence bounds all three.

(The earlier setup — drone_3 on its own RC link, `external_drones`, merely
tracked with its *measured* velocity in the filter — is a two-line switch
listed in the config's header. An external drone may NOT also be in
`cbf_exempt_drones`; the commander rejects that config.)

**Mocap goes to ALL THREE drones** (the config's `mocap_bridge` lists
drone_1,2,3): every drone flies offboard on the commander's setpoints and
needs external vision to arm — set the B4b.1 EKF2/mag params on all three.

Prerequisites (all three drones per [Part B](../hardware/index.md)):
* own agent port per drone (8888/8889/8892) → **three** `MicroXRCEAgent`s;
* B4b.1 params set + saved + rebooted on **each** drone;
* Motive bodies `drone_1..3` streaming; interfaces for **all three**:
  `ros2 launch svg_ground_control real_interfaces.launch.py drones:=drone_1,drone_2,drone_3`
* the gamepad, checked before anything is armed ([teleop.md](../teleop/index.md)).

```bash
# terminal 1 — the pad (prints what it reads; move the sticks, nothing flies yet):
ros2 launch svg_ground_control teleop.launch.py \
  config:=$(ros2 pkg prefix svg_ground_control)/share/svg_ground_control/config/squeeze_rc_intruder.yaml \
  drone:=drone_3

# terminal 2 — commander (mocap always on):
ros2 launch svg_ground_control ground_control.launch.py \
  config:=$(ros2 pkg prefix svg_ground_control)/share/svg_ground_control/config/squeeze_rc_intruder.yaml \
  use_mocap:=true

# fly (terminal 3):
ros2 service call /swarm_commander/takeoff std_srvs/srv/Trigger   # arms/lifts ALL THREE:
                                                                  # holders to their posts, drone_3 to waypoint A
ros2 service call /swarm_commander/start   std_srvs/srv/Trigger   # holders on posts; drone_3 on the sticks
# fly drone_3 through the gap — watch the yellow (teleop) marker + red holders yield in RViz.
ros2 service call /swarm_commander/land    std_srvs/srv/Trigger   # lands ALL THREE
```

> ⚠️ **Safety — the fences are velocity clips, not a motor cutoff.** In
> `keep_in` (this config) drone_3 is braked at the teleop fence and the
> holders at the geofence; in `hold_all` a breach by anyone freezes all three.
> The RC kill switch remains the true cutoff for every drone. If drone_3's
> odometry goes stale (mocap dropout) the commander sends it zero velocity
> and the scenario pauses; if the pad goes stale (`teleop_timeout_s`) the
> stick reads zero and position hold keeps drone_3 where it is.

**LEDs (`led_controller` block in `squeeze_rc_intruder.yaml`, all three drones
set up per [B1(d)](../hardware/voxl-setup.md)):** everyone is **green**. A
**holder turns red while the CBF is pushing it out of the intruder's way** (the
commander publishes the corrected names on `/svg/cbf_active` every tick; the LED
node holds red ≥ 0.5 s so short corrections are visible) and returns to green
when its command is no longer altered. drone_3 is CBF-exempt — its stick is
never "corrected" — and stays green; give the pilot's drone its own color if
useful: `ros2 topic pub --once /svg/led_command std_msgs/msg/String "{data: 'drone_3 blue'}"`.
A CBF **emergency push-apart** turns every holder red. Watch the signal itself
with `ros2 topic echo /svg/cbf_active`.

---

Source: [`robot/ros_ws/src/svg_ground_control/experiment.md`](https://github.com/castacks/AirStack/blob/yikuan/SVG_ground_control/robot/ros_ws/src/svg_ground_control/experiment.md) on the `yikuan/SVG_ground_control` branch of AirStack.
