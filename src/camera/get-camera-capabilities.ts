import { getNativeModule } from "../native-module";
import { CameraCapabilities } from "./capabilities";

export const getCameraCapabilities = async (): Promise<CameraCapabilities> => {
	const native = getNativeModule();
	const capabilitiesReply = await native.getCameraCapabilities();
	return CameraCapabilities.parse(capabilitiesReply);
};
