import AVFoundation
import MediaPipeTasksVision
import UIKit

private final class PoseVideoSession {
  enum Phase { case ready, decoding }
  let id = UUID().uuidString
  let generator: AVAssetImageGenerator
  let durationMs: Double
  let options: PoseImageOptions
  var detector: PoseLandmarker?
  var lastTimestamp = -1
  var phase = Phase.ready

  init(asset: AVAsset, durationMs: Double, options: PoseImageOptions, trackingConfidence: Double)
    throws
  {
    self.durationMs = durationMs
    self.options = options
    generator = AVAssetImageGenerator(asset: asset)
    generator.appliesPreferredTrackTransform = true
    generator.maximumSize = CGSize(
      width: options.maxImageDimension, height: options.maxImageDimension)
    generator.requestedTimeToleranceBefore = .zero
    generator.requestedTimeToleranceAfter = .zero
    let configuration = PoseLandmarkerOptions()
    configuration.baseOptions.modelAssetPath = try PoseModel.path(
      variant: options.modelVariant, localPath: options.modelPath)
    configuration.baseOptions.delegate = .CPU
    configuration.runningMode = .video
    configuration.numPoses = options.maxPoses
    configuration.minPoseDetectionConfidence = Float(options.minPoseDetectionConfidence)
    configuration.minPosePresenceConfidence = Float(options.minPosePresenceConfidence)
    configuration.minTrackingConfidence = Float(trackingConfidence)
    detector = try PoseLandmarker(options: configuration)
  }

  func close() {
    generator.cancelAllCGImageGeneration()
    detector = nil
  }
}

internal final class PoseVideoAnalysis {
  let worker = DispatchQueue(label: "expo.pose.media")
  private var session: PoseVideoSession?
  private var destroyed = false

  private func onWorker<Value>(_ operation: @escaping () throws -> Value) async throws -> Value {
    try await withCheckedThrowingContinuation { continuation in
      worker.async {
        do { continuation.resume(returning: try operation()) } catch {
          continuation.resume(throwing: error)
        }
      }
    }
  }

  func open(_ location: String, options: PoseImageOptions, trackingConfidence: Double) async throws
    -> [String: Any]
  {
    try options.validate()
    guard trackingConfidence.isFinite, (0...1).contains(trackingConfidence) else {
      throw PoseMediaError.invalidOptions
    }
    let asset = AVURLAsset(url: try PoseModel.localURL(location))
    let duration = try await asset.load(.duration)
    let tracks = try await asset.loadTracks(withMediaType: .video)
    let durationMs = duration.seconds * 1000
    guard !tracks.isEmpty, durationMs.isFinite, durationMs > 0 else {
      throw PoseMediaError.invalidFile
    }
    return try await onWorker {
      guard !self.destroyed, self.session == nil else { throw PoseMediaError.videoUnavailable }
      let opened = try PoseVideoSession(
        asset: asset, durationMs: durationMs, options: options,
        trackingConfidence: trackingConfidence)
      self.session = opened
      return ["id": opened.id, "durationMs": durationMs]
    }
  }

  func read(_ id: String, timestampMs: Int) async throws -> [String: Any] {
    let generator: AVAssetImageGenerator = try await onWorker {
      guard let current = self.session, current.id == id else {
        throw PoseMediaError.videoUnavailable
      }
      guard current.phase == .ready, timestampMs > current.lastTimestamp else {
        throw PoseMediaError.invalidOptions
      }
      guard timestampMs >= 0, Double(timestampMs) < current.durationMs else {
        throw PoseMediaError.invalidOptions
      }
      current.lastTimestamp = timestampMs
      current.phase = .decoding
      return current.generator
    }
    do {
      let decoded = try await generator.image(
        at: CMTime(value: Int64(timestampMs), timescale: 1000))
      return try await onWorker {
        try autoreleasepool {
          guard let current = self.session, current.id == id, let detector = current.detector else {
            throw PoseMediaError.videoUnavailable
          }
          let image = try MPImage(uiImage: UIImage(cgImage: decoded.image))
          let started = ProcessInfo.processInfo.systemUptime
          let result = try detector.detect(videoFrame: image, timestampInMilliseconds: timestampMs)
          var detection = try PoseLandmarkPayload.make(result)
          detection["imageSize"] = ["width": decoded.image.width, "height": decoded.image.height]
          detection["inferenceDurationMs"] = (ProcessInfo.processInfo.systemUptime - started) * 1000
          detection["model"] = [
            "variant": current.options.modelVariant, "delegate": "CPU",
            "source": current.options.modelPath == nil ? "bundled" : "local",
          ]
          current.phase = .ready
          return [
            "timestampMs": timestampMs, "decodedTimestampMs": decoded.actualTime.seconds * 1000,
            "detection": detection,
          ]
        }
      }
    } catch {
      try await onWorker { self.close(id) }
      throw error
    }
  }

  func close(_ id: String) {
    guard let current = session, current.id == id else { return }
    current.close()
    session = nil
  }

  func destroy() {
    destroyed = true
    session?.close()
    session = nil
  }
}
