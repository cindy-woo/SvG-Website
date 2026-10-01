import { media, type MediaSlot } from "./media";

// Project facts shown on the homepage. Everything here comes from the
// svg_ground_control package on the yikuan/SVG_ground_control branch of AirStack
// (README.md, experiment.md, teleop.md, foxglove/svg-basestation/README.md).

export const repoBase = "https://github.com/castacks/AirStack/tree/yikuan/SVG_ground_control";
export const packagePath = "robot/ros_ws/src/svg_ground_control";

// TODO: fill in the team before sharing the site. Leave empty to hide the author row.
export const authors: { name: string; affiliation: string; href?: string }[] = [];

export const affiliations = ["AirLab, Carnegie Mellon University"];

export const stats = [
  { value: "20 Hz", label: "central control loop for every drone" },
  { value: "9", label: "flight scenarios, from hover to squeeze" },
  { value: "3", label: "Starling drones flown in the mocap room" },
  { value: "140", label: "unit and plant-model tests" },
];

export const pipeline = [
  {
    id: "state",
    title: "State",
    node: "natnet_ros2 · mocap_bridge · odometry_conversion",
    text: "OptiTrack poses are fed to each drone's PX4 EKF2 as external vision. The odometry comes back through AirStack's odometry_conversion as one ENU topic per drone, so sim and hardware look the same.",
  },
  {
    id: "nominal",
    title: "Nominal command",
    node: "scenarios · trajectory · teleop",
    text: "A scenario, a goal or a gamepad sets each drone's desired velocity. The commander then shapes it into an acceleration-limited profile with PX4's braking law.",
  },
  {
    id: "cbf",
    title: "Safety filter",
    node: "cbf_filter",
    text: "A velocity control barrier function sees every drone at once. It projects the commands onto the set that keeps each pair more than 2r apart.",
  },
  {
    id: "fence",
    title: "Geofence",
    node: "fence · position_hold",
    text: "The box either latches a swarm-wide hold or brakes each drone at the wall. A smaller box limits hand-flown drones.",
  },
  {
    id: "output",
    title: "Output",
    node: "robot_interface: px4_interface · mavros_interface",
    text: "AirStack's robot_interface_node carries the command to PX4, over uXRCE-DDS for a real drone and through MAVROS for a simulated one. Real drones get a reference point plus velocity and acceleration feedforward on trajectory_command. Simulated drones get a velocity.",
  },
] as const;

export type Axis = {
  id: string;
  title: string;
  param: string;
  values: { name: string; text: string }[];
  note: string;
};

export const axes: Axis[] = [
  {
    id: "mode",
    title: "Mode",
    param: "drone_modes",
    values: [
      { name: "sim", text: "PX4 SITL in Isaac Sim, commanded through MAVROS (/{name}/interface/…)" },
      { name: "real", text: "Hardware over uXRCE-DDS through px4_interface (/{name}/fmu/…)" },
    ],
    note: "Mix them in one run and you have a hybrid. A real drone shows up in Isaac Sim as a live avatar.",
  },
  {
    id: "role",
    title: "Role",
    param: "teleop_drones · external_drones",
    values: [
      { name: "auto", text: "Flown by the scenario" },
      { name: "teleop", text: "Flown by an operator with a gamepad, in position mode" },
      { name: "external", text: "Tracked by the filter but never commanded, e.g. RC-flown" },
    ],
    note: "Teleop only changes who sets the command. A hand-flown drone is still filtered by the CBF.",
  },
  {
    id: "exempt",
    title: "CBF exemption",
    param: "cbf_exempt_drones",
    values: [
      { name: "filtered", text: "The CBF corrects this drone's own command (default)" },
      { name: "exempt", text: "Its command goes out as given and the others dodge it" },
    ],
    note: "An exempt drone is still seen by the filter. That's how the intruder plays the moving obstacle.",
  },
];

export type SafetyLayer = {
  id: string;
  index: string;
  label: string;
  summary: string;
  detail: string;
  params: { name: string; value: string; text: string }[];
  media: MediaSlot;
};

export const safetyLayers: SafetyLayer[] = [
  {
    id: "cbf",
    index: "01",
    label: "CBF filter",
    summary:
      "Every pair of drones has the barrier h = ‖pᵢ − pⱼ‖² − (2r)² and the linear constraint ḣ + αh ≥ 0 on their velocities. The commands are projected onto that safe set by least squares, using parallel Dykstra with a Gauss–Seidel polish.",
    detail:
      "If the QP is infeasible, an emergency push-apart takes over. A corrected command keeps its acceleration feedforward, so the evasion is flown with the command and not about 0.5 s behind it. The gains can be changed in flight with ros2 param set or the panel's sliders.",
    params: [
      { name: "cbf_alpha", value: "2.5", text: "Class-K gain. Lower yields earlier and more gently." },
      { name: "cbf_safety_radius_m", value: "0.55 m", text: "Each drone's bubble. Centres are kept more than 2r apart." },
      { name: "cbf_max_speed_mps", value: "10 m/s", text: "Cap on every command the filter emits" },
    ],
    media: media.safetyCbf,
  },
  {
    id: "geofence",
    index: "02",
    label: "Geofence",
    summary:
      "The box [fence_min, fence_max] is checked every tick for every role. With hold_all, any airborne drone outside it freezes the whole swarm until reset_fence. With keep_in, each commanded drone is braked at the walls and pushed back in.",
    detail:
      "The keep_in wall is a braking envelope. A drone cruises until its true braking distance v²/(2a) + v/gain, then brakes firmly, and the deceleration is sent to PX4 as acceleration feedforward on the limited axis. The old gain × distance cap overshot the wall by up to 0.68 m at about 6 m/s.",
    params: [
      { name: "fence_behavior", value: "keep_in", text: "hold_all latches a freeze; keep_in brakes at the wall" },
      { name: "fence_brake_accel_mps2", value: "8 m/s²", text: "What the airframe delivers at its 45° tilt limit" },
      { name: "fence_keep_in_gain", value: "2 /s", text: "Stiffness of the last stretch; 1/gain is the lag margin" },
    ],
    media: media.safetyFence,
  },
  {
    id: "teleop-fence",
    index: "03",
    label: "Teleop fence",
    summary:
      "A second, smaller box inside the geofence that only hand-flown drones see. The sticks meet it as a keep_in wall whatever fence_behavior is, so a pilot never reaches the geofence.",
    detail:
      "Scenario-driven and external drones ignore it. Only an ACTIVE drone is held inside it, so takeoff and landing pass through a raised floor. It's drawn amber in the 3D view, and the status snapshot carries both boxes.",
    params: [
      { name: "teleop_fence_enabled", value: "true", text: "In the teleop configs" },
      { name: "teleop_fence_min / max", value: "box", text: "Must lie inside the geofence or start is refused" },
    ],
    media: media.safetyTeleopFence,
  },
  {
    id: "hold",
    index: "04",
    label: "Hold and land",
    summary:
      "/hold brakes on the goal law to a predicted stop point v²/(2a) + v/hover_kp ahead, clamped into the fence, and holds there. /land descends and disarms every commanded drone.",
    detail:
      "In the SVG Basestation, LAND ALL takes two clicks: the first arms it for 4 s and the second fires. That makes it quick under stress, but a stray click can't land the swarm. Hold All is the softer stop. Before this change, a hold from 6 m/s flew back to where it was called, a 1.5 m bounce (bag run_041842).",
    params: [
      { name: "~/hold", value: "Trigger", text: "Freeze in place; scenario stops" },
      { name: "~/land", value: "Trigger", text: "Descend and disarm" },
      { name: "~/reset_fence", value: "Trigger", text: "Clear a hold_all latch" },
    ],
    media: media.safetyHold,
  },
  {
    id: "stale",
    index: "05",
    label: "Lost inputs",
    summary:
      "If a drone's odometry is older than state_timeout_s, it gets a zero-velocity command. A dead gamepad or a dead teleop node both count as sticks at rest, so the commander keeps holding the drone where it is.",
    detail:
      "The stack bypasses drone_safety_monitor. PX4 failsafes and the RC kill switch are the safety net. Fences clip velocity and never cut the motors.",
    params: [
      { name: "state_timeout_s", value: "0.5 s", text: "Stale odometry means zero velocity" },
      { name: "teleop_timeout_s", value: "—", text: "Stale sticks mean hold position" },
      { name: "RC kill switch", value: "always", text: "The only true cutoff" },
    ],
    media: media.safetyStale,
  },
];

export type Scenario = {
  id: string;
  name: string;
  description: string;
  media: MediaSlot;
};

export type ScenarioGroup = {
  id: string;
  index: string;
  title: string;
  description: string;
  scenarios: Scenario[];
};

export const scenarioGroups: ScenarioGroup[] = [
  {
    id: "station",
    index: "01",
    title: "Hold and seek",
    description: "Drones hold a layout, fly to goals you set while they're in the air, or work through a scripted list of goals.",
    scenarios: [
      {
        id: "hover",
        name: "hover",
        description: "Each drone holds its configured position. Used for first flights and for flying at a drone by hand.",
        media: media.scenarioHover,
      },
      {
        id: "goal",
        name: "goal",
        description: "Each drone seeks a goal [x, y, z, θ] set live on /svg/{name}/goal_xyzt, at a speed set on speed_command. Named formations retarget the whole swarm at once.",
        media: media.scenarioGoal,
      },
      {
        id: "goal-sequence",
        name: "goal_sequence",
        description: "Each drone works through a scripted list of goals, so the swarm steps from one layout to the next without an operator sending each goal.",
        media: media.scenarioGoalSequence,
      },
    ],
  },
  {
    id: "traffic",
    index: "02",
    title: "Background traffic",
    description: "Random motion that keeps the filter busy for long runs.",
    scenarios: [
      {
        id: "random-walk",
        name: "random_walk",
        description: "Drift at a fixed speed, bouncing off the walls.",
        media: media.scenarioRandomWalk,
      },
      {
        id: "random-goals",
        name: "random_goals",
        description: "Seek a random goal and pick a new one on arrival.",
        media: media.scenarioRandomGoals,
      },
    ],
  },
  {
    id: "crossing",
    index: "03",
    title: "Forced crossings",
    description: "Geometry that puts drones on collision courses on purpose.",
    scenarios: [
      {
        id: "head-on",
        name: "head_on",
        description: "Two groups face each other and swap sides, again and again.",
        media: media.scenarioHeadOn,
      },
      {
        id: "antipodal",
        name: "antipodal",
        description: "Each drone crosses through the centre to the antipode of its start on a sphere.",
        media: media.scenarioAntipodal,
      },
      {
        id: "figure-eight",
        name: "figure_eight",
        description: "Each scenario drone traces a figure-eight through the room, so the paths cross at the centre. Fly a third drone by hand through it and the filter bends the pattern around the pilot.",
        media: media.scenarioFigureEight,
      },
    ],
  },
  {
    id: "strike",
    index: "04",
    title: "Strike vs guard",
    description: "The showcase: an intruder forces its way between two guards.",
    scenarios: [
      {
        id: "squeeze",
        name: "squeeze",
        description: "Two holders track fixed posts while an intruder shuttles through the gap between them. The holders have to yield and then return. Order: [holder, holder, intruder].",
        media: media.scenarioSqueeze,
      },
    ],
  },
];

export type Experiment = {
  id: string;
  code: string;
  label: string;
  scope: string;
  config: string;
  summary: string;
  drones: { name: string; mode: string; role: string; cbf: string }[];
  watch: string[];
  leds: string;
  media: MediaSlot;
};

export const experiments: Experiment[] = [
  {
    id: "c1",
    code: "C1",
    label: "Single-drone goal",
    scope: "1 drone · sim or real",
    config: "goal_single.yaml",
    summary:
      "One drone flies to a goal you set, at a speed you set. The same config covers sim and hardware, and drone_modes is the only switch.",
    drones: [{ name: "drone_1", mode: "sim | real", role: "auto", cbf: "filtered" }],
    watch: [
      "The drone stops on the goal and doesn't overshoot it. The braking profile replaced the 1.5 × distance P-law.",
      "The heading follows θ, where 0° is +X and positive angles turn clockwise. The commanded heading is drawn as a white arrow.",
      "A new speed only takes effect on a goal farther than v²/(2a) + v·settle.",
    ],
    leds: "Green throughout. A single drone is never corrected by the CBF.",
    media: media.expSingleGoal,
  },
  {
    id: "c2",
    code: "C2",
    label: "Multi-drone goals",
    scope: "2+ drones · formations",
    config: "goal_tracking.yaml",
    summary:
      "Give different drones different goals and speeds while they fly. The CBF keeps them apart where their paths cross. One command sends the whole swarm to a named formation.",
    drones: [
      { name: "drone_1", mode: "real", role: "auto", cbf: "filtered" },
      { name: "drone_2", mode: "real", role: "auto", cbf: "filtered" },
      { name: "drone_3", mode: "real", role: "auto", cbf: "filtered" },
    ],
    watch: [
      "Paths cross without a pair ever coming closer than 2r.",
      "/svg/formation_command takes home, line, triangle, diagonal, or next to step through them.",
      "Per-drone goal_command still fine-tunes one drone after a formation switch.",
    ],
    leds: "Green. A drone turns red for as long as the CBF is changing its command.",
    media: media.expMultiGoal,
  },
  {
    id: "c3",
    code: "C3",
    label: "Squeeze rehearsal",
    scope: "3 drones · all sim",
    config: "squeeze_3drone.yaml",
    summary:
      "The squeeze geometry in simulation only, with zero risk. Rehearse it here before either hardware variant.",
    drones: [
      { name: "drone_1", mode: "sim", role: "holder", cbf: "filtered" },
      { name: "drone_2", mode: "sim", role: "holder", cbf: "filtered" },
      { name: "drone_3", mode: "sim", role: "intruder", cbf: "exempt" },
    ],
    watch: [
      "The holders part as the intruder closes, then settle back onto their posts.",
      "The intruder presses straight through. It's exempt, so only the holders yield.",
    ],
    leds: "Not used. There are no physical drones.",
    media: media.expSqueezeSim,
  },
  {
    id: "c4",
    code: "C4",
    label: "Hybrid squeeze",
    scope: "2 real guards · 1 sim intruder",
    config: "hybrid_squeeze.yaml",
    summary:
      "The flagship. Two real holders in the mocap room dodge a simulated intruder from Isaac Sim, and all three are under one CBF. The real holders appear in the Isaac viewport as live avatars.",
    drones: [
      { name: "drone_1", mode: "real", role: "holder", cbf: "filtered" },
      { name: "drone_2", mode: "real", role: "holder", cbf: "filtered" },
      { name: "drone_3", mode: "sim", role: "intruder", cbf: "exempt" },
    ],
    watch: [
      "Real drones react to a drone that exists only in simulation.",
      "In RViz the holders are red and the intruder cyan, all in one map frame.",
      "Dry-run the routing first with functional_hybrid_test.py. It needs no hardware.",
    ],
    leds: "Holders green; red while the CBF is pushing them out of the way.",
    media: media.expHybrid,
  },
  {
    id: "c5",
    code: "C5",
    label: "Hand-flown intruder",
    scope: "3 real · pilot on a gamepad",
    config: "squeeze_rc_intruder.yaml",
    summary:
      "All three drones are real, and a person flies the intruder with a gamepad in position mode. The commander lifts drone_3 to waypoint A, hands it to the sticks at start, and lands it with the holders.",
    drones: [
      { name: "drone_1", mode: "real", role: "holder", cbf: "filtered" },
      { name: "drone_2", mode: "real", role: "holder", cbf: "filtered" },
      { name: "drone_3", mode: "real", role: "teleop intruder", cbf: "exempt" },
    ],
    watch: [
      "The filter treats the pilot's ramped, capped command as fixed, so the holders start moving before drone_3 arrives.",
      "The pilot meets the amber teleop fence as a soft wall, and the keep_in geofence bounds all three.",
      "Nothing stops the pilot ramming a holder. Keep a thumb on every RC kill switch.",
    ],
    leds: "Everyone green. A holder turns red while it is being pushed aside, held for at least 0.5 s so it's visible.",
    media: media.expHandFlown,
  },
];

export type Finding = {
  issue: string;
  evidence: string;
  before: string;
  after: string;
  basis: "flight" | "model" | "fix";
};

export const findings: Finding[] = [
  {
    issue: "Goal leg, 7 m at 5 m/s",
    evidence: "drone_2_auto_goal_0920_192853",
    before: "1.0 m overshoot, 4.7 s to settle",
    after: "Stops within ~0.05 m",
    basis: "model",
  },
  {
    issue: "Fence wall at ~6 m/s",
    evidence: "run_045417",
    before: "0.35–0.68 m past the wall on 11 of 11 approaches",
    after: "Within 0.02 m from 0.5–8 m/s",
    basis: "model",
  },
  {
    issue: "Takeoff to a 1 m target",
    evidence: "C1_0920_203148",
    before: "Dashed to 1.94 m",
    after: "0.2 m leash + climb profile",
    basis: "fix",
  },
  {
    issue: "Hover before /start",
    evidence: "run_042957, run_042433",
    before: "±0.15 m swing, ~4 s period",
    after: "Settles to 1 mm",
    basis: "model",
  },
  {
    issue: "/hold from 6 m/s",
    evidence: "run_041842",
    before: "1.5 m bounce back",
    after: "Brakes to a predicted stop point",
    basis: "fix",
  },
  {
    issue: "CBF close passes",
    evidence: "run_020444",
    before: "0.52, 0.65, 0.79 m against 1.1–1.3 m required",
    after: "Feedforward kept through corrections",
    basis: "fix",
  },
];

export const basestationFeatures = [
  {
    title: "Two-click safety stop",
    text: "A red LAND ALL bar lands every commanded drone. Hold All freezes them in place.",
  },
  {
    title: "Did the command happen?",
    text: "Each command's result is read from the commander's own 5 Hz status snapshot, not from the service reply. Each one shows as confirmed, rejected or timed out.",
  },
  {
    title: "Live CBF gains",
    text: "α, r, v_max and goal-acceleration sliders with a live readout, applied in flight. Each value shows ✓ once the commander confirms it, … while it's waiting, and ✗ if it's rejected.",
  },
  {
    title: "Agent state",
    text: "Flight state, position in world ENU, speed, command-stream rate, CBF status, and freshness of each drone's interface and odometry.",
  },
  {
    title: "Link safety",
    text: "Path, rate, ping, measured DDS drop rate, max gap, mocap age, EKF fusion and clock drift for each drone.",
  },
  {
    title: "Battery and return",
    text: "State of charge, voltage sag, burn rate and a distance-to-pad return budget that warns with RTB NOW.",
  },
];

export const limitations = [
  "cbf_alpha = 2.5 assumes no tracking lag. The close passes in run_020444 were caused by that lag.",
  "random_goals picks goals with no separation from other drones. In run_020444, 100 of 221 legs had another drone within 1.5 m of the goal.",
  "Fences clip velocity and don't cut the motors. The stack bypasses drone_safety_monitor, so PX4 failsafes and the RC kill switch are the true cutoff.",
  "Takeoff is fixed-time staging and doesn't check vehicle_status. If PX4 refuses to arm, the drone just stays put.",
  "Yaw sign can't be checked on the ground for real drones. Test it slowly and low on the first flight.",
  "The room limits top speed to about 8 m/s on a 10 m run at 45° tilt. 10 m/s needs about 11 m, or a 60° tilt.",
];
