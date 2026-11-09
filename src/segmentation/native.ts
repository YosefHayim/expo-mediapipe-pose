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
	const isCandidateAnalysisTypeNotObjectOrMissing =
		typeof candidateAnalysis !== "object" || candidateAnalysis === null;
	if (isCandidateAnalysisTypeNotObjectOrMissing) return;

	const isSegmentationMissing = !("segmentation" in candidateAnalysis);
	if (isSegmentationMissing) return;

	const segmentation = candidateAnalysis.segmentation;

	const isSegmentationTypeNotObjectOrMissing =
		typeof segmentation !== "object" || segmentation === null;
	if (isSegmentationTypeNotObjectOrMissing) return;

	const isLeaseIdMissing = !("leaseId" in segmentation);
	if (isLeaseIdMissing) return;

	const leaseIdReply = SegmentationLeaseId.safeParse(segmentation.leaseId);

	const isLeaseIdInvalid = !leaseIdReply.success;
	if (isLeaseIdInvalid) return;

	await releasePoseSegmentation(leaseIdReply.data);
}
