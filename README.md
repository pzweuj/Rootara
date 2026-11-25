<div align="center">
  <img src="public/rootara_logo_rmbg_small.svg" alt="Rootara Logo" width="300">
  <h1>Rootara - Self-hosted Genomics Platform</h1>
  <p><strong>English</strong> | <a href="README_ZH.md">中文</a></p>
</div>

Rootara is a self-hosted platform for importing and exploring personal genetic data. A single container runs the analysis locally. Next.js builds the browser application into static files. The Rust backend `rootara-server` serves those files, handles authentication, runs the durable import queue, and serves both public and internal APIs without a Python runtime in production. The frontend source lives at the repository root and the backend under `backend/`.

> **Testing status:** genetic trait results are currently test data and must not be used for medical, health, or other important decisions.

The catalog ships exactly 152 reviewed relative-tendency cards backed by 154
verified variant loci. Each card exposes its evidence grade, source links,
population scope, and limitations; none is a diagnosis or treatment
recommendation. The release supports `linux/amd64`.

One `rootara-server` process (Axum/Tokio) serves the public application on port 3000 and the private API on the container's loopback interface at `127.0.0.1:8000`. Native analysis workers start on demand and exit when their task finishes.

### v2.0.0 full-Rust backend & analysis runtime

Startup initialization, volume migration, HTTP APIs, the durable import queue, trait formula evaluation, and health probes all run in `rootara-server` (`backend/server/`). New imports use the streaming Rust `rootara-reader`, AdmixRS 0.1.0 for K47, and HaploGrouperRS 0.2.0 for GRCh37 Y and mitochondrial assignments. The image builds its indexed annotation database once via `rootara-server build-reference`. The reader looks up one genotype at a time and writes directly to the report transaction. `rootara-archive` writes small Parquet row groups and reads only the columns needed for downloads or trait lookups. Existing SQLite reports and TXT or Parquet uploads remain readable. Reimporting recalculates ancestry with the Rust solver, so percentages can differ.

To test the checkout locally, build with `docker build -f dockerfile -t rootara-local:2.0.0 .`. Resource measurements and the comparison procedure are in the [import benchmark](docs/import-memory-benchmark.md).

Rootara's source uses AGPLv3. The image also contains independently licensed tools and reference files. AdmixRS uses GPL-3.0-only. HaploGrouperRS 0.2.0 has noncommercial terms, and its included ISOGG data uses CC BY-NC-SA 3.0. Notices and reference credits ship in `/opt/rootara/licenses/`. [AdmixRS](https://github.com/pzweuj/AdmixRS) · [HaploGrouperRS license](https://github.com/pzweuj/HaploGrouperRS/blob/70108d6844f7dbdaa6a483f1ff9c2bba6a035c27/LICENSE)

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

The release image also enforces `ROOTARA_EXPECTED_TRAIT_COUNT=152` and
`ROOTARA_REQUIRE_CURATED_CATALOG=1`; startup is rejected if the shipped
catalog is incomplete or contains an audit-blocked rule.

JWT signing material is generated on first startup and stored in `/data/config/jwt-secret`. The SQLite database and uploaded raw data are stored under `/data`; keep this volume for backups and upgrades.

The private API listens only on `127.0.0.1:8000` inside the container. Only port 3000 is public. The public health endpoints are:

- `GET /health/live`
- `GET /health/ready`
- `GET /health`

The trait page loads its lightweight catalog and report results separately. The
corresponding authenticated endpoints are `GET /api/traits/catalog`,
`GET /api/reports/{reportId}/traits/results`, and
`GET /api/traits/{traitId}?report_id=...`. Missing genotypes are reported as
`insufficient_data` with the missing RSIDs; they are never imputed.

New uploads use Zstandard-compressed Parquet with byte-exact raw export and projected locus reads. Indexed SQLite tables serve report browsing and RSID lookup. Existing TXT archives remain readable. Reimport a source file to apply the new multi-allelic matching rules to a historical report.

With the service stopped, run `docker compose run --rm --no-deps rootara migrate-archives` to convert existing TXT uploads. The command verifies SHA-256 and keeps the source. Add `--remove-text` to remove each TXT after verification.

Imports are queued and resume after service restarts. Dashboard responses are cached in browser memory per report for five minutes and cleared on sign-out. The ancestry map uses bundled country boundaries. For upgrades with an explicit `ROOTARA_EXPECTED_TRAIT_COUNT=150`, change the value to `152`.

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

For native backend and import development, build `cargo build --release --locked --manifest-path backend/reader/Cargo.toml` and `cargo build --release --locked --manifest-path backend/server/Cargo.toml`, and put `rootara-server`, `rootara-reader`, `rootara-archive`, `admixrs`, and `haplogrouper-rs` on PATH. Build the lookup database with `rootara-server build-reference backend/database/Rootara.core.202404.txt.gz backend/database/Rootara.core.sqlite`. The Dockerfile pins the upstream commits and lists the K47 files for `backend/database/admix/` and four reference tables for `backend/haploGrouper/data/`. You can also copy these assets out of a locally built image.

The web application remains at the repository root and the Rust backend lives in `backend/server/` and `backend/reader/`. Set `ROOTARA_API_KEY=dev-only-key`, `ROOTARA_BACKEND_API_KEY=dev-only-key`, `ROOTARA_BACKEND_ROOT=$PWD/backend`, `ROOTARA_DATA_DIR=.data`, `ADMIN_PASSWORD=dev-only-password`, and `JWT_SECRET=dev-only-jwt-secret`, and run `ROOTARA_DISABLE_PUBLIC=1 cargo run --manifest-path backend/server/Cargo.toml -- serve` to expose the private API on `127.0.0.1:8000`. Run the web app with `pnpm dev` in a second terminal and set `ROOTARA_BACKEND_URL=http://127.0.0.1:8000`. Catalog curation and audit scripts remain under `backend/scripts/`.

## Version and migration

The unified release line starts at `v1.0.0`. This release intentionally does not migrate the old two-container deployment, old Compose files, or old environment-variable names. Keep the old deployment available while validating a fresh `/data` volume, then copy user data only through a separately verified backup procedure.

Rootara is licensed under AGPLv3.
