<div align="center">
  <img src="public/rootara_logo_rmbg_small.svg" alt="Rootara Logo" width="300">
  <h1>Rootara - Self-hosted Genomics Platform</h1>
  <p><strong>English</strong> | <a href="README_ZH.md">中文</a></p>
</div>

Rootara is a self-hosted platform for importing and exploring personal genetic data. All analysis runs locally in a single container; the browser-facing Next.js application supervises a private FastAPI analysis service.

> **Testing status:** genetic trait results are currently test data and must not be used for medical, health, or other important decisions.

## Quick start

Docker 20+ and Docker Compose v2+ are required.

```bash
git clone https://github.com/pzweuj/Rootara.git
cd Rootara
export ADMIN_PASSWORD='replace-with-a-long-random-password'
docker compose up -d
```

Open <http://localhost:3000>. `ADMIN_EMAIL` defaults to `admin@rootara.app` and can be overridden before starting the container.

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

JWT signing material is generated on first startup and stored in `/data/config/jwt-secret`. The SQLite database and uploaded raw data are stored under `/data`; keep this volume for backups and upgrades.

FastAPI listens only on `127.0.0.1:8000` inside the container. Only port 3000 is public. The public health endpoints are:

- `GET /health/live`
- `GET /health/ready`
- `GET /health`

## Development

The web application remains at the repository root and the backend source is under `backend/`. From the repository root, install the pinned `backend/requirements.txt` in a Python 3.11 virtual environment and run `PYTHONPATH=backend python -m uvicorn main:app --host 127.0.0.1 --port 8000`. Set `ROOTARA_API_KEY=dev-only-key`, `ROOTARA_BACKEND_API_KEY=dev-only-key`, `ROOTARA_DATA_DIR=.data`, `ADMIN_PASSWORD=dev-only-password`, and `JWT_SECRET=dev-only-jwt-secret` for both processes. Run the web app with `pnpm dev` in a second terminal and set `ROOTARA_BACKEND_URL=http://127.0.0.1:8000`.

## Version and migration

The unified release line starts at `v1.0.0`. This release intentionally does not migrate the old two-container deployment, old Compose files, or old environment-variable names. Keep the old deployment available while validating a fresh `/data` volume, then copy user data only through a separately verified backup procedure.

Rootara is licensed under AGPLv3.
