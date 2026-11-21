import { FilesetResolver, PoseLandmarker } from "@mediapipe/tasks-vision";
import {
	LANDMARK_NAMES,
	type LandmarkName,
	type PoseFrame,
	PoseSkeleton,
} from "expo-mediapipe-pose";
import {
	createElement,
	type ReactElement,
	useEffect,
	useRef,
	useState,
} from "react";
import { StyleSheet, Text, View } from "react-native";
import { countVisibleJoints, readWebPoseFrame } from "./read-web-pose-frame";

const SHOWN_JOINTS: readonly LandmarkName[] = [
	"nose",
	"leftShoulder",
	"rightShoulder",
	"leftWrist",
	"rightWrist",
	"leftAnkle",
	"rightAnkle",
];

export function WebPoseScreen(): ReactElement {
	const videoRef = useRef<HTMLVideoElement | null>(null);
	const [status, setStatus] = useState(
		"This browser preview is not in the npm package. The screen owns the frame.",
	);
	const [poseFrame, setPoseFrame] = useState<PoseFrame | null>(null);
	const [viewSize, setViewSize] = useState({ width: 0, height: 0 });

	useEffect(function watchBrowserPose() {
		const session: BrowserPoseSession = {
			stream: null,
			landmarker: null,
			frameHandle: 0,
			isStopped: false,
		};

		void startBrowserPose({
			session,
			videoRef,
			setStatus,
			setPoseFrame,
		});

		return function stopBrowserPose() {
			session.isStopped = true;
			cancelAnimationFrame(session.frameHandle);
			session.landmarker?.close();
			stopStream(session.stream);
		};
	}, []);

	const shownFrame = poseFrame;
	const jointLines = readJointLines(shownFrame);

	function showJointLine(line: JointLine) {
		return (
			<Text key={line.landmarkName} style={styles.note}>
				{line.text}
			</Text>
		);
	}

	function handleLayout(layoutEvent: {
		nativeEvent: { layout: { width: number; height: number } };
	}) {
		setViewSize({
			width: layoutEvent.nativeEvent.layout.width,
			height: layoutEvent.nativeEvent.layout.height,
		});
	}

	function showSkeleton(): ReactElement | null {
		const isFrameMissing = shownFrame == null;

		if (isFrameMissing) return null;

		const isWidthEmpty = viewSize.width <= 0;

		if (isWidthEmpty) return null;

		const isHeightEmpty = viewSize.height <= 0;

		if (isHeightEmpty) return null;

		return (
			<View style={styles.skeleton} pointerEvents="none">
				<PoseSkeleton
					poseFrame={shownFrame}
					viewWidth={viewSize.width}
					viewHeight={viewSize.height}
				/>
			</View>
		);
	}

	return (
		<View style={styles.screen}>
			<View style={styles.stage} onLayout={handleLayout}>
				<View style={styles.mirror}>
					{createElement("video", {
						ref: videoRef,
						autoPlay: true,
						muted: true,
						playsInline: true,
						style: {
							width: "100%",
							height: "100%",
							objectFit: "cover",
						},
					})}
					{showSkeleton()}
				</View>
			</View>
			<Text style={styles.note}>{status}</Text>
			<Text style={styles.note}>{readVisibleCount(shownFrame)}</Text>
			{jointLines.map(showJointLine)}
			<Text style={styles.note}>
				Add a log, a score, or another drawing in this screen. The package stays
				as it is.
			</Text>
		</View>
	);
}

interface BrowserPoseSession {
	stream: MediaStream | null;
	landmarker: PoseLandmarker | null;
	frameHandle: number;
	isStopped: boolean;
}

interface JointLine {
	landmarkName: LandmarkName;
	text: string;
}

interface BrowserPoseWatch {
	session: BrowserPoseSession;
	videoRef: { current: HTMLVideoElement | null };
	setStatus: (note: string) => void;
	setPoseFrame: (poseFrame: PoseFrame) => void;
}

async function startBrowserPose(watch: BrowserPoseWatch): Promise<void> {
	const session = watch.session;
	const videoRef = watch.videoRef;
	const setStatus = watch.setStatus;
	const setPoseFrame = watch.setPoseFrame;
	let stream: MediaStream;
	let landmarker: PoseLandmarker;

	try {
		stream = await navigator.mediaDevices.getUserMedia({
			audio: false,
			video: { facingMode: "user" },
		});
	} catch (error) {
		console.error({ error });
		setStatus("The browser did not open the camera.");
		return;
	}

	const isStoppedBeforeCamera = session.isStopped;

	if (isStoppedBeforeCamera) {
		stopStream(stream);
		return;
	}

	session.stream = stream;
	const video = videoRef.current;
	const isVideoMissing = video == null;

	if (isVideoMissing) {
		setStatus("The browser preview has no video element.");
		return;
	}

	video.srcObject = stream;

	try {
		await video.play();
	} catch (error) {
		console.error({ error });
		setStatus("The browser did not play the camera.");
		return;
	}

	try {
		landmarker = await openPoseLandmarker();
	} catch (error) {
		console.error({ error });
		setStatus("The browser pose model did not load.");
		return;
	}

	const isStoppedBeforeModel = session.isStopped;

	if (isStoppedBeforeModel) {
		landmarker.close();
		return;
	}

	session.landmarker = landmarker;
	setStatus("Front camera is open. The lite model is running in the browser.");

	function watchFrame() {
		const isStopped = session.isStopped;

		if (isStopped) return;

		const currentVideo = videoRef.current;
		const currentLandmarker = session.landmarker;
		const isVideoGone = currentVideo == null;

		if (isVideoGone) return;

		const isLandmarkerGone = currentLandmarker == null;

		if (isLandmarkerGone) return;

		const isSizeMissing = currentVideo.videoWidth <= 0;

		if (isSizeMissing) {
			session.frameHandle = requestAnimationFrame(watchFrame);
			return;
		}

		const timestampMs = Math.round(performance.now());

		try {
			const detected = currentLandmarker.detectForVideo(
				currentVideo,
				timestampMs,
			);
			const nextFrame = readWebPoseFrame({
				landmarks: detected.landmarks,
				worldLandmarks: detected.worldLandmarks,
				timestampMs,
				imageWidth: currentVideo.videoWidth,
				imageHeight: currentVideo.videoHeight,
			});

			setPoseFrame(nextFrame);
		} catch (error) {
			console.error({ error });
			setStatus("A browser frame could not be read.");
		}

		session.frameHandle = requestAnimationFrame(watchFrame);
	}

	session.frameHandle = requestAnimationFrame(watchFrame);
}

async function openPoseLandmarker(): Promise<PoseLandmarker> {
	const vision = await FilesetResolver.forVisionTasks(
		"https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.2.2/wasm",
	);
	const poseOptions = {
		baseOptions: {
			modelAssetPath:
				"https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
			delegate: "GPU" as const,
		},
		runningMode: "VIDEO" as const,
		numPoses: 1,
		minPoseDetectionConfidence: 0.5,
		minPosePresenceConfidence: 0.5,
		minTrackingConfidence: 0.5,
	};

	try {
		return await PoseLandmarker.createFromOptions(vision, poseOptions);
	} catch (error) {
		console.error({ error });
		return await PoseLandmarker.createFromOptions(vision, {
			...poseOptions,
			baseOptions: { ...poseOptions.baseOptions, delegate: "CPU" },
		});
	}
}

function stopStream(stream: MediaStream | null) {
	const isMissing = stream == null;

	if (isMissing) return;

	for (const track of stream.getTracks()) {
		track.stop();
	}
}

function readVisibleCount(poseFrame: PoseFrame | null): string {
	const isMissing = poseFrame == null;

	if (isMissing) return "No pose yet.";

	const visibleCount = countVisibleJoints(poseFrame);

	return `${visibleCount} of ${LANDMARK_NAMES.length} joints are in this frame.`;
}

function readJointLines(poseFrame: PoseFrame | null): JointLine[] {
	const isMissing = poseFrame == null;

	if (isMissing) return [];

	return SHOWN_JOINTS.map(function readShownJoint(landmarkName) {
		return {
			landmarkName,
			text: readJointLine(poseFrame, landmarkName),
		};
	});
}

function readJointLine(
	poseFrame: PoseFrame,
	landmarkName: LandmarkName,
): string {
	const point = poseFrame.landmarks[landmarkName];
	const isMissing = point == null;

	if (isMissing) return `${landmarkName} is not visible`;

	return `${landmarkName} ${point.x.toFixed(2)}, ${point.y.toFixed(2)}`;
}

const styles = StyleSheet.create({
	screen: { flex: 1, backgroundColor: "#09090b" },
	stage: { flex: 1 },
	mirror: { flex: 1, transform: [{ scaleX: -1 }] },
	skeleton: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0 },
	note: { color: "#fafafa", paddingHorizontal: 12, paddingBottom: 8 },
});
