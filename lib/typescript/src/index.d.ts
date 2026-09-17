import React, { type MutableRefObject } from 'react';
import { type ViewStyle, View } from 'react-native';
type TsMediapipeProps = {
    ref?: MutableRefObject<View | null>;
    onLandmark?: (event: any) => void;
    onCameraConfigured?: (configuration: CameraConfiguration) => void;
    onInferenceError?: (error: InferenceError) => void;
    onRecordingFinished?: (event: {
        uri: string;
    }) => void;
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
    frameLimit?: number;
    cameraFacing?: 'front' | 'back';
    cameraLens?: 'auto' | 'wide' | 'ultraWide';
    cameraZoomFactor?: number;
    poseModelAssetPath?: string | null;
    poseModelVariant?: 'lite' | 'full' | 'heavy';
    recordSession?: boolean;
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
    code: 'cameraConfiguration' | 'cameraPermission' | 'cameraRuntime' | 'inferenceRuntime' | 'modelInitialization' | 'nativeViewInitialization';
};
type MediapipeComponentProps = TsMediapipeProps & {
    style?: ViewStyle;
};
declare const switchCamera: any;
declare const TsMediapipeView: React.FC<MediapipeComponentProps>;
export { TsMediapipeView as RNMediapipe, switchCamera };