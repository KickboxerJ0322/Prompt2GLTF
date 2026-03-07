import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  Document,
  NodeIO,
  Accessor
} from "@gltf-transform/core";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, "../../..");
const OUTPUT_DIR = path.join(PROJECT_ROOT, "generated", "prompt2gltf");

function getArg(name) {
  const idx = process.argv.indexOf(name);
  if (idx === -1) return null;
  return process.argv[idx + 1] ?? null;
}

function slugify(input) {
  return String(input)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48) || "model";
}

// 笏笏 MATERIAL PALETTE 笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏
// Shared PBR material definitions. Reference these when authoring new
// buildXxxSpec builders so colors stay consistent across subject types.
const MATERIAL_PALETTE = {
  // Stone / masonry
  stone_light:    { baseColor: "#C8C4BC", roughness: 0.96, metalness: 0.01 },
  stone_main:     { baseColor: "#8B8E93", roughness: 0.95, metalness: 0.02 },
  stone_dark:     { baseColor: "#5F6368", roughness: 0.98, metalness: 0.01 },
  granite:        { baseColor: "#6A6460", roughness: 0.92, metalness: 0.03 },
  sandstone:      { baseColor: "#C8A870", roughness: 0.94, metalness: 0.01 },
  limestone:      { baseColor: "#D4CCB0", roughness: 0.93, metalness: 0.01 },
  marble_white:   { baseColor: "#E8E4DC", roughness: 0.30, metalness: 0.04 },
  marble_grey:    { baseColor: "#A8A4A0", roughness: 0.35, metalness: 0.05 },
  // Brick
  brick_red:      { baseColor: "#8B3A2A", roughness: 0.95, metalness: 0.01 },
  brick_brown:    { baseColor: "#6B3018", roughness: 0.96, metalness: 0.01 },
  brick_dark:     { baseColor: "#4A2010", roughness: 0.97, metalness: 0.01 },
  mortar:         { baseColor: "#C0BCAC", roughness: 0.98, metalness: 0.00 },
  // Concrete
  concrete_main:  { baseColor: "#B8BAB2", roughness: 0.90, metalness: 0.04 },
  concrete_dark:  { baseColor: "#8A8C84", roughness: 0.92, metalness: 0.03 },
  // Metal
  steel_main:     { baseColor: "#7A8087", roughness: 0.40, metalness: 0.85 },
  steel_dark:     { baseColor: "#3C4045", roughness: 0.38, metalness: 0.90 },
  steel_light:    { baseColor: "#B0B8C0", roughness: 0.42, metalness: 0.88 },
  iron_dark:      { baseColor: "#2E2E30", roughness: 0.60, metalness: 0.75 },
  iron_rust:      { baseColor: "#6A3828", roughness: 0.88, metalness: 0.40 },
  copper_new:     { baseColor: "#B87840", roughness: 0.45, metalness: 0.72 },
  copper_aged:    { baseColor: "#4A8060", roughness: 0.60, metalness: 0.55 },
  bronze:         { baseColor: "#8A6830", roughness: 0.50, metalness: 0.68 },
  brass:          { baseColor: "#C8941E", roughness: 0.38, metalness: 0.82 },
  gold:           { baseColor: "#D4A820", roughness: 0.28, metalness: 0.90 },
  chrome:         { baseColor: "#D0D8DC", roughness: 0.22, metalness: 0.96 },
  // Wood
  wood_light:     { baseColor: "#B89060", roughness: 0.80, metalness: 0.02 },
  wood_main:      { baseColor: "#6B3E22", roughness: 0.88, metalness: 0.03 },
  wood_dark:      { baseColor: "#3D2410", roughness: 0.92, metalness: 0.02 },
  wood_deck:      { baseColor: "#7D4E28", roughness: 0.85, metalness: 0.04 },
  bamboo:         { baseColor: "#A8B060", roughness: 0.78, metalness: 0.01 },
  // Roof finishes
  roof_tile_jp:   { baseColor: "#3A3840", roughness: 0.80, metalness: 0.10 },
  roof_tile_eu:   { baseColor: "#7A4A30", roughness: 0.85, metalness: 0.05 },
  roof_slate:     { baseColor: "#484A50", roughness: 0.88, metalness: 0.08 },
  roof_thatch:    { baseColor: "#9A8850", roughness: 0.97, metalness: 0.00 },
  roof_copper:    { baseColor: "#4A8060", roughness: 0.55, metalness: 0.60 },
  // Glass
  glass_clear:    { baseColor: "#7BAED6", roughness: 0.12, metalness: 0.88 },
  glass_dark:     { baseColor: "#3A5870", roughness: 0.18, metalness: 0.85 },
  glass_amber:    { baseColor: "#C87830", roughness: 0.15, metalness: 0.82 },
  // Fabric / textile
  canvas_main:    { baseColor: "#C8AA78", roughness: 0.82, metalness: 0.02 },
  canvas_accent:  { baseColor: "#8B3A1E", roughness: 0.80, metalness: 0.03 },
  canvas_dark:    { baseColor: "#5A3E28", roughness: 0.90, metalness: 0.01 },
  canvas_sail:    { baseColor: "#DCC890", roughness: 0.78, metalness: 0.02 },
  fabric_red:     { baseColor: "#8B1E2D", roughness: 0.80, metalness: 0.02 },
  fabric_blue:    { baseColor: "#2A4878", roughness: 0.80, metalness: 0.02 },
  fabric_gold:    { baseColor: "#C8940E", roughness: 0.72, metalness: 0.12 },
  rope:           { baseColor: "#8A7248", roughness: 0.95, metalness: 0.01 },
  // Emissive
  emissive_red:   { baseColor: "#FF4400", roughness: 0.10, metalness: 0.00, emissive: "#FF4400" },
  emissive_blue:  { baseColor: "#66CCFF", roughness: 0.15, metalness: 0.00, emissive: "#66CCFF" },
  emissive_gold:  { baseColor: "#FFB800", roughness: 0.12, metalness: 0.00, emissive: "#FFB800" },
  emissive_white: { baseColor: "#FFFFFF", roughness: 0.05, metalness: 0.00, emissive: "#FFFFFF" },
  // Organic (creature)
  hide_green:     { baseColor: "#3D4A2C", roughness: 0.92, metalness: 0.04 },
  hide_dark:      { baseColor: "#2A3020", roughness: 0.92, metalness: 0.04 },
  hide_belly:     { baseColor: "#6B5C3A", roughness: 0.88, metalness: 0.02 },
  bone:           { baseColor: "#D8CFA0", roughness: 0.60, metalness: 0.05 },
  claw_dark:      { baseColor: "#1A1410", roughness: 0.55, metalness: 0.32 },
};

// 笏笏 SUBJECT REGISTRY 笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏
// Central dispatch table. To add a new subject type:
//   1. Add a row here (id, match, altMatch?, defaultHeight, defaultStyle)
//   2. Write buildXxxSpec(prompt, height, styles) 竊・spec
//   3. Add an entry to the builders map in buildSpec()
// Order of rows matters: first match wins.
const SUBJECT_REGISTRY = [
  {
    id: "kaiju",
    match: /kaiju|monster|creature|\u602a\u7363/iu,
    defaultHeight: () => 80,
    defaultStyle: "prehistoric_beast",
  },
  {
    id: "tower",
    match: /tower|skytree|\u30bf\u30ef\u30fc|\u30b9\u30ab\u30a4\u30c4\u30ea\u30fc/iu,
    defaultHeight: (p) => /skytree|\u30b9\u30ab\u30a4\u30c4\u30ea\u30fc/iu.test(p) ? 634 : 300,
    defaultStyle: "modern_lattice",
  },
  {
    id: "airship",
    match: /airship|\u98db\u884c\u8239/iu,
    defaultHeight: () => 80,
    defaultStyle: "fantasy_steampunk",
  },
  {
    id: "vehicle",
    match: /train|rail|railway|metro|subway|tram|car|bus|truck|van|taxi|motorcycle|bike|bicycle|ship|boat|ferry|yacht|submarine|airplane|plane|aircraft|jet|helicopter|patrol|police.?car|\u96fb\u8eca|\u5217\u8eca|\u65b0\u5e79\u7dda|\u5c71\u624b\u7dda|\u5730\u4e0b\u9244|\u30e1\u30c8\u30ed|\u81ea\u52d5\u8eca|\u8efd\u81ea\u52d5\u8eca|\u30d0\u30b9|\u30c8\u30e9\u30c3\u30af|\u30bf\u30af\u30b7\u30fc|\u30b9\u30dd\u30fc\u30c4\u30ab\u30fc|\u8239|\u98db\u884c\u6a5f|\u30d8\u30ea\u30b3\u30d7\u30bf\u30fc|\u6f5c\u6c34\u8266|\u30d1\u30c8\u30ab\u30fc|\u30d1\u30c8\u30ed\u30fc\u30eb\u30ab\u30fc|\u8b66\u5bdf\u8eca|shuttle|spacecraft|orbiter|\u30b7\u30e3\u30c8\u30eb|\u30b9\u30da\u30fc\u30b9\u30b7\u30e3\u30c8\u30eb/iu,
    defaultHeight: () => 32,
    defaultStyle: "functional_transport",
  },
  {
    id: "giant",
    match: /giant|colossus|titan|\u5de8\u4eba|moai|\u30e2\u30a2\u30a4|rapa.?nui/iu,
    defaultHeight: () => 100,
    defaultStyle: "mythic_colossus",
  },
  {
    id: "robot",
    match: /robot|mecha|\u30ed\u30dc\u30c3\u30c8|\u30e1\u30ab/iu,
    defaultHeight: () => 35,
    defaultStyle: "heroic_mecha",
  },
  {
    id: "castle",
    match: /castle|fortress|\u57ce|\u8981\u585e/iu,
    defaultHeight: () => 60,
    defaultStyle: "fortified_stone",
  },
  {
    id: "building",
    match: /building|architecture|skyscraper|house|apartment|office|station|airport|terminal|museum|factory|warehouse|stadium|temple|shrine|church|\u5efa\u7bc9|\u5efa\u7269|\u30d3\u30eb|\u9ad8\u5c64|\u5bb6|\u4f4f\u5b85|\u99c5|\u7a7a\u6e2f|\u7f8e\u8853\u9928|\u5de5\u5834|\u30b9\u30bf\u30b8\u30a2\u30e0|\u5bfa|\u795e\u793e|\u6559\u4f1a/iu,
    defaultHeight: () => 90,
    defaultStyle: "civic_architecture",
  },
  {
    id: "structure",
    match: /tree|traffic.?signal|signal|pedestrian.?bridge|footbridge|bridge|data.?center|theme.?park|power.?plant|rocket.?base|\u6728|\u6a39|\u4fe1\u53f7|\u6b69\u9053\u6a4b|\u6a4b|\u30c7\u30fc\u30bf\u30bb\u30f3\u30bf\u30fc|\u30c6\u30fc\u30de\u30d1\u30fc\u30af|\u767a\u96fb\u6240|\u30ed\u30b1\u30c3\u30c8\u57fa\u5730/iu,
    defaultHeight: () => 48,
    defaultStyle: "infrastructure",
  },
  {
    id: "warrior",
    match: /warrior|knight|fighter|\u6226\u58eb|\u9a0e\u58eb/iu,
    defaultHeight: () => 2,
    defaultStyle: "western_warrior",
  },
];

function inferSubject(prompt) {
  for (const entry of SUBJECT_REGISTRY) {
    if (entry.match.test(prompt) || entry.altMatch?.test(prompt)) return entry.id;
  }
  return "building";
}

function inferHeightMeters(prompt, subject) {
  const floorM = prompt.match(/(\d+)\s*(?:floors?|stories?|fl(?:oor)?|[\u968e\u5efa])/iu);
  if (floorM) return Math.round(Number(floorM[1]) * 3.5);

  const meterM =
    prompt.match(/(\d+)\s*m(?!\w)/iu) ||
    prompt.match(/(\d+)\s*meters?/iu) ||
    prompt.match(/(\d+)\s*\u30e1\u30fc\u30c8\u30eb/u) ||
    prompt.match(/(\d+)\s*\u7c73/u);
  if (meterM) return Number(meterM[1]);

  const entry = SUBJECT_REGISTRY.find((r) => r.id === subject);
  return entry ? entry.defaultHeight(prompt) : 60;
}

function inferStyle(prompt, subject) {
  const tags = [];
  if (/fantasy|\u30d5\u30a1\u30f3\u30bf\u30b8\u30fc/iu.test(prompt)) tags.push("western_fantasy");
  if (/dark|\u30c0\u30fc\u30af/iu.test(prompt)) tags.push("dark");
  if (/sf|sci[- ]?fi|\u8fd1\u672a\u6765|\u79d1\u5b66/iu.test(prompt)) tags.push("sci_fi");
  if (/armor|armored|\u88c5\u7532/iu.test(prompt)) tags.push("armored");
  if (/stone|\u77f3/iu.test(prompt)) tags.push("stone");
  if (/emissive|glow|neon|\u767a\u5149/iu.test(prompt)) tags.push("emissive");
  if (/regal|royal|\u738b\u65cf/iu.test(prompt)) tags.push("regal");
  if (/ancient|\u53e4\u4ee3/iu.test(prompt)) tags.push("ancient");

  if (/japanese|traditional|shrine|temple|\u548c\u98a8|\u795e\u793e|\u5bfa|\u4f1d\u7d71/iu.test(prompt)) tags.push("japanese_traditional");
  if (/gothic/iu.test(prompt)) tags.push("gothic");
  if (/brick|\u30ec\u30f3\u30ac/iu.test(prompt)) tags.push("brick");
  if (/modern|modernist|\u30e2\u30c0\u30f3/iu.test(prompt)) tags.push("modernist");
  if (/art.?deco/iu.test(prompt)) tags.push("art_deco");
  if (/ruined|abandoned|\u5ec3\u589f/iu.test(prompt)) tags.push("ruined");
  if (/medieval|\u4e2d\u4e16/iu.test(prompt)) tags.push("medieval");
  if (/chinese|\u4e2d\u56fd/iu.test(prompt)) tags.push("east_asian");
  if (/mosque|islamic/iu.test(prompt)) tags.push("islamic");
  if (/timber|wooden|\u6728\u9020/iu.test(prompt)) tags.push("timber_frame");
  if (/palace|\u5bae\u6bbf/iu.test(prompt)) tags.push("palatial");
  if (/lighthouse|\u706f\u53f0/iu.test(prompt)) tags.push("maritime");
  if (/crystal|\u30af\u30ea\u30b9\u30bf\u30eb/iu.test(prompt)) tags.push("crystalline");
  if (/demon|evil|maou|\u9b54\u738b/iu.test(prompt)) tags.push("demonic");
  if (/cinderella|fairy.?tale|\u30b7\u30f3\u30c7\u30ec\u30e9|\u7ae5\u8a71/iu.test(prompt)) tags.push("fairy_tale");
  if (/residential|house|\u4f4f\u5b85|\u6238\u5efa/iu.test(prompt)) tags.push("residential");
  if (/apartment|\u30a2\u30d1\u30fc\u30c8/iu.test(prompt)) tags.push("apartment");
  if (/mansion|\u30de\u30f3\u30b7\u30e7\u30f3|\u90b8\u5b85|\u5927\u90b8\u5b85/iu.test(prompt)) tags.push("mansion");
  if (/data.?center|\u30c7\u30fc\u30bf\u30bb\u30f3\u30bf\u30fc/iu.test(prompt)) tags.push("datacenter");
  if (/power.?plant|\u767a\u96fb\u6240/iu.test(prompt)) tags.push("industrial");
  if (/bridge|signal|theme.?park|rocket.?base|\u6a4b|\u4fe1\u53f7|\u30c6\u30fc\u30de\u30d1\u30fc\u30af|\u30ed\u30b1\u30c3\u30c8\u57fa\u5730/iu.test(prompt)) tags.push("infrastructure");

  if (/train|rail|metro|subway|tram|\u96fb\u8eca|\u5217\u8eca|\u5c71\u624b\u7dda|\u65b0\u5e79\u7dda|\u5730\u4e0b\u9244/iu.test(prompt)) tags.push("rail_transport");
  if (/ship|boat|ferry|yacht|submarine|\u8239|\u6f5c\u6c34\u8266/iu.test(prompt)) tags.push("marine_transport");
  if (/airplane|plane|aircraft|jet|helicopter|\u98db\u884c\u6a5f|\u30d8\u30ea\u30b3\u30d7\u30bf\u30fc/iu.test(prompt)) tags.push("aerial_transport");
  if (/car|bus|truck|van|taxi|motorcycle|bike|bicycle|\u81ea\u52d5\u8eca|\u30d0\u30b9/iu.test(prompt)) tags.push("road_transport");

  if (tags.length === 0) {
    const entry = SUBJECT_REGISTRY.find((r) => r.id === subject);
    if (entry) tags.push(entry.defaultStyle);
  }
  return tags;
}
function createBaseMaterials(subject, styles) {
  if (subject === "airship") {
    const dark = styles.includes("dark");
    return {
      wood_main:     { baseColor: dark ? "#4A2E18" : "#6B3E22", roughness: 0.88, metalness: 0.03 },
      wood_dark:     { baseColor: dark ? "#2A1A0E" : "#3D2410", roughness: 0.92, metalness: 0.02 },
      wood_deck:     { baseColor: dark ? "#5A3A1E" : "#7D4E28", roughness: 0.85, metalness: 0.04 },
      canvas_main:   { baseColor: dark ? "#7A6A50" : "#C8AA78", roughness: 0.82, metalness: 0.02 },
      canvas_accent: { baseColor: dark ? "#5A3020" : "#8B3A1E", roughness: 0.80, metalness: 0.03 },
      canvas_dark:   { baseColor: dark ? "#3A2818" : "#5A3E28", roughness: 0.90, metalness: 0.01 },
      canvas_sail:   { baseColor: dark ? "#8A7858" : "#DCC890", roughness: 0.78, metalness: 0.02 },
      brass:         { baseColor: "#C8941E", roughness: 0.38, metalness: 0.82 },
      gilded:        { baseColor: "#D4A820", roughness: 0.28, metalness: 0.90 },
      rope:          { baseColor: "#8A7248", roughness: 0.95, metalness: 0.01 },
      cannon_iron:   { baseColor: "#2E2E30", roughness: 0.60, metalness: 0.75 },
      glass_port:    { baseColor: "#8ABCD4", roughness: 0.15, metalness: 0.80 }
    };
  }

  if (subject === "tower") {
    return {
      concrete_main: { baseColor: "#B8BAB2", roughness: 0.90, metalness: 0.04 },
      steel_main:    { baseColor: "#7A8087", roughness: 0.40, metalness: 0.85 },
      steel_dark:    { baseColor: "#3C4045", roughness: 0.38, metalness: 0.90 },
      glass:         { baseColor: "#7BAED6", roughness: 0.12, metalness: 0.88 },
      spire_tip:     { baseColor: "#D0D8DC", roughness: 0.22, metalness: 0.96 }
    };
  }

  if (subject === "kaiju") {
    const dark = styles.includes("dark");
    return {
      hide_main:    { baseColor: dark ? "#2A3020" : "#3D4A2C", roughness: 0.92, metalness: 0.04 },
      hide_belly:   { baseColor: dark ? "#4A3F28" : "#6B5C3A", roughness: 0.88, metalness: 0.02 },
      scale_dark:   { baseColor: dark ? "#1A1F14" : "#252E18", roughness: 0.85, metalness: 0.06 },
      scale_accent: { baseColor: dark ? "#4A5C30" : "#5E7040", roughness: 0.78, metalness: 0.08 },
      dorsal_spine: { baseColor: dark ? "#1C1A10" : "#2E2A18", roughness: 0.72, metalness: 0.18 },
      claw:         { baseColor: "#1A1410", roughness: 0.55, metalness: 0.32 },
      teeth:        { baseColor: "#D8CFA0", roughness: 0.60, metalness: 0.05 },
      eye_glow:     { baseColor: "#FF4400", roughness: 0.10, metalness: 0.00, emissive: "#FF4400" }
    };
  }

  if (subject === "robot") {
    return {
      body_primary:  { baseColor: "#C9CDD3", roughness: 0.45, metalness: 0.92 },
      body_secondary:{ baseColor: "#2F3A4A", roughness: 0.62, metalness: 0.84 },
      accent:        { baseColor: "#D64949", roughness: 0.35, metalness: 0.90 },
      emissive_core: { baseColor: "#66CCFF", roughness: 0.15, metalness: 0.00, emissive: "#66CCFF" }
    };
  }

  if (subject === "castle") {
    return {
      stone_main:    { baseColor: "#8B8E93", roughness: 0.95, metalness: 0.02 },
      stone_dark:    { baseColor: "#5F6368", roughness: 0.98, metalness: 0.01 },
      roof_metal:    { baseColor: "#4B3F39", roughness: 0.70, metalness: 0.30 },
      accent_banner: { baseColor: "#8B1E2D", roughness: 0.72, metalness: 0.05 }
    };
  }

  if (subject === "building") {
    const modern = styles.includes("modernist") || styles.includes("sci_fi");
    const traditional = styles.includes("japanese_traditional") || styles.includes("timber_frame") || styles.includes("east_asian");
    return {
      facade_main:      { baseColor: modern ? "#B8BAB2" : traditional ? "#D4CCB0" : "#8B8E93", roughness: modern ? 0.88 : 0.93, metalness: modern ? 0.08 : 0.03 },
      facade_secondary: { baseColor: modern ? "#7A8087" : traditional ? "#6B3E22" : "#5F6368", roughness: 0.90, metalness: modern ? 0.24 : 0.04 },
      roof:             { baseColor: traditional ? "#3A3840" : "#4B3F39", roughness: traditional ? 0.80 : 0.68, metalness: traditional ? 0.12 : 0.28 },
      glass:            { baseColor: modern ? "#7BAED6" : "#3A5870", roughness: modern ? 0.10 : 0.18, metalness: 0.86 },
      frame:            { baseColor: modern ? "#3C4045" : "#6A6460", roughness: 0.55, metalness: modern ? 0.80 : 0.18 },
      accent:           { baseColor: "#8B1E2D", roughness: 0.74, metalness: 0.06 }
    };
  }

  if (subject === "vehicle") {
    const isPatrol = /patrol|police.?car|\u30d1\u30c8\u30ab\u30fc|\u30d1\u30c8\u30ed\u30fc\u30eb\u30ab\u30fc|\u8b66\u5bdf\u8eca/iu.test(styles.join(" ") + " " + (styles._prompt || ""));
    if (isPatrol) {
      return {
        body_main:      { baseColor: "#F0EEE8", roughness: 0.38, metalness: 0.18 },
        body_black:     { baseColor: "#1C1C1E", roughness: 0.42, metalness: 0.20 },
        body_secondary: { baseColor: "#D8D6D0", roughness: 0.44, metalness: 0.16 },
        glass:          { baseColor: "#3A5870", roughness: 0.12, metalness: 0.86 },
        trim:           { baseColor: "#8A8C90", roughness: 0.30, metalness: 0.88 },
        tire:           { baseColor: "#15171A", roughness: 0.92, metalness: 0.04 },
        light_emissive: { baseColor: "#FFE8C0", roughness: 0.08, metalness: 0.00, emissive: "#FFE8C0" },
        siren_red:      { baseColor: "#FF2020", roughness: 0.08, metalness: 0.10, emissive: "#FF2020" },
        siren_blue:     { baseColor: "#2060FF", roughness: 0.08, metalness: 0.10, emissive: "#2060FF" }
      };
    }
    const isShuttle = /shuttle|spacecraft|orbiter|\u30b7\u30e3\u30c8\u30eb|\u30b9\u30da\u30fc\u30b9\u30b7\u30e3\u30c8\u30eb/iu.test(styles._prompt || "");
    if (isShuttle) {
      return {
        orbiter_white:  { baseColor: "#F0EEE8", roughness: 0.40, metalness: 0.12 },
        tiles_black:    { baseColor: "#1A1A1C", roughness: 0.88, metalness: 0.04 },
        wing_rcc:       { baseColor: "#2E2A28", roughness: 0.78, metalness: 0.10 },
        glass_cockpit:  { baseColor: "#1A2B3C", roughness: 0.08, metalness: 0.92 },
        engine_bell:    { baseColor: "#1E2024", roughness: 0.30, metalness: 0.92 },
        payload_door:   { baseColor: "#ECEAE2", roughness: 0.36, metalness: 0.22 },
        rcs_metal:      { baseColor: "#8A8E92", roughness: 0.28, metalness: 0.90 },
        gear_metal:     { baseColor: "#7A7E84", roughness: 0.32, metalness: 0.88 },
        heat_shield:    { baseColor: "#3C3030", roughness: 0.82, metalness: 0.06 },
        engine_glow:    { baseColor: "#FF8C20", roughness: 0.06, metalness: 0.00, emissive: "#FF8C20" }
      };
    }
    const isHelicopter = /helicopter|\u30d8\u30ea\u30b3\u30d7\u30bf\u30fc|\u30d8\u30ea/iu.test(styles._prompt || "");
    if (isHelicopter) {
      return {
        body_main:      { baseColor: "#7A8A96", roughness: 0.52, metalness: 0.50 },
        body_secondary: { baseColor: "#4A5560", roughness: 0.60, metalness: 0.45 },
        glass_cockpit:  { baseColor: "#2A4060", roughness: 0.08, metalness: 0.90 },
        rotor_blade:    { baseColor: "#1A1C20", roughness: 0.44, metalness: 0.55 },
        rotor_mast:     { baseColor: "#4A4E54", roughness: 0.32, metalness: 0.88 },
        skid:           { baseColor: "#3A3E44", roughness: 0.42, metalness: 0.82 },
        trim:           { baseColor: "#C0C4C8", roughness: 0.24, metalness: 0.88 },
        nav_red:        { baseColor: "#FF2020", roughness: 0.08, metalness: 0.00, emissive: "#FF2020" },
        nav_green:      { baseColor: "#20FF40", roughness: 0.08, metalness: 0.00, emissive: "#20FF40" },
        searchlight:    { baseColor: "#FFFCE0", roughness: 0.06, metalness: 0.00, emissive: "#FFFCE0" }
      };
    }
    const isShinkansen = /shinkansen|\u65b0\u5e79\u7dda|\u306e\u305e\u307f|\u306f\u3084\u3076\u3055|\u3072\u304b\u308a|\u3053\u3060\u307e|N700|bullet.?train/iu.test(styles._prompt || "");
    if (isShinkansen) {
      return {
        body_white:    { baseColor: "#F5F4F0", roughness: 0.38, metalness: 0.20 },
        stripe_blue:   { baseColor: "#0050A0", roughness: 0.46, metalness: 0.28 },
        glass:         { baseColor: "#1A2B3C", roughness: 0.10, metalness: 0.88 },
        steel_frame:   { baseColor: "#52585F", roughness: 0.36, metalness: 0.86 },
        bogie_dark:    { baseColor: "#1E2124", roughness: 0.68, metalness: 0.58 },
        roof_equip:    { baseColor: "#3C4248", roughness: 0.52, metalness: 0.68 },
        pantograph:    { baseColor: "#2A2E34", roughness: 0.46, metalness: 0.84 },
        trim_silver:   { baseColor: "#C8CCD0", roughness: 0.22, metalness: 0.90 },
        headlight:     { baseColor: "#FFFBE0", roughness: 0.08, metalness: 0.00, emissive: "#FFFBE0" },
        tail_light:    { baseColor: "#FF2020", roughness: 0.08, metalness: 0.00, emissive: "#FF2020" }
      };
    }
    return {
      body_main:      { baseColor: "#B7C0C8", roughness: 0.42, metalness: 0.82 },
      body_secondary: { baseColor: "#2F3A44", roughness: 0.56, metalness: 0.76 },
      body_black:     { baseColor: "#1B1D20", roughness: 0.58, metalness: 0.40 },
      taxi_accent:    { baseColor: "#F2C318", roughness: 0.36, metalness: 0.70 },
      sport_accent:   { baseColor: "#CC2D2D", roughness: 0.30, metalness: 0.82 },
      glass:          { baseColor: "#3A5870", roughness: 0.12, metalness: 0.86 },
      trim:           { baseColor: "#D0D8DC", roughness: 0.20, metalness: 0.92 },
      tire:           { baseColor: "#15171A", roughness: 0.92, metalness: 0.04 },
      light_emissive: { baseColor: "#FFE8C0", roughness: 0.08, metalness: 0.00, emissive: "#FFE8C0" }
    };
  }

  if (subject === "structure") {
    return {
      trunk:          { baseColor: "#6B3E22", roughness: 0.90, metalness: 0.02 },
      foliage:        { baseColor: "#3E6E3A", roughness: 0.92, metalness: 0.01 },
      steel:          { baseColor: "#6A727A", roughness: 0.44, metalness: 0.84 },
      concrete:       { baseColor: "#A8ACA6", roughness: 0.92, metalness: 0.04 },
      asphalt:        { baseColor: "#2C2E33", roughness: 0.95, metalness: 0.02 },
      signal_red:     { baseColor: "#FF3B2F", roughness: 0.10, metalness: 0.00, emissive: "#FF3B2F" },
      signal_yellow:  { baseColor: "#FFC20A", roughness: 0.10, metalness: 0.00, emissive: "#FFC20A" },
      signal_green:   { baseColor: "#1CCD5E", roughness: 0.10, metalness: 0.00, emissive: "#1CCD5E" },
      accent:         { baseColor: "#6A60A8", roughness: 0.40, metalness: 0.50 },
      glass:          { baseColor: "#6EA0C6", roughness: 0.15, metalness: 0.84 }
    };
  }

  if (subject === "warrior") {
    const dark = styles.includes("dark");
    const regal = styles.includes("regal");
    return {
      plate_main:   { baseColor: dark ? "#4A5058" : "#C8CCD4", roughness: dark ? 0.55 : 0.35, metalness: dark ? 0.80 : 0.92 },
      plate_dark:   { baseColor: dark ? "#282C32" : "#7A8090", roughness: 0.42, metalness: 0.88 },
      gold_trim:    { baseColor: regal ? "#D4A820" : "#B87A20", roughness: 0.25, metalness: 0.92 },
      bronze_trim:  { baseColor: "#8A6830", roughness: 0.38, metalness: 0.80 },
      chainmail:    { baseColor: dark ? "#383C42" : "#686C72", roughness: 0.72, metalness: 0.65 },
      leather:      { baseColor: dark ? "#2A1A0E" : "#5A3018", roughness: 0.88, metalness: 0.02 },
      cloth:        { baseColor: dark ? "#1E2028" : "#F0EAD8", roughness: 0.92, metalness: 0.01 },
      cloth_accent: { baseColor: dark ? "#4A1010" : "#8B1E2D", roughness: 0.85, metalness: 0.02 },
      cloth_dark:   { baseColor: dark ? "#1A1018" : "#3A0E18", roughness: 0.90, metalness: 0.01 },
      sword_blade:  { baseColor: "#D0D8E0", roughness: 0.18, metalness: 0.96 }
    };
  }

  if (subject === "giant") {
    const isMoai = /moai|\u30e2\u30a2\u30a4|rapa.?nui/iu.test(styles._prompt || "");
    if (isMoai) {
      return {
        stone_main:  { baseColor: "#6A6460", roughness: 0.94, metalness: 0.02 },
        stone_dark:  { baseColor: "#3E3A38", roughness: 0.96, metalness: 0.01 },
        stone_face:  { baseColor: "#7A7470", roughness: 0.90, metalness: 0.03 },
        pukao:       { baseColor: "#7A3028", roughness: 0.88, metalness: 0.04 },
        ahu_stone:   { baseColor: "#4E4A48", roughness: 0.97, metalness: 0.01 },
        lichen:      { baseColor: "#5A6840", roughness: 0.95, metalness: 0.01 }
      };
    }
  }

  const dark = styles.includes("dark");
  return {
    body_main:       { baseColor: dark ? "#5E5E60" : "#8F877A", roughness: 0.88, metalness: 0.06 },
    armor_main:      { baseColor: dark ? "#313338" : "#6B6F77", roughness: 0.58, metalness: 0.82 },
    armor_secondary: { baseColor: dark ? "#4C4F56" : "#7E828A", roughness: 0.62, metalness: 0.76 },
    accent:          { baseColor: "#A86A2A", roughness: 0.42, metalness: 0.65 },
    dark_accent:     { baseColor: "#552E18", roughness: 0.50, metalness: 0.38 },
    emissive_eye:    { baseColor: "#FF6633", roughness: 0.20, metalness: 0.00, emissive: "#FF6633" }
  };
}
function rounded(n) {
  return Number(n.toFixed(4));
}

function buildHighDensityMeta(prompt, subject, height, styles) {
  return {
    meta: {
      name: `${subject}_${height}m_${slugify(prompt)}`,
      version: "0.2.0",
      units: "meters",
      generator: "Prompt2GLTF",
      generatedFrom: prompt,
      createdAt: new Date().toISOString()
    },
    promptInterpretation: {
      originalPrompt: prompt,
      normalizedSubject: subject,
      targetHeightMeters: height,
      styleTags: styles,
      geometryDirective: "Use mixed primitives (box/cylinder/sphere/tri_prism); represent curved real-world forms with rounded geometry.",
      summary: `Generated from prompt as a ${subject} with high-density procedural spec.`,
      designIntent: {
        scaleImpression: height >= 80 ? "extreme_colossal" : height >= 30 ? "very_large" : "large",
        mood: styles.includes("dark") ? "intimidating" : "majestic",
        originalityPolicy: "generalized_original_design"
      }
    }
  };
}

function buildGiantSpec(prompt, height, styles) {
  const H = height;
  const width = rounded(H * 0.29);
  const depth = rounded(H * 0.18);

  const base = buildHighDensityMeta(prompt, "giant", height, styles);
  styles._prompt = prompt;

  const spec = {
    ...base,
    globalScale: {
      height: H,
      width,
      depth
    },
    style: {
      silhouette: "broad_shoulders_long_arms_massive_legs",
      mood: styles.includes("dark") ? "intimidating" : "mythic",
      genre: styles.includes("western_fantasy") ? "western_fantasy" : "mythic_fantasy",
      detailDensity: "ultra_high",
      bodyLanguage: "standing_guardian",
      shapeLanguage: [
        "vertical_mass",
        "heavy_shoulder_blocks",
        "layered_armor",
        "spine_details",
        "crown_like_head_features"
      ]
    },
    proportions: {
      headToBody: rounded(1 / 8.5),
      shoulderWidthRatio: 1.62,
      armLengthRatio: 1.14,
      legLengthRatio: 1.28,
      footLengthRatio: 0.115,
      handSizeRatio: 0.06
    },
    silhouettePlan: {
      headScale: 0.92,
      neckThickness: 1.15,
      chestDepth: 1.08,
      waistTaper: 0.82,
      pelvisWidth: 1.06,
      thighMass: 1.18,
      shinMass: 1.12,
      forearmMass: 1.1
    },
    materials: createBaseMaterials("giant", styles),
    skeletonPlan: {
      root: "pelvis",
      chains: {
        spine: ["pelvis", "abdomen", "lower_chest", "upper_chest", "neck", "head"],
        leftArm: ["left_shoulder", "left_upper_arm", "left_forearm", "left_hand"],
        rightArm: ["right_shoulder", "right_upper_arm", "right_forearm", "right_hand"],
        leftLeg: ["left_thigh", "left_shin", "left_foot"],
        rightLeg: ["right_thigh", "right_shin", "right_foot"]
      }
    },
    parts: [],
    surfaceDetails: [],
    ornaments: [],
    pose: {
      preset: "idle_guardian",
      headPitchDeg: -4,
      headYawDeg: 0,
      leftArmYawDeg: 4,
      rightArmYawDeg: -4,
      chestTiltDeg: 1,
      leftFootYawDeg: 3,
      rightFootYawDeg: -3
    },
    animationHints: {
      idleBreathScale: 0.008,
      eyeGlowPulse: true,
      capeReady: false
    },
    lod: {
      high: "full",
      medium: "remove_micro_ornaments",
      low: "merge_secondary_plates"
    },
    exportOptions: {
      formats: ["gltf", "glb"],
      previewHtml: true
    }
  };

  const parts = [];
  const surfaceDetails = [];
  const ornaments = [];

  const pushPart = (id, kind, size, position, material, rotation = [0, 0, 0]) => {
    parts.push({
      id,
      kind,
      size: size.map(rounded),
      position: position.map(rounded),
      rotation: rotation.map(rounded),
      material
    });
  };

  const pushSurface = (id, region, type, strength, offset) => {
    surfaceDetails.push({
      id,
      region,
      type,
      strength: rounded(strength),
      offset: offset.map(rounded)
    });
  };

  const pushOrnament = (id, category, attachTo, size, position, material) => {
    ornaments.push({
      id,
      category,
      attachTo,
      size: size.map(rounded),
      position: position.map(rounded),
      material
    });
  };

  const isMoai = /moai|\u30e2\u30a2\u30a4|rapa.?nui/iu.test(prompt);
  if (isMoai) {
    // Easter Island Moai — real-world scale (6m torso + 1.2m ahu + 0.7m pukao ≈ 8.5m total)
    // Y = 0 ground, Z = +front (face), X = +right

    // ---- Ahu (stone platform) ----
    pushPart("ahu_base",    "box", [5.00, 0.80, 4.00], [0, 0.40,  0.00], "ahu_stone");
    pushPart("ahu_step",    "box", [3.80, 0.40, 3.00], [0, 1.00,  0.00], "ahu_stone");

    // ---- Torso (buried to waist, visible from ahu top) ----
    pushPart("torso_lower", "box", [1.80, 1.80, 1.20], [0, 2.10,  0.00], "stone_main");
    pushPart("torso_upper", "box", [2.00, 1.60, 1.40], [0, 3.70,  0.00], "stone_main");
    pushPart("chest_ridge", "box", [1.60, 0.38, 0.14], [0, 4.20,  0.72], "stone_face");
    pushPart("belly_band",  "box", [2.10, 0.28, 1.40], [0, 2.70,  0.00], "stone_face");

    // ---- Arms (flat against sides, hands meeting at abdomen) ----
    pushPart("arm_L",   "box", [0.42, 2.00, 0.55], [-1.26, 2.80, 0.15], "stone_main");
    pushPart("arm_R",   "box", [0.42, 2.00, 0.55], [ 1.26, 2.80, 0.15], "stone_main");
    pushPart("hand_L",  "box", [0.50, 0.38, 0.72], [-0.65, 1.72, 0.52], "stone_face");
    pushPart("hand_R",  "box", [0.50, 0.38, 0.72], [ 0.65, 1.72, 0.52], "stone_face");

    // ---- Neck ----
    pushPart("neck",    "box", [1.00, 0.50, 0.90], [0, 4.90, 0.00], "stone_main");

    // ---- Head (elongated, ~1/3 of visible height) ----
    pushPart("head_main",   "box", [1.80, 2.40, 1.50], [0, 6.25, -0.10], "stone_main");
    pushPart("head_crown",  "box", [1.60, 0.48, 1.30], [0, 7.55, -0.15], "stone_dark");

    // ---- Brow ridge (heavy overhang) ----
    pushPart("brow_ridge",  "box", [2.00, 0.44, 0.28], [0, 7.04,  0.72], "stone_dark");

    // ---- Nose (prominent, wide, flat-tipped) ----
    pushPart("nose_bridge", "box", [0.58, 1.10, 0.42], [0, 6.22, 0.82], "stone_face");
    pushPart("nose_base",   "box", [0.80, 0.34, 0.48], [0, 5.70, 0.84], "stone_face");
    pushPart("nose_tip_L",  "box", [0.28, 0.22, 0.28], [-0.32, 5.60, 0.96], "stone_face");
    pushPart("nose_tip_R",  "box", [0.28, 0.22, 0.28], [ 0.32, 5.60, 0.96], "stone_face");

    // ---- Eye sockets (deep-set, recessed) ----
    pushPart("eye_socket_L","box", [0.44, 0.30, 0.20], [-0.52, 6.92, 0.84], "stone_dark");
    pushPart("eye_socket_R","box", [0.44, 0.30, 0.20], [ 0.52, 6.92, 0.84], "stone_dark");

    // ---- Lips / mouth ----
    pushPart("lip_upper",   "box", [0.70, 0.18, 0.26], [0, 5.46, 0.86], "stone_dark");
    pushPart("lip_lower",   "box", [0.70, 0.16, 0.22], [0, 5.26, 0.82], "stone_main");
    pushPart("chin",        "box", [0.85, 0.45, 0.50], [0, 4.98, 0.62], "stone_main");

    // ---- Ears (long, elongated lobes) ----
    pushPart("ear_L",       "box", [0.22, 1.20, 0.42], [-0.99, 6.20,  0.05], "stone_main");
    pushPart("ear_R",       "box", [0.22, 1.20, 0.42], [ 0.99, 6.20,  0.05], "stone_main");
    pushPart("lobe_L",      "box", [0.30, 0.34, 0.35], [-0.98, 5.42,  0.15], "stone_face");
    pushPart("lobe_R",      "box", [0.30, 0.34, 0.35], [ 0.98, 5.42,  0.15], "stone_face");

    // ---- Pukao (red scoria topknot cylinder) ----
    pushPart("pukao",       "cylinder", [1.00, 0.70, 1.00], [0, 8.15, -0.10], "pukao");

    // ---- Back carvings ----
    pushPart("back_carving_U","box", [1.50, 0.10, 0.40], [0, 4.52, -0.78], "stone_dark");
    pushPart("back_carving_L","box", [1.30, 0.10, 0.40], [0, 3.42, -0.65], "stone_dark");

    // ---- Lichen patches ----
    pushPart("lichen_1",    "box", [0.80, 0.06, 0.60], [-0.50, 5.02, 0.75], "lichen");
    pushPart("lichen_2",    "box", [0.60, 0.06, 0.50], [ 0.30, 3.24,-0.68], "lichen");
    pushPart("lichen_3",    "box", [0.40, 0.06, 0.40], [-0.60, 6.80,-0.76], "lichen");

    // ---- Surface details ----
    const moaiSD = [
      ["face",          "carved_line"],  ["brow_area",    "edge_bead"],
      ["stone_texture", "roughness"],    ["nose_surface",  "carve_relief"],
      ["ear_surface",   "carved_line"],  ["torso_front",  "panel_line"],
      ["ahu_surface",   "roughness"],    ["back",          "erosion"],
      ["crown_top",     "roughness"],    ["belly",         "carved_line"],
      ["lichen_area",   "paint_wear"],   ["eye_hollow",    "carve_relief"]
    ];
    moaiSD.forEach(([region, type], idx) => {
      pushSurface(`sd_${region}`, region, type, 0.14 + (idx % 5) * 0.04, [(idx % 3 - 1) * 0.01, 0, 0]);
    });

    spec.globalScale = { height: 8.5, width: 2.8, depth: 1.8, type: "moai_easter_island" };
    spec.style.silhouette = "moai_monolithic_stone_statue";
    spec.promptInterpretation.archetype = "moai";
    spec.parts = parts;
    spec.surfaceDetails = surfaceDetails;
    spec.ornaments = ornaments;
    return spec;
  }

  // Core body
  pushPart("pelvis", "box", [H * 0.12, H * 0.10, H * 0.08], [0, H * 0.42, 0], "armor_main");
  pushPart("abdomen", "box", [H * 0.13, H * 0.09, H * 0.085], [0, H * 0.49, 0], "body_main");
  pushPart("lower_chest", "box", [H * 0.15, H * 0.10, H * 0.095], [0, H * 0.57, 0], "armor_secondary");
  pushPart("upper_chest", "box", [H * 0.18, H * 0.11, H * 0.10], [0, H * 0.65, 0], "armor_main");
  pushPart("back_core", "box", [H * 0.14, H * 0.15, H * 0.04], [0, H * 0.60, -H * 0.06], "armor_secondary");
  pushPart("neck", "box", [H * 0.04, H * 0.03, H * 0.04], [0, H * 0.74, 0], "body_main");
  pushPart("head", "box", [H * 0.09, H * 0.10, H * 0.08], [0, H * 0.82, 0], "body_main");
  pushPart("jaw", "box", [H * 0.06, H * 0.025, H * 0.045], [0, H * 0.785, H * 0.015], "armor_secondary");
  pushPart("brow", "box", [H * 0.075, H * 0.015, H * 0.025], [0, H * 0.84, H * 0.028], "armor_main");

  pushPart("left_eye", "box", [H * 0.01, H * 0.01, H * 0.01], [-H * 0.015, H * 0.82, H * 0.041], "emissive_eye");
  pushPart("right_eye", "box", [H * 0.01, H * 0.01, H * 0.01], [H * 0.015, H * 0.82, H * 0.041], "emissive_eye");

  // Horns 窶・5-segment curved horns
  const hornSegs = [
    { w: 0.022, h: 0.045, ox: 0.030, oy: 0.880, rot:  0 },
    { w: 0.019, h: 0.040, ox: 0.048, oy: 0.916, rot:  8 },
    { w: 0.015, h: 0.036, ox: 0.065, oy: 0.948, rot: 16 },
    { w: 0.011, h: 0.030, ox: 0.079, oy: 0.975, rot: 24 },
    { w: 0.007, h: 0.024, ox: 0.090, oy: 0.997, rot: 34 },
  ];
  for (let s = 0; s < hornSegs.length; s++) {
    const { w, h, ox, oy, rot } = hornSegs[s];
    const mat = s < 3 ? "accent" : "dark_accent";
    pushPart(`left_horn_seg_${s + 1}`,  "box", [H*w, H*h, H*w], [-H*ox, H*oy, 0], mat, [0, 0,  rot]);
    pushPart(`right_horn_seg_${s + 1}`, "box", [H*w, H*h, H*w], [ H*ox, H*oy, 0], mat, [0, 0, -rot]);
  }

  // Shoulders and arms
  pushPart("left_shoulder", "box", [H * 0.07, H * 0.055, H * 0.07], [-H * 0.15, H * 0.69, 0], "armor_main");
  pushPart("right_shoulder", "box", [H * 0.07, H * 0.055, H * 0.07], [H * 0.15, H * 0.69, 0], "armor_main");

  pushPart("left_upper_arm", "box", [H * 0.05, H * 0.15, H * 0.05], [-H * 0.16, H * 0.56, 0], "body_main");
  pushPart("right_upper_arm", "box", [H * 0.05, H * 0.15, H * 0.05], [H * 0.16, H * 0.56, 0], "body_main");
  pushPart("left_elbow_guard", "box", [H * 0.06, H * 0.03, H * 0.06], [-H * 0.16, H * 0.47, 0], "armor_secondary");
  pushPart("right_elbow_guard", "box", [H * 0.06, H * 0.03, H * 0.06], [H * 0.16, H * 0.47, 0], "armor_secondary");
  pushPart("left_forearm", "box", [H * 0.045, H * 0.14, H * 0.045], [-H * 0.16, H * 0.36, 0], "armor_main");
  pushPart("right_forearm", "box", [H * 0.045, H * 0.14, H * 0.045], [H * 0.16, H * 0.36, 0], "armor_main");
  pushPart("left_hand", "box", [H * 0.042, H * 0.04, H * 0.042], [-H * 0.16, H * 0.25, 0], "body_main");
  pushPart("right_hand", "box", [H * 0.042, H * 0.04, H * 0.042], [H * 0.16, H * 0.25, 0], "body_main");

  // Fingers
  for (let hand of ["left", "right"]) {
    const sx = hand === "left" ? -1 : 1;
    for (let i = 0; i < 5; i++) {
      const dx = (-0.016 + i * 0.008) * H;
      pushPart(
        `${hand}_finger_${i + 1}`,
        "box",
        [H * 0.006, H * 0.02, H * 0.006],
        [sx * H * 0.16 + dx, H * 0.215, H * 0.016],
        "armor_secondary"
      );
    }
  }

  // Legs
  pushPart("left_thigh", "box", [H * 0.06, H * 0.19, H * 0.06], [-H * 0.05, H * 0.26, 0], "body_main");
  pushPart("right_thigh", "box", [H * 0.06, H * 0.19, H * 0.06], [H * 0.05, H * 0.26, 0], "body_main");
  pushPart("left_knee_guard", "box", [H * 0.07, H * 0.03, H * 0.07], [-H * 0.05, H * 0.15, H * 0.01], "accent");
  pushPart("right_knee_guard", "box", [H * 0.07, H * 0.03, H * 0.07], [H * 0.05, H * 0.15, H * 0.01], "accent");
  pushPart("left_shin", "box", [H * 0.055, H * 0.18, H * 0.055], [-H * 0.05, H * 0.07, 0], "armor_main");
  pushPart("right_shin", "box", [H * 0.055, H * 0.18, H * 0.055], [H * 0.05, H * 0.07, 0], "armor_main");
  pushPart("left_foot", "box", [H * 0.08, H * 0.03, H * 0.12], [-H * 0.05, H * 0.01, H * 0.02], "armor_secondary");
  pushPart("right_foot", "box", [H * 0.08, H * 0.03, H * 0.12], [H * 0.05, H * 0.01, H * 0.02], "armor_secondary");

  // Toes
  for (let foot of ["left", "right"]) {
    const sx = foot === "left" ? -1 : 1;
    for (let i = 0; i < 4; i++) {
      pushPart(
        `${foot}_toe_${i + 1}`,
        "box",
        [H * 0.014, H * 0.012, H * 0.03],
        [sx * H * (0.032 + i * 0.012), H * 0.003, H * 0.075],
        "dark_accent"
      );
    }
  }

  // Chest plates
  for (let row = 0; row < 6; row++) {
    for (let col = 0; col < 8; col++) {
      pushPart(
        `chest_plate_${row + 1}_${col + 1}`,
        "box",
        [H * 0.012, H * 0.012, H * 0.018],
        [(-0.042 + col * 0.012) * H, H * (0.60 + row * 0.015), H * 0.056],
        row % 2 === 0 ? "armor_secondary" : "accent"
      );
    }
  }

  // Abdomen segments
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 6; col++) {
      pushPart(
        `abdomen_segment_${row + 1}_${col + 1}`,
        "box",
        [H * 0.011, H * 0.01, H * 0.015],
        [(-0.03 + col * 0.012) * H, H * (0.48 + row * 0.012), H * 0.047],
        "armor_main"
      );
    }
  }

  // Spine plates
  for (let i = 0; i < 80; i++) {
    const y = H * (0.47 + i * 0.0042);
    const side = i % 2 === 0 ? -1 : 1;
    pushPart(
      `spine_plate_${i + 1}`,
      "box",
      [H * 0.018, H * 0.01, H * 0.026],
      [side * H * 0.012, y, -H * 0.058],
      i % 3 === 0 ? "accent" : "armor_secondary"
    );
  }

  // Shoulder layered armor
  for (let sideName of ["left", "right"]) {
    const sx = sideName === "left" ? -1 : 1;
    for (let i = 0; i < 18; i++) {
      pushPart(
        `${sideName}_shoulder_flange_${i + 1}`,
        "box",
        [H * 0.03, H * 0.008, H * 0.05],
        [sx * H * (0.175 + i * 0.0035), H * (0.695 - i * 0.004), 0],
        i % 2 === 0 ? "armor_main" : "armor_secondary"
      );
    }
  }

  // Arm bands
  for (let sideName of ["left", "right"]) {
    const sx = sideName === "left" ? -1 : 1;
    for (let i = 0; i < 28; i++) {
      pushPart(
        `${sideName}_upper_arm_band_${i + 1}`,
        "box",
        [H * 0.055, H * 0.0035, H * 0.055],
        [sx * H * 0.16, H * (0.50 + i * 0.0042), 0],
        i % 2 === 0 ? "accent" : "dark_accent"
      );
    }
    for (let i = 0; i < 24; i++) {
      pushPart(
        `${sideName}_forearm_band_${i + 1}`,
        "box",
        [H * 0.05, H * 0.0035, H * 0.05],
        [sx * H * 0.16, H * (0.30 + i * 0.004), 0],
        i % 2 === 0 ? "armor_secondary" : "accent"
      );
    }
  }

  // Leg armor bands
  for (let sideName of ["left", "right"]) {
    const sx = sideName === "left" ? -1 : 1;
    for (let i = 0; i < 30; i++) {
      pushPart(
        `${sideName}_shin_band_${i + 1}`,
        "box",
        [H * 0.06, H * 0.003, H * 0.06],
        [sx * H * 0.05, H * (0.01 + i * 0.0055), 0],
        i % 2 === 0 ? "armor_secondary" : "dark_accent"
      );
    }
  }

  // Waist plates
  for (let i = 0; i < 20; i++) {
    pushPart(
      `waist_plate_front_${i + 1}`,
      "box",
      [H * 0.012, H * 0.04, H * 0.008],
      [(-0.055 + i * 0.006) * H, H * 0.40, H * 0.05],
      i % 2 === 0 ? "accent" : "armor_secondary"
    );
  }
  for (let i = 0; i < 20; i++) {
    pushPart(
      `waist_plate_back_${i + 1}`,
      "box",
      [H * 0.012, H * 0.04, H * 0.008],
      [(-0.055 + i * 0.006) * H, H * 0.40, -H * 0.05],
      i % 2 === 0 ? "accent" : "armor_secondary"
    );
  }

  // 笏笏 Shoulder pauldrons (layered plates radiating from shoulder) 笏笏
  for (const sideName of ["left", "right"]) {
    const sx = sideName === "left" ? -1 : 1;
    // Main pauldron cap
    pushPart(`${sideName}_pauldron_cap`, "box",
      [H*0.10, H*0.025, H*0.10],
      [sx*H*0.155, H*0.715, 0],
      "armor_main");
    // Upper spike on pauldron
    pushPart(`${sideName}_pauldron_spike`, "box",
      [H*0.018, H*0.06, H*0.018],
      [sx*H*0.155, H*0.745, 0],
      "accent");
    // Cascading plates: 5 overlapping plates fanning downward
    for (let i = 0; i < 5; i++) {
      const angle = (i * 18) * (Math.PI / 180);
      const py = H * (0.68 - i * 0.022);
      const pz = H * (-0.01 + i * 0.008);
      const pw = H * (0.09 - i * 0.008);
      pushPart(
        `${sideName}_pauldron_plate_${i + 1}`,
        "box",
        [pw, H*0.014, H*0.07],
        [sx * H * (0.155 + i * 0.006), py, pz],
        i % 2 === 0 ? "armor_main" : "armor_secondary"
      );
    }
  }

  // 笏笏 Back spikes (12 spikes protruding from spine, upper to lower) 笏笏
  for (let i = 0; i < 12; i++) {
    const y  = H * (0.78 - i * 0.032);
    const sz = H * (0.06 + (i < 4 ? 0.04 : i < 8 ? 0.02 : 0));   // longer near top
    const sh = H * (0.055 - i * 0.003);
    pushPart(
      `back_spike_${i + 1}`,
      "box",
      [H*0.012, sh, sz],
      [0, y, -H*0.075],
      i % 3 === 0 ? "accent" : "dark_accent",
      [-(10 + i * 4), 0, 0]
    );
    // Spike tip (thinner)
    pushPart(
      `back_spike_tip_${i + 1}`,
      "box",
      [H*0.006, H*0.018, sz * 0.4],
      [0, y + sh * 0.55, -H * (0.075 + sz * 0.55)],
      "dark_accent",
      [-(10 + i * 4), 0, 0]
    );
  }

  // 笏笏 Cape (40 overlapping flat panels hanging from upper back) 笏笏
  // Cape attachment strip
  pushPart("cape_attach", "box",
    [H*0.15, H*0.012, H*0.008],
    [0, H*0.705, -H*0.062],
    "dark_accent");
  // Vertical panels: 8 columns ﾃ・5 rows
  for (let col = 0; col < 8; col++) {
    const cx = (-0.035 + col * 0.01) * H;
    for (let row = 0; row < 5; row++) {
      const cy = H * (0.68 - row * 0.065);
      const cz = -H * (0.065 + row * 0.018);
      const ch = H * (0.07 + row * 0.005);
      pushPart(
        `cape_panel_${col + 1}_${row + 1}`,
        "box",
        [H*0.016, ch, H*0.006],
        [cx, cy, cz],
        row % 2 === 0 ? "dark_accent" : "armor_secondary"
      );
    }
  }

  // 笏笏 Greatsword (right hand) 笏笏
  // Grip (handle)
  pushPart("sword_grip", "box",
    [H*0.018, H*0.10, H*0.018],
    [H*0.16, H*0.16, H*0.025],
    "dark_accent");
  // Pommel
  pushPart("sword_pommel", "box",
    [H*0.028, H*0.025, H*0.028],
    [H*0.16, H*0.10, H*0.025],
    "accent");
  // Cross-guard
  pushPart("sword_guard", "box",
    [H*0.09, H*0.018, H*0.022],
    [H*0.16, H*0.22, H*0.025],
    "armor_main");
  // Blade lower
  pushPart("sword_blade_lower", "box",
    [H*0.024, H*0.18, H*0.008],
    [H*0.16, H*0.34, H*0.025],
    "armor_secondary");
  // Blade upper
  pushPart("sword_blade_upper", "box",
    [H*0.018, H*0.18, H*0.006],
    [H*0.16, H*0.51, H*0.025],
    "armor_secondary");
  // Blade tip
  pushPart("sword_blade_tip", "box",
    [H*0.010, H*0.06, H*0.005],
    [H*0.16, H*0.63, H*0.025],
    "accent");
  // Blade fuller (center ridge)
  pushPart("sword_fuller", "box",
    [H*0.004, H*0.32, H*0.004],
    [H*0.16, H*0.42, H*0.025],
    "emissive_eye");

  // Surface detail metadata
  const regions = [
    "head", "neck", "chest", "abdomen", "back", "left_arm", "right_arm",
    "left_leg", "right_leg", "pelvis", "shoulders", "feet"
  ];
  const detailTypes = ["crack", "engraving", "plate_seam", "erosion", "battle_scar"];

  let sdIndex = 1;
  for (const region of regions) {
    for (let i = 0; i < 18; i++) {
      pushSurface(
        `surface_detail_${sdIndex++}`,
        region,
        detailTypes[i % detailTypes.length],
        0.2 + (i % 7) * 0.08,
        [Math.sin(i) * 0.03, Math.cos(i * 0.7) * 0.02, ((i % 5) - 2) * 0.01]
      );
    }
  }

  // Ornament metadata
  for (let i = 0; i < 40; i++) {
    pushOrnament(
      `ornament_${i + 1}`,
      i % 2 === 0 ? "sigil_plate" : "ritual_spike",
      i % 3 === 0 ? "chest" : i % 3 === 1 ? "back" : "shoulder",
      [H * 0.012, H * 0.018, H * 0.006],
      [((i % 8) - 4) * H * 0.008, H * (0.50 + (i % 10) * 0.018), (i % 2 === 0 ? 1 : -1) * H * 0.05],
      i % 2 === 0 ? "accent" : "dark_accent"
    );
  }

  spec.parts = parts;
  spec.surfaceDetails = surfaceDetails;
  spec.ornaments = ornaments;
  return spec;
}

function buildRobotSpec(prompt, height, styles) {
  const base = buildHighDensityMeta(prompt, "robot", height, styles);
  return {
    ...base,
    globalScale: {
      height,
      width: Number((height * 0.22).toFixed(2)),
      depth: Number((height * 0.12).toFixed(2))
    },
    style: {
      silhouette: "heroic_mecha",
      mood: "powerful",
      genre: "sci_fi",
      detailDensity: "high"
    },
    materials: createBaseMaterials("robot", styles),
    parts: [
      { id: "torso", kind: "box", size: [height * 0.18, height * 0.22, height * 0.10], position: [0, height * 0.56, 0], rotation: [0, 0, 0], material: "body_primary" },
      { id: "head", kind: "box", size: [height * 0.08, height * 0.08, height * 0.07], position: [0, height * 0.74, 0], rotation: [0, 0, 0], material: "body_secondary" },
      { id: "core", kind: "box", size: [height * 0.03, height * 0.03, height * 0.03], position: [0, height * 0.57, height * 0.055], rotation: [0, 0, 0], material: "emissive_core" }
    ],
    surfaceDetails: [],
    ornaments: [],
    pose: { preset: "idle" },
    animationHints: {},
    lod: {},
    exportOptions: {
      formats: ["gltf", "glb"],
      previewHtml: true
    }
  };
}

function buildCastleSpec(prompt, height, styles) {
  const archetype = classifyCastleArchetype(prompt, styles);
  const H = height;
  const base = buildHighDensityMeta(prompt, archetype === "crystal_tower" ? "tower" : "castle", height, styles);

  const widthFactor = archetype === "japanese_castle" ? 1.45 : archetype === "demon_castle" ? 1.20 : 1.30;
  const depthFactor = archetype === "japanese_castle" ? 1.10 : 1.05;

  const spec = {
    ...base,
    promptInterpretation: {
      ...base.promptInterpretation,
      fantasyArchetype: archetype,
    },
    globalScale: { height, width: Number((height * widthFactor).toFixed(2)), depth: Number((height * depthFactor).toFixed(2)) },
    style: {
      silhouette: archetype,
      mood: archetype === "demon_castle" ? "ominous" : archetype === "cinderella_castle" ? "fairy" : "majestic",
      genre: "fantasy_architecture",
      detailDensity: "high"
    },
    materials: createBaseMaterials(archetype === "crystal_tower" ? "tower" : "castle", styles),
    parts: [],
    surfaceDetails: [],
    ornaments: [],
    pose: { preset: "static" },
    animationHints: {},
    lod: {},
    exportOptions: { formats: ["gltf", "glb"], previewHtml: true }
  };

  const parts = [];
  const box = (id, material, sx, sy, sz, px, py, pz) => {
    parts.push({ id, kind: "box", size: [rounded(sx), rounded(sy), rounded(sz)], position: [rounded(px), rounded(py), rounded(pz)], rotation: [0,0,0], material });
  };
  const shape = (id, kind, material, sx, sy, sz, px, py, pz) => {
    parts.push({ id, kind, size: [rounded(sx), rounded(sy), rounded(sz)], position: [rounded(px), rounded(py), rounded(pz)], rotation: [0,0,0], material });
  };

  if (archetype === "crystal_tower") {
    shape("crystal_core", "tri_prism", "glass", H*0.24, H*0.82, H*0.24, 0, H*0.41, 0);
    shape("crystal_spire", "tri_prism", "spire_tip", H*0.10, H*0.22, H*0.10, 0, H*0.93, 0);
    for (const side of [-1,1]) {
      shape(`wing_${side<0?"L":"R"}`, "cylinder", "steel_main", H*0.10, H*0.42, H*0.10, side*H*0.16, H*0.21, 0);
    }
  } else if (archetype === "demon_castle") {
    box("keep", "stone_dark", H*0.38, H*0.62, H*0.30, 0, H*0.31, 0);
    box("left_spire", "stone_dark", H*0.16, H*0.88, H*0.16, -H*0.34, H*0.44, 0);
    box("right_spire", "stone_dark", H*0.16, H*0.88, H*0.16, H*0.34, H*0.44, 0);
    box("gate", "roof_metal", H*0.30, H*0.20, H*0.16, 0, H*0.10, H*0.20);
    box("throne_spire", "accent_banner", H*0.08, H*0.22, H*0.08, 0, H*0.78, 0);
  } else if (archetype === "japanese_castle") {
    box("stone_base", "stone_main", H*0.52, H*0.32, H*0.42, 0, H*0.16, 0);
    box("main_keep", "stone_main", H*0.34, H*0.40, H*0.28, 0, H*0.46, 0);
    box("roof_tier_1", "roof_metal", H*0.46, H*0.12, H*0.36, 0, H*0.66, 0);
    box("roof_tier_2", "roof_metal", H*0.32, H*0.10, H*0.26, 0, H*0.78, 0);
    box("roof_tier_3", "roof_metal", H*0.20, H*0.08, H*0.18, 0, H*0.88, 0);
  } else if (archetype === "cinderella_castle") {
    box("central_keep", "stone_main", H*0.30, H*0.62, H*0.26, 0, H*0.31, 0);
    box("left_tower", "stone_main", H*0.13, H*0.72, H*0.13, -H*0.24, H*0.36, H*0.06);
    box("right_tower", "stone_main", H*0.13, H*0.72, H*0.13, H*0.24, H*0.36, H*0.06);
    box("spire_main", "accent_banner", H*0.07, H*0.22, H*0.07, 0, H*0.72, 0);
    box("gatehouse", "stone_main", H*0.26, H*0.22, H*0.20, 0, H*0.11, H*0.18);
  } else {
    box("keep", "stone_main", H * 0.35, H * 0.55, H * 0.28, 0, H * 0.275, 0);
    box("left_tower", "stone_dark", H * 0.18, H * 0.75, H * 0.18, -H * 0.32, H * 0.375, 0);
    box("right_tower", "stone_dark", H * 0.18, H * 0.75, H * 0.18, H * 0.32, H * 0.375, 0);
    box("gatehouse", "stone_main", H * 0.28, H * 0.24, H * 0.18, 0, H * 0.12, H * 0.19);
  }

  spec.parts = parts;
  return spec;
}
function buildTowerSpec(prompt, height, styles) {
  const H = height;
  const base = buildHighDensityMeta(prompt, "tower", height, styles);

  // ── Tsutenkaku-style: 4-leg lattice base + cylindrical mid-deck + observation top ─
  const isTsutenkaku = /\u901a\u5929\u95a3|tsutenkaku|\u89b3\u5149\u5854|\u5370\u8c61\u5854|\u5927\u962a.*\u30bf\u30ef\u30fc|\u30bf\u30ef\u30fc.*\u5927\u962a/iu.test(prompt);
  if (isTsutenkaku) {
    const spec = {
      ...base,
      globalScale: { height: H, width: rounded(H * 0.38), depth: rounded(H * 0.38) },
      style: {
        silhouette: "four_leg_lattice_observation_tower",
        mood: "festive_civic",
        genre: "retro_observation_tower",
        detailDensity: "high",
        bodyLanguage: "vertical_spire",
        shapeLanguage: ["four_leg_base", "cylindrical_deck", "neon_signs", "antenna_spire"]
      },
      materials: {
        body_main:   { baseColor: "#EAE6DA", roughness: 0.50, metalness: 0.12 },
        steel_frame: { baseColor: "#3C4045", roughness: 0.38, metalness: 0.90 },
        concrete:    { baseColor: "#B8BAB2", roughness: 0.90, metalness: 0.04 },
        glass:       { baseColor: "#7BAED6", roughness: 0.12, metalness: 0.88 },
        spire_tip:   { baseColor: "#D0D8DC", roughness: 0.22, metalness: 0.96 },
        gold_trim:   { baseColor: "#D4A820", roughness: 0.28, metalness: 0.90 },
        neon_red:    { baseColor: "#FF2040", roughness: 0.08, metalness: 0.00, emissive: "#FF2040" },
        neon_blue:   { baseColor: "#2060FF", roughness: 0.08, metalness: 0.00, emissive: "#2060FF" },
        neon_yellow: { baseColor: "#FFD020", roughness: 0.08, metalness: 0.00, emissive: "#FFD020" },
        neon_green:  { baseColor: "#20E060", roughness: 0.08, metalness: 0.00, emissive: "#20E060" },
      },
      parts: [], surfaceDetails: [], ornaments: [],
      pose: { preset: "static" }, animationHints: {},
      lod: { high: "full", medium: "remove_neon", low: "merge_legs" },
      exportOptions: { formats: ["gltf", "glb"], previewHtml: true }
    };
    const parts = [];
    const p = (id, kind, mat, sx, sy, sz, px, py, pz, rot = [0,0,0]) =>
      parts.push({ id, kind, material: mat, size: [rounded(sx), rounded(sy), rounded(sz)],
                   position: [rounded(px), rounded(py), rounded(pz)], rotation: rot.map(rounded) });

    // Base platform & arcade
    p("base_platform",  "box",      "concrete",   H*0.40, H*0.02, H*0.40, 0, H*0.01, 0);
    p("base_inner",     "cylinder", "body_main",  H*0.16, H*0.06, H*0.16, 0, H*0.05, 0);
    for (let i = 0; i < 8; i++) {
      const a = i * Math.PI / 4;
      p(`arcade_col_${i}`, "cylinder", "body_main", H*0.025, H*0.05, H*0.025,
        Math.cos(a)*H*0.17, H*0.04, Math.sin(a)*H*0.17);
    }
    p("arcade_ring",    "cylinder", "gold_trim",  H*0.38, H*0.008, H*0.38, 0, H*0.06, 0);

    // 4 lattice legs (NE/NW/SW/SE at 45°,135°,225°,315°)
    const legAngles = [45, 135, 225, 315];
    for (let l = 0; l < 4; l++) {
      const aRad = legAngles[l] * Math.PI / 180;
      const nSeg = 8;
      for (let s = 0; s < nSeg; s++) {
        const t = (s + 0.5) / nSeg;
        const legY = H * (0.44 - t * 0.41);
        const spread = t * H * 0.17;
        const lw = H * (0.018 + t * 0.016);
        const segH = H * 0.41 / nSeg * 1.08;
        p(`leg_${l+1}_${s+1}`, "box", t > 0.6 ? "concrete" : "steel_frame",
          lw, segH, lw,
          Math.cos(aRad) * spread, legY, Math.sin(aRad) * spread);
      }
      // diagonal cross-braces between adjacent legs
      for (const bFrac of [0.06, 0.18, 0.30]) {
        const t2 = 1 - bFrac / 0.44;
        const sp = t2 * H * 0.17;
        const aNext = legAngles[(l + 1) % 4] * Math.PI / 180;
        const x1 = Math.cos(aRad)*sp, z1 = Math.sin(aRad)*sp;
        const x2 = Math.cos(aNext)*sp, z2 = Math.sin(aNext)*sp;
        const blen = Math.sqrt((x2-x1)**2 + (z2-z1)**2);
        const ang = -Math.atan2(z2-z1, x2-x1) * 180 / Math.PI;
        p(`brace_${l+1}_${Math.round(bFrac*100)}`, "box", "steel_frame",
          blen, H*0.007, H*0.007,
          (x1+x2)/2, H*bFrac, (z1+z2)/2, [0, ang, 0]);
      }
    }

    // Central shaft (leg junction → mid deck)
    p("shaft_lower", "cylinder", "body_main", H*0.10, H*0.10, H*0.10, 0, H*0.48, 0);

    // Mid-level cylindrical observation deck (main feature)
    p("mid_deck_body",   "cylinder", "body_main", H*0.24, H*0.14, H*0.24, 0, H*0.56, 0);
    p("mid_deck_ring_lo","cylinder", "gold_trim",  H*0.26, H*0.016, H*0.26, 0, H*0.50, 0);
    p("mid_deck_ring_hi","cylinder", "gold_trim",  H*0.26, H*0.016, H*0.26, 0, H*0.63, 0);
    p("mid_deck_glass",  "cylinder", "glass",      H*0.20, H*0.08,  H*0.20, 0, H*0.56, 0);

    // Neon sign panels (4 cardinal faces of mid deck)
    const neonColors = ["neon_red", "neon_blue", "neon_yellow", "neon_green"];
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI / 2;
      p(`neon_sign_${i+1}`, "box", neonColors[i],
        H*0.14, H*0.06, H*0.014,
        Math.sin(a)*H*0.13, H*0.56, Math.cos(a)*H*0.13);
    }

    // Upper shaft
    p("shaft_upper",      "cylinder", "body_main",  H*0.08, H*0.08, H*0.08, 0, H*0.70, 0);

    // Upper observation floor
    p("upper_obs_body",   "cylinder", "body_main",  H*0.18, H*0.10, H*0.18, 0, H*0.79, 0);
    p("upper_obs_ring",   "cylinder", "gold_trim",  H*0.20, H*0.012, H*0.20, 0, H*0.75, 0);
    p("upper_obs_top",    "cylinder", "gold_trim",  H*0.20, H*0.012, H*0.20, 0, H*0.84, 0);
    p("upper_obs_glass",  "cylinder", "glass",      H*0.14, H*0.07,  H*0.14, 0, H*0.79, 0);
    p("upper_neon_N",     "box",      "neon_red",   H*0.08, H*0.03, H*0.012, 0, H*0.80, H*0.095);
    p("upper_neon_S",     "box",      "neon_blue",  H*0.08, H*0.03, H*0.012, 0, H*0.80, -H*0.095);

    // Spire
    p("spire_base",  "box",      "body_main", H*0.06, H*0.08, H*0.06, 0, H*0.88, 0);
    p("spire_mid",   "box",      "spire_tip", H*0.030, H*0.06, H*0.030, 0, H*0.93, 0);
    p("spire_top",   "box",      "spire_tip", H*0.014, H*0.06, H*0.014, 0, H*0.97, 0);

    // Surface details
    const detailTypes = ["panel_seam", "weathering", "trim_line", "window_grid"];
    for (let i = 0; i < 20; i++) {
      const reg = i < 8 ? "structure" : i < 14 ? "deck" : "spire";
      spec.surfaceDetails.push({ id: `sd_${i+1}`, region: reg,
        type: detailTypes[i % detailTypes.length],
        strength: rounded(0.15 + (i % 5) * 0.05),
        offset: [rounded(Math.sin(i*0.7)*0.018), rounded(Math.cos(i*0.6)*0.014), rounded(((i%4)-1.5)*0.010)] });
    }

    spec.parts = parts;
    return spec;
  }

  const spec = {
    ...base,
    globalScale: { height: H, width: rounded(H * 0.52), depth: rounded(H * 0.52) },
    style: {
      silhouette: "tripod_lattice_communications_tower",
      mood: "modern_engineering",
      genre: "contemporary_architecture",
      detailDensity: "high",
      bodyLanguage: "vertical_spire",
      shapeLanguage: ["tripod_base", "tapering_shaft", "observation_rings", "needle_spire"]
    },
    materials: createBaseMaterials("tower", styles),
    parts: [],
    surfaceDetails: [],
    ornaments: [],
    pose: { preset: "static" },
    animationHints: {},
    lod: { high: "full", medium: "remove_lattice_detail", low: "merge_shaft_sections" },
    exportOptions: { formats: ["gltf", "glb"], previewHtml: true }
  };

  const parts = [];

  const pushPart = (id, kind, size, position, material, rotation = [0, 0, 0]) => {
    parts.push({ id, kind, size: size.map(rounded), position: position.map(rounded), rotation: rotation.map(rounded), material });
  };

  // 笏笏 Ground base platform 笏笏
  pushPart("base_platform", "box", [H*0.55, H*0.006, H*0.55], [0, H*0.003, 0], "concrete_main");
  pushPart("base_ring",     "box", [H*0.28, H*0.012, H*0.28], [0, H*0.009, 0], "steel_dark");

  // 笏笏 Tripod base legs (3 legs at 90ﾂｰ, 210ﾂｰ, 330ﾂｰ) 笏笏
  // Each leg: 10 segments going from the central shaft junction (~Y=0.40H) down to ground, spreading outward
  const legAngles = [90, 210, 330];
  for (let l = 0; l < 3; l++) {
    const aRad = legAngles[l] * Math.PI / 180;
    const segCount = 12;
    for (let seg = 0; seg < segCount; seg++) {
      const tMid = (seg + 0.5) / segCount;           // 0=top of leg, 1=bottom
      const legY  = H * (0.395 - tMid * 0.375);     // from H*0.395 down to H*0.02
      const spread = tMid * 0.21;                    // spreads to H*0.21 at base
      const lx = Math.cos(aRad) * H * spread;
      const lz = Math.sin(aRad) * H * spread;
      const lw = H * (0.018 + tMid * 0.020);        // thicker at base
      const segH = H * (0.375 / segCount + 0.003);
      pushPart(`leg_${l+1}_seg_${seg+1}`, "box",
        [lw, segH, lw], [lx, legY, lz],
        tMid > 0.65 ? "concrete_main" : "steel_main");
    }
  }

  // Cross braces between legs at 3 heights
  for (const bYfrac of [0.06, 0.15, 0.26]) {
    const spread = (1 - bYfrac / 0.40) * 0.21;
    for (let l = 0; l < 3; l++) {
      const a1 = legAngles[l] * Math.PI / 180;
      const a2 = legAngles[(l + 1) % 3] * Math.PI / 180;
      const x1 = Math.cos(a1) * H * spread, z1 = Math.sin(a1) * H * spread;
      const x2 = Math.cos(a2) * H * spread, z2 = Math.sin(a2) * H * spread;
      const cx = (x1 + x2) / 2, cz = (z1 + z2) / 2;
      const bl = Math.sqrt((x2-x1)**2 + (z2-z1)**2);
      const ang = -Math.atan2(z2-z1, x2-x1) * 180 / Math.PI;
      pushPart(`brace_${Math.round(bYfrac*100)}_${l+1}`, "box",
        [bl, H*0.007, H*0.007], [cx, H*bYfrac, cz],
        "steel_dark", [0, ang, 0]);
    }
  }

  // 笏笏 Main shaft (stacked tapering box sections, narrowing upward) 笏笏
  // [yBottom, yTop, width]
  const shaftSections = [
    [0.005, 0.08, 0.082], [0.08,  0.16, 0.074], [0.16,  0.24, 0.066],
    [0.24,  0.32, 0.059], [0.32,  0.40, 0.053], [0.40,  0.47, 0.047],
    [0.47,  0.54, 0.042], [0.54,  0.58, 0.038], [0.58,  0.62, 0.034],
    [0.62,  0.66, 0.030], [0.66,  0.70, 0.027], [0.70,  0.74, 0.024],
    [0.74,  0.78, 0.021], [0.78,  0.82, 0.018], [0.82,  0.86, 0.015],
    [0.86,  0.90, 0.013], [0.90,  0.94, 0.011], [0.94,  0.96, 0.009],
  ];
  for (let i = 0; i < shaftSections.length; i++) {
    const [y0, y1, w] = shaftSections[i];
    const sH = H * (y1 - y0);
    const sY = H * (y0 + y1) / 2;
    pushPart(`shaft_${i+1}`, "box", [H*w, sH, H*w], [0, sY, 0], "steel_main");
    // 4 face panels (thin)
    for (let f = 0; f < 4; f++) {
      const fRad = f * Math.PI / 2;
      pushPart(`shaft_${i+1}_panel_${f+1}`, "box",
        [H*w*0.94, sH*0.85, H*0.003],
        [Math.sin(fRad)*H*w*0.51, sY, Math.cos(fRad)*H*w*0.51],
        "steel_dark", [0, f*90, 0]);
    }
  }

  // Horizontal shaft bands (every ~20 segments)
  for (let i = 0; i < 22; i++) {
    const bY = H * (0.04 + i * 0.042);
    if (bY > H * 0.95) break;
    const bW = H * (0.085 - i * 0.0032);
    pushPart(`shaft_hband_${i+1}`, "box",
      [Math.max(bW, H*0.010), H*0.005, Math.max(bW, H*0.010)],
      [0, bY, 0], i % 4 === 0 ? "steel_dark" : "steel_main");
  }

  // 笏笏 Observation deck 1 (350m = 0.5520H for 634m) 笏笏
  const obs1Y = 350 / H;
  pushPart("obs1_slab",       "box", [H*0.105, H*0.018, H*0.105], [0, H*(obs1Y+0.000), 0], "concrete_main");
  pushPart("obs1_glass_ring", "box", [H*0.120, H*0.042, H*0.120], [0, H*(obs1Y+0.018), 0], "glass");
  pushPart("obs1_roof",       "box", [H*0.105, H*0.010, H*0.105], [0, H*(obs1Y+0.040), 0], "steel_main");
  pushPart("obs1_floor_out",  "box", [H*0.130, H*0.008, H*0.130], [0, H*(obs1Y-0.008), 0], "steel_dark");
  // 8 outer columns
  for (let s = 0; s < 8; s++) {
    const sAngle = s * Math.PI / 4;
    pushPart(`obs1_col_${s+1}`, "box", [H*0.010, H*0.052, H*0.010],
      [Math.cos(sAngle)*H*0.060, H*(obs1Y+0.016), Math.sin(sAngle)*H*0.060], "steel_dark");
  }

  // 笏笏 Observation deck 2 (450m = 0.7098H for 634m) 笏笏
  const obs2Y = 450 / H;
  pushPart("obs2_slab",       "box", [H*0.078, H*0.015, H*0.078], [0, H*(obs2Y+0.000), 0], "concrete_main");
  pushPart("obs2_glass_ring", "box", [H*0.090, H*0.036, H*0.090], [0, H*(obs2Y+0.015), 0], "glass");
  pushPart("obs2_roof",       "box", [H*0.078, H*0.008, H*0.078], [0, H*(obs2Y+0.033), 0], "steel_main");
  pushPart("obs2_floor_out",  "box", [H*0.096, H*0.006, H*0.096], [0, H*(obs2Y-0.006), 0], "steel_dark");
  // 8 outer columns
  for (let s = 0; s < 8; s++) {
    const sAngle = s * Math.PI / 4;
    pushPart(`obs2_col_${s+1}`, "box", [H*0.007, H*0.040, H*0.007],
      [Math.cos(sAngle)*H*0.044, H*(obs2Y+0.012), Math.sin(sAngle)*H*0.044], "steel_dark");
  }

  // 笏笏 Spire (above 0.96H) 笏笏
  const spireSegs = [
    [0.960, 0.970, 0.0090], [0.970, 0.978, 0.0070],
    [0.978, 0.985, 0.0054], [0.985, 0.991, 0.0038],
    [0.991, 0.996, 0.0025], [0.996, 1.000, 0.0012],
  ];
  for (let i = 0; i < spireSegs.length; i++) {
    const [y0, y1, w] = spireSegs[i];
    pushPart(`spire_${i+1}`, "box",
      [H*w, H*(y1-y0), H*w], [0, H*(y0+y1)/2, 0], "spire_tip");
  }

  // Lattice diagonal braces along shaft (2 diagonals every 4 shaft sections)
  for (let i = 0; i < shaftSections.length - 1; i += 2) {
    const [y0] = shaftSections[i];
    const [, y1] = shaftSections[i + 1];
    const wMid = shaftSections[i][2];
    const diagH = H * (y1 - y0);
    const diagY = H * (y0 + y1) / 2;
    for (let f = 0; f < 4; f++) {
      const fRad = f * Math.PI / 2;
      const ox = Math.sin(fRad) * H * wMid * 0.50;
      const oz = Math.cos(fRad) * H * wMid * 0.50;
      pushPart(`diag_${i+1}_face_${f+1}`, "box",
        [H*0.004, diagH * 0.95, H*0.004],
        [ox, diagY, oz], "steel_dark", [0, f*90, 15]);
    }
  }

  spec.parts = parts;
  spec.surfaceDetails = [];
  spec.ornaments = [];
  return spec;
}

function buildKaijuSpec(prompt, height, styles) {
  const H = height;
  const base = buildHighDensityMeta(prompt, "kaiju", height, styles);

  const spec = {
    ...base,
    globalScale: { height: H, width: rounded(H * 0.48), depth: rounded(H * 0.75) },
    style: {
      silhouette: "bipedal_prehistoric_kaiju",
      mood: styles.includes("dark") ? "apex_predator" : "primal_titan",
      genre: "kaiju_fantasy",
      detailDensity: "ultra_high",
      bodyLanguage: "prowling_forward_lean",
      shapeLanguage: ["heavy_haunches", "barrel_chest", "forward_jutting_head", "thick_tail", "spine_crests"]
    },
    materials: createBaseMaterials("kaiju", styles),
    parts: [],
    surfaceDetails: [],
    ornaments: [],
    pose: { preset: "prowl", bodyForwardTiltDeg: 15, headForwardTiltDeg: 20, tailAngleDeg: -12 },
    animationHints: { idleBreathScale: 0.012, eyeGlowPulse: true, tailSway: true, dorsalGlowPulse: false },
    lod: { high: "full", medium: "remove_micro_scales", low: "merge_secondary_plates" },
    exportOptions: { formats: ["gltf", "glb"], previewHtml: true }
  };

  const parts = [];
  const surfaceDetails = [];

  const pushPart = (id, kind, size, position, material, rotation = [0, 0, 0]) => {
    parts.push({ id, kind, size: size.map(rounded), position: position.map(rounded), rotation: rotation.map(rounded), material });
  };

  const pushSurface = (id, region, type, strength, offset) => {
    surfaceDetails.push({ id, region, type, strength: rounded(strength), offset: offset.map(rounded) });
  };

  // 笏笏 Core body 笏笏
  pushPart("pelvis",      "box", [H*0.24, H*0.12, H*0.18], [0, H*0.50, 0],         "hide_main");
  pushPart("belly_lower", "box", [H*0.26, H*0.10, H*0.16], [0, H*0.56, H*0.04],    "hide_belly");
  pushPart("torso_mid",   "box", [H*0.28, H*0.12, H*0.18], [0, H*0.62, 0],         "hide_main");
  pushPart("chest",       "box", [H*0.30, H*0.10, H*0.20], [0, H*0.68, H*0.02],    "hide_main");
  pushPart("back_core",   "box", [H*0.22, H*0.20, H*0.10], [0, H*0.60, -H*0.10],   "hide_main");

  // Belly scale plates (6 rows ﾃ・4 cols)
  for (let row = 0; row < 6; row++) {
    for (let col = 0; col < 4; col++) {
      pushPart(
        `belly_scale_${row+1}_${col+1}`, "box",
        [H*0.044, H*0.034, H*0.012],
        [(-0.066 + col * 0.044) * H, H*(0.52 + row * 0.034), H*0.100],
        row % 2 === 0 ? "hide_belly" : "scale_accent"
      );
    }
  }

  // 笏笏 Neck (3 segments, leaning forward) 笏笏
  pushPart("neck_base",  "box", [H*0.14, H*0.06, H*0.14], [0, H*0.72, H*0.02], "hide_main");
  pushPart("neck_mid",   "box", [H*0.12, H*0.06, H*0.12], [0, H*0.77, H*0.04], "hide_main");
  pushPart("neck_upper", "box", [H*0.10, H*0.05, H*0.10], [0, H*0.81, H*0.06], "hide_main");

  // Neck spine plates (5 pairs)
  for (let i = 0; i < 5; i++) {
    for (const sx of [-1, 1]) {
      pushPart(`neck_plate_${sx>0?"r":"l"}_${i+1}`, "box",
        [H*0.028, H*0.018, H*0.010],
        [sx*H*0.055, H*(0.715 + i*0.020), -H*0.055], "scale_dark");
    }
  }

  // 笏笏 Head 笏笏
  pushPart("cranium",      "box", [H*0.18, H*0.10, H*0.16], [0, H*0.87, H*0.06],           "hide_main");
  pushPart("snout",        "box", [H*0.14, H*0.07, H*0.14], [0, H*0.84, H*0.16],           "hide_main");
  pushPart("brow_ridge",   "box", [H*0.16, H*0.025, H*0.04], [0, H*0.90, H*0.09],          "scale_dark");
  pushPart("cheek_left",   "box", [H*0.055, H*0.06, H*0.08], [-H*0.08, H*0.84, H*0.10],   "hide_main");
  pushPart("cheek_right",  "box", [H*0.055, H*0.06, H*0.08], [ H*0.08, H*0.84, H*0.10],   "hide_main");
  pushPart("jaw_upper",    "box", [H*0.12, H*0.03, H*0.12], [0, H*0.815, H*0.15],          "hide_main");
  pushPart("jaw_lower",    "box", [H*0.11, H*0.035, H*0.11], [0, H*0.800, H*0.15],         "hide_belly");
  pushPart("chin",         "box", [H*0.08, H*0.025, H*0.04], [0, H*0.79, H*0.19],          "hide_belly");

  // Eyes (emissive)
  pushPart("eye_left",        "box", [H*0.024, H*0.022, H*0.018], [-H*0.058, H*0.875, H*0.130], "eye_glow");
  pushPart("eye_right",       "box", [H*0.024, H*0.022, H*0.018], [ H*0.058, H*0.875, H*0.130], "eye_glow");
  pushPart("eye_ridge_left",  "box", [H*0.030, H*0.010, H*0.014], [-H*0.058, H*0.890, H*0.130], "scale_dark");
  pushPart("eye_ridge_right", "box", [H*0.030, H*0.010, H*0.014], [ H*0.058, H*0.890, H*0.130], "scale_dark");

  // Head crest (3-segment central horn)
  const crestSegs = [
    { w: 0.030, h: 0.055, oy: 0.925, oz: 0.040, rx: -10 },
    { w: 0.022, h: 0.045, oy: 0.965, oz: 0.020, rx: -20 },
    { w: 0.014, h: 0.035, oy: 0.998, oz: 0.000, rx: -30 },
  ];
  for (let s = 0; s < crestSegs.length; s++) {
    const { w, h, oy, oz, rx } = crestSegs[s];
    pushPart(`head_crest_${s+1}`, "box", [H*w, H*h, H*w], [0, H*oy, H*oz],
      s < 2 ? "dorsal_spine" : "scale_dark", [rx, 0, 0]);
  }
  // Side head horns
  for (const sx of [-1, 1]) {
    pushPart(`head_horn_${sx<0?"left":"right"}`, "box",
      [H*0.018, H*0.048, H*0.018], [sx*H*0.080, H*0.912, H*0.058],
      "dorsal_spine", [0, 0, sx*15]);
  }

  // Upper & lower teeth (6 pairs)
  for (let i = 0; i < 6; i++) {
    const tx = (-0.030 + i * 0.012) * H;
    pushPart(`tooth_upper_${i+1}`, "box", [H*0.008, H*0.022, H*0.010], [tx, H*0.805, H*0.210], "teeth");
    pushPart(`tooth_lower_${i+1}`, "box", [H*0.008, H*0.020, H*0.010], [tx, H*0.784, H*0.210], "teeth");
  }

  // 笏笏 Arms (shorter, hunched forward) 笏笏
  for (const side of ["left", "right"]) {
    const sx = side === "left" ? -1 : 1;
    pushPart(`${side}_shoulder`,  "box", [H*0.08,  H*0.06, H*0.08],  [sx*H*0.185, H*0.680, H*0.02], "hide_main");
    pushPart(`${side}_upper_arm`, "box", [H*0.07,  H*0.14, H*0.07],  [sx*H*0.195, H*0.56,  H*0.04], "hide_main");
    pushPart(`${side}_forearm`,   "box", [H*0.055, H*0.10, H*0.055], [sx*H*0.195, H*0.44,  H*0.06], "scale_dark");
    pushPart(`${side}_hand`,      "box", [H*0.060, H*0.04, H*0.060], [sx*H*0.195, H*0.36,  H*0.08], "hide_main");
    for (let c = 0; c < 3; c++) {
      pushPart(`${side}_claw_${c+1}`, "box", [H*0.010, H*0.038, H*0.010],
        [sx*H*(0.168 + c*0.014), H*0.330, H*(0.10 + c*0.022)],
        "claw", [12, 0, sx*8]);
    }
  }

  // 笏笏 Legs (massive pillars, wide stance) 笏笏
  for (const side of ["left", "right"]) {
    const sx = side === "left" ? -1 : 1;
    pushPart(`${side}_thigh`,     "box", [H*0.12, H*0.22, H*0.12], [sx*H*0.115, H*0.37,   0],       "hide_main");
    pushPart(`${side}_knee_bump`, "box", [H*0.13, H*0.03, H*0.13], [sx*H*0.115, H*0.255,  H*0.010], "scale_dark");
    pushPart(`${side}_shin`,      "box", [H*0.10, H*0.20, H*0.10], [sx*H*0.110, H*0.12,   0],       "hide_main");
    pushPart(`${side}_ankle`,     "box", [H*0.11, H*0.028, H*0.14],[sx*H*0.110, H*0.025,  H*0.015], "scale_dark");
    pushPart(`${side}_foot`,      "box", [H*0.13, H*0.025, H*0.18],[sx*H*0.110, H*0.012,  H*0.040], "hide_main");
    for (let t = 0; t < 3; t++) {
      pushPart(`${side}_toe_claw_${t+1}`, "box", [H*0.020, H*0.016, H*0.040],
        [sx*H*(0.080 + t*0.022), H*0.008, H*(0.115 + t*0.008)], "claw", [10, 0, 0]);
    }
    // Shin scale bands (20 horizontal)
    for (let i = 0; i < 20; i++) {
      pushPart(`${side}_shin_band_${i+1}`, "box", [H*0.105, H*0.003, H*0.105],
        [sx*H*0.110, H*(0.04 + i*0.009), 0],
        i % 2 === 0 ? "scale_dark" : "scale_accent");
    }
    // Thigh scale bands (16 horizontal)
    for (let i = 0; i < 16; i++) {
      pushPart(`${side}_thigh_band_${i+1}`, "box", [H*0.125, H*0.003, H*0.125],
        [sx*H*0.115, H*(0.275 + i*0.010), 0],
        i % 2 === 0 ? "scale_dark" : "scale_accent");
    }
  }

  // 笏笏 Tail (15 tapering segments going backward + slightly down) 笏笏
  for (let i = 0; i < 15; i++) {
    const t = i / 14;
    pushPart(`tail_${i+1}`, "box",
      [H*(0.16 - t*0.13), H*(0.12 - t*0.10), H*0.048],
      [0, H*(0.49 - t*0.32), -H*(0.10 + i*0.048)],
      i % 3 === 0 ? "scale_dark" : "hide_main");
  }

  // 笏笏 Dorsal spines (12, largest mid-back, tapering toward tail) 笏笏
  const spineData = [
    [0.780, -0.065, 0.025, 0.012], [0.740, -0.075, 0.040, 0.016],
    [0.700, -0.082, 0.055, 0.020], [0.660, -0.088, 0.065, 0.022],
    [0.625, -0.092, 0.070, 0.022], [0.590, -0.096, 0.068, 0.020],
    [0.555, -0.098, 0.058, 0.018], [0.520, -0.098, 0.048, 0.016],
    [0.480, -0.140, 0.040, 0.014], [0.440, -0.188, 0.032, 0.012],
    [0.390, -0.236, 0.024, 0.010], [0.340, -0.284, 0.018, 0.008],
  ];
  for (let i = 0; i < spineData.length; i++) {
    const [sy, sz, sh, sd] = spineData[i];
    const spineH = H*sh, spineW = H*0.010, spineD = H*sd;
    const spineY = H*sy, spineZ = H*sz;
    const mat = i < 6 ? "dorsal_spine" : "scale_dark";
    pushPart(`dorsal_${i+1}`,     "box", [spineW, spineH, spineD], [0, spineY, spineZ], mat);
    pushPart(`dorsal_tip_${i+1}`, "box", [spineW*0.4, spineH*0.35, spineD*0.5],
      [0, spineY + spineH*0.60, spineZ], "scale_dark");
  }

  // Back scale rows (8 rows ﾃ・6 cols)
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 6; col++) {
      pushPart(`back_scale_${row+1}_${col+1}`, "box",
        [H*0.024, H*0.018, H*0.012],
        [(-0.06 + col * 0.024) * H, H*(0.54 + row*0.020), -H*0.100],
        col % 2 === 0 ? "scale_dark" : "scale_accent");
    }
  }

  // Surface detail metadata
  const regions = ["head", "neck", "chest", "belly", "back", "left_arm", "right_arm", "left_leg", "right_leg", "tail"];
  const detailTypes = ["scale_ridge", "battle_scar", "skin_fold", "erosion", "plate_seam"];
  let sdIndex = 1;
  for (const region of regions) {
    for (let i = 0; i < 14; i++) {
      pushSurface(`surface_detail_${sdIndex++}`, region,
        detailTypes[i % detailTypes.length],
        0.2 + (i % 6) * 0.08,
        [Math.sin(i)*0.025, Math.cos(i*0.8)*0.018, ((i%5)-2)*0.012]);
    }
  }

  spec.parts = parts;
  spec.surfaceDetails = surfaceDetails;
  spec.ornaments = [];
  return spec;
}

function buildAirshipSpec(prompt, height, styles) {
  // height = ship LENGTH along Z-axis (default 80m)
  const H = height;
  const base = buildHighDensityMeta(prompt, "airship", height, styles);
  const dark = styles.includes("dark");

  const spec = {
    ...base,
    globalScale: { length: H, width: rounded(H * 0.28), height: rounded(H * 0.55) },
    style: {
      silhouette: "elongated_hull_with_balloon_envelope",
      mood: dark ? "ominous_corsair" : "adventurous_sky_vessel",
      genre: "fantasy_steampunk",
      detailDensity: "ultra_high",
      orientation: "Z_axis_fore_to_aft",
      shapeLanguage: ["billowing_envelope", "wooden_galleon_hull", "brass_fittings", "canvas_sails", "rope_rigging", "cannon_ports"]
    },
    materials: createBaseMaterials("airship", styles)
  };

  const parts = [];
  const surfaceDetails = [];

  function box(id, material, sx, sy, sz, px, py, pz) {
    parts.push({
      id, kind: "box", material,
      size: [rounded(sx), rounded(sy), rounded(sz)],
      position: [rounded(px), rounded(py), rounded(pz)]
    });
  }
  function pushSurface(id, region, type, scale, offset) {
    surfaceDetails.push({ id, region, type, scale, offset });
  }

  // 笏笏 GAS ENVELOPE 笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏
  const envY = H * 0.32;
  box("balloon_main",        "canvas_main",   H*0.26, H*0.20, H*0.72, 0,         envY, 0);
  box("balloon_fore",        "canvas_accent", H*0.20, H*0.16, H*0.10, 0,         envY, H*0.39);
  box("balloon_aft",         "canvas_dark",   H*0.18, H*0.14, H*0.09, 0,         envY, -H*0.39);
  box("balloon_fore_tip",    "canvas_main",   H*0.10, H*0.09, H*0.06, 0,         envY, H*0.44);
  box("balloon_aft_tip",     "canvas_dark",   H*0.08, H*0.07, H*0.05, 0,         envY, -H*0.44);
  box("balloon_top_ridge",   "canvas_sail",   H*0.030, H*0.030, H*0.68, 0, envY + H*0.115, 0);
  box("balloon_bottom_keel", "canvas_dark",   H*0.040, H*0.025, H*0.60, 0, envY - H*0.112, 0);

  // Envelope ribs
  for (let i = 0; i < 8; i++) {
    const z = -H * 0.35 + i * H * 0.10;
    box(`balloon_rib_${i+1}`, "brass", H*0.27, H*0.018, H*0.018, 0, envY, rounded(z));
  }

  // Balloon side color panels
  for (let i = 0; i < 4; i++) {
    const z = -H*0.28 + i * H * 0.19;
    const col = i % 2 === 0 ? "canvas_accent" : "canvas_sail";
    box(`balloon_panel_L${i+1}`, col, H*0.006, H*0.16, H*0.18, -H*0.130, envY, rounded(z));
    box(`balloon_panel_R${i+1}`, col, H*0.006, H*0.16, H*0.18,  H*0.130, envY, rounded(z));
  }

  // 笏笏 HULL / GONDOLA 笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏
  const hullY = H * 0.10;
  box("hull_main",  "wood_main",  H*0.15, H*0.09, H*0.58, 0, hullY, 0);
  box("hull_prow",  "wood_dark",  H*0.09, H*0.07, H*0.12, 0, hullY, H*0.34);
  box("hull_stern", "wood_dark",  H*0.12, H*0.08, H*0.10, 0, hullY, -H*0.33);
  box("hull_keel",  "wood_dark",  H*0.030, H*0.04, H*0.56, 0, H*0.055, 0);
  box("hull_deck",  "wood_deck",  H*0.14, H*0.012, H*0.55, 0, hullY + H*0.051, 0);

  // Side planks (4 per side)
  for (let i = 0; i < 4; i++) {
    const z = -H * 0.22 + i * H * 0.15;
    box(`plank_L${i+1}`, "wood_main", H*0.006, H*0.07, H*0.13, -H*0.076, hullY + H*0.012*(i%3-1), rounded(z));
    box(`plank_R${i+1}`, "wood_main", H*0.006, H*0.07, H*0.13,  H*0.076, hullY + H*0.012*(i%3-1), rounded(z));
  }

  // Cannon ports (3 per side)
  for (let i = 0; i < 3; i++) {
    const z = -H * 0.18 + i * H * 0.185;
    box(`cannon_L${i+1}`, "cannon_iron", H*0.04, H*0.03, H*0.03, -H*0.090, hullY, rounded(z));
    box(`cannon_R${i+1}`, "cannon_iron", H*0.04, H*0.03, H*0.03,  H*0.090, hullY, rounded(z));
  }

  // Ballast tanks
  box("ballast_L", "brass", H*0.04, H*0.03, H*0.15, -H*0.085, H*0.045, 0);
  box("ballast_R", "brass", H*0.04, H*0.03, H*0.15,  H*0.085, H*0.045, 0);

  // 笏笏 SUSPENSION STRAPS 笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏
  const deckTop = hullY + H * 0.051;
  const strapH  = envY - deckTop;
  const strapMidY = deckTop + strapH * 0.5;
  box("strap_fore_L", "rope", H*0.012, rounded(strapH), H*0.012, -H*0.065, strapMidY,  H*0.22);
  box("strap_fore_R", "rope", H*0.012, rounded(strapH), H*0.012,  H*0.065, strapMidY,  H*0.22);
  box("strap_aft_L",  "rope", H*0.012, rounded(strapH), H*0.012, -H*0.065, strapMidY, -H*0.22);
  box("strap_aft_R",  "rope", H*0.012, rounded(strapH), H*0.012,  H*0.065, strapMidY, -H*0.22);

  // 笏笏 ENGINE PODS + PROPELLERS 笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏
  const podZ = -H * 0.28;
  const podY = hullY + H * 0.005;
  box("pod_L", "brass",       H*0.040, H*0.040, H*0.10, -H*0.115, podY, rounded(podZ));
  box("pod_R", "brass",       H*0.040, H*0.040, H*0.10,  H*0.115, podY, rounded(podZ));
  box("hub_L", "cannon_iron", H*0.025, H*0.025, H*0.018, -H*0.115, podY, rounded(podZ - H*0.06));
  box("hub_R", "cannon_iron", H*0.025, H*0.025, H*0.018,  H*0.115, podY, rounded(podZ - H*0.06));

  // 4 blades per propeller (cross pattern)
  const bladeOffsets = [[0, H*0.055, 0], [0, -H*0.055, 0], [H*0.055, 0, 0], [-H*0.055, 0, 0]];
  for (let i = 0; i < 4; i++) {
    const [bx, by] = bladeOffsets[i];
    box(`blade_L${i+1}`, "wood_dark", H*0.012, H*0.090, H*0.012, -H*0.115 + bx, podY + by, rounded(podZ - H*0.06));
    box(`blade_R${i+1}`, "wood_dark", H*0.012, H*0.090, H*0.012,  H*0.115 + bx, podY + by, rounded(podZ - H*0.06));
  }

  // 笏笏 MASTS + SAILS 笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏
  const mastBaseY = deckTop;

  // Fore mast
  const mastFH = H * 0.28;
  box("mast_fore",   "wood_dark",  H*0.018, mastFH,   H*0.018,  0,  mastBaseY + mastFH*0.5,  H*0.18);
  box("yard_fore",   "wood_dark",  H*0.22,  H*0.012,  H*0.012,  0,  mastBaseY + mastFH*0.82, H*0.18);
  box("sail_fore",   "canvas_sail",H*0.18,  H*0.14,   H*0.008,  0,  mastBaseY + mastFH*0.65, H*0.18);
  box("flag_fore",   "gilded",     H*0.04,  H*0.025,  H*0.004,  0,  mastBaseY + mastFH + H*0.008, H*0.18);
  box("crow_nest",   "wood_deck",  H*0.06,  H*0.020,  H*0.06,   0,  mastBaseY + mastFH*0.72, H*0.18);

  // Aft mast
  const mastAH = H * 0.22;
  box("mast_aft",    "wood_dark",  H*0.015, mastAH,   H*0.015,  0,  mastBaseY + mastAH*0.5,  -H*0.10);
  box("yard_aft",    "wood_dark",  H*0.17,  H*0.010,  H*0.010,  0,  mastBaseY + mastAH*0.80, -H*0.10);
  box("sail_aft",    "canvas_sail",H*0.14,  H*0.11,   H*0.006,  0,  mastBaseY + mastAH*0.62, -H*0.10);
  box("flag_aft",    "gilded",     H*0.03,  H*0.020,  H*0.003,  0,  mastBaseY + mastAH + H*0.006, -H*0.10);

  // 笏笏 STERN FINS + RUDDER 笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏
  box("rudder",      "wood_dark",  H*0.012, H*0.12,   H*0.10,   0,  hullY + H*0.025, -H*0.41);
  box("fin_port",    "canvas_dark",H*0.10,  H*0.08,   H*0.12,  -H*0.12, envY - H*0.08, -H*0.38);
  box("fin_stbd",    "canvas_dark",H*0.10,  H*0.08,   H*0.12,   H*0.12, envY - H*0.08, -H*0.38);
  box("fin_top",     "canvas_dark",H*0.012, H*0.12,   H*0.12,   0,  envY + H*0.07,   -H*0.38);

  // Helm
  box("helm_post",   "wood_dark",  H*0.012, H*0.06,   H*0.012,  0,  deckTop + H*0.040, -H*0.20);
  box("helm_wheel",  "brass",      H*0.06,  H*0.06,   H*0.008,  0,  deckTop + H*0.072, -H*0.20);

  // 笏笏 PROW DETAILS 笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏
  box("figurehead",  "gilded",     H*0.030, H*0.060,  H*0.04,   0,  hullY + H*0.040, H*0.42);
  box("prow_lantern","gilded",     H*0.020, H*0.025,  H*0.02,   0,  hullY + H*0.058, H*0.39);
  box("railing_bow_L","brass",     H*0.005, H*0.025,  H*0.15,  -H*0.070, deckTop, H*0.28);
  box("railing_bow_R","brass",     H*0.005, H*0.025,  H*0.15,   H*0.070, deckTop, H*0.28);
  box("railing_aft_L","brass",     H*0.005, H*0.025,  H*0.10,  -H*0.060, deckTop, -H*0.26);
  box("railing_aft_R","brass",     H*0.005, H*0.025,  H*0.10,   H*0.060, deckTop, -H*0.26);

  // 笏笏 DECK ACCESSORIES 笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏
  box("rope_coil_1", "rope",       H*0.040, H*0.018,  H*0.040, -H*0.050, deckTop,  H*0.12);
  box("rope_coil_2", "rope",       H*0.040, H*0.018,  H*0.040,  H*0.050, deckTop,  H*0.12);
  box("rope_coil_3", "rope",       H*0.040, H*0.018,  H*0.040, -H*0.050, deckTop, -H*0.05);
  box("rope_coil_4", "rope",       H*0.040, H*0.018,  H*0.040,  H*0.050, deckTop, -H*0.05);
  box("hatch_fore",  "wood_deck",  H*0.050, H*0.008,  H*0.050,  0,  deckTop,  H*0.08);
  box("hatch_aft",   "wood_deck",  H*0.050, H*0.008,  H*0.050,  0,  deckTop, -H*0.12);
  box("anchor_L",    "cannon_iron",H*0.030, H*0.040,  H*0.020, -H*0.080, H*0.030, H*0.30);
  box("anchor_R",    "cannon_iron",H*0.030, H*0.040,  H*0.020,  H*0.080, H*0.030, H*0.30);

  // Rigging ropes (4 diagonal lines fore and aft of each mast)
  for (let i = 0; i < 4; i++) {
    const side = i < 2 ? -1 : 1;
    const z = i % 2 === 0 ? H*0.25 : H*0.12;
    box(`rigging_${i+1}`, "rope", H*0.006, H*0.24, H*0.006, side * H*0.080, deckTop + H*0.12, rounded(z));
  }

  // Surface detail metadata
  const regions = ["balloon_top", "balloon_sides", "hull_port", "hull_starboard", "hull_fore", "hull_aft", "deck"];
  const detailTypes = ["canvas_stitch", "plank_grain", "rope_weave", "brass_rivet", "paint_wear", "rope_knot", "barnacle"];
  let sdIndex = 1;
  for (const region of regions) {
    for (let i = 0; i < 8; i++) {
      pushSurface(`surface_detail_${sdIndex++}`, region,
        detailTypes[i % detailTypes.length],
        0.15 + (i % 5) * 0.06,
        [Math.sin(i) * 0.020, Math.cos(i * 0.9) * 0.015, ((i % 4) - 1.5) * 0.010]);
    }
  }

  spec.parts = parts;
  spec.surfaceDetails = surfaceDetails;
  spec.ornaments = [];
  return spec;
}

function classifyBuildingArchetype(prompt) {
  if (/(\b1\b|single|one)[-\s]?(story|floor)|\u5e73\u5c4b|\u6238\u5efa/u.test(prompt)) return "house_single";
  if (/2[-\s]?(story|floor)|\u4e8c\u968e\u5efa|\u0032\u968e\u5efa/u.test(prompt) && /apartment|\u30a2\u30d1\u30fc\u30c8/u.test(prompt)) return "apartment_2f";
  if (/2[-\s]?(story|floor)|\u4e8c\u968e\u5efa|\u0032\u968e\u5efa/u.test(prompt)) return "house_2f";
  if (/3[-\s]?(story|floor)|\u4e09\u968e\u5efa|\u0033\u968e\u5efa/u.test(prompt)) return "house_3f";
  if (/japanese|traditional|washitsu|\u548c\u98a8|\u548c\u5f0f/u.test(prompt) && /house|\u4f4f\u5b85|\u6238\u5efa/u.test(prompt)) return "house_jp";
  if (/western|\u6d0b\u98a8/u.test(prompt) && /house|\u4f4f\u5b85|\u6238\u5efa/u.test(prompt)) return "house_western";
  if (/family.*mansion|family.*condo|\u30d5\u30a1\u30df\u30ea\u30fc.*\u30de\u30f3\u30b7\u30e7\u30f3/u.test(prompt)) return "mansion_family";
  if (/\u5927\u90b8\u5b85|mansion|estate|villa/u.test(prompt)) return "mansion_estate";
  if (/apartment|\u30a2\u30d1\u30fc\u30c8/u.test(prompt)) return "apartment_mid";
  if (/campus|university|college|\u5927\u5b66|\u30ad\u30e3\u30f3\u30d1\u30b9|\u6821\u820e/iu.test(prompt)) return "campus";
  return "building_generic";
}

function classifyRoadVehicleType(prompt) {
  if (/patrol|police.?car|\u30d1\u30c8\u30ab\u30fc|\u8b66\u5bdf\u8eca/iu.test(prompt)) return "patrol";
  if (/taxi|\u30bf\u30af\u30b7\u30fc/iu.test(prompt)) return "taxi";
  if (/sports.?car|super.?car|\u30b9\u30dd\u30fc\u30c4\u30ab\u30fc/iu.test(prompt)) return "sport";
  if (/kei|mini.?car|compact|\u8efd\u81ea\u52d5\u8eca/iu.test(prompt)) return "kei";
  if (/truck|\u30c8\u30e9\u30c3\u30af/iu.test(prompt)) return "truck";
  return "sedan";
}

function classifyCastleArchetype(prompt, styles) {
  if (/crystal|\u30af\u30ea\u30b9\u30bf\u30eb/iu.test(prompt)) return "crystal_tower";
  if (/demon|maou|evil|\u9b54\u738b/iu.test(prompt) || styles.includes("demonic")) return "demon_castle";
  if (/cinderella|fairy.?tale|\u30b7\u30f3\u30c7\u30ec\u30e9|\u7ae5\u8a71/iu.test(prompt) || styles.includes("fairy_tale")) return "cinderella_castle";
  if (/japanese|samurai|\u65e5\u672c\u98a8|\u548c\u98a8|\u5929\u5b88\u95a3/iu.test(prompt)) return "japanese_castle";
  return "classic_castle";
}

function classifyStructureType(prompt) {
  if (/tree|\u6728|\u6a39/iu.test(prompt)) return "tree";
  if (/traffic.?signal|signal|\u4fe1\u53f7/iu.test(prompt)) return "traffic_signal";
  if (/pedestrian.?bridge|footbridge|\u6b69\u9053\u6a4b/iu.test(prompt)) return "pedestrian_bridge";
  if (/bridge|\u6a4b/iu.test(prompt)) return "bridge";
  if (/data.?center|\u30c7\u30fc\u30bf\u30bb\u30f3\u30bf\u30fc/iu.test(prompt)) return "data_center";
  if (/theme.?park|\u30c6\u30fc\u30de\u30d1\u30fc\u30af/iu.test(prompt)) return "theme_park";
  if (/power.?plant|\u767a\u96fb\u6240/iu.test(prompt)) return "power_plant";
  if (/rocket.?base|\u30ed\u30b1\u30c3\u30c8\u57fa\u5730/iu.test(prompt)) return "rocket_base";
  return "tower_misc";
}

function buildBuildingSpec(prompt, height, styles) {
  const H = height;
  const base = buildHighDensityMeta(prompt, "building", height, styles);
  const archetype = classifyBuildingArchetype(prompt);

  const dimsByType = {
    house_single:  { w: 0.85, d: 0.70, body: 0.64, roof: 0.30 },
    house_2f:      { w: 0.72, d: 0.60, body: 0.72, roof: 0.24 },
    house_3f:      { w: 0.62, d: 0.52, body: 0.78, roof: 0.18 },
    house_jp:      { w: 0.80, d: 0.66, body: 0.66, roof: 0.30 },
    house_western: { w: 0.74, d: 0.62, body: 0.70, roof: 0.26 },
    apartment_2f:  { w: 0.96, d: 0.42, body: 0.76, roof: 0.18 },
    apartment_mid: { w: 0.72, d: 0.44, body: 0.82, roof: 0.14 },
    mansion_family:{ w: 0.90, d: 0.50, body: 0.82, roof: 0.14 },
    mansion_estate:{ w: 1.10, d: 0.72, body: 0.72, roof: 0.22 },
    building_generic:{ w: 0.48, d: 0.40, body: 0.80, roof: 0.14 },
    campus:          { w: 5.60, d: 4.40, body: 0.78, roof: 0.04 }
  };
  const d = dimsByType[archetype] || dimsByType.building_generic;

  const width = rounded(H * d.w);
  const depth = rounded(H * d.d);
  const bodyHeight = H * d.body;
  const roofHeight = H * d.roof;
  const baseHeight = H - bodyHeight - roofHeight;

  const spec = {
    ...base,
    promptInterpretation: {
      ...base.promptInterpretation,
      buildingArchetype: archetype,
    },
    globalScale: { height: H, width, depth },
    style: {
      silhouette: archetype === "campus" ? "campus_complex" : archetype.includes("house") ? "residential_mass" : archetype.includes("mansion") ? "grand_residential_mass" : "multi_unit_or_civic_mass",
      mood: archetype === "campus" ? "academic" : styles.includes("dark") ? "dramatic_urban" : "inhabited",
      genre: archetype === "campus" ? "academic_campus" : archetype.includes("jp") ? "japanese_residential" : "residential_architecture",
      detailDensity: "high",
      bodyLanguage: "static_structure",
      shapeLanguage: ["main_volume", "roof_profile", "entrance", "window_rhythm"]
    },
    materials: createBaseMaterials("building", styles),
    parts: [],
    surfaceDetails: [],
    ornaments: [],
    pose: { preset: "static" },
    animationHints: {},
    lod: { high: "full", medium: "reduce_window_bands", low: "merge_facade_layers" },
    exportOptions: { formats: ["gltf", "glb"], previewHtml: true }
  };

  const parts = [];
  const surfaceDetails = [];
  const box = (id, material, sx, sy, sz, px, py, pz) => {
    parts.push({ id, kind: "box", material, size: [rounded(sx), rounded(sy), rounded(sz)], position: [rounded(px), rounded(py), rounded(pz)] });
  };
  const shape = (id, kind, material, sx, sy, sz, px, py, pz) => {
    parts.push({ id, kind, material, size: [rounded(sx), rounded(sy), rounded(sz)], position: [rounded(px), rounded(py), rounded(pz)] });
  };
  const pushSurface = (id, region, type, strength, offset) => {
    surfaceDetails.push({ id, region, type, strength: rounded(strength), offset: offset.map(rounded) });
  };

  // ── Campus archetype: multi-building layout (early return) ─────────────────
  if (archetype === "campus") {
    spec.materials = {
      facade_main:      { baseColor: "#C8C4B8", roughness: 0.88, metalness: 0.04 },
      facade_secondary: { baseColor: "#8A8680", roughness: 0.90, metalness: 0.03 },
      roof:             { baseColor: "#4A4840", roughness: 0.82, metalness: 0.10 },
      glass:            { baseColor: "#7BAED6", roughness: 0.12, metalness: 0.88 },
      frame:            { baseColor: "#C0BC90", roughness: 0.90, metalness: 0.02 },
      accent:           { baseColor: "#3A6A30", roughness: 0.90, metalness: 0.02 },
    };

    // Ground
    box("campus_ground",    "facade_secondary", H*5.5,  H*0.03, H*4.4,  0,         0,      0);
    // Pathways
    box("path_main_NS",     "frame",            H*0.28, H*0.02, H*2.60, 0,         H*0.02, 0);
    box("path_EW_front",    "frame",            H*3.00, H*0.02, H*0.28, 0,         H*0.02, H*0.50);
    box("path_EW_mid",      "frame",            H*3.00, H*0.02, H*0.28, 0,         H*0.02, -H*0.50);
    box("path_plaza_N",     "frame",            H*0.28, H*0.02, H*0.60, 0,         H*0.02, H*1.40);
    // Central plaza
    box("central_plaza",    "facade_main",      H*1.90, H*0.04, H*1.40, 0,         H*0.03, H*0.75);

    // ── Main Hall (center-front, classical facade) ──────────────────────
    box("main_hall_body",   "facade_main",      H*1.60, H*0.38, H*0.50, 0,         H*0.19, H*1.05);
    box("main_hall_roof",   "roof",             H*1.68, H*0.06, H*0.56, 0,         H*0.40, H*1.05);
    shape("main_pediment",  "tri_prism", "facade_main", H*1.56, H*0.12, H*0.14,   0,         H*0.43, H*1.30);
    box("main_door",        "glass",            H*0.22, H*0.14, H*0.04, 0,         H*0.07, H*1.305);
    for (let ci = -3; ci <= 3; ci++) {
      shape(`column_${ci+4}`, "cylinder", "facade_secondary", H*0.04, H*0.28, H*0.04, ci*H*0.18, H*0.14, H*1.295);
    }

    // ── Clock Tower (left of main hall) ────────────────────────────────
    box("clock_tower_body", "facade_secondary", H*0.28, H*0.65, H*0.28, -H*1.10, H*0.325, H*1.05);
    box("clock_face_S",     "glass",            H*0.20, H*0.18, H*0.02, -H*1.10, H*0.60,  H*1.20);
    box("clock_face_N",     "glass",            H*0.20, H*0.18, H*0.02, -H*1.10, H*0.60,  H*0.90);
    box("clock_belfry",     "roof",             H*0.24, H*0.10, H*0.24, -H*1.10, H*0.70,  H*1.05);
    shape("clock_spire",    "tri_prism", "facade_secondary", H*0.16, H*0.20, H*0.16, -H*1.10, H*0.78, H*1.05);

    // ── Library (right side, modern flat) ──────────────────────────────
    box("library_body",     "facade_main",      H*0.92, H*0.26, H*0.72, H*1.30, H*0.13, H*0.55);
    box("library_glass_f",  "glass",            H*0.82, H*0.20, H*0.04, H*1.30, H*0.13, H*0.92);
    shape("library_roof",   "tri_prism", "roof", H*0.96, H*0.10, H*0.76, H*1.30, H*0.28, H*0.55);
    box("library_entrance", "frame",            H*0.24, H*0.10, H*0.06, H*1.30, H*0.05, H*0.925);

    // ── Science Hall (left rear, multi-story) ───────────────────────────
    box("science_body",     "facade_secondary", H*0.70, H*0.30, H*0.55, -H*1.40, H*0.15, -H*0.40);
    box("science_roof",     "roof",             H*0.74, H*0.05, H*0.58, -H*1.40, H*0.32, -H*0.40);
    box("science_glass",    "glass",            H*0.62, H*0.22, H*0.04, -H*1.40, H*0.14, -H*0.12);
    box("science_annex",    "facade_main",      H*0.30, H*0.22, H*0.40, -H*1.58, H*0.11, -H*0.76);

    // ── Gymnasium (rear center, barrel vault roof) ──────────────────────
    box("gym_body",         "facade_main",      H*1.20, H*0.18, H*0.80, 0,       H*0.09, -H*1.50);
    shape("gym_vault",      "cylinder", "roof",  H*1.22, H*0.22, H*0.22, 0,       H*0.20, -H*1.50);

    // ── Cafeteria (right rear) ──────────────────────────────────────────
    box("cafe_body",        "facade_secondary", H*0.64, H*0.18, H*0.50, H*1.20, H*0.09, -H*0.90);
    shape("cafe_roof",      "tri_prism", "roof", H*0.68, H*0.14, H*0.54, H*1.20, H*0.21, -H*0.90);
    box("cafe_terrace",     "facade_main",      H*0.60, H*0.05, H*0.18, H*1.20, H*0.02, -H*0.64);

    // ── Classroom blocks ────────────────────────────────────────────────
    box("class_A_body",     "facade_main",      H*0.44, H*0.22, H*0.34, -H*0.80, H*0.11, -H*0.80);
    box("class_A_roof",     "roof",             H*0.46, H*0.05, H*0.36, -H*0.80, H*0.23, -H*0.80);
    box("class_B_body",     "facade_main",      H*0.44, H*0.22, H*0.34, -H*0.80, H*0.11, -H*1.20);
    box("class_B_roof",     "roof",             H*0.46, H*0.05, H*0.36, -H*0.80, H*0.23, -H*1.20);
    box("class_C_body",     "facade_secondary", H*0.44, H*0.20, H*0.34, H*0.56,  H*0.10, -H*1.30);
    box("class_C_roof",     "roof",             H*0.46, H*0.04, H*0.36, H*0.56,  H*0.22, -H*1.30);

    // ── Trees ───────────────────────────────────────────────────────────
    const treePlots = [
      [-0.42, 1.42], [0.42, 1.42],
      [-0.88, 1.28], [0.88, 1.28],
      [-0.50, 0.30], [0.50, 0.30],
      [-0.50,-0.30], [0.50,-0.30],
    ];
    treePlots.forEach(([tx, tz], i) => {
      box(`trunk_${i}`,  "frame",  H*0.03, H*0.12, H*0.03, tx*H, H*0.06, tz*H);
      shape(`canopy_${i}`, "sphere", "accent", H*0.16, H*0.16, H*0.16, tx*H, H*0.20, tz*H);
    });

    // Surface details
    const campusRegions = ["facade", "roof", "path", "plaza"];
    const detailTypes = ["panel_seam", "window_grid", "weathering", "trim_line"];
    let sdIdx = 1;
    for (const rgn of campusRegions) {
      for (let i = 0; i < 10; i++) {
        pushSurface(`surface_detail_${sdIdx++}`, rgn, detailTypes[i % detailTypes.length],
          0.16 + (i % 5) * 0.05,
          [Math.sin(i*0.7)*0.02, Math.cos(i*0.6)*0.016, ((i%4)-1.5)*0.012]);
      }
    }
    spec.parts = parts;
    spec.surfaceDetails = surfaceDetails;
    return spec;
  }

  // ── Generic building geometry ───────────────────────────────────────────────
  box("base", "facade_secondary", width * 1.04, baseHeight, depth * 1.04, 0, baseHeight * 0.5, 0);
  box("body", "facade_main", width, bodyHeight, depth, 0, baseHeight + bodyHeight * 0.5, 0);

  if (archetype === "house_jp") {
    box("engawa", "wood_main", width * 0.96, baseHeight * 0.18, depth * 1.08, 0, baseHeight * 0.60, 0);
    box("roof_lower", "roof", width * 1.10, roofHeight * 0.35, depth * 1.10, 0, H - roofHeight * 0.52, 0);
    box("roof_upper", "roof", width * 0.78, roofHeight * 0.30, depth * 0.78, 0, H - roofHeight * 0.24, 0);
  } else if (archetype === "house_western") {
    shape("gable_core", "tri_prism", "roof", width * 0.92, roofHeight * 0.44, depth * 0.90, 0, H - roofHeight * 0.44, 0);
    shape("chimney", "cylinder", "facade_secondary", width * 0.08, roofHeight * 0.45, depth * 0.08, width * 0.28, H - roofHeight * 0.45, 0);
  } else if (archetype === "mansion_estate") {
    box("left_wing", "facade_main", width * 0.28, bodyHeight * 0.72, depth * 0.52, -width * 0.38, baseHeight + bodyHeight * 0.40, 0);
    box("right_wing", "facade_main", width * 0.28, bodyHeight * 0.72, depth * 0.52, width * 0.38, baseHeight + bodyHeight * 0.40, 0);
    box("grand_roof", "roof", width * 0.96, roofHeight * 0.56, depth * 0.88, 0, H - roofHeight * 0.42, 0);
  } else if (archetype === "apartment_2f" || archetype === "apartment_mid") {
    box("corridor", "facade_secondary", width * 0.98, bodyHeight * 0.14, depth * 0.14, 0, baseHeight + bodyHeight * 0.18, depth * 0.44);
    box("roof", "roof", width * 0.96, roofHeight * 0.62, depth * 0.92, 0, H - roofHeight * 0.50, 0);
  } else {
    shape("roof", "tri_prism", "roof", width * 0.96, roofHeight * 0.62, depth * 0.92, 0, H - roofHeight * 0.50, 0);
  }

  const floors = Math.max(2, Math.min(18, Math.round(bodyHeight / 3.2)));
  for (let i = 0; i < floors; i++) {
    const y = baseHeight + (i + 0.5) * (bodyHeight / floors);
    box(`band_${i + 1}`, "facade_secondary", width * 0.98, bodyHeight / floors * 0.12, depth * 1.01, 0, y, 0);
    if (i % 2 === 0) {
      box(`win_front_${i + 1}`, "glass", width * 0.84, bodyHeight / floors * 0.32, depth * 0.03, 0, y, depth * 0.50);
      box(`win_back_${i + 1}`, "glass", width * 0.84, bodyHeight / floors * 0.32, depth * 0.03, 0, y, -depth * 0.50);
    }
  }

  box("entrance", "accent", width * 0.28, baseHeight * 0.42, depth * 0.12, 0, baseHeight * 0.34, depth * 0.56);

  const regions = ["facade", "roof", "entrance", "base"];
  const detailTypes = ["panel_seam", "window_grid", "weathering", "trim_line"];
  let sdIndex = 1;
  for (const region of regions) {
    for (let i = 0; i < 10; i++) {
      pushSurface(`surface_detail_${sdIndex++}`, region, detailTypes[i % detailTypes.length], 0.16 + (i % 5) * 0.05, [Math.sin(i * 0.7) * 0.02, Math.cos(i * 0.6) * 0.016, ((i % 4) - 1.5) * 0.012]);
    }
  }

  spec.parts = parts;
  spec.surfaceDetails = surfaceDetails;
  return spec;
}
function buildVehicleSpec(prompt, height, styles) {
  const H = height;
  const base = buildHighDensityMeta(prompt, "vehicle", height, styles);
  const isRail = /train|rail|metro|subway|tram|\u96fb\u8eca|\u5217\u8eca|\u5c71\u624b\u7dda|\u65b0\u5e79\u7dda|\u5730\u4e0b\u9244/iu.test(prompt);
  const isAir = /airplane|plane|aircraft|jet|helicopter|shuttle|spacecraft|orbiter|\u98db\u884c\u6a5f|\u30d8\u30ea\u30b3\u30d7\u30bf\u30fc|\u30b7\u30e3\u30c8\u30eb|\u30b9\u30da\u30fc\u30b9\u30b7\u30e3\u30c8\u30eb/iu.test(prompt);
  const isMarine = /ship|boat|ferry|yacht|submarine|\u8239|\u6f5c\u6c34\u8266/iu.test(prompt);
  const vehicleClass = isRail ? "rail" : isAir ? "air" : isMarine ? "marine" : "road";
  const roadType = vehicleClass === "road" ? classifyRoadVehicleType(prompt) : null;
  styles._prompt = prompt;
  const isShinkansen = /shinkansen|\u65b0\u5e79\u7dda|\u306e\u305e\u307f|\u306f\u3084\u3076\u3055|\u3072\u304b\u308a|\u3053\u3060\u307e|N700|bullet.?train/iu.test(prompt);

  const dimensionsByClass = {
    rail: { width: rounded(H * 0.18), depth: rounded(H * 0.96), height: rounded(H * 0.22) },
    air: { width: rounded(H * 0.78), depth: rounded(H * 1.00), height: rounded(H * 0.24) },
    marine: { width: rounded(H * 0.30), depth: rounded(H * 1.00), height: rounded(H * 0.34) },
    road: { width: rounded(H * 0.34), depth: rounded(H * 0.82), height: rounded(H * 0.30) }
  };
  const dims = dimensionsByClass[vehicleClass];

  const spec = {
    ...base,
    promptInterpretation: {
      ...base.promptInterpretation,
      vehicleClass,
      roadType
    },
    globalScale: { height: dims.height, width: dims.width, depth: dims.depth, referenceLength: H },
    style: {
      silhouette: `${vehicleClass}_${roadType || "vehicle"}`,
      mood: styles.includes("dark") ? "industrial" : "functional",
      genre: "transport_design",
      detailDensity: "high",
      orientation: "Z_axis_fore_to_aft",
      shapeLanguage: {
        rail: ["elongated_carbody", "window_ribbon", "bogies"],
        air: ["fuselage", "wings", "tail_fin"],
        marine: ["hull", "deckhouse", "superstructure"],
        road: ["chassis", "cabin", "wheel_arches"]
      }[vehicleClass]
    },
    materials: createBaseMaterials("vehicle", styles),
    parts: [],
    surfaceDetails: [],
    ornaments: [],
    pose: { preset: "static" },
    animationHints: {},
    lod: { high: "full", medium: "reduce_repeating_panels", low: "merge_minor_parts" },
    exportOptions: { formats: ["gltf", "glb"], previewHtml: true }
  };

  const parts = [];
  const surfaceDetails = [];
  const box = (id, material, sx, sy, sz, px, py, pz) => {
    parts.push({ id, kind: "box", material, size: [rounded(sx), rounded(sy), rounded(sz)], position: [rounded(px), rounded(py), rounded(pz)] });
  };
  const shape = (id, kind, material, sx, sy, sz, px, py, pz) => {
    parts.push({ id, kind, material, size: [rounded(sx), rounded(sy), rounded(sz)], position: [rounded(px), rounded(py), rounded(pz)] });
  };
  const pushSurface = (id, region, type, strength, offset) => {
    surfaceDetails.push({ id, region, type, strength: rounded(strength), offset: offset.map(rounded) });
  };

  if (vehicleClass === "rail" && isShinkansen) {
    // N700 Nozomi-style shinkansen — 6-car section (119 m real-world scale)
    // Orientation: Z = fore-to-aft, Y = up, X = left-right
    const CW  = 3.40;   // car body width
    const CH  = 3.60;   // car body height
    const CY  = 2.90;   // car body centre Y above ground
    const CL  = 25.0;   // car body length
    const NL  = 9.50;   // nose section length
    const BY  = 0.50;   // bogie frame centre Y
    const WY  = 0.43;   // wheel centre Y (= wheel radius from ground)
    const WD  = 0.86;   // wheel diameter
    const WTH = 0.22;   // wheel thickness (X direction)

    // ---- Nose front (front tip at Z = +59.5) ----
    const nfZ = 54.75;
    box("nose_f_main",      "body_white",   CW,         CH * 0.85, NL,    0,      CY - 0.20,          nfZ);
    box("nose_f_tip",       "body_white",   CW * 0.55,  CH * 0.60, 3.50,  0,      CY - 0.50,          nfZ + 5.50);
    box("nose_f_underskirt","steel_frame",  CW,         0.50,      NL,    0,      1.12,               nfZ);
    box("nose_f_stripe",    "stripe_blue",  CW * 1.01,  0.50,      NL,    0,      1.35,               nfZ);
    box("windshield_f",     "glass",        CW * 0.80,  CH * 0.38, 0.12,  0,      CY + 0.25,          nfZ - 3.20);
    box("headlight_fL",     "headlight",    0.30,       0.18,      0.10, -0.90,   2.00,               nfZ + 4.60);
    box("headlight_fR",     "headlight",    0.30,       0.18,      0.10,  0.90,   2.00,               nfZ + 4.60);
    box("taillight_fL",     "tail_light",   0.20,       0.14,      0.10, -0.70,   1.74,               nfZ + 4.55);
    box("taillight_fR",     "tail_light",   0.20,       0.14,      0.10,  0.70,   1.74,               nfZ + 4.55);

    // ---- Car bodies (4 cars) ----
    const carCenters = [37.50, 12.50, -12.50, -37.50];
    for (let i = 0; i < 4; i++) {
      const n  = i + 1;
      const cZ = carCenters[i];
      const wx = CW / 2;
      box(`car${n}_body`,     "body_white",  CW,         CH,        CL,        0,       CY,                cZ);
      box(`car${n}_stripe`,   "stripe_blue", CW * 1.01,  0.50,      CL + 0.2,  0,       1.35,              cZ);
      box(`car${n}_window_L`, "glass",       0.09,       1.20,      CL - 3.0, -wx - 0.02, CY + 0.55,      cZ);
      box(`car${n}_window_R`, "glass",       0.09,       1.20,      CL - 3.0,  wx + 0.02, CY + 0.55,      cZ);
      box(`car${n}_roof`,     "trim_silver", CW - 0.20,  0.20,      CL,        0,       CY + CH / 2 + 0.10, cZ);
      box(`car${n}_skirt_L`,  "steel_frame", 0.10,       0.80,      CL,       -wx + 0.05, 0.90,            cZ);
      box(`car${n}_skirt_R`,  "steel_frame", 0.10,       0.80,      CL,        wx - 0.05, 0.90,            cZ);
      const bogieZ = [cZ + 8.50, cZ - 8.50];
      for (let b = 0; b < 2; b++) {
        const bZ  = bogieZ[b];
        const bLb = b === 0 ? "fwd" : "aft";
        box(`bogie${n}_${bLb}`,   "bogie_dark", 2.20, 0.65, 2.80,  0,    BY,  bZ);
        box(`wheel${n}_${bLb}_L`, "bogie_dark", WTH,  WD,   WD,   -1.00, WY,  bZ);
        box(`wheel${n}_${bLb}_R`, "bogie_dark", WTH,  WD,   WD,    1.00, WY,  bZ);
      }
    }

    // ---- Pantograph on car 3 ----
    const pZ = carCenters[2] - 5.0;
    box("panto_base",  "pantograph",  1.00, 0.18, 0.80,  0,    CY + CH / 2 + 0.20, pZ);
    box("panto_arm_L", "pantograph",  0.06, 0.80, 1.50, -0.42, CY + CH / 2 + 0.65, pZ);
    box("panto_arm_R", "pantograph",  0.06, 0.80, 1.50,  0.42, CY + CH / 2 + 0.65, pZ);
    box("panto_wire",  "trim_silver", 1.20, 0.06, 0.06,  0,    CY + CH / 2 + 1.05, pZ);

    // ---- Roof AC / vent units ----
    const ventZ = [39.0, 14.0, -11.0, -36.0];
    for (let i = 0; i < 4; i++) {
      box(`vent_unit_${i + 1}`, "roof_equip", 1.40, 0.28, 2.20, 0, CY + CH / 2 + 0.22, ventZ[i]);
    }

    // ---- Nose rear (rear tip at Z = -59.5) ----
    const nrZ = -54.75;
    box("nose_r_main",       "body_white",  CW,         CH * 0.85, NL,    0,      CY - 0.20,          nrZ);
    box("nose_r_tip",        "body_white",  CW * 0.55,  CH * 0.60, 3.50,  0,      CY - 0.50,          nrZ - 5.50);
    box("nose_r_underskirt", "steel_frame", CW,         0.50,      NL,    0,      1.12,               nrZ);
    box("nose_r_stripe",     "stripe_blue", CW * 1.01,  0.50,      NL,    0,      1.35,               nrZ);
    box("windshield_r",      "glass",       CW * 0.80,  CH * 0.38, 0.12,  0,      CY + 0.25,          nrZ + 3.20);
    box("headlight_rL",      "headlight",   0.30,       0.18,      0.10, -0.90,   2.00,               nrZ - 4.60);
    box("headlight_rR",      "headlight",   0.30,       0.18,      0.10,  0.90,   2.00,               nrZ - 4.60);

    // ---- Inter-car gangways ----
    for (let i = 0; i < 3; i++) {
      box(`gangway_${i + 1}`, "steel_frame", CW * 0.78, CH * 0.68, 0.50, 0, CY, carCenters[i] - CL / 2 - 0.25);
    }
    box("gangway_nf_car1",  "steel_frame", CW * 0.78, CH * 0.68, 0.50, 0, CY, nfZ - NL / 2 - 0.25);
    box("gangway_car4_nr",  "steel_frame", CW * 0.78, CH * 0.68, 0.50, 0, CY, nrZ + NL / 2 + 0.25);

    // ---- Surface details ----
    const sdDefs = [
      ["roof",        "panel_line"],  ["body_side",   "stripe_edge"],
      ["window_band", "weld_seam"],   ["underbody",   "vent_slot"],
      ["nose_front",  "edge_bead"],   ["nose_rear",   "edge_bead"],
      ["bogie_area",  "rivet_line"],  ["stripe_lower","coat_clear"],
      ["door_seam",   "panel_line"],  ["roof_equip",  "vent_slot"],
      ["panto_area",  "weld_seam"],   ["cab_glass",   "coat_clear"],
      ["skirt",       "rivet_line"],  ["wheel_area",  "paint_wear"]
    ];
    sdDefs.forEach(([region, type], idx) => {
      pushSurface(`sd_${region}`, region, type, 0.10 + (idx % 5) * 0.03, [(idx % 3 - 1) * 0.01, 0, 0]);
    });

    spec.globalScale = { length: 119.0, width: CW, height: CH, formation: "6car_section_nozomi" };
    spec.promptInterpretation.railType = "shinkansen_nozomi_N700";
    spec.style.silhouette = "N700_Nozomi_shinkansen_6car_section";
    spec.parts = parts;
    spec.surfaceDetails = surfaceDetails;
    return spec;
  }

  if (vehicleClass === "rail") {
    box("carbody_main", "body_main", H * 0.16, H * 0.18, H * 0.82, 0, H * 0.12, 0);
    box("carbody_roof", "trim", H * 0.14, H * 0.04, H * 0.78, 0, H * 0.22, 0);
    box("cab_front", "body_secondary", H * 0.14, H * 0.16, H * 0.10, 0, H * 0.12, H * 0.41);
    box("cab_back", "body_secondary", H * 0.14, H * 0.16, H * 0.10, 0, H * 0.12, -H * 0.41);
    for (let i = 0; i < 8; i++) {
      const z = -H * 0.30 + i * H * 0.085;
      box(`window_L_${i + 1}`, "glass", H * 0.01, H * 0.06, H * 0.05, -H * 0.079, H * 0.14, z);
      box(`window_R_${i + 1}`, "glass", H * 0.01, H * 0.06, H * 0.05, H * 0.079, H * 0.14, z);
    }
    for (let i = 0; i < 2; i++) {
      const z = i === 0 ? -H * 0.24 : H * 0.24;
      box(`bogie_${i + 1}`, "body_secondary", H * 0.12, H * 0.05, H * 0.16, 0, H * 0.03, z);
      for (const side of [-1, 1]) {
        box(`wheel_${i + 1}_${side < 0 ? "L" : "R"}_A`, "tire", H * 0.035, H * 0.035, H * 0.028, side * H * 0.05, H * 0.02, z - H * 0.05);
        box(`wheel_${i + 1}_${side < 0 ? "L" : "R"}_B`, "tire", H * 0.035, H * 0.035, H * 0.028, side * H * 0.05, H * 0.02, z + H * 0.05);
      }
    }
    box("headlight_front", "light_emissive", H * 0.02, H * 0.02, H * 0.01, 0, H * 0.12, H * 0.46);
  } else if (vehicleClass === "air" && /shuttle|spacecraft|orbiter|\u30b7\u30e3\u30c8\u30eb|\u30b9\u30da\u30fc\u30b9\u30b7\u30e3\u30c8\u30eb/iu.test(prompt)) {
    // Space Shuttle Orbiter — real-world scale (37.2m long, 23.8m wingspan)
    // Gear-down glide/landing configuration. Y=0 ground, Z=+nose, X=+right

    // ---- Fuselage ----
    box("fuselage_fwd",     "orbiter_white",  4.80, 4.80, 10.0,  0,    2.90,  12.0);
    box("fuselage_mid",     "orbiter_white",  5.60, 5.20, 12.0,  0,    2.90,   1.0);
    box("fuselage_aft",     "orbiter_white",  5.40, 5.00, 10.0,  0,    2.90, -10.0);
    box("nose_main",        "orbiter_white",  3.80, 3.80,  5.5,  0,    2.50,  17.0);
    box("nose_tip",         "orbiter_white",  2.00, 2.40,  3.0,  0,    2.20,  20.0);
    box("crew_module",      "orbiter_white",  4.40, 1.80,  4.5,  0,    5.10,  12.5);

    // ---- Delta wings ----
    box("wing_inner_L",     "orbiter_white",  4.50, 1.00, 10.0, -4.00, 1.00,  -4.0);
    box("wing_inner_R",     "orbiter_white",  4.50, 1.00, 10.0,  4.00, 1.00,  -4.0);
    box("wing_main_L",      "orbiter_white",  9.50, 0.50, 15.0, -8.50, 0.80,  -3.0);
    box("wing_main_R",      "orbiter_white",  9.50, 0.50, 15.0,  8.50, 0.80,  -3.0);
    box("wing_rcc_L",       "wing_rcc",       1.00, 0.80, 14.0,-11.50, 1.00,  -3.5);
    box("wing_rcc_R",       "wing_rcc",       1.00, 0.80, 14.0, 11.50, 1.00,  -3.5);
    box("elevon_L",         "orbiter_white",  5.00, 0.30,  2.5, -7.00, 0.50, -14.0);
    box("elevon_R",         "orbiter_white",  5.00, 0.30,  2.5,  7.00, 0.50, -14.0);

    // ---- Vertical tail ----
    box("vertical_fin",     "orbiter_white",  0.60, 6.00,  8.5,  0,    7.00,  -9.5);
    box("rudder_brake",     "orbiter_white",  0.50, 4.50,  2.5,  0,    7.50, -13.5);

    // ---- Main engines (3x SSME) ----
    shape("ssme_C",  "cylinder", "engine_bell",  1.40, 1.60, 1.40,  0.00, 1.80, -18.5);
    shape("ssme_L",  "cylinder", "engine_bell",  1.20, 1.40, 1.20, -1.60, 2.90, -18.0);
    shape("ssme_R",  "cylinder", "engine_bell",  1.20, 1.40, 1.20,  1.60, 2.90, -18.0);
    box("ssme_glow_C","engine_glow", 0.60, 0.60, 0.20,  0.00, 1.80, -19.2);
    box("ssme_glow_L","engine_glow", 0.50, 0.50, 0.20, -1.60, 2.90, -18.8);
    box("ssme_glow_R","engine_glow", 0.50, 0.50, 0.20,  1.60, 2.90, -18.8);

    // ---- OMS pods ----
    box("oms_pod_L",    "orbiter_white", 1.50, 1.00, 3.50, -2.80, 4.50, -12.0);
    box("oms_pod_R",    "orbiter_white", 1.50, 1.00, 3.50,  2.80, 4.50, -12.0);
    shape("oms_nozzle_L","cylinder","engine_bell",0.50,0.60,0.50,-2.80,4.20,-13.8);
    shape("oms_nozzle_R","cylinder","engine_bell",0.50,0.60,0.50, 2.80,4.20,-13.8);

    // ---- Payload bay doors (closed) ----
    box("payload_door_L", "payload_door", 0.15, 5.00, 11.5, -2.80, 5.40,  1.0);
    box("payload_door_R", "payload_door", 0.15, 5.00, 11.5,  2.80, 5.40,  1.0);

    // ---- Cockpit windows ----
    box("window_fwd_L", "glass_cockpit", 0.12, 0.90, 1.00, -1.20, 5.80, 15.0);
    box("window_fwd_R", "glass_cockpit", 0.12, 0.90, 1.00,  1.20, 5.80, 15.0);
    box("window_ovhd",  "glass_cockpit", 2.00, 0.80, 0.10,  0,    5.80, 13.5);

    // ---- Thermal protection belly ----
    box("belly_tiles",  "tiles_black",  5.50, 0.12, 35.0,  0, 0.06,  0.0);
    box("nose_cap_rcc", "heat_shield",  2.20, 2.00,  2.00,  0, 2.00, 20.5);
    box("body_flap",    "tiles_black",  4.00, 0.50,  2.00,  0, 0.25,-16.0);

    // ---- RCS thrusters (nose cluster) ----
    box("rcs_upper",   "rcs_metal",  0.60, 0.30, 2.00,  0,    4.20, 19.5);
    box("rcs_lower_L", "rcs_metal",  0.30, 0.40, 1.00, -0.60, 2.20, 19.5);
    box("rcs_lower_R", "rcs_metal",  0.30, 0.40, 1.00,  0.60, 2.20, 19.5);

    // ---- Landing gear (deployed) ----
    box("nose_gear_strut",  "gear_metal", 0.30, 1.80, 0.30,  0,    0.90, 13.5);
    box("nose_gear_wheel",  "tiles_black",0.60, 0.60, 0.50,  0,    0.00, 13.5);
    box("main_gear_L",      "gear_metal", 0.50, 2.00, 0.50, -2.20, 1.00, -7.0);
    box("main_gear_R",      "gear_metal", 0.50, 2.00, 0.50,  2.20, 1.00, -7.0);
    box("main_wheel_L",     "tiles_black",0.90, 0.90, 0.60, -2.20, 0.00, -7.0);
    box("main_wheel_R",     "tiles_black",0.90, 0.90, 0.60,  2.20, 0.00, -7.0);

    // ---- Surface details ----
    const shutSD = [
      ["upper_fuselage",  "panel_line"],  ["payload_bay_door","panel_seam"],
      ["wing_surface",    "coat_clear"],  ["belly_tiles",     "tile_grid"],
      ["nose_cone",       "edge_bead"],   ["engine_surround",  "heat_discolor"],
      ["oms_pod",         "weld_seam"],   ["vertical_fin",    "panel_line"],
      ["crew_module",     "window_frame"],["wing_rcc_area",   "paint_wear"],
      ["rcs_cluster",     "vent_slot"],   ["gear_bay",        "rivet_line"],
      ["elevon_hinge",    "panel_line"],  ["body_flap",       "heat_discolor"]
    ];
    shutSD.forEach(([region, type], idx) => {
      pushSurface(`sd_${region}`, region, type, 0.10 + (idx % 5) * 0.03, [(idx % 3 - 1) * 0.01, 0, 0]);
    });

    spec.globalScale = { length: 37.2, wingspan: 23.8, height: 9.5, type: "space_shuttle_orbiter" };
    spec.promptInterpretation.airType = "space_shuttle_orbiter";
    spec.style.silhouette = "space_shuttle_orbiter_glide";
    spec.parts = parts;
    spec.surfaceDetails = surfaceDetails;
    return spec;

  } else if (vehicleClass === "air" && /helicopter|\u30d8\u30ea\u30b3\u30d7\u30bf\u30fc|\u30d8\u30ea/iu.test(prompt)) {
    // Medium utility helicopter — real-world scale (~13m fuselage, 14m rotor)
    // Y=0 ground, Z=+front, X=+right

    // ---- Landing skids ----
    box("skid_bar_L",     "skid",  0.08, 0.08, 8.00, -1.30, 0.04,  0.40);
    box("skid_bar_R",     "skid",  0.08, 0.08, 8.00,  1.30, 0.04,  0.40);
    box("skid_strut_fL",  "skid",  0.08, 1.00, 0.10, -1.30, 0.52,  2.50);
    box("skid_strut_rL",  "skid",  0.08, 1.00, 0.10, -1.30, 0.52, -1.50);
    box("skid_strut_fR",  "skid",  0.08, 1.00, 0.10,  1.30, 0.52,  2.50);
    box("skid_strut_rR",  "skid",  0.08, 1.00, 0.10,  1.30, 0.52, -1.50);

    // ---- Main fuselage ----
    box("fuselage_main",  "body_main",      2.40, 1.80, 8.00,  0, 1.60,  0.00);
    box("fuselage_belly", "body_secondary", 2.20, 0.40, 8.00,  0, 0.78,  0.00);
    box("fuselage_spine", "body_secondary", 2.10, 0.28, 5.80,  0, 2.62, -0.60);

    // ---- Cockpit ----
    box("cockpit_bubble",    "glass_cockpit", 2.20, 1.40, 2.60,  0, 1.80,  4.50);
    box("nose_lower",        "body_secondary",2.00, 1.00, 2.00,  0, 1.00,  5.50);
    box("instrument_panel",  "body_secondary",1.80, 0.40, 0.20,  0, 2.00,  3.60);

    // ---- Engine housing ----
    box("engine_housing",  "body_secondary", 1.60, 0.90, 2.50,  0,     2.72,  0.50);
    box("exhaust_L",       "rotor_mast",     0.20, 0.20, 0.80, -0.80,  2.90, -0.30);
    box("exhaust_R",       "rotor_mast",     0.20, 0.20, 0.80,  0.80,  2.90, -0.30);

    // ---- Main rotor ----
    box("rotor_mast_base", "rotor_mast",  0.30, 0.50, 0.30,  0, 3.20,  0.30);
    box("rotor_head",      "rotor_mast",  0.60, 0.25, 0.60,  0, 3.52,  0.30);
    box("rotor_blade_N",   "rotor_blade", 0.45, 0.06, 6.80,  0, 3.58,  3.70);
    box("rotor_blade_S",   "rotor_blade", 0.45, 0.06, 6.80,  0, 3.58, -3.10);
    box("rotor_blade_E",   "rotor_blade", 6.80, 0.06, 0.45,  3.40, 3.58,  0.30);
    box("rotor_blade_W",   "rotor_blade", 6.80, 0.06, 0.45, -3.40, 3.58,  0.30);

    // ---- Tail boom ----
    box("tail_boom_main",  "body_main",      0.80, 0.65, 7.00,  0, 2.02, -6.50);
    box("tail_boom_tip",   "body_secondary", 0.55, 0.50, 2.50,  0, 2.12,-10.25);

    // ---- Tail assembly ----
    box("vertical_fin",    "body_secondary", 0.12, 1.80, 1.10,  0,     3.00, -9.80);
    box("horiz_stab_L",    "body_secondary", 2.00, 0.10, 0.80, -1.10,  2.52,-10.00);
    box("horiz_stab_R",    "body_secondary", 2.00, 0.10, 0.80,  1.10,  2.52,-10.00);

    // ---- Tail rotor (starboard side) ----
    box("tail_rotor_mast",    "rotor_mast",  0.12, 0.12, 0.50,  0.58, 3.20,-10.50);
    box("tail_rotor_hub",     "rotor_mast",  0.20, 0.20, 0.20,  0.70, 3.20,-10.50);
    box("tail_rotor_blade_V", "rotor_blade", 0.22, 1.60, 0.08,  0.70, 3.20,-10.50);
    box("tail_rotor_blade_H", "rotor_blade", 0.22, 0.08, 1.60,  0.70, 3.20,-10.50);

    // ---- Cabin doors & windows ----
    box("door_L",        "glass_cockpit", 0.08, 0.90, 1.60, -1.21, 1.72,  0.50);
    box("door_R",        "glass_cockpit", 0.08, 0.90, 1.60,  1.21, 1.72,  0.50);
    box("window_L_rear", "glass_cockpit", 0.08, 0.60, 1.00, -1.21, 1.82, -1.50);
    box("window_R_rear", "glass_cockpit", 0.08, 0.60, 1.00,  1.21, 1.82, -1.50);

    // ---- Navigation lights & searchlight ----
    box("nav_red_L",   "nav_red",    0.18, 0.10, 0.14, -1.22, 1.90, 4.60);
    box("nav_green_R", "nav_green",  0.18, 0.10, 0.14,  1.22, 1.90, 4.60);
    box("searchlight", "searchlight",0.30, 0.22, 0.30,  0.00, 0.56, 4.80);

    // ---- Antenna ----
    box("antenna_main", "rotor_mast", 0.04, 0.80, 0.04, 0, 3.04, -1.50);

    // ---- Surface details ----
    const heliSD = [
      ["fuselage_side",  "panel_line"],  ["fuselage_top",   "weld_seam"],
      ["cockpit_frame",  "edge_bead"],   ["engine_bay",     "vent_slot"],
      ["tail_boom_side", "panel_line"],  ["rotor_blade_top","coat_clear"],
      ["door_gap",       "panel_line"],  ["skid_joint",     "rivet_line"],
      ["belly",          "paint_wear"],  ["exhaust_area",   "heat_discolor"],
      ["tail_fin_edge",  "edge_bead"],   ["nose_lower",     "weld_seam"]
    ];
    heliSD.forEach(([region, type], idx) => {
      pushSurface(`sd_${region}`, region, type, 0.10 + (idx % 5) * 0.03, [(idx % 3 - 1) * 0.01, 0, 0]);
    });

    spec.globalScale = { length: 13.0, rotorDiameter: 14.0, height: 3.70, type: "medium_utility_helicopter" };
    spec.promptInterpretation.airType = "helicopter_medium_utility";
    spec.style.silhouette = "medium_utility_helicopter";
    spec.parts = parts;
    spec.surfaceDetails = surfaceDetails;
    return spec;

  } else if (vehicleClass === "air") {
    shape("fuselage", "cylinder", "body_main", H * 0.16, H * 0.18, H * 0.72, 0, H * 0.14, 0);
    box("nose", "body_secondary", H * 0.12, H * 0.14, H * 0.18, 0, H * 0.15, H * 0.42);
    box("tail", "body_secondary", H * 0.11, H * 0.12, H * 0.16, 0, H * 0.17, -H * 0.42);
    shape("cockpit", "sphere", "glass", H * 0.10, H * 0.06, H * 0.09, 0, H * 0.20, H * 0.30);
    box("wing_main", "trim", H * 0.66, H * 0.03, H * 0.24, 0, H * 0.14, H * 0.03);
    box("tail_fin", "trim", H * 0.03, H * 0.15, H * 0.10, 0, H * 0.24, -H * 0.42);
    box("engine_L", "body_secondary", H * 0.10, H * 0.08, H * 0.14, -H * 0.20, H * 0.10, H * 0.02);
    box("engine_R", "body_secondary", H * 0.10, H * 0.08, H * 0.14, H * 0.20, H * 0.10, H * 0.02);
  } else if (vehicleClass === "marine") {
    box("hull_main", "body_main", H * 0.20, H * 0.18, H * 0.76, 0, H * 0.09, 0);
    box("hull_keel", "body_secondary", H * 0.08, H * 0.08, H * 0.72, 0, H * 0.01, 0);
    box("deck", "trim", H * 0.18, H * 0.03, H * 0.66, 0, H * 0.18, 0);
    box("bridge_upper", "glass", H * 0.10, H * 0.08, H * 0.14, 0, H * 0.31, -H * 0.10);
    box("chimney", "trim", H * 0.05, H * 0.12, H * 0.05, 0, H * 0.33, 0.02 * H);
  } else if (roadType === "patrol") {
    box("chassis", "body_secondary", H*0.22, H*0.06, H*0.52, 0, H*0.04, 0);
    box("body_lower", "body_main", H*0.22, H*0.08, H*0.52, 0, H*0.10, 0);
    box("hood", "body_black", H*0.20, H*0.07, H*0.18, 0, H*0.13, H*0.25);
    box("cabin", "body_main", H*0.20, H*0.12, H*0.24, 0, H*0.19, H*0.04);
    box("siren_L", "siren_red", H*0.04, H*0.025, H*0.06, -H*0.04, H*0.30, H*0.04);
    box("siren_R", "siren_blue", H*0.04, H*0.025, H*0.06, H*0.04, H*0.30, H*0.04);
  } else if (roadType === "taxi") {
    box("chassis", "body_secondary", H*0.22, H*0.06, H*0.54, 0, H*0.04, 0);
    box("body", "taxi_accent", H*0.22, H*0.10, H*0.54, 0, H*0.12, 0);
    box("cabin", "body_main", H*0.18, H*0.12, H*0.26, 0, H*0.21, H*0.02);
    box("taxi_sign", "trim", H*0.08, H*0.03, H*0.05, 0, H*0.29, H*0.02);
  } else if (roadType === "sport") {
    box("chassis", "body_secondary", H*0.24, H*0.05, H*0.50, 0, H*0.03, 0);
    box("body", "sport_accent", H*0.22, H*0.08, H*0.48, 0, H*0.10, 0.02*H);
    box("cockpit", "glass", H*0.16, H*0.07, H*0.18, 0, H*0.16, 0.02*H);
    box("spoiler", "trim", H*0.18, H*0.02, H*0.03, 0, H*0.14, -H*0.22);
  } else if (roadType === "kei") {
    box("chassis", "body_secondary", H*0.20, H*0.06, H*0.42, 0, H*0.04, 0);
    box("body", "body_main", H*0.19, H*0.13, H*0.38, 0, H*0.13, 0);
    box("cabin", "glass", H*0.16, H*0.09, H*0.20, 0, H*0.17, 0.03*H);
  } else if (roadType === "truck") {
    box("chassis", "body_secondary", H*0.24, H*0.06, H*0.68, 0, H*0.04, 0);
    box("cab", "body_main", H*0.20, H*0.16, H*0.18, 0, H*0.16, H*0.20);
    box("cargo_box", "body_main", H*0.22, H*0.20, H*0.40, 0, H*0.16, -H*0.12);
    box("cargo_trim", "trim", H*0.20, H*0.04, H*0.36, 0, H*0.26, -H*0.12);
  } else {
    box("chassis", "body_secondary", H * 0.24, H * 0.08, H * 0.56, 0, H * 0.05, 0);
    box("cabin", "body_main", H * 0.22, H * 0.16, H * 0.22, 0, H * 0.16, H * 0.10);
    box("hood", "body_main", H * 0.20, H * 0.10, H * 0.16, 0, H * 0.13, H * 0.28);
  }

  if (vehicleClass === "road") {
    const axleZ = roadType === "truck" ? [H*0.22, H*0.02, -H*0.22] : [H*0.18, -H*0.17];
    for (const zPos of axleZ) {
      for (const side of [-1, 1]) {
        const s = side < 0 ? "L" : "R";
        shape(`wheel_${zPos.toFixed(2)}_${s}`, "cylinder", "tire", H*0.062, H*0.062, H*0.045, side*H*0.12, H*0.04, zPos);
      }
    }
    box("headlight_L", "light_emissive", H*0.03, H*0.02, H*0.01, -H*0.06, H*0.10, H*0.34);
    box("headlight_R", "light_emissive", H*0.03, H*0.02, H*0.01, H*0.06, H*0.10, H*0.34);
  }

  const regions = ["body", "front", "rear", "sides", "undercarriage"];
  const detailTypes = ["panel_line", "vent", "service_hatch", "paint_wear", "edge_trim"];
  let sdIndex = 1;
  for (const region of regions) {
    for (let i = 0; i < 8; i++) {
      pushSurface(`surface_detail_${sdIndex++}`, region, detailTypes[i % detailTypes.length], 0.12 + (i % 4) * 0.05, [Math.sin(i * 0.9) * 0.02, Math.cos(i * 0.7) * 0.016, ((i % 3) - 1) * 0.013]);
    }
  }

  spec.parts = parts;
  spec.surfaceDetails = surfaceDetails;
  return spec;
}
function buildStructureSpec(prompt, height, styles) {
  const H = height;
  const structureType = classifyStructureType(prompt);
  const base = buildHighDensityMeta(prompt, "structure", height, styles);
  const spec = {
    ...base,
    promptInterpretation: {
      ...base.promptInterpretation,
      structureType
    },
    globalScale: { height: H, width: rounded(H * 0.8), depth: rounded(H * 0.8) },
    style: {
      silhouette: structureType,
      mood: "functional",
      genre: "infrastructure",
      detailDensity: "high"
    },
    materials: createBaseMaterials("structure", styles),
    parts: [],
    surfaceDetails: [],
    ornaments: [],
    pose: { preset: "static" },
    animationHints: {},
    lod: { high: "full", medium: "reduce_repetition", low: "merge_parts" },
    exportOptions: { formats: ["gltf", "glb"], previewHtml: true }
  };

  const parts = [];
  const surfaceDetails = [];
  const box = (id, material, sx, sy, sz, px, py, pz) => {
    parts.push({ id, kind: "box", material, size: [rounded(sx), rounded(sy), rounded(sz)], position: [rounded(px), rounded(py), rounded(pz)] });
  };
  const shape = (id, kind, material, sx, sy, sz, px, py, pz) => {
    parts.push({ id, kind, material, size: [rounded(sx), rounded(sy), rounded(sz)], position: [rounded(px), rounded(py), rounded(pz)] });
  };
  const pushSurface = (id, region, type, strength, offset) => {
    surfaceDetails.push({ id, region, type, strength: rounded(strength), offset: offset.map(rounded) });
  };

  if (structureType === "tree") {
    shape("trunk", "cylinder", "trunk", H * 0.10, H * 0.42, H * 0.10, 0, H * 0.21, 0);
    shape("foliage_1", "sphere", "foliage", H * 0.44, H * 0.30, H * 0.44, 0, H * 0.52, 0);
    shape("foliage_2", "sphere", "foliage", H * 0.34, H * 0.26, H * 0.34, 0, H * 0.72, 0);
    shape("foliage_3", "sphere", "foliage", H * 0.24, H * 0.20, H * 0.24, 0, H * 0.90, 0);
  } else if (structureType === "traffic_signal") {
    shape("pole", "cylinder", "steel", H * 0.06, H * 0.80, H * 0.06, 0, H * 0.40, 0);
    box("arm", "steel", H * 0.30, H * 0.05, H * 0.05, H * 0.12, H * 0.70, 0);
    shape("head", "cylinder", "concrete", H * 0.10, H * 0.20, H * 0.10, H * 0.24, H * 0.62, 0);
    shape("light_r", "sphere", "signal_red", H * 0.04, H * 0.04, H * 0.03, H * 0.24, H * 0.68, 0);
    shape("light_y", "sphere", "signal_yellow", H * 0.04, H * 0.04, H * 0.03, H * 0.24, H * 0.62, 0);
    shape("light_g", "sphere", "signal_green", H * 0.04, H * 0.04, H * 0.03, H * 0.24, H * 0.56, 0);
  } else if (structureType === "pedestrian_bridge") {
    box("deck", "concrete", H * 1.2, H * 0.08, H * 0.28, 0, H * 0.42, 0);
    box("stairs_L", "steel", H * 0.24, H * 0.40, H * 0.24, -H * 0.48, H * 0.20, 0);
    box("stairs_R", "steel", H * 0.24, H * 0.40, H * 0.24, H * 0.48, H * 0.20, 0);
    box("rail_L", "steel", H * 1.2, H * 0.06, H * 0.03, 0, H * 0.49, H * 0.12);
    box("rail_R", "steel", H * 1.2, H * 0.06, H * 0.03, 0, H * 0.49, -H * 0.12);
  } else if (structureType === "bridge") {
    box("road_deck", "concrete", H * 1.6, H * 0.12, H * 0.42, 0, H * 0.36, 0);
    box("pier_L", "concrete", H * 0.20, H * 0.60, H * 0.20, -H * 0.55, H * 0.18, 0);
    box("pier_R", "concrete", H * 0.20, H * 0.60, H * 0.20, H * 0.55, H * 0.18, 0);
    box("arch", "steel", H * 1.0, H * 0.22, H * 0.12, 0, H * 0.60, 0);
  } else if (structureType === "data_center") {
    box("main_hall", "concrete", H * 0.90, H * 0.60, H * 0.56, 0, H * 0.30, 0);
    box("annex", "concrete", H * 0.42, H * 0.46, H * 0.42, H * 0.52, H * 0.23, 0);
    for (let i = 0; i < 8; i++) {
      box(`rack_${i + 1}`, "steel", H * 0.07, H * 0.24, H * 0.12, (-0.24 + i * 0.07) * H, H * 0.14, H * 0.14);
    }
    box("cooling_tower", "steel", H * 0.16, H * 0.40, H * 0.16, -H * 0.48, H * 0.20, 0);
  } else if (structureType === "theme_park") {
    box("gate", "accent", H * 1.00, H * 0.30, H * 0.18, 0, H * 0.15, H * 0.18);
    box("castle_center", "concrete", H * 0.34, H * 0.50, H * 0.30, 0, H * 0.25, -H * 0.08);
    box("tower_L", "concrete", H * 0.12, H * 0.44, H * 0.12, -H * 0.24, H * 0.22, -H * 0.02);
    box("tower_R", "concrete", H * 0.12, H * 0.44, H * 0.12, H * 0.24, H * 0.22, -H * 0.02);
    box("wheel_base", "steel", H * 0.40, H * 0.40, H * 0.06, 0, H * 0.48, -H * 0.36);
  } else if (structureType === "power_plant") {
    box("turbine_hall", "concrete", H * 1.0, H * 0.52, H * 0.52, 0, H * 0.26, 0);
    box("chimney_1", "steel", H * 0.12, H * 0.86, H * 0.12, -H * 0.30, H * 0.43, -H * 0.16);
    box("chimney_2", "steel", H * 0.12, H * 0.86, H * 0.12, H * 0.30, H * 0.43, -H * 0.16);
    box("cooling", "steel", H * 0.24, H * 0.40, H * 0.24, 0, H * 0.20, H * 0.22);
  } else if (structureType === "rocket_base") {
    box("launch_pad", "concrete", H * 1.10, H * 0.10, H * 0.60, 0, H * 0.05, 0);
    box("rocket_body", "steel", H * 0.14, H * 0.90, H * 0.14, 0, H * 0.55, 0);
    box("rocket_nose", "accent", H * 0.10, H * 0.18, H * 0.10, 0, H * 1.00, 0);
    box("service_tower", "steel", H * 0.20, H * 0.84, H * 0.20, H * 0.24, H * 0.46, 0);
  } else {
    box("platform", "concrete", H * 0.80, H * 0.08, H * 0.80, 0, H * 0.04, 0);
    box("tower", "steel", H * 0.16, H * 0.90, H * 0.16, 0, H * 0.45, 0);
    box("top", "accent", H * 0.24, H * 0.12, H * 0.24, 0, H * 0.92, 0);
  }

  const regions = ["base", "structure", "details", "access"];
  const detailTypes = ["panel_seam", "bolt_pattern", "weathering", "utility_mark"];
  let sdIndex = 1;
  for (const region of regions) {
    for (let i = 0; i < 6; i++) {
      pushSurface(`surface_detail_${sdIndex++}`, region, detailTypes[i % detailTypes.length], 0.12 + (i % 3) * 0.06, [Math.sin(i * 0.8) * 0.015, Math.cos(i * 0.5) * 0.012, ((i % 4) - 1.5) * 0.01]);
    }
  }

  spec.parts = parts;
  spec.surfaceDetails = surfaceDetails;
  return spec;
}
function buildWarriorSpec(prompt, height, styles) {
  // H = total standing height (default 2 m 窶・human scale)
  const H     = height;
  const dark  = styles.includes("dark");
  const regal = styles.includes("regal");
  const accentMat  = regal ? "gold_trim" : "bronze_trim";
  const capeColor  = dark  ? "cloth_dark" : "cloth_accent";

  const base = buildHighDensityMeta(prompt, "warrior", height, styles);
  const spec = {
    ...base,
    globalScale: { height: H, width: rounded(H * 0.36), depth: rounded(H * 0.20) },
    style: {
      silhouette: "full_plate_armored_humanoid_warrior",
      mood: dark ? "dark_knight" : regal ? "royal_champion" : "heroic_warrior",
      genre: "western_fantasy",
      detailDensity: "ultra_high",
      bodyLanguage: "standing_battle_ready",
      shapeLanguage: ["layered_plate_armor", "angular_helmet", "greatsword_upright", "cascading_pauldrons", "flowing_cape"]
    },
    materials: createBaseMaterials("warrior", styles),
    parts: [],
    surfaceDetails: [],
    ornaments: [],
    pose: { preset: "battle_ready", swordHeld: "right_hand_upright" },
    animationHints: { idleBreathScale: 0.004, armorClankOnMove: true },
    lod: { high: "full", medium: "remove_micro_bands", low: "merge_plate_sections" },
    exportOptions: { formats: ["gltf", "glb"], previewHtml: true }
  };

  const parts = [];
  const surfaceDetails = [];

  function box(id, mat, sx, sy, sz, px, py, pz) {
    parts.push({ id, kind: "box", material: mat,
      size: [rounded(sx), rounded(sy), rounded(sz)],
      position: [rounded(px), rounded(py), rounded(pz)] });
  }
  function pushSurface(id, region, type, scale, offset) {
    surfaceDetails.push({ id, region, type, scale, offset });
  }

  // 笏笏 CORE BODY (chainmail under-layer) 笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏
  box("body_pelvis",         "chainmail",   H*0.100, H*0.065, H*0.080,  0,       H*0.468, 0);
  box("body_abdomen",        "chainmail",   H*0.100, H*0.060, H*0.075,  0,       H*0.532, 0);
  box("body_torso",          "cloth",       H*0.130, H*0.100, H*0.085,  0,       H*0.620, 0);
  box("body_chest",          "chainmail",   H*0.140, H*0.075, H*0.090,  0,       H*0.718, 0);
  box("body_neck",           "chainmail",   H*0.040, H*0.038, H*0.040,  0,       H*0.820, 0);

  // 笏笏 HELMET 笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏
  box("helm_main",           "plate_main",  H*0.095, H*0.085, H*0.090,  0,       H*0.900, 0);
  box("helm_cheek_L",        "plate_main",  H*0.020, H*0.052, H*0.040, -H*0.048, H*0.888, H*0.018);
  box("helm_cheek_R",        "plate_main",  H*0.020, H*0.052, H*0.040,  H*0.048, H*0.888, H*0.018);
  box("helm_visor",          "plate_dark",  H*0.068, H*0.026, H*0.015,  0,       H*0.884, H*0.048);
  box("helm_brow",           "plate_main",  H*0.090, H*0.016, H*0.022,  0,       H*0.922, H*0.030);
  box("helm_nasal",          "plate_dark",  H*0.010, H*0.038, H*0.012,  0,       H*0.886, H*0.052);
  box("helm_crest_base",     accentMat,     H*0.018, H*0.012, H*0.075,  0,       H*0.950, -H*0.010);
  // Eye slits
  box("eye_slit_L",          "plate_dark",  H*0.018, H*0.007, H*0.006, -H*0.020, H*0.892, H*0.048);
  box("eye_slit_R",          "plate_dark",  H*0.018, H*0.007, H*0.006,  H*0.020, H*0.892, H*0.048);
  // Plume (6 segments cascading along crest)
  for (let i = 0; i < 6; i++) {
    const pz = -H*0.026 + i * H*0.011;
    const py = H*0.958 + i * H*0.006;
    const ph = H * (0.042 - i * 0.003);
    box(`helm_plume_${i+1}`, capeColor, H*0.010, ph, H*0.012, 0, py, pz);
  }

  // 笏笏 GORGET (neck guard) 笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏
  box("gorget_front",        "plate_main",  H*0.060, H*0.020, H*0.038,  0,       H*0.838, H*0.018);
  box("gorget_back",         "plate_dark",  H*0.055, H*0.018, H*0.028,  0,       H*0.838, -H*0.015);
  box("gorget_L",            "plate_main",  H*0.018, H*0.020, H*0.032, -H*0.032, H*0.838, 0);
  box("gorget_R",            "plate_main",  H*0.018, H*0.020, H*0.032,  H*0.032, H*0.838, 0);

  // 笏笏 BREASTPLATE 笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏
  box("breast_upper",        "plate_main",  H*0.130, H*0.048, H*0.040,  0,       H*0.790, H*0.022);
  box("breast_main",         "plate_main",  H*0.135, H*0.098, H*0.042,  0,       H*0.700, H*0.024);
  box("breast_lower",        "plate_dark",  H*0.114, H*0.038, H*0.038,  0,       H*0.628, H*0.020);
  box("breast_center_ridge", "plate_main",  H*0.012, H*0.130, H*0.020,  0,       H*0.708, H*0.040);
  box("breast_trim_top",     accentMat,     H*0.130, H*0.007, H*0.008,  0,       H*0.812, H*0.024);
  box("breast_trim_bot",     accentMat,     H*0.112, H*0.006, H*0.006,  0,       H*0.638, H*0.020);
  box("pec_flange_L",        "plate_main",  H*0.038, H*0.046, H*0.035, -H*0.072, H*0.773, H*0.018);
  box("pec_flange_R",        "plate_main",  H*0.038, H*0.046, H*0.035,  H*0.072, H*0.773, H*0.018);
  // Belly bands (5)
  for (let i = 0; i < 5; i++) {
    box(`belly_band_${i+1}`, i%2===0 ? "plate_dark" : "plate_main",
      H*0.110, H*0.010, H*0.034, 0, H*(0.544 + i*0.017), H*0.018);
  }

  // 笏笏 BACKPLATE 笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏
  box("back_main",           "plate_dark",  H*0.128, H*0.108, H*0.028,  0,       H*0.710, -H*0.020);
  box("back_lower",          "plate_dark",  H*0.110, H*0.048, H*0.024,  0,       H*0.628, -H*0.018);
  box("back_trim",           accentMat,     H*0.125, H*0.007, H*0.007,  0,       H*0.810, -H*0.018);

  // 笏笏 FAULD (waist skirt 窶・10 overlapping plates) 笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏
  for (let i = 0; i < 10; i++) {
    const angle = ((i - 4.5) / 10) * Math.PI * 0.85;
    const x = Math.sin(angle) * H * 0.054;
    const z = Math.cos(angle) * H * 0.022 - H*0.002;
    const w = H * 0.027;
    const y = H * (0.508 - Math.abs(angle) * 0.010);
    box(`fauld_${i+1}`, i%2===0 ? "plate_dark" : "plate_main", w, H*0.055, H*0.018, x, y, z);
  }

  // 笏笏 PAULDRONS (shoulder plates) 笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏
  for (const side of ["L", "R"]) {
    const sx = side === "L" ? -1 : 1;
    box(`pauldron_${side}_main`,    "plate_main", H*0.065, H*0.028, H*0.075, sx*H*0.115, H*0.800, 0);
    box(`pauldron_${side}_top`,     "plate_main", H*0.075, H*0.018, H*0.080, sx*H*0.115, H*0.824, 0);
    box(`pauldron_${side}_trim`,    accentMat,    H*0.075, H*0.007, H*0.007, sx*H*0.115, H*0.836, 0);
    box(`pauldron_${side}_spike`,   accentMat,    H*0.014, H*0.042, H*0.014, sx*H*0.115, H*0.840, 0);
    // Cascading flange plates (4)
    for (let i = 0; i < 4; i++) {
      const pw = H * (0.060 - i * 0.006);
      const py = H * (0.774 - i * 0.024);
      const pz = H * (-0.008 + i * 0.006);
      box(`pauldron_${side}_flange_${i+1}`,
        i%2===0 ? "plate_main" : "plate_dark", pw, H*0.014, H*0.060, sx*H*0.115, py, pz);
    }
  }

  // 笏笏 UPPER ARMS 笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏
  for (const side of ["L", "R"]) {
    const sx = side === "L" ? -1 : 1;
    box(`uarm_${side}`,            "plate_main", H*0.048, H*0.108, H*0.048, sx*H*0.155, H*0.718, 0);
    for (let i = 0; i < 6; i++) {
      box(`uarm_${side}_band_${i+1}`, i%2===0 ? "plate_dark" : "plate_main",
        H*0.052, H*0.009, H*0.052, sx*H*0.155, H*(0.683 + i*0.019), 0);
    }
  }

  // 笏笏 ELBOW GUARDS 笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏
  for (const side of ["L", "R"]) {
    const sx = side === "L" ? -1 : 1;
    box(`elbow_${side}`,           "plate_main", H*0.058, H*0.024, H*0.058, sx*H*0.155, H*0.604, 0);
    box(`elbow_${side}_spike`,     accentMat,    H*0.012, H*0.034, H*0.012, sx*H*0.155, H*0.598, H*0.030);
  }

  // 笏笏 VAMBRACES (forearm guards) 笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏
  // Right arm slightly lowered (sword grip), left natural
  for (const side of ["L", "R"]) {
    const sx  = side === "L" ? -1 : 1;
    const yOff = side === "R" ? -H*0.035 : 0;
    box(`vambrace_${side}`,        "plate_main", H*0.044, H*0.104, H*0.044, sx*H*0.155, H*0.500+yOff, 0);
    for (let i = 0; i < 5; i++) {
      box(`vambrace_${side}_band_${i+1}`, i%2===0 ? "plate_dark" : "plate_main",
        H*0.048, H*0.008, H*0.048, sx*H*0.155, H*(0.468 + i*0.022)+yOff, 0);
    }
  }

  // 笏笏 GAUNTLETS 笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏
  for (const side of ["L", "R"]) {
    const sx  = side === "L" ? -1 : 1;
    const yOff = side === "R" ? -H*0.035 : 0;
    box(`gauntlet_${side}`,        "plate_main", H*0.042, H*0.038, H*0.042, sx*H*0.155, H*0.386+yOff, 0);
    box(`gauntlet_${side}_knuck`,  "plate_dark", H*0.040, H*0.012, H*0.040, sx*H*0.155, H*0.413+yOff, H*0.018);
    for (let i = 0; i < 4; i++) {
      const dx = (-0.014 + i*0.010) * H;
      box(`gauntlet_${side}_finger_${i+1}`, "plate_dark", H*0.008, H*0.022, H*0.028,
        sx*H*0.155 + dx, H*0.360+yOff, H*0.012);
    }
  }

  // 笏笏 TASSETS (upper thigh guards hanging from fauld) 笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏
  for (const side of ["L", "R"]) {
    const sx = side === "L" ? -1 : 1;
    for (let i = 0; i < 3; i++) {
      box(`tasset_${side}_${i+1}`, i%2===0 ? "plate_main" : "plate_dark",
        H*0.050, H*0.038, H*0.022, sx*H*0.050, H*(0.444 - i*0.038), H*0.010);
    }
  }

  // 笏笏 THIGHS 笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏
  for (const side of ["L", "R"]) {
    const sx = side === "L" ? -1 : 1;
    box(`thigh_${side}`,           "plate_main", H*0.054, H*0.138, H*0.054, sx*H*0.050, H*0.338, 0);
    for (let i = 0; i < 8; i++) {
      box(`thigh_${side}_band_${i+1}`, i%2===0 ? "plate_dark" : "plate_main",
        H*0.058, H*0.008, H*0.058, sx*H*0.050, H*(0.268 + i*0.018), 0);
    }
  }

  // 笏笏 KNEE GUARDS 笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏
  for (const side of ["L", "R"]) {
    const sx = side === "L" ? -1 : 1;
    box(`knee_${side}`,            "plate_main", H*0.064, H*0.028, H*0.058, sx*H*0.050, H*0.216, H*0.008);
    box(`knee_${side}_rim`,        accentMat,    H*0.064, H*0.007, H*0.007, sx*H*0.050, H*0.228, H*0.010);
  }

  // 笏笏 GREAVES (shins) 笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏
  for (const side of ["L", "R"]) {
    const sx = side === "L" ? -1 : 1;
    box(`greave_${side}`,          "plate_main", H*0.050, H*0.148, H*0.050, sx*H*0.050, H*0.114, 0);
    box(`greave_${side}_back`,     "plate_dark", H*0.044, H*0.138, H*0.018, sx*H*0.050, H*0.114, -H*0.030);
    for (let i = 0; i < 7; i++) {
      box(`greave_${side}_band_${i+1}`, i%2===0 ? "plate_dark" : "plate_main",
        H*0.054, H*0.007, H*0.054, sx*H*0.050, H*(0.043 + i*0.022), 0);
    }
  }

  // 笏笏 SABATONS (armored boots) 笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏
  for (const side of ["L", "R"]) {
    const sx = side === "L" ? -1 : 1;
    box(`sabaton_${side}`,         "plate_main", H*0.052, H*0.018, H*0.094, sx*H*0.050, H*0.012, H*0.020);
    box(`sabaton_${side}_toe`,     "plate_dark", H*0.044, H*0.014, H*0.026, sx*H*0.050, H*0.013, H*0.064);
    for (let i = 0; i < 3; i++) {
      box(`sabaton_${side}_strip_${i+1}`, accentMat, H*0.050, H*0.005, H*0.024,
        sx*H*0.050, H*0.021, H*(0.010 + i*0.024));
    }
  }

  // 笏笏 GREATSWORD (held upright in right hand) 笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏
  // Sword base at right side; tip extends above warrior's head
  const swX = H * 0.180;
  const swZ = H * 0.026;
  // Pommel
  box("sword_pommel",            "gold_trim",  H*0.030, H*0.028, H*0.030, swX, H*0.295, swZ);
  // Grip 窶・long two-handed hilt
  box("sword_grip_lower",        "leather",    H*0.018, H*0.055, H*0.018, swX, H*0.343, swZ);
  box("sword_grip_mid",          "leather",    H*0.018, H*0.025, H*0.018, swX, H*0.370, swZ);
  for (let i = 0; i < 4; i++) {
    box(`sword_grip_wrap_${i+1}`, "cloth_accent", H*0.020, H*0.007, H*0.020, swX, H*(0.326+i*0.017), swZ);
  }
  // Cross-guard
  box("sword_guard_main",        "plate_dark", H*0.010, H*0.018, H*0.010, swX, H*0.390, swZ);
  box("sword_guard_arm_L",       accentMat,    H*0.105, H*0.013, H*0.013, swX - H*0.052, H*0.390, swZ);
  box("sword_guard_arm_R",       accentMat,    H*0.105, H*0.013, H*0.013, swX + H*0.052, H*0.390, swZ);
  box("sword_guard_tip_L",       accentMat,    H*0.012, H*0.020, H*0.012, swX - H*0.100, H*0.390, swZ);
  box("sword_guard_tip_R",       accentMat,    H*0.012, H*0.020, H*0.012, swX + H*0.100, H*0.390, swZ);
  // Ricasso (un-sharpened base above guard)
  box("sword_ricasso",           "plate_dark", H*0.020, H*0.038, H*0.006, swX, H*0.412, swZ);
  // Blade 窶・4 tapered sections
  box("sword_blade_s1",          "sword_blade",H*0.024, H*0.195, H*0.008, swX, H*0.492, swZ);
  box("sword_blade_s2",          "sword_blade",H*0.020, H*0.195, H*0.007, swX, H*0.688, swZ);
  box("sword_blade_s3",          "sword_blade",H*0.016, H*0.175, H*0.006, swX, H*0.878, swZ);
  box("sword_blade_s4",          "sword_blade",H*0.010, H*0.100, H*0.005, swX, H*1.028, swZ);
  // Tip
  box("sword_blade_tip",         accentMat,    H*0.006, H*0.038, H*0.004, swX, H*1.100, swZ);
  // Fuller (blood groove 窶・center ridge down blade)
  box("sword_fuller_low",        "sword_blade",H*0.004, H*0.310, H*0.004, swX, H*0.568, swZ);
  box("sword_fuller_high",       "sword_blade",H*0.003, H*0.260, H*0.003, swX, H*0.848, swZ);

  // 笏笏 BELT + ACCESSORIES 笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏
  box("belt_main",               "leather",    H*0.120, H*0.017, H*0.060, 0, H*0.494, 0);
  box("belt_buckle",             accentMat,    H*0.020, H*0.020, H*0.012, 0, H*0.494, H*0.030);
  box("pouch_L",                 "leather",    H*0.030, H*0.034, H*0.018, -H*0.056, H*0.470, -H*0.014);
  box("pouch_R",                 "leather",    H*0.030, H*0.034, H*0.018,  H*0.056, H*0.470, -H*0.014);
  // Scabbard on left hip (sword is currently drawn)
  box("scabbard_upper",          "leather",    H*0.018, H*0.080, H*0.018, -H*0.076, H*0.418, H*0.015);
  box("scabbard_tip",            accentMat,    H*0.020, H*0.018, H*0.020, -H*0.076, H*0.356, H*0.015);

  // 笏笏 CAPE 笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏
  // Collar bar
  box("cape_collar",             "plate_dark", H*0.120, H*0.014, H*0.010, 0, H*0.798, -H*0.022);
  // 7 columns ﾃ・4 rows of cascading panels
  for (let col = 0; col < 7; col++) {
    const cx = (-0.045 + col * 0.015) * H;
    for (let row = 0; row < 4; row++) {
      const cy = H*(0.776 - row*0.062);
      const cz = -H*(0.026 + row*0.016);
      const ch = H*(0.066 + row*0.005);
      box(`cape_${col+1}_${row+1}`, capeColor, H*0.016, ch, H*0.008, cx, cy, cz);
    }
  }

  // 笏笏 SURFACE DETAIL METADATA 笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏
  const regions   = ["helmet", "breastplate", "backplate", "left_arm", "right_arm",
                     "left_leg", "right_leg", "fauld", "sword_blade", "boots"];
  const detailTypes = ["engraving", "plate_seam", "battle_scratch", "rivet_pattern", "heraldic_motif"];
  let sdIndex = 1;
  for (const region of regions) {
    for (let i = 0; i < 12; i++) {
      pushSurface(`surface_detail_${sdIndex++}`, region,
        detailTypes[i % detailTypes.length],
        0.14 + (i % 6) * 0.07,
        [Math.sin(i) * 0.018, Math.cos(i * 0.8) * 0.014, ((i % 4) - 1.5) * 0.009]);
    }
  }

  spec.parts = parts;
  spec.surfaceDetails = surfaceDetails;
  spec.ornaments = [];
  return spec;
}

// Builder dispatch map 窶・add new subject builders here alongside SUBJECT_REGISTRY.
const SUBJECT_BUILDERS = {
  kaiju:   (...a) => buildKaijuSpec(...a),
  tower:   (...a) => buildTowerSpec(...a),
  airship: (...a) => buildAirshipSpec(...a),
  vehicle: (...a) => buildVehicleSpec(...a),
  structure: (...a) => buildStructureSpec(...a),
  robot:   (...a) => buildRobotSpec(...a),
  castle:  (...a) => buildCastleSpec(...a),
  building:(...a) => buildBuildingSpec(...a),
  warrior: (...a) => buildWarriorSpec(...a),
  giant:   (...a) => buildGiantSpec(...a),
};

function buildSpec(prompt) {
  const subject = inferSubject(prompt);
  const height  = inferHeightMeters(prompt, subject);
  const styles  = inferStyle(prompt, subject);
  const builder = SUBJECT_BUILDERS[subject] ?? SUBJECT_BUILDERS.building;
  return builder(prompt, height, styles);
}

function hexToRgb01(hex) {
  const normalized = hex.replace("#", "");
  const r = parseInt(normalized.slice(0, 2), 16) / 255;
  const g = parseInt(normalized.slice(2, 4), 16) / 255;
  const b = parseInt(normalized.slice(4, 6), 16) / 255;
  return [r, g, b];
}

function createBoxGeometry(width, height, depth, cx, cy, cz) {
  const hw = width / 2;
  const hh = height / 2;
  const hd = depth / 2;

  const positions = [];
  const normals = [];
  const indices = [];

  const faces = [
    { n: [0, 0, 1], v: [[-hw, -hh, hd], [hw, -hh, hd], [hw, hh, hd], [-hw, hh, hd]] },
    { n: [0, 0, -1], v: [[hw, -hh, -hd], [-hw, -hh, -hd], [-hw, hh, -hd], [hw, hh, -hd]] },
    { n: [-1, 0, 0], v: [[-hw, -hh, -hd], [-hw, -hh, hd], [-hw, hh, hd], [-hw, hh, -hd]] },
    { n: [1, 0, 0], v: [[hw, -hh, hd], [hw, -hh, -hd], [hw, hh, -hd], [hw, hh, hd]] },
    { n: [0, 1, 0], v: [[-hw, hh, hd], [hw, hh, hd], [hw, hh, -hd], [-hw, hh, -hd]] },
    { n: [0, -1, 0], v: [[-hw, -hh, -hd], [hw, -hh, -hd], [hw, -hh, hd], [-hw, -hh, hd]] }
  ];

  let vertexOffset = 0;
  for (const face of faces) {
    for (const vert of face.v) {
      positions.push(vert[0] + cx, vert[1] + cy, vert[2] + cz);
      normals.push(face.n[0], face.n[1], face.n[2]);
    }
    indices.push(
      vertexOffset, vertexOffset + 1, vertexOffset + 2,
      vertexOffset, vertexOffset + 2, vertexOffset + 3
    );
    vertexOffset += 4;
  }

  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    indices: new Uint32Array(indices)
  };
}

function createCylinderGeometry(width, height, depth, segments = 16) {
  const rx = width / 2;
  const rz = depth / 2;
  const hh = height / 2;
  const positions = [];
  const normals = [];
  const indices = [];

  for (let i = 0; i < segments; i++) {
    const a0 = (i / segments) * Math.PI * 2;
    const a1 = ((i + 1) / segments) * Math.PI * 2;
    const x0 = Math.cos(a0) * rx;
    const z0 = Math.sin(a0) * rz;
    const x1 = Math.cos(a1) * rx;
    const z1 = Math.sin(a1) * rz;
    const n0 = [Math.cos(a0), 0, Math.sin(a0)];
    const n1 = [Math.cos(a1), 0, Math.sin(a1)];
    const vo = positions.length / 3;

    positions.push(x0, -hh, z0, x1, -hh, z1, x1, hh, z1, x0, hh, z0);
    normals.push(...n0, ...n1, ...n1, ...n0);
    indices.push(vo, vo + 1, vo + 2, vo, vo + 2, vo + 3);

    const top = positions.length / 3;
    positions.push(0, hh, 0, x1, hh, z1, x0, hh, z0);
    normals.push(0, 1, 0, 0, 1, 0, 0, 1, 0);
    indices.push(top, top + 1, top + 2);

    const bottom = positions.length / 3;
    positions.push(0, -hh, 0, x0, -hh, z0, x1, -hh, z1);
    normals.push(0, -1, 0, 0, -1, 0, 0, -1, 0);
    indices.push(bottom, bottom + 1, bottom + 2);
  }

  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    indices: new Uint32Array(indices)
  };
}

function createSphereGeometry(width, height, depth, latSeg = 10, lonSeg = 14) {
  const rx = width / 2;
  const ry = height / 2;
  const rz = depth / 2;
  const positions = [];
  const normals = [];
  const indices = [];

  for (let y = 0; y <= latSeg; y++) {
    const v = y / latSeg;
    const phi = v * Math.PI;
    const sp = Math.sin(phi);
    const cp = Math.cos(phi);
    for (let x = 0; x <= lonSeg; x++) {
      const u = x / lonSeg;
      const theta = u * Math.PI * 2;
      const st = Math.sin(theta);
      const ct = Math.cos(theta);
      const nx = ct * sp;
      const ny = cp;
      const nz = st * sp;
      positions.push(nx * rx, ny * ry, nz * rz);
      normals.push(nx, ny, nz);
    }
  }
  for (let y = 0; y < latSeg; y++) {
    for (let x = 0; x < lonSeg; x++) {
      const a = y * (lonSeg + 1) + x;
      const b = a + lonSeg + 1;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }

  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    indices: new Uint32Array(indices)
  };
}

function createTriPrismGeometry(width, height, depth) {
  const hw = width / 2;
  const hh = height / 2;
  const hd = depth / 2;
  const positions = [];
  const normals = [];
  const indices = [];

  const verts = [
    [-hw, -hh, -hd], [hw, -hh, -hd], [0, hh, -hd],
    [-hw, -hh, hd], [hw, -hh, hd], [0, hh, hd]
  ];

  const addFace = (a, b, c, d = null) => {
    const va = verts[a], vb = verts[b], vc = verts[c];
    const ux = vb[0] - va[0], uy = vb[1] - va[1], uz = vb[2] - va[2];
    const vx = vc[0] - va[0], vy = vc[1] - va[1], vz = vc[2] - va[2];
    const nx = uy * vz - uz * vy;
    const ny = uz * vx - ux * vz;
    const nz = ux * vy - uy * vx;
    const len = Math.hypot(nx, ny, nz) || 1;
    const n = [nx / len, ny / len, nz / len];
    const vo = positions.length / 3;
    const pushV = (i) => {
      positions.push(...verts[i]);
      normals.push(...n);
    };
    pushV(a); pushV(b); pushV(c);
    indices.push(vo, vo + 1, vo + 2);
    if (d !== null) {
      const vo2 = positions.length / 3;
      pushV(a); pushV(c); pushV(d);
      indices.push(vo2, vo2 + 1, vo2 + 2);
    }
  };

  addFace(0, 1, 2);
  addFace(3, 5, 4);
  addFace(0, 3, 4, 1);
  addFace(1, 4, 5, 2);
  addFace(2, 5, 3, 0);

  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    indices: new Uint32Array(indices)
  };
}

function buildDocumentFromSpec(spec) {
  const doc = new Document();
  const root = doc.getRoot();
  const scene = doc.createScene("Scene");
  root.listScenes().push(scene);

  const buffer = doc.createBuffer();
  const materialCache = new Map();

  const getMaterial = (name) => {
    if (materialCache.has(name)) return materialCache.get(name);
    const def = spec.materials[name];
    const mat = doc.createMaterial(name);
    if (def?.baseColor) mat.setBaseColorFactor([...hexToRgb01(def.baseColor), 1]);
    if (typeof def?.roughness === "number") mat.setRoughnessFactor(def.roughness);
    if (typeof def?.metalness === "number") mat.setMetallicFactor(def.metalness);
    if (def?.emissive) mat.setEmissiveFactor(hexToRgb01(def.emissive));
    materialCache.set(name, mat);
    return mat;
  };

  for (const part of spec.parts) {
    const [sx, sy, sz] = part.size;
    const [px, py, pz] = part.position;
    let geom = null;
    if (part.kind === "box") geom = createBoxGeometry(sx, sy, sz, 0, 0, 0);
    else if (part.kind === "cylinder") geom = createCylinderGeometry(sx, sy, sz);
    else if (part.kind === "sphere") geom = createSphereGeometry(sx, sy, sz);
    else if (part.kind === "tri_prism") geom = createTriPrismGeometry(sx, sy, sz);
    if (!geom) continue;

    const positions = doc.createAccessor().setType(Accessor.Type.VEC3).setArray(geom.positions).setBuffer(buffer);
    const normals = doc.createAccessor().setType(Accessor.Type.VEC3).setArray(geom.normals).setBuffer(buffer);
    const indices = doc.createAccessor().setType(Accessor.Type.SCALAR).setArray(geom.indices).setBuffer(buffer);

    const prim = doc.createPrimitive()
      .setAttribute("POSITION", positions)
      .setAttribute("NORMAL", normals)
      .setIndices(indices)
      .setMaterial(getMaterial(part.material));

    const mesh = doc.createMesh(part.id).addPrimitive(prim);
    const node = doc.createNode(part.id).setMesh(mesh).setTranslation([px, py, pz]);

    scene.addChild(node);
  }

  return doc;
}

function createPreviewHtml() {
  return `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Prompt2GLTF Preview</title>
  <style>
    html, body { margin: 0; height: 100%; background: #0f1115; color: #fff; font-family: sans-serif; overflow: hidden; }
    #ui {
      position: absolute;
      top: 12px;
      left: 12px;
      z-index: 20;
      background: rgba(0,0,0,.58);
      padding: 12px 14px;
      border-radius: 12px;
      min-width: 260px;
      line-height: 1.5;
    }
    #status { font-size: 13px; opacity: .92; }
    #hint { font-size: 12px; opacity: .75; margin-top: 6px; }
    #c { width: 100vw; height: 100vh; display: block; }
    code { color: #bfe1ff; }
  </style>
</head>
<body>
  <div id="ui">
    <div><strong>Prompt2GLTF Preview</strong></div>
    <div id="status">Loading model.glb...</div>
    <div id="hint">If the model is blank, open via a local server (not <code>file://</code>)</div>
  </div>
  <canvas id="c"></canvas>

  <script type="importmap">
  {
    "imports": {
      "three": "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js",
      "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/"
    }
  }
  </script>
  <script type="module">
    import * as THREE from "three";
    import { OrbitControls } from "three/addons/controls/OrbitControls.js";
    import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

    const statusEl = document.getElementById("status");
    const canvas = document.getElementById("c");

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0f1115);
    // Fog is set dynamically after model loads (see frameObject)

    const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 10000);
    camera.position.set(120, 120, 180);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.target.set(0, 50, 0);
    controls.update();

    scene.add(new THREE.HemisphereLight(0xffffff, 0x223344, 1.8));
    const dir1 = new THREE.DirectionalLight(0xffffff, 2.4);
    dir1.position.set(180, 260, 140);
    scene.add(dir1);
    const dir2 = new THREE.DirectionalLight(0x88aaff, 1.1);
    dir2.position.set(-120, 90, -160);
    scene.add(dir2);

    scene.add(new THREE.GridHelper(500, 50, 0x4a5666, 0x25303d));

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(600, 600),
      new THREE.MeshStandardMaterial({ color: 0x161a20, roughness: 0.95, metalness: 0.02 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.02;
    scene.add(ground);

    function resize() {
      renderer.setSize(window.innerWidth, window.innerHeight, false);
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
    }
    window.addEventListener("resize", resize);
    resize();

    function frameObject(object) {
      const box = new THREE.Box3().setFromObject(object);
      const size = new THREE.Vector3();
      const center = new THREE.Vector3();
      box.getSize(size);
      box.getCenter(center);
      object.position.x -= center.x;
      object.position.y -= box.min.y;
      object.position.z -= center.z;
      const maxDim = Math.max(size.x, size.y, size.z);
      const dist = Math.max(60, maxDim * 1.8);
      camera.near = Math.max(0.1, maxDim / 500);
      camera.far = Math.max(1000, maxDim * 20);
      camera.updateProjectionMatrix();
      // Set fog proportional to model scale so tall/large models are never obscured
      scene.fog = new THREE.Fog(0x0f1115, dist * 2.0, dist * 8.0);
      camera.position.set(dist * 0.72, size.y * 0.62 + dist * 0.22, dist);
      controls.target.set(0, size.y * 0.42, 0);
      controls.update();
    }

    const loader = new GLTFLoader();
    loader.load(
      "./model.glb",
      (gltf) => {
        try {
          scene.add(gltf.scene);
          frameObject(gltf.scene);
          statusEl.textContent = "model.glb loaded ";
        } catch (e) {
          statusEl.textContent = "Display error: " + e.message;
          console.error(e);
        }
      },
      (evt) => {
        statusEl.textContent = evt.total
          ? "Loading... " + Math.round((evt.loaded / evt.total) * 100) + "%"
          : "Loading... " + Math.round(evt.loaded / 1024) + " KB";
      },
      (err) => {
        console.error(err);
        statusEl.textContent = "Load failed: " + (err.message || err);
      }
    );

    function render() {
      controls.update();
      renderer.render(scene, camera);
      requestAnimationFrame(render);
    }
    render();
  </script>
</body>
</html>`;
}

async function main() {
  const prompt = getArg("--prompt");
  if (!prompt) {
    console.error('Usage: node tools/prompt2gltf/src/index.mjs --prompt "100m邏壹・蟾ｨ莠ｺ繧剃ｽ懊▲縺ｦ"');
    process.exit(1);
  }

  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  const spec = buildSpec(prompt);
  const specPath = path.join(OUTPUT_DIR, "spec.json");
  await fs.writeFile(specPath, JSON.stringify(spec, null, 2), "utf-8");

  const doc = buildDocumentFromSpec(spec);
  const io = new NodeIO();

  const glbPath = path.join(OUTPUT_DIR, "model.glb");
  const gltfPath = path.join(OUTPUT_DIR, "model.gltf");
  await io.write(glbPath, doc);
  await io.write(gltfPath, doc);

  const previewPath = path.join(OUTPUT_DIR, "preview.html");
  await fs.writeFile(previewPath, createPreviewHtml(), "utf-8");

  console.log("Prompt2GLTF generation complete.");
  console.log(`Prompt: ${prompt}`);
  console.log(`Subject: ${spec.promptInterpretation.normalizedSubject || spec.promptInterpretation.subject}`);
  console.log(`Parts: ${spec.parts.length}`);
  console.log(`SurfaceDetails: ${spec.surfaceDetails?.length ?? 0}`);
  console.log(`Ornaments: ${spec.ornaments?.length ?? 0}`);
  console.log(`Output: ${OUTPUT_DIR}`);
  console.log(`- ${specPath}`);
  console.log(`- ${gltfPath}`);
  console.log(`- ${glbPath}`);
  console.log(`- ${previewPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});






