export interface PreviewColors {
	night: string;
	nightLine: string;
	signal: string;
	joint: string;
	text: string;
	muted: string;
	fontMono: string;
}

/** Reads the page color tokens once, so the canvas follows the same palette as the CSS. */
export const readPreviewColors = (canvas: HTMLCanvasElement): PreviewColors => {
	const canvasStyle = getComputedStyle(canvas);
	const readToken = (tokenName: string) =>
		canvasStyle.getPropertyValue(tokenName).trim();

	return {
		night: readToken("--night"),
		nightLine: readToken("--night-line"),
		signal: readToken("--signal"),
		joint: readToken("--joint"),
		text: readToken("--text-on-night"),
		muted: readToken("--muted-on-night"),
		fontMono: readToken("--font-mono"),
	};
};
