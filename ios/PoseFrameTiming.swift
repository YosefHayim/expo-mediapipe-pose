import Foundation

struct PoseProcessingOptions: Equatable {
  var frameLimit = 30
  var callbackFps = 30
  var metricsEnabled = false

  var isValid: Bool {
    guard (1...60).contains(frameLimit) else { return false }
    return (1...60).contains(callbackFps)
  }
}

struct PosePerformanceSnapshot {
  let intervalMs: Double
  let observedFrames: Int
  let inferenceCount: Int
  let resultCount: Int
  let skippedInferenceFrames: Int
  let averageInferenceDurationMs: Double?

  var event: [String: Any] {
    var fields: [String: Any] = [
      "intervalMs": intervalMs, "observedFrames": observedFrames, "inferenceCount": inferenceCount,
      "resultCount": resultCount, "skippedInferenceFrames": skippedInferenceFrames,
      "observedFps": observedFps, "inferenceFps": inferenceFps, "resultFps": resultFps,
    ]
    if let averageInferenceDurationMs {
      fields["averageInferenceDurationMs"] = averageInferenceDurationMs
    } else {
      fields["averageInferenceDurationMs"] = NSNull()
    }
    return fields
  }

  var observedFps: Double { Double(observedFrames) * 1000 / intervalMs }
  var inferenceFps: Double { Double(inferenceCount) * 1000 / intervalMs }
  var resultFps: Double { Double(resultCount) * 1000 / intervalMs }
}

struct PoseFrameTiming {
  private var lastInferenceMs: Double?
  private var lastResultMs: Double?
  private var windowStartedAtMs: Double?
  private var observedFrames = 0
  private var inferenceCount = 0
  private var resultCount = 0
  private var skippedInferenceFrames = 0
  private var totalInferenceDurationMs = 0.0

  mutating func observeFrame(at nowMs: Double) -> PosePerformanceSnapshot? {
    guard let startedAt = windowStartedAtMs else {
      windowStartedAtMs = nowMs
      observedFrames = 1
      return nil
    }
    let intervalMs = nowMs - startedAt
    guard intervalMs >= 1000 else {
      observedFrames += 1
      return nil
    }
    let averageDuration =
      inferenceCount > 0
      ? totalInferenceDurationMs / Double(inferenceCount) : nil
    let snapshot = PosePerformanceSnapshot(
      intervalMs: intervalMs, observedFrames: observedFrames, inferenceCount: inferenceCount,
      resultCount: resultCount, skippedInferenceFrames: skippedInferenceFrames,
      averageInferenceDurationMs: averageDuration)
    windowStartedAtMs = nowMs
    observedFrames = 1
    inferenceCount = 0
    resultCount = 0
    skippedInferenceFrames = 0
    totalInferenceDurationMs = 0
    return snapshot
  }

  mutating func shouldInfer(at nowMs: Double, fps: Int) -> Bool {
    if let lastInferenceMs, nowMs - lastInferenceMs + 0.000001 < 1000 / Double(fps) {
      skippedInferenceFrames += 1
      return false
    }
    lastInferenceMs = nowMs
    return true
  }

  mutating func recordInference(durationMs: Double) {
    inferenceCount += 1
    totalInferenceDurationMs += durationMs
  }

  mutating func shouldDeliver(at nowMs: Double, fps: Int) -> Bool {
    if let lastResultMs, nowMs - lastResultMs + 0.000001 < 1000 / Double(fps) { return false }
    lastResultMs = nowMs
    resultCount += 1
    return true
  }
}
