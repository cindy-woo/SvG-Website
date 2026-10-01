# Bring in a real drone

Get one real drone talking to the stack and confirm it is tracked — the
hardware analogue of Part A's sim bring-up, with **no flight**. Once this
passes, a real drone is just `drone_modes: "...real..."` in any
[Part C](../experiments/index.md) task.

Use the **same `airstack`-managed robot container as Part A** — connect with
`./airstack.sh connect robot --command=bash`. Its [`robot/docker/.bashrc`](https://github.com/castacks/AirStack/blob/yikuan/SVG_ground_control/robot/docker/.bashrc)
already exports `ROS_DOMAIN_ID` (resolved per container, =1 here) and sources
the workspace at shell startup, and `bws`/`sws` are available — so the commands
below need **no `export ROS_DOMAIN_ID` and no manual `source`**. The state topic
is identical to sim (`…/odometry_conversion/odometry`); only the source changes
(mocap + px4_interface instead of SITL + MAVROS).

> **Prerequisite — robot container on host networking.** Hardware mocap (NatNet
> from Motive) and the drone's uXRCE-DDS link are on your LAN, which the default
> Docker bridge can't reach. Put `robot-desktop` on the host's network stack in
> [`robot/docker/docker-compose.yaml`](https://github.com/castacks/AirStack/blob/yikuan/SVG_ground_control/robot/docker/docker-compose.yaml): comment
> out its `networks:`/`ports:` and set `network_mode: host`, then `./airstack.sh
> up`. (Host mode ⇒ `NUM_ROBOTS=1`, since replicas would clash on ports — which
> is what this workflow uses anyway.) Verify with `./airstack.sh status`.

## B0. Get the drone onto your LAN (Wi-Fi / DHCP)

The uXRCE-DDS link (B2/B3) needs the drone reachable on the same subnet as this
PC. ADB into the VOXL and check the Wi-Fi interface:
```bash
adb shell
ip addr show wlan0            # is there an inet, and is it on the router's subnet?
```
**If `wlan0` has a stale static IP** (e.g. a hard-coded `192.168.30.20` from a
previous network) or no lease, flush it and request DHCP from the router:
```bash
ip addr flush dev wlan0       # drop the old/static address
ip link set wlan0 up
udhcpc -i wlan0               # busybox DHCP client (common on VOXL/embedded)
# or, if udhcpc isn't present:
dhclient -v wlan0            # ISC client
ip addr show wlan0           # should now show a router-assigned address
```
If `udhcpc` gets a lease, the router/DHCP path is fine. To make it **persist
across reboots** when `systemd-networkd` manages the interface, find the pinning
file and switch it to DHCP:
```bash
ls /etc/systemd/network/      # look for a *wlan0*.network with a static Address=
networkctl status wlan0       # shows who manages it + current address
```
Edit (or add) that `.network` file so it reads:
```ini
[Match]
Name=wlan0

[Network]
DHCP=yes
```
then `systemctl restart systemd-networkd`.

Notes:
- If DHCP keeps failing, `wlan0` probably isn't associated — confirm with
  `voxl-wifi status` / `iw wlan0 link` before chasing DHCP.
- Don't run a manual `udhcpc` **and** `voxl-wifi`'s managed client at once — they
  fight over the interface. For a drone you'll fly, prefer `voxl-wifi station` so
  it reconnects after every reboot.
- Want a fixed address per drone? Use a **DHCP reservation on the router**, not a
  static IP on the VOXL — avoids pool collisions and survives re-imaging.

---

Source: [`robot/ros_ws/src/svg_ground_control/experiment.md`](https://github.com/castacks/AirStack/blob/yikuan/SVG_ground_control/robot/ros_ws/src/svg_ground_control/experiment.md) on the `yikuan/SVG_ground_control` branch of AirStack.
