export const requireNativeModule = (moduleName: string) => {
	if (moduleName !== "ExpoMediaPipePose") {
		throw new Error("Unexpected native module");
	}
	return Reflect.get(globalThis, Symbol.for("pose.nativeVideoTest"));
};
