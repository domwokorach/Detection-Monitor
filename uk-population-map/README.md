# UK Population Bubble Map (mid-2016)

Interactive D3.js bubble map of the estimated population of every UK local authority (England, Scotland, Wales, Northern Ireland).

## Run
Browsers block `fetch` of local files, so serve the folder:
```bash
cd uk-population-map && python3 -m http.server 8000   # open http://localhost:8000
```
D3 v7.9.0 and topojson-client 3.1.0 load from jsDelivr (pinned versions).

## Data
| What | Source |
|---|---|
| Boundaries | [ONSdigital/uk-topojson](https://github.com/ONSdigital/uk-topojson) `output/topo.json` (copied unchanged to `data/topo.json`). Layer `ltla`; areas are kept when `start ≤ 2016 ≤ end`. Join key: `areacd` (GSS code). The `ctry` layer draws the nation outlines. |
| Population | ONS *Population Estimates for UK, England and Wales, Scotland and Northern Ireland: mid-2016*, sheet **MYE5** (`data/source/ukmidyearestimates2016.xls`, Open Government Licence v3.0). |
| Extraction | `scripts/build_population_data.py` writes `data/population-2016.json`. Figures are copied as published. |

**Coverage:** 391 of 391 boundaries valid in 2016 match a population record (E: 326, S: 32, W: 22, NI: 11); the figures sum to the ONS UK total, 65,648,054. Nothing is estimated or filled. If a future data swap leaves an area unmatched, it is drawn hatched and listed in the "Data & coverage" panel.

Notes: Northern Ireland uses the 11 districts introduced in 2015 (`N09` codes). Areas are drawn from 2016 boundaries; later mergers (e.g. Dorset, Somerset) are not applied.

## Code
- `src/ukBubbleMap.js`: reusable `createUKBubbleMap(el, { topology, population, year })`. Uses `d3.geoMercator()`, `d3.geoPath()` and `d3.scaleSqrt()` (radius ∝ √population, so area ∝ population). Bubbles sit at the centroid of each authority's largest polygon.
- `src/main.js`: page wiring (nation filter, search combobox, legend, ranked list, data-coverage panel).

## Behaviour
Zoom with wheel, pinch, drag or the buttons. Bubbles grow at √zoom so dense areas separate as you zoom (the legend follows). Nation chips dim other nations and zoom to the selection. Search and the "Largest" list are the keyboard route to any bubble. Animations respect `prefers-reduced-motion`.
