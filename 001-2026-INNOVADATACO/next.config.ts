import type { NextConfig } from "next";

const allowedDevOrigin = process.env.ALLOWED_DEV_ORIGIN;
const nextConfig: NextConfig = {
  allowedDevOrigins: allowedDevOrigin ? [allowedDevOrigin, 'localhost'] : ['localhost'],
};

export default nextConfig;
