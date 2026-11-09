import { requireNativeModule } from "expo";
import { SegmentationLeaseId } from "./mask";

export async function releasePoseSegmentation(leaseId: string): Promise<void> {
	SegmentationLeaseId.parse(leaseId);
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
	const leaseIdReply = SegmentationLeaseId.safeParse(segmentation.leaseId);
	if (!leaseIdReply.success) return;
	await releasePoseSegmentation(leaseIdReply.data);
}
