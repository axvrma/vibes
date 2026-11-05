import fs from "node:fs/promises";
import { resolveSiteUrl, escapeXml } from "./site-url.mjs";

const origin = resolveSiteUrl(process.env);
let html = await fs.readFile("dist/index.html", "utf8");
const assets = await fs.readdir("dist/assets");
const interFont = assets.find(
  (name) =>
    name.startsWith("inter-latin-wght-normal-") && name.endsWith(".woff2"),
);
if (interFont)
  html = html.replace(
    "</head>",
    `<link rel="preload" href="/assets/${interFont}" as="font" type="font/woff2" crossorigin />\n</head>`,
  );
if (origin) {
  html = html.replaceAll(
    'content="/og-image.png"',
    `content="${origin}/og-image.png"`,
  );
  const metadata = `\n<link rel="canonical" href="${origin}/" />\n<meta property="og:url" content="${origin}/" />\n<script type="application/ld+json">${JSON.stringify({ "@context": "https://schema.org", "@type": "SoftwareSourceCode", name: "Vibes", description: "A self-hosted short-video platform with a Flutter app and Angular media dashboard.", codeRepository: "https://github.com/axvrma/vibes", programmingLanguage: ["Dart", "TypeScript"], url: `${origin}/`, image: `${origin}/og-image.png` }).replace(/</g, "\\u003c")}</script>\n`;
  html = html.replace("</head>", `${metadata}</head>`);
  await fs.writeFile(
    "dist/sitemap.xml",
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${escapeXml(origin)}/</loc></url></urlset>\n`,
  );
  await fs.writeFile(
    "dist/robots.txt",
    `User-agent: *\nAllow: /\nSitemap: ${origin}/sitemap.xml\n`,
  );
  console.log(`SEO: canonical origin ${origin}`);
} else {
  console.log(
    "SEO: local build; canonical and sitemap omitted until SITE_URL or Netlify URL is known.",
  );
}
await fs.writeFile("dist/index.html", html);
