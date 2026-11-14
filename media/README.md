# Marketplace assets

- `icon.svg`: editable, flat vector artwork retaining the original C, gentle green/blue/warm gradient, and two restrained diagonal stripes.
- `icon.png`: transparent 256×256 Marketplace icon, rendered from the SVG.
- `showcase.gif`: a looping 21.6-second tour of the real extension, 1200×800 pixels. Captions sit outside the captured UI. No packet list, protocol tree, or filter results are mocked.
- `showcase.png`: a still alternative showing protocol-field and byte selection.

The tour uses only [the synthetic sample capture](../samples/README.md). Its scenes cover packet browsing, autocomplete, applying a filter, field/byte synchronization, tree context menus, history, captured-value suggestions, and the HTTP 418 response.

## Regeneration

```sh
npm run demo:capture
npm run compile
npm run demo:record
```

The recorder uses Playwright to launch VS Code with a fresh profile under `out/`, opens the demo, performs real UI actions, and encodes the resulting screenshots with `gifenc`. Wireshark must be installed. Set `SHARKD_PATH` if automatic discovery is insufficient. Set `VSCODE_EXECUTABLE_PATH` to the VS Code executable; on Windows the standard per-user installation is detected automatically. Native VS Code selectors and timing may need adjusting for future VS Code versions.

Encoding uses installed Edge on Windows or Playwright Chromium elsewhere; install Chromium with `npx playwright install chromium` if necessary. `CRUMBS_BROWSER` can select another installed Playwright browser channel. Raw frames and their caption/duration manifest remain in the ignored `out/showcase-*/frames` directory. Only the recorder's own VS Code process is closed.

To re-render the icon alone:

```sh
npm run demo:media
```

To re-encode existing frames after changing captions or timing:

```sh
npm run demo:media -- out/showcase-EXAMPLE/frames/manifest.json
```

Frames are 1200×742 PNG screenshots. Each manifest entry has `file` (relative to the manifest), `caption`, and `delay` (milliseconds); `still: true` chooses the static screenshot. The encoder appends a 58px caption strip and shares a palette across scenes to avoid color flicker.

## Icon design notes

The original icon supplied by Lukas Schneider was the reference. Initial concepts used the built-in image-generation tool, followed by a clean SVG reconstruction so the shipped icon has exact curves and no raster edge artifacts. The shipped PNG is generated from that SVG, not from a model-generated bitmap.

Concept prompt:

> Final production icon for Crumbs, a VS Code packet capture explorer. Keep the original recognizable geometric C silhouette facing right and gentle green / cyan-blue / warm amber-coral color direction. Modernize it to match restrained, clean interface icons: a balanced C made of a smooth, moderately thick open circular ribbon, precise clean edges, flat vector-like appearance, and a soft muted gradient. Preserve a small echo of the diagonal stripes as two narrow translucent interruptions near the lower-right arm. Reduce visual complexity substantially. Transparent counter and opening; single centered symbol with about 10% padding. No lettering, background tile, extra symbols, shadows, glow, bevels, 3D, or texture.

Refinement prompt:

> Keep the C silhouette, soft gradient, ribbon appearance, and diagonal stripe detail. Replace ragged edges with smooth, mathematically circular contours. Remove stray particles and pixel noise around both curves. Use matching diagonal arm endings, a transparent counter and background, and no texture or extra shapes.
