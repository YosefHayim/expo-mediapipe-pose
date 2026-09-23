import AVFoundation

struct PoseCameraOptions: Equatable {
  var facing = "front"
  var lens = "auto"
  var zoom = 1.0
  var previewFps = 30
  var segmentationEnabled: Bool = false
  var maskMaxDimension: Int = 256
  var maxPoses = 1
  var modelVariant = "full"
  var modelPath: String?
  var orientation = AVCaptureVideoOrientation.portrait
  var minPoseDetectionConfidence = 0.35
  var minPosePresenceConfidence = 0.35
  var minTrackingConfidence = 0.35
  var isValid: Bool {
    guard (64...512).contains(maskMaxDimension) else { return false }
    guard (1...6).contains(maxPoses) else { return false }
    guard ["front", "back"].contains(facing) else { return false }
    guard ["auto", "wide", "ultraWide"].contains(lens) else { return false }
    guard ["lite", "full", "heavy"].contains(modelVariant) else { return false }
    guard zoom.isFinite && zoom >= 1 else { return false }
    guard (1...60).contains(previewFps) else { return false }
    let confidenceValues = [
      minPoseDetectionConfidence, minPosePresenceConfidence, minTrackingConfidence,
    ]
    return confidenceValues.allSatisfy { $0.isFinite && (0...1).contains($0) }
  }
}
