# Onboard LED strip

**(d) Onboard LED strip — one-time per drone.** Each drone's NeoPixel strip
(11 RGBW pixels on the ESC LED output) is driven by a small **no-ROS** daemon on
the VOXL, [`scripts/svg_led_daemon.py`](https://github.com/castacks/AirStack/blob/yikuan/SVG_ground_control/robot/ros_ws/src/svg_ground_control/scripts/svg_led_daemon.py), which
writes the ESC LED packet into voxl-px4's `/run/mpa/modal_io_bridge` pipe (port
of the ModalAI `modal_io.c` reference in `led_ws/`) and takes color commands
over **UDP** from the ground node `led_controller` (started by
`ground_control.launch.py`, `use_led:=true` by default). No ROS on the VOXL on
purpose — its Foxy DDS must stay off the Jazzy ground domain ([B6](voxl-diagnostics.md)).
The daemon shows **green at boot** (before any ground link), sends a 1 Hz
heartbeat to the ground PC (IP read from the `-h` flag in `voxl-px4-start`, so
run (a) first), and falls back to green 10 s after the ground goes silent.
```bash
# over Wi-Fi, from the ground PC (package dir) — scp + ssh + installer in one go
# (VOXL root password: oelinux123; `ssh-copy-id root@<ip>` once to stop the prompts):
scripts/voxl_push_led.sh drone_1 <drone_ip>            # [ground_pc_ip] [num_leds=11]
#   = scp scripts/svg_led_daemon.py scripts/voxl_setup_led.sh root@<drone_ip>:/usr/bin/
#     ssh root@<drone_ip> 'chmod +x /usr/bin/voxl_setup_led.sh && voxl_setup_led.sh drone_1'
#   RGB (not RGBW) strip / other brightness:  LED_EXTRA_ARGS="--rgb --brightness 60" scripts/voxl_push_led.sh drone_1 <ip>
# over USB instead:
adb push scripts/svg_led_daemon.py scripts/voxl_setup_led.sh /usr/bin/
adb shell 'chmod +x /usr/bin/voxl_setup_led.sh && voxl_setup_led.sh drone_1'
# on the VOXL, to check:
systemctl status svg-led ; journalctl -u svg-led -n 20   # "opened MAVLink tunnel sink", "PX4 ESC LED bits muted"
```
*Ground side, once:* the heartbeats arrive on **UDP 47901** — this host runs
`ufw`, so `sudo ufw allow 47901/udp`. The robot container is `network_mode: host`,
so nothing else to map. Verify in the commander terminal:
`[led_controller]: drone_1: LED daemon online at <ip>:47900`. Recolor live:
```bash
ros2 topic pub --once /svg/led_command std_msgs/msg/String "{data: 'drone_1 blue'}"        # name …
ros2 topic pub --once /svg/led_command std_msgs/msg/String "{data: 'drone_1 255,60,0'}"    # … or r,g,b[,w]
ros2 topic pub --once /svg/led_command std_msgs/msg/String "{data: 'all green blink'}"     # all drones, blink
# same thing as a service:
ros2 service call /svg/drone_1/set_led_color airstack_msgs/srv/SetLedColor "{color: blue}"
```
Works whenever `led_controller` is running (it is part of `ground_control.launch.py`;
standalone: `ros2 run svg_ground_control led_controller --ros-args --params-file <config>.yaml`),
regardless of arming or flight state.
The daemon also mutes PX4's ESC status-LED bits (`px4-qshell voxl_esc -l 0 led`),
otherwise the driver repaints the strip with its own red/green/blue arm state and
it flickers orange — see the troubleshooting row. Colors: off/red/green/blue/white/yellow/cyan/magenta/orange/purple, scaled by
`led_controller.brightness` (80/255 default — bright white washes out the
OptiTrack IR view). A manual color is the drone's *base* color; the CBF red
(below) overrides it while active, then returns to it.

---

Source: [`robot/ros_ws/src/svg_ground_control/experiment.md`](https://github.com/castacks/AirStack/blob/yikuan/SVG_ground_control/robot/ros_ws/src/svg_ground_control/experiment.md) on the `yikuan/SVG_ground_control` branch of AirStack.
