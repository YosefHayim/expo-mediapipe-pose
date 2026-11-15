import { base, repository } from "@/playground/site";

type FooterLink = {
	label: string;
	href: string;
	isExternal: boolean;
};

export type FooterColumn = {
	id: string;
	title: string;
	links: readonly FooterLink[];
};

export const FOOTER_COLUMNS: readonly FooterColumn[] = [
	{
		id: "docs",
		title: "Docs",
		links: [
			{ label: "README", href: `${repository}#readme`, isExternal: true },
			{
				label: "API",
				href: `${repository}#api-and-scope`,
				isExternal: true,
			},
			{ label: "llms.txt", href: `${base}llms.txt`, isExternal: false },
			{ label: "SKILL.md", href: `${base}SKILL.md`, isExternal: false },
		],
	},
	{
		id: "project",
		title: "Project",
		links: [
			{ label: "GitHub", href: repository, isExternal: true },
			{ label: "Issues", href: `${repository}/issues`, isExternal: true },
			{
				label: "Changelog",
				href: `${repository}/blob/main/CHANGELOG.md`,
				isExternal: true,
			},
			{ label: "License", href: `${base}LICENSE`, isExternal: false },
		],
	},
];
