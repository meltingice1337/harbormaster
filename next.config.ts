import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["dockerode", "telegraf", "pino", "pino-pretty"],
  allowedDevOrigins: ["192.168.0.200"],
};

export default nextConfig;
