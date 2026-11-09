import { base, repository } from "@/site";

export const SiteHeader = () => {
	return (
		<header className="site-header">
			<a className="brand" href={base}>
				<span className="brand-mark">
					p<span>•</span>
				</span>
				<span>
					pose<span className="brand-light"> / playground</span>
				</span>
			</a>
			<nav aria-label="Resources">
				<a href={repository} target="_blank" rel="noreferrer">
					GitHub ↗
				</a>
			</nav>
		</header>
	);
};
