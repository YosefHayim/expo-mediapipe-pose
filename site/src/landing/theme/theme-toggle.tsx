import { MoonIcon, SunIcon } from "@/landing/icons/icons";
import { useTheme } from "./use-theme";
import "./theme-toggle.css";

export const ThemeToggle = () => {
	const { theme, toggleTheme } = useTheme();
	const isDark = theme === "dark";

	return (
		<button
			type="button"
			className="theme-toggle"
			role="switch"
			aria-checked={isDark}
			aria-label="Dark theme"
			onClick={toggleTheme}
		>
			<span className="theme-toggle-knob">
				{isDark ? <MoonIcon size={14} /> : <SunIcon size={14} />}
			</span>
		</button>
	);
};
