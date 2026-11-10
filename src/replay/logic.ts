import type { PoseFrame } from "../contracts";
import type { PoseDetection } from "../image/analysis";
import {
	copyPoseDetectionRecording,
	copyPoseRecording,
	type PoseDetectionRecording,
	type PoseRecording,
} from "./recording";

const copyPoseResults = (frame: Pick<PoseFrame, "poses">) => {
	const poses = frame.poses;
	const isFramePosesMissing = poses == null;
	if (isFramePosesMissing) return {};

	return {
		poses: poses.map((pose) => ({
			landmarks: pose.landmarks.map((joint) => ({ ...joint })),
			worldLandmarks: pose.worldLandmarks.map((joint) => ({ ...joint })),
		})),
	};
};

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
export const createPoseReplay = (
	recording: PoseRecording,
	callbacks: PoseReplayCallbacks,
) => {
	return createReplay(copyPoseRecording(recording), callbacks, (frame) => ({
		...frame,
		...copyPoseResults(frame),
		landmarks: frame.landmarks.map((joint) => ({ ...joint })),
		worldLandmarks: frame.worldLandmarks.map((joint) => ({ ...joint })),
		additionalData: { ...frame.additionalData },
	}));
};
export const createPoseDetectionReplay = (
	recording: PoseDetectionRecording,
	callbacks: PoseReplayCallbacks<PoseDetection>,
) => {
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
};
const createReplay = <Frame>(
	recording: {
		readonly version: 1;
		readonly frames: ReadonlyArray<{
			readonly timestampMs: number;
			readonly frame: Frame;
		}>;
	},
	callbacks: PoseReplayCallbacks<Frame>,
	copyFrame: (frame: Frame) => Frame,
) => {
	let session = recording;
	const durationMs = session.frames.at(-1)?.timestampMs ?? 0;
	let status: PoseReplayStatus = "paused";
	let speed = 1;
	let positionMs = 0;
	let anchorMs = 0;
	let nextFrame = 0;
	let timer: ReturnType<typeof setTimeout> | undefined;
	let revision = 0;
	const readPosition = () => {
		const isNotPlaying = status !== "playing";
		if (isNotPlaying) return positionMs;

		return Math.min(
			durationMs,
			positionMs + (performance.now() - anchorMs) * speed,
		);
	};
	const readReplaySnapshot = (): PoseReplayState => ({
		status,
		positionMs: readPosition(),
		durationMs,
		speed,
	});
	const stopAfterCallbackFailure = (error: unknown): never => {
		positionMs = readPosition();

		const isNotDisposed = status !== "disposed";
		if (isNotDisposed) status = "paused";

		cancel();
		throw error;
	};
	const notify = () => {
		try {
			callbacks.onStateChange?.(readReplaySnapshot());
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
		const isDisposed = status === "disposed";
		if (isDisposed) throw new Error("Replay has been disposed");
	};
	const schedule = () => {
		const isNotPlaying = status !== "playing";
		if (isNotPlaying) return;

		const entry = session.frames[nextFrame];

		const isEntryMissing = entry == null;
		if (isEntryMissing) {
			positionMs = durationMs;
			status = "ended";
			notify();
			return;
		}

		const scheduledRevision = revision;
		const delay = Math.max(0, (entry.timestampMs - readPosition()) / speed);
		timer = setTimeout(() => {
			const isScheduleOutdated = scheduledRevision !== revision;
			if (isScheduleOutdated) return;

			timer = undefined;
			nextFrame += 1;
			try {
				callbacks.onFrame(copyFrame(entry.frame), entry.timestampMs);
			} catch (error) {
				stopAfterCallbackFailure(error);
			}

			const isScheduleOutdatedAfterFrame = scheduledRevision !== revision;
			if (isScheduleOutdatedAfterFrame) return;

			notify();

			const isScheduleCurrent = scheduledRevision === revision;
			if (isScheduleCurrent) schedule();
		}, Math.ceil(delay));
	};
	const pause = () => {
		requireOpen();

		const isNotPlaying = status !== "playing";
		if (isNotPlaying) return;

		positionMs = readPosition();
		status = "paused";
		cancel();
		notify();
	};
	const seek = (timeMs: number) => {
		requireOpen();

		const withinRecording = timeMs >= 0 && timeMs <= durationMs;

		const hasInvalidTimeMs = !Number.isFinite(timeMs) || !withinRecording;
		if (hasInvalidTimeMs)
			throw new RangeError("Seek position is outside this recording");

		cancel();
		positionMs = timeMs;
		anchorMs = performance.now();
		nextFrame = session.frames.findIndex(
			(entry) => entry.timestampMs >= timeMs,
		);

		const hasNoNextFrame = nextFrame === -1;
		if (hasNoNextFrame) nextFrame = session.frames.length;

		const isEnded = status === "ended";
		if (isEnded) status = "paused";

		const seekRevision = revision;
		try {
			callbacks.onReset?.();
		} catch (error) {
			stopAfterCallbackFailure(error);
		}

		const isSeekOutdated = revision !== seekRevision;
		if (isSeekOutdated) return;

		notify();

		const isSeekCurrent = revision === seekRevision;
		if (isSeekCurrent) schedule();
	};
	return {
		get state() {
			return readReplaySnapshot();
		},
		play() {
			requireOpen();

			const isAlreadyPlayingOrEnded =
				status === "playing" || status === "ended";
			if (isAlreadyPlayingOrEnded) return;

			status = "playing";
			anchorMs = performance.now();
			const playRevision = revision;
			notify();

			const isPlayCurrent = revision === playRevision;
			if (isPlayCurrent) schedule();
		},
		pause,
		seek,
		reset() {
			pause();
			seek(0);
		},
		setSpeed(value: number) {
			requireOpen();

			const isRateOutOfRange =
				!Number.isFinite(value) || value < 0.1 || value > 4;
			if (isRateOutOfRange)
				throw new RangeError("Replay speed must be between 0.1 and 4");

			const isSameSpeed = value === speed;
			if (isSameSpeed) return;

			positionMs = readPosition();
			anchorMs = performance.now();
			speed = value;
			cancel();
			const speedRevision = revision;
			notify();

			const isSpeedCurrent = revision === speedRevision;
			if (isSpeedCurrent) schedule();
		},
		dispose() {
			positionMs = readPosition();
			cancel();
			status = "disposed";
			session = { version: 1, frames: [] };
		},
	};
};
export type PoseReplay = ReturnType<typeof createPoseReplay>;
