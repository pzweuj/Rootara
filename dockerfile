ARG NODE_IMAGE=node:20-bookworm-slim
ARG DEBIAN_IMAGE=debian:bookworm-slim
ARG ROOTARA_VERSION=2.0.0

FROM rust:1-bookworm AS reader-builder
WORKDIR /build
COPY backend/reader/ ./
RUN --mount=type=cache,id=rootara-reader-registry,target=/usr/local/cargo/registry,sharing=locked \
    --mount=type=cache,id=rootara-reader-target,target=/build/target,sharing=locked \
    cargo build --release --locked && mkdir -p /out \
    && cp target/release/rootara-reader target/release/rootara-archive /out/

FROM rust:1-bookworm AS server-builder
WORKDIR /build
COPY backend/server/ ./
RUN --mount=type=cache,id=rootara-server-registry,target=/usr/local/cargo/registry,sharing=locked \
    --mount=type=cache,id=rootara-server-target,target=/build/target,sharing=locked \
    cargo build --release --locked && mkdir -p /out \
    && cp target/release/rootara-server /out/

FROM rust:1-bookworm AS admix-builder
ARG ADMIXRS_COMMIT=89ed49615a68babf0cb7f1d57dc35c43544d8cb9
WORKDIR /build
RUN git init -q && git remote add origin https://github.com/pzweuj/AdmixRS.git \
    && git config remote.origin.promisor true && git config remote.origin.partialclonefilter blob:none \
    && git sparse-checkout set --no-cone '/src/' '/Cargo.*' '/LICENSE' '/data/K47.*' '/data/README.md' \
    && git fetch --depth=1 --filter=blob:none origin "${ADMIXRS_COMMIT}" \
    && git checkout --detach FETCH_HEAD && cargo build --release --locked

FROM rust:1-bookworm AS haplo-builder
ARG HAPLOGROUPERRS_COMMIT=70108d6844f7dbdaa6a483f1ff9c2bba6a035c27
WORKDIR /build
RUN git init -q && git fetch --depth=1 https://github.com/pzweuj/HaploGrouperRS.git "${HAPLOGROUPERRS_COMMIT}" \
    && git checkout --detach FETCH_HEAD && cargo build --release --locked

FROM ${DEBIAN_IMAGE} AS reference-builder
WORKDIR /build
RUN apt-get update && apt-get install -y --no-install-recommends libsqlite3-0 && rm -rf /var/lib/apt/lists/*
COPY --from=server-builder /out/rootara-server /usr/local/bin/rootara-server
COPY backend/database/Rootara.core.202404.txt.gz ./
RUN rootara-server build-reference Rootara.core.202404.txt.gz Rootara.core.sqlite

FROM ${NODE_IMAGE} AS web-deps
WORKDIR /app
RUN npm install --global pnpm@9.15.4
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

FROM web-deps AS web-builder
COPY app ./app
COPY components ./components
COPY contexts ./contexts
COPY lib ./lib
COPY public ./public
COPY types ./types
COPY middleware.ts tsconfig.json next.config.mjs postcss.config.mjs tailwind.config.js ./
ENV NEXT_TELEMETRY_DISABLED=1 NODE_ENV=production ROOTARA_STATIC_WEB=1
# The image serves the exported UI and implements the public API in rootara-server.
# Keep the Next handlers available in the source checkout for pnpm dev.
RUN mkdir /dev-routes && mv app/api app/health middleware.ts 'app/analysis/traits/[id]' /dev-routes/ \
    && pnpm build

FROM alpine/git:2.45.2 AS haplogrouper
ARG HAPLOGROUPER_COMMIT=c971dbb599cb12d1a847a7454914592b67a2e453
WORKDIR /src/haploGrouper
RUN git clone --filter=blob:none https://gitlab.com/bio_anth_decode/haploGrouper.git . \
    && git checkout --detach "${HAPLOGROUPER_COMMIT}" \
    && rm -rf .git

FROM ${DEBIAN_IMAGE} AS runtime
ARG ROOTARA_VERSION
LABEL org.opencontainers.image.title="Rootara" \
      org.opencontainers.image.version="${ROOTARA_VERSION}" \
      org.opencontainers.image.licenses="AGPL-3.0" \
      org.opencontainers.image.source="https://github.com/pzweuj/Rootara"
ENV DEBIAN_FRONTEND=noninteractive \
    ROOTARA_VERSION=${ROOTARA_VERSION} \
    ROOTARA_BACKEND_ROOT=/opt/rootara/backend \
    ROOTARA_WEB_ROOT=/opt/rootara/web \
    ROOTARA_DATA_DIR=/data \
    DB_PATH=/data/rootara.db \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    RUST_LOG=info \
    PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

RUN apt-get update \
    && apt-get install -y --no-install-recommends tini libstdc++6 ca-certificates zlib1g libbz2-1.0 liblzma5 libcurl4 libssl3 libsqlite3-0 \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --system --gid 10001 rootara \
    && useradd --system --uid 10001 --gid 10001 --home-dir /opt/rootara --no-create-home rootara \
    && mkdir -p /opt/rootara/backend/database/admix /opt/rootara/backend/haploGrouper/data /opt/rootara/web /data \
    && chown -R rootara:rootara /opt/rootara /data

COPY --from=server-builder /out/rootara-server /usr/local/bin/
COPY --from=reader-builder /out/ /usr/local/bin/
COPY --from=haplo-builder /build/target/release/haplogrouper-rs /usr/local/bin/
COPY --from=haplo-builder /build/LICENSE /build/NOTICE /build/data/Y-DATA.md /opt/rootara/licenses/HaploGrouperRS/
COPY --from=haplo-builder /build/LICENSES/ /opt/rootara/licenses/HaploGrouperRS/LICENSES/
COPY --from=haplo-builder /build/data/chrY_isogg2019_tree.txt /build/data/chrY_isogg2019-decode1_loci_b37.txt /opt/rootara/backend/haploGrouper/data/
COPY --from=haplogrouper /src/haploGrouper/data/chrMT_phylotree17_tree.txt /src/haploGrouper/data/chrMT_phylotree17_loci.txt /opt/rootara/backend/haploGrouper/data/
COPY --from=haplogrouper /src/haploGrouper/license.txt /src/haploGrouper/README.md /opt/rootara/licenses/haploGrouper/
COPY --from=admix-builder /build/target/release/admixrs /usr/local/bin/
COPY --from=admix-builder /build/data/K47.alleles /build/data/K47.47.F /opt/rootara/backend/database/admix/
COPY --from=admix-builder /build/LICENSE /build/data/README.md /opt/rootara/licenses/AdmixRS/
COPY LICENSE /opt/rootara/licenses/Rootara/LICENSE
COPY backend/database/TEMPLATE01.txt \
     backend/database/default-traits.json \
     backend/database/trait-evidence.json \
     backend/database/trait-locus-registry.json \
     backend/database/trait-catalog.json \
     /opt/rootara/backend/database/
COPY --from=reference-builder --chmod=0444 /build/Rootara.core.sqlite /opt/rootara/backend/database/
COPY --from=web-builder /app/out /opt/rootara/web

USER rootara
WORKDIR /opt/rootara
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD ["/usr/local/bin/rootara-server", "healthcheck"]
ENTRYPOINT ["/usr/bin/tini", "--", "/usr/local/bin/rootara-server"]
