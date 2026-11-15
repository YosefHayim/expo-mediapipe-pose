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
			<div className="agent-prompt-frame">
				<section
					className="agent-prompt-code"
					// biome-ignore lint/a11y/noNoninteractiveTabindex: A scrollable code box must be reachable by keyboard.
					tabIndex={0}
					aria-label="Integration prompt text"
				>
					<pre>
						<code>{INTEGRATION_PROMPT}</code>
					</pre>
				</section>
			</div>
		</Reveal>
	</Section>
);
