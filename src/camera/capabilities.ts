import { z } from "zod";
import {
	CameraFacing,
	type CameraLens,
	CameraLensWithoutAuto,
} from "../contracts";

const Zoom = z.number().min(1).max(100);
const ZoomRange = z
	.object({ min: Zoom, max: Zoom })
	.refine((range) => range.min <= range.max);
const Resolution = z.object({
	width: z.number().int().positive(),
	height: z.number().int().positive(),
});
export const CameraCapability = z.object({
	facing: CameraFacing,
	lens: CameraLensWithoutAuto,
	zoomRange: ZoomRange.nullable(),
	modes: z
		.array(
			z.object({
				previewFps: z.number().int().min(1).max(60),
				resolution: Resolution.nullable(),
			}),
		)
		.nonempty(),
});
export type CameraCapability = z.infer<typeof CameraCapability>;
export const CameraCapabilities = z.union([
	z.object({
		status: z.enum(["permissionRequired", "unavailable"]),
	}),
	z.object({
		status: z.literal("available"),
		platform: z.enum(["ios", "android"]),
		cameras: z.array(CameraCapability).nonempty(),
	}),
]);
export type CameraCapabilities = z.infer<typeof CameraCapabilities>;

export const findCameraCapability = (
	capabilities: CameraCapabilities,
	facing: CameraFacing,
	lens: CameraLens = "auto",
): CameraCapability | undefined => {
	const isCapabilitiesUnavailable = capabilities.status !== "available";
	if (isCapabilitiesUnavailable) return undefined;

	const isLensAuto = lens === "auto";
	const effectiveLens = isLensAuto ? "wide" : lens;
	return capabilities.cameras.find(
		(camera) => camera.facing === facing && camera.lens === effectiveLens,
	);
};
