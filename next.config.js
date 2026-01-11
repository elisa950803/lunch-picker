/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow importing from outside the app directory
  transpilePackages: [],
  // GitHub Pages configuration
  output: 'export',
  basePath: '/lunch-picker',
  assetPrefix: '/lunch-picker/',
};

module.exports = nextConfig;
