import type { FaqItem } from "@/landing/faq/faq-items";
import { FaqToggleIcon } from "@/landing/faq/faq-toggle-icon";
import { Reveal } from "@/landing/motion/reveal";

type FaqRowProps = {
	entry: FaqItem;
};

export const FaqRow = ({ entry }: FaqRowProps) => (
	<Reveal className="faq-row">
		<details className="faq-details">
			<summary className="faq-summary">
				<span className="faq-question">{entry.question}</span>
				<FaqToggleIcon />
			</summary>
			<div className="faq-answer">{entry.answer}</div>
		</details>
	</Reveal>
);
