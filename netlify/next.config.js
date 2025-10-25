/** @type {import('next').NextConfig} */
const nextConfig = {
  // Netlify deployment configuration
  // Don't force trailing slashes; Netlify Functions don't accept trailing slashes
  trailingSlash: false,
  // Ensure Next.js treats this folder as the root for output file tracing
  outputFileTracingRoot: __dirname,
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
  // Rewrite API routes to Netlify Functions
  async rewrites() {
    // In development with Netlify CLI, rewrite to the Netlify Dev proxy
    // In production, these are handled by netlify.toml redirects
    if (process.env.NETLIFY_DEV || process.env.NODE_ENV === 'development') {
      return [
        {
          source: '/api/:path*',
          destination: '/.netlify/functions/:path*',
        },
      ];
    }
    return [];
  },
}

module.exports = nextConfig
