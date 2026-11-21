import type { ExpoConfig } from "expo/config";
import {
	type ExportedConfigWithProps,
	type InfoPlist,
	withInfoPlist,
} from "expo/config-plugins";

const DEFAULT_CAMERA_USAGE_TEXT =
	"Allow this app to use the camera to detect your pose.";

export function setIosCameraUsageText(
	expoConfig: ExpoConfig,
	cameraUsageText: string = DEFAULT_CAMERA_USAGE_TEXT,
): ExpoConfig {
	function applyUsageText(mod: ExportedConfigWithProps<InfoPlist>) {
		mod.modResults["NSCameraUsageDescription"] = cameraUsageText;
		return mod;
	}

	return withInfoPlist(expoConfig, applyUsageText);
}
