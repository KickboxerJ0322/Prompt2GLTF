"use strict";
const http = require("http");
const fs   = require("fs");
const path = require("path");
const { exec } = require("child_process");

const ROOT = __dirname;          // plugins/prompt2gltf/
const PORT = 3456;

const MIME = {
  ".html": "text/html",
  ".js":   "application/javascript",
  ".mjs":  "application/javascript",
  ".json": "application/json",
  ".glb":  "model/gltf-binary",
  ".gltf": "model/gltf+json",
  ".css":  "text/css",
  ".png":  "image/png",
  ".jpg":  "image/jpeg",
};

const server = http.createServer((req, res) => {
  // Default to preview.html
  let urlPath = req.url.split("?")[0];
  if (urlPath === "/") urlPath = "/preview.html";

  const filePath = path.join(ROOT, urlPath);

  // Security: stay inside ROOT
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403); res.end("Forbidden"); return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Not found: " + urlPath);
      return;
    }
    const ext  = path.extname(filePath).toLowerCase();
    const mime = MIME[ext] || "application/octet-stream";
    res.writeHead(200, { "Content-Type": mime, "Cache-Control": "no-cache" });
    res.end(data);
  });
});

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    const url = `http://localhost:${PORT}/`;
    console.log(`\nPort ${PORT} already in use — opening existing server:`);
    console.log(`  ${url}\n`);
    const cmd = process.platform === "win32" ? `start ${url}` :
                process.platform === "darwin" ? `open ${url}` : `xdg-open ${url}`;
    exec(cmd);
  } else {
    throw err;
  }
});

server.listen(PORT, "127.0.0.1", () => {
  const url = `http://localhost:${PORT}/`;
  console.log(`\nprompt2gltf Gallery`);
  console.log(`  ${url}`);
  console.log(`\nCtrl+C to stop\n`);
  const cmd = process.platform === "win32" ? `start ${url}` :
              process.platform === "darwin" ? `open ${url}` : `xdg-open ${url}`;
  exec(cmd);
});
