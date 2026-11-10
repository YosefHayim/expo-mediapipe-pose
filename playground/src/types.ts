import type { Landmark, PoseLandmarks } from "expo-mediapipe-pose/core";
import type { Settings } from "./config";

export interface BrowserFrame {
	landmarks: Landmark[];
	worldLandmarks: Landmark[];
	poses: PoseLandmarks[];
	imageSize: { width: number; height: number };
	inferenceDurationMs: number;
}
export interface BrowserMask {
	width: number;
	height: number;
	values: Uint8Array;
}
export type WorkerRequest =
	| {
			type: "init";
			base: string;
			detection: Settings["detection"];
			model: ArrayBuffer | null;
			generation: number;
	  }
	| {
			type: "frame";
			image: ImageBitmap;
			timestamp: number;
			video: boolean;
			generation: number;
	  }
	| { type: "close" };
export type WorkerReply =
	| { type: "ready"; generation: number }
	| {
			type: "result";
			frame: BrowserFrame;
			masks: BrowserMask[];
			generation: number;
	  }
	| { type: "error"; message: string; generation: number };
export type MediaMode = "sample" | "camera" | "photo" | "video" | "replay";
