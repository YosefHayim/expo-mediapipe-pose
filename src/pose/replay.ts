import type { PoseFrame } from "../contracts";
import { copyPoseRecording, type PoseRecording } from "./recording";

export type PoseReplayStatus = "paused" | "playing" | "ended" | "disposed";
export interface PoseReplayState {
	status: PoseReplayStatus;
	positionMs: number;
	durationMs: number;
	speed: number;
}
export interface PoseReplayCallbacks {
	onFrame: (frame: PoseFrame, timestampMs: number) => void;
	onReset?: () => void;
	onStateChange?: (state: PoseReplayState) => void;
}
export function createPoseReplay(
	recording: PoseRecording,
	callbacks: PoseReplayCallbacks,
) {
	let session = copyPoseRecording(recording);
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
				callbacks.onFrame(
					JSON.parse(JSON.stringify(entry.frame)) as PoseFrame,
					entry.timestampMs,
				);
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
