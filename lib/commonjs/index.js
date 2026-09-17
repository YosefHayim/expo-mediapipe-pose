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
  const ref = (0, _react.useRef)(null);
  (0, _react.useEffect)(() => {
    const viewId = (0, _reactNative.findNodeHandle)(ref.current);
    if (isAndroid) {
      createFragment(viewId);
    }
  }, []);
  const bodyLandmark = e => {
    if (!isAndroid && onLandmark) {
      onLandmark(e.nativeEvent);
    }
  };
  (0, _react.useEffect)(() => {
    let subscription;
    if (isAndroid) {
      const mediaPipeEventEmitter = new _reactNative.NativeEventEmitter();
      subscription = mediaPipeEventEmitter.addListener('onLandmark', e => {
        onLandmark && onLandmark(e);
      });
    }
    return () => {
      var _subscription;
      (_subscription = subscription) === null || _subscription === void 0 || _subscription.remove();
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
//# sourceMappingURL=index.js.map