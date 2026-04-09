const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  experimental: {
    externalDir: true
  },
  webpack: (config) => {
    config.resolve.alias['@ecom/seo'] = path.resolve(__dirname, '../../packages/seo/src');
    config.resolve.alias['@ecom/api-client'] = path.resolve(__dirname, '../../packages/api-client/src');
    return config;
  }
};

module.exports = nextConfig;
