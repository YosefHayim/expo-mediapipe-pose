import Foundation

@main
struct FrameTimingTests {
  static func main() throws {
    var timing = PoseFrameTiming()
    for index in 0..<60 {
      let timestamp = Double(index) * 1000 / 60
      precondition(timing.observeFrame(at: timestamp) == nil)
      if !timing.shouldInfer(at: timestamp, fps: 15) { continue }
      timing.recordInference(durationMs: 12)
      _ = timing.shouldDeliver(at: timestamp, fps: 5)
    }
    let metrics = timing.observeFrame(at: 1000)!
    precondition(metrics.observedFrames == 60)
    precondition(metrics.inferenceCount == 15)
    precondition(metrics.resultCount == 5)
    precondition(metrics.skippedInferenceFrames == 45)
    precondition(metrics.averageInferenceDurationMs == 12)
    precondition(metrics.observedFps == 60)
    precondition(metrics.inferenceFps == 15)
    precondition(metrics.resultFps == 5)
    let encoded = try JSONSerialization.data(withJSONObject: metrics.event, options: [.sortedKeys])
    print(String(decoding: encoded, as: UTF8.self))

    var dynamic = PoseFrameTiming()
    precondition(dynamic.shouldInfer(at: 0, fps: 1))
    precondition(!dynamic.shouldInfer(at: 10, fps: 1))
    precondition(dynamic.shouldInfer(at: 20, fps: 60))
    precondition(!dynamic.shouldInfer(at: 30, fps: 1))
    precondition(dynamic.shouldInfer(at: 1020, fps: 1))
    precondition(dynamic.shouldDeliver(at: 0, fps: 1))
    precondition(dynamic.shouldDeliver(at: 20, fps: 60))
    precondition(!dynamic.shouldDeliver(at: 30, fps: 1))
    precondition(dynamic.shouldDeliver(at: 1020, fps: 1))

    var idle = PoseFrameTiming()
    precondition(idle.observeFrame(at: 0) == nil)
    let noInference = idle.observeFrame(at: 2000)!
    precondition(noInference.averageInferenceDurationMs == nil)
    precondition(noInference.inferenceFps == 0)
    precondition(noInference.event["averageInferenceDurationMs"] is NSNull)
    precondition(PoseProcessingOptions(frameLimit: 1, callbackFps: 60).isValid)
    precondition(!PoseProcessingOptions(frameLimit: 0).isValid)
    precondition(!PoseProcessingOptions(callbackFps: 61).isValid)
    print("Swift frame timing: independent cadence, rate changes, metrics and validation passed")
  }
}
