import comments from "@eslint-community/eslint-plugin-eslint-comments/configs";
import eslint from "@eslint/js";
import vitest from "@vitest/eslint-plugin";
import jsdoc from "eslint-plugin-jsdoc";
import jsonc from "eslint-plugin-jsonc";
import markdown from "eslint-plugin-markdown";
import n from "eslint-plugin-n";
import packageJson from "eslint-plugin-package-json";
import perfectionist from "eslint-plugin-perfectionist";
import * as regexp from "eslint-plugin-regexp";
import yml from "eslint-plugin-yml";
import tseslint from "typescript-eslint";

export default tseslint.config(
	{
		ignores: ["**/*.snap", "coverage", "lib", "node_modules", "pnpm-lock.yaml"],
	},
	{ linterOptions: { reportUnusedDisableDirectives: "error" } },
	eslint.configs.recommended,
	comments.recommended,
	jsdoc.configs["flat/contents-typescript-error"],
	jsdoc.configs["flat/logical-typescript-error"],
	jsdoc.configs["flat/stylistic-typescript-error"],
	jsonc.configs["flat/recommended-with-json"],
	markdown.configs.recommended,
	n.configs["flat/recommended"],
	packageJson.configs.recommended,
	perfectionist.configs["recommended-natural"],
	regexp.configs["flat/recommended"],
	{
		extends: [
			tseslint.configs.strictTypeChecked,
			tseslint.configs.stylisticTypeChecked,
		],
		files: ["**/*.{js,ts}"],
		languageOptions: {
			parserOptions: {
				projectService: { allowDefaultProject: ["*.config.*s"] },
				tsconfigRootDir: import.meta.dirname,
			},
		},
		rules: {
			"@typescript-eslint/no-unnecessary-type-parameters": "off",
			"@typescript-eslint/switch-exhaustiveness-check": "error",
			"logical-assignment-operators": [
				"error",
				"always",
				{ enforceForIfStatements: true },
			],
			"n/no-unsupported-features/node-builtins": "off",
			"no-useless-rename": "error",
			"object-shorthand": "error",
			"operator-assignment": "error",
			"perfectionist/sort-modules": "off",
		},
		settings: {
			perfectionist: { partitionByComment: true, type: "natural" },
			vitest: { typecheck: true },
		},
	},
	{
		extends: [tseslint.configs.disableTypeChecked],
		files: ["**/*.md/*.ts"],
		rules: {
			"@typescript-eslint/no-non-null-assertion": "off",
			"@typescript-eslint/no-unused-vars": "off",
			"n/no-missing-import": "off",
			"n/no-unpublished-import": "off",
		},
	},
	{
		extends: [tseslint.configs.disableTypeChecked],
		files: ["**/*.md/*.jsonc"],
		rules: {
			"jsonc/no-comments": "off",
		},
	},
	{
		extends: [vitest.configs.recommended],
		files: ["**/*.test.*", "**/*.bench.*"],
		rules: {
			"@typescript-eslint/no-explicit-any": "off",
			"@typescript-eslint/no-non-null-assertion": "off",
			"@typescript-eslint/no-unsafe-assignment": "off",
			"@typescript-eslint/no-unsafe-call": "off",
			"@typescript-eslint/no-unsafe-member-access": "off",
			"@typescript-eslint/no-unsafe-return": "off",
			"@typescript-eslint/require-await": "off",
		},
	},
	{
		extends: [yml.configs["flat/standard"], yml.configs["flat/prettier"]],
		files: ["**/*.{yml,yaml}"],
		rules: {
			"yml/sort-keys": [
				"error",
				{ order: { type: "asc" }, pathPattern: "^.*$" },
			],
			"yml/sort-sequence-values": [
				"error",
				{ order: { type: "asc" }, pathPattern: "^.*$" },
			],
		},
	},
);
