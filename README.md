# Webpage — React port

A Vite + React + React Router rewrite of the original multi-page vanilla-JS
site. Every page has been ported — routing, the navbar (hover dropdowns +
mobile toggle), dark mode, the modal system, and all 14 pages are real React
components now. `legacy/` only holds `help.txt` for reference; every HTML/JS/CSS
source file has been folded into `src/` and removed once its page was done.

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
  pages/        All 14 routed pages (see below)
  lib/          Pure logic extracted out of each page: subnet math, code search,
                markdown rendering, the document-viewer engine, the animation
                physics engine, navigator search providers, urltable parsing +
                V1 compressor + WASM loader
  styles/       Original per-page CSS files, copied as-is (global class names,
                not CSS modules — matches how the original CSS was written)
  json/         data.json (Code page), gameObjects.json (Animation page)
public/
  assets/       Original images (dice faces, icons, favicon, etc.)
  resources/    PLACEHOLDER — original resources/ folder was stripped from the
                upload for size; drop the real contents back in here. Needed by
                the Video page's demo-file button.
  wasm/         PLACEHOLDER — same story. Needed by the URL Table page's
                compress/decompress (window.compress/window.decompress via
                /wasm/wasm.js + /wasm/compressor/migrate.js). Until restored,
                UrlTable's save/load-with-compression will fail exactly like
                the original would with those files missing — this is
                intentional, not a bug to work around.
legacy/         Just help.txt now; everything else has been ported.
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
| `/markdown` | Hand-rolled markdown renderer + live preview |
| `/video` | Custom `<video>` player UI |
| `/document` | Universal document viewer (PDF/DOCX/XLSX/CSV/RTF/ODF/...) |
| `/navigator` | Mini-browser: iframe rendering, search aggregator |
| `/animation` | Canvas physics sandbox (gravity, collisions, drag) |
| `/urltable` | URL list manager with groups/search/WASM compression |
| `/test3d` | Canvas 2D wireframe cube + WASD/mouse fly-around |

## Notes

- Dark mode uses [DarkReader](https://github.com/darkreader/darkreader) from a
  CDN `<script>` in `index.html`, exactly like the original —
  `useDarkMode()` just wraps `window.DarkReader.enable()/disable()`.
- A few pages load their own CDN dependencies the same way the originals did:
  Prism.js + line-numbers plugin (Code), JSZip + pdf.js eagerly plus
  PapaParse/RTF.js/WebODF/marked/SheetJS/a legacy .doc parser lazily
  (Document).
- Several pages had their non-React logic (physics engines, parsers,
  renderers, search helpers) extracted into `src/lib/` as plain, framework-agnostic
  modules rather than force-fit into JSX — see the comment at the top of each
  file in `src/lib/` for why.
