import { Schema } from "effect";
import { requireNativeModule } from "expo";

export async function releasePoseSegmentation(leaseId: string): Promise<void> {
	Schema.decodeUnknownSync(Schema.UUID)(leaseId);
	await requireNativeModule<{
		releasePoseSegmentation(id: string): Promise<void>;
	}>("ExpoMediaPipePose").releasePoseSegmentation(leaseId);
}
export async function discardResultSegmentation(
	result: unknown,
): Promise<void> {
	if (typeof result !== "object" || result === null) return;
	if (!("segmentation" in result)) return;
	const segmentation = result.segmentation;
	if (typeof segmentation !== "object" || segmentation === null) return;
	if (!("leaseId" in segmentation)) return;
	if (!Schema.is(Schema.UUID)(segmentation.leaseId)) return;
	await releasePoseSegmentation(segmentation.leaseId);
}
