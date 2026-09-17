import React, { useEffect, useRef } from 'react';
import { requireNativeComponent, UIManager, Platform, findNodeHandle, View, PixelRatio, NativeModules, NativeEventEmitter, Dimensions } from 'react-native';
const {
  width: deviceWidth,
  height: deviceHeight
} = Dimensions.get('window');
const LINKING_ERROR = `The package '@thinksys/react-native-mediapipe' doesn't seem to be linked. Make sure: \n\n` + Platform.select({
  ios: "- You have run 'pod install'\n",
  default: ''
}) + '- You rebuilt the app after installing the package\n' + '- You are not using Expo Go\n';
const {
  MediaPipeNativeModule,
  TsMediapipeViewManager
} = NativeModules;
const isAndroid = Platform.OS === 'android';
const ComponentName = isAndroid ? 'TsMediapipeViewManager' : 'TsMediapipeView';
const switchCamera = isAndroid ? MediaPipeNativeModule.switchCameraMethod : TsMediapipeViewManager.switchCamera;
const TsMediapipe = UIManager.getViewManagerConfig(ComponentName) != null ? requireNativeComponent(ComponentName) : () => {
  throw new Error(LINKING_ERROR);
};
const createFragment = viewId => {
  var _UIManager$TsMediapip;
  return UIManager.dispatchViewManagerCommand(viewId, (_UIManager$TsMediapip = UIManager.TsMediapipeViewManager) === null || _UIManager$TsMediapip === void 0 || (_UIManager$TsMediapip = _UIManager$TsMediapip.Commands) === null || _UIManager$TsMediapip === void 0 ? void 0 : _UIManager$TsMediapip.create.toString(), [viewId]);
};
const TsMediapipeView = props => {
  const {
    onLandmark,
    height = deviceHeight,
    width = deviceWidth,
    face = true,
    rightArm = true,
    leftArm = true,
    leftWrist = true,
    rightWrist = true,
    torso = true,
    leftLeg = true,
    rightLeg = true,
    leftAnkle = true,
    rightAnkle = true,
    frameLimit = 20 // ios only(set the frame rate during initialization)
  } = props;
  const ref = useRef(null);
  useEffect(() => {
    const viewId = findNodeHandle(ref.current);
    if (isAndroid) {
      createFragment(viewId);
    }
  }, []);
  const bodyLandmark = e => {
    if (!isAndroid && onLandmark) {
      onLandmark(e.nativeEvent);
    }
  };
  useEffect(() => {
    let subscription;
    if (isAndroid) {
      const mediaPipeEventEmitter = new NativeEventEmitter();
      subscription = mediaPipeEventEmitter.addListener('onLandmark', e => {
        onLandmark && onLandmark(e);
      });
    }
    return () => {
      var _subscription;
      (_subscription = subscription) === null || _subscription === void 0 || _subscription.remove();
    };
  }, []);
  return /*#__PURE__*/React.createElement(View, {
    style: [props === null || props === void 0 ? void 0 : props.style, {
      height: height,
      width: width,
      zIndex: 0
    }]
  }, /*#__PURE__*/React.createElement(TsMediapipe, {
    height: isAndroid ? PixelRatio.getPixelSizeForLayoutSize(height) : height,
    width: isAndroid ? PixelRatio.getPixelSizeForLayoutSize(width) : width,
    onLandmark: bodyLandmark,
    face: face,
    leftArm: leftArm,
    rightArm: rightArm,
    leftWrist: leftWrist,
    rightWrist: rightWrist,
    torso: torso,
    leftLeg: leftLeg,
    rightLeg: rightLeg,
    leftAnkle: leftAnkle,
    rightAnkle: rightAnkle,
    ref: ref,
    frameLimit: frameLimit // ios only(set the frame rate during initialization)
  }));
};
export { TsMediapipeView as RNMediapipe, switchCamera };
//# sourceMappingURL=index.js.map