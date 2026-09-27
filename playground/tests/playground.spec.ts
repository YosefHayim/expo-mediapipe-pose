import { expect, test } from "@playwright/test";

test("real model detects a sample, styles update without reloading, and empty results clear", async ({
	page,
}) => {
	const errors: string[] = [];
	const requests: string[] = [];
	page.on("requestfinished", (request) => requests.push(request.url()));
	page.on("pageerror", (error) => errors.push(error.message));
	const workerCreated = page.waitForEvent("worker");
	await page.goto("./");
	const worker = await workerCreated;
	expect(worker.url()).toMatch(/^blob:/);
	await expect(
		page.getByRole("img", { name: /Skeleton overlay: [1-9]/ }),
	).toBeVisible({ timeout: 60000 });
	await expect(
		page.getByText("Detection ready", { exact: true }),
	).toBeVisible();
	await page.getByLabel("Skeleton color", { exact: true }).fill("#ff0088");
	await expect(page.locator(".skeleton circle").first()).toHaveAttribute(
		"fill",
		"#ff0088",
	);
	let releaseImage = () => {};
	const imageGate = new Promise<void>((resolve) => {
		releaseImage = resolve;
	});
	await page.route("**/burger.jpg", async (route) => {
		await imageGate;
		await route.continue();
	});
	await page.getByLabel("Sample scene").selectOption("burger.jpg");
	await expect(page.getByText("Ready", { exact: true })).toBeVisible();
	await expect(page.locator(".skeleton circle")).toHaveCount(0);
	releaseImage();
	await expect(
		page.getByText("No person detected", { exact: true }),
	).toBeVisible({ timeout: 60000 });
	await expect(page.locator(".skeleton circle")).toHaveCount(0);
	expect(errors).toEqual([]);
	const currentWorker = page.workers()[0];
	expect(currentWorker).toBeDefined();
	const blockedDirective = await currentWorker?.evaluate(
		() =>
			new Promise<string>((resolve) => {
				self.addEventListener(
					"securitypolicyviolation",
					(event) => resolve(event.violatedDirective),
					{ once: true },
				);
				void fetch("https://example.com/pose-privacy-probe").catch(() => {});
			}),
	);
	expect(blockedDirective).toBe("connect-src");
	const origin = new URL(page.url()).origin;
	expect(
		requests.filter(
			(url) => url.startsWith("http") && new URL(url).origin !== origin,
		),
	).toEqual([]);
});

test("multi-pose, segmentation, code export and configuration sharing", async ({
	page,
	context,
}) => {
	await context.grantPermissions(["clipboard-read", "clipboard-write"]);
	await page.goto("./");
	await page
		.getByRole("button", { name: "Multiple poses", exact: false })
		.click();
	await expect(
		page.locator(".metrics").getByText("2", { exact: true }),
	).toBeVisible({ timeout: 60000 });
	await page
		.getByRole("button", { name: "Segmentation", exact: false })
		.click();
	await expect(page.locator("canvas.mask")).toBeVisible({ timeout: 60000 });
	const alpha = await page
		.locator("canvas.mask")
		.evaluate((element: HTMLCanvasElement) => {
			const data = element
				.getContext("2d")
				?.getImageData(0, 0, element.width, element.height).data;
			return (
				data &&
				Array.from(data).filter((value, i) => i % 4 === 3 && value > 127).length
			);
		});
	expect(alpha).toBeGreaterThan(100);
	await page.getByRole("button", { name: "Copy share link" }).click();
	const link = await page.evaluate(() => navigator.clipboard.readText());
	await page.goto(link);
	await page.getByText("Segmentation", { exact: true }).last().click();
	await expect(page.getByLabel("Enable segmentation")).toBeChecked();
	await page.getByRole("button", { name: "Copy Expo code" }).click();
	const code = await page.evaluate(() => navigator.clipboard.readText());
	expect(code).toContain("segmentationEnabled={true}");
	expect(code).toContain("releasePoseSegmentation");
});

test("uploads, video sampling, recording and replay work", async ({ page }) => {
	await page.goto("./");
	await page.getByRole("button", { name: "Photo", exact: true }).click();
	await page
		.getByLabel("Choose an image")
		.setInputFiles("../example/fixtures/pose.jpg");
	await expect(
		page.getByRole("img", { name: /Skeleton overlay: [1-9]/ }),
	).toBeVisible({ timeout: 60000 });
	await page.getByRole("button", { name: "Video", exact: true }).click();
	await page.getByRole("button", { name: "Try sample video" }).click();
	await expect(page.getByText("Ready", { exact: true })).toBeVisible({
		timeout: 60000,
	});
	await page.locator("video").evaluate((video: HTMLVideoElement) => {
		video.loop = true;
		return video.play();
	});
	await expect(
		page.getByRole("img", { name: /Skeleton overlay: [1-9]/ }),
	).toBeVisible();
	await page.getByRole("button", { name: "Record", exact: true }).click();
	await page
		.getByRole("button", { name: "Record landmarks", exact: true })
		.click();
	await expect(
		page.getByText(/\d+ frames captured · recording/),
	).not.toHaveText("0 frames captured · recording");
	await page.getByRole("button", { name: "Stop recording" }).click();
	await page.locator("video").evaluate((element: HTMLVideoElement) => {
		(window as unknown as { previousVideo: HTMLVideoElement }).previousVideo =
			element;
	});
	await page.getByRole("button", { name: "Replay", exact: true }).click();
	expect(
		await page.evaluate(
			() =>
				(window as unknown as { previousVideo: HTMLVideoElement }).previousVideo
					.paused,
		),
	).toBe(true);
	await page.getByRole("button", { name: "Use last recording" }).click();
	await expect(
		page.getByRole("img", { name: /Skeleton overlay: [1-9]/ }),
	).toBeVisible();
	await page.getByRole("button", { name: "Play replay" }).click();
});

test("camera tracks stop on source change and permission denial recovers", async ({
	page,
	context,
}) => {
	await page.goto("./");
	await page.getByRole("button", { name: "Webcam" }).click();
	await expect(page.locator("video")).toHaveJSProperty("readyState", 4, {
		timeout: 30000,
	});
	await page.evaluate(() => {
		const video = document.querySelector("video");
		(window as unknown as { oldStream: MediaStream }).oldStream =
			video?.srcObject as MediaStream;
	});
	await page.getByRole("button", { name: "Sample", exact: true }).click();
	expect(
		await page.evaluate(() =>
			(window as unknown as { oldStream: MediaStream }).oldStream
				.getTracks()
				.every((track) => track.readyState === "ended"),
		),
	).toBe(true);
	await context.clearPermissions();
	await page.evaluate(() => {
		navigator.mediaDevices.getUserMedia = () =>
			Promise.reject(new DOMException("Permission denied", "NotAllowedError"));
	});
	await page.getByRole("button", { name: "Webcam" }).click();
	await expect(page.getByRole("alert")).toContainText("Permission denied");
	await page.getByRole("button", { name: "Use a sample" }).click();
	await expect(
		page.getByRole("img", { name: /Skeleton overlay: [1-9]/ }),
	).toBeVisible({ timeout: 60000 });
});

test("mobile layout and invalid shared configuration remain usable", async ({
	page,
}) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto("./#config=broken");
	await expect(page.getByText(/shared configuration is invalid/)).toBeVisible();
	expect(
		await page.evaluate(
			() => document.documentElement.scrollWidth <= innerWidth,
		),
	).toBe(true);
	await page.keyboard.press("Tab");
	await expect(
		page.getByRole("link", { name: "Skip to playground" }),
	).toBeFocused();
	await page.screenshot({ path: "test-results/mobile.png", fullPage: true });
});

test("empty native recordings are an explicit empty replay", async ({
	page,
}) => {
	await page.goto("./");
	await page.getByRole("button", { name: "Replay", exact: true }).click();
	const importRecording = page.getByLabel("Import landmark recording");
	await importRecording.setInputFiles({
		name: "empty.json",
		mimeType: "application/json",
		buffer: Buffer.from(JSON.stringify({ version: 1, frames: [] })),
	});
	await expect(
		page.getByText(/This recording contains no frames/),
	).toBeVisible();
	await expect(
		page.getByRole("button", { name: "Play replay" }),
	).toBeDisabled();
});

test("threshold edits keep invalid drafts and export only valid bounded values", async ({
	page,
	context,
}) => {
	await context.grantPermissions(["clipboard-read", "clipboard-write"]);
	await page.goto("./");
	await page
		.locator(".presets")
		.getByRole("button", { name: "Arm feedback", exact: false })
		.click();
	await page.locator("summary").filter({ hasText: "Feedback rules" }).click();
	const enter = page.getByLabel("Enter Threshold", { exact: true });
	const exit = page.getByLabel("Exit Threshold", { exact: true });
	await enter.fill("105");
	await expect(enter).toHaveValue("105");
	await expect(page.getByRole("alert")).toContainText("last valid values");
	await exit.fill("115");
	await expect(page.getByRole("alert")).toHaveCount(0);
	await exit.fill("20000");
	await expect(page.getByRole("alert")).toContainText("10,000");
	await page.getByLabel("Pass direction").selectOption("above");
	await expect(page.getByRole("alert")).toHaveCount(0);
	await expect(enter).toHaveValue("115");
	await expect(exit).toHaveValue("105");
	await page.getByRole("button", { name: "Copy share link" }).click();
	const link = await page.evaluate(() => navigator.clipboard.readText());
	await page.goto(link);
	await expect(page.getByText(/shared configuration is invalid/)).toHaveCount(
		0,
	);
});
