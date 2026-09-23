import type { PoseRuleStatus } from "./poseRule";
import type { SkeletonOptions } from "./skeleton";

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
		if (!style) continue;
		merged[key] = { ...base[key], ...style };
	}
	return merged;
};
export const composeSkeletonFeedback = (
	base: SkeletonOptions,
	feedback: readonly SkeletonFeedback[],
): SkeletonOptions => {
	let result = { ...base };
	for (const entry of feedback) {
		const appearance = entry.styles[entry.status];
		if (!appearance) continue;
		result = {
			...result,
			...appearance,
			joints: mergeStyles(result.joints, appearance.joints),
			connections: mergeStyles(result.connections, appearance.connections),
		};
	}
	return result;
};
