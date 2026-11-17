export function verifyCheck(
	condition: boolean,
	message: string,
): asserts condition {
	const isCheckFailed = !condition;
	if (isCheckFailed) throw new Error(message);
}
