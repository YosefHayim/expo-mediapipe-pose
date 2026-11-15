import { AgentCardView } from "@/landing/agents/agent-card-view";
import { AGENT_CARDS } from "@/landing/agents/agent-cards";
import { CopyPromptButton } from "@/landing/agents/copy-prompt-button";
import { INTEGRATION_PROMPT } from "@/landing/agents/integration-prompt";
import { Reveal } from "@/landing/motion/reveal";
import { Section } from "@/landing/section/section";
import "./agents-section.css";

export const AgentsSection = () => (
	<Section
		id="agents"
		ground="paper"
		title="Made for you and your coding assistant."
		intro="Give your assistant the skill, the reading list or the repo rules, or hand it the prompt below. It has the facts and the limits, so it does not have to guess the API."
	>
		<ul className="agent-cards">
			{AGENT_CARDS.map((card, position) => (
				<AgentCardView key={card.id} card={card} position={position} />
			))}
		</ul>
		<Reveal className="agent-prompt">
			<div className="agent-prompt-bar">
				<h3 className="agent-prompt-title">Integration prompt</h3>
				<CopyPromptButton text={INTEGRATION_PROMPT} />
			</div>
			<pre className="agent-prompt-code">
				<code>{INTEGRATION_PROMPT}</code>
			</pre>
		</Reveal>
	</Section>
);
