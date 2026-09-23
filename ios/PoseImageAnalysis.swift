import ExpoModulesCore
import ImageIO
import MediaPipeTasksVision
import UIKit

internal struct PoseImageOptions: Record {
  @Field var modelVariant: String = "full"
  @Field var modelPath: String? = nil
  @Field var maxImageDimension: Int = 2048
  @Field var minPoseDetectionConfidence: Double = 0.35
  @Field var minPosePresenceConfidence: Double = 0.35

  func validate() throws {
    guard (256...4096).contains(maxImageDimension) else { throw PoseMediaError.invalidOptions }
    let confidences = [minPoseDetectionConfidence, minPosePresenceConfidence]
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
      guard let source = CGImageSourceCreateWithURL(url as CFURL, nil) else {
        throw PoseMediaError.invalidImage
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
      configuration.baseOptions.delegate = .CPU
      configuration.runningMode = .image
      configuration.numPoses = 1
      configuration.minPoseDetectionConfidence = Float(options.minPoseDetectionConfidence)
      configuration.minPosePresenceConfidence = Float(options.minPosePresenceConfidence)
      let detector = try PoseLandmarker(options: configuration)
      let image = try MPImage(uiImage: UIImage(cgImage: pixels))
      let started = ProcessInfo.processInfo.systemUptime
      let result = try detector.detect(image: image)
      let duration = (ProcessInfo.processInfo.systemUptime - started) * 1000
      var payload = PoseLandmarkPayload.make(result)
      payload["imageSize"] = ["width": pixels.width, "height": pixels.height]
      payload["inferenceDurationMs"] = duration
      payload["model"] = [
        "variant": options.modelVariant, "delegate": "CPU",
        "source": options.modelPath == nil ? "bundled" : "local",
      ]
      return payload
    }
  }
}
