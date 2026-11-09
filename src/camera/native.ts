import { requireNativeModule } from "expo";
import { CameraCapabilities } from "./capabilities";

export async function getCameraCapabilities(): Promise<CameraCapabilities> {
	const native = requireNativeModule<{
		getCameraCapabilities(): Promise<unknown>;
	}>("ExpoMediaPipePose");
	const capabilitiesReply = await native.getCameraCapabilities();
	return CameraCapabilities.parse(capabilitiesReply);
}
