import { useMemo, useState } from "react";
import { FeatureGallery } from "@/gallery/feature-gallery";
import { AgentsSection } from "@/landing/agents/agents-section";
import { BrowserNativeTable } from "@/landing/compare/browser-native-table";
import { FaqSection } from "@/landing/faq/faq-section";
import { SiteFooter } from "@/landing/footer/site-footer";
import { Hero } from "@/landing/hero/hero";
import { SiteNav } from "@/landing/nav/site-nav";
import { PlaygroundSection } from "@/landing/playground/playground-section";
import { TickRule } from "@/landing/rule/tick-rule";
import { generateCode } from "@/playground/codegen";
import { createDefaultSettings } from "@/playground/config";
import {
	IntegrationSection,
	type IntegrationState,
} from "@/playground/screen/integration-section";
import type { MediaMode } from "@/playground/types";

/** Shows the default code until the live playground loads and takes over. */
const useIntegrationState = () => {
	const [live, setLive] = useState<IntegrationState | null>(null);
	const [fallbackMode, setFallbackMode] = useState<MediaMode>("camera");
	const fallbackCode = useMemo(
		() => generateCode(createDefaultSettings(), fallbackMode, false),
		[fallbackMode],
	);

	const fallback: IntegrationState = {
		code: fallbackCode,
		codeMode: fallbackMode,
		copy: async (snippet) => {
			try {
				await navigator.clipboard.writeText(snippet);
			} catch {
				// The code stays selectable in the panel.
			}
		},
		setCodeMode: setFallbackMode,
	};
	return { integration: live ?? fallback, setLive };
};

export const LandingPage = () => {
	const { integration, setLive } = useIntegrationState();

	return (
		<>
			<a className="skip-link" href="#playground">
				Skip to playground
			</a>
			<SiteNav />
			<main>
				<Hero />
				<FeatureGallery />
				<TickRule />
				<PlaygroundSection onIntegrationChange={setLive} />
				<BrowserNativeTable />
				<TickRule />
				<IntegrationSection {...integration} />
				<AgentsSection />
				<FaqSection />
			</main>
			<SiteFooter />
		</>
	);
};
