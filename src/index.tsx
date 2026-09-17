import React, { useEffect, useRef, type MutableRefObject } from 'react';
import {
  requireNativeComponent,
  UIManager,
  Platform,
  type ViewStyle,
  findNodeHandle,
  View,
  PixelRatio,
  NativeModules,
  NativeEventEmitter,
  type EmitterSubscription,
  Dimensions,
} from 'react-native';

const { width: deviceWidth, height: deviceHeight } = Dimensions.get('window');

const LINKING_ERROR =
  `The package '@thinksys/react-native-mediapipe' doesn't seem to be linked. Make sure: \n\n` +
  Platform.select({ ios: "- You have run 'pod install'\n", default: '' }) +
  '- You rebuilt the app after installing the package\n' +
  '- You are not using Expo Go\n';

type TsMediapipeProps = {
  ref?: MutableRefObject<View | null>;
  onLandmark?: (event: any) => void;
  onCameraConfigured?: (configuration: CameraConfiguration) => void;
  onInferenceError?: (error: InferenceError) => void;
  onRecordingFinished?: (event: { uri: string }) => void;
  face?: boolean;
  leftArm?: boolean;
  rightArm?: boolean;
  leftWrist?: boolean;
  rightWrist?: boolean;
  torso?: boolean;
  leftLeg?: boolean;
  rightLeg?: boolean;
  leftAnkle?: boolean;
  rightAnkle?: boolean;
  height?: number;
  width?: number;
  poseStarted?: number;
  frameLimit?: number; // ios only(set the frame rate during initialization)
  cameraFacing?: 'front' | 'back';
  cameraLens?: 'auto' | 'wide' | 'ultraWide';
  cameraZoomFactor?: number;
  poseModelAssetPath?: string | null;
  poseModelVariant?: 'lite' | 'full' | 'heavy';
  recordSession?: boolean; // iOS only: raw camera recording for local motion diagnostics
};

type CameraConfiguration = {
  appliedZoomFactor: number;
  captureHeight: number;
  captureWidth: number;
  effectiveFacing: 'front' | 'back';
  effectiveLens: 'wide' | 'ultraWide';
  mirrored: boolean;
};

type InferenceError = {
  code:
    | 'cameraConfiguration'
    | 'cameraPermission'
    | 'cameraRuntime'
    | 'inferenceRuntime'
    | 'modelInitialization'
    | 'nativeViewInitialization';
};

type MediapipeComponentProps = TsMediapipeProps & {
  style?: ViewStyle;
};

const { MediaPipeNativeModule, TsMediapipeViewManager } = NativeModules;

const isAndroid = Platform.OS === 'android';

const ComponentName = isAndroid ? 'TsMediapipeViewManager' : 'TsMediapipeView';

const switchCamera = isAndroid
  ? MediaPipeNativeModule.switchCameraMethod
  : TsMediapipeViewManager.switchCamera;

const TsMediapipe =
  UIManager.getViewManagerConfig(ComponentName) != null
    ? requireNativeComponent<TsMediapipeProps>(ComponentName)
    : () => {
        throw new Error(LINKING_ERROR);
      };

const createFragment = (viewId: any) =>
  UIManager.dispatchViewManagerCommand(
    viewId,
    UIManager.TsMediapipeViewManager?.Commands?.create.toString(),
    [viewId]
  );

const unpackLandmarks = (landmarks: any) => {
  if (!Array.isArray(landmarks) || landmarks.length === 0 || typeof landmarks[0] !== 'number') {
    return landmarks;
  }
  const unpackedLandmarks = [];
  // Expand one native x/y/z/visibility/presence tuple into the public landmark object.
  for (let offset = 0; offset + 4 < landmarks.length; offset += 5) {
    const visibility = landmarks[offset + 3];
    const presence = landmarks[offset + 4];
    unpackedLandmarks.push({
      x: landmarks[offset],
      y: landmarks[offset + 1],
      z: landmarks[offset + 2],
      ...(visibility >= 0 ? { visibility } : {}),
      ...(presence >= 0 ? { presence } : {}),
    });
  }
  return unpackedLandmarks;
};

const landmarkFrameFromNativeEvent = (event: any) => {
  const landmarkFrame = typeof event === 'string' ? JSON.parse(event) : event;
  return {
    ...landmarkFrame,
    landmarks: unpackLandmarks(landmarkFrame.landmarks),
    worldLandmarks: unpackLandmarks(landmarkFrame.worldLandmarks),
  };
};

const TsMediapipeView: React.FC<MediapipeComponentProps> = (props) => {
  const {
    onLandmark,
    onCameraConfigured,
    onInferenceError,
    onRecordingFinished,
    poseModelAssetPath = null,
    poseModelVariant = 'full',
    recordSession = false,
    cameraFacing = 'front',
    cameraLens = 'auto',
    cameraZoomFactor = 1,
    height = deviceHeight,
    width = deviceWidth,
    // Oly: default native limb overlay OFF so PoseSkeletonOverlay is the only draw.
    // Landmarks still stream via onLandmark regardless of these toggles.
    face = false,
    rightArm = false,
    leftArm = false,
    leftWrist = false,
    rightWrist = false,
    torso = false,
    leftLeg = false,
    rightLeg = false,
    leftAnkle = false,
    rightAnkle = false,
    frameLimit = 30, // iOS: full-model cadence without inference backlog or thermal throttling.
  } = props;
  const ref = useRef(null);
  const cameraConfiguredRef = useRef(false);
  const nativeViewIdRef = useRef<number | null>(null);
  const safeCameraZoomFactor = Math.max(1, cameraZoomFactor);

  useEffect(() => {
    const viewId = findNodeHandle(ref.current);
    nativeViewIdRef.current = viewId;
    if (isAndroid) {
      createFragment(viewId);
    }
  }, []);

  useEffect(() => {
    cameraConfiguredRef.current = false;
  }, [cameraFacing, cameraLens, safeCameraZoomFactor]);

  const acknowledgeAndroidCamera = (landmarkFrame: any) => {
    if (!isAndroid || cameraConfiguredRef.current || !onCameraConfigured) return;
    const additionalData = landmarkFrame?.additionalData;
    if (!additionalData?.width || !additionalData?.height) return;
    cameraConfiguredRef.current = true;
    onCameraConfigured({
      appliedZoomFactor: 1,
      captureHeight: additionalData.height,
      captureWidth: additionalData.width,
      effectiveFacing: cameraFacing,
      effectiveLens: 'wide',
      mirrored: cameraFacing === 'front',
    });
  };

  const bodyLandmark = (e: any) => {
    if (!isAndroid && onLandmark) {
      onLandmark(landmarkFrameFromNativeEvent(e.nativeEvent));
    }
  };

  const recordingFinished = (e: any) => {
    if (!isAndroid && onRecordingFinished) {
      onRecordingFinished(e.nativeEvent);
    }
  };

  const cameraConfigured = (e: any) => {
    if (!isAndroid && onCameraConfigured) {
      cameraConfiguredRef.current = true;
      onCameraConfigured(e.nativeEvent);
    }
  };

  const inferenceError = (e: any) => {
    if (!isAndroid && onInferenceError) {
      onInferenceError(e.nativeEvent);
    }
  };

  const androidInferenceError = (nativeEvent: any) => {
    const nativeError = typeof nativeEvent === 'string' ? JSON.parse(nativeEvent) : nativeEvent;
    if (!onInferenceError || nativeError.viewId !== nativeViewIdRef.current) return;
    onInferenceError({ code: nativeError.code });
  };

  useEffect(() => {
    const subscriptions: EmitterSubscription[] = [];
    if (isAndroid) {
      const mediaPipeEventEmitter = new NativeEventEmitter();
      subscriptions.push(
        mediaPipeEventEmitter.addListener('onLandmark', (e) => {
          const landmarkFrame = landmarkFrameFromNativeEvent(e);
          acknowledgeAndroidCamera(landmarkFrame);
          onLandmark && onLandmark(landmarkFrame);
        }),
        mediaPipeEventEmitter.addListener('onInferenceError', androidInferenceError)
      );
    }

    return () => {
      subscriptions.forEach((subscription) => subscription.remove());
    };
  }, []);

  return (
    <View
      style={[
        props?.style,
        {
          height: height,
          width: width,
          zIndex: 0,
        },
      ]}
    >
      <TsMediapipe
        height={
          isAndroid ? PixelRatio.getPixelSizeForLayoutSize(height) : height
        }
        width={isAndroid ? PixelRatio.getPixelSizeForLayoutSize(width) : width}
        onLandmark={bodyLandmark}
        cameraFacing={cameraFacing}
        cameraLens={cameraLens}
        cameraZoomFactor={safeCameraZoomFactor}
        poseModelAssetPath={poseModelAssetPath}
        poseModelVariant={poseModelVariant}
        {...(!isAndroid
          ? {
              onCameraConfigured: cameraConfigured,
              onInferenceError: inferenceError,
              onRecordingFinished: recordingFinished,
              recordSession,
            }
          : {})}
        face={face}
        leftArm={leftArm}
        rightArm={rightArm}
        leftWrist={leftWrist}
        rightWrist={rightWrist}
        torso={torso}
        leftLeg={leftLeg}
        rightLeg={rightLeg}
        leftAnkle={leftAnkle}
        rightAnkle={rightAnkle}
        ref={ref}
        frameLimit={frameLimit} // ios only(set the frame rate during initialization)
      />
    </View>
  );
};

export { TsMediapipeView as RNMediapipe, switchCamera };
