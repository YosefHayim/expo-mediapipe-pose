import type { ReactNode } from "react";
import type { AgentCard } from "@/landing/agents/agent-cards";
import {
	DocumentIcon,
	ExternalIcon,
	RulesIcon,
	TerminalIcon,
} from "@/landing/icons/icons";
import { Reveal } from "@/landing/motion/reveal";

const CARD_ICONS: Record<AgentCard["id"], ReactNode> = {
	skill: <DocumentIcon size={32} className="agent-card-icon" />,
	llms: <TerminalIcon size={32} className="agent-card-icon" />,
	agents: <RulesIcon size={32} className="agent-card-icon" />,
};

type AgentCardViewProps = {
	card: AgentCard;
	position: number;
};

export const AgentCardView = ({ card, position }: AgentCardViewProps) => (
	<Reveal as="li" delay={position} className="agent-card">
		{CARD_ICONS[card.id]}
		<h3 className="agent-card-title">{card.title}</h3>
		<p className="agent-card-text">{card.description}</p>
		<ul className="agent-card-links">
			{card.links.map((link) => (
				<li key={link.href}>
					<a
						href={link.href}
						target={link.isExternal ? "_blank" : undefined}
						rel={link.isExternal ? "noreferrer" : undefined}
					>
						{link.label}
						{link.isExternal ? <ExternalIcon size={14} /> : null}
					</a>
				</li>
			))}
		</ul>
	</Reveal>
);
