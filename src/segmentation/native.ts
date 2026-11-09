import { requireNativeModule } from "expo";
import { SegmentationLeaseId } from "./mask";

export async function releasePoseSegmentation(leaseId: string): Promise<void> {
	SegmentationLeaseId.parse(leaseId);
	await requireNativeModule<{
		releasePoseSegmentation(id: string): Promise<void>;
	}>("ExpoMediaPipePose").releasePoseSegmentation(leaseId);
}
export async function discardResultSegmentation(
	candidateAnalysis: unknown,
): Promise<void> {
	if (typeof candidateAnalysis !== "object" || candidateAnalysis === null)
		return;
	if (!("segmentation" in candidateAnalysis)) return;
	const segmentation = candidateAnalysis.segmentation;
	if (typeof segmentation !== "object" || segmentation === null) return;
	if (!("leaseId" in segmentation)) return;
	const leaseIdReply = SegmentationLeaseId.safeParse(segmentation.leaseId);

	const isLeaseIdInvalid = !leaseIdReply.success;
	if (isLeaseIdInvalid) return;

	await releasePoseSegmentation(leaseIdReply.data);
}
