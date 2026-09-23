import Foundation
import ImageIO
import MediaPipeTasksVision
import UniformTypeIdentifiers

internal final class PoseMaskStore {
  private static let startupLock = NSLock()
  private static var startupCleaned = false
  private static let directoryPrefix = "expo-mediapipe-pose-masks-"
  private let worker = DispatchQueue(label: "expo.pose.masks")
  private let directoryName = "\(PoseMaskStore.directoryPrefix)\(UUID().uuidString)"
  private var directory: URL?
  private var leases: [String: URL] = [:]
  private var closed = false

  func save(_ result: PoseLandmarkerResult, width: Int, height: Int, maximumDimension: Int) throws
    -> [String: Any]
  {
    try worker.sync {
      guard !closed else { throw PoseMediaError.maskUnavailable }
      if result.landmarks.isEmpty { return ["status": "empty"] }
      guard leases.count < 2 else { return ["status": "backpressure"] }
      let masks = result.segmentationMasks
      guard masks.count == result.landmarks.count else { throw PoseMediaError.maskUnavailable }
      let cache = try FileManager.default.url(
        for: .cachesDirectory, in: .userDomainMask, appropriateFor: nil, create: true)
      try Self.cleanPreviousProcessFiles(in: cache)
      let root = cache.appendingPathComponent(directoryName)
      directory = root
      let id = UUID().uuidString
      let folder = root.appendingPathComponent(id)
      try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
      leases[id] = folder
      do {
        let payload = try masks.enumerated().map { index, mask -> [String: Any] in
          let url = folder.appendingPathComponent("\(index).png")
          let size = try encode(mask, to: url, maximumDimension: maximumDimension)
          return [
            "poseIndex": index, "uri": url.absoluteString, "width": size.width,
            "height": size.height,
          ]
        }
        return [
          "status": "available", "leaseId": id, "masks": payload,
          "imageSize": ["width": width, "height": height],
        ]
      } catch {
        try remove(id)
        throw error
      }
    }
  }
  func release(_ id: String) throws { try worker.sync { try remove(id) } }
  func discard(_ segmentation: [String: Any]?) {
    guard let id = segmentation?["leaseId"] as? String else { return }
    worker.async {
      do { try self.remove(id) } catch {
        NSLog("Pose mask cleanup failed: %@", String(describing: error))
      }
    }
  }
  func destroy() {
    worker.async {
      self.closed = true
      guard let directory = self.directory else { return }
      guard FileManager.default.fileExists(atPath: directory.path) else {
        self.leases.removeAll()
        return
      }
      do {
        try FileManager.default.removeItem(at: directory)
        self.leases.removeAll()
      } catch { NSLog("Pose mask cleanup failed: %@", String(describing: error)) }
    }
  }
  private static func cleanPreviousProcessFiles(in cache: URL) throws {
    startupLock.lock()
    defer { startupLock.unlock() }
    guard !startupCleaned else { return }
    for directory in try FileManager.default.contentsOfDirectory(
      at: cache, includingPropertiesForKeys: nil)
    {
      if directory.lastPathComponent.hasPrefix(directoryPrefix) {
        try FileManager.default.removeItem(at: directory)
      }
    }
    startupCleaned = true
  }
  private func remove(_ id: String) throws {
    guard let folder = leases[id] else { return }
    if FileManager.default.fileExists(atPath: folder.path) {
      try FileManager.default.removeItem(at: folder)
    }
    leases.removeValue(forKey: id)
  }
  private func encode(_ mask: Mask, to url: URL, maximumDimension: Int) throws -> (
    width: Int, height: Int
  ) {
    guard mask.width > 0, mask.height > 0 else { throw PoseMediaError.maskUnavailable }
    let scale = min(1, Double(maximumDimension) / Double(max(mask.width, mask.height)))
    let width = max(1, Int(Double(mask.width) * scale))
    let height = max(1, Int(Double(mask.height) * scale))
    let probabilities = mask.float32Data
    var pixels = [UInt8](repeating: 255, count: width * height * 4)
    for row in 0..<height {
      let sourceRow = min(
        mask.height - 1, Int((Double(row) + 0.5) * Double(mask.height) / Double(height)))
      for column in 0..<width {
        let sourceColumn = min(
          mask.width - 1, Int((Double(column) + 0.5) * Double(mask.width) / Double(width)))
        let probability = probabilities[sourceRow * mask.width + sourceColumn]
        guard probability.isFinite else { throw PoseMediaError.maskUnavailable }
        pixels[(row * width + column) * 4 + 3] = UInt8(
          (min(1, max(0, probability)) * 255).rounded())
      }
    }
    let data = Data(pixels)
    guard let provider = CGDataProvider(data: data as CFData),
      let image = CGImage(
        width: width, height: height, bitsPerComponent: 8, bitsPerPixel: 32, bytesPerRow: width * 4,
        space: CGColorSpaceCreateDeviceRGB(),
        bitmapInfo: CGBitmapInfo(rawValue: CGImageAlphaInfo.last.rawValue), provider: provider,
        decode: nil, shouldInterpolate: false, intent: .defaultIntent),
      let destination = CGImageDestinationCreateWithURL(
        url as CFURL, UTType.png.identifier as CFString, 1, nil)
    else { throw PoseMediaError.maskUnavailable }
    CGImageDestinationAddImage(destination, image, nil)
    guard CGImageDestinationFinalize(destination) else { throw PoseMediaError.maskUnavailable }
    return (width, height)
  }
}
