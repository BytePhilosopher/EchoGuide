process.env.NEXT_IGNORE_INCORRECT_LOCKFILE = '1';
const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['styled-jsx'],
  webpack: (config) => {
    const reactPath = path.dirname(require.resolve('react/package.json'));
    const reactDomPath = path.dirname(require.resolve('react-dom/package.json'));

    config.resolve.alias = {
      ...config.resolve.alias,
      react: reactPath,
      'react-dom': reactDomPath,
    };
    return config;
  },
};

module.exports = nextConfig;
