import { registerRootComponent } from "expo";
import App from "./App";

import { NativeChecks } from "./NativeChecks";

registerRootComponent(
	process.env.EXPO_PUBLIC_POSE_NATIVE_CHECKS === "1" ? NativeChecks : App,
);
