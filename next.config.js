const isProd = process.env.NODE_ENV === 'production';

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow importing from outside the app directory
  transpilePackages: [],
  output: 'export',
  trailingSlash: true,
  ...(isProd ? { basePath: '/lunch-picker', assetPrefix: '/lunch-picker/' } : {}),
};

module.exports = nextConfig;
