// Every image and video slot on the homepage. A slot with no `src` renders as a
// "media planned" card. To fill one, drop the file into public/static/media/<kind>s/
// and set `src` to its public path (e.g. "/static/media/videos/squeeze-hybrid.mp4").
// Videos look for a poster beside them with the same name and a .jpg extension.

// Prefixes a site path with the deploy base ("/SvG-Website/" on GitHub Pages).
export const withBase = (path: string) => `${import.meta.env.BASE_URL}${path.replace(/^\//, "")}`;

export type MediaKind = "video" | "photo" | "figure";

// The flight recordings are three panes side by side, 1920 x 552: the SVG Basestation
// panel, the 3D view with the battery panel under it, and the mocap-room camera.
// "full" shows all three (the default); "camera" crops a frame to the camera pane.
export type MediaFraming = "camera" | "full";

export type MediaSlot = {
  kind: MediaKind;
  label: string;
  suggested: string;
  src?: string;
  // What this clip shows, printed under it.
  caption?: string;
  framing?: MediaFraming;
};

const slot = (kind: MediaKind, label: string, suggested: string, src?: string): MediaSlot => ({
  kind,
  label,
  suggested,
  src: src && withBase(src),
});

// A flight recording from public/static/media/videos/, with the caption shown under it.
const recording = (label: string, file: string, caption: string, framing: MediaFraming = "full"): MediaSlot => ({
  kind: "video",
  label,
  suggested: `videos/${file}`,
  src: withBase(`/static/media/videos/${file}`),
  caption,
  framing,
});

export const media = {
  overview: slot("video", "Project overview video", "videos/overview.mp4"),
  architecture: {
    ...slot("figure", "SVG ground controller: the swarm control stack", "figures/architecture.jpg", "/static/media/figures/architecture.jpg"),
    caption: "Each drone's command comes from the nominal controller or from a gamepad, depending on its role. It then passes through the safety filter unless the drone is CBF-exempt, and goes out to Isaac Sim or to a real drone. External drones are tracked as obstacles, and mocap positions feed both the filter and the simulator.",
  },
  basestation: recording(
    "SVG Basestation panel in Foxglove during a goal run",
    "scenario-goal.mp4",
    "The panel during the goal run shown under Flight scenarios. Start asks for confirmation before the nominal policies go live, each drone gets its goal from the Goal row, and the log shows every command as accepted, then confirmed by the commander. The 3D view beside it draws each drone's safety sphere and the fence, and the camera shows the room.",
    "full",
  ),
  mocapRoom: slot("photo", "Motion-capture flight room", "photos/mocap-room.jpg"),

  modeSim: slot("photo", "Simulated drones in Isaac Sim", "photos/isaac-sim.jpg"),
  modeReal: slot("photo", "Three Starling drones with their LED strips in the flight room", "photos/starling.jpg", "/static/media/photos/starling.jpg"),
  modeHybrid: slot("photo", "Real drone shown as an avatar in Isaac Sim", "photos/hybrid-avatar.jpg"),

  safetyCbf: slot("video", "CBF filter moving a holder out of the way", "videos/cbf-yield.mp4"),
  safetyFence: slot("video", "Drone braking at the keep_in wall", "videos/fence-keep-in.mp4"),
  safetyTeleopFence: slot("video", "Hand-flown drone stopping at the teleop fence", "videos/teleop-fence.mp4"),
  safetyHold: slot("video", "Hold braking to a stop point", "videos/hold-brake.mp4"),
  safetyStale: slot("figure", "What happens when odometry or the gamepad drops out", "figures/lost-inputs.png"),

  scenarioHover: slot("video", "hover scenario", "videos/scenario-hover.mp4"),
  scenarioGoal: recording(
    "goal scenario: three real drones sent to goals from the panel",
    "scenario-goal.mp4",
    "Three real drones. The operator confirms Start in the panel, then picks a drone tab, types a goal and presses Send Goal: drone_1 to (2, 2, 1.5) m, drone_2 to (−2, −2, 1.5) m and drone_3 to (0, 0, 1.5) m. Each command appears in the log as accepted, then confirmed by the commander.",
  ),
  scenarioGoalSequence: recording(
    "goal_sequence scenario: three real drones stepping through layouts",
    "scenario-goal-sequence.mp4",
    "Three real drones. Each one works through a scripted list of goals, so the swarm steps through a series of layouts on its own, a line across the room, a triangle and more, with the filter handling the crossings in between.",
  ),
  scenarioRandomWalk: slot("video", "random_walk scenario", "videos/scenario-random-walk.mp4"),
  scenarioRandomGoals: recording(
    "random_goals scenario: three real drones",
    "scenario-random-goals.mp4",
    "Three real drones. Each one flies to a random goal and draws a new one on arrival, so their paths cross all the time. The agent-state table shows the filter correcting two or three drones at once, and their LEDs turn red while it does.",
  ),
  scenarioHeadOn: slot("video", "head_on scenario", "videos/scenario-head-on.mp4"),
  scenarioAntipodal: slot("video", "antipodal scenario", "videos/scenario-antipodal.mp4"),
  scenarioFigureEight: recording(
    "figure_eight scenario with a hand-flown third drone",
    "scenario-figure-eight.mp4",
    "drone_1 and drone_2 fly the figure-eight while drone_3 is hand-flown on the gamepad and exempt from the filter. The two scenario drones do the yielding: they turn red and give way as the pilot's drone comes through, then carry on with the figure.",
  ),
  scenarioSqueeze: slot("video", "squeeze scenario", "videos/scenario-squeeze.mp4"),

  expSingleGoal: recording(
    "C1 single-drone goal flight",
    "c1-single-goal.mp4",
    "One real drone, drone_1, with the two sim drones in the config left on the ground. Goal acceleration is set to 3.4 m/s² from the panel, then the drone is sent to (2, 2, 2) m and on to (−2, 2, 2) m, stopping on each goal.",
  ),
  expMultiGoal: recording(
    "C2 multi-drone goals with live CBF gains",
    "c2-multi-goal.mp4",
    "Three real drones. drone_1 is sent to (2, −2, 1.5) m, then drone_2 is sent to the same spot: the filter holds the pair apart and both show as correcting. α is then lowered from 2.0 to 1.8 and r raised to 1.0 m, live from the panel, and the safety spheres in the 3D view grow to match. drone_3 is sent to (−1.5, 2, 1.5) m.",
  ),
  expSqueezeSim: slot("video", "C3 all-sim squeeze rehearsal", "videos/c3-squeeze-sim.mp4"),
  expHybrid: slot("video", "C4 hybrid squeeze: real holders, simulated intruder", "videos/c4-hybrid-squeeze.mp4"),
  expHandFlown: slot("video", "C5 squeeze with a hand-flown intruder", "videos/c5-hand-flown.mp4"),

  plotGoalLaw: slot("figure", "Goal law: old P-law vs braking profile", "figures/goal-law.png"),
  plotFence: slot("figure", "Fence envelope: overshoot before and after", "figures/fence-envelope.png"),
} satisfies Record<string, MediaSlot>;

export type ReleaseResource = {
  id: string;
  label: string;
  href?: string;
  status: "available" | "coming-soon";
};

export const releaseResources: ReleaseResource[] = [
  {
    id: "code",
    label: "Code (AirStack branch)",
    href: "https://github.com/castacks/AirStack/tree/yikuan/SVG_ground_control",
    status: "available",
  },
  { id: "docs", label: "Documentation", href: withBase("/docs/"), status: "available" },
  { id: "paper", label: "Paper", status: "coming-soon" },
  { id: "video", label: "Video", status: "coming-soon" },
];
