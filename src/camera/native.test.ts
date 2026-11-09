import assert from "node:assert/strict";
import { describe, test, vi } from "vitest";

vi.mock("expo", async () => import("../testing/expo-stub"));

describe("getCameraCapabilities", () => {
	test("public discovery decodes native responses and propagates failures", async () => {
		let response: unknown = { status: "permissionRequired" };
		let failure: Error | undefined;
		const mockKey = Symbol.for("pose.nativeCapabilitiesTest");
		Object.defineProperty(globalThis, mockKey, {
			configurable: true,
			value: () => {
				if (failure) return Promise.reject(failure);

				return Promise.resolve(response);
			},
		});

		try {
			const { getCameraCapabilities } = await import("./native");

			assert.deepEqual(await getCameraCapabilities(), {
				status: "permissionRequired",
			});

			response = { status: "available", platform: "android", cameras: [] };
			await assert.rejects(getCameraCapabilities());

			response = { status: "unavailable" };
			assert.deepEqual(await getCameraCapabilities(), response);

			response = {
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
			assert.deepEqual(await getCameraCapabilities(), response);

			failure = new Error("native camera query failed");
			await assert.rejects(getCameraCapabilities(), failure);
		} finally {
			Reflect.deleteProperty(globalThis, mockKey);
		}
	});
});
