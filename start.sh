#!/usr/bin/env sh
# v1.0.1
set -eu

: "${ADMIN_PASSWORD:?Set ADMIN_PASSWORD before starting Rootara}"
docker compose up -d
docker compose ps
echo "Rootara is available at http://localhost:${ROOTARA_PORT:-3000}"
