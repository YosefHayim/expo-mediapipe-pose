// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
	expoConfig,
	{
		ignores: [
			"dist/*",
			"build/**",
			"plugin/build/**",
			"example/ios/**",
			"example/android/**",
			"example/.expo/**",
		],
	},
	{
		rules: {
			// This package compares with ==, including == null.
			eqeqeq: "off",
		},
	},
	{
		files: ["app.plugin.js", "write-relative-build-imports.js"],
		languageOptions: {
			sourceType: "commonjs",
			globals: {
				require: "readonly",
				module: "readonly",
				exports: "readonly",
			},
		},
	},
]);
