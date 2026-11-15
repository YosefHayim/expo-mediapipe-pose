import type { ReactNode } from "react";
import { Reveal } from "@/landing/motion/reveal";
import "./section.css";

type SectionProps = {
	id: string;
	ground: "night" | "paper";
	title: ReactNode;
	intro?: ReactNode;
	children?: ReactNode;
};

/** A page section that starts with its heading. Nothing sits above the h2. */
export const Section = ({
	id,
	ground,
	title,
	intro,
	children,
}: SectionProps) => {
	const titleId = `${id}-title`;
	const hasIntro = intro !== undefined && intro !== null;

	return (
		<section
			id={id}
			className={`section ground-${ground}`}
			aria-labelledby={titleId}
		>
			<div className="container">
				<div className="section-heading-block">
					<Reveal as="h2" className="section-title">
						<span id={titleId}>{title}</span>
					</Reveal>
					{hasIntro && (
						<Reveal as="p" delay={1} className="section-intro lead">
							{intro}
						</Reveal>
					)}
				</div>
				{children !== undefined && (
					<div className="section-content">{children}</div>
				)}
			</div>
		</section>
	);
};
