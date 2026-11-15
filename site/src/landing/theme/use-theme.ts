import { useCallback, useEffect, useState } from "react";

export type Theme = "light" | "dark";

const storageKey = "expo-mediapipe-pose-theme";

const isTheme = (value: unknown): value is Theme =>
	value === "light" || value === "dark";

const readSavedTheme = (): Theme | null => {
	try {
		const saved = localStorage.getItem(storageKey);
		return isTheme(saved) ? saved : null;
	} catch {
		return null;
	}
};

const readSystemTheme = (): Theme =>
	window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";

const browserBarColors: Record<Theme, string> = {
	dark: "#0D1311",
	light: "#EDEFE8",
};
const fadeMs = 350;

const showTheme = (theme: Theme) => {
	document.documentElement.dataset.theme = theme;
	document
		.querySelector('meta[name="theme-color"]')
		?.setAttribute("content", browserBarColors[theme]);
};

/** Sets data-theme on <html>. Called before the first paint from main.tsx. */
export const applyInitialTheme = (): Theme => {
	const theme = readSavedTheme() ?? readSystemTheme();
	showTheme(theme);
	return theme;
};

let fadeTimer: number | undefined;

/** Adds the theme-changing class to <html> briefly, so colors ease instead of jump. */
const startThemeFade = () => {
	if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
	const root = document.documentElement;
	root.classList.add("theme-changing");
	window.clearTimeout(fadeTimer);
	fadeTimer = window.setTimeout(
		() => root.classList.remove("theme-changing"),
		fadeMs,
	);
};

export const useTheme = () => {
	const [theme, setTheme] = useState<Theme>(
		() => readSavedTheme() ?? readSystemTheme(),
	);

	useEffect(() => {
		showTheme(theme);
	}, [theme]);

	const toggleTheme = useCallback(() => {
		const next: Theme = theme === "dark" ? "light" : "dark";
		startThemeFade();
		setTheme(next);
		try {
			localStorage.setItem(storageKey, next);
		} catch {
			// Private mode: the choice lasts until the page closes.
		}
	}, [theme]);

	return { theme, toggleTheme };
};
