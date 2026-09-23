import * as React from "react";
import Svg, { Circle, Line } from "react-native-svg";
import type { PoseFrame } from "../contracts";
import {
	createSkeleton,
	type Dimensions,
	type SkeletonOptions,
} from "../pose/skeleton";

export interface PoseSkeletonProps extends SkeletonOptions, Dimensions {
	frame: PoseFrame;
}

/** Optional overlay for an aspect-fill preview. Coordinates are not mirrored a second time. */
export const PoseSkeleton = React.memo(
	({ frame, width, height, ...options }: PoseSkeletonProps) => {
		if (width <= 0 || height <= 0) return null;
		const { points, lines } = createSkeleton(frame, { width, height }, options);
		return (
			<Svg
				width={width}
				height={height}
				pointerEvents="none"
				accessible={false}
			>
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
	},
);
