/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    unoptimized: true,
  },
  experimental: {
    middlewareClientMaxBodySize: "50mb",
    webpackBuildWorker: true,
    parallelServerBuildTraces: true,
    parallelServerCompiles: true,
    serverActions: {
      bodySizeLimit: '50mb',
    },
  },
  output: process.env.ROOTARA_STATIC_WEB === "1" ? "export" : "standalone",
}

export default nextConfig
