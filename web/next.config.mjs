/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  basePath: '/plexus',
  assetPrefix: '/plexus/',
  env: {
    NEXT_PUBLIC_BASE_PATH: '/plexus',
  },
  images: {
    unoptimized: true,
  },
  trailingSlash: true,
}

export default nextConfig
