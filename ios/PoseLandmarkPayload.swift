import MediaPipeTasksVision

internal enum PoseLandmarkPayload {
  private enum Failure: Error { case mismatchedPoseCounts }

  static func make(_ result: PoseLandmarkerResult) throws -> [String: Any] {
    guard result.landmarks.count == result.worldLandmarks.count else {
      throw Failure.mismatchedPoseCounts
    }
    let poses = result.landmarks.enumerated().map {
      index, image -> (landmarks: [[String: Any]], worldLandmarks: [[String: Any]]) in
      let landmarks = image.map { joint -> [String: Any] in
        var coordinates: [String: Any] = ["x": joint.x, "y": joint.y, "z": joint.z]
        if let visibility = joint.visibility { coordinates["visibility"] = visibility }
        if let presence = joint.presence { coordinates["presence"] = presence }
        return coordinates
      }
      let worldLandmarks = result.worldLandmarks[index].map { joint -> [String: Any] in
        var coordinates: [String: Any] = ["x": joint.x, "y": joint.y, "z": joint.z]
        if let visibility = joint.visibility { coordinates["visibility"] = visibility }
        if let presence = joint.presence { coordinates["presence"] = presence }
        return coordinates
      }
      return (landmarks, worldLandmarks)
    }
    guard let first = poses.first else {
      return ["landmarks": [], "worldLandmarks": [], "poses": []]
    }
    return [
      "landmarks": first.landmarks, "worldLandmarks": first.worldLandmarks,
      "poses": poses.map { ["landmarks": $0.landmarks, "worldLandmarks": $0.worldLandmarks] },
    ]
  }
}
