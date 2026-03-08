"use strict";
const fs   = require("fs");
const path = require("path");

const TARGET = path.join(__dirname, "index.mjs");
let code = fs.readFileSync(TARGET, "utf8");

// 1. Move preview.html to PLUGIN_ROOT (one level above generated/)
code = code.replace(
  /const previewPath = path\.join\(OUTPUT_DIR, "preview\.html"\);/,
  'const previewPath = path.join(PLUGIN_ROOT, "preview.html");'
);

// 2. Filter out generic "model.glb" / "model_*.glb" slugs from the sidebar list
code = code.replace(
  /const allGlbs\s*=\s*allFiles\.filter\(f => f\.endsWith\("\.glb"\)\)\.sort\(\);/,
  'const allGlbs  = allFiles.filter(f => f.endsWith(".glb") && f !== "model.glb").sort();'
);

const changed = code.includes('path.join(PLUGIN_ROOT, "preview.html")') &&
                code.includes('f !== "model.glb"');
if (!changed) {
  console.error("One or more replacements failed — check regex patterns.");
  process.exit(1);
}

fs.writeFileSync(TARGET, code, "utf8");
console.log("Done. Preview path → PLUGIN_ROOT, model.glb filtered out.");
