"""Split the SVG ground-control docs from AirStack into site pages.

Usage: python3 scripts/sync-docs.py [path/to/AirStack]   (default: ../AirStack)

Each page is a line range of a source markdown file. If the AirStack docs are
edited, check that the ranges in PAGES still start and end on the right sections. Headings are re-levelled
under a new page title, links to other source sections are rewritten to the
page that now holds them, and links to repository files become GitHub URLs.
"""
import os
import re
import shutil
import sys
import unicodedata

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
AIRSTACK = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, "..", "AirStack"))
DOCS = os.path.join(ROOT, "docs")
BRANCH_URL = "https://github.com/castacks/AirStack"
BRANCH = "yikuan/SVG_ground_control"
PKG = "robot/ros_ws/src/svg_ground_control"

SOURCES = {
    "E": f"{PKG}/experiment.md",
    "R": f"{PKG}/README.md",
    "T": f"{PKG}/teleop.md",
    "B": f"{PKG}/foxglove/svg-basestation/README.md",
    "G": "docs/gcs/foxglove.md",
}

# page path, title, [(source, first line, last line)], optional intro paragraph
PAGES = [
    ("getting-started/airstack.md", "How AirStack is structured", [("E", 25, 61)], None),
    ("getting-started/architecture.md", "How SVG ground control is structured", [("R", 11, 33), ("E", 65, 126)], None),
    ("getting-started/conventions.md", "Conventions", [("E", 154, 181)], None),
    ("getting-started/simulation.md", "Simulation quick start", [("E", 185, 357)], None),
    ("hardware/index.md", "Bring in a real drone", [("E", 360, 426)], None),
    ("hardware/voxl-setup.md", "Per-drone one-time setup", [("E", 427, 511)], None),
    ("hardware/leds.md", "Onboard LED strip", [("E", 512, 556)], None),
    ("hardware/agent-and-interfaces.md", "Agent, interfaces and mocap", [("E", 557, 621)], None),
    ("hardware/external-vision.md", "External vision into EKF2", [("E", 622, 703)], None),
    ("hardware/first-flight.md", "Preflight and first flight", [("E", 704, 722), ("E", 1207, 1233)], None),
    ("hardware/voxl-diagnostics.md", "VOXL2 diagnostics", [("E", 723, 772)], None),
    ("experiments/index.md", "Tasks: any drone in any mode", [("E", 774, 821)], None),
    ("experiments/single-goal.md", "C1 · Single-drone goal", [("E", 823, 975)], None),
    ("experiments/multi-goal.md", "C2 · Multi-drone goals", [("E", 976, 1071)], None),
    ("experiments/squeeze-sim.md", "C3 · Squeeze rehearsal", [("E", 1072, 1095)], None),
    ("experiments/hybrid-squeeze.md", "C4 · Hybrid squeeze", [("E", 1096, 1137)], None),
    ("experiments/hand-flown-intruder.md", "C5 · Hand-flown intruder", [("E", 1138, 1204)], None),
    ("teleop/index.md", "Gamepad teleop", [("T", 3, 463)], None),
    ("safety/index.md", "CBF filter and safety", [("R", 298, 329)], None),
    ("safety/geofence.md", "Geofence", [("E", 1392, 1498)], None),
    ("ground-station/foxglove.md", "Foxglove setup", [("E", 1280, 1389)], None),
    ("ground-station/basestation.md", "SVG Basestation panel", [("B", 3, 283)], None),
    ("ground-station/rviz.md", "RViz", [("E", 1236, 1277)], None),
    ("ground-station/gcs-panels.md", "AirStack GCS panels", [("G", 3, 169)],
     "These are the general AirStack Ground Control Station panels that the SVG Basestation sits beside. "
     "Links into the rest of the AirStack documentation open on GitHub."),
    ("reference/scenarios.md", "Scenarios", [("R", 35, 71)], None),
    ("reference/commander.md", "Commander features", [("R", 73, 140)], None),
    ("reference/topics.md", "Topics and services", [("E", 130, 151)], None),
    ("reference/recording.md", "Recording rosbags", [("E", 1501, 1519)], None),
    ("reference/tests.md", "Automated tests", [("E", 1522, 1544)], None),
    ("reference/update-2026-09-27.md", "Update 2026-09-27", [("R", 142, 296)], None),
    ("help/troubleshooting.md", "Troubleshooting", [("E", 1547, 1597)], None),
]

# Pages whose first source heading is a real section, not a duplicate of the page title.
KEEP_FIRST = {"hardware/first-flight.md", "hardware/agent-and-interfaces.md"}


def dropped_heading(page, ranges):
    """The (source, line) of a leading heading that the page title replaces, if any."""
    key, start, _ = ranges[0]
    if page in KEEP_FIRST:
        return None
    first = source_lines_cache(key)[start - 1]
    return (key, start) if HEADING.match(first) else None


# Where a link to a whole source file (no anchor) should land.
FILE_LANDING = {
    "E": "getting-started/simulation.md",
    "R": "reference/commander.md",
    "T": "teleop/index.md",
    "B": "ground-station/basestation.md",
    "G": "ground-station/gcs-panels.md",
}

FENCE = re.compile(r"^\s*(```|~~~)")
HEADING = re.compile(r"^(#{1,6})\s+(.*?)\s*#*\s*$")
LINK = re.compile(r"(!?)\[((?:[^\[\]]|\[[^\]]*\])*)\]\(([^)\s]+)\)")


def read_lines(key):
    with open(os.path.join(AIRSTACK, SOURCES[key])) as f:
        return f.read().split("\n")


def plain(text):
    text = re.sub(r"`([^`]*)`", r"\1", text)
    text = re.sub(r"\[([^\]]*)\]\([^)]*\)", r"\1", text)
    return text.replace("*", "")


def github_slug(text):
    text = plain(text).strip().lower()
    text = re.sub(r"[^\w\- ]", "", text)
    return text.replace(" ", "-")


def toc_slug(text):
    text = unicodedata.normalize("NFKD", plain(text)).encode("ascii", "ignore").decode()
    text = re.sub(r"[^\w\s-]", "", text).strip().lower()
    return re.sub(r"[-\s]+", "-", text)


def headings(lines):
    out, in_fence = [], False
    for i, line in enumerate(lines, 1):
        if FENCE.match(line):
            in_fence = not in_fence
            continue
        m = None if in_fence else HEADING.match(line)
        if m:
            out.append((i, len(m.group(1)), m.group(2)))
    return out


source_lines = {k: read_lines(k) for k in SOURCES}


def source_lines_cache(key):
    return source_lines[key]


# (source key, github slug) -> (page, toc slug)
anchor_map = {}
for page, _title, ranges, _intro in PAGES:
    drop = dropped_heading(page, ranges)
    for key, start, end in ranges:
        for line, _level, text in headings(source_lines[key]):
            if start <= line <= end:
                slug = None if drop == (key, line) else toc_slug(text)
                anchor_map.setdefault((key, github_slug(text)), (page, slug))

source_by_path = {path: key for key, path in SOURCES.items()}
missing = []


def rel(from_page, to_page):
    return os.path.relpath(to_page, os.path.dirname(from_page) or ".")


# Links that point at a section or path that does not exist in the source.
LINK_FIXES = {
    ("T", "#experiments"): "#what-to-check",
}


def rewrite_link(page, key, target):
    if re.match(r"^[a-z]+:", target):
        return target
    target = LINK_FIXES.get((key, target), target)
    path, _, anchor = target.partition("#")
    src_dir = os.path.dirname(SOURCES[key])
    if path:
        repo_path = os.path.normpath(os.path.join(src_dir, path))
        if not os.path.exists(os.path.join(AIRSTACK, repo_path)) and path.startswith("../"):
            # experiment.md reaches sibling packages with one "../" too many.
            alt = os.path.normpath(os.path.join(src_dir, path[3:]))
            if os.path.exists(os.path.join(AIRSTACK, alt)):
                repo_path = alt
        target_key = source_by_path.get(repo_path)
    else:
        repo_path, target_key = SOURCES[key], key
    if target_key:
        if anchor and (target_key, anchor) in anchor_map:
            to_page, slug = anchor_map[(target_key, anchor)]
            if slug is None:
                return rel(page, to_page)
            return f"{rel(page, to_page)}#{slug}" if to_page != page else f"#{slug}"
        if anchor:
            missing.append((page, target))
        return rel(page, FILE_LANDING[target_key])
    full = os.path.join(AIRSTACK, repo_path)
    if os.path.isfile(full) and repo_path.lower().endswith((".png", ".jpg", ".jpeg", ".gif", ".svg")):
        asset = f"assets/{os.path.basename(repo_path)}"
        shutil.copyfile(full, os.path.join(DOCS, asset))
        return rel(page, asset)
    kind = "tree" if os.path.isdir(full) else "blob"
    if not os.path.exists(full):
        missing.append((page, target))
    url = f"{BRANCH_URL}/{kind}/{BRANCH}/{repo_path}"
    return f"{url}#{anchor}" if anchor else url


def convert_chunk(page, key, start, end, drop):
    if drop == (key, start):
        start += 1
    lines = source_lines[key][start - 1:end]
    levels = [lvl for line, lvl, _ in headings(source_lines[key]) if start <= line <= end]
    shift = (min(levels) - 2) if levels else 0
    out, in_fence = [], False
    for line in lines:
        if FENCE.match(line):
            in_fence = not in_fence
            out.append(line)
            continue
        if in_fence:
            out.append(line)
            continue
        m = HEADING.match(line)
        if m:
            level = max(2, min(6, len(m.group(1)) - shift))
            line = "#" * level + " " + m.group(2)
        line = LINK.sub(lambda mm: f"{mm.group(1)}[{mm.group(2)}]({rewrite_link(page, key, mm.group(3))})", line)
        out.append(line)
    while out and out[-1].strip() in ("", "---"):
        out.pop()
    while out and out[0].strip() in ("", "---"):
        out.pop(0)
    return out


def main():
    os.makedirs(os.path.join(DOCS, "assets"), exist_ok=True)
    for page, title, ranges, intro in PAGES:
        body = [f"# {title}", ""]
        if intro:
            body += [intro, ""]
        sources = sorted({SOURCES[k] for k, _, _ in ranges})
        drop = dropped_heading(page, ranges)
        for key, start, end in ranges:
            body += convert_chunk(page, key, start, end, drop) + [""]
        body += [
            "---",
            "",
            "Source: " + ", ".join(f"[`{s}`]({BRANCH_URL}/blob/{BRANCH}/{s})" for s in sources)
            + f" on the `{BRANCH}` branch of AirStack.",
            "",
        ]
        dest = os.path.join(DOCS, page)
        os.makedirs(os.path.dirname(dest), exist_ok=True)
        with open(dest, "w") as f:
            f.write("\n".join(body))
        print(f"wrote {page}")
    for page, target in missing:
        print(f"unresolved link on {page}: {target}", file=sys.stderr)


main()
