/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { dev }) => {
    if (dev) {
      // OneDrive-synced folders can corrupt persistent webpack cache files.
      // Disable filesystem cache in dev to prevent missing CSS/chunk artifacts.
      config.cache = false;
    }
    return config;
  }
};

export default nextConfig;
