"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.switchCamera = exports.RNMediapipe = void 0;
var _react = _interopRequireWildcard(require("react"));
var _reactNative = require("react-native");
function _interopRequireWildcard(e, t) { if ("function" == typeof WeakMap) var r = new WeakMap(), n = new WeakMap(); return (_interopRequireWildcard = function (e, t) { if (!t && e && e.__esModule) return e; var o, i, f = { __proto__: null, default: e }; if (null === e || "object" != typeof e && "function" != typeof e) return f; if (o = t ? n : r) { if (o.has(e)) return o.get(e); o.set(e, f); } for (const t in e) "default" !== t && {}.hasOwnProperty.call(e, t) && ((i = (o = Object.defineProperty) && Object.getOwnPropertyDescriptor(e, t)) && (i.get || i.set) ? o(f, t, i) : f[t] = e[t]); return f; })(e, t); }
const {
  width: deviceWidth,
  height: deviceHeight
} = _reactNative.Dimensions.get('window');
const LINKING_ERROR = `The package '@thinksys/react-native-mediapipe' doesn't seem to be linked. Make sure: \n\n` + _reactNative.Platform.select({
  ios: "- You have run 'pod install'\n",
  default: ''
}) + '- You rebuilt the app after installing the package\n' + '- You are not using Expo Go\n';
const {
  MediaPipeNativeModule,
  TsMediapipeViewManager
} = _reactNative.NativeModules;
const isAndroid = _reactNative.Platform.OS === 'android';
const ComponentName = isAndroid ? 'TsMediapipeViewManager' : 'TsMediapipeView';
const switchCamera = exports.switchCamera = isAndroid ? MediaPipeNativeModule.switchCameraMethod : TsMediapipeViewManager.switchCamera;
const TsMediapipe = _reactNative.UIManager.getViewManagerConfig(ComponentName) != null ? (0, _reactNative.requireNativeComponent)(ComponentName) : () => {
  throw new Error(LINKING_ERROR);
};
const createFragment = viewId => {
  var _UIManager$TsMediapip;
  return _reactNative.UIManager.dispatchViewManagerCommand(viewId, (_UIManager$TsMediapip = _reactNative.UIManager.TsMediapipeViewManager) === null || _UIManager$TsMediapip === void 0 || (_UIManager$TsMediapip = _UIManager$TsMediapip.Commands) === null || _UIManager$TsMediapip === void 0 ? void 0 : _UIManager$TsMediapip.create.toString(), [viewId]);
};
const unpackLandmarks = landmarks => {
  if (!Array.isArray(landmarks) || landmarks.length === 0 || typeof landmarks[0] !== 'number') {
    return landmarks;
  }
  const unpackedLandmarks = [];
  for (let offset = 0; offset + 4 < landmarks.length; offset += 5) {
    const visibility = landmarks[offset + 3];
    const presence = landmarks[offset + 4];
    unpackedLandmarks.push({
      x: landmarks[offset],
      y: landmarks[offset + 1],
      z: landmarks[offset + 2],
      ...(visibility >= 0 ? {
        visibility
      } : {}),
      ...(presence >= 0 ? {
        presence
      } : {})
    });
  }
  return unpackedLandmarks;
};
const landmarkFrameFromNativeEvent = event => {
  const landmarkFrame = typeof event === 'string' ? JSON.parse(event) : event;
  return {
    ...landmarkFrame,
    landmarks: unpackLandmarks(landmarkFrame.landmarks),
    worldLandmarks: unpackLandmarks(landmarkFrame.worldLandmarks)
  };
};
const TsMediapipeView = props => {
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
    frameLimit = 30 // iOS: full-model cadence without inference backlog or thermal throttling.
  } = props;
  const ref = (0, _react.useRef)(null);
  const cameraConfiguredRef = (0, _react.useRef)(false);
  const nativeViewIdRef = (0, _react.useRef)(null);
  const safeCameraZoomFactor = Math.max(1, cameraZoomFactor);
  (0, _react.useEffect)(() => {
    const viewId = (0, _reactNative.findNodeHandle)(ref.current);
    nativeViewIdRef.current = viewId;
    if (isAndroid) {
      createFragment(viewId);
    }
  }, []);
  (0, _react.useEffect)(() => {
    cameraConfiguredRef.current = false;
  }, [cameraFacing, cameraLens, safeCameraZoomFactor]);
  const acknowledgeAndroidCamera = landmarkFrame => {
    if (!isAndroid || cameraConfiguredRef.current || !onCameraConfigured) return;
    const additionalData = landmarkFrame === null || landmarkFrame === void 0 ? void 0 : landmarkFrame.additionalData;
    if (!(additionalData !== null && additionalData !== void 0 && additionalData.width) || !(additionalData !== null && additionalData !== void 0 && additionalData.height)) return;
    cameraConfiguredRef.current = true;
    onCameraConfigured({
      appliedZoomFactor: 1,
      captureHeight: additionalData.height,
      captureWidth: additionalData.width,
      effectiveFacing: cameraFacing,
      effectiveLens: 'wide',
      mirrored: cameraFacing === 'front'
    });
  };
  const bodyLandmark = e => {
    if (!isAndroid && onLandmark) {
      onLandmark(landmarkFrameFromNativeEvent(e.nativeEvent));
    }
  };
  const recordingFinished = e => {
    if (!isAndroid && onRecordingFinished) {
      onRecordingFinished(e.nativeEvent);
    }
  };
  const cameraConfigured = e => {
    if (!isAndroid && onCameraConfigured) {
      cameraConfiguredRef.current = true;
      onCameraConfigured(e.nativeEvent);
    }
  };
  const inferenceError = e => {
    if (!isAndroid && onInferenceError) {
      onInferenceError(e.nativeEvent);
    }
  };
  const androidInferenceError = nativeEvent => {
    const nativeError = typeof nativeEvent === 'string' ? JSON.parse(nativeEvent) : nativeEvent;
    if (!onInferenceError || nativeError.viewId !== nativeViewIdRef.current) return;
    onInferenceError({
      code: nativeError.code
    });
  };
  (0, _react.useEffect)(() => {
    const subscriptions = [];
    if (isAndroid) {
      const mediaPipeEventEmitter = new _reactNative.NativeEventEmitter();
      subscriptions.push(mediaPipeEventEmitter.addListener('onLandmark', e => {
        const landmarkFrame = landmarkFrameFromNativeEvent(e);
        acknowledgeAndroidCamera(landmarkFrame);
        onLandmark && onLandmark(landmarkFrame);
      }), mediaPipeEventEmitter.addListener('onInferenceError', androidInferenceError));
    }
    return () => {
      subscriptions.forEach(subscription => subscription.remove());
    };
  }, []);
  return /*#__PURE__*/_react.default.createElement(_reactNative.View, {
    style: [props === null || props === void 0 ? void 0 : props.style, {
      height: height,
      width: width,
      zIndex: 0
    }]
  }, /*#__PURE__*/_react.default.createElement(TsMediapipe, {
    height: isAndroid ? _reactNative.PixelRatio.getPixelSizeForLayoutSize(height) : height,
    width: isAndroid ? _reactNative.PixelRatio.getPixelSizeForLayoutSize(width) : width,
    onLandmark: bodyLandmark,
    cameraFacing: cameraFacing,
    cameraLens: cameraLens,
    cameraZoomFactor: safeCameraZoomFactor,
    poseModelAssetPath: poseModelAssetPath,
    poseModelVariant: poseModelVariant,
    ...(!isAndroid ? {
      onCameraConfigured: cameraConfigured,
      onInferenceError: inferenceError,
      onRecordingFinished: recordingFinished,
      recordSession
    } : {}),
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
exports.RNMediapipe = TsMediapipeView;