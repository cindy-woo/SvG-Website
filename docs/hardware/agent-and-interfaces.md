# Agent, interfaces and mocap

## B2. uXRCE-DDS agent (ground PC)

The agent bridges the drone's PX4 client to ROS `/fmu/*` topics and **creates
them on the ground PC** (not the VOXL). The robot image ships `MicroXRCEAgent`,
so run it directly in the robot container (host network, `ROS_DOMAIN_ID=1`):
```bash
MicroXRCEAgent udp4 -p 8888 -v4
```
`-v4` logs each session/datawriter, so you can watch the drone attach
(`create_client … session established … <VOXL_IP>`). The `/fmu/*` topics land on
the domain the **PX4 client** requested (the `domain_id` the B1 script set, =1),
so make sure your ground consumers (`px4_interface`, the commander, your `ros2`
shells) are on `ROS_DOMAIN_ID=1` too — the agent's own env domain is not the
lever.

> **Where `MicroXRCEAgent` comes from — two interchangeable installs:**
> 1. **Baked into the robot image** (the default):
>    [`Dockerfile.robot`](https://github.com/castacks/AirStack/blob/yikuan/SVG_ground_control/robot/docker/Dockerfile.robot) builds eProsima
>    Micro-XRCE-DDS-Agent v2.4.3 into `/opt/uxrce` (builder stage ~L198) and
>    copies it + adds it to `PATH` in the runtime stage (~L364). Ships with the
>    image on every machine; needs `./airstack.sh image-build robot-desktop`
>    after pulling.
> 2. **Built in the ROS workspace** (per-machine, no image rebuild — the repo
>    is colcon-buildable):
>    ```bash
>    cd ~/AirStack/robot/ros_ws/src
>    git clone -b v2.4.3 https://github.com/eProsima/Micro-XRCE-DDS-Agent.git
>    cd ~/AirStack/robot/ros_ws && bws --packages-select microxrcedds_agent && sws
>    ```
>    Lives on the host bind mount (survives container restarts), but is lost on
>    `cws`/fresh checkout and must be rebuilt per machine. First build needs
>    internet (the superbuild fetches Fast-DDS).
>
> Last-resort fallback if neither is available:
> `docker run --rm -it --network host -e ROS_DOMAIN_ID=1 microros/micro-ros-agent:jazzy udp4 --port 8888`.

## B3. Per-drone px4_interface (fresh terminal)

```bash
cd ~/AirStack && ./airstack.sh connect robot --command=bash
ros2 launch svg_ground_control real_interfaces.launch.py drones:=drone_1   # add ,drone_2,...
```

## B4. NatNet mocap — launch + UNIT-TEST (fresh terminal)

Build natnet first (it needs `--symlink-install`, which `bws` passes; the first
build also downloads the NatNet SDK — needs internet):
```bash
cd ~/AirStack && ./airstack.sh connect robot --command=bash
bws --packages-select natnet_ros2 && sws
ros2 launch natnet_ros2 natnet_ros2.launch.py   # serverIP/clientIP default to this rig
ros2 topic list | grep pose                      # each Motive body -> /<body-name>/pose
```
Then verify mocap is actually streaming (this is the unit-test — do NOT skip):
```bash
ros2 topic hz   /drone_1/pose                 # ~180 Hz (or your Motive rate)
ros2 topic echo /drone_1/pose --once          # sane x,y,z = where the drone sits
# move the drone by hand: position must change smoothly, no NaNs / jumps
```
- No topic / 0 Hz → Motive not streaming, wrong `serverIP`, or the rigid body
  isn't named `drone_1`. **Only `/tf` and no `/…/pose`** → `pub_rigid_body` is
  `false` (the vendored launch defaults it `true`).
- `mocap_bridge` consumes `/<name>/pose` (`mocap_topic_template: "/{name}/pose"`
  in `swarm_real.yaml`), forwarding mocap → PX4 visual odometry.

---

Source: [`robot/ros_ws/src/svg_ground_control/experiment.md`](https://github.com/castacks/AirStack/blob/yikuan/SVG_ground_control/robot/ros_ws/src/svg_ground_control/experiment.md) on the `yikuan/SVG_ground_control` branch of AirStack.
