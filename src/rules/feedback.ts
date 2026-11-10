import type { SkeletonOptions } from "../skeleton/logic";
import type { PoseRuleStatus } from "./rule";

export type SkeletonAppearance = Pick<
	SkeletonOptions,
	"color" | "jointRadius" | "lineWidth" | "joints" | "connections"
>;
export interface SkeletonFeedback {
	status: PoseRuleStatus;
	styles: Partial<Record<PoseRuleStatus, SkeletonAppearance>>;
}
const mergeStyles = <Key extends string, Style extends object>(
	base: Partial<Record<Key, Style>> = {},
	overrides: Partial<Record<Key, Style>> = {},
): Partial<Record<Key, Style>> => {
	const merged = { ...base };
	for (const key of Object.keys(overrides) as Key[]) {
		const style = overrides[key];

		const isStyleMissing = style == null;
		if (isStyleMissing) continue;

		merged[key] = { ...base[key], ...style };
	}
	return merged;
};
export const composeSkeletonFeedback = (
	base: SkeletonOptions,
	feedback: readonly SkeletonFeedback[],
): SkeletonOptions => {
	let report = { ...base };
	for (const note of feedback) {
		const appearance = note.styles[note.status];

		const isAppearanceMissing = appearance == null;
		if (isAppearanceMissing) continue;

		report = {
			...report,
			...appearance,
			joints: mergeStyles(report.joints, appearance.joints),
			connections: mergeStyles(report.connections, appearance.connections),
		};
	}
	return report;
};
