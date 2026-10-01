# VOXL2 diagnostics

Everything we reach for during a real-drone bring-up. **VOXL** lines run in the
`adb shell`; **ground PC** lines run in the robot container (`ROS_DOMAIN_ID=1`).

*Services (VOXL):*
```bash
voxl-inspect-services                       # which voxl-* services are enabled/running
systemctl status voxl-px4                   # PX4 flight stack
systemctl is-enabled voxl-microdds-agent    # should be 'disabled' (we use the remote agent)
```

*Wi-Fi / network (VOXL):*
```bash
ip addr show wlan0                          # current IP — on the router's subnet?
voxl-wifi status     ;  iw wlan0 link       # is it associated to the AP?
networkctl status wlan0                     # who manages wlan0 + the DHCP lease
ping -c2 <ground_pc_ip>                      # reachability to the agent host
```

*PX4 ↔ XRCE bridge (VOXL — the ONLY VOXL-side bridge checks):*
```bash
px4-microdds_client status                  # connected? Agent IP? Payload tx/rx nonzero?
px4-param show -a | grep -i -E 'dom|xrce|dds'   # discover the DDS-domain param name
px4-param show UXRCE_DDS_DOM_ID              # or XRCE_DDS_DOM_ID — the DDS domain
```

*Did a file change correctly? (VOXL):*
```bash
grep -n 'microdds_client start' /usr/bin/voxl-px4-start   # -h/-p/-n actually applied?
ls -l  /usr/bin/voxl-px4-start*                            # timestamped .bak.* the script made
diff   /usr/bin/voxl-px4-start.bak.* /usr/bin/voxl-px4-start   # exactly what changed
awk --version 2>/dev/null || awk -W version               # which awk (mawk 1.3.3 lacks [[:space:]])
```

*Topics & data (ground PC — where `/fmu/*` actually lives):*
```bash
ros2 topic list | grep <name>/fmu
ros2 topic hz   /<name>/fmu/out/vehicle_odometry --qos-reliability best_effort
ros2 topic echo /<name>/fmu/out/vehicle_status   --qos-reliability best_effort --once
```

> **Cross-distro hazard.** VOXL2 is ROS 2 **Foxy**, the ground stack is **Jazzy**.
> If the VOXL's *native* Foxy DDS traffic shares a `ROS_DOMAIN_ID` with the Jazzy
> ground stack, `ros2 topic list` can crash with `deserialize_change` /
> `std::bad_alloc` (incompatible RTPS wire formats). Keep them apart: the XRCE
> bridge is safe (the agent re-emits `/fmu` as Jazzy-native on the ground PC), and
> the on-VOXL `voxl-microdds-agent` stays **disabled** (the B1 script does this).

---

Source: [`robot/ros_ws/src/svg_ground_control/experiment.md`](https://github.com/castacks/AirStack/blob/yikuan/SVG_ground_control/robot/ros_ws/src/svg_ground_control/experiment.md) on the `yikuan/SVG_ground_control` branch of AirStack.
