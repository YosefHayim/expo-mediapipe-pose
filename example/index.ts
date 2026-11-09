import { registerRootComponent } from "expo";
import { NativeChecks } from "@/checks/native-checks";
import App from "./app";

const isNativeChecksEnabled =
	process.env.EXPO_PUBLIC_POSE_NATIVE_CHECKS === "1";
registerRootComponent(isNativeChecksEnabled ? NativeChecks : App);
