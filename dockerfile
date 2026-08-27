ARG NODE_IMAGE=node:20-bookworm-slim
ARG PYTHON_IMAGE=python:3.11.10-slim-bookworm
ARG ROOTARA_VERSION=1.0.1

FROM golang:1.23-alpine AS go-builder
WORKDIR /build
COPY backend/scripts/rootara_reader.go ./rootara_reader.go
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags='-s -w' -o /rootara_reader ./rootara_reader.go

FROM ${NODE_IMAGE} AS web-deps
WORKDIR /app
RUN npm install --global pnpm@9.15.4
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

FROM web-deps AS web-builder
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1 NODE_ENV=production
RUN pnpm build

FROM ${PYTHON_IMAGE} AS backend-deps
ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
       build-essential git zlib1g-dev libbz2-dev liblzma-dev libcurl4-openssl-dev libssl-dev \
    && rm -rf /var/lib/apt/lists/*
COPY backend/requirements.txt /tmp/requirements.txt
RUN python -m venv /opt/venv \
    && /opt/venv/bin/pip install --no-cache-dir --upgrade pip \
    && /opt/venv/bin/pip install --no-cache-dir -r /tmp/requirements.txt \
    && rm -f /tmp/requirements.txt

FROM alpine/git:2.45.2 AS haplogrouper
ARG HAPLOGROUPER_COMMIT=c971dbb599cb12d1a847a7454914592b67a2e453
WORKDIR /src/haploGrouper
RUN git clone --filter=blob:none https://gitlab.com/bio_anth_decode/haploGrouper.git . \
    && git checkout --detach "${HAPLOGROUPER_COMMIT}" \
    && rm -rf .git

FROM ${PYTHON_IMAGE} AS runtime
ARG ROOTARA_VERSION
LABEL org.opencontainers.image.title="Rootara" \
      org.opencontainers.image.version="${ROOTARA_VERSION}" \
      org.opencontainers.image.licenses="AGPL-3.0" \
      org.opencontainers.image.source="https://github.com/pzweuj/Rootara"
ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    NEXT_TELEMETRY_DISABLED=1 \
    NODE_ENV=production \
    ROOTARA_VERSION=${ROOTARA_VERSION} \
    ROOTARA_BACKEND_ROOT=/opt/rootara/backend \
    ROOTARA_WEB_ROOT=/opt/rootara/web \
    ROOTARA_DATA_DIR=/data \
    PYTHONPATH=/opt/rootara/backend \
    DB_PATH=/data/rootara.db \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    PATH=/opt/venv/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

RUN apt-get update \
    && apt-get install -y --no-install-recommends tini libstdc++6 ca-certificates zlib1g libbz2-1.0 liblzma5 libcurl4 libssl3 libsqlite3-0 \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --system --gid 10001 rootara \
    && useradd --system --uid 10001 --gid 10001 --home-dir /opt/rootara --no-create-home rootara \
    && mkdir -p /opt/rootara/backend /opt/rootara/web /data \
    && chown -R rootara:rootara /opt/rootara /data

# The standalone Next server only needs the Node binary at runtime.
COPY --from=web-deps /usr/local/bin/node /usr/local/bin/node
COPY --from=backend-deps /opt/venv /opt/venv
COPY --from=haplogrouper /src/haploGrouper /opt/rootara/backend/haploGrouper
COPY backend /opt/rootara/backend
COPY --from=go-builder /rootara_reader /opt/rootara/backend/scripts/rootara_reader
COPY --from=web-builder /app/.next/standalone /opt/rootara/web
COPY --from=web-builder /app/.next/static /opt/rootara/web/.next/static
COPY --from=web-builder /app/public /opt/rootara/web/public
COPY deploy/launcher.py /opt/rootara/launcher.py

RUN chmod 0755 /opt/rootara/backend/scripts/rootara_reader /opt/rootara/launcher.py \
    && chown -R rootara:rootara /opt/rootara/backend /opt/rootara/web /data

USER rootara
WORKDIR /opt/rootara
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:3000/health/ready', timeout=4)" || exit 1
ENTRYPOINT ["/usr/bin/tini", "--", "python", "/opt/rootara/launcher.py"]
