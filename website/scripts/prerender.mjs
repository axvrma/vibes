import fs from "node:fs/promises";
import { createServer } from "vite";

const server = await createServer({
  server: { middlewareMode: true },
  appType: "custom",
});
try {
  const { render } = await server.ssrLoadModule("/src/entry-server.tsx");
  const html = await fs.readFile("dist/index.html", "utf8");
  await fs.writeFile(
    "dist/index.html",
    html.replace("<!--app-html-->", render()),
  );
  console.log("Prerendered the complete page for crawlers and first paint.");
} finally {
  await server.close();
}
