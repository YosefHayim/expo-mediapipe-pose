import AVFoundation

internal enum PoseCameraCapabilities {
  static func camera(facing: String, lens: String) -> AVCaptureDevice? {
    let position: AVCaptureDevice.Position = facing == "front" ? .front : .back
    let deviceType: AVCaptureDevice.DeviceType =
      lens == "ultraWide" ? .builtInUltraWideCamera : .builtInWideAngleCamera
    return AVCaptureDevice.DiscoverySession(
      deviceTypes: [.builtInWideAngleCamera, .builtInUltraWideCamera], mediaType: .video,
      position: position
    ).devices.first { $0.deviceType == deviceType }
  }

  static func format(camera: AVCaptureDevice, fps: Int) -> AVCaptureDevice.Format? {
    let rate = Double(fps)
    return camera.formats.filter { format in
      format.videoSupportedFrameRateRanges.contains {
        $0.minFrameRate <= rate && $0.maxFrameRate >= rate
      }
    }.min { first, second in
      let firstSize = CMVideoFormatDescriptionGetDimensions(first.formatDescription)
      let secondSize = CMVideoFormatDescriptionGetDimensions(second.formatDescription)
      return abs(Int(firstSize.width) * Int(firstSize.height) - 1280 * 720)
        < abs(Int(secondSize.width) * Int(secondSize.height) - 1280 * 720)
    }
  }

  static func discover() -> [String: Any] {
    guard AVCaptureDevice.authorizationStatus(for: .video) == .authorized else {
      return ["status": "permissionRequired"]
    }
    var cameras: [[String: Any]] = []
    for facing in ["front", "back"] {
      for lens in ["wide", "ultraWide"] {
        guard let device = camera(facing: facing, lens: lens) else { continue }
        let modes: [[String: Any]] = (1...60).compactMap { fps in
          guard let selectedFormat = format(camera: device, fps: fps) else { return nil }
          let size = CMVideoFormatDescriptionGetDimensions(selectedFormat.formatDescription)
          return [
            "previewFps": fps,
            "resolution": ["width": Int(size.width), "height": Int(size.height)],
          ]
        }
        guard !modes.isEmpty else { continue }
        cameras.append([
          "facing": facing, "lens": lens, "modes": modes,
          "zoomRange": [
            "min": max(1, Double(device.minAvailableVideoZoomFactor)),
            "max": min(100, Double(device.maxAvailableVideoZoomFactor)),
          ],
        ])
      }
    }
    guard !cameras.isEmpty else { return ["status": "unavailable"] }
    return ["status": "available", "platform": "ios", "cameras": cameras]
  }
}
