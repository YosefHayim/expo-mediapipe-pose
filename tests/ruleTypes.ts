import type { CameraConfiguration } from "../src/core";
import { usePoseRule } from "../src/hooks/usePoseRule";
import { usePoseRules } from "../src/hooks/usePoseRules";

export const RuleTypesHarness = () => {
	const rules = usePoseRules({
		wrist: {
			landmarks: ["leftWrist"],
			evaluate: (pose) => {
				// @ts-expect-error Only required landmarks are guaranteed to the predicate.
				const unselected = pose.rightWrist;
				void unselected;
				return pose.leftWrist.y < 0.5;
			},
		},
		elbow: {
			landmarks: ["leftElbow"],
			evaluate: (pose) => pose.leftElbow.y < 0.5,
		},
	});
	rules.reset("wrist");
	// @ts-expect-error Rule names are preserved by the collection.
	rules.reset("missing");
	// @ts-expect-error Unconfigured rules have no status.
	const missing = rules.statuses.missing;
	void missing;
	const single = usePoseRule({
		landmarks: ["leftWrist"],
		evaluate: () => true,
	});
	const onConfiguration: (configuration: CameraConfiguration) => void =
		single.reset;
	void onConfiguration;
	return null;
};
