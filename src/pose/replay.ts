import type { PoseFrame } from "../contracts";
import type { PoseDetection } from "./imageAnalysis";
import {
	copyPoseDetectionRecording,
	copyPoseRecording,
	type PoseDetectionRecording,
	type PoseRecording,
} from "./recording";

function copyPoseResults(frame: Pick<PoseFrame, "poses">) {
	if (frame.poses === undefined) return {};
	return {
		poses: frame.poses.map((pose) => ({
			landmarks: pose.landmarks.map((joint) => ({ ...joint })),
			worldLandmarks: pose.worldLandmarks.map((joint) => ({ ...joint })),
		})),
	};
}

export type PoseReplayStatus = "paused" | "playing" | "ended" | "disposed";
export interface PoseReplayState {
	status: PoseReplayStatus;
	positionMs: number;
	durationMs: number;
	speed: number;
}
export interface PoseReplayCallbacks<Frame = PoseFrame> {
	onFrame: (frame: Frame, timestampMs: number) => void;
	onReset?: () => void;
	onStateChange?: (state: PoseReplayState) => void;
}
export function createPoseReplay(
	recording: PoseRecording,
	callbacks: PoseReplayCallbacks,
) {
	return createReplay(copyPoseRecording(recording), callbacks, (frame) => ({
		...frame,
		...copyPoseResults(frame),
		landmarks: frame.landmarks.map((joint) => ({ ...joint })),
		worldLandmarks: frame.worldLandmarks.map((joint) => ({ ...joint })),
		additionalData: { ...frame.additionalData },
	}));
}
export function createPoseDetectionReplay(
	recording: PoseDetectionRecording,
	callbacks: PoseReplayCallbacks<PoseDetection>,
) {
	return createReplay(
		copyPoseDetectionRecording(recording),
		callbacks,
		(frame) => ({
			...frame,
			...copyPoseResults(frame),
			landmarks: frame.landmarks.map((joint) => ({ ...joint })),
			worldLandmarks: frame.worldLandmarks.map((joint) => ({ ...joint })),
			imageSize: { ...frame.imageSize },
			model: { ...frame.model },
		}),
	);
}
function createReplay<Frame>(
	recording: {
		readonly version: 1;
		readonly frames: ReadonlyArray<{
			readonly timestampMs: number;
			readonly frame: Frame;
		}>;
	},
	callbacks: PoseReplayCallbacks<Frame>,
	copyFrame: (frame: Frame) => Frame,
) {
	let session = recording;
	const durationMs = session.frames.at(-1)?.timestampMs ?? 0;
	let status: PoseReplayStatus = "paused";
	let speed = 1;
	let positionMs = 0;
	let anchorMs = 0;
	let nextFrame = 0;
	let timer: ReturnType<typeof setTimeout> | undefined;
	let revision = 0;
	const position = () => {
		if (status !== "playing") return positionMs;
		return Math.min(
			durationMs,
			positionMs + (performance.now() - anchorMs) * speed,
		);
	};
	const state = (): PoseReplayState => ({
		status,
		positionMs: position(),
		durationMs,
		speed,
	});
	const stopAfterCallbackFailure = (error: unknown): never => {
		positionMs = position();
		if (status !== "disposed") status = "paused";
		cancel();
		throw error;
	};
	const notify = () => {
		try {
			callbacks.onStateChange?.(state());
		} catch (error) {
			stopAfterCallbackFailure(error);
		}
	};
	const cancel = () => {
		clearTimeout(timer);
		timer = undefined;
		revision += 1;
	};
	const requireOpen = () => {
		if (status === "disposed") throw new Error("Replay has been disposed");
	};
	const schedule = () => {
		if (status !== "playing") return;
		const entry = session.frames[nextFrame];
		if (!entry) {
			positionMs = durationMs;
			status = "ended";
			notify();
			return;
		}
		const scheduledRevision = revision;
		const delay = Math.max(0, (entry.timestampMs - position()) / speed);
		timer = setTimeout(() => {
			if (scheduledRevision !== revision) return;
			timer = undefined;
			nextFrame += 1;
			try {
				callbacks.onFrame(copyFrame(entry.frame), entry.timestampMs);
			} catch (error) {
				stopAfterCallbackFailure(error);
			}
			if (scheduledRevision !== revision) return;
			notify();
			if (scheduledRevision === revision) schedule();
		}, Math.ceil(delay));
	};
	const pause = () => {
		requireOpen();
		if (status !== "playing") return;
		positionMs = position();
		status = "paused";
		cancel();
		notify();
	};
	const seek = (timeMs: number) => {
		requireOpen();
		const withinRecording = timeMs >= 0 && timeMs <= durationMs;
		if (!Number.isFinite(timeMs) || !withinRecording)
			throw new RangeError("Seek position is outside this recording");
		cancel();
		positionMs = timeMs;
		anchorMs = performance.now();
		nextFrame = session.frames.findIndex(
			(entry) => entry.timestampMs >= timeMs,
		);
		if (nextFrame === -1) nextFrame = session.frames.length;
		if (status === "ended") status = "paused";
		const seekRevision = revision;
		try {
			callbacks.onReset?.();
		} catch (error) {
			stopAfterCallbackFailure(error);
		}
		if (revision !== seekRevision) return;
		notify();
		if (revision === seekRevision) schedule();
	};
	return {
		get state() {
			return state();
		},
		play() {
			requireOpen();
			if (status === "playing" || status === "ended") return;
			status = "playing";
			anchorMs = performance.now();
			const playRevision = revision;
			notify();
			if (revision === playRevision) schedule();
		},
		pause,
		seek,
		reset() {
			pause();
			seek(0);
		},
		setSpeed(value: number) {
			requireOpen();
			if (!Number.isFinite(value) || value < 0.1 || value > 4)
				throw new RangeError("Replay speed must be between 0.1 and 4");
			if (value === speed) return;
			positionMs = position();
			anchorMs = performance.now();
			speed = value;
			cancel();
			const speedRevision = revision;
			notify();
			if (revision === speedRevision) schedule();
		},
		dispose() {
			positionMs = position();
			cancel();
			status = "disposed";
			session = { version: 1, frames: [] };
		},
	};
}
export type PoseReplay = ReturnType<typeof createPoseReplay>;
