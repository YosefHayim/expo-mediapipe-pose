import * as React from "react";
import Svg, { Circle, Line } from "react-native-svg";
import type { PoseFrame } from "../contracts";
import type { SelectablePose } from "../pose/selection";
import {
	createDetectionSkeleton,
	createSkeleton,
	type Dimensions,
	type SkeletonOptions,
} from "../pose/skeleton";

export type PoseSkeletonProps = SkeletonOptions &
	Dimensions &
	(
		| { frame: PoseFrame }
		| {
				detection: SelectablePose & { imageSize: Dimensions };
		  }
	);

/** Optional overlay for an aspect-fill preview. Coordinates are not mirrored a second time. */
export const PoseSkeleton = React.memo((props: PoseSkeletonProps) => {
	const { width, height } = props;
	if (width <= 0 || height <= 0) return null;
	const skeleton =
		"frame" in props
			? createSkeleton(props.frame, props, props)
			: createDetectionSkeleton(props.detection, props, props);
	const { points, lines } = skeleton;
	return (
		<Svg width={width} height={height} pointerEvents="none" accessible={false}>
			{lines.map((line) => (
				<Line
					key={line.name}
					x1={line.start.x}
					y1={line.start.y}
					x2={line.end.x}
					y2={line.end.y}
					stroke={line.color}
					strokeWidth={line.width}
					strokeLinecap="round"
				/>
			))}
			{points.map((point) => (
				<Circle
					key={point.name}
					cx={point.x}
					cy={point.y}
					r={point.radius}
					fill={point.color}
				/>
			))}
		</Svg>
	);
});
