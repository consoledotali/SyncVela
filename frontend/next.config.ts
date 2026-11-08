import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	output: "standalone",
	allowedDevOrigins: ["127.0.0.1", "*.manus.computer"],
	turbopack: {
		root: path.resolve(__dirname, ".."),
	},
	async redirects() {
		return [
			{
				source: "/verify-otp",
				destination: "/auth/verify-otp",
				permanent: true,
			},
		];
	},
};

export default nextConfig;
