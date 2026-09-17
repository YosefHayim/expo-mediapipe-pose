import Foundation
import UIKit
import MediaPipeTasksVision

// MARK: Define default constants
struct DefaultConstants {
    
    static let lineWidth: CGFloat = 4
    static let pointRadius: CGFloat = 2
    static let pointColor = UIColor.yellow
    static let pointFillColor = UIColor.red
    
    // Oly skeleton: connection lines in white, matching Android's `icActive`
    // default (#FFFFFFFF) and the product reference design — was app "success"
    // green, changed per product direction. Joint dots stay red (pointFillColor)
    // per product design; dot drawing itself is disabled (see OverlayView.swift).
    static let lineColor = UIColor.white
    
    static var numPoses: Int = 1  // Oly one-person session
    static var minPoseDetectionConfidence: Float = 0.35
    static var minPosePresenceConfidence: Float = 0.35
    static var minTrackingConfidence: Float = 0.35
    static let model: Model = .pose_landmarker_full  // Oly: full (not lite/heavy) — best side-profile accuracy vs FPS
    static let delegate: PoseLandmarkerDelegate = .GPU
    
    static let HEIGHT: Int = 1280
    static let WIDTH: Int = 720
    static let FRAME_LIMIT: NSNumber = 30
}

// MARK: Model
enum Model: Int, CaseIterable {
    case pose_landmarker_lite
    case pose_landmarker_full
    case pose_landmarker_heavy
    
    var name: String {
        switch self {
        case .pose_landmarker_lite:
            return "Pose landmarker (lite)"
        case .pose_landmarker_full:
            return "Pose landmarker (Full)"
        case .pose_landmarker_heavy:
            return "Pose landmarker (Heavy)"
        }
    }
    
    var modelPath: String? {
        switch self {
        case .pose_landmarker_lite:
            return Bundle.main.path(
                forResource: "pose_landmarker_lite", ofType: "task")
        case .pose_landmarker_full:
            return Bundle.main.path(
                forResource: "pose_landmarker_full", ofType: "task")
        case .pose_landmarker_heavy:
            return Bundle.main.path(
                forResource: "pose_landmarker_heavy", ofType: "task")
        }
    }
    
    init?(name: String) {
        switch name {
        case Model.pose_landmarker_lite.name:
            self = Model.pose_landmarker_lite
        case Model.pose_landmarker_full.name:
            self = Model.pose_landmarker_full
        case Model.pose_landmarker_heavy.name:
            self = Model.pose_landmarker_heavy
        default:
            return nil
        }
    }
}

// MARK: PoseLandmarkerDelegate
enum PoseLandmarkerDelegate: CaseIterable {
    case GPU
    case CPU
    
    var name: String {
        switch self {
        case .GPU:
            return "GPU"
        case .CPU:
            return "CPU"
        }
    }
    
    var delegate: Delegate {
        switch self {
        case .GPU:
            return .GPU
        case .CPU:
            return .CPU
        }
    }
    
    init?(name: String) {
        switch name {
        case PoseLandmarkerDelegate.CPU.name:
            self = PoseLandmarkerDelegate.CPU
        case PoseLandmarkerDelegate.GPU.name:
            self = PoseLandmarkerDelegate.GPU
        default:
            return nil
        }
    }
}
