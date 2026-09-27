# Webpage — React port

A Vite + React + React Router multi-page website. Every page has routing, the navbar,
dark mode, the modal system, and all 14 pages are real React
components now.

## Running it

```bash
npm install
npm run dev
```

Build for production:

```bash
npm run build
npm run preview
```

## Structure

```
src/
  components/   Navbar, Footer, Modal, Layout (shared shell), DataList, CodeBlock
  context/      ModalContext (replaces global ModalOpen/ModalClose)
  hooks/        useDarkMode (DarkReader wrapper), usePersistedState (localStorage)
  pages/        All routed pages
  lib/          Pure logic extracted out of each page: math, search, rendering, physics, parsing, WASM loader
  styles/       Per-page CSS files, (global class names, not CSS modules)
  json/         json data
public/
  assets/       images, and like
  resources/    resources (bigger than asset files)
  wasm/         wasm code
```

## Pages

| Route | Notes |
|---|---|
| `/` | Home — dice cube + polygon animations |
| `/dice` | Canvas 3D dice roller |
| `/weather` | wttr.in lookup |
| `/extra`, `/links` | Simple content lists (share `DataList` component) |
| `/subnet` | IPv4 subnet / VLSM calculator |
| `/code` | Prism.js snippet browser with search |
| `/video` | Custom `<video>` player UI |
| `/document` | Universal document viewer (PDF/DOCX/XLSX/CSV/RTF/ODF/Markdown/...), with a live edit/preview split for text-based formats |
| `/navigator` | Mini-browser: iframe rendering, search aggregator |
| `/animation` | Canvas physics sandbox (gravity, collisions, drag) |
| `/urltable` | URL list manager with groups/search/WASM compression |
| `/test3d` | Canvas 2D wireframe cube + WASD/mouse fly-around |

## Notes

- Dark mode uses [DarkReader](https://github.com/darkreader/darkreader) from a
  CDN `<script>` in `index.html`, `useDarkMode()` just wraps `window.DarkReader.enable()/disable()`.
- A few pages load their own CDN dependencies the same way:
  Prism.js + line-numbers plugin, JSZip + pdf.js eagerly plus
  PapaParse/RTF.js/WebODF/marked/SheetJS/.doc parser lazily.

