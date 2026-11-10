import { requireNativeModule } from "expo";
import { SegmentationLeaseId } from "./mask";

export const releasePoseSegmentation = async (
	leaseId: string,
): Promise<void> => {
	SegmentationLeaseId.parse(leaseId);
	await requireNativeModule<{
		releasePoseSegmentation(id: string): Promise<void>;
	}>("ExpoMediaPipePose").releasePoseSegmentation(leaseId);
};
export const discardReportSegmentation = async (
	candidateAnalysis: unknown,
): Promise<void> => {
	const isCandidateAnalysisNotObject =
		typeof candidateAnalysis !== "object" || candidateAnalysis === null;
	if (isCandidateAnalysisNotObject) return;

	const isAnalysisWithoutSegmentation = !("segmentation" in candidateAnalysis);
	if (isAnalysisWithoutSegmentation) return;

	const segmentation = candidateAnalysis.segmentation;

	const isSegmentationNotObject =
		typeof segmentation !== "object" || segmentation === null;
	if (isSegmentationNotObject) return;

	const isSegmentationWithoutLease = !("leaseId" in segmentation);
	if (isSegmentationWithoutLease) return;

	const leaseIdReply = SegmentationLeaseId.safeParse(segmentation.leaseId);

	const isLeaseIdRejected = !leaseIdReply.success;
	if (isLeaseIdRejected) return;

	await releasePoseSegmentation(leaseIdReply.data);
};
