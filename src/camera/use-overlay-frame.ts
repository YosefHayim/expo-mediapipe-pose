import * as React from "react";
import type { PoseFrame } from "../contracts";

export const usePoseOverlayFrame = (staleAfterMs: number) => {
	const [frame, setFrame] = React.useState<PoseFrame | null>(null);
	const receivedAt = React.useRef<number | null>(null);
	const timer = React.useRef<ReturnType<typeof setTimeout> | undefined>(
		undefined,
	);
	const clear = React.useCallback(() => {
		clearTimeout(timer.current);
		receivedAt.current = null;
		setFrame(null);
	}, []);
	const scheduleExpiry = React.useCallback(() => {
		clearTimeout(timer.current);

		const isReceivedAtCurrentMissing = receivedAt.current === null;
		if (isReceivedAtCurrentMissing) return;

		const remainingMs = receivedAt.current + staleAfterMs - performance.now();

		const isRemainingMsAtMost0 = remainingMs <= 0;
		if (isRemainingMsAtMost0) {
			clear();
			return;
		}

		timer.current = setTimeout(clear, remainingMs);
	}, [staleAfterMs, clear]);
	const update = React.useCallback(
		(next: PoseFrame) => {
			receivedAt.current = performance.now();
			setFrame(next);
			scheduleExpiry();
		},
		[scheduleExpiry],
	);
	React.useLayoutEffect(() => {
		scheduleExpiry();
		return () => clearTimeout(timer.current);
	}, [scheduleExpiry]);
	return { frame, update, clear };
};
