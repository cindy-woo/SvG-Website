# C4 · Hybrid squeeze

Your experiment plan #1: **drone_1,2 real holders** (mocap hardware — the
config's `mocap_bridge` block forwards `/drone_1/pose` and `/drone_2/pose`
into their PX4 EKFs), **drone_3 sim** (Isaac SITL), **CBF-exempt +
policy-controlled**. All three appear in the Isaac viewport — real holders as
live avatars, the intruder as its SITL body — and the real holders react (via
the CBF) to the virtual intruder squeezing through. Config already set:
`drone_modes: "real,real,sim"`, `cbf_exempt_drones: "drone_3"`, and
`drone_position_offsets: [0,0,0, 0,0,0, 2,0,0]` (holders mocap-anchored →
zero; sim intruder → its Isaac spawn x=+2).

```bash
# 0. real holders connected + verified — Part B (px4_interface + NatNet + mocap)
#    for drone_1,drone_2.

# 1. Isaac (GUI): SITL for the sim intruder + avatars for the real holders.
#    DRONE_MODES matches the commander's drone_modes.  [isaac-sim container]
NUM_ROBOTS=3 DRONE_MODES="real,real,sim" SVG_DOMAIN_ID=1 \
PLAY_SIM_ON_START=true ISAAC_SIM_HEADLESS=false \
PYTHONPATH="$ISAAC_SIM_PYTHONPATH" \
/isaac-sim/python.sh /isaac-sim/AirStack/simulation/isaac-sim/launch_scripts/svg_multi_drone_single_domain.py \
  --ext-folder ~/.local/share/ov/data/documents/Kit/shared/exts

# 2. MAVROS interface for the sim intruder (drone_3) only.  [robot container]
ROBOT_NAME=drone_3 FCU_URL='udp://:14543@<sim_ip>:14583' TGT_SYSTEM=4 \
  ros2 launch svg_ground_control sim_drone_interface.launch.xml drone_name:=drone_3

# 3. ONE commander for all three (use_mocap feeds the real holders' EKFs).
ros2 launch svg_ground_control ground_control.launch.py \
  config:=$(ros2 pkg prefix svg_ground_control)/share/svg_ground_control/config/hybrid_squeeze.yaml \
  use_mocap:=true
```
One CBF sees all three (the state topic is identical for real and sim), so the
real holders dodge the simulated intruder. In RViz the holders are **red**, the
intruder **cyan**, all in one `map` frame.

> **Dry-run the routing first (no hardware).** `test/functional_hybrid_test.py`
> fakes the real+sim drones on their respective topics and asserts each drone's
> commands land on the correct namespace and the squeeze still works — run it
> before trusting a real flight (see [Automated tests](../reference/tests.md)).

---

Source: [`robot/ros_ws/src/svg_ground_control/experiment.md`](https://github.com/castacks/AirStack/blob/yikuan/SVG_ground_control/robot/ros_ws/src/svg_ground_control/experiment.md) on the `yikuan/SVG_ground_control` branch of AirStack.
