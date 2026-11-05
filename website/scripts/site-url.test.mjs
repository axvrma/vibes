import { describe, expect, it } from "vitest";
import { resolveSiteUrl } from "./site-url.mjs";
import { parse } from "@iarna/toml";
import { readFileSync } from "node:fs";

describe("canonical origin selection", () => {
  it("does not invent a production origin", () => {
    expect(resolveSiteUrl({})).toBe(null);
  });
  it("uses an explicit origin before Netlify deployment values", () => {
    expect(
      resolveSiteUrl({
        SITE_URL: "https://example.test/",
        URL: "https://fallback.test",
      }),
    ).toBe("https://example.test");
  });
  it("uses the actual preview URL on preview builds and production URL on production", () => {
    expect(
      resolveSiteUrl({
        CONTEXT: "deploy-preview",
        DEPLOY_PRIME_URL: "https://preview.test",
        URL: "https://main.test",
      }),
    ).toBe("https://preview.test");
    expect(
      resolveSiteUrl({ CONTEXT: "production", URL: "https://main.test" }),
    ).toBe("https://main.test");
  });
  it("rejects invalid protocols, paths, and credentials", () => {
    for (const SITE_URL of [
      "javascript:alert(1)",
      "https://example.test/path",
      "https://user:pass@example.test",
      "https://example.test/?x=1",
      "not-a-url",
    ]) {
      expect(() => resolveSiteUrl({ SITE_URL })).toThrow();
    }
  });
});
describe("Netlify configuration", () => {
  it("builds only the independent marketing site and publishes the Vite output", () => {
    const config = parse(readFileSync("netlify.toml", "utf8"));
    expect(config.build).toMatchObject({
      base: "website",
      command: "npm run build",
      publish: "dist",
    });
    expect(config.build.environment.NODE_VERSION).toBe("24");
    expect(
      config.headers.find((entry) => entry.for === "/assets/*").values[
        "Cache-Control"
      ],
    ).toContain("immutable");
  });
  it("keeps the repository-root autodiscovery config in sync", () => {
    expect(readFileSync("../netlify.toml", "utf8")).toBe(
      readFileSync("netlify.toml", "utf8"),
    );
  });
});
