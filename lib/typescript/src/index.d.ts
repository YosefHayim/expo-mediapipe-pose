import React, { type MutableRefObject } from 'react';
import { type ViewStyle, View } from 'react-native';
type TsMediapipeProps = {
    ref?: MutableRefObject<View | null>;
    onLandmark?: (event: any) => void;
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
};
type MediapipeComponentProps = TsMediapipeProps & {
    style?: ViewStyle;
};
declare const switchCamera: any;
declare const TsMediapipeView: React.FC<MediapipeComponentProps>;
export { TsMediapipeView as RNMediapipe, switchCamera };
//# sourceMappingURL=index.d.ts.map