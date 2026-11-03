import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import sharp from "sharp";
import ffmpeg from "ffmpeg-static";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const artwork = path.join(root, "src/assets");
const media = path.join(root, "public/media");
await fs.mkdir(artwork, { recursive: true });
await fs.mkdir(media, { recursive: true });

// Original vector compositions. No downloaded photographs, music, or third-party footage.
const svg = (body, definitions = "") =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="1280" viewBox="0 0 720 1280"><defs><filter id="grain"><feTurbulence type="fractalNoise" baseFrequency=".63" numOctaves="3" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncA type="linear" slope=".13"/></feComponentTransfer><feBlend in="SourceGraphic" mode="soft-light"/></filter><linearGradient id="shade" x2="0" y2="1"><stop stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#041717" stop-opacity=".4"/></linearGradient>${definitions}</defs>${body}<rect width="720" height="1280" fill="transparent" filter="url(#grain)" opacity=".5"/></svg>`;
let seed = 44;
const random = () => {
  seed = (seed * 16807) % 2147483647;
  return (seed - 1) / 2147483646;
};
function trees(count, y, range, color, size) {
  return Array.from({ length: count }, () => {
    const x = random() * 760 - 20;
    const base = y + random() * range;
    const h = (0.5 + random()) * size;
    return `<path d="M${x} ${base - h}l${-h * 0.22} ${h * 0.6}h${h * 0.09}l${-h * 0.2} ${h * 0.4}h${h * 0.66}l${-h * 0.2} ${-h * 0.4}h${h * 0.09}Z" fill="${color}"/><path d="M${x} ${base - h * 0.35}v${h * 0.4}" stroke="${color}" stroke-width="3"/>`;
  }).join("");
}
const alpine = svg(
  `
<rect width="720" height="1280" fill="url(#sky)"/><ellipse cx="470" cy="228" rx="180" ry="120" fill="#fff5cd" opacity=".1"/>
<path d="M0 410L58 359 104 380 160 279 203 329 250 218 313 311 375 235 422 327 485 263 548 364 602 308 720 415V780H0Z" fill="#869a9a"/>
<path d="M0 510L60 483 121 386 166 451 250 218 302 323 324 374 375 235 423 332 450 381 485 263 510 354 556 405 602 308 720 486V800H0Z" fill="url(#mountain)"/>
<path d="M121 386l-14 89 46-54 13 30 84-233 52 105-27-14-7 37-25-29-25 52-20 6-7 58-25 12-14 53-20-47-22 36zM375 235l-23 138 24-36 8 53 15-14 24 53 27-48-27-49zM485 263l-10 108 21-27 14 44 28 0-28-34zM602 308l-17 85 22-21 30 39 37 4z" fill="#d6e0d8" opacity=".9"/>
<path d="M0 553l101-47 109 54 99-67 85 48 102-28 111 43 113-41v230H0Z" fill="#527f76"/>
<rect y="642" width="720" height="638" fill="url(#lake)"/>
<path d="M0 603l110 34 126-9 134 52 139-55 125 16 86-32v69l-87 24-126-20-128 72-158-82-126 4L0 651Z" fill="#b7c8aa" opacity=".14"/>
${Array.from({ length: 38 }, (_, i) => `<path d="M${random() * 180} ${700 + i * 14}h${140 + random() * 550}" stroke="#cbe0bd" opacity="${0.03 + random() * 0.12}" stroke-width="${1 + random() * 2}"/>`).join("")}
<path d="M0 578l84 33 57 83 33 76-52 83-122 53Z" fill="#1c4d43"/><path d="M720 559l-89 82-27 80-52 51 76 63 92 35Z" fill="#285c4b"/>
${trees(70, 630, 80, "#1d4a3e", 100)}${trees(20, 790, 175, "#173e34", 140)}
<path d="M0 1020q95-32 159 39t163 25q-80 79-123 196H0Z" fill="#183b32"/><path d="M720 930q-97 85-160 77t-80 51q123-10 240 78Z" fill="#224f40"/>
<path d="M0 1226q120-29 209-7t235 61H0" fill="#0e2c26"/><rect width="720" height="1280" fill="url(#shade)"/>
`,
  `<linearGradient id="sky" x2="0" y2="1"><stop stop-color="#789ba2"/><stop offset=".55" stop-color="#e1d9ba"/><stop offset="1" stop-color="#8ab3a5"/></linearGradient><linearGradient id="mountain" x2=".6" y2="1"><stop stop-color="#78918e"/><stop offset=".5" stop-color="#4c6d6a"/><stop offset="1" stop-color="#2e5d51"/></linearGradient><linearGradient id="lake" x2=".3" y2="1"><stop stop-color="#608c78"/><stop offset=".4" stop-color="#478b76"/><stop offset="1" stop-color="#123f38"/></linearGradient>`,
);

const coffee = svg(
  `<rect width="720" height="1280" fill="url(#table)"/>
<path d="M-80 0h220l500 1280H420Z" fill="#ffd3aa" opacity=".18"/><path d="M300 0h40l500 1280h-40Z" fill="#fff0ce" opacity=".1"/>
<ellipse cx="395" cy="755" rx="260" ry="300" fill="#4a251d" opacity=".25"/>
<ellipse cx="344" cy="699" rx="245" ry="258" fill="#eac8ab"/><ellipse cx="344" cy="691" rx="224" ry="236" fill="#f3d8bd"/><ellipse cx="344" cy="694" rx="192" ry="201" fill="#a66e4e" opacity=".25"/>
<path d="M490 563q145-30 150 81t-129 110l-17-42q89 3 91-68t-88-37Z" fill="#f3d8bd"/><path d="M494 601q97-13 97 48t-90 68" stroke="#bf9473" fill="none" stroke-width="8"/>
<ellipse cx="340" cy="661" rx="177" ry="191" fill="#f2d7bb"/><ellipse cx="340" cy="644" rx="163" ry="171" fill="#dca273"/><ellipse cx="340" cy="641" rx="150" ry="158" fill="url(#espresso)"/>
<path d="M338 741C300 690 233 672 251 617q13-42 45-18 22-78 50-41 40-40 51 9 48-3 25 42 32 41-24 62Z" fill="#f6ddbd"/>
<path d="M335 718q-40-60-65-74m65 52q-7-65-34-82m38 59q18-75 10-95m-7 115q53-63 58-103m-62 144q44-19 57-43" fill="none" stroke="#b97e51" stroke-width="5" stroke-linecap="round"/>
<path d="M330 757l26-32" stroke="#f9e0be" stroke-width="8" stroke-linecap="round"/>
<path d="M270 470q-87-101 17-191t-3-173M370 431q90-101-3-203t51-148" stroke="#ffdeb5" stroke-width="16" opacity=".12" fill="none" stroke-linecap="round"/>
<path d="M38 974l174-37 31 85-172 49Z" fill="#9f5536"/><path d="M43 975l169-38-63 31 20 38-97 37Z" fill="#ce9259"/>
${Array.from({ length: 13 }, () => `<ellipse cx="${95 + random() * 500}" cy="${990 + random() * 160}" rx="${5 + random() * 6}" ry="${8 + random() * 6}" fill="#4d2a20" transform="rotate(${random() * 70} 350 1080)"/>`).join("")}
`,
  `<linearGradient id="table" x2="1" y2="1"><stop stop-color="#ddad7d"/><stop offset=".5" stop-color="#ad6f49"/><stop offset="1" stop-color="#653c31"/></linearGradient><radialGradient id="espresso"><stop stop-color="#c39765"/><stop offset=".8" stop-color="#aa7548"/><stop offset="1" stop-color="#70452c"/></radialGradient>`,
);

const city = svg(
  `<rect width="720" height="1280" fill="url(#citysky)"/>
<circle cx="560" cy="235" r="92" fill="#f6d6a3"/>
<path d="M-30 381L250 275v1005H-30Z" fill="#a4887f"/><path d="M250 275l84 80v925h-84Z" fill="#7c6870"/>
${Array.from({ length: 12 }, (_, i) => `<path d="M0 ${428 + i * 60}l250-95" stroke="#725c61" stroke-width="3" opacity=".5"/>`).join("")}
<path d="M720 420L414 316v964h306Z" fill="#e7baa0"/><path d="M414 316l-57 69v895h57Z" fill="#b2857d"/>
<path d="M452 509v771h211V589q0-178-105-197T452 509Z" fill="#b0847c"/><path d="M482 556v724h151V602q0-128-76-155t-75 109Z" fill="#4e5064"/>
<path d="M486 689l143 39M486 813l143 39M486 937l143 39M486 1061l143 39" stroke="#bd9992" stroke-width="7"/>
<path d="M553 461v819" stroke="#b4948d" stroke-width="5"/>
<path d="M-30 637q0-129 103-129t103 129v643H-30Z" fill="#dbc0a4"/><path d="M-5 663q0-101 74-101t74 101v617H-5Z" fill="#514b58"/>
<path d="M0 1100l720-70v250H0Z" fill="#866f6d"/><path d="M290 959l90-27 29 348H264Z" fill="#c6a48d"/><path d="M0 1256l720-75" stroke="#d7b498" stroke-width="4"/>
<path d="M250 275v1005M414 316v964" stroke="#ffe0bd" opacity=".4" stroke-width="2"/>
`,
  `<linearGradient id="citysky" x2=".3" y2="1"><stop stop-color="#6d829b"/><stop offset=".5" stop-color="#b2b4c3"/><stop offset="1" stop-color="#d5bcae"/></linearGradient>`,
);

const ocean = svg(
  `<rect width="720" height="1280" fill="url(#water)"/>
<path d="M720 0v1280H121q89-152 89-251t164-193 107-272T720 0Z" fill="url(#sand)"/>
<path d="M720 0Q515 278 509 430T435 717 293 919 211 1124 98 1280" fill="none" stroke="#d2f1dc" stroke-width="54" opacity=".35"/>
<path d="M720 0Q515 278 509 430T435 717 293 919 211 1124 98 1280" fill="none" stroke="#e8f3df" stroke-width="18" opacity=".8"/>
${Array.from({ length: 24 }, (_, i) => `<path d="M-110 ${i * 75 - 200}q145-50 270 16t240 1" fill="none" stroke="#a3e0d0" stroke-width="${2 + random() * 8}" opacity="${0.08 + random() * 0.14}" transform="rotate(-35 200 600)"/>`).join("")}
<path d="M711 623q-66 97-46 157t-67 144" stroke="#ac976f" stroke-width="6" fill="none" opacity=".2"/>
<path d="M720 46q-74 11-98 80l98-9Z" fill="#3d6651"/><path d="M720 0H614l-5 64-56 32 49 23 29-27 89 4Z" fill="#234d3d"/>
${Array.from({ length: 35 }, () => `<circle cx="${530 + random() * 190}" cy="${random() * 155}" r="${12 + random() * 20}" fill="${random() > 0.5 ? "#365c3e" : "#47724b"}"/>`).join("")}
<path d="M477 1050q7-9 14 0l-4 44-13-1Z" fill="#b56e4a"/><path d="M470 1036q10-17 25 1" fill="none" stroke="#f6d5ae" stroke-width="7"/>
`,
  `<linearGradient id="water" x2="1" y2=".6"><stop stop-color="#19495b"/><stop offset=".5" stop-color="#438e94"/><stop offset="1" stop-color="#7ab5a1"/></linearGradient><linearGradient id="sand" x2=".5" y2="1"><stop stop-color="#dbcaa8"/><stop offset="1" stop-color="#bfa57f"/></linearGradient>`,
);

const night = svg(
  `<rect width="720" height="1280" fill="url(#nightsky)"/>
<circle cx="450" cy="235" r="50" fill="#e8bbcb"/><circle cx="472" cy="215" r="47" fill="#272b47"/>
${Array.from({ length: 48 }, () => `<circle cx="${random() * 720}" cy="${random() * 550}" r="${0.5 + random() * 1.2}" fill="#edd1dc" opacity="${random()}"/>`).join("")}
${Array.from({ length: 15 }, (_, i) => {
  const x = i * 52 - 20;
  const y = 440 + random() * 180;
  const h = 1000 - y;
  return `<rect x="${x}" y="${y}" width="48" height="${h}" fill="${i % 2 ? "#262d45" : "#36334d"}"/>${Array.from({ length: 12 }, (_, j) => `<path d="M${x + 8} ${y + 15 + j * 30}h9m9 0h9" stroke="${random() > 0.5 ? "#eab4ba" : "#9093c9"}" opacity="${random() * 0.8}" stroke-width="5"/>`).join("")}`;
}).join("")}
<path d="M0 830l280-110h160l280 110v450H0Z" fill="#161e31"/>
<path d="M0 1280l290-538h140l290 538Z" fill="url(#road)"/><path d="M185 1280l148-538M535 1280L388 742" stroke="#dba1b1" opacity=".5" stroke-width="3"/>
<path d="M360 1280V750" stroke="#edc7bd" stroke-width="4" stroke-dasharray="70 55"/>
<path d="M73 1060l250-314M647 1100L396 746" stroke="#f385b3" stroke-width="9" opacity=".35"/>
<path d="M130 932V602m460 330V602" stroke="#69617d" stroke-width="5"/><path d="M130 607q-1-31 43-31m417 31q0-31-43-31" stroke="#69617d" stroke-width="6" fill="none"/>
<path d="M156 580h27m354 0h27" stroke="#ffe0b9" stroke-width="7"/>
<rect x="285" y="905" width="74" height="45" rx="9" fill="#373951"/><path d="M291 935h12m38 0h12" stroke="#ff6fa5" stroke-width="7"/>
`,
  `<linearGradient id="nightsky" x2="0" y2="1"><stop stop-color="#1c233b"/><stop offset=".5" stop-color="#5a415e"/><stop offset="1" stop-color="#e18e9f"/></linearGradient><linearGradient id="road" x2="0" y2="1"><stop stop-color="#3f354f"/><stop offset="1" stop-color="#181f35"/></linearGradient>`,
);

const scenes = { alpine, coffee, city, ocean, night };
async function run(command, args) {
  await new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "ignore", "pipe"] });
    let error = "";
    child.stderr.on("data", (data) => {
      error += data;
    });
    child.on("error", reject);
    child.on("close", (code) =>
      code === 0 ? resolve() : reject(new Error(error)),
    );
  });
}
for (const [id, source] of Object.entries(scenes)) {
  await fs.writeFile(path.join(artwork, `${id}.svg`), source);
  const image = await sharp(Buffer.from(source)).png().toBuffer();
  await sharp(image)
    .resize(540, 960)
    .webp({ quality: 85 })
    .toFile(path.join(media, `${id}.webp`));
  const temporary = path.join(artwork, `.${id}.png`);
  await fs.writeFile(temporary, image);
  // Eight seconds, 24 fps, silent H.264. Very slow camera drift gives each original composition life.
  await run(ffmpeg, [
    "-y",
    "-i",
    temporary,
    "-vf",
    "scale=1440:2560,zoompan=z='1.05+0.00022*on':x='iw/2-(iw/zoom/2)+12*sin(on/100)':y='ih/2-(ih/zoom/2)':d=192:s=480x854:fps=24",
    "-c:v",
    "libx264",
    "-preset",
    "fast",
    "-crf",
    "26",
    "-pix_fmt",
    "yuv420p",
    "-movflags",
    "+faststart",
    "-an",
    path.join(media, `${id}.mp4`),
  ]);
  await fs.unlink(temporary);
  console.log(`Generated ${id}: SVG, WebP poster, 8-second MP4.`);
}
const wordmark = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 121 43" fill="none"><g stroke="#fafafa" stroke-width="6.5" stroke-linecap="round" stroke-linejoin="round"><path d="m6 15 7 18 7-18M30 16v17M42 5v28m0-10c0-13 18-13 18 0s-18 13-18 0ZM71 24h17c0-13-18-14-18-1 0 12 12 12 17 7M110 17c-6-5-17-3-17 3 0 7 17 2 17 9 0 6-12 8-18 3"/></g><circle cx="30" cy="6" r="3.6" fill="#fafafa"/><circle cx="118" cy="33" r="3" fill="#ff3d81"/></svg>`;
await fs.writeFile(path.join(root, "public/wordmark.svg"), wordmark);
await fs.writeFile(
  path.join(root, "public/favicon.svg"),
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="17" fill="#151016"/><path d="m14 20 13 27 13-27" fill="none" stroke="#fafafa" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/><circle cx="49" cy="45" r="5" fill="#ff3d81"/></svg>`,
);
const og = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630"><defs><radialGradient id="glow"><stop stop-color="#882654"/><stop offset="1" stop-color="#09090b"/></radialGradient></defs><rect width="1200" height="630" fill="#09090b"/><ellipse cx="950" cy="330" rx="520" ry="480" fill="url(#glow)"/><g transform="translate(70 60) scale(1.2)">${wordmark.replace(/<\/?svg[^>]*>/g, "")}</g><text x="70" y="205" font-family="sans-serif" font-size="14" fill="#ff9ac0" letter-spacing="4">OPEN SOURCE · SELF-HOSTED · MADE FOR YOU</text><text x="65" y="305" font-family="sans-serif" font-size="77" fill="#fafafa" font-weight="700" letter-spacing="-4">Your feed.</text><text x="65" y="395" font-family="sans-serif" font-size="77" fill="#ff8db9" font-weight="700" letter-spacing="-4">Your rules.</text><text x="70" y="485" font-family="sans-serif" font-size="20" fill="#b6a5bb">Scroll freely. Own the experience.</text><rect x="840" y="65" width="267" height="519" rx="38" fill="#29212e" stroke="#7b637c" stroke-width="2"/><image href="data:image/svg+xml;base64,${Buffer.from(alpine).toString("base64")}" x="847" y="72" width="253" height="505" preserveAspectRatio="xMidYMid slice"/><rect x="840" y="65" width="267" height="519" rx="38" fill="none" stroke="#29212e" stroke-width="13"/><rect x="933" y="80" width="80" height="19" rx="12" fill="#151217"/><text x="866" y="472" font-family="sans-serif" font-size="23" fill="#fff" font-weight="600">A little closer</text><text x="866" y="503" font-family="sans-serif" font-size="23" fill="#fff" font-weight="600">to nowhere.</text><text x="70" y="570" font-family="monospace" font-size="13" fill="#a090a9">github.com/axvrma/vibes</text></svg>`;
await sharp(Buffer.from(og))
  .png()
  .toFile(path.join(root, "public/og-image.png"));
console.log("Generated original brand assets and social preview.");
