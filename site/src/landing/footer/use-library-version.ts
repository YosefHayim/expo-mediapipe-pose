import { useEffect, useState } from "react";
import { z } from "zod";
import { base } from "@/playground/site";

const BuildInformation = z.object({ library: z.string().min(1) });

/** The library version from version.json, or null until it loads or if it fails. */
export const useLibraryVersion = () => {
	const [version, setVersion] = useState<string | null>(null);

	useEffect(() => {
		const controller = new AbortController();
		const load = async () => {
			try {
				const response = await fetch(`${base}version.json`, {
					signal: controller.signal,
				});
				const parsed = BuildInformation.safeParse(await response.json());
				if (parsed.success) setVersion(parsed.data.library);
			} catch {
				// The footer simply omits the version line.
			}
		};
		void load();
		return () => controller.abort();
	}, []);

	return version;
};
