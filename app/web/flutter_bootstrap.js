{{flutter_js}}
{{flutter_build_config}}
// Keep the renderer on this deployment instead of fetching it from Google's CDN.
_flutter.loader.load({
  config: {
    fontFallbackBaseUrl: new URL('fonts/', document.baseURI).toString(),
    canvasKitBaseUrl: new URL('canvaskit/', document.baseURI).toString(),
  },
});
