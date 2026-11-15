import type { ReactNode } from "react";

export type StatusKind = "yes" | "no" | "partial";

const STATUS_LABELS: Record<StatusKind, string> = {
	yes: "Yes",
	no: "No",
	partial: "Partly",
};

const STATUS_SHAPES: Record<StatusKind, ReactNode> = {
	yes: <path pathLength="1" d="M4.5 12.5l5 5 10-11" />,
	no: (
		<>
			<path pathLength="1" d="M6 6l12 12" />
			<path pathLength="1" d="M18 6L6 18" />
		</>
	),
	partial: (
		<>
			<path pathLength="1" d="M12 3a9 9 0 1 0 0 18" />
			<path pathLength="1" d="M12 3a9 9 0 0 1 0 18" opacity="0.4" />
		</>
	),
};

type StatusMarkProps = {
	kind: StatusKind;
};

/** A check, a cross or a half circle, drawn once when its table is revealed. */
export const StatusMark = ({ kind }: StatusMarkProps) => (
	<span className={`status-mark status-mark-${kind}`}>
		<svg
			xmlns="http://www.w3.org/2000/svg"
			width="20"
			height="20"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden="true"
			focusable="false"
		>
			{STATUS_SHAPES[kind]}
		</svg>
		<span className="visually-hidden">{STATUS_LABELS[kind]}: </span>
	</span>
);
