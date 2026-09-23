import { Schema } from "effect";
import { requireNativeModule } from "expo";
import { CameraCapabilities } from "../pose/cameraCapabilities";

export async function getCameraCapabilities(): Promise<CameraCapabilities> {
	const native = requireNativeModule<{
		getCameraCapabilities(): Promise<unknown>;
	}>("ExpoMediaPipePose");
	return Schema.decodeUnknownSync(CameraCapabilities)(
		await native.getCameraCapabilities(),
	);
}
