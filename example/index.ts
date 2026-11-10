import { registerRootComponent } from "expo";
import { NativeChecks } from "@/checks/native-checks";
import App from "./app";
import { isNativeChecksEnabled } from "./environment";

registerRootComponent(isNativeChecksEnabled ? NativeChecks : App);
