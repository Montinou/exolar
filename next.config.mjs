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
  ],
}

export default nextConfig