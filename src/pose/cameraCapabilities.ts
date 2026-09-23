import { Schema } from "effect";
import { CameraFacing } from "../contracts";

const Zoom = Schema.Number.pipe(Schema.finite(), Schema.between(1, 100));
const ZoomRange = Schema.Struct({ min: Zoom, max: Zoom }).pipe(
	Schema.filter((range) => range.min <= range.max),
);
const Resolution = Schema.Struct({
	width: Schema.Number.pipe(Schema.int(), Schema.positive()),
	height: Schema.Number.pipe(Schema.int(), Schema.positive()),
});
export const CameraCapability = Schema.Struct({
	facing: CameraFacing,
	lens: Schema.Literal("wide", "ultraWide"),
	zoomRange: Schema.NullOr(ZoomRange),
	modes: Schema.NonEmptyArray(
		Schema.Struct({
			previewFps: Schema.Number.pipe(Schema.int(), Schema.between(1, 60)),
			resolution: Schema.NullOr(Resolution),
		}),
	),
});
export type CameraCapability = Schema.Schema.Type<typeof CameraCapability>;
export const CameraCapabilities = Schema.Union(
	Schema.Struct({
		status: Schema.Literal("permissionRequired", "unavailable"),
	}),
	Schema.Struct({
		status: Schema.Literal("available"),
		platform: Schema.Literal("ios", "android"),
		cameras: Schema.NonEmptyArray(CameraCapability),
	}),
);
export type CameraCapabilities = Schema.Schema.Type<typeof CameraCapabilities>;

export function findCameraCapability(
	capabilities: CameraCapabilities,
	facing: "front" | "back",
	lens: "auto" | "wide" | "ultraWide" = "auto",
): CameraCapability | undefined {
	if (capabilities.status !== "available") return undefined;
	const effectiveLens = lens === "auto" ? "wide" : lens;
	return capabilities.cameras.find(
		(camera) => camera.facing === facing && camera.lens === effectiveLens,
	);
}
