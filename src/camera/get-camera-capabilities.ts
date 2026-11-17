import { requireNativeModule } from "expo";
import { CameraCapabilities } from "./capabilities";

export const getCameraCapabilities = async (): Promise<CameraCapabilities> => {
	const native = requireNativeModule<{
		getCameraCapabilities(): Promise<unknown>;
	}>("ExpoMediaPipePose");
	const capabilitiesReply = await native.getCameraCapabilities();
	return CameraCapabilities.parse(capabilitiesReply);
};
