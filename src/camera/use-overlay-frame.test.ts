import { strict as assert } from "node:assert";
import { JSDOM } from "jsdom";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { it, vi } from "vitest";
import { poseFrame } from "../testing/fixtures";
import { usePoseOverlayFrame } from "./use-overlay-frame";

interface OverlayHarnessProps {
	staleAfterMs: number;
	onOverlay: (overlay: ReturnType<typeof usePoseOverlayFrame>) => void;
}

const OverlayHarness = ({ staleAfterMs, onOverlay }: OverlayHarnessProps) => {
	onOverlay(usePoseOverlayFrame(staleAfterMs));
	return null;
};

it("reschedules existing overlay expiry from its arrival time when cadence changes", async () => {
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
	vi.spyOn(performance, "now").mockImplementation(() => now);
	vi.useFakeTimers({ toFake: ["setTimeout"] });
	let overlay: ReturnType<typeof usePoseOverlayFrame> | undefined;
	const currentOverlay = () => {
		assert.ok(overlay);
		return overlay;
	};
	const captureOverlay = (captured: ReturnType<typeof usePoseOverlayFrame>) => {
		overlay = captured;
	};
	const tick = async (elapsed: number) => {
		now += elapsed;
		await act(() => vi.advanceTimersByTime(elapsed));
	};
	try {
		await act(() =>
			root.render(
				createElement(OverlayHarness, {
					staleAfterMs: 500,
					onOverlay: captureOverlay,
				}),
			),
		);
		await act(() => currentOverlay().update(poseFrame()));
		await tick(200);
		await act(() =>
			root.render(
				createElement(OverlayHarness, {
					staleAfterMs: 2000,
					onOverlay: captureOverlay,
				}),
			),
		);
		await tick(400);
		assert.ok(currentOverlay().frame);
		await tick(1399);
		assert.ok(currentOverlay().frame);
		await tick(1);
		assert.equal(currentOverlay().frame, null);
		await act(() => currentOverlay().update(poseFrame()));
		await tick(600);
		await act(() =>
			root.render(
				createElement(OverlayHarness, {
					staleAfterMs: 500,
					onOverlay: captureOverlay,
				}),
			),
		);
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
		vi.useRealTimers();
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
