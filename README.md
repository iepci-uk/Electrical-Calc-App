# IEPCI Calc

Mobile app for electrical short-circuit design, converted from two Excel workbooks:

| Screen | Source workbook | Method |
|---|---|---|
| **Network** | `Short Circuit Calculations.xls` (Impedance Analyses Method + Bus-way S.C.) | Impedance method, any number of fault points, transformer + generator sources, motor contribution |
| **IEC Quick** | `Short-Circuit Calculations USED.xls` (sheet IEC) | IEC 60909 simplified method: transformers + generators + motors |
| **Tools** | - | Transformer FLC and max fault, cable thermal withstand (adiabatic), voltage drop, breaker Icu/Icm selection |
| **Projects** | - | Save on phone, duplicate, share/import project file, print/PDF report, CSV export |

It is a **Progressive Web App (PWA)**: plain HTML, CSS and JavaScript. No framework, no build step. Works in any phone browser, installs to the home screen and works offline.

## Run it in VS Code

1. Open the folder that contains `index.html` (File → Open Folder).
2. Install the **Live Server** extension → right-click `index.html` → **Open with Live Server**.
3. Or with Node.js installed: `npm test` then `npx serve .`

Do not double-click `index.html`. The code uses JavaScript modules, which only run through a server.

## Folder structure

```
index.html              App shell (header, screen area, bottom tabs)
css/style.css           Look and feel, dark mode, print report layout
js/config.js            Brand name and colours (white-label here)
js/app.js               Tabs, saving, button wiring. No formulas.
js/store.js             Saves projects on the device + example project
js/core/                ALL THE MATHS (no screen code)
  constants.js            Cable presets, k factors, breaker ratings, sheet defaults
  iecQuick.js             IEC 60909 simplified method
  impedance.js            Impedance method network solver + motors
  tools.js                FLC, adiabatic check, voltage drop
js/ui/                  SCREENS (no formulas)
  networkView.js  quickView.js  toolsView.js  projectsView.js
  report.js               Printable report
  dom.js                  Small shared helpers
tests/excel.test.mjs    Proves results match the Excel sheets
sw.js                   Offline support
.github/workflows/      Auto test + deploy to GitHub Pages
```

Rule: **formulas only in `js/core/`, screen code only in `js/ui/`.**

## How the Network screen works

1. **Sources**: utility + main transformer, and/or N generator sets in parallel (each with its own cable).
2. **Transformer branch / Generator branch**: elements only on that side (e.g. transformer cables, synch. panel).
3. **Common distribution path**: breakers, busbars, bus-ways, cables, tap-offs, LV/LV transformers, in order.
4. **📍 Fault points**: add one wherever you need a fault level. Each point can have a motor group.
5. **Calculate**: for each point you get Isc and peak from each source, the design value (worst case), motor contribution, suggested breaker Icu/Icm and the full working.

The example project reproduces the design sheet.

## Tests (must pass before every release)

`npm test` checks the app against these Excel cells:

- IEC sheet B10 = 4.9079 kA
- Fault A: B60, B62 (transformer), B69, B71 (generator)
- Fault B: B83, K83, B98, K98
- Bus-way sheet floor 1: B28 = 17.127 kA, K28 = 35.540 kA
- HVAC motors: H480 = 6.5605 kA
- Tools: hand-checked values

GitHub runs these automatically. If one fails, the app is not published.

## Publish (GitHub Pages)

1. Push to the `main` branch.
2. GitHub → Settings → Pages → Source: **GitHub Actions**.
3. App address: `https://<username>.github.io/<repo-name>/`
4. Phone: open the link → browser menu → **Install app / Add to Home screen**.

## Releasing an update

1. Make the change. 2. `npm test` passes. 3. Bump `CACHE_VERSION` in `sw.js`. 4. If you added a JS file, add it to `FILES` in `sw.js`. 5. Push to `main`.

## Adding a new calculation (future formula sheets)

1. Maths: new file in `js/core/` with `DEFAULTS` + `calculate()`.
2. Test: take 2-3 answers from the Excel sheet into `tests/`.
3. Screen: new file in `js/ui/` (copy `quickView.js`), add it to `VIEWS` in `js/app.js` and a tab in `index.html`.

## Play Store APK (optional, later)

Wrap the same code with Capacitor in Android Studio:

```bash
npm install @capacitor/core @capacitor/cli @capacitor/android
npx cap init "IEPCI Calc" com.iepci.calc --web-dir www
npx cap add android
npx cap open android
```

Copy the web files (index.html, css, js, icons, manifest, sw.js) into `www/` first.

## White-label

Change `js/config.js`, the icons in `icons/`, and `name`/`theme_color` in `manifest.webmanifest`.

## Differences from the Excel sheets (on purpose)

- **Motor peak current**: the sheet uses √2 × (R/X) × Im. The app uses √2 × k × Im, which is the correct formula (about 10% higher).
- **IEC sheet**: the sheet types 1.1 into each formula and ignores the c cell. The app uses the c input. Motor efficiency η was added (default 1 = same as sheet).
- **LV/LV transformer (220 V power bus-ways)**: the sheet uses the 400 V impedances with 220 V. The app refers upstream impedance through the transformer ratio and adds the transformer's own impedance.
- **Fault G (sheet row 459)**: the temperature factor points to empty cells, so it is not applied. The app always applies it.

Sheet assumptions kept as settings (Network → Calculation settings): transformer X = Z, R = 0.2X; network X = 0.98Zn, R = 0.2Zn; temperature factor applied to X as well as R.
