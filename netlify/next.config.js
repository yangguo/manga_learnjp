/** @type {import('next').NextConfig} */
const nextConfig = {
  // Netlify deployment configuration
  trailingSlash: true,
  images: {
    domains: ['localhost'],
    unoptimized: true,
  },
  // Handle build errors more gracefully
  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: false,
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Configure OpenCV.js for client-side usage
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        crypto: false,
      };
    }
    
    // Exclude functions directory from Next.js build
    config.module.rules.push({
      test: /functions\/.*\.ts$/,
      loader: 'ignore-loader'
    });
    
    return config;
  },
  // Remove API rewrites since we'll use Netlify Functions
  async rewrites() {
    return [];
  },
}

module.exports = nextConfig
