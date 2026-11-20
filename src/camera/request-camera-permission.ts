import { loadPoseModule } from "../pose-module";

export type CameraPermission = "granted" | "denied";

export async function requestCameraPermission(): Promise<CameraPermission> {
	const poseModule = loadPoseModule();

	let permission: string;

	try {
		permission = await poseModule.requestCameraPermission();
	} catch (error) {
		throw new Error("The camera permission dialog failed.", { cause: error });
	}

	const isGranted = permission === "granted";

	if (isGranted) return "granted";

	const isDenied = permission === "denied";

	if (isDenied) return "denied";

	throw new Error("The camera permission dialog returned an unknown status.");
}
