import { FAQ_ITEMS } from "@/landing/faq/faq-items";
import { FaqRow } from "@/landing/faq/faq-row";
import { Section } from "@/landing/section/section";
import "./faq-section.css";

export const FaqSection = () => (
	<Section id="faq" title="Questions, answered.">
		<div className="faq-list">
			{FAQ_ITEMS.map((entry) => (
				<FaqRow key={entry.id} entry={entry} />
			))}
		</div>
	</Section>
);
