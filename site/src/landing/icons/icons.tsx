import type { ReactNode, SVGProps } from "react";

export type IconProps = Omit<SVGProps<SVGSVGElement>, "children" | "title"> & {
	size?: number;
	/** Give a title only when the icon is the sole label of a control. */
	title?: string;
};

type IconFrameProps = IconProps & { children: ReactNode };

const IconFrame = ({ size = 24, title, children, ...rest }: IconFrameProps) => {
	const isLabelled = title !== undefined && title !== "";
	return (
		// biome-ignore lint/a11y/noSvgWithoutTitle: Icons are decorative unless a title is given, which renders a title element.
		<svg
			xmlns="http://www.w3.org/2000/svg"
			width={size}
			height={size}
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth={1.75}
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden={isLabelled ? undefined : true}
			role={isLabelled ? "img" : undefined}
			focusable="false"
			{...rest}
		>
			{isLabelled && <title>{title}</title>}
			{children}
		</svg>
	);
};

export const ArrowRightIcon = (props: IconProps) => (
	<IconFrame {...props}>
		<path d="M4 12h15" />
		<path d="M13 6l6 6-6 6" />
	</IconFrame>
);

export const CopyIcon = (props: IconProps) => (
	<IconFrame {...props}>
		<rect x="8.5" y="8.5" width="11.5" height="11.5" rx="2" />
		<path d="M15.5 8.5V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7.5a2 2 0 0 0 2 2h2.5" />
	</IconFrame>
);

export const CheckIcon = (props: IconProps) => (
	<IconFrame {...props}>
		<path d="M4.5 12.5l5 5 10-11" />
	</IconFrame>
);

export const GithubIcon = (props: IconProps) => (
	<IconFrame {...props}>
		<path d="M9 19c-4.5 1.4-4.5-2.3-6.3-2.8" />
		<path d="M15 21v-3.2c0-1 .1-1.6-.5-2.3 2.8-.3 5.5-1.4 5.5-6a4.6 4.6 0 0 0-1.2-3.2 4.3 4.3 0 0 0-.1-3.2s-1-.3-3.4 1.3a11.8 11.8 0 0 0-6.2 0C6.7 2.8 5.7 3.1 5.7 3.1a4.3 4.3 0 0 0-.1 3.2A4.6 4.6 0 0 0 4.4 9.5c0 4.6 2.7 5.7 5.5 6-.6.7-.6 1.3-.5 2.3V21" />
	</IconFrame>
);

export const MenuIcon = (props: IconProps) => (
	<IconFrame {...props}>
		<path d="M4 7h16" />
		<path d="M4 12h16" />
		<path d="M4 17h16" />
	</IconFrame>
);

export const CloseIcon = (props: IconProps) => (
	<IconFrame {...props}>
		<path d="M6 6l12 12" />
		<path d="M18 6L6 18" />
	</IconFrame>
);

export const SunIcon = (props: IconProps) => (
	<IconFrame {...props}>
		<circle cx="12" cy="12" r="4" />
		<path d="M12 3v2" />
		<path d="M12 19v2" />
		<path d="M3 12h2" />
		<path d="M19 12h2" />
		<path d="M5.6 5.6l1.4 1.4" />
		<path d="M17 17l1.4 1.4" />
		<path d="M5.6 18.4L7 17" />
		<path d="M17 7l1.4-1.4" />
	</IconFrame>
);

export const MoonIcon = (props: IconProps) => (
	<IconFrame {...props}>
		<path d="M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10z" />
	</IconFrame>
);

export const CameraIcon = (props: IconProps) => (
	<IconFrame {...props}>
		<path d="M4 8h3l1.5-2.5h7L17 8h3v11H4z" />
		<circle cx="12" cy="13.5" r="3.5" />
	</IconFrame>
);

export const SkeletonIcon = (props: IconProps) => (
	<IconFrame {...props}>
		<circle cx="12" cy="4" r="1.75" />
		<path d="M12 6v7" />
		<path d="M12 8L6.5 11" />
		<path d="M12 8l5.5 3" />
		<path d="M12 13l-3.5 7" />
		<path d="M12 13l3.5 7" />
		<circle cx="6.5" cy="11" r="0.6" />
		<circle cx="17.5" cy="11" r="0.6" />
	</IconFrame>
);

export const MaskIcon = (props: IconProps) => (
	<IconFrame {...props}>
		<circle cx="12" cy="6.5" r="3" />
		<path d="M5.5 20v-3a6.5 6.5 0 0 1 13 0v3z" />
		<path d="M3 3.5h2" />
		<path d="M3 3.5v2" />
		<path d="M21 20.5h-2" />
		<path d="M21 20.5v-2" />
	</IconFrame>
);

export const AngleIcon = (props: IconProps) => (
	<IconFrame {...props}>
		<path d="M4 20L20 20" />
		<path d="M4 20L16 5" />
		<path d="M11 20a7 7 0 0 0-2.4-5.3" />
	</IconFrame>
);

export const PeopleIcon = (props: IconProps) => (
	<IconFrame {...props}>
		<circle cx="8.5" cy="7.5" r="3" />
		<path d="M2.5 20v-2a6 6 0 0 1 12 0v2" />
		<path d="M15.5 4.8a3 3 0 0 1 0 5.4" />
		<path d="M18 13.2a6 6 0 0 1 3.5 5.3V20" />
	</IconFrame>
);

export const PhotoVideoIcon = (props: IconProps) => (
	<IconFrame {...props}>
		<rect x="3" y="5" width="18" height="14" rx="2" />
		<path d="M3 16l5-5 4 4 3-3 6 5" />
		<circle cx="8" cy="9.5" r="1.25" />
	</IconFrame>
);

export const RulesIcon = (props: IconProps) => (
	<IconFrame {...props}>
		<path d="M4 6h10" />
		<path d="M18 6h2" />
		<circle cx="16" cy="6" r="2" />
		<path d="M4 12h2" />
		<path d="M10 12h10" />
		<circle cx="8" cy="12" r="2" />
		<path d="M4 18h10" />
		<path d="M18 18h2" />
		<circle cx="16" cy="18" r="2" />
	</IconFrame>
);

export const RecordIcon = (props: IconProps) => (
	<IconFrame {...props}>
		<circle cx="12" cy="12" r="8.5" />
		<circle cx="12" cy="12" r="3.5" />
	</IconFrame>
);

export const GaugeIcon = (props: IconProps) => (
	<IconFrame {...props}>
		<path d="M4.5 18a8.5 8.5 0 1 1 15 0" />
		<path d="M12 14l4-5" />
		<path d="M12 5v1.5" />
		<path d="M6 8l1 1" />
		<path d="M18 8l-1 1" />
	</IconFrame>
);

export const PlayIcon = (props: IconProps) => (
	<IconFrame {...props}>
		<path d="M7 4.5v15l12-7.5z" />
	</IconFrame>
);

export const PauseIcon = (props: IconProps) => (
	<IconFrame {...props}>
		<path d="M8 5v14" />
		<path d="M16 5v14" />
	</IconFrame>
);

export const TerminalIcon = (props: IconProps) => (
	<IconFrame {...props}>
		<rect x="3" y="4.5" width="18" height="15" rx="2" />
		<path d="M7 10l3 2.5L7 15" />
		<path d="M12.5 15H17" />
	</IconFrame>
);

export const DocumentIcon = (props: IconProps) => (
	<IconFrame {...props}>
		<path d="M6 3h8l5 5v13H6z" />
		<path d="M14 3v5h5" />
		<path d="M9 13h7" />
		<path d="M9 17h5" />
	</IconFrame>
);

export const ChevronDownIcon = (props: IconProps) => (
	<IconFrame {...props}>
		<path d="M6 9.5l6 6 6-6" />
	</IconFrame>
);

export const PlusIcon = (props: IconProps) => (
	<IconFrame {...props}>
		<path d="M12 5v14" />
		<path d="M5 12h14" />
	</IconFrame>
);

export const ExternalIcon = (props: IconProps) => (
	<IconFrame {...props}>
		<path d="M10 5H5.5A1.5 1.5 0 0 0 4 6.5v12A1.5 1.5 0 0 0 5.5 20h12a1.5 1.5 0 0 0 1.5-1.5V14" />
		<path d="M14 4h6v6" />
		<path d="M20 4l-9 9" />
	</IconFrame>
);

type LogoMarkProps = {
	size?: number;
};

/** Three joints joined by two bones. Colors come from the palette tokens. */
export const LogoMark = ({ size = 28 }: LogoMarkProps) => (
	<svg
		xmlns="http://www.w3.org/2000/svg"
		width={size}
		height={size}
		viewBox="0 0 24 24"
		fill="none"
		aria-hidden="true"
		focusable="false"
	>
		<path
			d="M5 19L11 8l8 5"
			stroke="var(--signal)"
			strokeWidth={2}
			strokeLinecap="round"
			strokeLinejoin="round"
		/>
		<circle cx="5" cy="19" r="2.5" fill="var(--joint)" />
		<circle cx="11" cy="8" r="2.5" fill="var(--joint)" />
		<circle cx="19" cy="13" r="2.5" fill="var(--joint)" />
	</svg>
);
