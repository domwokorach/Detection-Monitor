# Copyright and Attribution

> **Ownership is unconfirmed.** This document records what the repository shows and what still needs the project owner's confirmation. Placeholders in `<angle brackets>` must be completed by the owner. No copyright owner has been invented.

## Application name and attribution

| Item | Value |
|---|---|
| Application name | **Detection Monitor** |
| Earlier internal names | "Sentinel" (still visible in the Compose project name, API title and `package.json` names) |
| Copyright notice (to be completed) | `Copyright © <year> <copyright holder: requires confirmation>. All rights reserved.` |
| Repository owner shown in version control | A Git user is configured on the development machine, but this is **not** treated as a statement of legal ownership |
| Licence | None chosen: see [LICENSE.md](LICENSE.md) |

"Detection Monitor" is used here as a project name. No trade mark registration is claimed or has been checked.

## Original code and design

| Work | Ownership status |
|---|---|
| Back-end code (`backend/`) | Original project work. Holder `<to be confirmed>`. If AI coding assistance was used, confirm the owner's position under applicable law and the assistant provider's terms |
| Front-end code (`frontend/`, `frontend-vue/`) | Original project work, built on third-party libraries (below). Holder `<to be confirmed>` |
| Design system ([DESIGN.md](DESIGN.md)): palette, layout, copy | Original project work. Holder `<to be confirmed>` |
| Documentation (this set of Markdown files) | Original project work. Holder `<to be confirmed>` |
| Synthetic data (accounts, transactions, addresses, IPs) | Fictional, created for the demo. IP addresses use documentation ranges; company and person names are fictional, and any resemblance to real entities is coincidental |
| `uk-population-map/`, `uk-cities-inequality/` | Original scripts plus third-party data (see Data below) |

## Screenshots

`docs/images/dashboard-overview.png` and `docs/images/login-screen.png` are captures of the running Detection Monitor interface, supplied by the project owner and reproduced **unmodified**. They contain:

- the application's own interface (holder `<to be confirmed>`),
- simulated demo data, which does not describe real people or transactions,
- the sample user "Morgan Admin" / `admin@demo.local`, a fictional demo identity,
- map shapes derived from ONS boundary data, and
- the shield artwork described below.

They may be used to describe the project. Any other use requires the owner's permission.

## Logo artwork

The wordmark and the shield-and-padlock graphic (`frontend/public/images/detection-shield.png`, the favicon and `DetectionMonitorLogo` components) have **unconfirmed provenance**. The repository does not record whether the raster artwork was drawn by the owner, commissioned, sourced from a stock or icon library, or generated with an AI tool. Before any public release or licence decision, the owner must:

1. Identify the origin and licence of the artwork.
2. Keep proof of purchase or licence terms if third-party.
3. Replace the artwork if its rights cannot be established.

## Third-party dependencies and assets

Dependencies keep their own licences and copyright. The table lists the principal ones. Licence names are the commonly published ones and **must be verified** against each package's `package.json`/`LICENSE` at the pinned version before redistribution.

| Component | Role | Commonly published licence (verify) |
|---|---|---|
| FastAPI, SQLAlchemy, Pydantic, Uvicorn, httpx, PyJWT, redis-py | Back end | MIT / BSD-style |
| argon2-cffi | Password hashing | MIT |
| psycopg | PostgreSQL driver | LGPL-3.0 |
| PostgreSQL, Redis (Docker images) | Data stores | PostgreSQL licence; Redis 7 images are BSD-3-Clause (later Redis versions use different terms; check the tag you run) |
| React, Vue, Vite, TypeScript | Front end | MIT / Apache-2.0 |
| Tailwind CSS, shadcn/ui, Radix UI | Styling and components | MIT |
| Recharts, D3, topojson-client | Charts and maps | MIT / ISC / BSD-3-Clause |
| ECharts | Vue charts | Apache-2.0 |
| Motion / `motion-v` | Animation | MIT |
| MapLibre GL, `react-map-gl` | Map rendering | BSD-3-Clause / MIT |

### Fonts

**Geist Sans** and **Geist Mono**, by Vercel, distributed through Fontsource, are published under the **SIL Open Font Licence 1.1**. Keep the licence text with any redistributed font files.

### Icons

| Library | Licence (verify) | Note |
|---|---|---|
| Hugeicons (`@hugeicons/core-free-icons`) | Free-tier licence set by Hugeicons | Confirm the free package's terms permit your use; Pro icons are not included |
| Lucide | ISC | |

### Map data and provider attribution

The dedicated risk-map page displays a basemap from **OpenFreeMap** using **OpenMapTiles** vector tiles built from **OpenStreetMap** data. The attribution control must remain visible. The in-app text is:

> OpenFreeMap © OpenMapTiles. Data from © OpenStreetMap contributors.

OpenStreetMap data is available under the **Open Database Licence (ODbL)**; see openstreetmap.org/copyright. Check OpenFreeMap's current terms and acceptable-use limits before production traffic.

Boundary files and statistics in `public/data`, `uk-population-map/` and `uk-cities-inequality/` derive from ONS and Nomis sources published under the **Open Government Licence v3.0**. Required wording on the map: "Boundaries: ONS, Open Government Licence v3.0 · Contains OS data © Crown copyright". Keep that attribution wherever the boundaries are shown.

### Third-party merchant logos

Merchant logos are **not stored in this repository**. They are requested at runtime from Logo.dev using a publishable key, and only for counterparties an analyst has verified (the demo seeds names such as Amazon, Tesco, Spotify, Apple, Currys and Barclays). Observe the following:

- Merchant names, logos and trade marks belong to their owners. Their display is for identification only and implies **no** affiliation, sponsorship or endorsement.
- Logo.dev's free plan requires a visible "Logos provided by Logo.dev" attribution link in production.
- Showing a logo is not evidence that a merchant or payment is legitimate.
- The Barclays and other bank/brand names in the demo data are used only as fictional examples of counterparties.

### Other integrations

TrueLayer is used only through its public sandbox API; TrueLayer's name and marks belong to TrueLayer Limited. No endorsement is implied. The FCA and HM Government are **not** affiliated with this project and have not approved it.

## Reporting a copyright concern

If you believe the repository includes your work without permission, contact `<owner contact: requires configuration>` with details, and the material will be reviewed and removed or credited as appropriate.
