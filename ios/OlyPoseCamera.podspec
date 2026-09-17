require 'json'
package = JSON.parse(File.read(File.join(__dir__, '..', 'package.json')))

Pod::Spec.new do |s|
  s.name = 'OlyPoseCamera'
  s.version = package['version']
  s.summary = package['description']
  s.description = package['description']
  s.license = { :type => 'MIT', :file => '../LICENSE' }
  s.author = 'Yosef Hayim Sabag'
  s.homepage = 'https://github.com/YosefHayim/mediapipe-reactnative'
  s.source = { :git => s.homepage + '.git', :tag => s.version.to_s }
  s.platform = :ios, '16.4'
  s.swift_version = '5.9'
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.dependency 'MediaPipeTasksVision', '0.10.14'
  s.pod_target_xcconfig = { 'DEFINES_MODULE' => 'YES' }
  s.source_files = '**/*.swift'
  s.resource_bundles = { 'OlyPoseCameraModels' => ['../assets/*.task'] }
end
