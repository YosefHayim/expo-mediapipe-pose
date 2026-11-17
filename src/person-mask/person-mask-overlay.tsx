import * as React from "react";
import { Image, type ImageProps, View } from "react-native";
import { projectLandmark } from "../skeleton/create-skeleton";
import type { PosePersonMask } from "./person-mask";

export interface PosePersonMaskOverlayProps {
	personMask: PosePersonMask;
	width: number;
	height: number;
	poseIndex?: number;
	color?: string;
	opacity?: number;
	onError?: ImageProps["onError"];
}
export const PosePersonMaskOverlay = React.memo(
	({
		personMask,
		width,
		height,
		poseIndex = 0,
		color = "#22c55e",
		opacity = 0.5,
		onError,
	}: PosePersonMaskOverlayProps) => {
		const isPoseIndexOutOfRange =
			!Number.isInteger(poseIndex) || poseIndex < 0 || poseIndex > 5;
		if (isPoseIndexOutOfRange)
			throw new RangeError("poseIndex must be an integer from 0 to 5");

		const isOpacityOutOfRange =
			!Number.isFinite(opacity) || opacity < 0 || opacity > 1;
		if (isOpacityOutOfRange)
			throw new RangeError("opacity must be between 0 and 1");

		const isPersonMaskUnavailable = personMask.status !== "available";
		if (isPersonMaskUnavailable) return null;

		const isSizeEmpty = width <= 0 || height <= 0;
		if (isSizeEmpty) return null;

		const mask = personMask.masks.find(
			(overlay) => overlay.poseIndex === poseIndex,
		);

		const isMaskMissing = mask == null;
		if (isMaskMissing) return null;

		const origin = projectLandmark({ x: 0, y: 0, z: 0 }, personMask.imageSize, {
			width,
			height,
		});
		const corner = projectLandmark({ x: 1, y: 1, z: 0 }, personMask.imageSize, {
			width,
			height,
		});
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
