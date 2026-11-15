import { FOOTER_COLUMNS } from "@/landing/footer/footer-links";
import { useLibraryVersion } from "@/landing/footer/use-library-version";
import { ExternalIcon } from "@/landing/icons/icons";
import { Reveal } from "@/landing/motion/reveal";
import { base } from "@/playground/site";
import "./site-footer.css";

export const SiteFooter = () => {
	const version = useLibraryVersion();
	const versionLine =
		version === null ? null : <p>Library version {version}.</p>;

	return (
		<footer className="site-footer ground-paper">
			<div className="container">
				<Reveal className="site-footer-top">
					<p className="site-footer-about">
						Community-maintained, on-device pose detection for Expo and React
						Native. Not an official Google or Expo package.
					</p>
					<nav className="site-footer-columns" aria-label="Footer">
						{FOOTER_COLUMNS.map((column) => (
							<div key={column.id} className="site-footer-column">
								<h2 className="site-footer-column-title">{column.title}</h2>
								<ul>
									{column.links.map((link) => (
										<li key={link.href}>
											<a
												href={link.href}
												target={link.isExternal ? "_blank" : undefined}
												rel={link.isExternal ? "noreferrer" : undefined}
											>
												{link.label}
												{link.isExternal ? <ExternalIcon size={12} /> : null}
											</a>
										</li>
									))}
								</ul>
							</div>
						))}
					</nav>
				</Reveal>
				<div className="site-footer-legal">
					<p>
						MIT license. Pose detection uses MediaPipe by Google, Apache 2.0.
						The camera integration is inspired by
						ThinkSys/mediapipe-reactnative, MIT. Full notices are in{" "}
						<a href={`${base}THIRD_PARTY_NOTICES.md`}>THIRD_PARTY_NOTICES.md</a>
						.
					</p>
					{versionLine}
				</div>
			</div>
		</footer>
	);
};
