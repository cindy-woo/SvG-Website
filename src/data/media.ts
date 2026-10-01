// Every image and video slot on the homepage. A slot with no `src` renders as a
// "media planned" card. To fill one, drop the file into public/static/media/<kind>s/
// and set `src` to its public path (e.g. "/static/media/videos/squeeze-hybrid.mp4").
// Videos look for a poster beside them with the same name and a .jpg extension.

export type MediaKind = "video" | "photo" | "figure";

export type MediaSlot = {
  kind: MediaKind;
  label: string;
  suggested: string;
  src?: string;
};

const slot = (kind: MediaKind, label: string, suggested: string, src?: string): MediaSlot => ({
  kind,
  label,
  suggested,
  src,
});

export const media = {
  overview: slot("video", "Project overview video", "videos/overview.mp4"),
  architecture: slot("figure", "System architecture diagram", "figures/architecture.png"),
  basestation: slot("figure", "SVG Basestation panel in Foxglove", "figures/basestation.png"),
  mocapRoom: slot("photo", "Motion-capture flight room", "photos/mocap-room.jpg"),

  modeSim: slot("photo", "Simulated drones in Isaac Sim", "photos/isaac-sim.jpg"),
  modeReal: slot("photo", "Starling drone with its LED strip", "photos/starling.jpg"),
  modeHybrid: slot("photo", "Real drone shown as an avatar in Isaac Sim", "photos/hybrid-avatar.jpg"),

  safetyCbf: slot("video", "CBF filter moving a holder out of the way", "videos/cbf-yield.mp4"),
  safetyFence: slot("video", "Drone braking at the keep_in wall", "videos/fence-keep-in.mp4"),
  safetyTeleopFence: slot("video", "Hand-flown drone stopping at the teleop fence", "videos/teleop-fence.mp4"),
  safetyHold: slot("video", "Hold braking to a stop point", "videos/hold-brake.mp4"),
  safetyStale: slot("figure", "What happens when odometry or the gamepad drops out", "figures/lost-inputs.png"),

  scenarioHover: slot("video", "hover scenario", "videos/scenario-hover.mp4"),
  scenarioGoal: slot("video", "goal scenario", "videos/scenario-goal.mp4"),
  scenarioRandomWalk: slot("video", "random_walk scenario", "videos/scenario-random-walk.mp4"),
  scenarioRandomGoals: slot("video", "random_goals scenario", "videos/scenario-random-goals.mp4"),
  scenarioHeadOn: slot("video", "head_on scenario", "videos/scenario-head-on.mp4"),
  scenarioAntipodal: slot("video", "antipodal scenario", "videos/scenario-antipodal.mp4"),
  scenarioSqueeze: slot("video", "squeeze scenario", "videos/scenario-squeeze.mp4"),

  expSingleGoal: slot("video", "C1 single-drone goal flight", "videos/c1-single-goal.mp4"),
  expMultiGoal: slot("video", "C2 multi-drone goals and formations", "videos/c2-multi-goal.mp4"),
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
    href: "https://github.com/castacks/AirStack/tree/yikuan/SVG_ground_control/robot/ros_ws/src/svg_ground_control",
    status: "available",
  },
  { id: "docs", label: "Documentation", href: "/docs/", status: "available" },
  { id: "paper", label: "Paper", status: "coming-soon" },
  { id: "video", label: "Video", status: "coming-soon" },
];
