# RoboDSR Twin

Interactive 3D proposal demo for a living, site-specific healthcare digital twin.

The experience pairs a physical healthcare center with its synchronized digital
twin and demonstrates the Node → Zone → Site operational architecture, the
DSR/AutoDSL semantic bridge, and five connected healthcare missions.

## Local requirements

- Node.js 22.13 or newer
- npm 10 or newer
- A modern browser with WebGL enabled

## Run locally

```bash
npm install
npm run dev
```

Open the local address printed in the terminal, normally
`http://localhost:3000`.

## Production build

```bash
npm run build
npm run start
```

## Main project files

- `app/twin-experience.tsx` — Three.js site model, interactions, missions, and
  Node/Zone/Site visualization
- `app/globals.css` — complete interface and responsive styling
- `app/page.tsx` — main route
- `app/layout.tsx` — page metadata and social preview setup
- `public/og.png` — share-preview image

## Demo interactions

- Drag either 3D site to orbit the synchronized camera.
- Scroll to zoom.
- Select rooms, robots, assets, doors, and corridors to inspect their state.
- Switch between Physical, Twin, and Split views.
- Select Node, Zone, or Site to reveal each operational layer.
- Run any of the five missions through Sense → Interpret → Decide → Act →
  Verify.

All performance figures shown in the demo are explicitly presented as
projected demonstration values, not validated deployment results.
