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
const PLUGIN_ROOT = path.resolve(__dirname, "..");
const OUTPUT_DIR  = path.join(PLUGIN_ROOT, "generated");

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

// -- MATERIAL PALETTE ---------------------------------------------------------
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

// -- SUBJECT REGISTRY ---------------------------------------------------------
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
    match: /building|architecture|skyscraper|house|apartment|office|station|airport|terminal|museum|factory|warehouse|stadium|temple|shrine|church|hospital|clinic|police.?station|fire.?station|nursing.?home|school|city.?hall|town.?hall|\u5efa\u7bc9|\u5efa\u7269|\u30d3\u30eb|\u9ad8\u5c64|\u5bb6|\u4f4f\u5b85|\u99c5|\u7a7a\u6e2f|\u7f8e\u8853\u9928|\u5de5\u5834|\u30b9\u30bf\u30b8\u30a2\u30e0|\u5bfa|\u795e\u793e|\u6559\u4f1a|\u75c5\u9662|\u8a3a\u7642\u6240|\u8b66\u5bdf\u7f72|\u6d88\u9632\u7f72|\u8001\u4eba\u30db\u30fc\u30e0|\u4ecb\u8b77\u65bd\u8a2d|\u5b66\u6821|\u5c0f\u5b66\u6821|\u4e2d\u5b66\u6821|\u9ad8\u6821|\u5e02\u5f79\u6240|\u533a\u5f79\u6240|\u753a\u5f79\u5834/iu,
    defaultHeight: () => 90,
    defaultStyle: "civic_architecture",
  },
  {
    id: "human",
    match: /police.?officer|firefighter|nurse|doctor|physician|child|adult|woman|elderly|old.?man|old.?woman|person|human|people|\u8b66\u5bdf\u5b98|\u8b66\u5b98|\u6d88\u9632\u58eb|\u770b\u8b77\u5e2b|\u533b\u5e2b|\u5b50\u3069\u3082|\u5b50\u4f9b|\u5c0f\u5b66\u751f|\u5927\u4eba|\u5973\u6027|\u7537\u6027|\u8001\u4eba|\u9ad8\u9f62\u8005|\u4eba\u9593|\u4eba\u7269/iu,
    defaultHeight: () => 1.7,
    defaultStyle: "realistic_human",
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

  // Hospital bed count → approximate floors → height (≈40 beds/floor, 4.5m/floor)
  const bedM = prompt.match(/(\d+)\s*(?:\u5e8a|\u30d9\u30c3\u30c9|beds?)/iu);
  if (bedM && subject === "building") {
    const floors = Math.max(3, Math.min(15, Math.ceil(Number(bedM[1]) / 40)));
    return Math.round(floors * 4.5);
  }

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

  // Facility buildings
  if (/hospital|clinic|\u75c5\u9662|\u8a3a\u7642\u6240/iu.test(prompt)) tags.push("hospital");
  if (/police.?station|\u8b66\u5bdf\u7f72/iu.test(prompt)) tags.push("police_station");
  if (/fire.?station|\u6d88\u9632\u7f72/iu.test(prompt)) tags.push("fire_station");
  if (/nursing.?home|\u8001\u4eba\u30db\u30fc\u30e0|\u4ecb\u8b77\u65bd\u8a2d/iu.test(prompt)) tags.push("nursing_home");
  if (/school|\u5b66\u6821|\u5c0f\u5b66\u6821|\u4e2d\u5b66\u6821|\u9ad8\u6821/iu.test(prompt)) tags.push("school");
  if (/city.?hall|town.?hall|\u5e02\u5f79\u6240|\u533a\u5f79\u6240|\u753a\u5f79\u5834/iu.test(prompt)) tags.push("city_hall");

  // Human figure types
  if (/police.?officer|\u8b66\u5bdf\u5b98|\u8b66\u5b98/iu.test(prompt)) tags.push("police_officer");
  if (/firefighter|\u6d88\u9632\u58eb/iu.test(prompt)) tags.push("firefighter");
  if (/nurse|\u770b\u8b77\u5e2b/iu.test(prompt)) tags.push("nurse");
  if (/doctor|physician|\u533b\u5e2b/iu.test(prompt)) tags.push("doctor");
  if (/child|\u5b50\u3069\u3082|\u5b50\u4f9b|\u5c0f\u5b66\u751f/iu.test(prompt)) tags.push("child");
  if (/elderly|old.?man|old.?woman|\u8001\u4eba|\u9ad8\u9f62\u8005/iu.test(prompt)) tags.push("elderly");
  if (/woman|\u5973\u6027/iu.test(prompt)) tags.push("woman");

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

  if (subject === "human") {
    const isPolice     = styles.includes("police_officer");
    const isFirefighter= styles.includes("firefighter");
    const isNurse      = styles.includes("nurse");
    const isDoctor     = styles.includes("doctor");
    const isChild      = styles.includes("child");
    const isElderly    = styles.includes("elderly");
    const skinTone = { baseColor: "#C8A888", roughness: 0.78, metalness: 0.00 };
    if (isPolice) return {
      skin:           skinTone,
      uniform_main:   { baseColor: "#1A2850", roughness: 0.70, metalness: 0.05 },
      uniform_dark:   { baseColor: "#0E1830", roughness: 0.72, metalness: 0.04 },
      cap:            { baseColor: "#1A2850", roughness: 0.68, metalness: 0.06 },
      badge:          { baseColor: "#D4A820", roughness: 0.28, metalness: 0.90 },
      belt:           { baseColor: "#1C1C1E", roughness: 0.60, metalness: 0.30 },
      boot:           { baseColor: "#1A1818", roughness: 0.75, metalness: 0.10 },
      button:         { baseColor: "#C8C0A0", roughness: 0.30, metalness: 0.85 }
    };
    if (isFirefighter) return {
      skin:           skinTone,
      uniform_main:   { baseColor: "#C83018", roughness: 0.72, metalness: 0.05 },
      uniform_dark:   { baseColor: "#901C10", roughness: 0.74, metalness: 0.04 },
      helmet:         { baseColor: "#C83018", roughness: 0.55, metalness: 0.20 },
      reflective:     { baseColor: "#F0D820", roughness: 0.50, metalness: 0.30 },
      glove:          { baseColor: "#2A2420", roughness: 0.80, metalness: 0.06 },
      boot:           { baseColor: "#1E1C18", roughness: 0.75, metalness: 0.08 },
      tank:           { baseColor: "#A0A8A4", roughness: 0.40, metalness: 0.80 }
    };
    if (isNurse) return {
      skin:           skinTone,
      uniform_main:   { baseColor: "#E8F0F8", roughness: 0.80, metalness: 0.02 },
      uniform_accent: { baseColor: "#4098D0", roughness: 0.70, metalness: 0.04 },
      cap:            { baseColor: "#F0F4F8", roughness: 0.78, metalness: 0.02 },
      shoe:           { baseColor: "#F0EEE8", roughness: 0.72, metalness: 0.04 },
      stethoscope:    { baseColor: "#2C2C2E", roughness: 0.50, metalness: 0.60 },
      hair:           { baseColor: "#3A2810", roughness: 0.85, metalness: 0.00 }
    };
    if (isDoctor) return {
      skin:           skinTone,
      coat:           { baseColor: "#F4F2EE", roughness: 0.78, metalness: 0.02 },
      coat_dark:      { baseColor: "#D8D6D2", roughness: 0.80, metalness: 0.02 },
      scrubs:         { baseColor: "#4880A8", roughness: 0.72, metalness: 0.03 },
      shoe:           { baseColor: "#1E1C1A", roughness: 0.75, metalness: 0.05 },
      stethoscope:    { baseColor: "#2C2C2E", roughness: 0.50, metalness: 0.60 },
      glasses:        { baseColor: "#2A2A2A", roughness: 0.30, metalness: 0.70 },
      hair:           { baseColor: "#2A2018", roughness: 0.85, metalness: 0.00 }
    };
    if (isChild) return {
      skin:           skinTone,
      shirt:          { baseColor: "#F0D840", roughness: 0.80, metalness: 0.01 },
      pants:          { baseColor: "#3060A8", roughness: 0.78, metalness: 0.02 },
      shoe:           { baseColor: "#C83020", roughness: 0.72, metalness: 0.04 },
      hair:           { baseColor: "#2A1808", roughness: 0.88, metalness: 0.00 },
      backpack:       { baseColor: "#E85020", roughness: 0.75, metalness: 0.03 }
    };
    if (isElderly) return {
      skin:           { baseColor: "#C8A8A0", roughness: 0.82, metalness: 0.00 },
      clothing_main:  { baseColor: "#8888A0", roughness: 0.82, metalness: 0.02 },
      clothing_dark:  { baseColor: "#505060", roughness: 0.84, metalness: 0.02 },
      shoe:           { baseColor: "#3A3028", roughness: 0.80, metalness: 0.04 },
      hair:           { baseColor: "#D8D4D0", roughness: 0.88, metalness: 0.00 },
      cane:           { baseColor: "#7A5030", roughness: 0.80, metalness: 0.10 }
    };
    // Default adult / woman
    return {
      skin:           skinTone,
      clothing_main:  { baseColor: "#4060A0", roughness: 0.78, metalness: 0.02 },
      clothing_light: { baseColor: "#E8E4DC", roughness: 0.80, metalness: 0.01 },
      clothing_dark:  { baseColor: "#282840", roughness: 0.82, metalness: 0.02 },
      shoe:           { baseColor: "#2A2018", roughness: 0.78, metalness: 0.06 },
      hair:           { baseColor: "#201808", roughness: 0.86, metalness: 0.00 },
      accessory:      { baseColor: "#C8A060", roughness: 0.40, metalness: 0.70 }
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

  // Horns  - 5-segment curved horns
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
        [sx * H * 0.16 + dx, H * 0.23, H * 0.016],
        "armor_secondary"
      );
    }
  }

  // Legs
  // Legs — shin bottom set to Y=0 (ground). shin center=H*0.09, foot center=H*0.025
  pushPart("left_thigh",      "box", [H * 0.06,  H * 0.19, H * 0.06],  [-H * 0.05, H * 0.26,  0],        "body_main");
  pushPart("right_thigh",     "box", [H * 0.06,  H * 0.19, H * 0.06],  [ H * 0.05, H * 0.26,  0],        "body_main");
  pushPart("left_knee_guard", "box", [H * 0.07,  H * 0.03, H * 0.07],  [-H * 0.05, H * 0.175, H * 0.01], "accent");
  pushPart("right_knee_guard","box", [H * 0.07,  H * 0.03, H * 0.07],  [ H * 0.05, H * 0.175, H * 0.01], "accent");
  pushPart("left_shin",       "box", [H * 0.055, H * 0.18, H * 0.055], [-H * 0.05, H * 0.09,  0],        "armor_main");
  pushPart("right_shin",      "box", [H * 0.055, H * 0.18, H * 0.055], [ H * 0.05, H * 0.09,  0],        "armor_main");
  pushPart("left_foot",       "box", [H * 0.08,  H * 0.03, H * 0.12],  [-H * 0.05, H * 0.025, H * 0.02], "armor_secondary");
  pushPart("right_foot",      "box", [H * 0.08,  H * 0.03, H * 0.12],  [ H * 0.05, H * 0.025, H * 0.02], "armor_secondary");

  // Toes
  for (let foot of ["left", "right"]) {
    const sx = foot === "left" ? -1 : 1;
    for (let i = 0; i < 4; i++) {
      pushPart(
        `${foot}_toe_${i + 1}`,
        "box",
        [H * 0.014, H * 0.012, H * 0.03],
        [sx * H * (0.032 + i * 0.012), H * 0.018, H * 0.075],
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
        [sx * H * 0.05, H * (0.025 + i * 0.0055), 0],
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

  // -- Shoulder pauldrons (layered plates radiating from shoulder) --
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

  // -- Back spikes (12 spikes protruding from spine, upper to lower) --
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

  // -- Cape (40 overlapping flat panels hanging from upper back) --
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

  // -- Greatsword (right hand) --
  // Grip (handle)
  pushPart("sword_grip", "box",
    [H*0.018, H*0.10, H*0.018],
    [H*0.16, H*0.24, H*0.025],
    "dark_accent");
  // Pommel
  pushPart("sword_pommel", "box",
    [H*0.028, H*0.025, H*0.028],
    [H*0.16, H*0.19, H*0.025],
    "accent");
  // Cross-guard
  pushPart("sword_guard", "box",
    [H*0.09, H*0.018, H*0.022],
    [H*0.16, H*0.30, H*0.025],
    "armor_main");
  // Blade lower
  pushPart("sword_blade_lower", "box",
    [H*0.024, H*0.14, H*0.008],
    [H*0.16, H*0.38, H*0.025],
    "armor_secondary");
  // Blade upper
  pushPart("sword_blade_upper", "box",
    [H*0.016, H*0.12, H*0.006],
    [H*0.16, H*0.51, H*0.025],
    "armor_secondary");
  // Blade tip
  pushPart("sword_blade_tip", "box",
    [H*0.008, H*0.06, H*0.005],
    [H*0.16, H*0.60, H*0.025],
    "accent");
  // Blade fuller (center ridge)
  pushPart("sword_fuller", "box",
    [H*0.004, H*0.26, H*0.004],
    [H*0.16, H*0.46, H*0.025],
    "armor_secondary");

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

  // -- Ground base platform --
  pushPart("base_platform", "box", [H*0.55, H*0.006, H*0.55], [0, H*0.003, 0], "concrete_main");
  pushPart("base_ring",     "box", [H*0.28, H*0.012, H*0.28], [0, H*0.009, 0], "steel_dark");

  // -- Tripod base legs (3 legs at 90°, 210°, 330°) --
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

  // -- Main shaft (stacked tapering box sections, narrowing upward) --
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

  // -- Observation deck 1 (350m = 0.5520H for 634m) --
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

  // -- Observation deck 2 (450m = 0.7098H for 634m) --
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

  // -- Spire (above 0.96H) --
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

  // -- Core body --
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

  // -- Neck (3 segments, leaning forward) --
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

  // -- Head --
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

  // -- Arms (shorter, hunched forward) --
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

  // -- Legs (massive pillars, wide stance) --
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

  // -- Tail (15 tapering segments going backward + slightly down) --
  for (let i = 0; i < 15; i++) {
    const t = i / 14;
    pushPart(`tail_${i+1}`, "box",
      [H*(0.16 - t*0.13), H*(0.12 - t*0.10), H*0.048],
      [0, H*(0.49 - t*0.32), -H*(0.10 + i*0.048)],
      i % 3 === 0 ? "scale_dark" : "hide_main");
  }

  // -- Dorsal spines (12, largest mid-back, tapering toward tail) --
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

  // -- GAS ENVELOPE ------------------------------------------------
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

  // -- HULL / GONDOLA -----------------------------------------------
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

  // -- SUSPENSION STRAPS --------------------------------------------
  const deckTop = hullY + H * 0.051;
  const strapH  = envY - deckTop;
  const strapMidY = deckTop + strapH * 0.5;
  box("strap_fore_L", "rope", H*0.012, rounded(strapH), H*0.012, -H*0.065, strapMidY,  H*0.22);
  box("strap_fore_R", "rope", H*0.012, rounded(strapH), H*0.012,  H*0.065, strapMidY,  H*0.22);
  box("strap_aft_L",  "rope", H*0.012, rounded(strapH), H*0.012, -H*0.065, strapMidY, -H*0.22);
  box("strap_aft_R",  "rope", H*0.012, rounded(strapH), H*0.012,  H*0.065, strapMidY, -H*0.22);

  // -- ENGINE PODS + PROPELLERS -------------------------------------
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

  // -- MASTS + SAILS ------------------------------------------------
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

  // -- STERN FINS + RUDDER ------------------------------------------
  box("rudder",      "wood_dark",  H*0.012, H*0.12,   H*0.10,   0,  hullY + H*0.025, -H*0.41);
  box("fin_port",    "canvas_dark",H*0.10,  H*0.08,   H*0.12,  -H*0.12, envY - H*0.08, -H*0.38);
  box("fin_stbd",    "canvas_dark",H*0.10,  H*0.08,   H*0.12,   H*0.12, envY - H*0.08, -H*0.38);
  box("fin_top",     "canvas_dark",H*0.012, H*0.12,   H*0.12,   0,  envY + H*0.07,   -H*0.38);

  // Helm
  box("helm_post",   "wood_dark",  H*0.012, H*0.06,   H*0.012,  0,  deckTop + H*0.040, -H*0.20);
  box("helm_wheel",  "brass",      H*0.06,  H*0.06,   H*0.008,  0,  deckTop + H*0.072, -H*0.20);

  // -- PROW DETAILS -------------------------------------------------
  box("figurehead",  "gilded",     H*0.030, H*0.060,  H*0.04,   0,  hullY + H*0.040, H*0.42);
  box("prow_lantern","gilded",     H*0.020, H*0.025,  H*0.02,   0,  hullY + H*0.058, H*0.39);
  box("railing_bow_L","brass",     H*0.005, H*0.025,  H*0.15,  -H*0.070, deckTop, H*0.28);
  box("railing_bow_R","brass",     H*0.005, H*0.025,  H*0.15,   H*0.070, deckTop, H*0.28);
  box("railing_aft_L","brass",     H*0.005, H*0.025,  H*0.10,  -H*0.060, deckTop, -H*0.26);
  box("railing_aft_R","brass",     H*0.005, H*0.025,  H*0.10,   H*0.060, deckTop, -H*0.26);

  // -- DECK ACCESSORIES ---------------------------------------------
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
  // Japanese religious / traditional architecture
  if (/kinkaku|golden.?pavilion|\u91d1\u95a3|\u91d1\u95a3\u5bfa/iu.test(prompt)) return "temple_kinkaku";
  if (/ginkaku|\u9280\u95a3|\u9280\u95a3\u5bfa/iu.test(prompt)) return "temple_ginkaku";
  if (/pagoda|\u4e94\u91cd\u5854|\u4e09\u91cd\u5854/iu.test(prompt)) return "temple_pagoda";
  if (/shrine|\u795e\u793e|\u9d25\u5c45/iu.test(prompt)) return "shrine_jp";
  if (/temple|\u5bfa|\u5bfa\u9662|\u4eee\u6bbf|\u91d1\u95a3/iu.test(prompt)) return "temple_jp";

  // Facility buildings (check before generic residential to avoid misclassification)
  if (/hospital|clinic|\u75c5\u9662|\u8a3a\u7642\u6240/iu.test(prompt)) return "facility_hospital";
  if (/police.?station|\u8b66\u5bdf\u7f72/iu.test(prompt)) return "facility_police";
  if (/fire.?station|\u6d88\u9632\u7f72/iu.test(prompt)) return "facility_fire";
  if (/nursing.?home|\u8001\u4eba\u30db\u30fc\u30e0|\u4ecb\u8b77\u65bd\u8a2d/iu.test(prompt)) return "facility_nursing";
  if (/city.?hall|town.?hall|\u5e02\u5f79\u6240|\u533a\u5f79\u6240|\u753a\u5f79\u5834/iu.test(prompt)) return "facility_cityhall";
  if (/\b(elementary|junior.?high|high|senior).?school|\u5c0f\u5b66\u6821|\u4e2d\u5b66\u6821|\u9ad8\u6821/iu.test(prompt)) return "facility_school";
  if (/school|\u5b66\u6821/iu.test(prompt)) return "facility_school";

  // Residential
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
  if (/roppongi.?hills|\u516d\u672c\u6728\u30d2\u30eb\u30ba|skyscraper|supertall|high.?rise|\u8d85\u9ad8\u5c64\u30d3\u30eb|\u30bf\u30ef\u30fc\u30d3\u30eb|\u8d85\u9ad8\u5c64/iu.test(prompt)) return "skyscraper";
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
    building_generic:  { w: 0.48, d: 0.40, body: 0.80, roof: 0.14 },
    campus:            { w: 5.60, d: 4.40, body: 0.78, roof: 0.04 },
    skyscraper:        { w: 0.28, d: 0.24, body: 0.90, roof: 0.04 },
    // Japanese traditional
    temple_kinkaku:    { w: 0.55, d: 0.42, body: 0.72, roof: 0.18 },
    temple_ginkaku:    { w: 0.45, d: 0.38, body: 0.68, roof: 0.22 },
    temple_pagoda:     { w: 0.28, d: 0.28, body: 0.80, roof: 0.14 },
    temple_jp:         { w: 0.90, d: 0.60, body: 0.68, roof: 0.26 },
    shrine_jp:         { w: 0.80, d: 0.55, body: 0.65, roof: 0.28 },
    // Facility buildings
    facility_hospital: { w: 1.20, d: 0.80, body: 0.82, roof: 0.06 },
    facility_police:   { w: 0.90, d: 0.60, body: 0.80, roof: 0.08 },
    facility_fire:     { w: 0.80, d: 0.60, body: 0.78, roof: 0.10 },
    facility_nursing:  { w: 1.00, d: 0.70, body: 0.80, roof: 0.08 },
    facility_cityhall: { w: 1.30, d: 0.70, body: 0.78, roof: 0.10 },
    facility_school:   { w: 1.40, d: 0.60, body: 0.80, roof: 0.08 }
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
      silhouette: archetype === "campus" ? "campus_complex"
        : archetype.startsWith("facility_") ? "civic_public_building"
        : archetype.includes("house") ? "residential_mass"
        : archetype.includes("mansion") ? "grand_residential_mass"
        : "multi_unit_or_civic_mass",
      mood: archetype === "campus" ? "academic"
        : archetype.startsWith("facility_") ? "authoritative_public"
        : styles.includes("dark") ? "dramatic_urban"
        : "inhabited",
      genre: archetype === "campus" ? "academic_campus"
        : archetype === "facility_hospital" ? "medical_facility"
        : archetype === "facility_police" ? "law_enforcement_facility"
        : archetype === "facility_fire" ? "emergency_services_facility"
        : archetype === "facility_nursing" ? "social_welfare_facility"
        : archetype === "facility_cityhall" ? "governmental_facility"
        : archetype === "facility_school" ? "educational_facility"
        : archetype.includes("jp") ? "japanese_residential"
        : "residential_architecture",
      detailDensity: "high",
      bodyLanguage: "static_structure",
      shapeLanguage: ["main_volume", "roof_profile", "entrance", "window_rhythm", "signage"]
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

  // ── Japanese temple / shrine archetypes ────────────────────────────────────
  if (archetype === "temple_kinkaku" || archetype === "temple_ginkaku" || archetype === "temple_pagoda" || archetype === "temple_jp" || archetype === "shrine_jp") {
    const isKinkaku = archetype === "temple_kinkaku";
    const isGinkaku = archetype === "temple_ginkaku";
    const isPagoda  = archetype === "temple_pagoda";
    const isShrine  = archetype === "shrine_jp";

    // Materials
    const goldColor  = "#D4A820";
    const silverColor= "#C0C8C0";
    spec.materials = {
      wall_main:    { baseColor: isKinkaku ? goldColor : isGinkaku ? silverColor : "#C8C0A8", roughness: isKinkaku ? 0.25 : 0.55, metalness: isKinkaku ? 0.88 : isGinkaku ? 0.60 : 0.04 },
      wall_dark:    { baseColor: "#3A2410", roughness: 0.90, metalness: 0.02 },
      lacquer_red:  { baseColor: "#8B1A0A", roughness: 0.62, metalness: 0.08 },
      lacquer_dark: { baseColor: "#3A0E08", roughness: 0.70, metalness: 0.06 },
      roof_tile:    { baseColor: isKinkaku ? "#1E2820" : "#3A3840", roughness: 0.80, metalness: 0.12 },
      roof_copper:  { baseColor: "#4A8060", roughness: 0.55, metalness: 0.60 },
      gold:         { baseColor: goldColor, roughness: 0.22, metalness: 0.92 },
      silver:       { baseColor: silverColor, roughness: 0.28, metalness: 0.86 },
      wood_main:    { baseColor: "#6B3E22", roughness: 0.88, metalness: 0.03 },
      wood_dark:    { baseColor: "#3A2010", roughness: 0.92, metalness: 0.02 },
      stone_base:   { baseColor: "#8A8680", roughness: 0.94, metalness: 0.03 },
      pond_water:   { baseColor: "#2A5070", roughness: 0.08, metalness: 0.80 },
      sand_gravel:  { baseColor: "#C8C0A0", roughness: 0.96, metalness: 0.01 },
      pine_green:   { baseColor: "#2A4820", roughness: 0.92, metalness: 0.01 },
      torii_orange: { baseColor: "#CC4010", roughness: 0.60, metalness: 0.08 }
    };

    // ── Kinkaku-ji (Golden Pavilion) ─────────────────────────────────────────
    if (isKinkaku) {
      // Ground layout: building entrance faces +z direction
      // Kyoko-chi (mirror pond) sits in front (+z), stone path connects entrance to pond
      const pondZ = depth * 2.8;
      box("pond",          "pond_water",  width*3.60, H*0.010, depth*3.20, 0, -H*0.005, pondZ);
      box("pond_rim",      "stone_base",  width*3.68, H*0.016, depth*3.28, 0,  H*0.008, pondZ);
      box("stone_path",    "sand_gravel", width*0.36, H*0.012, depth*1.40, 0,  H*0.006, depth*1.10);
      box("garden_gravel", "sand_gravel", width*2.80, H*0.008, depth*2.20, 0,  0,       -depth*1.60);

      // Stone foundation platform
      box("foundation_stone", "stone_base", width*1.08, H*0.040, depth*1.08, 0, H*0.020, 0);

      // 1F: Hosui-in (法水院) – shinden-zukuri style, natural wood
      const f1Y  = H*0.040;
      const f1H  = bodyHeight * 0.32;
      box("floor1_body",   "wood_main",  width,       f1H,       depth,       0, f1Y + f1H*0.5,  0);
      box("floor1_deck",   "wood_dark",  width*1.14,  H*0.016,   depth*1.14,  0, f1Y + f1H,      0);
      // Veranda pillars (6 front, 6 back)
      for (let p = -2; p <= 2; p++) {
        shape(`pillar_f1_front_${p+3}`, "cylinder", "wood_dark", width*0.030, f1H*0.88, width*0.030,
          p * width*0.22, f1Y + f1H*0.44, depth*0.52);
        shape(`pillar_f1_back_${p+3}`,  "cylinder", "wood_dark", width*0.030, f1H*0.88, width*0.030,
          p * width*0.22, f1Y + f1H*0.44, -depth*0.52);
      }
      // 1F curved hip-gable roof (入母屋)
      box("roof1_main",    "roof_tile",  width*1.24,  H*0.050,   depth*1.24,  0, f1Y+f1H+H*0.025, 0);
      shape("roof1_ridge", "tri_prism",  "roof_tile", width*1.20, H*0.090,    depth*1.18,  0, f1Y+f1H+H*0.042, 0);
      // Eave tips (copper)
      box("eave1_F",       "roof_copper",width*1.26, H*0.012, depth*0.06,  0, f1Y+f1H+H*0.010, depth*0.63);
      box("eave1_B",       "roof_copper",width*1.26, H*0.012, depth*0.06,  0, f1Y+f1H+H*0.010,-depth*0.63);

      // 2F: Choondo (潮音洞) – bukke-zukuri, gold-clad
      // f2Y = top of roof1_main flat eave (f1Y + f1H + eave height H*0.050)
      const f2Y  = f1Y + f1H + H*0.050;
      const f2W  = width * 0.88;
      const f2D  = depth * 0.88;
      const f2H  = bodyHeight * 0.30;
      box("floor2_body",   "wall_main",  f2W,         f2H,       f2D,         0, f2Y + f2H*0.5,  0);
      box("floor2_deck",   "gold",       f2W*1.10,    H*0.014,   f2D*1.10,    0, f2Y + f2H,      0);
      // Lattice windows (gold)
      box("win2_front",    "gold",       f2W*0.72,    f2H*0.48,  f2D*0.04,    0, f2Y + f2H*0.50, f2D*0.48);
      box("win2_back",     "gold",       f2W*0.72,    f2H*0.48,  f2D*0.04,    0, f2Y + f2H*0.50,-f2D*0.48);
      for (let p = -1; p <= 1; p++) {
        shape(`pillar_f2_${p+2}`, "cylinder", "gold", f2W*0.028, f2H*0.90, f2W*0.028,
          p * f2W*0.28, f2Y + f2H*0.45, f2D*0.48);
        shape(`pillar_f2b_${p+2}`,"cylinder", "gold", f2W*0.028, f2H*0.90, f2W*0.028,
          p * f2W*0.28, f2Y + f2H*0.45, -f2D*0.48);
      }
      // 2F roof
      box("roof2_main",    "roof_tile",  f2W*1.20,    H*0.042,   f2D*1.20,    0, f2Y+f2H+H*0.020, 0);
      shape("roof2_ridge", "tri_prism",  "roof_tile", f2W*1.16,  H*0.082,    f2D*1.14,   0, f2Y+f2H+H*0.036, 0);
      box("eave2_F",       "roof_copper",f2W*1.22,    H*0.011,   f2D*0.05,   0, f2Y+f2H+H*0.009, f2D*0.61);
      box("eave2_B",       "roof_copper",f2W*1.22,    H*0.011,   f2D*0.05,   0, f2Y+f2H+H*0.009,-f2D*0.61);

      // 3F: Kukkyocho (究竟頂) – Chinese zen style, full gold, smaller
      // f3Y = top of roof2_main flat eave (f2Y + f2H + eave height H*0.042)
      const f3Y  = f2Y + f2H + H*0.042;
      const f3W  = f2W * 0.74;
      const f3D  = f2D * 0.74;
      const f3H  = bodyHeight * 0.24;
      box("floor3_body",   "wall_main",  f3W,         f3H,       f3D,         0, f3Y + f3H*0.5,  0);
      // 4-sided shoji screens (gold)
      box("shoji_front",   "gold",       f3W*0.80,    f3H*0.52,  f3D*0.04,    0, f3Y + f3H*0.50, f3D*0.48);
      box("shoji_back",    "gold",       f3W*0.80,    f3H*0.52,  f3D*0.04,    0, f3Y + f3H*0.50,-f3D*0.48);
      box("shoji_L",       "gold",       f3W*0.04,    f3H*0.52,  f3D*0.80,   -f3W*0.48, f3Y + f3H*0.50, 0);
      box("shoji_R",       "gold",       f3W*0.04,    f3H*0.52,  f3D*0.80,    f3W*0.48, f3Y + f3H*0.50, 0);
      // Pyramidal roof (宝形造)
      const r3Y    = f3Y + f3H;
      const eave3H = H * 0.035;
      // Flat eave slab: bottom = r3Y, top = r3Y + eave3H
      box("roof3_base",     "roof_tile",  f3W*1.18, eave3H,  f3D*1.18, 0, r3Y + eave3H*0.5, 0);
      // Pyramid: base sits on top of flat eave
      const pyr3H   = H * 0.14;
      const pyr3BaseY = r3Y + eave3H;
      shape("roof3_pyramid","tri_prism","roof_tile", f3W*1.10, pyr3H, f3D*1.08, 0, pyr3BaseY + pyr3H*0.5, 0);
      box("eave3_copper",   "roof_copper", f3W*1.20, H*0.010, f3D*0.05, 0, r3Y + H*0.005, f3D*0.60);

      // Phoenix (鳳凰) directly on pyramid apex – slim finial post only, no sorin rings
      const phoenixBase = pyr3BaseY + pyr3H;
      shape("finial_post",   "cylinder","gold", H*0.010, H*0.055, H*0.010, 0, phoenixBase + H*0.028, 0);
      box("phoenix_body",    "gold", H*0.050, H*0.038, H*0.080, 0, phoenixBase + H*0.066, 0);
      shape("phoenix_wing_L","sphere","gold", H*0.080, H*0.026, H*0.042, -H*0.052, phoenixBase+H*0.068, 0);
      shape("phoenix_wing_R","sphere","gold", H*0.080, H*0.026, H*0.042,  H*0.052, phoenixBase+H*0.068, 0);
      box("phoenix_tail",    "gold", H*0.016, H*0.065, H*0.010, 0, phoenixBase+H*0.038, -H*0.038);

      // Surrounding pine trees — symmetric about x=0, placed around pond and behind
      const treePositions = [
        [-width*2.2,  depth*1.0],   // left, near building
        [ width*2.2,  depth*1.0],   // right, near building
        [-width*2.4,  depth*4.2],   // far left of pond
        [ width*2.4,  depth*4.2],   // far right of pond
        [ 0,         -depth*2.0],   // behind building center
      ];
      for (let t = 0; t < treePositions.length; t++) {
        const [tx, tz] = treePositions[t];
        shape(`pine_trunk_${t}`, "cylinder", "wood_dark", H*0.04, H*0.20, H*0.04, tx, H*0.10, tz);
        shape(`pine_canopy_L_${t}`,"sphere","pine_green", H*0.22,H*0.18,H*0.22, tx-H*0.08, H*0.28, tz);
        shape(`pine_canopy_R_${t}`,"sphere","pine_green", H*0.18,H*0.16,H*0.18, tx+H*0.06, H*0.26, tz);
      }

      // Reflection on pond (flat gold plane) — centered on pond
      box("pond_reflection","gold", width*0.52, H*0.002, depth*0.52, 0, -H*0.001, pondZ);

    } else if (isPagoda) {
      // ── 5-story Pagoda ─────────────────────────────────────────────────────
      box("pagoda_base",  "stone_base",  width*1.30, H*0.04, depth*1.30, 0, H*0.020, 0);
      const floors = 5;
      let py = H*0.040;
      for (let f = 0; f < floors; f++) {
        const fw  = width  * (1.0 - f * 0.14);
        const fd  = depth  * (1.0 - f * 0.14);
        const fh  = bodyHeight / floors * (1.0 - f * 0.06);
        box(`pagoda_body_${f}`,  "wall_main",  fw,       fh,       fd,       0, py + fh*0.5, 0);
        box(`pagoda_eave_${f}`,  "roof_tile",  fw*1.32, H*0.030,  fd*1.32, 0, py + fh,     0);
        shape(`pagoda_roof_${f}`,"tri_prism",  "roof_tile", fw*1.28, H*0.055, fd*1.26, 0, py+fh+H*0.024, 0);
        box(`eave_tip_${f}`,     "roof_copper",fw*1.34, H*0.010,  fd*0.04,  0, py+fh+H*0.008, fd*0.67);
        py += fh + H*0.050;
      }
      // Sorin
      shape("sorin_shaft","cylinder","gold", H*0.016, H*0.30, H*0.016, 0, py + H*0.15, 0);
      for (let i = 0; i < 9; i++) {
        shape(`sorin_ring_${i}`,"sphere","gold", H*0.036, H*0.018, H*0.036, 0, py + H*0.04 + i*H*0.028, 0);
      }

    } else if (isShrine) {
      // ── Shinto Shrine ──────────────────────────────────────────────────────
      // Stone torii gate (approach)
      shape("torii_post_L","cylinder","torii_orange", H*0.060, H*0.58, H*0.060, -width*0.40, H*0.290, depth*1.40);
      shape("torii_post_R","cylinder","torii_orange", H*0.060, H*0.58, H*0.060,  width*0.40, H*0.290, depth*1.40);
      box("torii_kasagi",  "torii_orange", width*0.96, H*0.040, H*0.048, 0, H*0.570, depth*1.40);
      box("torii_nuki",    "torii_orange", width*0.80, H*0.026, H*0.032, 0, H*0.500, depth*1.40);
      // Stone lanterns (komainu approach)
      for (const sx of [-width*0.28, width*0.28]) {
        box(`lantern_post_${sx>0?"R":"L"}`, "stone_base", H*0.040, H*0.22, H*0.040, sx, H*0.11, depth*0.80);
        box(`lantern_top_${sx>0?"R":"L"}`,  "stone_base", H*0.070, H*0.06, H*0.070, sx, H*0.25, depth*0.80);
      }
      // Sandō (参道) approach path
      box("sando",         "sand_gravel", width*0.36, H*0.008, depth*1.80, 0, H*0.004, depth*1.10);
      // Main hall (haiden 拝殿)
      box("foundation",    "stone_base",  width*1.06, H*0.035, depth*1.06, 0, H*0.018, 0);
      box("haiden_body",   "wall_main",   width,      bodyHeight*0.70, depth, 0, H*0.035+bodyHeight*0.35, 0);
      // Haiden pillars
      for (let p = -2; p <= 2; p++) {
        shape(`haiden_pillar_${p+3}`,"cylinder","lacquer_red", width*0.036, bodyHeight*0.68, width*0.036,
          p*width*0.22, H*0.035+bodyHeight*0.34, depth*0.48);
      }
      shape("haiden_roof","tri_prism","roof_tile", width*1.18, roofHeight*0.80, depth*1.12,
        0, H*0.035+bodyHeight*0.72+roofHeight*0.38, 0);
      box("haiden_eave",  "roof_copper", width*1.20, H*0.014, depth*0.05, 0, H*0.035+bodyHeight*0.72+H*0.006, depth*0.58);
      // Honden (本殿) behind
      const hondenY = H*0.035;
      box("honden_body",  "lacquer_red", width*0.56, bodyHeight*0.60, depth*0.50,
        0, hondenY+bodyHeight*0.30, -depth*0.76);
      shape("honden_roof","tri_prism","roof_tile", width*0.64, roofHeight*0.60, depth*0.58,
        0, hondenY+bodyHeight*0.62+roofHeight*0.28, -depth*0.76);
      // Shimenawa rope (注連縄)
      box("shimenawa",    "wood_dark",   width*0.72, H*0.022, H*0.022, 0, H*0.035+bodyHeight*0.82, depth*0.50);

    } else {
      // ── Generic Japanese temple (temple_jp) ────────────────────────────────
      box("stone_steps",  "stone_base",  width*1.12, H*0.040, depth*0.30, 0, H*0.020, depth*0.62);
      box("foundation",   "stone_base",  width*1.06, H*0.035, depth*1.06, 0, H*0.018, 0);
      box("main_body",    "wall_main",   width,      bodyHeight*0.68, depth, 0, H*0.035+bodyHeight*0.34, 0);
      // Engawa (縁側)
      box("engawa",       "wood_dark",   width*1.16, H*0.018, depth*1.16, 0, H*0.035+bodyHeight*0.68, 0);
      // Pillars
      for (let p = -2; p <= 2; p++) {
        shape(`pillar_f_${p+3}`, "cylinder","lacquer_red", width*0.040, bodyHeight*0.66, width*0.040,
          p*width*0.22, H*0.035+bodyHeight*0.33, depth*0.50);
        shape(`pillar_b_${p+3}`, "cylinder","lacquer_red", width*0.040, bodyHeight*0.66, width*0.040,
          p*width*0.22, H*0.035+bodyHeight*0.33, -depth*0.50);
      }
      // Double-layer roof (重層屋根)
      box("roof_lower",   "roof_tile",   width*1.22, H*0.040, depth*1.22, 0, H*0.035+bodyHeight*0.70+H*0.018, 0);
      shape("roof_upper_ridge","tri_prism","roof_tile", width*1.16, roofHeight*0.70, depth*1.12,
        0, H*0.035+bodyHeight*0.72+roofHeight*0.34, 0);
      box("ridge_copper", "roof_copper", width*1.18, H*0.012, depth*0.05,
        0, H*0.035+bodyHeight*0.72+H*0.008, depth*0.60);
      // Upper smaller hall
      box("upper_body",   "wall_main",   width*0.56, bodyHeight*0.30, depth*0.52,
        0, H*0.035+bodyHeight*0.70+roofHeight*0.05+bodyHeight*0.15, 0);
      shape("upper_roof", "tri_prism",   "roof_tile",width*0.64, roofHeight*0.50, depth*0.60,
        0, H*0.035+bodyHeight+roofHeight*0.06+bodyHeight*0.32, 0);
      // Lanterns
      for (const sx of [-width*0.52, width*0.52]) {
        shape(`toro_post_${sx>0?"R":"L"}`, "cylinder","stone_base", H*0.038, H*0.30, H*0.038, sx, H*0.15, depth*0.62);
        box(`toro_top_${sx>0?"R":"L"}`,    "stone_base", H*0.068, H*0.055, H*0.068, sx, H*0.34, depth*0.62);
      }
    }

    // Surface details (shared for all temple types)
    const templeRegions = ["facade", "roof", "pillars", "foundation", "garden"];
    const templeDetails = ["wood_grain", "tile_pattern", "lacquer_gloss", "stone_texture", "moss_growth"];
    let sdIdx = 1;
    for (const rgn of templeRegions) {
      for (let i = 0; i < 8; i++) {
        pushSurface(`surface_detail_${sdIdx++}`, rgn, templeDetails[i % templeDetails.length],
          0.14 + (i%5)*0.06, [Math.sin(i*0.8)*0.016, Math.cos(i*0.7)*0.012, ((i%4)-1.5)*0.010]);
      }
    }
    spec.parts = parts;
    spec.surfaceDetails = surfaceDetails;
    return spec;
  }

  // ── Facility building archetypes ────────────────────────────────────────────
  if (archetype.startsWith("facility_")) {
    const facilityMats = {
      facility_hospital: {
        facade_main:      { baseColor: "#E8EAE4", roughness: 0.88, metalness: 0.04 },
        facade_secondary: { baseColor: "#B0C8D8", roughness: 0.82, metalness: 0.10 },
        roof:             { baseColor: "#8AACBC", roughness: 0.80, metalness: 0.12 },
        glass:            { baseColor: "#7BAED6", roughness: 0.10, metalness: 0.88 },
        accent:           { baseColor: "#2060A0", roughness: 0.60, metalness: 0.20 },
        sign_red:         { baseColor: "#CC2020", roughness: 0.40, metalness: 0.10, emissive: "#CC2020" }
      },
      facility_police: {
        facade_main:      { baseColor: "#D8D4C8", roughness: 0.88, metalness: 0.04 },
        facade_secondary: { baseColor: "#2038A8", roughness: 0.60, metalness: 0.18 },
        roof:             { baseColor: "#1A2870", roughness: 0.75, metalness: 0.15 },
        glass:            { baseColor: "#3A5870", roughness: 0.12, metalness: 0.86 },
        accent:           { baseColor: "#F0D820", roughness: 0.40, metalness: 0.20 },
        sign_blue:        { baseColor: "#1030CC", roughness: 0.30, metalness: 0.10, emissive: "#2040DD" }
      },
      facility_fire: {
        facade_main:      { baseColor: "#D8CFC4", roughness: 0.88, metalness: 0.04 },
        facade_secondary: { baseColor: "#C82020", roughness: 0.60, metalness: 0.15 },
        roof:             { baseColor: "#901818", roughness: 0.75, metalness: 0.18 },
        glass:            { baseColor: "#3A5870", roughness: 0.12, metalness: 0.86 },
        accent:           { baseColor: "#F07820", roughness: 0.38, metalness: 0.18 },
        door_large:       { baseColor: "#CC2010", roughness: 0.55, metalness: 0.30 }
      },
      facility_nursing: {
        facade_main:      { baseColor: "#EEE8DC", roughness: 0.90, metalness: 0.03 },
        facade_secondary: { baseColor: "#C8B898", roughness: 0.88, metalness: 0.04 },
        roof:             { baseColor: "#A89070", roughness: 0.82, metalness: 0.06 },
        glass:            { baseColor: "#7BAED6", roughness: 0.12, metalness: 0.88 },
        accent:           { baseColor: "#70A870", roughness: 0.60, metalness: 0.10 },
        garden:           { baseColor: "#5A8A48", roughness: 0.95, metalness: 0.01 }
      },
      facility_cityhall: {
        facade_main:      { baseColor: "#D4C8A8", roughness: 0.90, metalness: 0.04 },
        facade_secondary: { baseColor: "#8A8070", roughness: 0.92, metalness: 0.03 },
        roof:             { baseColor: "#4A4838", roughness: 0.80, metalness: 0.12 },
        glass:            { baseColor: "#7BAED6", roughness: 0.12, metalness: 0.88 },
        column:           { baseColor: "#C8C4B8", roughness: 0.85, metalness: 0.05 },
        accent:           { baseColor: "#8A6820", roughness: 0.38, metalness: 0.72 }
      },
      facility_school: {
        facade_main:      { baseColor: "#E0D8C0", roughness: 0.88, metalness: 0.04 },
        facade_secondary: { baseColor: "#A89870", roughness: 0.90, metalness: 0.03 },
        roof:             { baseColor: "#607848", roughness: 0.82, metalness: 0.08 },
        glass:            { baseColor: "#7BAED6", roughness: 0.12, metalness: 0.88 },
        accent:           { baseColor: "#487840", roughness: 0.65, metalness: 0.08 },
        yard:             { baseColor: "#A09060", roughness: 0.96, metalness: 0.01 }
      }
    };
    spec.materials = facilityMats[archetype] || facilityMats.facility_hospital;
    const mat = spec.materials;

    const floorH = bodyHeight / Math.max(2, Math.round(H / 4));
    const floors = Math.round(bodyHeight / floorH);

    // Foundation / ground slab
    box("ground_slab", "facade_secondary", width * 1.08, baseHeight, depth * 1.08, 0, baseHeight * 0.5, 0);
    // Main body
    box("main_body", "facade_main", width, bodyHeight, depth, 0, baseHeight + bodyHeight * 0.5, 0);

    // Window bands per floor
    for (let f = 0; f < floors; f++) {
      const fy = baseHeight + (f + 0.5) * floorH;
      box(`win_front_f${f}`, "glass", width * 0.78, floorH * 0.42, depth * 0.03, 0, fy, depth * 0.50);
      box(`win_back_f${f}`,  "glass", width * 0.78, floorH * 0.42, depth * 0.03, 0, fy, -depth * 0.50);
      box(`floor_band_f${f}`, "facade_secondary", width * 1.01, floorH * 0.06, depth * 1.01, 0, baseHeight + f * floorH, 0);
    }

    // Flat roof with parapet
    box("roof_slab",    "roof", width * 1.04, roofHeight * 0.30, depth * 1.04, 0, H - roofHeight * 0.85, 0);
    box("parapet_N",    "facade_secondary", width * 1.02, roofHeight * 0.55, depth * 0.03, 0, H - roofHeight * 0.38, depth * 0.52);
    box("parapet_S",    "facade_secondary", width * 1.02, roofHeight * 0.55, depth * 0.03, 0, H - roofHeight * 0.38, -depth * 0.52);
    box("parapet_W",    "facade_secondary", width * 0.03, roofHeight * 0.55, depth * 1.02, -width * 0.52, H - roofHeight * 0.38, 0);
    box("parapet_E",    "facade_secondary", width * 0.03, roofHeight * 0.55, depth * 1.02,  width * 0.52, H - roofHeight * 0.38, 0);

    // Facility-specific elements
    if (archetype === "facility_hospital") {
      // Cross sign on roof
      box("cross_h", "sign_red", width * 0.22, roofHeight * 0.40, width * 0.06, 0, H + roofHeight * 0.10, 0);
      box("cross_v", "sign_red", width * 0.06, roofHeight * 0.40, width * 0.22, 0, H + roofHeight * 0.10, 0);
      // Emergency entrance canopy
      box("er_canopy",  "facade_secondary", width * 0.44, H * 0.025, depth * 0.20, 0, baseHeight + H * 0.035, depth * 0.56);
      box("er_entrance","glass", width * 0.30, baseHeight * 0.65, depth * 0.06, 0, baseHeight * 0.44, depth * 0.52);
      // Helipad ring outline on roof
      shape("helipad_ring", "cylinder", "accent", width * 0.38, roofHeight * 0.05, width * 0.38, 0, H + roofHeight * 0.02, 0);
    } else if (archetype === "facility_police") {
      // Blue stripe on facade
      box("stripe_top",   "facade_secondary", width * 1.01, bodyHeight * 0.06, depth * 1.01, 0, baseHeight + bodyHeight * 0.92, 0);
      box("stripe_mid",   "facade_secondary", width * 1.01, bodyHeight * 0.04, depth * 1.01, 0, baseHeight + bodyHeight * 0.50, 0);
      // Main entrance
      box("entrance_frame","accent", width * 0.26, baseHeight * 0.80, depth * 0.06, 0, baseHeight * 0.50, depth * 0.52);
      box("entrance_door", "glass", width * 0.18, baseHeight * 0.62, depth * 0.04, 0, baseHeight * 0.40, depth * 0.54);
      // Flag pole
      shape("flagpole", "cylinder", "accent", H * 0.01, H * 0.30, H * 0.01, -width * 0.46, H * 0.15, depth * 0.54);
    } else if (archetype === "facility_fire") {
      // Large vehicle bay doors (3 bays)
      for (let b = -1; b <= 1; b++) {
        box(`bay_door_${b+2}`, "door_large", width * 0.26, baseHeight * 0.85, depth * 0.04,
            b * width * 0.30, baseHeight * 0.50, depth * 0.52);
      }
      // Red stripe
      box("red_stripe", "facade_secondary", width * 1.01, bodyHeight * 0.08, depth * 1.01, 0, baseHeight + bodyHeight * 0.15, 0);
      // Tower (for drying hoses)
      box("hose_tower", "facade_main", width * 0.14, H * 0.60, depth * 0.14, -width * 0.42, H * 0.30, 0);
      box("hose_tower_top", "roof", width * 0.16, H * 0.04, depth * 0.16, -width * 0.42, H * 0.62, 0);
    } else if (archetype === "facility_nursing") {
      // Gentle entrance ramp
      box("entrance_ramp", "facade_secondary", width * 0.32, H * 0.01, depth * 0.24, 0, baseHeight * 0.60, depth * 0.60);
      box("entrance_canopy","facade_secondary", width * 0.40, H * 0.02, depth * 0.16, 0, baseHeight + H * 0.02, depth * 0.52);
      // Garden area
      box("garden_zone",  "garden", width * 0.60, H * 0.01, depth * 0.30, -width * 0.22, 0, -depth * 0.62);
    } else if (archetype === "facility_cityhall") {
      // Columned portico
      for (let c = -2; c <= 2; c++) {
        shape(`portico_col_${c+3}`, "cylinder", "column",
          width * 0.05, bodyHeight * 0.55, width * 0.05,
          c * width * 0.14, baseHeight + bodyHeight * 0.30, depth * 0.50);
      }
      box("portico_roof", "facade_secondary", width * 0.72, bodyHeight * 0.04, depth * 0.10, 0, baseHeight + bodyHeight * 0.57, depth * 0.50);
      shape("pediment", "tri_prism", "facade_main", width * 0.68, bodyHeight * 0.12, depth * 0.08, 0, baseHeight + bodyHeight * 0.62, depth * 0.50);
      // Flag pole (center roof)
      shape("flagpole", "cylinder", "accent", H * 0.01, H * 0.28, H * 0.01, 0, H * 1.14, 0);
    } else if (archetype === "facility_school") {
      // Long corridor wing
      box("wing_L", "facade_main", width * 0.30, bodyHeight * 0.80, depth, -width * 0.66, baseHeight + bodyHeight * 0.40, 0);
      // Gymnasium / gym volume
      box("gym_block", "facade_secondary", width * 0.44, bodyHeight * 0.70, depth * 0.52, width * 0.56, baseHeight + bodyHeight * 0.38, -depth * 0.26);
      // School yard
      box("school_yard", "yard", width * 1.20, H * 0.01, depth * 0.90, 0, 0, -depth * 0.92);
      // Entrance gate posts
      shape("gate_L", "cylinder", "accent", H * 0.03, H * 0.12, H * 0.03, -width * 0.22, H * 0.06, -depth * 0.46);
      shape("gate_R", "cylinder", "accent", H * 0.03, H * 0.12, H * 0.03,  width * 0.22, H * 0.06, -depth * 0.46);
    }

    // Surface details
    const facRegions = ["facade", "roof", "entrance", "windows"];
    const facDetails = ["panel_seam", "window_grid", "weathering", "trim_line", "tile_pattern"];
    let sdIdx = 1;
    for (const rgn of facRegions) {
      for (let i = 0; i < 8; i++) {
        pushSurface(`surface_detail_${sdIdx++}`, rgn, facDetails[i % facDetails.length],
          0.14 + (i % 5) * 0.06,
          [Math.sin(i*0.8)*0.018, Math.cos(i*0.7)*0.014, ((i%4)-1.5)*0.010]);
      }
    }
    spec.parts = parts;
    spec.surfaceDetails = surfaceDetails;
    return spec;
  }

  // ── Skyscraper (Roppongi Hills / modern supertall high-rise) ───────────────
  if (archetype === "skyscraper") {
    spec.materials = {
      glass_dark:    { baseColor: "#1E2E3A", roughness: 0.06, metalness: 0.92 },
      glass_light:   { baseColor: "#5888AA", roughness: 0.10, metalness: 0.86 },
      concrete_main: { baseColor: "#B8B6B0", roughness: 0.88, metalness: 0.06 },
      concrete_dark: { baseColor: "#787672", roughness: 0.90, metalness: 0.05 },
      granite_base:  { baseColor: "#2E2C28", roughness: 0.82, metalness: 0.14 },
      steel_frame:   { baseColor: "#8090A0", roughness: 0.42, metalness: 0.74 },
      crown_metal:   { baseColor: "#C8C090", roughness: 0.28, metalness: 0.88 },
      lobby_glass:   { baseColor: "#A0C0D8", roughness: 0.05, metalness: 0.94 },
    };

    // ── Podium (wide commercial/retail base) ──────────────────────────────
    const podH = H * 0.10;
    const podW = H * 0.54;
    const podD = H * 0.46;
    box("podium_body",    "granite_base", podW,        podH,       podD,        0,         podH*0.5,       0);
    box("podium_glass_f", "lobby_glass",  podW*0.68,   podH*0.60,  podD*0.03,   0,         podH*0.36,      podD*0.50);
    box("podium_glass_b", "lobby_glass",  podW*0.68,   podH*0.60,  podD*0.03,   0,         podH*0.36,     -podD*0.50);
    box("podium_glass_l", "lobby_glass",  podW*0.03,   podH*0.60,  podD*0.56,  -podW*0.50, podH*0.36,      0);
    box("podium_glass_r", "lobby_glass",  podW*0.03,   podH*0.60,  podD*0.56,   podW*0.50, podH*0.36,      0);
    box("podium_roof",    "concrete_dark",podW*1.02,   H*0.007,    podD*1.02,   0,         podH+H*0.0035,  0);

    // ── Lower Tower (podH → H*0.52) ──────────────────────────────────────
    const t1Bot = podH;
    const t1Top = H * 0.52;
    const t1H   = t1Top - t1Bot;
    const t1W   = H * 0.26;
    const t1D   = H * 0.22;
    box("tower1_body",  "concrete_main", t1W,        t1H,        t1D,         0,          t1Bot+t1H*0.5,  0);
    box("curtain1_f",   "glass_dark",    t1W*0.88,   t1H*0.96,   t1D*0.03,    0,          t1Bot+t1H*0.5,  t1D*0.50);
    box("curtain1_b",   "glass_dark",    t1W*0.88,   t1H*0.96,   t1D*0.03,    0,          t1Bot+t1H*0.5, -t1D*0.50);
    box("curtain1_l",   "glass_dark",    t1W*0.03,   t1H*0.96,   t1D*0.88,   -t1W*0.50,  t1Bot+t1H*0.5,  0);
    box("curtain1_r",   "glass_dark",    t1W*0.03,   t1H*0.96,   t1D*0.88,    t1W*0.50,  t1Bot+t1H*0.5,  0);
    const t1Floors = Math.round(t1H / 3.6);
    for (let f = 0; f < t1Floors; f++) {
      const fy = t1Bot + (f + 1) * (t1H / t1Floors);
      box(`t1_band_${f}`, "steel_frame", t1W*1.02, H*0.005, t1D*1.02, 0, fy, 0);
    }
    box("setback1_ledge", "concrete_dark", t1W*1.10, H*0.014, t1D*1.10, 0, t1Top+H*0.007, 0);

    // ── Mid Tower (H*0.534 → H*0.76) ─────────────────────────────────────
    const t2Bot = t1Top + H*0.014;
    const t2Top = H * 0.76;
    const t2H   = t2Top - t2Bot;
    const t2W   = H * 0.185;
    const t2D   = H * 0.160;
    box("tower2_body",  "concrete_main", t2W,        t2H,        t2D,         0,          t2Bot+t2H*0.5,  0);
    box("curtain2_f",   "glass_light",   t2W*0.88,   t2H*0.96,   t2D*0.03,    0,          t2Bot+t2H*0.5,  t2D*0.50);
    box("curtain2_b",   "glass_light",   t2W*0.88,   t2H*0.96,   t2D*0.03,    0,          t2Bot+t2H*0.5, -t2D*0.50);
    box("curtain2_l",   "glass_light",   t2W*0.03,   t2H*0.96,   t2D*0.88,   -t2W*0.50,  t2Bot+t2H*0.5,  0);
    box("curtain2_r",   "glass_light",   t2W*0.03,   t2H*0.96,   t2D*0.88,    t2W*0.50,  t2Bot+t2H*0.5,  0);
    const t2Floors = Math.round(t2H / 3.6);
    for (let f = 0; f < t2Floors; f++) {
      const fy = t2Bot + (f + 1) * (t2H / t2Floors);
      box(`t2_band_${f}`, "steel_frame", t2W*1.02, H*0.004, t2D*1.02, 0, fy, 0);
    }
    box("setback2_ledge", "concrete_dark", t2W*1.10, H*0.012, t2D*1.10, 0, t2Top+H*0.006, 0);

    // ── Upper Tower (H*0.772 → H*0.90) ───────────────────────────────────
    const t3Bot = t2Top + H*0.012;
    const t3Top = H * 0.90;
    const t3H   = t3Top - t3Bot;
    const t3W   = H * 0.130;
    const t3D   = H * 0.118;
    box("tower3_body",  "concrete_main", t3W,        t3H,        t3D,         0,          t3Bot+t3H*0.5,  0);
    box("curtain3_f",   "glass_dark",    t3W*0.88,   t3H*0.96,   t3D*0.03,    0,          t3Bot+t3H*0.5,  t3D*0.50);
    box("curtain3_b",   "glass_dark",    t3W*0.88,   t3H*0.96,   t3D*0.03,    0,          t3Bot+t3H*0.5, -t3D*0.50);
    box("curtain3_l",   "glass_dark",    t3W*0.03,   t3H*0.96,   t3D*0.88,   -t3W*0.50,  t3Bot+t3H*0.5,  0);
    box("curtain3_r",   "glass_dark",    t3W*0.03,   t3H*0.96,   t3D*0.88,    t3W*0.50,  t3Bot+t3H*0.5,  0);
    const t3Floors = Math.round(t3H / 3.6);
    for (let f = 0; f < t3Floors; f++) {
      const fy = t3Bot + (f + 1) * (t3H / t3Floors);
      box(`t3_band_${f}`, "steel_frame", t3W*1.02, H*0.004, t3D*1.02, 0, fy, 0);
    }

    // ── Crown / Observation deck + Spire (H*0.90 → H) ────────────────────
    const crBot = t3Top;
    const crH   = H - crBot;
    const crW   = t3W * 0.88;
    const crD   = t3D * 0.88;
    box("crown_body",    "crown_metal",  crW,        crH*0.56,   crD,         0,          crBot+crH*0.28, 0);
    box("crown_glass_f", "lobby_glass",  crW*0.80,   crH*0.44,   crD*0.03,    0,          crBot+crH*0.28, crD*0.50);
    box("crown_glass_b", "lobby_glass",  crW*0.80,   crH*0.44,   crD*0.03,    0,          crBot+crH*0.28,-crD*0.50);
    box("obs_deck",      "steel_frame",  crW*1.06,   H*0.010,    crD*1.06,    0,          crBot+crH*0.56, 0);
    shape("spire",       "cylinder",     "steel_frame", H*0.010, crH*0.48, H*0.010, 0, crBot+crH*0.80, 0);
    box("spire_tip",     "crown_metal",  H*0.020,    H*0.008,    H*0.020,     0,          crBot+crH*1.02, 0);

    // Surface details
    const skyRegions = ["facade", "glass", "curtain", "crown", "podium"];
    const skyDetails = ["window_grid", "panel_seam", "reflection_streak", "trim_line"];
    let sdIdx = 1;
    for (let i = 0; i < 40; i++) {
      pushSurface(`surface_detail_${sdIdx++}`, skyRegions[i % skyRegions.length], skyDetails[i % skyDetails.length],
        0.14 + (i % 5) * 0.04, [Math.sin(i*0.6)*0.014, Math.cos(i*0.7)*0.011, ((i%4)-1.5)*0.009]);
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
    // ── Site ground slab ──────────────────────────────────────────────────────
    box("site_slab",        "asphalt",   H*3.60, H*0.012, H*2.80,   0,        H*0.006,  0);
    box("perimeter_fence_N","steel",     H*3.60, H*0.060, H*0.018,  0,        H*0.030,  H*1.38);
    box("perimeter_fence_S","steel",     H*3.60, H*0.060, H*0.018,  0,        H*0.030, -H*1.38);
    box("perimeter_fence_W","steel",     H*0.018,H*0.060, H*2.80,  -H*1.78,   H*0.030,  0);
    box("perimeter_fence_E","steel",     H*0.018,H*0.060, H*2.80,   H*1.78,   H*0.030,  0);

    // ── Hall A – main server hall (left-front) ────────────────────────────────
    box("hallA_body",       "concrete",  H*0.78, H*0.44, H*0.58,  -H*0.90,   H*0.22,  -H*0.48);
    box("hallA_roof_lip",   "steel",     H*0.80, H*0.028,H*0.60,  -H*0.90,   H*0.454, -H*0.48);
    box("hallA_vent_strip", "steel",     H*0.72, H*0.05, H*0.04,  -H*0.90,   H*0.46,  -H*0.22);

    // ── Hall B – secondary server hall (right-front) ──────────────────────────
    box("hallB_body",       "concrete",  H*0.78, H*0.44, H*0.58,   H*0.90,   H*0.22,  -H*0.48);
    box("hallB_roof_lip",   "steel",     H*0.80, H*0.028,H*0.60,   H*0.90,   H*0.454, -H*0.48);
    box("hallB_vent_strip", "steel",     H*0.72, H*0.05, H*0.04,   H*0.90,   H*0.46,  -H*0.22);

    // ── Hall C – network/operations hall (rear-centre) ────────────────────────
    box("hallC_body",       "concrete",  H*1.10, H*0.52, H*0.72,   0,        H*0.26,   H*0.50);
    box("hallC_roof_lip",   "steel",     H*1.12, H*0.028,H*0.74,   0,        H*0.534,  H*0.50);
    box("hallC_glass_band", "glass",     H*1.00, H*0.10, H*0.016,  0,        H*0.20,  -H*0.12); // lobby window strip

    // ── Hall D – storage / tape library (far right rear) ─────────────────────
    box("hallD_body",       "concrete",  H*0.52, H*0.38, H*0.54,   H*1.30,   H*0.19,   H*0.52);
    box("hallD_roof_lip",   "steel",     H*0.54, H*0.022,H*0.56,   H*1.30,   H*0.391,  H*0.52);

    // ── Cooling towers block (rear-right) ─────────────────────────────────────
    for (let i = 0; i < 4; i++) {
      const cx = H * (0.48 + i * 0.28);
      box(`cooling_${i+1}`,     "steel",  H*0.20, H*0.36, H*0.20,   cx,       H*0.18,   H*1.10);
      box(`cooling_cap_${i+1}`, "steel",  H*0.22, H*0.04, H*0.22,   cx,       H*0.38,   H*1.10);
    }

    // ── Backup generator wing (left rear) ────────────────────────────────────
    box("gen_hall",         "concrete",  H*0.44, H*0.32, H*0.36,  -H*1.20,   H*0.16,   H*0.88);
    box("gen_exhaust_1",    "steel",     H*0.06, H*0.26, H*0.06,  -H*1.08,   H*0.30,   H*0.74);
    box("gen_exhaust_2",    "steel",     H*0.06, H*0.26, H*0.06,  -H*1.22,   H*0.30,   H*0.74);
    box("gen_exhaust_3",    "steel",     H*0.06, H*0.26, H*0.06,  -H*1.36,   H*0.30,   H*0.74);

    // ── UPS / power substation (front-left) ──────────────────────────────────
    box("ups_hall",         "concrete",  H*0.30, H*0.28, H*0.24,  -H*1.44,   H*0.14,  -H*0.88);
    box("transformer_1",    "steel",     H*0.10, H*0.18, H*0.10,  -H*1.28,   H*0.09,  -H*0.90);
    box("transformer_2",    "steel",     H*0.10, H*0.18, H*0.10,  -H*1.14,   H*0.09,  -H*0.90);

    // ── Internal roads / loading docks ────────────────────────────────────────
    box("road_main",        "asphalt",   H*3.20, H*0.014, H*0.18,  0,        H*0.007,  H*0.02);
    box("road_side",        "asphalt",   H*0.18, H*0.014, H*2.40,  -H*1.55,  H*0.007,  0);
    box("dock_A",           "concrete",  H*0.30, H*0.06,  H*0.10,  -H*0.90,  H*0.03,  -H*0.78);
    box("dock_B",           "concrete",  H*0.30, H*0.06,  H*0.10,   H*0.90,  H*0.03,  -H*0.78);

    // ── Security / entry gatehouse ────────────────────────────────────────────
    box("gatehouse",        "concrete",  H*0.14, H*0.20, H*0.12,   0,        H*0.10,  -H*1.28);
    box("gate_boom_L",      "steel",     H*0.28, H*0.018,H*0.018, -H*0.22,   H*0.18,  -H*1.28);
    box("gate_boom_R",      "steel",     H*0.28, H*0.018,H*0.018,  H*0.22,   H*0.18,  -H*1.28);

    // ── Antenna / comms mast (roof of Hall C) ────────────────────────────────
    box("comms_mast",       "steel",     H*0.028,H*0.44, H*0.028,  H*0.30,   H*0.74,   H*0.50);
    box("comms_dish",       "steel",     H*0.12, H*0.04, H*0.10,   H*0.30,   H*0.96,   H*0.50);

    // ── Status / warning lights ───────────────────────────────────────────────
    box("light_A",          "signal_green", H*0.03,H*0.03,H*0.03, -H*0.90,   H*0.46,  -H*0.78);
    box("light_B",          "signal_green", H*0.03,H*0.03,H*0.03,  H*0.90,   H*0.46,  -H*0.78);
    box("light_C",          "signal_red",   H*0.03,H*0.03,H*0.03,  H*1.30,   H*0.40,   H*0.25);
    box("light_mast",       "signal_yellow",H*0.03,H*0.12,H*0.03,  0,        H*0.58,   H*0.50);
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
  // H = total standing height (default 2 m  - human scale)
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

  // -- CORE BODY (chainmail under-layer) ----------------------------
  box("body_pelvis",         "chainmail",   H*0.100, H*0.065, H*0.080,  0,       H*0.468, 0);
  box("body_abdomen",        "chainmail",   H*0.100, H*0.060, H*0.075,  0,       H*0.532, 0);
  box("body_torso",          "cloth",       H*0.130, H*0.100, H*0.085,  0,       H*0.620, 0);
  box("body_chest",          "chainmail",   H*0.140, H*0.075, H*0.090,  0,       H*0.718, 0);
  box("body_neck",           "chainmail",   H*0.040, H*0.038, H*0.040,  0,       H*0.820, 0);

  // -- HELMET -------------------------------------------------------
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

  // -- GORGET (neck guard) -------------------------------------------
  box("gorget_front",        "plate_main",  H*0.060, H*0.020, H*0.038,  0,       H*0.838, H*0.018);
  box("gorget_back",         "plate_dark",  H*0.055, H*0.018, H*0.028,  0,       H*0.838, -H*0.015);
  box("gorget_L",            "plate_main",  H*0.018, H*0.020, H*0.032, -H*0.032, H*0.838, 0);
  box("gorget_R",            "plate_main",  H*0.018, H*0.020, H*0.032,  H*0.032, H*0.838, 0);

  // -- BREASTPLATE ---------------------------------------------------
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

  // -- BACKPLATE -----------------------------------------------------
  box("back_main",           "plate_dark",  H*0.128, H*0.108, H*0.028,  0,       H*0.710, -H*0.020);
  box("back_lower",          "plate_dark",  H*0.110, H*0.048, H*0.024,  0,       H*0.628, -H*0.018);
  box("back_trim",           accentMat,     H*0.125, H*0.007, H*0.007,  0,       H*0.810, -H*0.018);

  // -- FAULD (waist skirt  - 10 overlapping plates) -------------------
  for (let i = 0; i < 10; i++) {
    const angle = ((i - 4.5) / 10) * Math.PI * 0.85;
    const x = Math.sin(angle) * H * 0.054;
    const z = Math.cos(angle) * H * 0.022 - H*0.002;
    const w = H * 0.027;
    const y = H * (0.508 - Math.abs(angle) * 0.010);
    box(`fauld_${i+1}`, i%2===0 ? "plate_dark" : "plate_main", w, H*0.055, H*0.018, x, y, z);
  }

  // -- PAULDRONS (shoulder plates) -----------------------------------
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

  // -- UPPER ARMS ---------------------------------------------------
  for (const side of ["L", "R"]) {
    const sx = side === "L" ? -1 : 1;
    box(`uarm_${side}`,            "plate_main", H*0.048, H*0.108, H*0.048, sx*H*0.155, H*0.718, 0);
    for (let i = 0; i < 6; i++) {
      box(`uarm_${side}_band_${i+1}`, i%2===0 ? "plate_dark" : "plate_main",
        H*0.052, H*0.009, H*0.052, sx*H*0.155, H*(0.683 + i*0.019), 0);
    }
  }

  // -- ELBOW GUARDS -------------------------------------------------
  for (const side of ["L", "R"]) {
    const sx = side === "L" ? -1 : 1;
    box(`elbow_${side}`,           "plate_main", H*0.058, H*0.024, H*0.058, sx*H*0.155, H*0.604, 0);
    box(`elbow_${side}_spike`,     accentMat,    H*0.012, H*0.034, H*0.012, sx*H*0.155, H*0.598, H*0.030);
  }

  // -- VAMBRACES (forearm guards) ------------------------------------
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

  // -- GAUNTLETS -----------------------------------------------------
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

  // -- TASSETS (upper thigh guards hanging from fauld) ---------------
  for (const side of ["L", "R"]) {
    const sx = side === "L" ? -1 : 1;
    for (let i = 0; i < 3; i++) {
      box(`tasset_${side}_${i+1}`, i%2===0 ? "plate_main" : "plate_dark",
        H*0.050, H*0.038, H*0.022, sx*H*0.050, H*(0.444 - i*0.038), H*0.010);
    }
  }

  // -- THIGHS -------------------------------------------------------
  for (const side of ["L", "R"]) {
    const sx = side === "L" ? -1 : 1;
    box(`thigh_${side}`,           "plate_main", H*0.054, H*0.138, H*0.054, sx*H*0.050, H*0.338, 0);
    for (let i = 0; i < 8; i++) {
      box(`thigh_${side}_band_${i+1}`, i%2===0 ? "plate_dark" : "plate_main",
        H*0.058, H*0.008, H*0.058, sx*H*0.050, H*(0.268 + i*0.018), 0);
    }
  }

  // -- KNEE GUARDS ---------------------------------------------------
  for (const side of ["L", "R"]) {
    const sx = side === "L" ? -1 : 1;
    box(`knee_${side}`,            "plate_main", H*0.064, H*0.028, H*0.058, sx*H*0.050, H*0.216, H*0.008);
    box(`knee_${side}_rim`,        accentMat,    H*0.064, H*0.007, H*0.007, sx*H*0.050, H*0.228, H*0.010);
  }

  // -- GREAVES (shins) -----------------------------------------------
  for (const side of ["L", "R"]) {
    const sx = side === "L" ? -1 : 1;
    box(`greave_${side}`,          "plate_main", H*0.050, H*0.148, H*0.050, sx*H*0.050, H*0.114, 0);
    box(`greave_${side}_back`,     "plate_dark", H*0.044, H*0.138, H*0.018, sx*H*0.050, H*0.114, -H*0.030);
    for (let i = 0; i < 7; i++) {
      box(`greave_${side}_band_${i+1}`, i%2===0 ? "plate_dark" : "plate_main",
        H*0.054, H*0.007, H*0.054, sx*H*0.050, H*(0.043 + i*0.022), 0);
    }
  }

  // -- SABATONS (armored boots) --------------------------------------
  for (const side of ["L", "R"]) {
    const sx = side === "L" ? -1 : 1;
    box(`sabaton_${side}`,         "plate_main", H*0.052, H*0.018, H*0.094, sx*H*0.050, H*0.012, H*0.020);
    box(`sabaton_${side}_toe`,     "plate_dark", H*0.044, H*0.014, H*0.026, sx*H*0.050, H*0.013, H*0.064);
    for (let i = 0; i < 3; i++) {
      box(`sabaton_${side}_strip_${i+1}`, accentMat, H*0.050, H*0.005, H*0.024,
        sx*H*0.050, H*0.021, H*(0.010 + i*0.024));
    }
  }

  // -- GREATSWORD (held upright in right hand) -----------------------
  // Sword base at right side; tip extends above warrior's head
  const swX = H * 0.180;
  const swZ = H * 0.026;
  // Pommel
  box("sword_pommel",            "gold_trim",  H*0.030, H*0.028, H*0.030, swX, H*0.295, swZ);
  // Grip  - long two-handed hilt
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
  // Blade  - 4 tapered sections
  box("sword_blade_s1",          "sword_blade",H*0.024, H*0.195, H*0.008, swX, H*0.492, swZ);
  box("sword_blade_s2",          "sword_blade",H*0.020, H*0.195, H*0.007, swX, H*0.688, swZ);
  box("sword_blade_s3",          "sword_blade",H*0.016, H*0.175, H*0.006, swX, H*0.878, swZ);
  box("sword_blade_s4",          "sword_blade",H*0.010, H*0.100, H*0.005, swX, H*1.028, swZ);
  // Tip
  box("sword_blade_tip",         accentMat,    H*0.006, H*0.038, H*0.004, swX, H*1.100, swZ);
  // Fuller (blood groove  - center ridge down blade)
  box("sword_fuller_low",        "sword_blade",H*0.004, H*0.310, H*0.004, swX, H*0.568, swZ);
  box("sword_fuller_high",       "sword_blade",H*0.003, H*0.260, H*0.003, swX, H*0.848, swZ);

  // -- BELT + ACCESSORIES --------------------------------------------
  box("belt_main",               "leather",    H*0.120, H*0.017, H*0.060, 0, H*0.494, 0);
  box("belt_buckle",             accentMat,    H*0.020, H*0.020, H*0.012, 0, H*0.494, H*0.030);
  box("pouch_L",                 "leather",    H*0.030, H*0.034, H*0.018, -H*0.056, H*0.470, -H*0.014);
  box("pouch_R",                 "leather",    H*0.030, H*0.034, H*0.018,  H*0.056, H*0.470, -H*0.014);
  // Scabbard on left hip (sword is currently drawn)
  box("scabbard_upper",          "leather",    H*0.018, H*0.080, H*0.018, -H*0.076, H*0.418, H*0.015);
  box("scabbard_tip",            accentMat,    H*0.020, H*0.018, H*0.020, -H*0.076, H*0.356, H*0.015);

  // -- CAPE ----------------------------------------------------------
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

  // -- SURFACE DETAIL METADATA ---------------------------------------
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

// =============================== HUMAN SPEC BUILDER ============================
// Generates a high-density articulated human figure spec.
// Supports: police_officer, firefighter, nurse, doctor, child, elderly, woman, adult.
// Height (H) represents the total body height in meters (default ~1.7m for adult).
function buildHumanSpec(prompt, height, styles) {
  const H = height;
  const base = buildHighDensityMeta(prompt, "human", H, styles);
  styles._prompt = prompt;

  const isPolice      = styles.includes("police_officer");
  const isFirefighter = styles.includes("firefighter");
  const isNurse       = styles.includes("nurse");
  const isDoctor      = styles.includes("doctor");
  const isChild       = styles.includes("child");
  const isElderly     = styles.includes("elderly");
  const isWoman       = styles.includes("woman");

  // Body proportion scaling
  const scale = isChild ? 0.70 : isElderly ? 0.95 : 1.0;
  const sH = H * scale;

  // Canonical proportions (fraction of total height)
  const prop = {
    headH:   sH * 0.130,  headW:  sH * 0.110,  headD:  sH * 0.100,
    neckH:   sH * 0.040,  neckR:  sH * 0.030,
    torsoH:  sH * 0.300,  torsoW: sH * 0.240,  torsoD: sH * 0.140,
    hipH:    sH * 0.120,  hipW:   sH * 0.220,  hipD:   sH * 0.130,
    upperAH: sH * 0.160,  upperAW:sH * 0.070,  upperAD:sH * 0.065,
    lowerAH: sH * 0.150,  lowerAW:sH * 0.055,  lowerAD:sH * 0.050,
    handH:   sH * 0.060,  handW:  sH * 0.060,  handD:  sH * 0.030,
    thighH:  sH * 0.240,  thighW: sH * 0.090,  thighD: sH * 0.088,
    shinH:   sH * 0.220,  shinW:  sH * 0.068,  shinD:  sH * 0.066,
    footH:   sH * 0.040,  footW:  sH * 0.068,  footD:  sH * 0.150
  };

  // Y offsets (bottom of feet = 0)
  const yFoot  = 0;
  const yShin  = yFoot  + prop.footH;
  const yThigh = yShin  + prop.shinH;
  const yHip   = yThigh + prop.thighH;
  const yTorso = yHip   + prop.hipH;
  const yNeck  = yTorso + prop.torsoH;
  const yHead  = yNeck  + prop.neckH;

  const spec = {
    ...base,
    promptInterpretation: {
      ...base.promptInterpretation,
      humanType: isPolice ? "police_officer"
        : isFirefighter ? "firefighter"
        : isNurse ? "nurse"
        : isDoctor ? "doctor"
        : isChild ? "child"
        : isElderly ? "elderly"
        : isWoman ? "woman"
        : "adult",
    },
    globalScale: { height: sH, width: prop.torsoW, depth: prop.torsoD },
    style: {
      silhouette: "standing_human_figure",
      mood: "neutral_at_ease",
      genre: "realistic_human",
      detailDensity: "high",
      bodyLanguage: "standing_neutral",
      shapeLanguage: ["anatomical_volumes", "clothing_layers", "accessories", "facial_features"]
    },
    proportions: {
      totalHeightMeters: rounded(sH),
      headToBodyRatio: rounded(prop.headH / sH),
      shoulderWidthRatio: rounded(prop.torsoW / sH),
      legToBodyRatio: rounded((prop.thighH + prop.shinH + prop.footH) / sH)
    },
    materials: createBaseMaterials("human", styles),
    parts: [],
    surfaceDetails: [],
    ornaments: [],
    pose: { preset: "standing_neutral", armAngle: 15, legSpread: 8 },
    animationHints: { idle: "subtle_breathing", walk: "bipedal_walk" },
    lod: { high: "full", medium: "merge_hand_fingers", low: "merge_limb_segments" },
    exportOptions: { formats: ["gltf", "glb"], previewHtml: true }
  };

  const parts = [];
  const surfaceDetails = [];
  const box = (id, mat, sx, sy, sz, px, py, pz) =>
    parts.push({ id, kind: "box", material: mat, size: [rounded(sx), rounded(sy), rounded(sz)], position: [rounded(px), rounded(py), rounded(pz)] });
  const shape = (id, kind, mat, sx, sy, sz, px, py, pz) =>
    parts.push({ id, kind, material: mat, size: [rounded(sx), rounded(sy), rounded(sz)], position: [rounded(px), rounded(py), rounded(pz)] });
  const pushSurface = (id, region, type, strength, offset) =>
    surfaceDetails.push({ id, region, type, strength: rounded(strength), offset: offset.map(rounded) });

  // Determine skin/clothing material keys
  const skinMat    = "skin";
  const topMat     = isPolice || isFirefighter ? "uniform_main" : isNurse || isDoctor ? (isNurse ? "uniform_main" : "coat") : "clothing_main";
  const bottomMat  = isPolice || isFirefighter ? "uniform_main" : isDoctor ? "scrubs" : isNurse ? "uniform_main" : "clothing_main";
  const shoesMat   = "shoe" in (spec.materials) ? "shoe" : "boot" in (spec.materials) ? "boot" : "clothing_dark";
  const hairMat    = "hair";
  const headwearMat= isPolice ? "cap" : isFirefighter ? "helmet" : isNurse ? "cap" : null;

  // ── Feet & boots ───────────────────────────────────────────────────────────
  for (const side of ["L", "R"]) {
    const sx = side === "L" ? -prop.footW * 0.65 : prop.footW * 0.65;
    box(`foot_${side}`, shoesMat, prop.footW, prop.footH, prop.footD, sx, yFoot + prop.footH * 0.5, prop.footD * 0.08);
  }

  // ── Shins ──────────────────────────────────────────────────────────────────
  for (const side of ["L", "R"]) {
    const sx = side === "L" ? -prop.thighW * 0.52 : prop.thighW * 0.52;
    shape(`shin_${side}`, "cylinder", bottomMat, prop.shinW, prop.shinH, prop.shinD, sx, yShin + prop.shinH * 0.5, 0);
  }

  // ── Thighs ─────────────────────────────────────────────────────────────────
  for (const side of ["L", "R"]) {
    const sx = side === "L" ? -prop.thighW * 0.50 : prop.thighW * 0.50;
    shape(`thigh_${side}`, "cylinder", bottomMat, prop.thighW, prop.thighH, prop.thighD, sx, yThigh + prop.thighH * 0.5, 0);
  }

  // ── Hips / pelvis ──────────────────────────────────────────────────────────
  box("hips", bottomMat, prop.hipW, prop.hipH, prop.hipD, 0, yHip + prop.hipH * 0.5, 0);

  // ── Torso ──────────────────────────────────────────────────────────────────
  const torsoW2 = isWoman ? prop.torsoW * 1.04 : prop.torsoW;
  box("torso", topMat, torsoW2, prop.torsoH, prop.torsoD, 0, yTorso + prop.torsoH * 0.5, 0);

  // Chest detail (female silhouette)
  if (isWoman || isNurse) {
    shape("chest_L", "sphere", topMat, prop.torsoW * 0.18, prop.torsoH * 0.16, prop.torsoD * 0.22,
      -prop.torsoW * 0.16, yTorso + prop.torsoH * 0.68, prop.torsoD * 0.38);
    shape("chest_R", "sphere", topMat, prop.torsoW * 0.18, prop.torsoH * 0.16, prop.torsoD * 0.22,
       prop.torsoW * 0.16, yTorso + prop.torsoH * 0.68, prop.torsoD * 0.38);
  }

  // Nurse/Doctor chest pocket
  if (isNurse || isDoctor) {
    box("chest_pocket", topMat, prop.torsoW * 0.12, prop.torsoH * 0.08, prop.torsoD * 0.04,
      prop.torsoW * 0.30, yTorso + prop.torsoH * 0.78, prop.torsoD * 0.52);
  }

  // Firefighter SCBA tank on back
  if (isFirefighter) {
    box("scba_tank", "tank", prop.torsoW * 0.28, prop.torsoH * 0.55, prop.torsoD * 0.22,
      0, yTorso + prop.torsoH * 0.42, -prop.torsoD * 0.52);
    box("scba_strap_L", "uniform_dark", prop.torsoW * 0.04, prop.torsoH * 0.70, prop.torsoD * 0.04,
      -prop.torsoW * 0.20, yTorso + prop.torsoH * 0.40, 0);
    box("scba_strap_R", "uniform_dark", prop.torsoW * 0.04, prop.torsoH * 0.70, prop.torsoD * 0.04,
       prop.torsoW * 0.20, yTorso + prop.torsoH * 0.40, 0);
  }

  // Police utility belt
  if (isPolice) {
    box("belt", "belt", prop.hipW * 1.04, prop.hipH * 0.18, prop.hipD * 1.04, 0, yHip + prop.hipH * 0.80, 0);
    box("holster", "uniform_dark", prop.hipW * 0.12, prop.hipH * 0.50, prop.hipD * 0.10,
      prop.hipW * 0.46, yHip + prop.hipH * 0.48, 0);
    box("badge_plate", "badge", prop.torsoW * 0.10, prop.torsoH * 0.08, prop.torsoD * 0.02,
      prop.torsoW * 0.24, yTorso + prop.torsoH * 0.80, prop.torsoD * 0.50);
  }

  // Doctor stethoscope (over shoulders)
  if (isDoctor || isNurse) {
    box("steth_over_neck_L", "stethoscope", prop.torsoW * 0.02, prop.torsoH * 0.28, prop.torsoD * 0.02,
      -prop.torsoW * 0.16, yTorso + prop.torsoH * 0.72, prop.torsoD * 0.10);
    box("steth_over_neck_R", "stethoscope", prop.torsoW * 0.02, prop.torsoH * 0.28, prop.torsoD * 0.02,
       prop.torsoW * 0.16, yTorso + prop.torsoH * 0.72, prop.torsoD * 0.10);
    box("steth_chest_piece",  "stethoscope", prop.torsoW * 0.06, prop.torsoH * 0.04, prop.torsoD * 0.04,
      0, yTorso + prop.torsoH * 0.50, prop.torsoD * 0.52);
  }

  // Child backpack
  if (isChild) {
    box("backpack_body", "backpack", prop.torsoW * 0.50, prop.torsoH * 0.55, prop.torsoD * 0.28,
      0, yTorso + prop.torsoH * 0.42, -prop.torsoD * 0.58);
    box("backpack_strap_L", "backpack", prop.torsoW * 0.06, prop.torsoH * 0.60, prop.torsoD * 0.04,
      -prop.torsoW * 0.18, yTorso + prop.torsoH * 0.38, 0);
    box("backpack_strap_R", "backpack", prop.torsoW * 0.06, prop.torsoH * 0.60, prop.torsoD * 0.04,
       prop.torsoW * 0.18, yTorso + prop.torsoH * 0.38, 0);
  }

  // Elderly cane
  if (isElderly) {
    shape("cane_shaft", "cylinder", "cane", sH * 0.018, sH * 0.80, sH * 0.018,
      prop.hipW * 0.56, sH * 0.40, 0);
    shape("cane_handle", "cylinder", "cane", sH * 0.028, sH * 0.028, sH * 0.080,
      prop.hipW * 0.56, sH * 0.79, 0);
  }

  // ── Arms ──────────────────────────────────────────────────────────────────
  for (const side of ["L", "R"]) {
    const sx = side === "L" ? -(prop.torsoW * 0.5 + prop.upperAW * 0.6) : (prop.torsoW * 0.5 + prop.upperAW * 0.6);
    // Upper arm
    shape(`upper_arm_${side}`, "cylinder", topMat, prop.upperAW, prop.upperAH, prop.upperAD,
      sx, yTorso + prop.torsoH * 0.84, 0);
    // Elbow
    shape(`elbow_${side}`, "sphere", topMat, prop.upperAW * 0.90, prop.upperAW * 0.90, prop.upperAD * 0.90,
      sx, yTorso + prop.torsoH * 0.84 - prop.upperAH * 0.46, 0);
    // Lower arm
    shape(`lower_arm_${side}`, "cylinder", skinMat, prop.lowerAW, prop.lowerAH, prop.lowerAD,
      sx, yTorso + prop.torsoH * 0.84 - prop.upperAH * 0.50 - prop.lowerAH * 0.50, 0);
    // Hand
    box(`hand_${side}`, skinMat, prop.handW, prop.handH, prop.handD,
      sx, yTorso + prop.torsoH * 0.84 - prop.upperAH * 0.50 - prop.lowerAH - prop.handH * 0.50, 0);
    // Firefighter gloves override
    if (isFirefighter) {
      box(`glove_${side}`, "glove", prop.handW * 1.15, prop.handH * 1.10, prop.handD * 1.15,
        sx, yTorso + prop.torsoH * 0.84 - prop.upperAH * 0.50 - prop.lowerAH - prop.handH * 0.55, 0);
    }
  }

  // Reflective stripes (firefighter)
  if (isFirefighter) {
    box("stripe_torso",  "reflective", prop.torsoW * 1.02, prop.torsoH * 0.06, prop.torsoD * 1.02,
      0, yTorso + prop.torsoH * 0.28, 0);
    box("stripe_shin_L", "reflective", prop.shinW * 1.10, prop.shinH * 0.06, prop.shinD * 1.10,
      -prop.thighW * 0.52, yShin + prop.shinH * 0.22, 0);
    box("stripe_shin_R", "reflective", prop.shinW * 1.10, prop.shinH * 0.06, prop.shinD * 1.10,
       prop.thighW * 0.52, yShin + prop.shinH * 0.22, 0);
  }

  // ── Neck ──────────────────────────────────────────────────────────────────
  shape("neck", "cylinder", skinMat, prop.neckR * 2, prop.neckH, prop.neckR * 2,
    0, yNeck + prop.neckH * 0.5, 0);

  // ── Head ──────────────────────────────────────────────────────────────────
  shape("head", "sphere", skinMat, prop.headW, prop.headH, prop.headD,
    0, yHead + prop.headH * 0.5, 0);
  // Hair
  shape("hair_top", "sphere", hairMat, prop.headW * 0.96, prop.headH * 0.60, prop.headD * 0.96,
    0, yHead + prop.headH * 0.72, 0);
  if (!isPolice && !isFirefighter) {
    box("hair_back", hairMat, prop.headW * 0.90, prop.headH * 0.55, prop.headD * 0.20,
      0, yHead + prop.headH * 0.58, -prop.headD * 0.48);
  }
  // Ears
  shape("ear_L", "sphere", skinMat, prop.headW * 0.10, prop.headH * 0.14, prop.headD * 0.08,
    -prop.headW * 0.52, yHead + prop.headH * 0.44, 0);
  shape("ear_R", "sphere", skinMat, prop.headW * 0.10, prop.headH * 0.14, prop.headD * 0.08,
     prop.headW * 0.52, yHead + prop.headH * 0.44, 0);
  // Eyes
  shape("eye_L", "sphere", skinMat, prop.headW * 0.10, prop.headH * 0.09, prop.headD * 0.06,
    -prop.headW * 0.22, yHead + prop.headH * 0.50, prop.headD * 0.48);
  shape("eye_R", "sphere", skinMat, prop.headW * 0.10, prop.headH * 0.09, prop.headD * 0.06,
     prop.headW * 0.22, yHead + prop.headH * 0.50, prop.headD * 0.48);
  // Nose
  shape("nose", "sphere", skinMat, prop.headW * 0.10, prop.headH * 0.10, prop.headD * 0.12,
    0, yHead + prop.headH * 0.36, prop.headD * 0.50);

  // Doctor glasses
  if (isDoctor) {
    box("glasses_bridge", "glasses", prop.headW * 0.14, prop.headH * 0.03, prop.headD * 0.02,
      0, yHead + prop.headH * 0.50, prop.headD * 0.44);
    for (const sx of [-prop.headW * 0.24, prop.headW * 0.24]) {
      shape(`lens_${sx > 0 ? "R" : "L"}`, "sphere", "glasses",
        prop.headW * 0.16, prop.headH * 0.12, prop.headD * 0.06,
        sx, yHead + prop.headH * 0.50, prop.headD * 0.44);
    }
  }

  // Headwear (police cap, firefighter helmet, nurse cap)
  if (headwearMat) {
    if (isPolice) {
      box("cap_brim", headwearMat, prop.headW * 1.20, prop.headH * 0.06, prop.headD * 0.60,
        0, yHead + prop.headH * 0.80, prop.headD * 0.10);
      shape("cap_crown", "sphere", headwearMat, prop.headW * 1.06, prop.headH * 0.46, prop.headD * 1.06,
        0, yHead + prop.headH * 0.82, 0);
      box("cap_badge", "badge", prop.headW * 0.16, prop.headH * 0.10, prop.headD * 0.02,
        0, yHead + prop.headH * 0.84, prop.headD * 0.52);
    } else if (isFirefighter) {
      shape("helmet_shell", "sphere", headwearMat, prop.headW * 1.24, prop.headH * 0.58, prop.headD * 1.24,
        0, yHead + prop.headH * 0.78, 0);
      box("helmet_brim_F", headwearMat, prop.headW * 1.30, prop.headH * 0.05, prop.headD * 0.50,
        0, yHead + prop.headH * 0.65, prop.headD * 0.22);
      box("helmet_brim_B", headwearMat, prop.headW * 1.30, prop.headH * 0.05, prop.headD * 0.70,
        0, yHead + prop.headH * 0.65, -prop.headD * 0.30);
      box("faceshield",    "reflective", prop.headW * 0.88, prop.headH * 0.28, prop.headD * 0.04,
        0, yHead + prop.headH * 0.60, prop.headD * 0.46);
    } else if (isNurse) {
      box("nurse_cap", headwearMat, prop.headW * 1.04, prop.headH * 0.12, prop.headD * 0.70,
        0, yHead + prop.headH * 0.92, 0);
      box("nurse_cap_fold", headwearMat, prop.headW * 0.60, prop.headH * 0.10, prop.headD * 0.20,
        0, yHead + prop.headH * 0.86, prop.headD * 0.30);
    }
  }

  // ── Surface detail metadata ───────────────────────────────────────────────
  const regions = ["head", "torso", "arms", "legs", "accessories"];
  const detailTypes = ["skin_pore", "fabric_weave", "seam_stitch", "crease", "button_detail", "buckle_detail"];
  let sdIndex = 1;
  for (const region of regions) {
    for (let i = 0; i < 8; i++) {
      pushSurface(`surface_detail_${sdIndex++}`, region,
        detailTypes[i % detailTypes.length],
        0.10 + (i % 5) * 0.06,
        [Math.sin(i * 0.9) * 0.012, Math.cos(i * 0.7) * 0.010, ((i % 4) - 1.5) * 0.008]);
    }
  }

  spec.parts = parts;
  spec.surfaceDetails = surfaceDetails;
  return spec;
}

// Builder dispatch map  - add new subject builders here alongside SUBJECT_REGISTRY.
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
  human:   (...a) => buildHumanSpec(...a),
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

function promptToSlug(prompt) {
  // Subject mappings (first match wins)
  const subjectMap = [
    [/\u516d\u672c\u6728\u30d2\u30eb\u30ba/u,                  "roppongi_hills"],
    [/\u901a\u5929\u95a3/u,                                     "tsutenkaku"],
    [/\u6771\u4eac\u30bf\u30ef\u30fc/u,                        "tokyo_tower"],
    [/\u30b9\u30ab\u30a4\u30c4\u30ea\u30fc/u,                  "skytree"],
    [/\u91d1\u95a3\u5bfa|\u91d1\u95a3/u,                       "kinkakuji"],
    [/\u9280\u95a3\u5bfa|\u9280\u95a3/u,                       "ginkakuji"],
    [/\u4e94\u91cd\u5854|\u4e09\u91cd\u5854/u,                 "pagoda"],
    [/\u795e\u793e/u,                                           "shrine"],
    [/\u5bfa/u,                                                 "temple"],
    [/\u30b4\u30b8\u30e9/u,                                     "godzilla"],
    [/\u8d85\u5927\u578b\u5de8\u4eba/u,                        "colossal_titan"],
    [/\u5de8\u4eba/u,                                           "titan"],
    [/\u6021\u7363/u,                                           "kaiju"],
    [/\u30ed\u30dc\u30c3\u30c8/u,                              "robot"],
    [/\u6226\u58eb|\u9a0e\u58eb/u,                             "warrior"],
    [/\u6d88\u9632\u58eb/u,                                     "firefighter"],
    [/\u8b66\u5bdf\u5b98/u,                                     "police_officer"],
    [/\u770b\u8b77\u5e2b/u,                                     "nurse"],
    [/\u533b\u5e2b|\u30c9\u30af\u30bf\u30fc/u,                "doctor"],
    [/\u5b50\u3069\u3082|\u5c0f\u5b66\u751f/u,                "child"],
    [/\u8001\u4eba|\u9ad8\u9f62\u8005/u,                       "elderly"],
    [/\u75c5\u9662|\u30af\u30ea\u30cb\u30c3\u30af/u,          "hospital"],
    [/\u8b66\u5bdf\u7f72/u,                                     "police_station"],
    [/\u6d88\u9632\u7f72/u,                                     "fire_station"],
    [/\u5c0f\u5b66\u6821|\u4e2d\u5b66\u6821|\u9ad8\u6821|\u5b66\u6821/u, "school"],
    [/\u5e02\u5f79\u6240|\u533a\u5f79\u6240/u,                 "cityhall"],
    [/\u8001\u4eba\u30db\u30fc\u30e0|\u4ecb\u8b77/u,          "nursing_home"],
    [/\u5927\u5b66|\u30ad\u30e3\u30f3\u30d1\u30b9/u,          "campus"],
    [/\u30c7\u30fc\u30bf\u30bb\u30f3\u30bf\u30fc/u,             "datacenter"],
    [/\u98db\u884c\u8239/u,                                     "airship"],
    [/\u65b0\u5e79\u7dda/u,                                     "shinkansen"],
    [/\u5217\u8eca|\u96fb\u8eca/u,                             "train"],
    [/\u30d1\u30c8\u30ab\u30fc/u,                              "police_car"],
    [/\u8239/u,                                                  "ship"],
    [/\u98db\u884c\u6a5f/u,                                     "airplane"],
    [/\u57ce/u,                                                  "castle"],
    [/\u30bf\u30ef\u30fc/u,                                     "tower"],
    [/\u30a2\u30d1\u30fc\u30c8/u,                              "apartment"],
    [/\u30d3\u30eb|\u30d3\u30eb\u30c7\u30a3\u30f3\u30b0/u,   "building"],
  ];

  // Style/modifier suffixes
  const styleMap = [
    [/\u30d5\u30a1\u30f3\u30bf\u30b8\u30fc/u, "fantasy"],
    [/\u8fd1\u672a\u6765|SF|sci.?fi/iu,       "scifi"],
    [/\u30c0\u30fc\u30af|dark/iu,             "dark"],
  ];

  let subject = "";
  for (const [pat, name] of subjectMap) {
    if (pat.test(prompt)) { subject = name; break; }
  }
  if (!subject) {
    // Fallback: keep ASCII chars only, slugify
    subject = prompt.replace(/[^\x21-\x7e]/g, "_").replace(/[^a-z0-9]+/gi, "_")
      .replace(/^_+|_+$/g, "").toLowerCase().slice(0, 40) || "model";
  }

  let style = "";
  for (const [pat, tag] of styleMap) {
    if (pat.test(prompt)) { style = tag; break; }
  }

  return style ? `${subject}_${style}` : subject;
}

function createPreviewHtml(currentGlb, allGlbs) {
  const modelsJson  = JSON.stringify(allGlbs);
  const currentJson = JSON.stringify(currentGlb);
  const countStr    = String(allGlbs.length);

  const staticHtml = "<!doctype html>\n<html lang='ja'>\n<head>\n  <meta charset='utf-8' />\n  <meta name='viewport' content='width=device-width,initial-scale=1' />\n  <title>Prompt2GLTF · Gallery</title>\n  <link rel='preconnect' href='https://fonts.googleapis.com'>\n  <link href='https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Noto+Sans+JP:wght@300;400&display=swap' rel='stylesheet'>\n  <style>\n    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }\n    :root {\n      --bg: #0a0a0f; --surface: #12121a; --border: #2a2a3a;\n      --accent: #6ee7f7; --accent2: #a78bfa; --text: #e0e0f0; --muted: #5a5a7a;\n    }\n    body { background: var(--bg); color: var(--text); font-family: 'Noto Sans JP', sans-serif; height: 100vh; display: flex; flex-direction: column; overflow: hidden; }\n    header { padding: 14px 22px; border-bottom: 1px solid var(--border); display: flex; align-items: center; gap: 14px; background: var(--surface); flex-shrink: 0; }\n    .logo { font-family: 'Space Mono', monospace; font-size: 12px; letter-spacing: .2em; color: var(--accent); text-transform: uppercase; }\n    .logo span { color: var(--accent2); }\n    .hint { margin-left: auto; font-size: 11px; color: var(--muted); font-family: 'Space Mono', monospace; letter-spacing: .05em; }\n    .main { flex: 1; display: flex; overflow: hidden; }\n    #sidebar { width: 220px; min-width: 220px; background: var(--surface); border-right: 1px solid var(--border); display: flex; flex-direction: column; overflow: hidden; }\n    .sidebar-hd { padding: 14px 14px 8px; display: flex; align-items: center; justify-content: space-between; flex-shrink: 0; border-bottom: 1px solid var(--border); }\n    .sidebar-label { font-family: 'Space Mono', monospace; font-size: 10px; letter-spacing: .14em; color: var(--muted); text-transform: uppercase; }\n    .model-count { font-family: 'Space Mono', monospace; font-size: 10px; color: var(--accent2); background: rgba(167,139,250,.12); padding: 2px 7px; border-radius: 10px; }\n    #model-list { overflow-y: auto; flex: 1; padding: 6px 0; }\n    #model-list::-webkit-scrollbar { width: 4px; }\n    #model-list::-webkit-scrollbar-track { background: transparent; }\n    #model-list::-webkit-scrollbar-thumb { background: var(--border); border-radius: 2px; }\n    .mbtn { display: block; width: 100%; text-align: left; padding: 9px 16px 9px 14px; background: none; border: none; border-left: 2px solid transparent; color: var(--muted); cursor: pointer; font-size: 12px; font-family: 'Space Mono', monospace; letter-spacing: .04em; transition: background .12s, border-color .12s, color .12s; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }\n    .mbtn:hover { background: rgba(110,231,247,.04); color: var(--text); }\n    .mbtn.active { border-left-color: var(--accent); background: rgba(110,231,247,.06); color: var(--accent); }\n    .mbtn .dot { display: inline-block; width: 5px; height: 5px; border-radius: 50%; background: var(--accent2); margin-right: 8px; vertical-align: middle; opacity: 0; transition: opacity .15s; }\n    .mbtn.active .dot { opacity: 1; }\n    #viewer { flex: 1; position: relative; overflow: hidden; }\n    canvas { display: block; width: 100% !important; height: 100% !important; }\n    .grid-bg { position: absolute; inset: 0; background-image: linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px); background-size: 40px 40px; opacity: .18; pointer-events: none; z-index: 0; }\n    #info { position: absolute; top: 14px; left: 14px; font-family: 'Space Mono', monospace; font-size: 10px; color: var(--muted); z-index: 5; line-height: 1.9; opacity: 0; transition: opacity .3s; background: rgba(10,10,15,.75); padding: 10px 14px; border-radius: 8px; border: 1px solid var(--border); backdrop-filter: blur(6px); }\n    #info.visible { opacity: 1; }\n    .controls-bar { position: absolute; bottom: 18px; left: 50%; transform: translateX(-50%); display: flex; gap: 8px; z-index: 5; opacity: 0; transition: opacity .3s; }\n    .controls-bar.visible { opacity: 1; }\n    .ctrl-btn { background: rgba(18,18,26,.90); border: 1px solid var(--border); color: var(--text); font-family: 'Space Mono', monospace; font-size: 10px; letter-spacing: .06em; padding: 7px 14px; border-radius: 6px; cursor: pointer; backdrop-filter: blur(8px); transition: border-color .15s, color .15s; }\n    .ctrl-btn:hover { border-color: var(--accent); color: var(--accent); }\n    .ctrl-btn.on { border-color: var(--accent2); color: var(--accent2); }\n    #status-bar { position: absolute; bottom: 18px; right: 18px; font-family: 'Space Mono', monospace; font-size: 10px; color: var(--muted); z-index: 5; background: rgba(10,10,15,.75); padding: 6px 14px; border-radius: 20px; border: 1px solid var(--border); backdrop-filter: blur(6px); letter-spacing: .04em; }\n  </style>\n</head>\n<body>\n  <header>\n    <div class='logo'>PROMPT2GLTF <span>//</span> Gallery</div>\n    <div class='hint'>drag &middot; scroll &middot; pinch to navigate</div>\n  </header>\n  <div class='main'>\n    <div id='sidebar'>\n      <div class='sidebar-hd'>\n        <span class='sidebar-label'>Models</span>\n        <span class='model-count' id='count-badge'>0</span>\n      </div>\n      <div id='model-list'></div>\n    </div>\n    <div id='viewer'>\n      <div class='grid-bg'></div>\n      <canvas id='c'></canvas>\n      <div id='info'></div>\n      <div class='controls-bar' id='controls-bar'>\n        <button class='ctrl-btn' id='btn-reset'>&#x27F3; RESET</button>\n        <button class='ctrl-btn' id='btn-wire'>&#x25FB; WIRE</button>\n        <button class='ctrl-btn on' id='btn-rotate'>&#x27F2; AUTO</button>\n      </div>\n      <div id='status-bar'>Loading...</div>\n    </div>\n  </div>\n  <script type='importmap'>\n  {\"imports\":{\"three\":\"https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js\",\"three/addons/\":\"https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/\"}}\n  <\\/script>";

  const scriptBlock = [
    "  <script type='module'>",
    "    import * as THREE from 'three';",
    "    import { OrbitControls } from 'three/addons/controls/OrbitControls.js';",
    "    import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';",
    "    const MODELS  = " + modelsJson + ";",
    "    const INITIAL = " + currentJson + ";",
    "    const COUNT   = " + countStr + ";",
    "    document.getElementById('count-badge').textContent = COUNT;",
    "    const statusEl  = document.getElementById('status-bar');",
    "    const infoEl    = document.getElementById('info');",
    "    const ctrlBar   = document.getElementById('controls-bar');",
    "    const listEl    = document.getElementById('model-list');",
    "    const canvas    = document.getElementById('c');",
    // Three.js setup
    "    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });",
    "    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));",
    "    renderer.toneMapping = THREE.ACESFilmicToneMapping;",
    "    renderer.toneMappingExposure = 1.1;",
    "    const scene = new THREE.Scene();",
    "    scene.background = new THREE.Color(0x0a0a0f);",
    "    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 10000);",
    "    const controls = new OrbitControls(camera, renderer.domElement);",
    "    controls.enableDamping = true; controls.dampingFactor = 0.08;",
    // Lights
    "    const amb = new THREE.AmbientLight(0xffffff, 0.4); scene.add(amb);",
    "    const dir1 = new THREE.DirectionalLight(0x6ee7f7, 2.2); dir1.position.set(180,260,140); scene.add(dir1);",
    "    const dir2 = new THREE.DirectionalLight(0xa78bfa, 1.0); dir2.position.set(-120,90,-160); scene.add(dir2);",
    "    const dir3 = new THREE.DirectionalLight(0xffffff, 0.8); dir3.position.set(0,-100,0); scene.add(dir3);",
    // Grid
    "    scene.add(new THREE.GridHelper(600, 60, 0x2a2a3a, 0x1a1a28));",
    "    const ground = new THREE.Mesh(new THREE.PlaneGeometry(800,800), new THREE.MeshStandardMaterial({color:0x0a0a0f,roughness:0.98}));",
    "    ground.rotation.x = -Math.PI/2; ground.position.y = -0.02; scene.add(ground);",
    // Resize
    "    function resize() { const w=canvas.clientWidth,h=canvas.clientHeight; renderer.setSize(w,h,false); camera.aspect=w/h; camera.updateProjectionMatrix(); }",
    "    window.addEventListener('resize', resize); resize();",
    // frameObject
    "    function frameObject(obj) {",
    "      const box=new THREE.Box3().setFromObject(obj), size=new THREE.Vector3(), center=new THREE.Vector3();",
    "      box.getSize(size); box.getCenter(center);",
    "      obj.position.x -= center.x; obj.position.y -= box.min.y; obj.position.z -= center.z;",
    "      const maxDim=Math.max(size.x,size.y,size.z), dist=Math.max(60,maxDim*1.8);",
    "      camera.near=Math.max(0.1,maxDim/500); camera.far=Math.max(1000,maxDim*20); camera.updateProjectionMatrix();",
    "      scene.fog=new THREE.Fog(0x0a0a0f,dist*2.5,dist*9);",
    "      camera.position.set(dist*0.72,size.y*0.62+dist*0.22,dist);",
    "      controls.target.set(0,size.y*0.42,0); controls.update();",
    "    }",
    // Model loader
    "    const loader=new GLTFLoader();",
    "    let currentObj=null, wireframe=false, autoRotate=true;",
    "    function loadModel(filename) {",
    "      if(currentObj){ scene.remove(currentObj); currentObj=null; }",
    "      infoEl.classList.remove('visible'); ctrlBar.classList.remove('visible');",
    "      statusEl.textContent='Loading '+filename+' ...';",
    "      loader.load('generated/'+filename,",
    "        (gltf)=>{",
    "          currentObj=gltf.scene; scene.add(currentObj);",
    "          frameObject(currentObj);",
    "          // apply wireframe state",
    "          currentObj.traverse(n=>{ if(n.isMesh) n.material.wireframe=wireframe; });",
    "          // info panel",
    "          let meshCount=0; currentObj.traverse(n=>{ if(n.isMesh) meshCount++; });",
    "          const box=new THREE.Box3().setFromObject(currentObj), sz=new THREE.Vector3(); box.getSize(sz);",
    "          infoEl.innerHTML='FILE: '+filename+'<br>MESHES: '+meshCount+'<br>SIZE: '+sz.x.toFixed(1)+' x '+sz.y.toFixed(1)+' x '+sz.z.toFixed(1)+' m';",
    "          infoEl.classList.add('visible'); ctrlBar.classList.add('visible');",
    "          statusEl.textContent=filename+' \u2713';",
    "        },",
    "        (evt)=>{ statusEl.textContent=evt.total?'Loading... '+Math.round(evt.loaded/evt.total*100)+'%':'Loading... '+Math.round(evt.loaded/1024)+' KB'; },",
    "        (err)=>{ statusEl.textContent='Load failed: '+(err.message||err); }",
    "      );",
    "    }",
    // Sidebar
    "    MODELS.forEach(filename=>{",
    "      const btn=document.createElement('button');",
    "      btn.className='mbtn'+(filename===INITIAL?' active':'');",
    "      btn.title=filename;",
    "      const label=filename.replace(/\\.glb$/,'').replace(/_/g,' ');",
    "      const _sp=document.createElement('span'); _sp.className='dot'; btn.textContent=label; btn.prepend(_sp);",
    "      btn.onclick=()=>{",
    "        document.querySelectorAll('.mbtn').forEach(b=>b.classList.remove('active'));",
    "        btn.classList.add('active'); loadModel(filename);",
    "      };",
    "      listEl.appendChild(btn);",
    "    });",
    // Controls
    "    document.getElementById('btn-reset').onclick=()=>{ if(currentObj){ frameObject(currentObj); } };",
    "    document.getElementById('btn-wire').onclick=function(){ wireframe=!wireframe; this.classList.toggle('on',wireframe); if(currentObj) currentObj.traverse(n=>{ if(n.isMesh) n.material.wireframe=wireframe; }); this.textContent=wireframe?'\u25A0 SOLID':'\u25FB WIRE'; };",
    "    document.getElementById('btn-rotate').onclick=function(){ autoRotate=!autoRotate; this.classList.toggle('on',autoRotate); };",
    "    controls.addEventListener('start',()=>{ autoRotate=false; document.getElementById('btn-rotate').classList.remove('on'); });",
    // Render loop
    "    (function render(){ controls.update(); if(currentObj&&autoRotate) currentObj.rotation.y+=0.003; renderer.render(scene,camera); requestAnimationFrame(render); })();",
    "    loadModel(INITIAL);",
    "  <\/script>",
    "</body>",
    "</html>",
  ].join("\n");

  return staticHtml + "\n" + scriptBlock;
}


async function main() {
  const prompt = getArg("--prompt");
  if (!prompt) {
    console.error('Usage: node tools/prompt2gltf/src/index.mjs --prompt "100m邏壹・蟾ｨ莠ｺ繧剃ｽ懊▲縺ｦ"');
    process.exit(1);
  }

  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  const spec = buildSpec(prompt);
  const slug = promptToSlug(prompt);
  const specPath = path.join(OUTPUT_DIR, slug + "_spec.json");
  await fs.writeFile(specPath, JSON.stringify(spec, null, 2), "utf-8");

  const doc = buildDocumentFromSpec(spec);
  const io = new NodeIO();

  // Derive filenames from slug
  const glbFilename  = slug + ".glb";
  const gltfFilename = slug + ".gltf";

  // GLB: self-contained binary (no external files)
  const glbPath = path.join(OUTPUT_DIR, glbFilename);
  await io.write(glbPath, doc);

  // GLTF: embed binary buffer as base64 data URI so no .bin file is needed
  const gltfPath = path.join(OUTPUT_DIR, gltfFilename);
  const { json, resources } = await io.writeJSON(doc);
  for (const [resPath, data] of Object.entries(resources)) {
    if (resPath.endsWith(".bin")) {
      const b64 = Buffer.from(data).toString("base64");
      const bufIdx = json.buffers.findIndex(b => b.uri === resPath || !b.uri);
      if (bufIdx >= 0) json.buffers[bufIdx].uri = `data:application/octet-stream;base64,${b64}`;
    }
  }
  await fs.writeFile(gltfPath, JSON.stringify(json, null, 2), "utf-8");

  // Collect all .glb files for sidebar
  const allFiles = await fs.readdir(OUTPUT_DIR);
  const allGlbs  = allFiles.filter(f => f.endsWith(".glb") && f !== "model.glb").sort();

  const previewPath = path.join(PLUGIN_ROOT, "preview.html");
  await fs.writeFile(previewPath, createPreviewHtml(glbFilename, allGlbs), "utf-8");

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






