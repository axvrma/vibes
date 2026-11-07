import Cocoa
import AVFoundation
import FlutterMacOS

class MainFlutterWindow: NSWindow {
  private var activeFolder: URL?
  private var folderChannel: FlutterMethodChannel?
  override func awakeFromNib() {
    let flutterViewController = FlutterViewController()
    let windowFrame = self.frame
    self.contentViewController = flutterViewController
    self.setFrame(windowFrame, display: true)

    RegisterGeneratedPlugins(registry: flutterViewController)

    folderChannel = FlutterMethodChannel(name:"vibes/local-library", binaryMessenger:flutterViewController.engine.binaryMessenger)
    folderChannel?.setMethodCallHandler { [weak self] call,result in
      guard let self = self else { return }
      do {
        if call.method == "pickFolder" {
          let panel = NSOpenPanel(); panel.canChooseDirectories = true; panel.canChooseFiles = false; panel.allowsMultipleSelection = false
          guard panel.runModal() == .OK, let url = panel.url else { result(nil); return }
          let data = try url.bookmarkData(options:.withSecurityScope, includingResourceValuesForKeys:nil, relativeTo:nil)
          self.activeFolder?.stopAccessingSecurityScopedResource(); self.activeFolder = nil
          UserDefaults.standard.set(data,forKey:"vibesFolderBookmark")
          try self.restoreFolder(); result(url.path)
        } else if call.method == "thumbnail", let args=call.arguments as? [String:String] {self.makeThumbnail(args,result:result)
        } else if call.method == "restoreAccess" {try self.restoreFolder(); result(nil)}
        else {result(FlutterMethodNotImplemented)}
      } catch {result(FlutterError(code:"FOLDER_UNAVAILABLE",message:"Choose your folder again to restore access.",details:nil))}
    }
    super.awakeFromNib()
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
          guard let data=NSBitmapImageRep(cgImage:frame).representation(using:.jpeg,properties:[.compressionFactor:0.75]) else {DispatchQueue.main.async {result(nil)};return}
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
    let url = try URL(resolvingBookmarkData:data,options:.withSecurityScope,relativeTo:nil,bookmarkDataIsStale:&stale)
    guard url.startAccessingSecurityScopedResource() else {throw NSError(domain:"Vibes",code:1)}
    activeFolder = url
    if stale {UserDefaults.standard.set(try url.bookmarkData(options:.withSecurityScope,includingResourceValuesForKeys:nil,relativeTo:nil),forKey:"vibesFolderBookmark")}
  }
}
