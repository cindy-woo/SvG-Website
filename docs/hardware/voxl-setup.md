# Per-drone one-time setup

**(a) VOXL2 comms — one-shot script.** [`scripts/voxl_setup_real_drone.sh`](https://github.com/castacks/AirStack/blob/yikuan/SVG_ground_control/robot/ros_ws/src/svg_ground_control/scripts/voxl_setup_real_drone.sh)
does the entire comms bring-up *on the VOXL*: points PX4's client at the ground
PC, namespaces topics to `/{name}/fmu/...`, pins the DDS domain, disables the
onboard `voxl-microdds-agent`, restarts `voxl-px4`, and verifies the session.
Idempotent — safe to re-run or re-point to a new IP/name.

*Getting it onto the drone:*
```bash
# from the ground PC (repo root):
adb push robot/ros_ws/src/svg_ground_control/scripts/voxl_setup_real_drone.sh /usr/bin/
# in the VOXL adb shell (root):
chmod +x /usr/bin/voxl_setup_real_drone.sh
voxl_setup_real_drone.sh <robot_name> <ground_pc_ip> [domain_id=1] [port=8888]
#   e.g.  voxl_setup_real_drone.sh drone_1 192.168.123.134 1 8888
# confirm the edit landed + the client connected:
grep -n 'microdds_client start' /usr/bin/voxl-px4-start   # -h <ip> -p 8888 -n <name>
px4-microdds_client status                                # "connected", Agent IP=<ground_pc_ip>
# If not connected:
px4-microdds_client start -t udp -h 192.168.50.2 -p <port> -n <name>
```

*Required on the ground side* — the agent must run where the topics are created
(B2), then verify on the **ground PC** (robot container, `ROS_DOMAIN_ID=1`):
```bash
cd ~/AirStack && ./airstack.sh connect robot --command=bash
MicroXRCEAgent udp4 -p 8888 -v4            # leave running; logs "session established <VOXL_IP>"
# another shell on the ground PC:
ros2 topic list | grep drone_1/fmu         # /drone_1/fmu/out/vehicle_status, .../vehicle_odometry, ...
ros2 topic echo /drone_1/fmu/out/vehicle_status --qos-reliability best_effort --once
```
`/fmu/*` topics live on the **ground PC** (the agent host), **never** on the VOXL
— that is the XRCE-DDS design (the VOXL runs only the thin client).

> **Why the script exists (facts learned the hard way).** The agent host IP lives
> only in the `-h` flag of `microdds_client start` in `/usr/bin/voxl-px4-start` on
> the VOXL (no PX4 param stores it on this SDK); a passive reboot is unreliable —
> `systemctl restart voxl-px4` is what re-reads the edit. The DDS domain is the
> **client** param (`UXRCE_DDS_DOM_ID`, or older `XRCE_DDS_DOM_ID` on ModalAI
> builds), **not** the agent's `ROS_DOMAIN_ID` — it must match your ground
> consumers' `ROS_DOMAIN_ID` (=1). VOXL2 runs ROS 2 **Foxy**; keep its native
> topics off the Jazzy ground domain (the XRCE bridge re-emits `/fmu` as
> Jazzy-native, which is safe — see [B6](voxl-diagnostics.md)). On
> the VOXL you verify the bridge **only** with `px4-microdds_client status`.

**(b) Flight params (separate — NOT done by the script).** For an actual flight
you still need, per drone (QGC or `px4-param`): `EKF2_EV_CTRL` to fuse external
vision (GPS off indoors), an RC kill switch, and an offboard-loss failsafe — see
[Part D](first-flight.md#part-d-real-hardware-first-flight-reference). The script wires up
*comms only*.

> **`MAV_SYS_ID` (per drone).** Give each drone a distinct id (drone_N → N) so
> QGC can show all of them. PX4's commander **drops any VehicleCommand whose
> `target_system` ≠ its own `MAV_SYS_ID`** — this filter applies to uXRCE-DDS
> commands too, the DDS domain id has nothing to do with it. `px4_interface`
> therefore has a `target_system` parameter; `real_interfaces.launch.py` sets it
> from the trailing number of each name by default (`drone_2` → 2), or pass
> `target_systems:=1,2,3` explicitly. Symptom of a mismatch: "Arm command sent"
> / `arm -> success=True` in the logs, the drone never arms, and **no**
> `fmu/out/vehicle_command_ack` ever appears.

**(c) Motive / NatNet (mocap) — one-time.** Name one rigid body per drone
`drone_1`, `drone_2`, … in Motive, set the OptiTrack streaming **Up Axis = Z**,
enable Broadcast Frame, and pick the right Local Interface IP. The vendored
[`natnet_ros2`](https://github.com/castacks/AirStack/tree/yikuan/SVG_ground_control/robot/ros_ws/src/perception/natnet_ros2) package (L2S-lab) **auto-downloads
the NatNet SDK** into `deps/NatNetSDK` on its **first build** (needs internet) and
**must be built with `--symlink-install`** — which `bws` already passes:
```bash
bws --packages-select natnet_ros2 && sws
```
The OptiTrack server/client IPs are launch args (`serverIP`/`clientIP`), already
defaulted to this rig in
[`natnet_ros2.launch.py`](https://github.com/castacks/AirStack/blob/yikuan/SVG_ground_control/robot/ros_ws/src/perception/natnet_ros2/launch/natnet_ros2.launch.py)
together with `pub_rigid_body:=true` (so per-body `/…/pose` topics are published,
not just TF). Override per run if needed:
`ros2 launch natnet_ros2 natnet_ros2.launch.py serverIP:=… clientIP:=…`.

> **Topic naming.** Each Motive rigid body is published on its own
> `geometry_msgs/PoseStamped` topic **`/<body-name>/pose`** (e.g. `/drone_1/pose`)
> and broadcast as a TF frame — when `pub_rigid_body:=true` (now the default; with
> it `false` you get **only** `/tf` and no `/…/pose`). Name your Motive bodies
> `drone_1`/`drone_2`/… and discover them with `ros2 topic list | grep pose`.
> Unlabeled markers are configured in `config/initiate.yaml`.

---

Source: [`robot/ros_ws/src/svg_ground_control/experiment.md`](https://github.com/castacks/AirStack/blob/yikuan/SVG_ground_control/robot/ros_ws/src/svg_ground_control/experiment.md) on the `yikuan/SVG_ground_control` branch of AirStack.
