import Flutter
import AVFoundation
import UIKit

@main
@objc class AppDelegate: FlutterAppDelegate, UIDocumentPickerDelegate {
  private var folderResult: FlutterResult?
  private var activeFolder: URL?
  override func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
    GeneratedPluginRegistrant.register(with: self)
    if let controller = window?.rootViewController as? FlutterViewController {
      FlutterMethodChannel(name: "vibes/local-library", binaryMessenger: controller.binaryMessenger).setMethodCallHandler { [weak self, weak controller] call, result in
        guard let self = self else { return }
        if call.method == "pickFolder" {
          guard self.folderResult == nil else { result(FlutterError(code:"BUSY", message:"Folder picker is open", details:nil)); return }
          self.folderResult = result
          let picker = UIDocumentPickerViewController(documentTypes: ["public.folder"], in: .open)
          picker.delegate = self
          controller?.present(picker, animated:true)
        } else if call.method == "thumbnail", let args=call.arguments as? [String:String] {
          self.makeThumbnail(args,result:result)
        } else if call.method == "restoreAccess" {
          do { try self.restoreFolder(); result(nil) }
          catch { result(FlutterError(code:"FOLDER_UNAVAILABLE", message:"Choose your folder again to restore access.", details:nil)) }
        } else { result(FlutterMethodNotImplemented) }
      }
    }
    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }
  private func makeThumbnail(_ args:[String:String],result:@escaping FlutterResult) {
    guard let raw=args["uri"],let url=URL(string:raw),url.isFileURL,let id=args["id"] else {result(nil);return}
    let safe=id.filter {$0.isLetter || $0.isNumber || $0 == "_"}
    DispatchQueue.global(qos:.utility).async {
      do {
        let folder=FileManager.default.temporaryDirectory.appendingPathComponent("vibes-thumbnails")
        try FileManager.default.createDirectory(at:folder,withIntermediateDirectories:true)
        let output=folder.appendingPathComponent(safe+".jpg")
        if !FileManager.default.fileExists(atPath:output.path) {
          let generator=AVAssetImageGenerator(asset:AVAsset(url:url));generator.appliesPreferredTrackTransform=true;generator.maximumSize=CGSize(width:480,height:480)
          let frame=try generator.copyCGImage(at:.zero,actualTime:nil)
          guard let data=UIImage(cgImage:frame).jpegData(compressionQuality:0.75) else {DispatchQueue.main.async {result(nil)};return}
          try data.write(to:output,options:.atomic)
        }
        DispatchQueue.main.async {result(output.path)}
      } catch {DispatchQueue.main.async {result(nil)}}
    }
  }
  private func restoreFolder() throws {
    if activeFolder != nil { return }
    guard let data = UserDefaults.standard.data(forKey:"vibesFolderBookmark") else { return }
    var stale = false
    let url = try URL(resolvingBookmarkData:data, options:[], relativeTo:nil, bookmarkDataIsStale:&stale)
    guard url.startAccessingSecurityScopedResource() else { throw NSError(domain:"Vibes", code:1) }
    activeFolder = url
    if stale { UserDefaults.standard.set(try url.bookmarkData(options:[], includingResourceValuesForKeys:nil, relativeTo:nil), forKey:"vibesFolderBookmark") }
  }
  func documentPicker(_ controller: UIDocumentPickerViewController, didPickDocumentsAt urls: [URL]) {
    guard let url = urls.first else { documentPickerWasCancelled(controller); return }
    do {
      guard url.startAccessingSecurityScopedResource() else { throw NSError(domain:"Vibes", code:1) }
      defer { url.stopAccessingSecurityScopedResource() }
      let bookmark = try url.bookmarkData(options:[], includingResourceValuesForKeys:nil, relativeTo:nil)
      activeFolder?.stopAccessingSecurityScopedResource(); activeFolder = nil
      UserDefaults.standard.set(bookmark, forKey:"vibesFolderBookmark")
      try restoreFolder()
      folderResult?(url.path)
    } catch { folderResult?(FlutterError(code:"FOLDER_UNAVAILABLE", message:"Could not retain access to this folder", details:nil)) }
    folderResult = nil
  }
  func documentPickerWasCancelled(_ controller: UIDocumentPickerViewController) { folderResult?(nil); folderResult = nil }
}
