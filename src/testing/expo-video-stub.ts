export const requireNativeModule = (moduleName: string) => {
	const isOtherModule = moduleName !== "ExpoMediaPipePose";
	if (isOtherModule) {
		throw new Error("Unexpected native module");
	}

	return Reflect.get(globalThis, Symbol.for("pose.nativeVideoTest"));
};
