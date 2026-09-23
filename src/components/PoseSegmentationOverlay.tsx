import * as React from "react";
import { Image, type ImageProps, View } from "react-native";
import type { PoseSegmentation } from "../pose/segmentation";
import { projectLandmark } from "../pose/skeleton";

export interface PoseSegmentationOverlayProps {
	segmentation: PoseSegmentation;
	width: number;
	height: number;
	poseIndex?: number;
	color?: string;
	opacity?: number;
	onError?: ImageProps["onError"];
}
export const PoseSegmentationOverlay = React.memo(
	({
		segmentation,
		width,
		height,
		poseIndex = 0,
		color = "#22c55e",
		opacity = 0.5,
		onError,
	}: PoseSegmentationOverlayProps) => {
		if (!Number.isInteger(poseIndex) || poseIndex < 0 || poseIndex > 5)
			throw new RangeError("poseIndex must be an integer from 0 to 5");
		if (!Number.isFinite(opacity) || opacity < 0 || opacity > 1)
			throw new RangeError("opacity must be between 0 and 1");
		if (segmentation.status !== "available") return null;
		if (width <= 0 || height <= 0) return null;
		const mask = segmentation.masks.find(
			(entry) => entry.poseIndex === poseIndex,
		);
		if (mask === undefined) return null;
		const origin = projectLandmark(
			{ x: 0, y: 0, z: 0 },
			segmentation.imageSize,
			{ width, height },
		);
		const corner = projectLandmark(
			{ x: 1, y: 1, z: 0 },
			segmentation.imageSize,
			{ width, height },
		);
		return (
			<View
				pointerEvents="none"
				accessible={false}
				style={{
					position: "absolute",
					top: 0,
					left: 0,
					width,
					height,
					overflow: "hidden",
				}}
			>
				<Image
					source={{ uri: mask.uri }}
					onError={onError}
					resizeMode="stretch"
					style={{
						position: "absolute",
						left: origin.x,
						top: origin.y,
						width: corner.x - origin.x,
						height: corner.y - origin.y,
						tintColor: color,
						opacity,
					}}
				/>
			</View>
		);
	},
);
