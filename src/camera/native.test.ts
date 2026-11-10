import assert from "node:assert/strict";
import { describe, test, vi } from "vitest";

vi.mock("expo", async () => import("../testing/expo-stub"));

describe("getCameraCapabilities", () => {
	test("public discovery decodes native responses and propagates failures", async () => {
		let reply: unknown = { status: "permissionRequired" };
		let failure: Error | null = null;
		const mockKey = Symbol.for("pose.nativeCapabilitiesTest");
		Object.defineProperty(globalThis, mockKey, {
			configurable: true,
			value: () => {
				if (failure) return Promise.reject(failure);

				return Promise.resolve(reply);
			},
		});

		try {
			const { getCameraCapabilities } = await import("./native");

			assert.deepEqual(await getCameraCapabilities(), {
				status: "permissionRequired",
			});

			reply = { status: "available", platform: "android", cameras: [] };
			await assert.rejects(getCameraCapabilities());

			reply = { status: "unavailable" };
			assert.deepEqual(await getCameraCapabilities(), reply);

			reply = {
				status: "available",
				platform: "android",
				cameras: [
					{
						facing: "front",
						lens: "wide",
						zoomRange: null,
						modes: [{ previewFps: 30, resolution: null }],
					},
				],
			};
			assert.deepEqual(await getCameraCapabilities(), reply);

			failure = new Error("native camera query failed");
			await assert.rejects(getCameraCapabilities(), failure);
		} finally {
			Reflect.deleteProperty(globalThis, mockKey);
		}
	});
});
