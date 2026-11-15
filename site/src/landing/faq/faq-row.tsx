import type { FaqItem } from "@/landing/faq/faq-items";
import { FaqToggleIcon } from "@/landing/faq/faq-toggle-icon";
import { Reveal } from "@/landing/motion/reveal";
import { AnimatedDetails } from "@/shared/animated-details";

type FaqRowProps = {
	entry: FaqItem;
};

export const FaqRow = ({ entry }: FaqRowProps) => (
	<Reveal className="faq-row">
		<AnimatedDetails
			className="faq-details"
			summaryClassName="faq-summary"
			summary={
				<>
					<span className="faq-question">{entry.question}</span>
					<FaqToggleIcon />
				</>
			}
		>
			<div className="faq-answer">{entry.answer}</div>
		</AnimatedDetails>
	</Reveal>
);
