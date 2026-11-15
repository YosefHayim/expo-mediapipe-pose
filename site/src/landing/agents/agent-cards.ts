import { base, repository } from "@/playground/site";

type AgentCardLink = {
	label: string;
	href: string;
	isExternal: boolean;
};

export type AgentCard = {
	id: "skill" | "llms" | "agents";
	title: string;
	description: string;
	links: readonly AgentCardLink[];
};

export const AGENT_CARDS: readonly AgentCard[] = [
	{
		id: "skill",
		title: "SKILL.md",
		description:
			"An Agent Skill with exact install steps, a minimal camera example, common tasks and common mistakes.",
		links: [
			{ label: "Read SKILL.md", href: `${base}SKILL.md`, isExternal: false },
			{
				label: "On GitHub",
				href: `${repository}/blob/main/skills/expo-mediapipe-pose/SKILL.md`,
				isExternal: true,
			},
		],
	},
	{
		id: "llms",
		title: "llms.txt",
		description:
			"A short reading list for language models: what the library is, what it is not, and where the API lives.",
		links: [
			{ label: "Read llms.txt", href: `${base}llms.txt`, isExternal: false },
		],
	},
	{
		id: "agents",
		title: "AGENTS.md",
		description:
			"Guidance for agents that change this repository: layout, checks and rules for contributions.",
		links: [
			{
				label: "On GitHub",
				href: `${repository}/blob/main/AGENTS.md`,
				isExternal: true,
			},
		],
	},
];
