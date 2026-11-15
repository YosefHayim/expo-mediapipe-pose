import type { ComponentType } from "react";
import {
	AngleIcon,
	CameraIcon,
	GaugeIcon,
	type IconProps,
	MaskIcon,
	PeopleIcon,
	PhotoVideoIcon,
	RecordIcon,
	RulesIcon,
	SkeletonIcon,
} from "@/landing/icons/icons";
import type { MediaMode } from "@/playground/types";
import type { PreviewKind } from "./paint-gallery-preview";

export interface GalleryCard {
	id: string;
	title: string;
	text: string;
	icon: ComponentType<IconProps>;
	previewKind: PreviewKind;
	playgroundPreset: string;
	playgroundMode: MediaMode;
}

export interface GalleryGroup {
	id: string;
	title: string;
	cards: GalleryCard[];
}

export const GALLERY_GROUPS: GalleryGroup[] = [
	{
		id: "see-it",
		title: "See it",
		cards: [
			{
				id: "live-camera",
				title: "Live camera",
				text: "Mount PoseCameraView after permission is granted. It fills its layout bounds and draws the skeleton by default.",
				icon: CameraIcon,
				previewKind: "camera",
				playgroundPreset: "full",
				playgroundMode: "camera",
			},
			{
				id: "skeleton-style",
				title: "Skeleton style",
				text: "Choose body parts, color, line width and joint radius, with overrides for single joints and connections. Styling does not restart capture.",
				icon: SkeletonIcon,
				previewKind: "style",
				playgroundPreset: "arms",
				playgroundMode: "sample",
			},
			{
				id: "body-mask",
				title: "Body mask",
				text: "Composite opt-in masks with explicit cleanup and backpressure.",
				icon: MaskIcon,
				previewKind: "mask",
				playgroundPreset: "mask",
				playgroundMode: "sample",
			},
		],
	},
	{
		id: "measure-it",
		title: "Measure it",
		cards: [
			{
				id: "angles-and-distances",
				title: "Angles and distances",
				text: "Measure named angles and distances between landmarks, and react to pose presence.",
				icon: AngleIcon,
				previewKind: "angles",
				playgroundPreset: "arms",
				playgroundMode: "sample",
			},
			{
				id: "many-people",
				title: "Many people",
				text: "Select among multiple detected poses. Result indices are not persistent person identities.",
				icon: PeopleIcon,
				previewKind: "people",
				playgroundPreset: "multiple",
				playgroundMode: "sample",
			},
			{
				id: "photo-and-video",
				title: "Photo and video",
				text: "Analyze local photos and sample local videos, with cancellation. Your app supplies the file picker.",
				icon: PhotoVideoIcon,
				previewKind: "photo-video",
				playgroundPreset: "full",
				playgroundMode: "photo",
			},
		],
	},
	{
		id: "react-to-it",
		title: "React to it",
		cards: [
			{
				id: "rules-and-feedback",
				title: "Rules and feedback",
				text: "Evaluate independent rules with hysteresis. Missing or uncertain landmarks give unknown, which is different from a failed condition.",
				icon: RulesIcon,
				previewKind: "rules",
				playgroundPreset: "arms",
				playgroundMode: "sample",
			},
			{
				id: "record-and-replay",
				title: "Record and replay",
				text: "Record and replay bounded landmark sessions. Recordings hold landmarks and metadata, not camera video.",
				icon: RecordIcon,
				previewKind: "replay",
				playgroundPreset: "full",
				playgroundMode: "camera",
			},
			{
				id: "cameras-and-rates",
				title: "Cameras and rates",
				text: "Discover selectable cameras and frame rates, control preview, inference and callback rates, and inspect measured metrics.",
				icon: GaugeIcon,
				previewKind: "cameras",
				playgroundPreset: "full",
				playgroundMode: "camera",
			},
		],
	},
];
