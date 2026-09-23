import MediaPipeTasksVision

internal enum PoseLandmarkPayload {
  static func make(_ result: PoseLandmarkerResult) -> [String: Any] {
    let landmarks = (result.landmarks.first ?? []).map { joint -> [String: Any] in
      var coordinates: [String: Any] = ["x": joint.x, "y": joint.y, "z": joint.z]
      if let visibility = joint.visibility { coordinates["visibility"] = visibility }
      if let presence = joint.presence { coordinates["presence"] = presence }
      return coordinates
    }
    let worldLandmarks = (result.worldLandmarks.first ?? []).map { joint -> [String: Any] in
      var coordinates: [String: Any] = ["x": joint.x, "y": joint.y, "z": joint.z]
      if let visibility = joint.visibility { coordinates["visibility"] = visibility }
      if let presence = joint.presence { coordinates["presence"] = presence }
      return coordinates
    }
    return ["landmarks": landmarks, "worldLandmarks": worldLandmarks]
  }
}
