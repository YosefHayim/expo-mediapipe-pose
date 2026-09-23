exports.requireNativeModule = (name) => {
	if (name !== "ExpoMediaPipePose") throw new Error("Unexpected native module");
	return globalThis[Symbol.for("pose.nativeVideoTest")];
};
