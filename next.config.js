/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config) => {
    config.externals.push('pino-pretty', 'lokijs', 'encoding');
    return config;
  },
  // Explicitly set the output option to ensure consistent bundling
  output: 'export',
  // Disable the Image Optimization API for static export
  images: {
    unoptimized: true,
  },
  // Server-side package configuration
  serverExternalPackages: []
};

module.exports = nextConfig;
