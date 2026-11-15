import { useEffect, useState } from "react";
import { base, repository } from "@/playground/site";
import "./site-footer.css";

type BuildInformation = { library?: string };

export const SiteFooter = () => {
	const [version, setVersion] = useState<string | null>(null);

	useEffect(() => {
		const controller = new AbortController();
		fetch(`${base}version.json`, { signal: controller.signal })
			.then((response) => response.json() as Promise<BuildInformation>)
			.then((info) => setVersion(info.library ?? null))
			.catch(() => {});
		return () => controller.abort();
	}, []);

	return (
		<footer className="site-footer ground-paper">
			<div className="container site-footer-inner">
				<p>
					expo-mediapipe-pose is community-maintained and not an official Google
					or Expo package. MIT license.
					{version !== null && ` Library version ${version}.`}
				</p>
				<nav aria-label="Project links">
					<a href={repository} target="_blank" rel="noreferrer">
						GitHub
					</a>
					<a href={`${base}LICENSE`}>License</a>
					<a href={`${base}THIRD_PARTY_NOTICES.md`}>
						MediaPipe and sample attribution
					</a>
					<a href={`${base}version.json`}>Build information</a>
				</nav>
			</div>
		</footer>
	);
};
