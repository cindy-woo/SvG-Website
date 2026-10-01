# Media placeholders

The homepage shows a "media planned" card wherever a file is missing. To add media:

1. Drop the file into the right folder:
   - `videos/` — MP4 clips (H.264). Put a poster frame beside each one as a `.jpg` with the
     same name (`squeeze.mp4` + `squeeze.jpg`).
   - `photos/` — JPG/PNG photos of the drones, the mocap room and the team.
   - `figures/` — diagrams, plots and screenshots (PNG or SVG).
2. Open `src/data/media.ts` and set the `src` of the matching entry to the file's path,
   for example `"/static/media/videos/squeeze.mp4"`.

Every slot the site expects is listed in `src/data/media.ts`, with its suggested
file name in the `suggested` field.
