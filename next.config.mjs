/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // Exclude packages with native dependencies from server bundle
  // Load them from node_modules at runtime instead
  serverExternalPackages: [
    "@xenova/transformers",
    "sharp",
    "onnxruntime-node",
    // AWS SDK - prevent bundling in client (server-only for R2 integration)
    "@aws-sdk/client-s3",
    "@aws-sdk/s3-request-presigner",
  ],
}

export default nextConfig