# Strike vs Guard

Strike vs Guard (SVG) is a multi-drone ground controller for counter-UAS flights. It runs on [AirStack](https://github.com/castacks/AirStack). One `swarm_commander` flies every drone, real or simulated, through a shared CBF collision filter. Guard drones hold their posts and yield to an intruder that forces its way through the gap. The [project homepage](/) has the overview, media and flight findings.

This documentation covers the `svg_ground_control` package and the ground-station tools around it, on the [`yikuan/SVG_ground_control`](https://github.com/castacks/AirStack/tree/yikuan/SVG_ground_control/robot/ros_ws/src/svg_ground_control) branch of AirStack. Every command block assumes a fresh terminal.

## Get started

- [How AirStack is structured](getting-started/airstack.md): the containers and the autonomy layers SVG sits on.
- [How SVG ground control is structured](getting-started/architecture.md): the commander, its data flow and the three per-drone axes.
- [Conventions](getting-started/conventions.md): ROS domain, tmux and when to rebuild.
- [Simulation quick start](getting-started/simulation.md): three SITL drones in Isaac Sim, from containers to takeoff.

## Fly real drones

- [Bring in a real drone](hardware/index.md): host networking and getting the VOXL onto your LAN.
- [Per-drone one-time setup](hardware/voxl-setup.md), [LED strip](hardware/leds.md), [agent, interfaces and mocap](hardware/agent-and-interfaces.md).
- [External vision into EKF2](hardware/external-vision.md): the parameters that stop "fuse failure".
- [Preflight and first flight](hardware/first-flight.md) and the [VOXL2 diagnostics](hardware/voxl-diagnostics.md) cheat sheet.

## Run the experiments

- [Tasks: any drone in any mode](experiments/index.md): start the per-drone interfaces first.
- [C1 single-drone goal](experiments/single-goal.md) · [C2 multi-drone goals](experiments/multi-goal.md) · [C3 squeeze rehearsal](experiments/squeeze-sim.md) · [C4 hybrid squeeze](experiments/hybrid-squeeze.md) · [C5 hand-flown intruder](experiments/hand-flown-intruder.md)
- [Gamepad teleop](teleop/index.md): controls, pad checks and the real-drone ground check.

## Safety and the ground station

- [CBF filter and safety](safety/index.md) and the [geofence](safety/geofence.md).
- [Foxglove setup](ground-station/foxglove.md), the [SVG Basestation panel](ground-station/basestation.md), [RViz](ground-station/rviz.md) and the [AirStack GCS panels](ground-station/gcs-panels.md).

## Reference

- [Scenarios](reference/scenarios.md), [commander features](reference/commander.md), [topics and services](reference/topics.md).
- [Recording rosbags](reference/recording.md), [automated tests](reference/tests.md), the [2026-09-27 update](reference/update-2026-09-27.md).
- [Troubleshooting](help/troubleshooting.md).
