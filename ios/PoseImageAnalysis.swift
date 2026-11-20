import ExpoModulesCore
import ImageIO
import MediaPipeTasksVision
import UIKit

internal struct PoseImageOptions: Record {
  @Field var personMaskEnabled: Bool = false
  @Field var maskMaxDimension: Int = 256
  @Field var maxPoses: Int = 1
  @Field var modelVariant: String = "full"
  @Field var modelPath: String? = nil
  @Field var poseDelegate: String = "gpu"
  @Field var maxImageDimension: Int = 2048
  @Field var minPoseDetectionConfidence: Double = 0.5
  @Field var minPosePresenceConfidence: Double = 0.5
  @Field var minTrackingConfidence: Double = 0.5

  func validate() throws {
    guard (64...512).contains(maskMaxDimension) else { throw PoseMediaError.invalidOptions }
    guard (1...6).contains(maxPoses) else { throw PoseMediaError.invalidOptions }
    guard (256...2048).contains(maxImageDimension) else { throw PoseMediaError.invalidOptions }
    guard ["gpu", "cpu"].contains(poseDelegate) else { throw PoseMediaError.invalidOptions }
    let confidences = [
      minPoseDetectionConfidence, minPosePresenceConfidence, minTrackingConfidence,
    ]
    guard confidences.allSatisfy({ $0.isFinite && (0...1).contains($0) }) else {
      throw PoseMediaError.invalidOptions
    }
  }
}

internal enum PoseImageAnalysis {
  static func analyze(_ location: String, options: PoseImageOptions) throws -> [String: Any] {
    try autoreleasepool {
      try options.validate()
      let url = try PoseModel.localURL(location)
      guard
        let source = CGImageSourceCreateWithURL(
          url as CFURL, [kCGImageSourceShouldCache: false] as CFDictionary)
      else {
        throw PoseMediaError.invalidImage
      }
      guard let properties = CGImageSourceCopyPropertiesAtIndex(source, 0, nil) as? [CFString: Any],
        let width = properties[kCGImagePropertyPixelWidth] as? NSNumber,
        let height = properties[kCGImagePropertyPixelHeight] as? NSNumber,
        width.doubleValue > 0, height.doubleValue > 0
      else { throw PoseMediaError.invalidImage }
      guard width.doubleValue * height.doubleValue <= 16_777_216 else {
        throw NSError(
          domain: "ExpoMediaPipePose", code: 1,
          userInfo: [
            NSLocalizedDescriptionKey:
              "Source image exceeds 16,777,216 pixels; resize it before analysis."
          ])
      }
      let decoding: [CFString: Any] = [
        kCGImageSourceCreateThumbnailFromImageAlways: true,
        kCGImageSourceCreateThumbnailWithTransform: true,
        kCGImageSourceThumbnailMaxPixelSize: options.maxImageDimension,
        kCGImageSourceShouldCacheImmediately: true,
      ]
      guard let pixels = CGImageSourceCreateThumbnailAtIndex(source, 0, decoding as CFDictionary)
      else { throw PoseMediaError.invalidImage }
      let configuration = PoseLandmarkerOptions()
      configuration.baseOptions.modelAssetPath = try PoseModel.path(
        variant: options.modelVariant, localPath: options.modelPath)
      configuration.baseOptions.delegate = try PoseModel.pickDelegate(options.poseDelegate)
      configuration.runningMode = .image
      configuration.numPoses = options.maxPoses
      configuration.shouldOutputSegmentationMasks = false
      configuration.minPoseDetectionConfidence = Float(options.minPoseDetectionConfidence)
      configuration.minPosePresenceConfidence = Float(options.minPosePresenceConfidence)
      configuration.minTrackingConfidence = Float(options.minTrackingConfidence)
      let detector = try PoseLandmarker(options: configuration)
      let image = try MPImage(uiImage: UIImage(cgImage: pixels))
      let started = ProcessInfo.processInfo.systemUptime
      let result = try detector.detect(image: image)
      let duration = (ProcessInfo.processInfo.systemUptime - started) * 1000
      var payload = try PoseLandmarkPayload.make(result)
      payload["imageSize"] = ["width": pixels.width, "height": pixels.height]
      payload["inferenceDurationMs"] = duration
      payload["model"] = [
        "variant": options.modelVariant, "delegate": options.poseDelegate,
        "source": options.modelPath == nil ? "bundled" : "local",
      ]
      return payload
    }
  }
}
