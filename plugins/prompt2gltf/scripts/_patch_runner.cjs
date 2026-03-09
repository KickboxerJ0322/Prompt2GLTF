"use strict";
const fs   = require("fs");
const path = require("path");

const TARGET = path.join(__dirname, "index.mjs");
let code = fs.readFileSync(TARGET, "utf8").replace(/\r\n/g, "\n");

// ── 1. Add "runner" style tag detection ─────────────────────────────────────
if (!code.includes('tags.push("runner")')) {
  code = code.replace(
    /if \(\/woman\|\\u5973\\u6027\/iu\.test\(prompt\)\) tags\.push\("woman"\);/,
    `if (/woman|\\u5973\\u6027/iu.test(prompt)) tags.push("woman");\n  if (/marathon|runner|jogging|sprint|\\u30de\\u30e9\\u30bd\\u30f3|\\u30e9\\u30f3\\u30ca\\u30fc|\\u8d70\\u308b/iu.test(prompt)) tags.push("runner");`
  );
  console.log("  Style tag added.");
} else {
  console.log("  Style tag already present.");
}

// ── 2. Add slug mappings for marathon / runner (before datacenter entry) ────
if (!code.includes('"marathon_runner"')) {
  // The datacenter entry in the slug map uses actual unicode chars (decoded)
  // Find it by the "datacenter" string in the slug map array context
  const slugTarget = `[/\\u30c7\\u30fc\\u30bf\\u30bb\\u30f3\\u30bf\\u30fc/u,             "datacenter"],`;
  if (code.includes(slugTarget)) {
    code = code.replace(slugTarget,
      `[/\\u30de\\u30e9\\u30bd\\u30f3/u,                              "marathon_runner"],\n    [/\\u30e9\\u30f3\\u30ca\\u30fc/u,                              "runner"],\n    ` + slugTarget
    );
    console.log("  Slug mappings added.");
  } else {
    // Try with actual Unicode chars
    const slugTarget2 = `[/データセンター/u,             "datacenter"],`;
    if (code.includes(slugTarget2)) {
      code = code.replace(slugTarget2,
        `[/マラソン/u,                              "marathon_runner"],\n    [/ランナー/u,                              "runner"],\n    ` + slugTarget2
      );
      console.log("  Slug mappings added (unicode).");
    } else {
      // Find by "datacenter" in subjectMap context using a broader pattern
      code = code.replace(
        /(\[\/\\u30c7[^"]+?"datacenter"\],)/,
        `[/\\u30de\\u30e9\\u30bd\\u30f3/u, "marathon_runner"],\n    [/\\u30e9\\u30f3\\u30ca\\u30fc/u, "runner"],\n    $1`
      );
      console.log("  Slug mappings added (fallback regex).");
    }
  }
} else {
  console.log("  Slug mappings already present.");
}

// ── 3. Add isRunner flag inside buildHumanSpec ───────────────────────────────
if (!code.includes("isRunner")) {
  code = code.replace(
    /const isWoman\s+=\s+styles\.includes\("woman"\);/,
    `const isWoman       = styles.includes("woman");\n  const isRunner      = styles.includes("runner") || /marathon|\\u30de\\u30e9\\u30bd\\u30f3|\\u30e9\\u30f3\\u30ca\\u30fc/iu.test(prompt);`
  );
  console.log("  isRunner flag added.");
} else {
  console.log("  isRunner flag already present.");
}

// ── 4. Inject running-pose block just before the LAST spec.parts=parts in buildHumanSpec
// Use a unique surrounding context: the surfaceDetails loop + "// Builder dispatch map"
const UNIQUE_MARKER = `  spec.parts = parts;\n  spec.surfaceDetails = surfaceDetails;\n  return spec;\n}\n\n// Builder dispatch map  - add new subject builders`;

if (!code.includes(UNIQUE_MARKER)) {
  console.error("ERROR: Unique marker not found! Cannot safely patch.");
  process.exit(1);
}

if (code.includes("// ── RUNNER POSE OVERRIDE")) {
  console.log("  Runner block already present.");
} else {
  const RUNNER_BLOCK = `
  // ── RUNNER POSE OVERRIDE ──────────────────────────────────────────────────
  if (isRunner) {
    spec.materials["running_top"]    = { baseColor: "#E8304A", roughness: 0.55, metalness: 0.02 };
    spec.materials["running_shorts"] = { baseColor: "#C02038", roughness: 0.55, metalness: 0.02 };
    spec.materials["running_shoe"]   = { baseColor: "#F5F5F5", roughness: 0.42, metalness: 0.04 };
    spec.materials["sole"]           = { baseColor: "#111111", roughness: 0.85, metalness: 0 };
    spec.materials["bib"]            = { baseColor: "#FFFFFF", roughness: 0.70, metalness: 0 };
    spec.materials["bib_number"]     = { baseColor: "#111111", roughness: 0.70, metalness: 0 };
    spec.materials["ponytail"]       = { baseColor: "#1A0A00", roughness: 0.88, metalness: 0 };
    spec.pose = { preset: "mid_stride_run", strideAngleDeg: 28, armSwingDeg: 40 };
    spec.style.bodyLanguage = "mid_stride_sprint_forward_lean";
    spec.promptInterpretation.humanType = "marathon_runner";

    const fwd  = H * 0.10;   // forward Z offset (direction of travel)
    const back = H * 0.07;   // backward Z offset
    const lean = H * 0.025;  // torso lean forward

    const ryFoot  = 0;
    const ryShin  = ryFoot  + prop.footH;
    const ryThigh = ryShin  + prop.shinH;
    const yHipR   = ryThigh + prop.thighH;
    const yTorsoR = yHipR   + prop.hipH;
    const yShoulder = yTorsoR + prop.torsoH * 0.88;
    const yNeckR  = yTorsoR + prop.torsoH;
    const yHeadR  = yNeckR  + prop.neckH;

    // Right leg – stride (forward, on ground)
    box("foot_R",  "running_shoe", prop.footW*1.05, prop.footH*0.55, prop.footD*1.10, +prop.footW*0.65, ryFoot+prop.footH*0.28, fwd+H*0.04);
    box("sole_R",  "sole",         prop.footW*1.10, prop.footH*0.18, prop.footD*1.12, +prop.footW*0.65, ryFoot+prop.footH*0.10, fwd+H*0.04);
    shape("shin_R","cylinder","running_shorts", prop.shinW, prop.shinH, prop.shinD,   +prop.thighW*0.52, ryShin+prop.shinH*0.5, fwd+H*0.02);
    shape("thigh_R","cylinder","running_shorts",prop.thighW,prop.thighH,prop.thighD, +prop.thighW*0.50, ryThigh+prop.thighH*0.5, fwd);
    shape("knee_R","sphere","skin",prop.shinW*0.90,prop.shinW*0.90,prop.shinD*0.90,  +prop.thighW*0.52, ryShin+prop.shinH*0.96, fwd+H*0.01);

    // Left leg – drive (back, lifted: bent knee with heel toward glute)
    shape("thigh_L","cylinder","running_shorts",prop.thighW,prop.thighH,prop.thighD, -prop.thighW*0.50, yHipR-prop.thighH*0.5, -back);
    shape("shin_L","cylinder","running_shorts", prop.shinW, prop.shinH*0.85, prop.shinD, -prop.thighW*0.52, yHipR-prop.shinH*0.55, -back+H*0.04);
    shape("knee_L","sphere","skin",prop.shinW*0.90,prop.shinW*0.90,prop.shinD*0.90,  -prop.thighW*0.52, yHipR-prop.shinH*0.1, -back+H*0.03);
    box("foot_L",  "running_shoe",prop.footW*1.05,prop.footH*0.55,prop.footD*1.10,   -prop.footW*0.65, yHipR+H*0.06, -back+H*0.07);
    box("sole_L",  "sole",        prop.footW*1.10,prop.footH*0.18,prop.footD*1.12,   -prop.footW*0.65, yHipR+H*0.04, -back+H*0.07);

    // Hips & torso (forward lean)
    box("hips",  "running_shorts", prop.hipW, prop.hipH, prop.hipD, 0, yHipR+prop.hipH*0.5, 0);
    box("torso", "running_top",    prop.torsoW, prop.torsoH*0.92, prop.torsoD, 0, yTorsoR+prop.torsoH*0.46, lean);
    if (isWoman) {
      shape("chest_L","sphere","running_top", prop.torsoW*0.16,prop.torsoH*0.14,prop.torsoD*0.20, -prop.torsoW*0.15, yTorsoR+prop.torsoH*0.66, prop.torsoD*0.38+lean);
      shape("chest_R","sphere","running_top", prop.torsoW*0.16,prop.torsoH*0.14,prop.torsoD*0.20,  prop.torsoW*0.15, yTorsoR+prop.torsoH*0.66, prop.torsoD*0.38+lean);
    }
    // Race bib
    box("bib",       "bib",       prop.torsoW*0.52,prop.torsoH*0.32,prop.torsoD*0.02, 0, yTorsoR+prop.torsoH*0.48, prop.torsoD*0.51+lean);
    box("bib_num_1", "bib_number",prop.torsoW*0.07,prop.torsoH*0.13,prop.torsoD*0.01, -prop.torsoW*0.09, yTorsoR+prop.torsoH*0.46, prop.torsoD*0.53+lean);
    box("bib_num_2", "bib_number",prop.torsoW*0.07,prop.torsoH*0.13,prop.torsoD*0.01,  prop.torsoW*0.09, yTorsoR+prop.torsoH*0.46, prop.torsoD*0.53+lean);

    // Left arm – swings forward (elbow bent ~90°, forearm up)
    const sxL = -(prop.torsoW*0.5+prop.upperAW*0.6);
    shape("upper_arm_L","cylinder","running_top", prop.upperAW,prop.upperAH,prop.upperAD, sxL, yShoulder-prop.upperAH*0.5, +H*0.04);
    shape("elbow_L",    "sphere",  "running_top", prop.upperAW*0.90,prop.upperAW*0.90,prop.upperAD*0.90, sxL, yShoulder-prop.upperAH, +H*0.05);
    shape("lower_arm_L","cylinder","skin",         prop.lowerAW,prop.lowerAH*0.88,prop.lowerAD, sxL, yShoulder-prop.upperAH-prop.lowerAH*0.44, +H*0.07);
    box("hand_L","skin", prop.handW,prop.handH,prop.handD, sxL, yShoulder-prop.upperAH-prop.lowerAH*0.88-prop.handH*0.5, +H*0.08);

    // Right arm – swings back (elbow bent, forearm down-back)
    const sxR = +(prop.torsoW*0.5+prop.upperAW*0.6);
    shape("upper_arm_R","cylinder","running_top", prop.upperAW,prop.upperAH,prop.upperAD, sxR, yShoulder-prop.upperAH*0.5, -H*0.03);
    shape("elbow_R",    "sphere",  "running_top", prop.upperAW*0.90,prop.upperAW*0.90,prop.upperAD*0.90, sxR, yShoulder-prop.upperAH, -H*0.04);
    shape("lower_arm_R","cylinder","skin",         prop.lowerAW,prop.lowerAH*0.88,prop.lowerAD, sxR, yShoulder-prop.upperAH-prop.lowerAH*0.44, -H*0.06);
    box("hand_R","skin", prop.handW,prop.handH,prop.handD, sxR, yShoulder-prop.upperAH-prop.lowerAH*0.88-prop.handH*0.5, -H*0.07);

    // Neck, head (slightly forward)
    shape("neck","cylinder","skin", prop.neckR*2,prop.neckH,prop.neckR*2, 0, yNeckR+prop.neckH*0.5, lean*0.5);
    shape("head","sphere","skin",   prop.headW,prop.headH,prop.headD, 0, yHeadR+prop.headH*0.5, lean);
    shape("hair_top","sphere","hair",prop.headW*0.95,prop.headH*0.58,prop.headD*0.95, 0, yHeadR+prop.headH*0.72, lean);
    shape("ear_L","sphere","skin",prop.headW*0.10,prop.headH*0.13,prop.headD*0.08, -prop.headW*0.52, yHeadR+prop.headH*0.44, lean);
    shape("ear_R","sphere","skin",prop.headW*0.10,prop.headH*0.13,prop.headD*0.08,  prop.headW*0.52, yHeadR+prop.headH*0.44, lean);
    shape("eye_L","sphere","skin",prop.headW*0.10,prop.headH*0.09,prop.headD*0.06, -prop.headW*0.22, yHeadR+prop.headH*0.50, prop.headD*0.48+lean);
    shape("eye_R","sphere","skin",prop.headW*0.10,prop.headH*0.09,prop.headD*0.06,  prop.headW*0.22, yHeadR+prop.headH*0.50, prop.headD*0.48+lean);
    shape("nose","sphere","skin",prop.headW*0.10,prop.headH*0.10,prop.headD*0.12, 0, yHeadR+prop.headH*0.36, prop.headD*0.50+lean);
    // Ponytail streaming back
    box("ponytail_base","ponytail",prop.headW*0.20,prop.headH*0.18,prop.headD*0.22, 0, yHeadR+prop.headH*0.55, -prop.headD*0.52+lean);
    box("ponytail_mid", "ponytail",prop.headW*0.14,prop.headH*0.12,prop.headD*0.30, 0, yHeadR+prop.headH*0.44, -prop.headD*0.80+lean);
    box("ponytail_tip", "ponytail",prop.headW*0.08,prop.headH*0.09,prop.headD*0.20, 0, yHeadR+prop.headH*0.36, -prop.headD*1.06+lean);
    box("headband","running_top",prop.headW*1.02,prop.headH*0.10,prop.headD*0.90, 0, yHeadR+prop.headH*0.65, lean*0.5);

    // Surface details
    const runRegions = ["head","torso","arms","legs","shoes"];
    const runDetailTypes = ["fabric_weave","seam_stitch","crease","skin_pore","button_detail"];
    let sdIdx = 1;
    for (const region of runRegions) {
      for (let i = 0; i < 8; i++) {
        surfaceDetails.push({ id: \`surface_detail_\${sdIdx++}\`, region, type: runDetailTypes[i%runDetailTypes.length],
          strength: rounded(0.10+(i%5)*0.06),
          offset: [Math.sin(i*0.9)*0.012, Math.cos(i*0.7)*0.010, ((i%4)-1.5)*0.008].map(rounded) });
      }
    }
    spec.parts = parts;
    spec.surfaceDetails = surfaceDetails;
    return spec;
  }
  // ── END RUNNER POSE OVERRIDE ──────────────────────────────────────────────
`;

  code = code.replace(UNIQUE_MARKER, RUNNER_BLOCK + "\n" + UNIQUE_MARKER);
  console.log("  Runner block inserted.");
}

fs.writeFileSync(TARGET, code, "utf8");
console.log("Done. File length:", code.length);
