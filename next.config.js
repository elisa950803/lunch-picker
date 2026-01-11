const isProd = process.env.NODE_ENV === 'production';
const isVercel = process.env.VERCEL === '1';

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow importing from outside the app directory
  transpilePackages: [],
  // Only use static export for GitHub Pages (not Vercel)
  // Vercel automatically handles API routes, so we disable static export there
  ...(isVercel ? {} : { output: 'export' }),
  trailingSlash: true,
  ...(isProd && !isVercel ? { basePath: '/lunch-picker', assetPrefix: '/lunch-picker/' } : {}),
  // Exclude backend from compilation
  webpack: (config) => {
    config.externals = config.externals || [];
    config.externals.push({
      'backend': 'commonjs backend',
    });
    return config;
  },
};

module.exports = nextConfig;
