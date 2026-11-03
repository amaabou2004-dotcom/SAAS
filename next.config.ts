import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Les live previews Arena sont servis depuis un host proxifié (*.e2b.app).
  allowedDevOrigins: ["*.e2b.app", "localhost"],
};

export default nextConfig;
