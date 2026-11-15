import { useCopyFeedback } from "@/landing/agents/use-copy-feedback";
import { CheckIcon, CopyIcon } from "@/landing/icons/icons";

type CopyPromptButtonProps = {
	text: string;
};

export const CopyPromptButton = ({ text }: CopyPromptButtonProps) => {
	const { isCopied, copy } = useCopyFeedback(text);
	const icon = isCopied ? <CheckIcon size={18} /> : <CopyIcon size={18} />;
	const label = isCopied ? "Copied" : "Copy prompt";
	const announcement = isCopied ? "Prompt copied to the clipboard." : "";

	return (
		<>
			<button type="button" className="copy-prompt-button" onClick={copy}>
				{icon}
				<span>{label}</span>
			</button>
			<span className="visually-hidden" role="status" aria-live="polite">
				{announcement}
			</span>
		</>
	);
};
