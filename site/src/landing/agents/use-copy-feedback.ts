import { useCallback, useEffect, useRef, useState } from "react";

const FEEDBACK_MILLISECONDS = 2000;

/** Copies text and reports `isCopied` for two seconds afterwards. */
export const useCopyFeedback = (text: string) => {
	const [isCopied, setIsCopied] = useState(false);
	const timerRef = useRef<number | null>(null);

	useEffect(
		() => () => {
			if (timerRef.current !== null) window.clearTimeout(timerRef.current);
		},
		[],
	);

	const copy = useCallback(async () => {
		try {
			await navigator.clipboard.writeText(text);
		} catch {
			// The prompt stays selectable in the code block.
			return;
		}
		setIsCopied(true);
		if (timerRef.current !== null) window.clearTimeout(timerRef.current);
		timerRef.current = window.setTimeout(
			() => setIsCopied(false),
			FEEDBACK_MILLISECONDS,
		);
	}, [text]);

	return { isCopied, copy };
};
