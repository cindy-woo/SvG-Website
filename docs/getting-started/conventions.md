# Conventions

**ROS domain = 1 everywhere.** The robot container's
[`.bashrc`](https://github.com/castacks/AirStack/blob/yikuan/SVG_ground_control/robot/docker/.bashrc) **hard-pins `ROS_DOMAIN_ID=1`** (overriding the
robot-name mapping), so every shell you open in it is already on domain 1 — this is
an image-level change, so rebuild the image after pulling (see [A1](simulation.md#a1-containers-host)).
Manually-started containers and the mocap PC still need `export ROS_DOMAIN_ID=1`.
Check `echo $ROS_DOMAIN_ID` in every shell — a mismatch shows up as "service
unavailable" / missing topics.

**tmux** (when you `./airstack.sh connect robot` without `--command=bash`):
the `bringup` window opens as a 5-over-3 grid — top-left pane runs the autonomy
launch, the other 7 are shells that wait for that pane's `bws` to finish and
then `sws` automatically, so they are ready to use once the build is done
(layout and auto-source set by the `after-new-session` hook in
[`common/.tmux.conf`](https://github.com/castacks/AirStack/blob/yikuan/SVG_ground_control/common/.tmux.conf), helper `sws_after_build`
in [`robot/docker/.bashrc`](https://github.com/castacks/AirStack/blob/yikuan/SVG_ground_control/robot/docker/.bashrc)). `Ctrl-b` + arrow or
`Ctrl-b q [n]` jumps between panes, `Ctrl-b z` zooms one pane full-screen.
`Ctrl-b c` new window · `Ctrl-b n/p` or `Ctrl-b 0..9` switch · `Ctrl-b ,`
rename · `Ctrl-b %`/`"` split · `Ctrl-b x` close pane · `Ctrl-b [` scroll
(`q` exits) · `Ctrl-b d` detach (keeps running). Every new window is a fresh
shell: re-run `cd ~/AirStack/robot/ros_ws && sws`.

**Rebuild after edits.** `ros2 launch` reads the *installed* copy. After
editing any `.py`/`.yaml`/`.rviz` in the package, run `bws` (or pass
`config:=` pointing straight at the source file under `src/.../config/`).

**Drone BS** drone_1, using DDS Port 8888

---

Source: [`robot/ros_ws/src/svg_ground_control/experiment.md`](https://github.com/castacks/AirStack/blob/yikuan/SVG_ground_control/robot/ros_ws/src/svg_ground_control/experiment.md) on the `yikuan/SVG_ground_control` branch of AirStack.
