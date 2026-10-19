// Paikallinen kehityspalvelin: tarjoilee staattiset tiedostot ja ajaa api/-funktiot
// samaan tapaan kuin Vercel. Käynnistys: node dev-server.mjs  (portti: PORT tai 5186)
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT) || 5186;
const types = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".png": "image/png", ".ico": "image/x-icon",
};

http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = decodeURIComponent(url.pathname);

  if (pathname.startsWith("/api/")) {
    const file = path.join(root, "api", pathname.slice(5).replace(/\.js$/, "") + ".js");
    if (!file.startsWith(path.join(root, "api")) || !fs.existsSync(file)) {
      res.writeHead(404).end("Not found");
      return;
    }
    const { default: handler } = await import(pathToFileURL(file).href);
    // Vercelin response-apurit (status/json/setHeader)
    res.status = (code) => { res.statusCode = code; return res; };
    res.json = (data) => { res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify(data)); return res; };
    try { await handler(req, res); } catch (e) { res.statusCode = 500; res.end(String(e)); }
    return;
  }

  let file = path.join(root, pathname === "/" ? "index.html" : pathname);
  if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404).end("Not found");
    return;
  }
  res.writeHead(200, { "Content-Type": types[path.extname(file)] || "application/octet-stream" });
  fs.createReadStream(file).pipe(res);
}).listen(port, "127.0.0.1", () => console.log(`opt86elake: http://127.0.0.1:${port}/`));
