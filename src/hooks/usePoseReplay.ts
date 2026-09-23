import * as React from "react";
import type { PoseRecording } from "../pose/recording";
import {
	createPoseReplay,
	type PoseReplay,
	type PoseReplayCallbacks,
	type PoseReplayState,
} from "../pose/replay";

export function usePoseReplay(
	recording: PoseRecording,
	callbacks: PoseReplayCallbacks,
) {
	const latestCallbacks = React.useRef(callbacks);
	const controller = React.useRef<PoseReplay | null>(null);
	const [state, setState] = React.useState<PoseReplayState>({
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
				setState(next);
				latestCallbacks.current.onStateChange?.(next);
			},
		});
		controller.current = replay;
		setState(replay.state);
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
		const current = () => {
			if (!controller.current)
				throw new Error("Replay controls require a mounted hook");
			return controller.current;
		};
		return {
			play: () => current().play(),
			pause: () => current().pause(),
			seek: (timeMs: number) => current().seek(timeMs),
			reset: () => current().reset(),
			setSpeed: (speed: number) => current().setSpeed(speed),
		};
	}, []);
	return { ...state, ...controls };
}
