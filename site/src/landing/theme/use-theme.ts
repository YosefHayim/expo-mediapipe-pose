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

/** Sets data-theme on <html>. Called before the first paint from main.tsx. */
export const applyInitialTheme = (): Theme => {
	const theme = readSavedTheme() ?? readSystemTheme();
	document.documentElement.dataset.theme = theme;
	return theme;
};

export const useTheme = () => {
	const [theme, setTheme] = useState<Theme>(
		() => readSavedTheme() ?? readSystemTheme(),
	);

	useEffect(() => {
		document.documentElement.dataset.theme = theme;
	}, [theme]);

	const toggleTheme = useCallback(() => {
		const next: Theme = theme === "dark" ? "light" : "dark";
		setTheme(next);
		try {
			localStorage.setItem(storageKey, next);
		} catch {
			// Private mode: the choice lasts until the page closes.
		}
	}, [theme]);

	return { theme, toggleTheme };
};
