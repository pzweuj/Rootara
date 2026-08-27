<div align="center">
  <img src="public/rootara_logo_rmbg_small.svg" alt="Rootara Logo" width="300">
  <h1>Rootara - Self-hosted Genomics Platform</h1>
  <p><strong>English</strong> | <a href="README_ZH.md">中文</a></p>
</div>

Rootara is a self-hosted platform for importing and exploring personal genetic data. All analysis runs locally in a single all-in-one container; the browser-facing Next.js application supervises a private FastAPI analysis service. The frontend remains at the repository root and the backend source is under `backend/`.

> **Testing status:** genetic trait results are currently test data and must not be used for medical, health, or other important decisions.

The v1 catalog ships exactly 150 reviewed relative-tendency cards backed by 153
verified variant loci. Each card exposes its evidence grade, source links,
population scope, and limitations; none is a diagnosis or treatment
recommendation. The release supports `linux/amd64`.

The runtime has no Redis dependency. The private FastAPI service listens on
`127.0.0.1:8000` inside the container, while only the Next.js port is exposed.

## Quick start

Docker 20+ and Docker Compose v2+ are required.

```bash
git clone https://github.com/pzweuj/Rootara.git
cd Rootara
export ADMIN_PASSWORD='replace-with-a-long-random-password'
docker compose up -d
```

Open <http://localhost:3000>. `ADMIN_EMAIL` defaults to `admin@rootara.app` and can be overridden before starting the container.

For a reproducible local setup, copy `.env.example` to `.env`, replace
`ADMIN_PASSWORD`, and run the same Compose command. Do not commit `.env` or
reuse the example password.

The published image is also usable without a checkout:

```bash
docker run -d --name rootara \
  -p 3000:3000 \
  -v rootara_data:/data \
  -e ADMIN_PASSWORD='replace-with-a-long-random-password' \
  ghcr.io/pzweuj/rootara:latest
```

## Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `ADMIN_PASSWORD` | required | Administrator password; startup fails when absent |
| `ADMIN_EMAIL` | `admin@rootara.app` | Administrator email |
| `ROOTARA_PORT` | `3000` | Host port in `compose.yaml` |
| `TZ` | `Asia/Shanghai` | Container timezone |
| `CACHE_TTL` | `3600` | In-memory cache TTL in seconds |
| `CACHE_MAX_ENTRIES` | `1024` | Maximum in-memory cache entries |

The release image also enforces `ROOTARA_EXPECTED_TRAIT_COUNT=150` and
`ROOTARA_REQUIRE_CURATED_CATALOG=1`; startup is rejected if the shipped
catalog is incomplete or contains an audit-blocked rule.

JWT signing material is generated on first startup and stored in `/data/config/jwt-secret`. The SQLite database and uploaded raw data are stored under `/data`; keep this volume for backups and upgrades.

FastAPI listens only on `127.0.0.1:8000` inside the container. Only port 3000 is public. The public health endpoints are:

- `GET /health/live`
- `GET /health/ready`
- `GET /health`

The trait page loads its lightweight catalog and report results separately. The
corresponding authenticated endpoints are `GET /api/traits/catalog`,
`GET /api/reports/{reportId}/traits/results`, and
`GET /api/traits/{traitId}?report_id=...`. Missing genotypes are reported as
`insufficient_data` with the missing RSIDs; they are never imputed.

## Data, backups, and upgrades

Keep the `rootara_data` volume. It contains:

- `/data/rootara.db` — SQLite database
- `/data/rawdata` — uploaded source files
- `/data/temp` — temporary analysis files
- `/data/config/jwt-secret` — generated JWT signing secret

Back up the volume before upgrades. The v1 release does not provide an
in-place migration from the former split frontend/backend deployment, old
Compose files, or old environment-variable names. Validate a fresh volume
first; restore user data only through a separately tested backup procedure.

The startup migration is idempotent and creates the RSID indexes used for
batch trait evaluation. If catalog validation or migration fails, the
container remains unready and reports the reason in its logs.

## Development

The web application remains at the repository root and the backend source is under `backend/`. From the repository root, install the pinned `backend/requirements.txt` in a Python 3.11 virtual environment and run `PYTHONPATH=backend python -m uvicorn main:app --host 127.0.0.1 --port 8000`. Set `ROOTARA_API_KEY=dev-only-key`, `ROOTARA_BACKEND_API_KEY=dev-only-key`, `ROOTARA_DATA_DIR=.data`, `ADMIN_PASSWORD=dev-only-password`, and `JWT_SECRET=dev-only-jwt-secret` for both processes. Run the web app with `pnpm dev` in a second terminal and set `ROOTARA_BACKEND_URL=http://127.0.0.1:8000`.

## Version and migration

The unified release line starts at `v1.0.0`. This release intentionally does not migrate the old two-container deployment, old Compose files, or old environment-variable names. Keep the old deployment available while validating a fresh `/data` volume, then copy user data only through a separately verified backup procedure.

Rootara is licensed under AGPLv3.
