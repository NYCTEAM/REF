/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  webpack: (config) => {
    config.externals.push('better-sqlite3');
    return config;
  },
}

module.exports = nextConfig
