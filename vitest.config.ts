import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		clearMocks: true,
		coverage: {
			all: true,
			include: ["src"],
			reporter: ["html", "lcov"],
		},
		include: ["./src/**/*.test.ts"],
		setupFiles: process.env.CI ? ["console-fail-test/setup"] : [],
	},
});
