import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { test } from "node:test";

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
	const moduleURL = new URL("./stubs/expo.cjs", import.meta.url).href;
	const hooks = registerHooks({
		resolve(specifier, context, next) {
			if (specifier === "expo") return { url: moduleURL, shortCircuit: true };
			return next(specifier, context);
		},
	});
	try {
		const { getCameraCapabilities } = await import(
			"../src/native/cameraCapabilities"
		);
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
		hooks.deregister();
		Reflect.deleteProperty(globalThis, mockKey);
	}
});
