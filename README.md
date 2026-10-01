# Strike vs Guard Website

The homepage and documentation for Strike vs Guard (SVG), the multi-drone ground controller in the
`svg_ground_control` package of [AirStack](https://github.com/castacks/AirStack/tree/yikuan/SVG_ground_control/robot/ros_ws/src/svg_ground_control).
The layout follows the [AM-Bench website](https://ambench.github.io/): a React/TypeScript homepage built with
Vite, and a `docs/` section built with Zensical and served at `/docs/`.

Every push to `main` deploys the site to https://cindy-woo.github.io/SvG-Website/ through
`.github/workflows/deploy.yml`. The workflow derives the site path from the repository name (`/SvG-Website/` here, `/` for a repo named `<owner>.github.io`), so the same code deploys from a renamed or copied repository; `base` in `vite.config.ts` only sets the local default.
In code, build site paths with `withBase()` from `src/data/media.ts` rather than writing `/static/...` directly.

## Run the homepage

```bash
npm ci
npm run dev            # http://localhost:5173/SvG-Website/, homepage only
npm run verify:build   # typecheck, build and check the page-size budgets
```

## Preview everything, docs included

```bash
npm run build
uv tool run --python 3.11 --from "zensical==0.0.58" zensical build --strict   # or: pip install "zensical==0.0.58"
rm -rf dist/docs && mv site dist/docs
npm run preview        # http://localhost:4173/SvG-Website/ and http://localhost:4173/SvG-Website/docs/
```

The dev server serves only the homepage, so use the full preview to check the docs and the links between the two.

## Add photos, videos and figures

Every media slot on the homepage shows a "planned" card until a file is added.

1. Put the file in `public/static/media/videos/`, `photos/` or `figures/`. For a video, add a poster `.jpg`
   with the same name next to it.
2. In `src/data/media.ts`, set that slot's `src`, for example `"/static/media/videos/c4-hybrid-squeeze.mp4"`.
   Each slot's `suggested` field gives the file name it expects. For a flight recording, use `recording()`:
   it takes the file name, a caption shown under the clip, and a framing. The recordings are three panes
   side by side (panel, 3D view, camera); `"camera"` (the default) crops a card to the camera pane and
   `"full"` shows all three.

The raw clips and photos can be kept in `media/` (ignored by git). Copy a clip in with
`ffmpeg -i media/<clip>.mp4 -c:v copy -an -movflags +faststart public/static/media/videos/<name>.mp4`.

## Edit the content

- `src/data/project.ts`: the text, numbers, scenarios, experiments and findings shown on the homepage.
  `authors` is empty and the author row is hidden until you fill it in.
- `src/data/media.ts`: media slots and the hero buttons. Paper and Video show "coming soon" until they get an `href`.
- `src/App.tsx`: page structure. `src/styles.css`: the template's styles, with the SVG components at the end.

## Docs

Everything in `docs/` except `index.md` is generated from the SVG docs in AirStack: `experiment.md`, `README.md`,
`teleop.md`, the Basestation README and `docs/gcs/foxglove.md`. To pull in edits, run:

```bash
python3 scripts/sync-docs.py ../AirStack
```

Each page is a line range of a source file, listed in `PAGES` at the top of the script. If the source files gain
or lose sections, update those ranges and rebuild with `--strict`. Links to sections move to the page that now
holds them. Links to other repository files open on GitHub.
