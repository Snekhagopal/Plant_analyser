# PlantVision AI — web frontend

Next.js (App Router) + TypeScript + Tailwind CSS frontend for the plant-health API in `../api`.
All analysis results, scores, recommendations and reference data come from the FastAPI backend;
the frontend never computes or invents a result.

## Run

```bash
# 1. API (from the project root, in the Python environment)
uvicorn api.main:app --port 8000

# 2. Frontend
cd web
npm install
npm run dev            # http://localhost:3000
```

The browser calls the API directly at `NEXT_PUBLIC_API_BASE` (default `http://localhost:8000`).
The API allows `http://localhost:3000` via CORS; set `PLANT_API_CORS_ORIGINS` on the API for other origins.

## Checks

```bash
npm run lint
npm run typecheck      # regenerates route types, then tsc
npm run build
PYTHON=~/plant-health-env/bin/python npm run check:api   # frontend types == FastAPI schema
PYTHON=~/plant-health-env/bin/python npm run gen:api     # regenerate after changing api/schemas.py
```

## End-to-end tests (Playwright)

```bash
PYTHON=~/plant-health-env/bin/python npm run test:e2e        # everything (~2 min)
PYTHON=~/plant-health-env/bin/python npm run test:e2e:fast   # skip the real-model project
npx playwright show-report                                    # HTML report of the last run
```

Playwright starts its own servers, all with **temporary history databases** (the real `data/history.db`
is never touched), and uses the installed Google Chrome (`PW_CHANNEL=""` for Playwright's Chromium):

| Port | Server | Used by |
|---|---|---|
| 3100 | separate production build of this app (`.next-e2e`) with a dead API base; tests reroute API calls | all |
| 8101 | `e2e/servers/scripted_api.py`: the real FastAPI pipeline with **scripted classifier scores**, so every result type is reproducible | `desktop`, `mobile` |
| 8102 | `e2e/servers/real_api.py`: the real API with the real MobileNetV2, CLIP and Grad-CAM | `real-model` |

Projects: `desktop` (1536 px, all UI tests), `mobile` (390 px, layout tests) and `real-model` (real inference;
`E2E_REAL=0` skips it). Scripted tests validate the UI and the backend's decision rules, never model accuracy.

## Pages

| Route | Data |
|---|---|
| `/` Analyze | `POST /api/analyze`, `GET /api/meta`, `GET /api/plants/{name}` |
| `/history` | `GET/DELETE /api/history`, `/api/history/{id}` |
| `/plant-guide?name=` | `GET /api/meta`, `GET /api/plants/{name}` |
| `/disease-library` | `GET /api/conditions` |
| `/care-tips` | `GET /api/care-groups` |
| `/about` | `GET /api/about`, `GET /api/health` |

## Assets

- **Hero photo:** not added yet. The hero uses a CSS gradient; put the generated image in `public/` and set
  `HERO_IMAGE` in `src/lib/brand.ts`.
- **Sample leaves** (`public/samples/`): eight PlantVillage *test-split* images (not used in training), chosen by a
  fixed random draw, from the Hugging Face mirror `geraldmc/plantvillage-full` (declared CC0-1.0). Each is shown with
  its dataset label; choosing one only fills in the form.
