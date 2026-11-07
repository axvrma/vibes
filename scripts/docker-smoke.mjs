// Disposable integration test. Never uses the deployment's named volume or media.
import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import net from "node:net";
import { createRequire } from "node:module";
const root = path.resolve(import.meta.dirname, "..");
const name = `vibes-23-test-${process.pid}`;
const temp = await fs.mkdtemp(path.join(os.tmpdir(), "vibes-docker-"));
const containers = [];
const docker = (...args) =>
  execFileSync("docker", args, {
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
  }).trim();
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const reserve = net.createServer();
await new Promise((resolve) => reserve.listen(0, "127.0.0.1", resolve));
const testPort = reserve.address().port;
await new Promise((resolve) => reserve.close(resolve));
let origin = `http://127.0.0.1:${testPort}`,
  token = "";
const api = async (url, method = "GET", body) => {
  const res = await fetch(`${origin}/api${url}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = res.status === 204 ? {} : await res.json();
  assert.ok(res.ok, `${method} ${url}: ${res.status} ${JSON.stringify(data)}`);
  return data;
};
try {
  await fs.mkdir(path.join(temp, "Technology"));
  await fs.copyFile(
    path.join(root, "website/public/media/alpine.mp4"),
    path.join(temp, "Technology/sample.mp4"),
  );
  docker("network", "create", name);
  docker("volume", "create", `${name}-data`);
  const run = (service, args) => {
    const id = `${name}-${service}`;
    docker(
      "run",
      "-d",
      "--name",
      id,
      "--network",
      name,
      "--network-alias",
      service,
      ...args,
    );
    containers.push(id);
    return id;
  };
  const server = run("server", [
    "-e",
    "NODE_ENV=production",
    "-e",
    "AUTH_ACCESS_TOKEN_SECRET=disposable-test-access-secret-at-least-32-characters",
    "-e",
    "AUTH_REFRESH_TOKEN_PEPPER=disposable-test-refresh-pepper-at-least-32-characters",
    "-e",
    "AUTH_COOKIE_SECURE=false",
    "-e",
    `CORS_ORIGIN=${origin}`,
    "-e",
    "DATABASE_PATH=/app/data/sqlite.db",
    "-e",
    "DATA_DIR=/app/data",
    "-e",
    'MEDIA_ROOTS={"test":"/media/test"}',
    "-v",
    `${name}-data:/app/data`,
    "--mount",
    `type=bind,source=${temp},target=/media/test,readonly`,
    "vibes-23-validation-server",
  ]);
  run("dashboard", ["vibes-23-validation-dashboard"]);
  run("app", ["vibes-23-validation-app"]);
  const gateway = run("gateway", [
    "-p",
    `127.0.0.1:${testPort}:80`,
    "-v",
    `${root}/infra/nginx.conf:/etc/nginx/nginx.conf:ro`,
    "nginx:alpine",
  ]);
  const port = JSON.parse(docker("inspect", gateway))[0].NetworkSettings.Ports[
    "80/tcp"
  ][0].HostPort;
  origin = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(`${origin}/api/health`)).ok) break;
    } catch {}
    await wait(500);
  }
  assert.equal((await fetch(`${origin}/api/health`)).status, 200);
  for (const endpoint of [
    "/app/",
    "/app/a-deep-route",
    "/dashboard/",
    "/dashboard/dashboard/libraries",
  ])
    assert.equal((await fetch(`${origin}${endpoint}`)).status, 200, endpoint);
  docker(
    "exec",
    server,
    "node",
    "-e",
    `const db=require('./dist/db').default;require('argon2').hash('Disposable-test-password!23').then(hash=>db.prepare("INSERT INTO users(id,email,password_hash,role,is_active,created_at,updated_at) VALUES ('test-admin','admin@example.test',?,'admin',1,'now','now')").run(hash))`,
  );
  const login = await api("/auth/login", "POST", {
    email: "admin@example.test",
    password: "Disposable-test-password!23",
    clientType: "mobile",
  });
  token = login.accessToken;
  const lib = (
    await api("/libraries", "POST", { name: "Disposable SSD", rootId: "test" })
  ).library;
  async function scan() {
    const job = (await api(`/libraries/${lib.id}/scans`, "POST", {})).job;
    for (let i = 0; i < 120; i++) {
      const result = await api(`/scans/${job.id}`);
      if (!["running", "queued"].includes(result.job.status)) return result;
      await wait(250);
    }
    throw Error("Scan timeout");
  }
  const first = await scan();
  assert.equal(first.job.status, "completed", JSON.stringify(first));
  assert.equal(first.job.added_count, 1);
  const video = (await api("/videos")).videos[0];
  assert.equal(video.sourceType, "external");
  assert.equal(video.category.name, "Technology");
  await api(`/videos/${video.id}/state`, "PUT", {
    liked: true,
    note: "Keep this",
    progress_seconds: 2,
  });
  const signed = await api(`/videos/${video.id}/media-ticket`, "POST", {
    kind: "stream",
  });
  const range = await fetch(`${origin}${signed.url}`, {
    headers: { Range: "bytes=0-31" },
  });
  assert.equal(range.status, 206);
  assert.equal((await range.arrayBuffer()).byteLength, 32);
  assert.equal(
    (await fetch(`${origin}/api/videos/${video.id}/stream?token=${token}`))
      .status,
    401,
  );
  const thumb = await api(`/videos/${video.id}/media-ticket`, "POST", {
    kind: "thumbnail",
  });
  assert.equal(
    (await fetch(`${origin}${thumb.url}`)).headers.get("content-type"),
    "image/jpeg",
  );
  const second = await scan();
  assert.equal(second.job.skipped_count, 1);
  assert.equal(second.job.added_count, 0);
  assert.equal((await api("/videos")).pagination.total, 1);
  // Real browser login, library results and responsive management against this server.
  const browserRequire = createRequire(
    new URL("../website/package.json", import.meta.url),
  );
  const { chromium } = browserRequire("@playwright/test");
  const browser = await chromium.launch({
    headless: true,
    executablePath:
      process.env.CHROME_PATH ||
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  });
  try {
    const flutterPage=await browser.newPage({viewport:{width:375,height:812}});
  const outside=[];const flutterErrors=[];
  flutterPage.on('request',request=>{if(/^https?:/.test(request.url())&&!request.url().startsWith(origin+'/'))outside.push(request.url());});
  flutterPage.on('pageerror',error=>flutterErrors.push(error.message));
  await flutterPage.goto(`${origin}/app/`);
  const semantics=flutterPage.locator('flt-semantics-placeholder');await semantics.waitFor({state:'attached',timeout:60000});await semantics.evaluate(element=>element.click());
  await flutterPage.getByRole('button',{name:'Get Started',exact:true}).click();
  await flutterPage.getByRole('button',{name:'Continue to Login',exact:true}).waitFor();
  assert.equal(await flutterPage.getByRole('button',{name:'On this device',exact:true}).count(),0,'Web offered unsupported local folders');
  assert.deepEqual(outside,[],'Flutter fetched resources outside this self-hosted origin');assert.deepEqual(flutterErrors,[],'Flutter startup errors');
  await fs.mkdir(path.join(root,'docs/screenshots'),{recursive:true});await flutterPage.screenshot({path:path.join(root,'docs/screenshots/flutter-web-onboarding.png')});await flutterPage.close();
  const page = await browser.newPage({
      viewport: { width: 1440, height: 1000 },
      reducedMotion: "reduce",
    });
    await page.goto(`${origin}/dashboard/login`);
    await page.getByLabel("Email Address").fill("admin@example.test");
    await page
      .getByLabel("Password", { exact: true })
      .fill("Disposable-test-password!23");
    await page.getByRole("button", { name: "Sign In", exact: true }).click();
    await page
      .getByRole("heading", { name: "Your private video universe" })
      .waitFor();
    await page
      .getByRole("link", { name: "Media Libraries", exact: true })
      .click();
    await page
      .getByRole("heading", { name: "Disposable SSD", exact: true })
      .waitFor();
    await fs.mkdir(path.join(root, "docs/screenshots"), { recursive: true });
    await page.screenshot({
      path: path.join(root, "docs/screenshots/media-libraries-desktop.png"),
      fullPage: true,
    });
    await page.getByRole("link", { name: "Videos", exact: true }).click();
    await page.getByRole("heading", { name: "Videos", exact: true }).waitFor();
    await page
      .getByLabel("Search videos", { exact: true })
      .fill("no matching video");
    await page.getByText("No videos match these filters.").waitFor();
    await page.getByLabel("Search videos", { exact: true }).fill("sample");
    await page
      .getByRole("button", { name: "Play sample", exact: true })
      .waitFor();
    await page
      .getByRole("button", { name: "Details", exact: true })
      .first()
      .click();
    await page
      .getByRole("heading", { name: "Video details", exact: true })
      .waitFor();
    await page.getByRole("button", { name: "Close", exact: true }).click();
    await page.setViewportSize({ width: 375, height: 812 });
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
      "Mobile dashboard overflow",
    );
    await page.screenshot({
      path: path.join(root, "docs/screenshots/videos-mobile.png"),
      fullPage: true,
    });
    const context = await browser.newContext();
    const loggedOut = await context.newPage();
    await loggedOut.goto(`${origin}/dashboard/dashboard/libraries`);
    await loggedOut
      .getByRole("heading", { name: "Vibes Dashboard", exact: true })
      .waitFor();
    await context.close();
  } finally {
    await browser.close();
  }
  await api(`/libraries/${lib.id}`, "DELETE");
  const restored = (
    await api("/libraries", "POST", { name: "Reconnected", rootId: "test" })
  ).library;
  assert.equal(restored.id, lib.id);
  await scan();
  await fs.rename(
    path.join(temp, "Technology/sample.mp4"),
    path.join(temp, "Technology/renamed.mp4"),
  );
  if (process.env.DEBUG_SCAN)
    console.log(
      docker(
        "exec",
        server,
        "node",
        "-e",
        `const fs=require('fs');const db=require('./dist/db').default;const handle=fs.openSync('/media/test/Technology/renamed.mp4','r');const s=fs.fstatSync(handle);console.log(JSON.stringify({db:db.prepare('SELECT id,fingerprint,mtime_ms,size_bytes,relative_path FROM videos').all(),file:{dev:s.dev,ino:s.ino,mtime:s.mtimeMs,birth:s.birthtimeMs,size:s.size}}));`,
      ),
    );
  await scan();
  assert.equal((await api("/videos")).videos[0].id, video.id);
  assert.equal((await api(`/videos/${video.id}/state`)).note, "Keep this");
  docker(
    "exec",
    server,
    "node",
    "dist/cli/backup.js",
    "/app/data/test-backup.db",
  );
  docker("restart", server);
  await wait(1500);
  assert.equal((await api("/videos")).pagination.total, 1);
  assert.equal((await api(`/videos/${video.id}/state`)).liked, 1);
  await fs.unlink(path.join(temp, "Technology/renamed.mp4"));
  const missing = await scan();
  assert.equal(missing.job.missing_count, 1);
  assert.equal((await api(`/videos/${video.id}/state`)).note, "Keep this");
  const form = new FormData();
  form.append(
    "video",
    new Blob(
      [await fs.readFile(path.join(root, "website/public/media/alpine.mp4"))],
      { type: "video/mp4" },
    ),
    "upload.mp4",
  );
  form.append("title", "Preserved upload flow");
  const upload = await fetch(`${origin}/api/upload`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  assert.equal(upload.status, 201, await upload.clone().text());
  const uploaded = (await upload.json()).video;
  const uploadRange = await fetch(
    `${origin}/api/videos/${uploaded.id}/stream`,
    { headers: { Authorization: `Bearer ${token}`, Range: "bytes=0-15" } },
  );
  assert.equal(uploadRange.status, 206);
  assert.equal((await uploadRange.arrayBuffer()).byteLength, 16);
  // The read-only mount must reject writes, independently of UI permissions.
  assert.throws(() =>
    docker(
      "exec",
      server,
      "node",
      "-e",
      "require('fs').writeFileSync('/media/test/cannot-write','x')",
    ),
  );
  console.log(
    JSON.stringify(
      {
        status: "passed",
        checks: [
          "gateway health and SPA routes",
          "real FFprobe and FFmpeg indexing",
          "folder category",
          "authenticated range playback",
          "thumbnail ticket",
          "bearer query rejection",
          "idempotent refresh",
          "archive/reconnect and rename identity",
          "state preservation",
          "online SQLite backup",
          "restart persistence",
          "missing file preserves metadata",
          "real MP4/H.264 upload and playback",
          "read-only mount enforcement",
          "real desktop/mobile dashboard browser flows",
        "Flutter web onboarding and same-origin renderer",
        ],
        firstScanMs: first.job.duration_ms,
        unchangedScanMs: second.job.duration_ms,
      },
      null,
      2,
    ),
  );
} finally {
  for (const container of containers.reverse())
    try {
      docker("rm", "-f", container);
    } catch {}
  try {
    docker("volume", "rm", `${name}-data`);
  } catch {}
  try {
    docker("network", "rm", name);
  } catch {}
  await fs.rm(temp, { recursive: true, force: true });
}
