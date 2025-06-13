import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		clearMocks: true,
		coverage: {
			all: true,
			include: ["src"],
			reporter: ["html", "lcov"],
		},
		exclude: ["lib", "node_modules", "benchmark"],
		setupFiles: process.env.CI ? ["console-fail-test/setup"] : [],
	},
});
