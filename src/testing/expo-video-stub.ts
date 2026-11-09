export const requireNativeModule = (moduleName: string) => {
	const isModuleNameNotExpoMediaPipePose = moduleName !== "ExpoMediaPipePose";
	if (isModuleNameNotExpoMediaPipePose) {
		throw new Error("Unexpected native module");
	}

	return Reflect.get(globalThis, Symbol.for("pose.nativeVideoTest"));
};
