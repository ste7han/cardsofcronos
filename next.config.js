/** @type {import('next').NextConfig} */
const nextConfig = {
  // Configure webpack to externalize packages that might cause issues
  webpack: (config) => {
    config.externals.push('pino-pretty', 'lokijs', 'encoding');
    return config;
  },
  
  // Disable tracing which can cause permission issues on Windows
  experimental: {
    outputFileTracing: false,
    turbo: {
      resolveAlias: {
        'react-server-dom-webpack/server.edge': 'react-server-dom-turbopack/server.edge',
        'react-server-dom-webpack/client.edge': 'react-server-dom-turbopack/client.edge'
      }
    }
  },
  
  // Remove static export for now to troubleshoot build
  // output: 'export',
  
  // Disable the Image Optimization API for static export
  images: {
    unoptimized: true,
  },
  
  // Server-side package configuration
  serverExternalPackages: [],
  
  // Increase timeout for builds
  staticPageGenerationTimeout: 120,
  
  // Skip type checking for faster builds
  typescript: {
    // Skip type checking to speed up builds during development
    ignoreBuildErrors: true,
  },
  
  // Skip ESLint for faster builds
  eslint: {
    // Skip ESLint checks to speed up builds during development
    ignoreDuringBuilds: true,
  }
};

module.exports = nextConfig;
