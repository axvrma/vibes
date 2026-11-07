import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
const sharp = createRequire(
  new URL("../website/package.json", import.meta.url),
)("sharp");
const root = path.resolve(import.meta.dirname, "..");
const write = async (p, data) => {
  await fs.mkdir(path.dirname(path.join(root, p)), { recursive: true });
  await fs.writeFile(path.join(root, p), data);
};
const tokens = JSON.parse(
  await fs.readFile(path.join(root, "brand/tokens.json")),
);
const mark = await fs.readFile(
  path.join(root, "website/public/favicon.svg"),
  "utf8",
);
const word = await fs.readFile(
  path.join(root, "website/public/wordmark.svg"),
  "utf8",
);
await write("brand/monogram.svg", mark);
await write("brand/wordmark.svg", word);
for (const [name, ink, bg] of [
  ["dark", "#fafafa", "#151016"],
  ["light", "#211725", "#fbf9fc"],
  ["monochrome", "#211725", "#ffffff"],
]) {
  await write(
    `brand/wordmark-${name}.svg`,
    word
      .replaceAll("#fafafa", ink)
      .replaceAll("#ff3d81", name === "monochrome" ? ink : "#ff3d81"),
  );
  await write(
    `brand/monogram-${name}.svg`,
    mark
      .replaceAll("#fafafa", ink)
      .replaceAll("#151016", bg)
      .replaceAll("#ff3d81", name === "monochrome" ? ink : "#ff3d81"),
  );
}
await write(
  "brand/horizontal-lockup.svg",
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 245 64"><svg width="64" height="64">${mark.replace(/<svg[^>]*>|<\/svg>/g, "")}</svg><svg x="84" y="8" width="145" height="48" viewBox="0 0 121 43">${word.replace(/<svg[^>]*>|<\/svg>/g, "")}</svg></svg>`,
);
const css = Object.entries(tokens.dark)
  .map(([k, v]) => `  --vibes-${k}: ${v};`)
  .join("\n");
const light = Object.entries(tokens.light)
  .map(([k, v]) => `  --vibes-${k}: ${v};`)
  .join("\n");
const common = `  --vibes-font: Inter, system-ui, sans-serif;\n${tokens.spacing.map((v) => `  --vibes-space-${v}: ${v}px;`).join("\n")}\n${Object.entries(
  tokens.radius,
)
  .map(([k, v]) => `  --vibes-radius-${k}: ${v}px;`)
  .join("\n")}\n${Object.entries(tokens.motion)
  .map(([k, v]) => `  --vibes-motion-${k}: ${v}ms;`)
  .join("\n")}\n${Object.entries(tokens.elevation)
  .map(([k, v]) => `  --vibes-elevation-${k}: ${v};`)
  .join("\n")}`;
for (const target of [
  "dashboard/src/brand.css",
  "website/src/styles/brand.css",
])
  await write(
    target,
    `/* Generated from brand/tokens.json */\n:root {\n${css}\n${common}\n}\n[data-theme="light"], :root.light {\n${light}\n}\n`,
  );
let dart =
  "// Generated from brand/tokens.json\nimport 'package:flutter/material.dart';\nclass VibesTokens {\n";
for (const [mode, values] of Object.entries(tokens).filter(([k]) =>
  ["dark", "light"].includes(k),
))
  for (const [k, v] of Object.entries(values))
    dart += `  static const ${mode}${k[0].toUpperCase() + k.slice(1)} = Color(0xFF${v.slice(1)});\n`;
await write("app/lib/core/config/brand_tokens.dart", dart + "}\n");
const square = mark.replace('rx="17"', 'rx="0"');
for (const [p, size] of [
  ["app/assets/icons/app_icon.png", 1024],
  ["app/assets/icons/splash_icon.png", 512],
  ["app/web/favicon.png", 32],
]) {
  const buf = await sharp(Buffer.from(square)).flatten({background:'#151016'})
    .resize(size, size)
    .flatten({ background: '#151016' })
    .png()
    .toBuffer();
  await write(p, buf);
}
await write("dashboard/public/brand.svg", mark);
// Existing launcher tooling reads these assets.
await write(
  "app/assets/icons/ic_launcher_background.png",
  await sharp({
    create: { width: 1024, height: 1024, channels: 4, background: "#151016" },
  })
    .png()
    .toBuffer(),
);
const fg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 108 108"><g transform="translate(27 27) scale(.84)">${mark.replace(/<svg[^>]*>|<\/svg>|<rect[^>]*\/>/g, "")}</g></svg>`;
await write(
  "app/assets/icons/ic_launcher_foreground.png",
  await sharp(Buffer.from(fg)).resize(1024).png().toBuffer(),
);
await write(
  "app/assets/icons/ic_launcher_monochrome.png",
  await sharp(Buffer.from(fg.replaceAll("#ff3d81", "#fafafa")))
    .resize(1024)
    .png()
    .toBuffer(),
);
for (const platform of ["ios", "macos"]) {
  const dir = `app/${platform}/Runner/Assets.xcassets/AppIcon.appiconset`;
  const content = JSON.parse(
    await fs.readFile(path.join(root, dir, "Contents.json")),
  );
  for (const entry of content.images)
    if (entry.filename) {
      const size = Math.round(
        parseFloat(entry.size) * parseFloat(entry.scale || "1"),
      );
      await write(
        `${dir}/${entry.filename}`,
        await sharp(Buffer.from(square)).flatten({background:'#151016'}).resize(size, size).png().toBuffer(),
      );
    }
}
for (const [density, size] of Object.entries({
  mdpi: 48,
  hdpi: 72,
  xhdpi: 96,
  xxhdpi: 144,
  xxxhdpi: 192,
})) {
  for (const name of ["ic_launcher", "launcher_icon"])
    await write(
      `app/android/app/src/main/res/mipmap-${density}/${name}.png`,
      await sharp(Buffer.from(square)).flatten({background:'#151016'}).resize(size).png().toBuffer(),
    );
}
for (const [name, size] of [
  ["Icon-192.png", 192],
  ["Icon-512.png", 512],
  ["Icon-maskable-192.png", 192],
  ["Icon-maskable-512.png", 512],
])
  await write(
    `app/web/icons/${name}`,
    await sharp(Buffer.from(square)).flatten({background:'#151016'}).resize(size).png().toBuffer(),
  );
// ICO containers with PNG payloads are supported by current Windows and browsers.
async function iconFile(sizes) {
  const pngs = await Promise.all(
    sizes.map((size) =>
      sharp(Buffer.from(square)).flatten({background:'#151016'}).resize(size, size).png().toBuffer(),
    ),
  );
  const header = Buffer.alloc(6 + 16 * sizes.length);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(sizes.length, 4);
  let offset = header.length;
  sizes.forEach((size, index) => {
    const base = 6 + 16 * index;
    header[base] = size === 256 ? 0 : size;
    header[base + 1] = size === 256 ? 0 : size;
    header.writeUInt16LE(1, base + 4);
    header.writeUInt16LE(32, base + 6);
    header.writeUInt32LE(pngs[index].length, base + 8);
    header.writeUInt32LE(offset, base + 12);
    offset += pngs[index].length;
  });
  return Buffer.concat([header, ...pngs]);
}
await write("dashboard/public/favicon.ico", await iconFile([16, 32, 48]));
await write(
  "app/windows/runner/resources/app_icon.ico",
  await iconFile([16, 24, 32, 48, 64, 128, 256]),
);
console.log("Generated brand masters, platform tokens and icons.");
