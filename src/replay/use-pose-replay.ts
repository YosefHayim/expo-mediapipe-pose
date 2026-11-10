import * as React from "react";
import {
	createPoseReplay,
	type PoseReplay,
	type PoseReplayCallbacks,
	type PoseReplayState,
} from "./logic";
import type { PoseRecording } from "./recording";

export const usePoseReplay = (
	recording: PoseRecording,
	callbacks: PoseReplayCallbacks,
) => {
	const latestCallbacks = React.useRef(callbacks);
	const controller = React.useRef<PoseReplay | null>(null);
	const [snapshot, setStatus] = React.useState<PoseReplayState>({
		status: "paused",
		positionMs: 0,
		durationMs: 0,
		speed: 1,
	});
	React.useLayoutEffect(() => {
		latestCallbacks.current = callbacks;
	});
	React.useLayoutEffect(() => {
		const replay = createPoseReplay(recording, {
			onFrame: (frame, timestampMs) =>
				latestCallbacks.current.onFrame(frame, timestampMs),
			onReset: () => latestCallbacks.current.onReset?.(),
			onStateChange: (next) => {
				setStatus(next);
				latestCallbacks.current.onStateChange?.(next);
			},
		});
		controller.current = replay;
		setStatus(replay.state);
		try {
			latestCallbacks.current.onReset?.();
		} catch (error) {
			replay.dispose();
			controller.current = null;
			throw error;
		}
		return () => {
			replay.dispose();
			controller.current = null;
		};
	}, [recording]);
	const controls = React.useMemo(() => {
		const readMountedController = () => {
			const mountedController = controller.current;
			const isControllerMissing = mountedController == null;
			if (isControllerMissing)
				throw new Error("Replay controls require a mounted hook");

			return mountedController;
		};
		return {
			play: () => readMountedController().play(),
			pause: () => readMountedController().pause(),
			seek: (timeMs: number) => readMountedController().seek(timeMs),
			reset: () => readMountedController().reset(),
			setSpeed: (speed: number) => readMountedController().setSpeed(speed),
		};
	}, []);
	return { ...snapshot, ...controls };
};
