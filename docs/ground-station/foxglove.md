# Foxglove setup

Foxglove is the operator-facing alternative to RViz: the same `/svg/viz/markers`
3D view (Iris body mesh per drone, coloured by planner status — see the RViz
section for the legend) plus the **SVG Basestation** panel (agent wiring,
two-click land-all safety stop, Hold All, link safety, battery / RTB, formation
dropdown). The panel, a ready-made layout and its installer live in this
package's [`foxglove/`](https://github.com/castacks/AirStack/tree/yikuan/SVG_ground_control/robot/ros_ws/src/svg_ground_control/foxglove) directory — see the panel's
[README](basestation.md) for what every column means. (The
general AirStack panels — Robot Tasks, Waypoint / Polygon editors — stay in
`gcs/foxglove_extensions/`.)

**Everything runs from the robot container — nothing to start by hand.**

* [`ground_control.launch.py`](https://github.com/castacks/AirStack/blob/yikuan/SVG_ground_control/robot/ros_ws/src/svg_ground_control/launch/ground_control.launch.py) starts
  `foxglove_bridge` next to the commander (`use_foxglove_bridge:=false` to opt
  out, `foxglove_port:=` to move it off 8765). Expect
  `[foxglove_bridge]: Server listening on 0.0.0.0:8765` in the A4 terminal.
* The robot container runs `svg_ground_control/foxglove/install.py` (SVG
  Basestation, from the mounted `ros_ws`) and `gcs/foxglove_extensions/install.py`
  (Robot Tasks, Waypoint / Polygon editors) at start-up, so all four panels are
  installed in the container's own Foxglove Studio. Studio's config/layouts persist in `robot/docker/Foxglove/`
  (git-ignored, mounted at `/root/.config/Foxglove`).
* `robot-desktop` is on `network_mode: host` and pins `ROS_DOMAIN_ID=1`, so a
  Studio on the **host** reaches the bridge at `ws://localhost:8765` too. The
  `gcs` container is deliberately not used: it sits on the Docker bridge network
  at domain 0 and never sees the drone topics.

> **After pulling this change** (once): recreate the robot container so the new
> mounts appear — `./airstack.sh up` recreates on compose changes, which kills
> anything running inside — then rebuild the packages it touches:
> `bws --packages-select robot_descriptions interface_bringup svg_ground_control`
> (drone mesh, per-drone TF frames, launch file). If you were running a
> hand-started `foxglove_bridge`, stop it first: two bridges on one port is a
> bind error and a respawn loop.

## F1. Studio on the host (default)

```bash
cd ~/AirStack
python3 robot/ros_ws/src/svg_ground_control/foxglove/install.py   # once per pull: installs the
                                                                  # panel into ~/.foxglove-studio/extensions
foxglove-studio                                                   # (re)start Studio AFTER installing
```
Then **Open connection** → Foxglove WebSocket → `ws://localhost:8765`, and
**Layouts → Import from file…** →
`~/AirStack/robot/ros_ws/src/svg_ground_control/foxglove/svg_basestation.json`. Pick the imported
layout from the layout dropdown (top-right).

## F2. Studio inside the container (alternative)

```bash
# with the rest of ground control (pre-connected to the bridge):
ros2 launch svg_ground_control ground_control.launch.py use_foxglove_studio:=true
# or on its own, from any robot-container shell:
foxglove-studio --no-sandbox
```
Import the layout once from
`/root/AirStack/robot/ros_ws/src/svg_ground_control/foxglove/svg_basestation.json`; it is kept in the
mounted config dir, so it is still there after the container is recreated.
`install.py` prints one `Installed Foxglove extension: airlab-cmu.<name>-<ver>`
line per panel in `docker logs airstack-robot-desktop-1`; **Extensions** in
Studio's left sidebar lists what is loaded.

The layout is preset for `drone_1,drone_2,drone_3` with **Modes** blank, so each
agent is detected from the wire (`/{name}/interface/…` ⇒ sim,
`/{name}/fmu/…` ⇒ real) — the panel's **Wiring** card says which it decided.
For a different drone list or explicit modes, edit the panel settings (gear icon)
and mirror the config's `drone_names` / `drone_modes` / `drone_position_offsets`.
The 3D panel's display frame is `map`: the markers are published in bare `map`
while each drone's TF is namespaced (`drone_N/map → drone_N/base_link`, see
[`sim_drone_interface.launch.xml`](https://github.com/castacks/AirStack/blob/yikuan/SVG_ground_control/robot/ros_ws/src/svg_ground_control/launch/sim_drone_interface.launch.xml)), so
three drones no longer fight over one `map → base_link` transform.

Each drone carries a name label (`drone_1` …; mode and role are in the panel,
not the label). Foxglove always draws a text marker on a contrasting box —
black behind light text, white behind dark — with the box as opaque as the
text, and uses its own sans-serif font; neither can be turned off from the
marker. The label is therefore the panel's dark slate on a white chip
(`LABEL_COLOR` in `swarm_commander.py`), slightly translucent.

## F3. What you should see

| Stage | Panel |
| --- | --- |
| Only the bridge up | Everything rendered but reading `--` (no topic list yet) |
| A3 interfaces up | Agents listed, Battery & Power live from `/{name}/interface/mavros/battery`, Link Safety Rate/Drop from odometry |
| A4 commander up | 3D view shows the drone meshes (green until `start`) + geofence; Tasks chip names the scenario topics it found |
| Config with `formation_profiles` (e.g. `cbf_sim.yaml scenario:=goal`) | Formation dropdown lists the profiles; Tasks chip shows `formation` |
| Real drone (Part B) | Mocap age, EKF, Ping (uXRCE-DDS `timesync_status`) columns appear for that agent |

Sections hide themselves when nothing publishes what they need (**Sections:
Auto**); set **Show all** in the settings to force every card on.

**Safety controls.** The red **LAND ALL** bar is two-click (arm → fire within
4 s) and calls `/swarm_commander/land`; **Hold All** calls `/swarm_commander/hold`.
Takeoff / Start / Reset Fence are in the command strip below. These are the same
services as A6, so the CLI and the panel can be mixed freely.

**If the panel is empty:** in a robot shell `ros2 topic list | grep drone_1`
must show the interface topics and `ros2 topic hz /svg/viz/markers` must tick
(~20 Hz). If the topics exist but Foxglove sees none, the bridge is on the wrong
domain — `echo $ROS_DOMAIN_ID` in the A4 shell must print `1`. If the panel's
services all fail, check the A4 terminal: a dead `swarm_commander` leaves stale
service names in `ros2 service list`. If the **SVG Basestation** panel type is
missing from *Add panel*, `install.py` ran for a different user / `HOME` than the
one running `foxglove-studio`. If the drones render as nothing / a warning about
`package://robot_descriptions/...`, `robot_descriptions` is not built in this
workspace (`bws`).

---

Source: [`robot/ros_ws/src/svg_ground_control/experiment.md`](https://github.com/castacks/AirStack/blob/yikuan/SVG_ground_control/robot/ros_ws/src/svg_ground_control/experiment.md) on the `yikuan/SVG_ground_control` branch of AirStack.
