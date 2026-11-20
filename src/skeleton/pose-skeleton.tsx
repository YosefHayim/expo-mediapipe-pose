import { Circle, Line, Svg } from "react-native-svg";
import type { PoseFrame } from "../landmarks/pose-frame";
import {
	listPoseBones,
	type PoseBoneJoint,
	type PoseBoneLine,
} from "./pose-bones";

export interface PoseSkeletonProps {
	poseFrame: PoseFrame;
	viewWidth: number;
	viewHeight: number;
	skeletonColor?: string;
}

export function PoseSkeleton({
	poseFrame,
	viewWidth,
	viewHeight,
	skeletonColor = "#38bdf8",
}: PoseSkeletonProps) {
	const isWidthEmpty = viewWidth <= 0;

	if (isWidthEmpty) return null;

	const isHeightEmpty = viewHeight <= 0;

	if (isHeightEmpty) return null;

	const drawing = listPoseBones({ poseFrame, viewWidth, viewHeight });

	function showBoneLine(line: PoseBoneLine) {
		const boneWidth = 3;

		return (
			<Line
				key={line.name}
				x1={line.x1}
				y1={line.y1}
				x2={line.x2}
				y2={line.y2}
				stroke={skeletonColor}
				strokeWidth={boneWidth}
				strokeLinecap="round"
			/>
		);
	}

	function showBoneJoint(joint: PoseBoneJoint) {
		const jointRadius = 4;

		return (
			<Circle
				key={joint.name}
				cx={joint.x}
				cy={joint.y}
				r={jointRadius}
				fill={skeletonColor}
			/>
		);
	}

	return (
		<Svg
			width={viewWidth}
			height={viewHeight}
			pointerEvents="none"
			accessible={false}
		>
			{drawing.lines.map(showBoneLine)}
			{drawing.joints.map(showBoneJoint)}
		</Svg>
	);
}
