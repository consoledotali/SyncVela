import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	/* config options here */
	output: "standalone",
	allowedDevOrigins: ["127.0.0.1", "*.manus.computer"],
	turbopack: {
		root: path.resolve(__dirname, ".."),
	},
};

export default nextConfig;
