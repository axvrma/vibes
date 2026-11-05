export function resolveSiteUrl(environment) {
  const value =
    environment.SITE_URL ||
    (environment.CONTEXT === "deploy-preview" ||
    environment.CONTEXT === "branch-deploy"
      ? environment.DEPLOY_PRIME_URL
      : environment.URL);
  if (!value) return null;
  const parsed = new URL(value);
  if (
    !["https:", "http:"].includes(parsed.protocol) ||
    parsed.username ||
    parsed.password ||
    parsed.pathname !== "/" ||
    parsed.search ||
    parsed.hash
  ) {
    throw new Error(
      "SITE_URL must be an absolute HTTP(S) origin without credentials, path, query, or hash.",
    );
  }
  return parsed.origin;
}
export function escapeXml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}
