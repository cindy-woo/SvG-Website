import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { media, releaseResources, withBase, type MediaFraming, type MediaSlot } from "./data/media";
import {
  affiliations,
  authors,
  axes,
  basestationFeatures,
  experiments,
  findings,
  limitations,
  packagePath,
  pipeline,
  repoBase,
  safetyLayers,
  scenarioGroups,
  stats,
  type Scenario,
} from "./data/project";
import { useUrlChoice } from "./hooks/useUrlChoice";

// Only slots with a file are shown; the galleries disappear when none has one.
const modeGallery = [media.modeSim, media.modeReal, media.modeHybrid].filter((slot) => slot.src);
const findingPlots = [media.plotGoalLaw, media.plotFence].filter((slot) => slot.src);

const navItems = [
  { id: "system", label: "System" },
  { id: "safety", label: "Safety" },
  { id: "scenarios", label: "Scenarios" },
  { id: "experiments", label: "Experiments" },
  { id: "ground-station", label: "Ground station" },
  { id: "findings", label: "Findings" },
] as const;

function useInitialHashTarget() {
  useEffect(() => {
    let frame: number | null = null;
    const scrollToHash = () => {
      if (frame !== null) window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        frame = null;
        const hash = window.location.hash.slice(1);
        if (!hash) return;
        const target = document.getElementById(decodeURIComponent(hash));
        if (!target) return;

        const root = document.documentElement;
        const previousScrollBehavior = root.style.scrollBehavior;
        root.style.scrollBehavior = "auto";
        target.scrollIntoView({ block: "start" });
        root.style.scrollBehavior = previousScrollBehavior;
      });
    };

    scrollToHash();
    window.addEventListener("hashchange", scrollToHash);
    return () => {
      window.removeEventListener("hashchange", scrollToHash);
      if (frame !== null) window.cancelAnimationFrame(frame);
    };
  }, []);
}

function useNearViewport<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [isNear, setIsNear] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    if (!("IntersectionObserver" in window)) {
      setIsNear(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsNear(true);
          observer.disconnect();
        }
      },
      { rootMargin: "320px" },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return { ref, isNear };
}

function VideoFrame({
  src,
  label,
  className = "",
  describedBy,
  framing = "camera",
}: {
  src: string;
  label: string;
  className?: string;
  describedBy?: string;
  framing?: MediaFraming;
}) {
  const { ref, isNear } = useNearViewport<HTMLDivElement>();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => setIsPlaying(false), [src]);

  const togglePlayback = async () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      try {
        await video.play();
      } catch {
        setIsPlaying(false);
      }
    } else {
      video.pause();
    }
  };

  return (
    <div
      ref={ref}
      className={`video-frame is-${framing} ${isPlaying ? "is-playing" : "is-paused"} ${className}`}
      style={framing === "full" ? { aspectRatio: "1920 / 552" } : undefined}
    >
      {isNear ? (
        <>
          <video
            ref={videoRef}
            key={src}
            onError={() => setFailedSrc(src)}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            muted
            loop
            playsInline
            preload="none"
            poster={src.replace(/\.mp4$/, ".jpg")}
            aria-label={label}
            aria-describedby={describedBy}
          >
            <source src={src} type="video/mp4" />
          </video>
          {failedSrc !== src && (
            <button
              className="video-toggle"
              type="button"
              aria-label={`${isPlaying ? "Pause" : "Play"} ${label}`}
              onClick={togglePlayback}
            >
              <span aria-hidden="true">{isPlaying ? "Ⅱ" : "▶"}</span>
            </button>
          )}
        </>
      ) : (
        <div className="video-skeleton" aria-hidden="true" />
      )}
      {failedSrc === src && <p className="video-error" role="status">Video unavailable. <a href={src}>Open the clip directly</a>.</p>}
    </div>
  );
}

// Renders a media slot. A slot with no file renders nothing: the text around it stands alone.
function MediaFrame({
  slot,
  describedBy,
  className = "",
}: {
  slot: MediaSlot;
  describedBy?: string;
  className?: string;
}) {
  if (slot.src && slot.kind === "video") {
    return <VideoFrame src={slot.src} label={slot.label} describedBy={describedBy} className={className} framing={slot.framing} />;
  }
  if (slot.src) {
    return (
      <a className={`media-image ${className}`} href={slot.src} target="_blank" rel="noreferrer" aria-label={`Enlarge: ${slot.label}`}>
        <img src={slot.src} alt={slot.label} loading="lazy" />
      </a>
    );
  }
  return null;
}

// What a filled slot shows, with a link to the file itself (the full three-pane recording).
function MediaCaption({ slot, className = "" }: { slot: MediaSlot; className?: string }) {
  if (!slot.src || !slot.caption) return null;
  return (
    <p className={`media-caption ${className}`}>
      {slot.caption}{" "}
      <a href={slot.src} target="_blank" rel="noreferrer">Full recording ↗</a>
    </p>
  );
}

function SectionIntro({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="section-intro">
      <div className="section-intro-grid">
        <h2>{title}</h2>
        <div className="section-intro-copy">{children}</div>
      </div>
    </div>
  );
}

// Arrow-key, Home and End navigation shared by the tab lists below.
function nextTabIndex(event: ReactKeyboardEvent<HTMLButtonElement>, current: number, count: number) {
  const direction = event.key === "ArrowRight" || event.key === "ArrowDown"
    ? 1
    : event.key === "ArrowLeft" || event.key === "ArrowUp"
      ? -1
      : 0;
  if (direction === 0 && event.key !== "Home" && event.key !== "End") return null;
  event.preventDefault();
  if (event.key === "Home") return 0;
  if (event.key === "End") return count - 1;
  return (current + direction + count) % count;
}

function SystemPipeline() {
  return (
    <ol className="svg-pipeline" aria-label="Control pipeline, one tick">
      {pipeline.map((step, index) => (
        <li className={`svg-pipeline-step is-${step.id}`} key={step.id}>
          <span className="svg-pipeline-index">{String(index + 1).padStart(2, "0")}</span>
          <strong>{step.title}</strong>
          <code>{step.node}</code>
          <p>{step.text}</p>
        </li>
      ))}
    </ol>
  );
}

function DroneAxes() {
  return (
    <div className="svg-axes">
      {axes.map((axis) => (
        <article className="svg-axis-card" key={axis.id}>
          <div className="embodiment-card-head">
            <span>{axis.title}</span>
            <code className="embodiment-actuation">{axis.param}</code>
          </div>
          <dl>
            {axis.values.map((value) => (
              <div key={value.name}>
                <dt>{value.name}</dt>
                <dd>{value.text}</dd>
              </div>
            ))}
          </dl>
          <p>{axis.note}</p>
        </article>
      ))}
    </div>
  );
}

const safetyIds = safetyLayers.map((layer) => layer.id);

function SafetyExplorer() {
  const [layerId, setLayerId] = useUrlChoice("safety", safetyIds, "cbf");
  const layerIndex = Math.max(0, safetyIds.indexOf(layerId));
  const layer = safetyLayers[layerIndex];

  const selectAdjacent = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    const next = nextTabIndex(event, layerIndex, safetyLayers.length);
    if (next === null) return;
    setLayerId(safetyIds[next]);
    window.requestAnimationFrame(() => document.getElementById(`safety-tab-${safetyIds[next]}`)?.focus());
  };

  return (
    <div className="effect-explorer svg-safety">
      <div className="effect-panel-tabs" role="tablist" aria-label="Safety layer">
        {safetyLayers.map((candidate) => (
          <button
            id={`safety-tab-${candidate.id}`}
            className={candidate.id === layer.id ? "is-active" : ""}
            type="button"
            role="tab"
            aria-selected={candidate.id === layer.id}
            aria-controls="safety-panel"
            tabIndex={candidate.id === layer.id ? 0 : -1}
            onClick={() => setLayerId(candidate.id)}
            onKeyDown={selectAdjacent}
            key={candidate.id}
          >
            <span>{candidate.index}</span>
            <strong>{candidate.label}</strong>
          </button>
        ))}
      </div>
      <div id="safety-panel" className="effect-workbench" role="tabpanel" aria-labelledby={`safety-tab-${layer.id}`}>
        <div className={`effect-viewer ${layer.media.src ? "" : "is-text-only"}`}>
          {layer.media.src && (
            <div className="effect-stage has-media">
              <MediaFrame slot={layer.media} describedBy="safety-summary" />
            </div>
          )}
          <div className="effect-evidence">
            <p className="effect-explanation" id="safety-summary">{layer.summary}</p>
            <p className="effect-caption">{layer.detail}</p>
            <table className="svg-param-table">
              <caption className="sr-only">Parameters for {layer.label}</caption>
              <tbody>
                {layer.params.map((param) => (
                  <tr key={param.name}>
                    <th scope="row"><code>{param.name}</code></th>
                    <td><strong>{param.value}</strong><small>{param.text}</small></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <MediaCaption slot={layer.media} />
          </div>
        </div>
      </div>
    </div>
  );
}

function ScenarioCard({ scenario, number }: { scenario: Scenario; number: string }) {
  const captionId = `scenario-${scenario.id}-caption`;
  return (
    <article className="task-card">
      <MediaFrame slot={scenario.media} describedBy={captionId} />
      <div className="task-card-copy">
        <span>{number}</span>
        <div>
          <h3><code>{scenario.name}</code></h3>
          <p id={captionId}>{scenario.description}</p>
          <MediaCaption slot={scenario.media} />
        </div>
      </div>
    </article>
  );
}

function ScenarioCatalog() {
  const [openId, setOpenId] = useUrlChoice(
    "scenarios",
    ["none", ...scenarioGroups.map((group) => group.id)] as const,
    "strike",
  );
  let offset = 0;

  return (
    <div className="task-catalog">
      {scenarioGroups.map((group) => {
        const isOpen = openId === group.id;
        const start = offset;
        offset += group.scenarios.length;
        return (
          <article className={`task-group ${isOpen ? "is-open" : ""}`} key={group.id}>
            <button
              className="task-group-trigger"
              type="button"
              aria-expanded={isOpen}
              aria-controls={`scenario-group-${group.id}`}
              onClick={() => setOpenId(isOpen ? "none" : group.id)}
            >
              <span className="task-group-index">{group.index}</span>
              <span className="task-group-heading">
                <strong>{group.title}</strong>
                <small>{group.description}</small>
              </span>
              <span className="task-group-meta">
                <span>{group.scenarios.length} {group.scenarios.length === 1 ? "scenario" : "scenarios"}</span>
              </span>
              <span className="task-group-toggle" aria-hidden="true">{isOpen ? "−" : "+"}</span>
            </button>
            {isOpen && (
              <div className="task-group-panel" id={`scenario-group-${group.id}`}>
                <div className={`task-grid ${group.scenarios.length === 2 ? "task-grid-pair" : ""}`}>
                  {group.scenarios.map((scenario, index) => (
                    <ScenarioCard scenario={scenario} number={String(start + index + 1).padStart(2, "0")} key={scenario.id} />
                  ))}
                </div>
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}

const experimentIds = experiments.map((experiment) => experiment.id);

function ExperimentExplorer() {
  const tabsRef = useRef<HTMLDivElement>(null);
  const [experimentId, setExperimentId] = useUrlChoice("exp", experimentIds, "c4");
  const experimentIndex = Math.max(0, experimentIds.indexOf(experimentId));
  const experiment = experiments[experimentIndex];

  useEffect(() => {
    const tabs = tabsRef.current;
    const activeTab = document.getElementById(`experiment-tab-${experiment.id}`);
    if (!tabs || !activeTab) return;
    tabs.scrollTo({ left: activeTab.offsetLeft - (tabs.clientWidth - activeTab.offsetWidth) / 2, behavior: "auto" });
  }, [experiment.id]);

  const selectAdjacent = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    const next = nextTabIndex(event, experimentIndex, experiments.length);
    if (next === null) return;
    setExperimentId(experimentIds[next]);
    window.requestAnimationFrame(() => document.getElementById(`experiment-tab-${experimentIds[next]}`)?.focus());
  };

  return (
    <div className="results-explorer">
      <div ref={tabsRef} className="experiment-tabs svg-experiment-tabs" role="tablist" aria-label="Experiment">
        {experiments.map((candidate) => (
          <button
            id={`experiment-tab-${candidate.id}`}
            className={candidate.id === experiment.id ? "is-active" : ""}
            type="button"
            role="tab"
            aria-selected={candidate.id === experiment.id}
            aria-controls="experiment-panel"
            tabIndex={candidate.id === experiment.id ? 0 : -1}
            onClick={() => setExperimentId(candidate.id)}
            onKeyDown={selectAdjacent}
            key={candidate.id}
          >
            <span>{candidate.code}</span>
            <strong>{candidate.label}</strong>
            <small>{candidate.scope}</small>
          </button>
        ))}
      </div>
      <div className="experiment-panel" id="experiment-panel" role="tabpanel" aria-labelledby={`experiment-tab-${experiment.id}`}>
        <div className={`experiment-three-layout comparison-layout ${experiment.media.src ? "" : "is-text-only"}`}>
          <div className="embodiment-comparison-panel">
            <p className="study-insight">{experiment.summary}</p>
            <p className="evaluation-context">Config: <code>{experiment.config}</code></p>
            <div className="metric-table-scroll">
              <table className="embodiment-metric-table svg-drone-table">
                <caption className="sr-only">Drones in {experiment.label}</caption>
                <thead>
                  <tr className="embodiment-metric-header">
                    <th scope="col">Drone</th>
                    <th scope="col">Mode</th>
                    <th scope="col">Role</th>
                    <th scope="col">CBF</th>
                  </tr>
                </thead>
                <tbody>
                  {experiment.drones.map((drone) => (
                    <tr className="embodiment-metric-row" key={drone.name}>
                      <th scope="row"><code>{drone.name}</code></th>
                      <td>{drone.mode}</td>
                      <td>{drone.role}</td>
                      <td className={drone.cbf === "exempt" ? "is-exempt" : ""}>{drone.cbf}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <h3 className="svg-subhead">What to watch</h3>
            <ul className="svg-list">
              {experiment.watch.map((item) => <li key={item}>{item}</li>)}
            </ul>
            <p className="svg-led"><span aria-hidden="true" /> {experiment.leds}</p>
            <MediaCaption slot={experiment.media} />
          </div>
          {experiment.media.src && (
            <div className="embodiment-video-panel">
              <div className="experiment-video">
                <MediaFrame slot={experiment.media} describedBy="experiment-caption" />
                <p id="experiment-caption"><strong>{experiment.code} · {experiment.label}</strong></p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState("");
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const closeOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setMenuOpen(false);
      menuButtonRef.current?.focus();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [menuOpen]);

  useEffect(() => {
    const sections = navItems
      .map((item) => document.getElementById(item.id))
      .filter((element): element is HTMLElement => element !== null);
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible) setActiveSection(visible.target.id);
      },
      { rootMargin: "-20% 0px -68%", threshold: [0, 0.1, 0.4] },
    );
    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, []);

  return (
    <header className="site-header">
      <a className="skip-link" href="#main-content">Skip to content</a>
      <div className="nav-shell">
        <a className="wordmark" href="#top" onClick={() => setMenuOpen(false)}>
          <img className="wordmark-mark" src={withBase("/static/images/svg-logo.svg")} alt="" width="34" height="34" />
          <span>Strike vs Guard</span>
        </a>
        <button
          ref={menuButtonRef}
          className="menu-toggle"
          type="button"
          aria-label={`${menuOpen ? "Close" : "Open"} navigation`}
          aria-expanded={menuOpen}
          aria-controls="primary-navigation"
          onClick={() => setMenuOpen((open) => !open)}
        >
          <span />
          <span />
        </button>
        <nav id="primary-navigation" className={menuOpen ? "is-open" : ""} aria-label="Primary navigation">
          {navItems.map((item) => (
            <a
              className={activeSection === item.id ? "is-active" : ""}
              href={`#${item.id}`}
              onClick={() => setMenuOpen(false)}
              key={item.id}
            >
              {item.label}
            </a>
          ))}
          <a className="nav-docs" href={withBase("/docs/")}>Docs ↗</a>
        </nav>
      </div>
    </header>
  );
}

function App() {
  useInitialHashTarget();

  return (
    <>
      <Header />
      <main id="main-content">
        <section className="hero" id="top">
          <div className="page-shell hero-layout">
            <div className="hero-kicker"><span>Homogeneous multi-agent safe and agile control · AirLab · AirStack</span></div>
            <h1>
              <span className="hero-title-prefix">Strike vs Guard (SVG):</span>
              Collision-safe ground control for
              <span className="hero-topic"> multi-drone</span> strike and guard flights
            </h1>
            <p className="hero-contribution">
              One ground commander flies every drone, real or simulated, through a shared control barrier function. The guards hold their posts, make room for an intruder passing between them, and return.
            </p>
            {authors.length > 0 && (
              <div className="author-list" aria-label="Authors">
                {authors.map((author) => author.href ? (
                  <a href={author.href} target="_blank" rel="noreferrer" key={author.name}>
                    {author.name}<sup>{author.affiliation}</sup>
                  </a>
                ) : (
                  <span key={author.name}>{author.name}<sup>{author.affiliation}</sup></span>
                ))}
              </div>
            )}
            <div className="affiliation-list">
              {affiliations.map((affiliation, index) => (
                <span key={affiliation}>{authors.length > 0 && <sup>{index + 1}</sup>} {affiliation}</span>
              ))}
            </div>
            <div className="resource-row">
              {releaseResources.map((resource) => resource.href ? (
                <a className="button button-primary" href={resource.href} key={resource.id}>
                  {resource.label} <span>↗</span>
                </a>
              ) : (
                <span className="button button-pending" aria-disabled="true" key={resource.id}>
                  {resource.label} <small>{resource.status.replace("-", " ")}</small>
                </span>
              ))}
            </div>
          </div>
        </section>

        {media.overview.src && (
          <section className="overview-video" id="overview" aria-labelledby="overview-heading">
            <div className="page-shell">
              <div className="overview-content">
                <h2 id="overview-heading">Overview video</h2>
                <video
                  className="overview-player"
                  controls
                  playsInline
                  preload="none"
                  poster={media.overview.src.replace(/\.mp4$/, ".jpg")}
                  width="1920"
                  height="1080"
                  aria-label={media.overview.label}
                >
                  <source src={media.overview.src} type="video/mp4" />
                  <a href={media.overview.src}>Watch the overview video</a>.
                </video>
              </div>
            </div>
          </section>
        )}

        <section className="architecture-section section-block" id="system">
          <div className="page-shell">
            <h2>One commander, every drone, one safety filter.</h2>
            <p className="architecture-intro">
              Each drone runs its own flight controller, but nothing onboard knows where the other drones are. SVG keeps that knowledge on the ground. A central <code>swarm_commander</code> reads every drone's odometry in one world frame. It builds each drone's nominal command from a scenario, a goal or a gamepad, filters all of them together through a velocity CBF, and sends each drone a PX4-style trajectory point. Sim and hardware differ only in which topics a drone's commands go to. That's why a real drone in the mocap room and a simulated one in Isaac Sim can dodge each other under the same filter.
            </p>
            <p className="architecture-summary">
              SVG is one ROS 2 package inside <a href="https://github.com/castacks/AirStack">AirStack</a>, AirLab's containerised autonomy stack. It sits on top of AirStack's interface layer rather than replacing it. Each drone's <code>robot_interface_node</code> talks to PX4, through MAVROS for a simulated drone or over uXRCE-DDS with <code>px4_interface</code> for a real one, and <code>odometry_conversion</code> turns either into the same ENU odometry topic and TF. In simulation, AirStack's Isaac Sim container runs the physics and one PX4 SITL per drone; on hardware, its <code>natnet_ros2</code> node brings in the OptiTrack poses. SVG reads those odometry topics, writes each drone's command, and launches with <code>AUTOLAUNCH=false</code> so AirStack's stock planners stay out of the loop.
            </p>
            <SystemPipeline />
            <div className="svg-stats">
              {stats.map((stat) => (
                <div key={stat.label}>
                  <strong>{stat.value}</strong>
                  <span>{stat.label}</span>
                </div>
              ))}
            </div>
            <figure className="architecture-figure">
              <MediaFrame slot={media.architecture} />
              <figcaption>
                {media.architecture.caption && <>{media.architecture.caption}<br /></>}
                System architecture · <a href={`${repoBase}/${packagePath}/README.md`}>svg_ground_control README ↗</a>
              </figcaption>
            </figure>
          </div>
        </section>

        <section className="embodiment-section section-block" id="drones">
          <div className="page-shell">
            <SectionIntro title="Any drone, any mode">
              <p>Every task is a config. Each drone in it is set on three independent axes, so pure sim, all real and hybrid are the same task with different settings.</p>
            </SectionIntro>
            <DroneAxes />
            {modeGallery.length > 0 && (
              <div className="svg-mode-gallery">
                {modeGallery.map((slot) => (
                  <figure key={slot.suggested}>
                    <MediaFrame slot={slot} />
                    <figcaption>{slot.label}</figcaption>
                  </figure>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="effects-section section-block" id="safety">
          <div className="page-shell">
            <SectionIntro title="Layers of safety">
              <p>The CBF keeps drones apart, the fences keep them in the room, and hold, land and stale-input handling cover the rest. None of these cut the motors. The pilot's RC emergency stop stays the true cutoff.</p>
            </SectionIntro>
            <SafetyExplorer />
          </div>
        </section>

        <section className="tasks-section section-block" id="scenarios">
          <div className="page-shell">
            <SectionIntro title="Flight scenarios">
              <p>Nine nominal-velocity policies, picked with <code>scenario:=</code> at launch. Ported from drone_soccer, plus goal tracking, goal sequences, the figure-eight and the squeeze.</p>
            </SectionIntro>
            <ScenarioCatalog />
          </div>
        </section>

        <section className="results-section section-block" id="experiments">
          <div className="page-shell">
            <SectionIntro title="Experiments">
              <p>Five tasks build up to the squeeze: one drone to a goal, then several, then the squeeze in simulation, with a simulated intruder, and with a pilot.</p>
            </SectionIntro>
            <ExperimentExplorer />
          </div>
        </section>

        <section className="policy-section section-block" id="ground-station">
          <div className="page-shell">
            <SectionIntro title="Ground station">
              <p>The SVG Basestation is a Foxglove panel built for the operator. It sits beside a 3D view of every drone, its safety sphere, the fences and the goals.</p>
            </SectionIntro>
            <div className="svg-basestation">
              <figure className="architecture-figure">
                <MediaFrame slot={media.basestation} />
                <figcaption>
                  {media.basestation.caption && <>{media.basestation.caption}<br /></>}
                  SVG Basestation · <a href={`${repoBase}/${packagePath}/foxglove/svg-basestation/README.md`}>panel README ↗</a>
                  {media.basestation.src && <> · <a href={media.basestation.src} target="_blank" rel="noreferrer">Full recording ↗</a></>}
                </figcaption>
              </figure>
              <div className="svg-feature-grid">
                {basestationFeatures.map((feature) => (
                  <article key={feature.title}>
                    <h3>{feature.title}</h3>
                    <p>{feature.text}</p>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="findings-section section-block" id="findings">
          <div className="page-shell">
            <SectionIntro title="What the flights taught us">
              <p>Every change to the control law started from a bag recorded in the mocap room. Fixes were checked against a plant model identified from drone_2's ULogs: 0.15 s link delay, velocity loop P 1.8 / I 0.4, 0.1 s attitude lag.</p>
            </SectionIntro>
            <div className="metric-table-scroll">
              <table className="embodiment-metric-table svg-findings-table">
                <caption className="sr-only">Problems found in flight and their fixes</caption>
                <thead>
                  <tr className="embodiment-metric-header">
                    <th scope="col">Problem</th>
                    <th scope="col">Bag</th>
                    <th scope="col">Before</th>
                    <th scope="col">After</th>
                  </tr>
                </thead>
                <tbody>
                  {findings.map((finding) => (
                    <tr className="embodiment-metric-row" key={finding.issue}>
                      <th scope="row">{finding.issue}</th>
                      <td><code>{finding.evidence}</code></td>
                      <td>{finding.before}</td>
                      <td className="is-best">
                        {finding.after}
                        <small className={`svg-basis is-${finding.basis}`}>
                          {finding.basis === "model" ? "plant model" : finding.basis === "flight" ? "measured" : "fixed in code"}
                        </small>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {findingPlots.length > 0 && (
              <div className="svg-plot-row">
                {findingPlots.map((slot) => (
                  <figure key={slot.suggested}>
                    <MediaFrame slot={slot} />
                    <figcaption>{slot.label}</figcaption>
                  </figure>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="abstract-section section-block" id="summary">
          <div className="page-shell abstract-layout">
            <div className="abstract-heading">
              <h2>Summary</h2>
            </div>
            <div className="abstract-copy">
              <p>
                Drones are everywhere now, and sometimes one is somewhere it shouldn't be: near an airport, over a crowd, inside a no-fly zone. Strike vs Guard asks how a team of guard drones can keep a protected area covered and turn an approaching drone away, without any two drones ever coming too close. It is the execution layer of a multi-institute programme on homogeneous multi-agent safe and agile control, built at AirLab on AirStack.
              </p>
              <p>
                In the flights shown here, guard drones hold a formation while an intruder, flown by a policy, by a simulated vehicle or by a person with a gamepad, passes through them. Safety is enforced centrally. A velocity control barrier function, ported from the MuJoCo-validated drone_soccer project, sees every drone and minimally corrects their commands so no pair comes within twice the safety radius.
              </p>
              <p>
                The same commander drives simulated drones in Isaac Sim through MAVROS and real drones in an OptiTrack room through px4_interface over uXRCE-DDS, and it can mix them in one run. Real drones get a reference point with velocity and acceleration feedforward, so PX4 closes the position loop onboard. Goals, takeoff, hold and the geofence all use PX4's own braking law, and each piece was tuned against bags recorded in flight.
              </p>
              <p>
                Next is a larger flight: about six guard drones and three intruders, where the guards use the intruders' own collision avoidance to steer them away from a protected zone, either by herding them or by holding a blocking formation along its boundary. Strategy and coordination policies from partner groups will arrive over the same ROS 2 interfaces, and the ground controller will turn them into safe commands for each drone. The same cooperative control carries over to search and rescue, environmental monitoring and inspection.
              </p>
            </div>
          </div>
          <div className="page-shell limitations">
            <h3>Known limitations</h3>
            <ul>
              {limitations.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </div>
        </section>

        <section className="citation-section section-block" id="citation">
          <div className="page-shell citation-layout">
            <div>
              <h2>Citation</h2>
              <p>A citation will be added here once the paper is available.</p>
              <p><a href={`${repoBase}/${packagePath}`}>Browse the source on GitHub ↗</a></p>
            </div>
            <pre><code>{"@misc{svg2026,\n  title  = {Strike vs Guard},\n  note   = {Citation coming soon}\n}"}</code></pre>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <div className="page-shell footer-grid">
          <div className="footer-brand">
            <img className="wordmark-mark" src={withBase("/static/images/svg-logo.svg")} alt="" width="34" height="34" />
            <div><strong>Strike vs Guard</strong><p>Collision-safe multi-drone ground control on AirStack.</p></div>
          </div>
          <div className="footer-contact">
            <p className="mini-label">Explore and reproduce</p>
            <a href={`${repoBase}/${packagePath}`}>svg_ground_control on GitHub ↗</a>
            <a href={withBase("/docs/")}>Documentation ↗</a>
          </div>
        </div>
        <div className="page-shell footer-base">
          <span>© 2026 AirLab, Carnegie Mellon University</span>
          <a href="https://creativecommons.org/licenses/by-sa/4.0/">CC BY-SA 4.0</a>
        </div>
      </footer>
    </>
  );
}

export default App;
