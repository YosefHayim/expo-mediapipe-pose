import { strict as assert } from "node:assert";
import { it } from "node:test";
import { JSDOM } from "jsdom";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { usePoseOverlayFrame } from "../src/hooks/usePoseOverlayFrame";
import { poseFrame } from "./fixtures";

it("reschedules existing overlay expiry from its arrival time when cadence changes", async (test) => {
	const dom = new JSDOM("<!doctype html><div id='root'></div>");
	const globalNames = ["window", "document", "IS_REACT_ACT_ENVIRONMENT"];
	const originalGlobals = globalNames.map((name) => ({
		name,
		descriptor: Object.getOwnPropertyDescriptor(globalThis, name),
	}));
	Object.defineProperty(globalThis, "window", {
		value: dom.window,
		configurable: true,
	});
	Object.defineProperty(globalThis, "document", {
		value: dom.window.document,
		configurable: true,
	});
	Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", {
		value: true,
		configurable: true,
	});
	const container = dom.window.document.getElementById("root");
	assert.ok(container);
	const root = createRoot(container);
	let now = 1000;
	test.mock.method(performance, "now", () => now);
	test.mock.timers.enable({ apis: ["setTimeout"] });
	let overlay: ReturnType<typeof usePoseOverlayFrame> | undefined;
	const currentOverlay = () => {
		assert.ok(overlay);
		return overlay;
	};
	const Harness = ({ staleAfterMs }: { staleAfterMs: number }) => {
		overlay = usePoseOverlayFrame(staleAfterMs);
		return null;
	};
	const tick = async (elapsed: number) => {
		now += elapsed;
		await act(() => test.mock.timers.tick(elapsed));
	};
	try {
		await act(() => root.render(createElement(Harness, { staleAfterMs: 500 })));
		await act(() => currentOverlay().update(poseFrame()));
		await tick(200);
		await act(() =>
			root.render(createElement(Harness, { staleAfterMs: 2000 })),
		);
		await tick(400);
		assert.ok(currentOverlay().frame);
		await tick(1399);
		assert.ok(currentOverlay().frame);
		await tick(1);
		assert.equal(currentOverlay().frame, null);
		await act(() => currentOverlay().update(poseFrame()));
		await tick(600);
		await act(() => root.render(createElement(Harness, { staleAfterMs: 500 })));
		assert.equal(currentOverlay().frame, null);
		await act(() => currentOverlay().update(poseFrame()));
		await tick(300);
		await act(() => currentOverlay().update(poseFrame()));
		await tick(300);
		assert.ok(currentOverlay().frame);
		await act(() => currentOverlay().clear());
		assert.equal(currentOverlay().frame, null);
		await tick(1000);
		assert.equal(currentOverlay().frame, null);
	} finally {
		await act(() => root.unmount());
		test.mock.timers.reset();
		dom.window.close();
		for (const { name, descriptor } of originalGlobals) {
			if (descriptor) {
				Object.defineProperty(globalThis, name, descriptor);
				continue;
			}
			Reflect.deleteProperty(globalThis, name);
		}
	}
});
