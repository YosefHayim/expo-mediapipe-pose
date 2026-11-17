import { requireNativeModule } from "expo";
import { PersonMaskLeaseId } from "./person-mask";

export const releasePosePersonMask = async (leaseId: string): Promise<void> => {
	PersonMaskLeaseId.parse(leaseId);
	await requireNativeModule<{
		releasePosePersonMask(id: string): Promise<void>;
	}>("ExpoMediaPipePose").releasePosePersonMask(leaseId);
};
export const discardReportPersonMask = async (
	candidateAnalysis: unknown,
): Promise<void> => {
	const isCandidateAnalysisNotObject =
		typeof candidateAnalysis !== "object" || candidateAnalysis === null;
	if (isCandidateAnalysisNotObject) return;

	const isAnalysisWithoutPersonMask = !("personMask" in candidateAnalysis);
	if (isAnalysisWithoutPersonMask) return;

	const personMask = candidateAnalysis.personMask;

	const isPersonMaskNotObject =
		typeof personMask !== "object" || personMask === null;
	if (isPersonMaskNotObject) return;

	const isPersonMaskWithoutLease = !("leaseId" in personMask);
	if (isPersonMaskWithoutLease) return;

	const leaseIdReply = PersonMaskLeaseId.safeParse(personMask.leaseId);

	const isLeaseIdRejected = !leaseIdReply.success;
	if (isLeaseIdRejected) return;

	await releasePosePersonMask(leaseIdReply.data);
};
