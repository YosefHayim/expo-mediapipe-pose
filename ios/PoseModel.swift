import Foundation

internal enum PoseMediaError: Error {
  case invalidFile
  case invalidOptions
  case invalidImage
  case invalidModel
}

internal enum PoseModel {
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
    guard variant == "full",
      let resourceURL = Bundle(for: ExpoMediaPipePoseView.self).url(
        forResource: "ExpoMediaPipePoseModels", withExtension: "bundle"),
      let resources = Bundle(url: resourceURL),
      let bundledPath = resources.path(forResource: "pose_landmarker_full", ofType: "task")
    else { throw PoseMediaError.invalidModel }
    return bundledPath
  }
}
