const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const config = getDefaultConfig(__dirname);
const resolveBeforeShim = config.resolver.resolveRequest;

config.resolver.resolveRequest = resolveExampleModule;

function resolveExampleModule(context, moduleName, platform) {
	const isAssetRegistry = moduleName == "@react-native/assets-registry/registry";

	if (isAssetRegistry) {
		return {
			filePath: path.join(__dirname, "asset-registry-shim.js"),
			type: "sourceFile",
		};
	}

	const hasPreviousResolver = resolveBeforeShim != null;

	if (hasPreviousResolver) return resolveBeforeShim(context, moduleName, platform);

	return context.resolveRequest(context, moduleName, platform);
}

module.exports = config;
