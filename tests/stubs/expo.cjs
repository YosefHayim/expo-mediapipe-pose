exports.requireNativeModule = (name) => {
	if (name !== "ExpoMediaPipePose") throw new Error("Unexpected native module");
	return {
		getCameraCapabilities: () =>
			globalThis[Symbol.for("pose.nativeCapabilitiesTest")](),
	};
};
