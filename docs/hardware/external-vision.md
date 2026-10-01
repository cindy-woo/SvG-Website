# External vision into EKF2

Indoors with no GPS/VIO, PX4 EKF2 has **no position source** unless mocap is
fed in as external vision. Until it fuses one it produces no estimate, emits
no `/fmu/out/vehicle_odometry`, and **refuses to arm ("fuse failure")**. The
feed path (with `px4_vio_mode: direct`, the default):

```
/{name}/pose ─ mocap_bridge ─► /{name}/fmu/in/vehicle_visual_odometry
            (px4_msgs/VehicleOdometry: timestamp 0, quality 100, pose-only)
                                   │
                                   ▼  EKF2 (needs EKF2_EV_CTRL set)
                            /{name}/fmu/out/vehicle_odometry
```

**1. PX4 params for pure-mocap flight (per drone, once — QGC or `px4-param`;
the comms script does NOT set these).** Without them PX4 ignores
`vehicle_visual_odometry` entirely, or keeps fusing mag/GPS against it:
```
# --- external vision in ---
EKF2_EV_CTRL = 11      # bitmask: horiz pos(1) + vert pos(2) + yaw(8) = 11
                       #   yaw bit 8 REQUIRED for mocap yaw; without it EKF
                       #   takes heading from the mag -> "yaw estimate error"
EKF2_HGT_REF = 3       # height reference = Vision
EKF2_EV_DELAY ≈ 50     # ms; mocap-over-WiFi latency (tune)

# --- competing sources OFF (indoors, mocap-only) ---
EKF2_GPS_CTRL = 0      # no GPS indoors
EKF2_MAG_TYPE = 5      # magnetometer = None (EKF side)
SYS_HAS_MAG   = 0      # SYSTEM side — easy to miss; without it the EKF still
                       #   waits on / fuses the mag (cs_mag_hdg stays true)
# EKF2_BARO_CTRL = 0   # optional: also drop baro height (EV height only)
```
Then **save and reboot** — both are required:
```bash
px4-param save                    # unsaved params DIE on power loss
systemctl restart voxl-px4        # mag/EV fusion is configured at EKF INIT;
                                  # a live param change does not take effect
```
> Older ModalAI builds have `EKF2_AID_MASK` instead of `EKF2_EV_CTRL`
> (vision-position + vision-yaw bits) — check with `px4-param show EKF2_EV_CTRL`.

**1b. Disable onboard VIO (pure mocap only).** A stock ModalAI drone runs its
own VIO (`voxl-qvio-server` → `voxl-vision-hub`) which injects a SECOND,
competing pose into the same EV input — EKF sees two disagreeing sources and
degrades/rejects. On the VOXL:
```bash
sed -i 's/"en_vio":.*true/"en_vio": false/' /etc/modalai/voxl-vision-hub.conf   # or edit by hand
systemctl restart voxl-vision-hub          # keep it RUNNING (other services need it)
systemctl disable --now voxl-qvio-server   # stop the VIO estimator itself
# do NOT touch voxl-mavlink-server — that is the QGC link
```

**1c. Verify fusion state (VOXL — note it's `px4-listener`, not `listener`):**
```bash
px4-listener vehicle_visual_odometry     # mocap EV arriving? timestamp a few ms old, steadily
px4-listener estimator_status_flags      # WANT: cs_ev_pos/cs_ev_hgt/cs_ev_yaw = True,
                                         #       cs_mag_hdg = False  (mag truly off)
px4-listener vehicle_local_position      # xy_valid / z_valid = True once converged (~20-30 s still)
```
`cs_mag_hdg: True` after all of the above → params didn't take (not saved /
no reboot / wrong drone — they are PER DRONE).

**2. Verify the feed reaches PX4 — mind the QoS.** PX4 `/fmu/*` topics are
**best_effort**; a plain `ros2 topic echo` (reliable) shows **nothing** and
looks broken when it isn't. Always:
```bash
ros2 topic hz   /drone_1/fmu/in/vehicle_visual_odometry            # ~mocap rate (mocap_bridge alive)
ros2 topic echo /drone_1/fmu/out/vehicle_odometry --once \
  --qos-reliability best_effort --qos-durability volatile          # EKF IS fusing -> position appears
```
If `in/…` streams but `out/…` stays silent, EKF2 isn't accepting it → re-check
the params above, or the timestamp/frame below.

**3. Frame hand-check (do before every first flight).** Carry the drone a
metre toward PX4 **North** (the agreed forward), watch `out/vehicle_odometry`:
`position[0]` (N) must **increase**; carrying East increases `position[1]`;
lifting it increases nothing in z down (`position[2]` decreases). If axes are
swapped/mirrored, your mocap isn't ROS-ENU — flip `px4_vio_frame:
"modalai_flip"` in `swarm_real.yaml` (the reference transform) and re-check.
This `direct`/`modalai_flip` path reproduces the proven `model_ai_tfpub.cpp`.

---

Source: [`robot/ros_ws/src/svg_ground_control/experiment.md`](https://github.com/castacks/AirStack/blob/yikuan/SVG_ground_control/robot/ros_ws/src/svg_ground_control/experiment.md) on the `yikuan/SVG_ground_control` branch of AirStack.
