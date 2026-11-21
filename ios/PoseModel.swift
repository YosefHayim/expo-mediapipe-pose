import Foundation
import MediaPipeTasksVision

internal enum PoseMediaError: Error {
  case invalidFile
  case invalidOptions
  case invalidImage
  case videoUnavailable
  case invalidModel
}

internal enum PoseModel {
  static func pickDelegate(_ poseDelegate: String) throws -> Delegate {
    switch poseDelegate {
    case "gpu": return .GPU
    case "cpu": return .CPU
    default: throw PoseMediaError.invalidOptions
    }
  }

  static func localURL(_ location: String) throws -> URL {
    if location.hasPrefix("/") {
      return try readableFile(URL(fileURLWithPath: location))
    }
    guard let url = URL(string: location), url.isFileURL, url.path.hasPrefix("/") else {
      throw PoseMediaError.invalidFile
    }
    guard url.host == nil || url.host == "" || url.host?.lowercased() == "localhost" else {
      throw PoseMediaError.invalidFile
    }
    guard url.query == nil, url.fragment == nil else { throw PoseMediaError.invalidFile }
    return try readableFile(url)
  }

  private static func readableFile(_ url: URL) throws -> URL {
    guard FileManager.default.isReadableFile(atPath: url.path) else {
      throw PoseMediaError.invalidFile
    }
    let values = try url.resourceValues(forKeys: [.isRegularFileKey])
    guard values.isRegularFile == true, FileManager.default.isReadableFile(atPath: url.path) else {
      throw PoseMediaError.invalidFile
    }
    return url
  }

  static func path(variant: String, localPath: String?) throws -> String {
    guard ["lite", "full", "heavy"].contains(variant) else { throw PoseMediaError.invalidModel }
    if let localPath { return try localURL(localPath).path }
    let bundledFileName: String
    switch variant {
    case "lite": bundledFileName = "pose_landmarker_lite"
    case "full": bundledFileName = "pose_landmarker_full"
    case "heavy": bundledFileName = "pose_landmarker_heavy"
    default: throw PoseMediaError.invalidModel
    }
    guard
      let resourceURL = Bundle(for: ExpoMediaPipePoseView.self).url(
        forResource: "ExpoMediaPipePoseModels", withExtension: "bundle"),
      let resources = Bundle(url: resourceURL),
      let bundledPath = resources.path(forResource: bundledFileName, ofType: "task")
    else { throw PoseMediaError.invalidModel }
    return bundledPath
  }
}
