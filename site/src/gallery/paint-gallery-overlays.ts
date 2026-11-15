import {
	measureJointArc,
	type Point,
	placeReadoutLabel,
	type Size,
} from "@/landing/hero/hero-skeleton-logic";
import {
	type CameraFacing,
	pickRuleStatusText,
	pickViewfinderCornerMarks,
	type Region,
	type RuleStatus,
} from "./gallery-preview-logic";
import type { PreviewColors } from "./preview-colors";

const READOUT_FONT_SIZE = 11;
const READOUT_PADDING = 7;
const READOUT_HEIGHT = 22;
const READOUT_LETTER_SPACING = "0.6px";
const ARC_RADIUS = 18;
const ARC_LINE_WIDTH = 2;
const PLATE_OPACITY = 0.8;
const TRACK_HEIGHT = 3;
const TRACK_MARGIN = 12;
const PLAYHEAD_HEIGHT = 14;
const RULE_TEXT = "BOTH WRISTS ABOVE SHOULDERS";
const RATE_TEXT = "frameLimit={15}";

const setReadoutFont = (
	context: CanvasRenderingContext2D,
	colors: PreviewColors,
) => {
	context.font = `${READOUT_FONT_SIZE}px ${colors.fontMono}`;
	context.letterSpacing = READOUT_LETTER_SPACING;
	context.textBaseline = "middle";
};

const measureReadoutSize = (
	context: CanvasRenderingContext2D,
	text: string,
	colors: PreviewColors,
): Size => {
	setReadoutFont(context, colors);
	return {
		width: Math.ceil(context.measureText(text).width) + READOUT_PADDING * 2,
		height: READOUT_HEIGHT,
	};
};

/** The mono readout: text on a night plate at 80%. */
const paintReadoutPlate = (
	context: CanvasRenderingContext2D,
	text: string,
	position: Point,
	textColor: string,
	colors: PreviewColors,
) => {
	const size = measureReadoutSize(context, text, colors);
	context.save();
	context.globalAlpha = PLATE_OPACITY;
	context.fillStyle = colors.night;
	context.fillRect(position.x, position.y, size.width, size.height);
	context.restore();

	context.strokeStyle = colors.nightLine;
	context.lineWidth = 1;
	context.strokeRect(
		position.x + 0.5,
		position.y + 0.5,
		size.width - 1,
		size.height - 1,
	);
	context.fillStyle = textColor;
	context.fillText(
		text,
		position.x + READOUT_PADDING,
		position.y + size.height / 2,
	);
};

export const paintViewfinder = (
	context: CanvasRenderingContext2D,
	canvasSize: Size,
	color: string,
) => {
	context.strokeStyle = color;
	context.lineWidth = 2;
	context.lineCap = "square";
	for (const mark of pickViewfinderCornerMarks(canvasSize)) {
		context.beginPath();
		context.moveTo(mark.horizontalEnd.x, mark.horizontalEnd.y);
		context.lineTo(mark.corner.x, mark.corner.y);
		context.lineTo(mark.verticalEnd.x, mark.verticalEnd.y);
		context.stroke();
	}
};

/** The coral arc at a joint with a leader line to its mono readout, like the hero. */
export const paintJointReadout = (
	context: CanvasRenderingContext2D,
	jointPoints: { first: Point; joint: Point; last: Point },
	jointName: string,
	canvasSize: Size,
	colors: PreviewColors,
) => {
	const { first, joint, last } = jointPoints;
	const arc = measureJointArc(first, joint, last);
	const labelText = `${jointName} ${arc.degrees}°`;
	const labelSize = measureReadoutSize(context, labelText, colors);
	const placement = placeReadoutLabel(joint, canvasSize, labelSize);

	context.strokeStyle = colors.joint;
	context.lineWidth = 1;
	context.beginPath();
	context.moveTo(joint.x, joint.y);
	context.lineTo(placement.leaderEnd.x, placement.leaderEnd.y);
	context.stroke();

	context.lineWidth = ARC_LINE_WIDTH;
	context.beginPath();
	context.arc(
		joint.x,
		joint.y,
		ARC_RADIUS,
		arc.startRadians,
		arc.startRadians + arc.sweepRadians,
		arc.sweepRadians < 0,
	);
	context.stroke();

	paintReadoutPlate(
		context,
		labelText,
		{ x: placement.labelLeft, y: placement.labelTop },
		colors.joint,
		colors,
	);
};

export const paintTimeline = (
	context: CanvasRenderingContext2D,
	canvasSize: Size,
	progress: number,
	colors: PreviewColors,
) => {
	const trackWidth = canvasSize.width - TRACK_MARGIN * 2;
	const trackTop = canvasSize.height - TRACK_MARGIN - TRACK_HEIGHT;
	const playheadX = TRACK_MARGIN + trackWidth * progress;

	context.fillStyle = colors.nightLine;
	context.fillRect(TRACK_MARGIN, trackTop, trackWidth, TRACK_HEIGHT);
	context.fillStyle = colors.signal;
	context.fillRect(
		TRACK_MARGIN,
		trackTop,
		playheadX - TRACK_MARGIN,
		TRACK_HEIGHT,
	);
	context.fillStyle = colors.joint;
	context.fillRect(
		playheadX - 1,
		trackTop + TRACK_HEIGHT / 2 - PLAYHEAD_HEIGHT / 2,
		2,
		PLAYHEAD_HEIGHT,
	);
};

export const paintProgressBar = (
	context: CanvasRenderingContext2D,
	region: Region,
	progress: number,
	colors: PreviewColors,
) => {
	const barTop = region.top + region.height - TRACK_HEIGHT;
	context.fillStyle = colors.nightLine;
	context.fillRect(region.left, barTop, region.width, TRACK_HEIGHT);
	context.fillStyle = colors.signal;
	context.fillRect(region.left, barTop, region.width * progress, TRACK_HEIGHT);
};

export const paintDividerLine = (
	context: CanvasRenderingContext2D,
	canvasSize: Size,
	colors: PreviewColors,
) => {
	context.fillStyle = colors.nightLine;
	context.fillRect(canvasSize.width / 2 - 0.5, 0, 1, canvasSize.height);
};

export const paintCaption = (
	context: CanvasRenderingContext2D,
	captionText: string,
	position: Point,
	colors: PreviewColors,
) => {
	paintReadoutPlate(context, captionText, position, colors.muted, colors);
};

export const pickStatusColor = (status: RuleStatus, colors: PreviewColors) => {
	const statusColors: Record<RuleStatus, string> = {
		pass: colors.signal,
		fail: colors.joint,
		unknown: colors.muted,
	};
	return statusColors[status];
};

export const paintRuleStatus = (
	context: CanvasRenderingContext2D,
	status: RuleStatus,
	canvasSize: Size,
	colors: PreviewColors,
) => {
	const statusText = pickRuleStatusText(status);
	const bottom = canvasSize.height - 8;
	const statusTop = bottom - READOUT_HEIGHT;
	const ruleTop = statusTop - READOUT_HEIGHT - 4;

	paintReadoutPlate(
		context,
		RULE_TEXT,
		{ x: 8, y: ruleTop },
		colors.text,
		colors,
	);
	paintReadoutPlate(
		context,
		statusText,
		{ x: 8, y: statusTop },
		pickStatusColor(status, colors),
		colors,
	);
};

export const paintCameraIndicator = (
	context: CanvasRenderingContext2D,
	facing: CameraFacing,
	canvasSize: Size,
	colors: PreviewColors,
) => {
	const isFacingFront = facing === "front";
	const facingText = isFacingFront ? "CAMERA FRONT" : "CAMERA BACK";
	const bottom = canvasSize.height - 8;

	paintReadoutPlate(context, facingText, { x: 8, y: 8 }, colors.signal, colors);
	paintReadoutPlate(
		context,
		RATE_TEXT,
		{ x: 8, y: bottom - READOUT_HEIGHT },
		colors.text,
		colors,
	);
};
