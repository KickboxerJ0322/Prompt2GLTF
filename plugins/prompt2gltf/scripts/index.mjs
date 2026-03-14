
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
const PLUGIN_ROOT   = path.resolve(__dirname, "..");
const OUTPUT_DIR    = path.join(PLUGIN_ROOT, "generated");
const TEMPLATES_DIR = path.join(PLUGIN_ROOT, "templates");

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
    match: /airship|飛行船|飛空艇|飛空挺/iu,
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
    match: /robot|mecha|\u30ed\u30dc|\u30e1\u30ab/iu,
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
    id: "ferris_wheel",
    match: /ferris.?wheel|観覧車|かんらんしゃ|kanransha/iu,
    defaultHeight: () => 90,
    defaultStyle: "amusement_attraction",
  },
  {
    id: "building",
    match: /building|architecture|skyscraper|house|apartment|office|station|airport|terminal|museum|factory|warehouse|stadium|temple|shrine|church|hospital|clinic|police.?station|fire.?station|nursing.?home|school|city.?hall|town.?hall|\u5efa\u7bc9|\u5efa\u7269|\u30d3\u30eb|\u9ad8\u5c64|\u5bb6|\u4f4f\u5b85|\u99c5|\u7a7a\u6e2f|\u7f8e\u8853\u9928|\u5de5\u5834|\u30b9\u30bf\u30b8\u30a2\u30e0|\u5bfa|\u795e\u793e|\u6559\u4f1a|\u75c5\u9662|\u8a3a\u7642\u6240|\u8b66\u5bdf\u7f72|\u6d88\u9632\u7f72|\u8001\u4eba\u30db\u30fc\u30e0|\u4ecb\u8b77\u65bd\u8a2d|\u5b66\u6821|\u5c0f\u5b66\u6821|\u4e2d\u5b66\u6821|\u9ad8\u6821|\u5e02\u5f79\u6240|\u533a\u5f79\u6240|\u753a\u5f79\u5834/iu,
    defaultHeight: () => 90,
    defaultStyle: "civic_architecture",
  },
  {
    id: "human",
    match: /police.?officer|firefighter|nurse|doctor|physician|child|adult|woman|elderly|old.?man|old.?woman|person|human|people|runner|marathon|jogging|sprint|\u8b66\u5bdf\u5b98|\u8b66\u5b98|\u6d88\u9632\u58eb|\u770b\u8b77\u5e2b|\u533b\u5e2b|\u5b50\u3069\u3082|\u5b50\u4f9b|\u5c0f\u5b66\u751f|\u5927\u4eba|\u5973\u6027|\u7537\u6027|\u8001\u4eba|\u9ad8\u9f62\u8005|\u4eba\u9593|\u4eba\u7269|ランナー|マラソン|走る人/iu,
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
  if (/marathon|runner|jogging|sprint|\u30de\u30e9\u30bd\u30f3|\u30e9\u30f3\u30ca\u30fc|\u8d70\u308b/iu.test(prompt)) tags.push("runner");
  if (/suit|\u30b9\u30fc\u30c4|\u80cc\u5e83|\u30d3\u30b8\u30cd\u30b9\u30de\u30f3|\u30b5\u30e9\u30ea\u30fc\u30de\u30f3/iu.test(prompt)) tags.push("suit");

  if (tags.length === 0) {
    const entry = SUBJECT_REGISTRY.find((r) => r.id === subject);
    if (entry) tags.push(entry.defaultStyle);
  }
  return tags;
}
function _rawBaseMaterials(subject, styles) {
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
    if (styles.includes("suit") && styles.includes("woman")) return {
      skin:           { baseColor: "#F2C9A0", roughness: 0.78, metalness: 0.00 },
      suit_jacket:    { baseColor: "#111827", roughness: 0.68, metalness: 0.03 },
      skirt:          { baseColor: "#111827", roughness: 0.72, metalness: 0.02 },
      skirt_dark:     { baseColor: "#0B1220", roughness: 0.74, metalness: 0.02 },
      blouse:         { baseColor: "#F8FAFC", roughness: 0.78, metalness: 0.01 },
      heel_shoe:      { baseColor: "#0B1220", roughness: 0.38, metalness: 0.14 },
      shoe_sole:      { baseColor: "#0A0A0E", roughness: 0.92, metalness: 0.01 },
      button_silver:  { baseColor: "#C8C8C8", roughness: 0.25, metalness: 0.90 },
      accent_pin:     { baseColor: "#0EA5E9", roughness: 0.22, metalness: 0.30 },
      glass_frame:    { baseColor: "#111827", roughness: 0.28, metalness: 0.18 },
      glass_lens:     { baseColor: "#93C5FD", roughness: 0.08, metalness: 0.00 },
      hair:           { baseColor: "#3F2A1A", roughness: 0.88, metalness: 0.00 }
    };
    if (styles.includes("suit")) return {
      skin:           skinTone,
      suit_jacket:    { baseColor: "#1C2030", roughness: 0.68, metalness: 0.03 },
      suit_pants:     { baseColor: "#1E2232", roughness: 0.70, metalness: 0.02 },
      dress_shirt:    { baseColor: "#F4F2EE", roughness: 0.78, metalness: 0.01 },
      tie:            { baseColor: "#8B1E2D", roughness: 0.55, metalness: 0.04 },
      dress_shoe:     { baseColor: "#1A1210", roughness: 0.42, metalness: 0.12 },
      shoe_sole:      { baseColor: "#0E0C0A", roughness: 0.90, metalness: 0.01 },
      button_silver:  { baseColor: "#C8C8C8", roughness: 0.25, metalness: 0.90 },
      belt:           { baseColor: "#1A1210", roughness: 0.62, metalness: 0.04 },
      belt_buckle:    { baseColor: "#C8A840", roughness: 0.28, metalness: 0.88 },
      pocket_square:  { baseColor: "#F0EEE8", roughness: 0.72, metalness: 0.01 },
      hair:           { baseColor: "#201808", roughness: 0.86, metalness: 0.00 }
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

// -- USER COLOR PARSING -------------------------------------------------------
// Maps natural-language color mentions (Japanese + English) to a PBR triple.
function parseUserColor(prompt) {
  // dark/deep variants first (more specific)
  if (/濃い緑|深緑|ダーク.?グリーン|dark.?green|forest.?green/iu.test(prompt)) return { hex: "#1A5A1A", roughness: 0.45, metalness: 0.85 };
  if (/濃い青|深青|ネイビー|navy|ダーク.?ブルー|dark.?blue/iu.test(prompt))    return { hex: "#1A2A8A", roughness: 0.42, metalness: 0.86 };
  if (/濃い赤|深紅|ワイン|バーガンディ|burgundy|wine|dark.?red/iu.test(prompt)) return { hex: "#7A1010", roughness: 0.40, metalness: 0.84 };
  if (/濃い紫|dark.?purple/iu.test(prompt))                                     return { hex: "#4A0E8A", roughness: 0.42, metalness: 0.82 };
  // standard colors
  if (/赤|レッド|\bred\b/iu.test(prompt))   return { hex: "#CC2020", roughness: 0.40, metalness: 0.85 };
  if (/青|ブルー|\bblue\b/iu.test(prompt))  return { hex: "#2050CC", roughness: 0.40, metalness: 0.86 };
  if (/緑|グリーン|\bgreen\b/iu.test(prompt)) return { hex: "#2A7A2A", roughness: 0.42, metalness: 0.84 };
  if (/黄|イエロー|\byellow\b/iu.test(prompt)) return { hex: "#C8A010", roughness: 0.38, metalness: 0.82 };
  if (/白|ホワイト|\bwhite\b/iu.test(prompt)) return { hex: "#E8E8E8", roughness: 0.50, metalness: 0.12 };
  if (/黒|ブラック|\bblack\b/iu.test(prompt)) return { hex: "#1A1A1C", roughness: 0.38, metalness: 0.88 };
  if (/オレンジ|\borange\b/iu.test(prompt))  return { hex: "#CC5010", roughness: 0.40, metalness: 0.84 };
  if (/紫|パープル|\bpurple\b|\bviolet\b/iu.test(prompt)) return { hex: "#6A1ECC", roughness: 0.42, metalness: 0.82 };
  if (/ピンク|\bpink\b/iu.test(prompt))      return { hex: "#CC2888", roughness: 0.44, metalness: 0.72 };
  if (/茶|ブラウン|\bbrown\b/iu.test(prompt)) return { hex: "#6B3E22", roughness: 0.70, metalness: 0.20 };
  if (/灰|グレー|\bgray\b|\bgrey\b/iu.test(prompt)) return { hex: "#8A8A8A", roughness: 0.45, metalness: 0.80 };
  if (/金色|ゴールド|\bgold\b/iu.test(prompt)) return { hex: "#D4A820", roughness: 0.28, metalness: 0.92 };
  if (/銀色|シルバー|\bsilver\b/iu.test(prompt)) return { hex: "#C0C8CC", roughness: 0.30, metalness: 0.92 };
  return null;
}

// Primary material keys per subject — these receive the user-color override.
const USER_COLOR_PRIMARY_KEYS = {
  airship:     ["canvas_main"],
  tower:       ["concrete_main", "steel_main"],
  kaiju:       ["hide_main"],
  robot:       ["body_primary"],
  castle:      ["stone_main"],
  building:    ["facade_main"],
  vehicle:     ["body_main"],
  structure:   ["steel"],
  human:       ["clothing_main", "uniform_main"],
  warrior:     ["plate_main"],
  giant:       ["body_main", "armor_main"],
  ferris_wheel: [], // handled inside buildFerrisWheelSpec
};

function createBaseMaterials(subject, styles) {
  const mats = _rawBaseMaterials(subject, styles);
  if (styles.userColor) {
    const uc = styles.userColor;
    for (const k of (USER_COLOR_PRIMARY_KEYS[subject] || [])) {
      if (mats[k]) mats[k] = { ...mats[k], baseColor: uc.hex, roughness: uc.roughness, metalness: uc.metalness };
    }
  }
  return mats;
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
      generator: "prompt2gltf",
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
  const H = height;
  const r = (v) => Number(v.toFixed(3));

  const parts = [];
  const box = (id, material, sx, sy, sz, px, py, pz) => {
    parts.push({ id, kind: "box", size: [r(sx), r(sy), r(sz)], position: [r(px), r(py), r(pz)], rotation: [0, 0, 0], material });
  };
  const cyl = (id, material, sx, sy, sz, px, py, pz) => {
    parts.push({ id, kind: "cylinder", size: [r(sx), r(sy), r(sz)], position: [r(px), r(py), r(pz)], rotation: [0, 0, 0], material });
  };

  // ── Torso ──
  box("torso",            "body_primary",   H*0.20, H*0.22, H*0.12,  0,         H*0.55, 0);
  box("torso_front",      "body_secondary", H*0.14, H*0.10, H*0.03,  0,         H*0.57, H*0.062);
  box("core",             "emissive_core",  H*0.04, H*0.04, H*0.02,  0,         H*0.57, H*0.075);

  // ── Head & Neck ──
  cyl("neck",             "body_secondary", H*0.04, H*0.04, H*0.04,  0,         H*0.67, 0);
  box("head",             "body_secondary", H*0.10, H*0.09, H*0.09,  0,         H*0.73, 0);
  box("visor",            "emissive_core",  H*0.07, H*0.025,H*0.02,  0,         H*0.74, H*0.046);
  box("antenna_L",        "accent",         H*0.008,H*0.06, H*0.008, -H*0.035,  H*0.795,0);
  box("antenna_R",        "accent",         H*0.008,H*0.06, H*0.008,  H*0.035,  H*0.795,0);

  // ── Pelvis ──
  box("pelvis",           "body_primary",   H*0.16, H*0.07, H*0.10,  0,         H*0.44, 0);

  // ── Shoulders ──
  for (const side of [-1, 1]) {
    const s = side < 0 ? "L" : "R";
    const ox = side * H * 0.145;
    cyl(`shoulder_${s}`,   "accent",         H*0.06, H*0.06, H*0.06,  ox,        H*0.635,0);
    box(`upper_arm_${s}`,  "body_primary",   H*0.055,H*0.14, H*0.055, ox,        H*0.545,0);
    box(`elbow_${s}`,      "body_secondary", H*0.045,H*0.04, H*0.045, ox,        H*0.464,0);
    box(`forearm_${s}`,    "body_primary",   H*0.045,H*0.12, H*0.045, ox,        H*0.38, 0);
    box(`hand_${s}`,       "body_secondary", H*0.04, H*0.06, H*0.035, ox,        H*0.30, 0);
    box(`cannon_${s}`,     "accent",         H*0.025,H*0.07, H*0.025, ox,        H*0.265,0);
  }

  // ── Legs ──
  for (const side of [-1, 1]) {
    const s = side < 0 ? "L" : "R";
    const ox = side * H * 0.075;
    box(`hip_${s}`,        "body_primary",   H*0.09, H*0.04, H*0.09,  ox,        H*0.405,0);
    box(`thigh_${s}`,      "body_primary",   H*0.08, H*0.16, H*0.08,  ox,        H*0.31, 0);
    box(`knee_${s}`,       "accent",         H*0.065,H*0.045,H*0.065, ox,        H*0.22, 0);
    box(`shin_${s}`,       "body_primary",   H*0.07, H*0.14, H*0.075, ox,        H*0.135,0);
    box(`foot_${s}`,       "body_secondary", H*0.09, H*0.04, H*0.13,  ox,        H*0.04, H*0.015);
    box(`thruster_${s}`,   "body_secondary", H*0.05, H*0.06, H*0.04,  ox,        H*0.15,-H*0.052);
  }

  // ── Back boosters ──
  box("backpack",         "body_secondary", H*0.12, H*0.14, H*0.06,  0,         H*0.56,-H*0.09);
  cyl("booster_L",        "accent",         H*0.04, H*0.10, H*0.04, -H*0.045,   H*0.52,-H*0.12);
  cyl("booster_R",        "accent",         H*0.04, H*0.10, H*0.04,  H*0.045,   H*0.52,-H*0.12);

  // ── Surface details ──
  const surfaceDetails = [];
  const panel = (id, parentId, su, sv, pu, pv) => {
    surfaceDetails.push({ id, parentId, kind: "panel_line", uvScale: [r(su), r(sv)], uvOffset: [r(pu), r(pv)], material: "body_secondary" });
  };
  panel("torso_panel_1",  "torso",       0.6, 0.3, 0.2, 0.35);
  panel("torso_panel_2",  "torso",       0.6, 0.3, 0.2, 0.55);
  panel("head_panel_1",   "head",        0.8, 0.4, 0.1, 0.3);
  panel("thigh_L_panel",  "thigh_L",     0.7, 0.4, 0.15,0.3);
  panel("thigh_R_panel",  "thigh_R",     0.7, 0.4, 0.15,0.3);
  panel("shin_L_panel",   "shin_L",      0.7, 0.35,0.15,0.3);
  panel("shin_R_panel",   "shin_R",      0.7, 0.35,0.15,0.3);
  panel("forearm_L_panel","forearm_L",   0.6, 0.3, 0.2, 0.35);
  panel("forearm_R_panel","forearm_R",   0.6, 0.3, 0.2, 0.35);

  return {
    ...base,
    globalScale: {
      height: H,
      width:  r(H * 0.36),
      depth:  r(H * 0.14)
    },
    style: {
      silhouette: "heroic_mecha",
      mood: "powerful",
      genre: "sci_fi",
      detailDensity: "high",
      bodyLanguage: "humanoid_bipedal",
      shapeLanguage: ["armored_plates", "thruster_pods", "visor_eyes", "shoulder_cannons", "backpack_boosters"]
    },
    materials: createBaseMaterials("robot", styles),
    parts,
    surfaceDetails,
    ornaments: [],
    pose: { preset: "idle" },
    animationHints: {
      thrusterGlow: ["booster_L", "booster_R", "thruster_L", "thruster_R"],
      visorPulse: ["visor", "core"]
    },
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
  if (/clinic|\u30af\u30ea\u30cb\u30c3\u30af|\u8a3a\u7642\u6240|\u5185\u79d1|\u7686\u79d1|\u6b6f\u79d1|\u5916\u79d1|\u5c0f\u5150\u79d1|\u76ae\u819a\u79d1|\u7adf\u7cbe\u795e\u79d1/iu.test(prompt)) return "facility_clinic";
  if (/hospital|\u75c5\u9662/iu.test(prompt)) return "facility_hospital";
  if (/police.?station|\u8b66\u5bdf\u7f72/iu.test(prompt)) return "facility_police";
  if (/fire.?station|\u6d88\u9632\u7f72/iu.test(prompt)) return "facility_fire";
  if (/nursing.?home|\u8001\u4eba\u30db\u30fc\u30e0|\u4ecb\u8b77\u65bd\u8a2d/iu.test(prompt)) return "facility_nursing";
  if (/city.?hall|town.?hall|\u5e02\u5f79\u6240|\u533a\u5f79\u6240|\u753a\u5f79\u5834/iu.test(prompt)) return "facility_cityhall";
  if (/university|campus|\u5927\u5b66|\u30ad\u30e3\u30f3\u30d1\u30b9|\u5927\u5b66\u9662/iu.test(prompt)) return "facility_university";
  if (/\b(elementary|junior.?high|high|senior).?school|\u5c0f\u5b66\u6821|\u4e2d\u5b66\u6821|\u9ad8\u6821/iu.test(prompt)) return "facility_school";
  if (/school|\u5b66\u6821/iu.test(prompt)) return "facility_school";

  // Residential
  if (/(\b1\b|single|one)[-\s]?(story|floor)|\u5e73\u5c4b|\u6238\u5efa/u.test(prompt)) return "house_single";
  if (/2[-\s]?(story|floor)|\u4e8c\u968e\u5efa|\u0032\u968e\u5efa/u.test(prompt) && /apartment|\u30a2\u30d1\u30fc\u30c8/u.test(prompt)) return "apartment_2f";
  if (/2[-\s]?(story|floor)|\u4e8c\u968e\u5efa|\u0032\u968e\u5efa/u.test(prompt)) return "house_2f";
  if (/3[-\s]?(story|floor)|\u4e09\u968e\u5efa|\u0033\u968e\u5efa/u.test(prompt)) return "house_3f";
  if (/japanese|traditional|washitsu|\u548c\u98a8|\u548c\u5f0f/u.test(prompt) && /house|\u4f4f\u5b85|\u6238\u5efa/u.test(prompt)) return "house_jp";
  if (/modern|contemporary|\u30e2\u30c0\u30f3/iu.test(prompt) && /house|\u4f4f\u5b85|\u6238\u5efa|\u30cf\u30a6\u30b9/u.test(prompt)) return "house_modern";
  if (/western|\u6d0b\u98a8/u.test(prompt) && /house|\u4f4f\u5b85|\u6238\u5efa/u.test(prompt)) return "house_western";
  if (/family.*mansion|family.*condo|\u30d5\u30a1\u30df\u30ea\u30fc.*\u30de\u30f3\u30b7\u30e7\u30f3/u.test(prompt)) return "mansion_family";
  if (/\u5927\u90b8\u5b85|mansion|estate|villa/u.test(prompt)) return "mansion_estate";
  if (/apartment|\u30a2\u30d1\u30fc\u30c8|\u30de\u30f3\u30b7\u30e7\u30f3/u.test(prompt)) return "apartment_mid";
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
    house_modern:  { w: 0.72, d: 0.60, body: 0.73, roof: 0.27 },
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
    facility_clinic:   { w: 0.22, d: 0.14, body: 0.80, roof: 0.08 },
    facility_hospital: { w: 1.20, d: 0.80, body: 0.82, roof: 0.06 },
    facility_police:   { w: 0.90, d: 0.60, body: 0.80, roof: 0.08 },
    facility_fire:     { w: 0.80, d: 0.60, body: 0.78, roof: 0.10 },
    facility_nursing:  { w: 1.00, d: 0.70, body: 0.80, roof: 0.08 },
    facility_cityhall:    { w: 1.30, d: 0.70, body: 0.78, roof: 0.10 },
    facility_school:      { w: 1.40, d: 0.60, body: 0.80, roof: 0.08 },
    facility_university:  { w: 1.50, d: 0.80, body: 0.82, roof: 0.06 }
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
        : archetype === "facility_university" ? "educational_campus"
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

  // ── 診療所・クリニック: 小型医療施設 + 駐車場 ──────────────────────────────
  if (archetype === "facility_clinic") {
    spec.materials = {
      wall_main:    { baseColor: "#F0F2EE", roughness: 0.88, metalness: 0.03 },
      wall_accent:  { baseColor: "#C4DCE8", roughness: 0.82, metalness: 0.08 },
      concrete:     { baseColor: "#C8CCC8", roughness: 0.92, metalness: 0.02 },
      glass_win:    { baseColor: "#88C4E0", roughness: 0.08, metalness: 0.90 },
      glass_entry:  { baseColor: "#B0D8EE", roughness: 0.06, metalness: 0.88 },
      canopy:       { baseColor: "#D4DCE8", roughness: 0.84, metalness: 0.10 },
      sign_red:     { baseColor: "#CC2020", roughness: 0.40, metalness: 0.10 },
      steel_frame:  { baseColor: "#909898", roughness: 0.55, metalness: 0.60 },
      pavement:     { baseColor: "#B4B8B4", roughness: 0.96, metalness: 0.01 },
      parking_line: { baseColor: "#E8E820", roughness: 0.60, metalness: 0.05 },
      roof_flat:    { baseColor: "#A8B0A8", roughness: 0.90, metalness: 0.05 },
      ramp:         { baseColor: "#C8C4BC", roughness: 0.94, metalness: 0.01 },
    };

    // ── 寸法: 2階建て診療所 ──────────────────────────────────────────────────
    const fH      = 3.6;   // 1フロア高さ
    const floors  = 2;
    const foundH  = 0.4;
    const parH    = 0.9;
    const parT    = 0.28;
    const roofSlabH = 0.20;
    const bodyH   = fH * floors;      // 7.2m

    // 建物本体
    const bW = 18.0;   // 建物幅
    const bD = 12.0;   // 建物奥行き
    const bX =  0.0;
    const bZ = -4.0;   // 敷地後方よりに配置（前面に駐車場スペース確保）

    // 駐車場: 建物右側〜前面
    const parkW     = 16.0;  // 駐車場幅 (6台分: 2.5m×6+余裕)
    const spaceD    = 5.0;   // 駐車スペース奥行き
    const aisleD    = 6.0;   // 通路幅
    const parkD     = spaceD + aisleD;  // 11m
    const parkX     = bX + bW * 0.5 + parkW * 0.5 + 0.5;
    const parkZ     = bZ + bD * 0.5 - parkD * 0.5;  // 建物前面に揃える
    const nSpaces   = 6;
    const spaceW    = 2.5;

    // 敷地バウンディング (建物・駐車場・アプローチを全て包む)
    const margin   = 3.5;
    const _siteMinX = bX - bW * 0.5 - margin;
    const _siteMaxX = parkX + parkW * 0.5 + margin;
    const _siteMinZ = Math.min(bZ - bD * 0.5, parkZ - parkD * 0.5) - margin;
    const _siteMaxZ = bZ + bD * 0.5 + 7.0 + margin;  // 入口前アプローチ含む
    const _siteCX   = (_siteMinX + _siteMaxX) * 0.5;
    const _siteCZ   = (_siteMinZ + _siteMaxZ) * 0.5;
    const _siteW    = _siteMaxX - _siteMinX;
    const _siteD    = _siteMaxZ - _siteMinZ;

    // ── 敷地・アプローチ ─────────────────────────────────────────────────────
    box("site_pave",     "pavement",   _siteW, 0.20, _siteD,  _siteCX, 0.10, _siteCZ);

    // ── 建物本体 ─────────────────────────────────────────────────────────────
    box("found",         "concrete",   bW+0.3, foundH, bD+0.3,  bX, foundH*0.5, bZ);

    for (let f = 0; f < floors; f++) {
      const fy0 = foundH + f * fH;
      box(`wall_f${f+1}`,    "wall_main",   bW,     fH-0.12, bD,     bX, fy0+(fH-0.12)*0.5, bZ);
      box(`band_f${f+1}`,    "wall_accent", bW+0.1, 0.12,    bD+0.1, bX, fy0, bZ);
      // 前面窓
      box(`win_f_f${f+1}`,   "glass_win",   bW*0.60, fH*0.50, 0.18,   bX, fy0+fH*0.55, bZ+bD*0.5);
      // 背面窓
      box(`win_b_f${f+1}`,   "glass_win",   bW*0.48, fH*0.44, 0.18,   bX, fy0+fH*0.54, bZ-bD*0.5);
      // 側面窓（右）
      box(`win_R_f${f+1}`,   "glass_win",   0.18, fH*0.44, bD*0.50,  bX+bW*0.5, fy0+fH*0.52, bZ);
    }

    // パラペット
    const pY = foundH + bodyH;
    box("par_f",   "concrete", bW+parT*2, parH, parT,   bX,         pY+parH*0.5, bZ+bD*0.5+parT*0.5);
    box("par_b",   "concrete", bW+parT*2, parH, parT,   bX,         pY+parH*0.5, bZ-bD*0.5-parT*0.5);
    box("par_L",   "concrete", parT, parH, bD,          bX-bW*0.5-parT*0.5, pY+parH*0.5, bZ);
    box("par_R",   "concrete", parT, parH, bD,          bX+bW*0.5+parT*0.5, pY+parH*0.5, bZ);
    box("roof",    "roof_flat",bW+parT*2, roofSlabH, bD+parT*2,  bX, pY+parH+roofSlabH*0.5, bZ);

    // ── 正面入口 ────────────────────────────────────────────────────────────
    const entW   = bW * 0.38;
    const entD   = 3.8;
    const entCZ  = bZ + bD * 0.5;
    const canopyY = foundH + fH * 0.84;
    box("canopy",        "canopy",     entW+0.6, 0.22, entD,    bX, canopyY, entCZ+entD*0.5);
    box("col_L",         "steel_frame",0.24, canopyY, 0.24,     bX-entW*0.44, canopyY*0.5, entCZ+entD*0.88);
    box("col_R",         "steel_frame",0.24, canopyY, 0.24,     bX+entW*0.44, canopyY*0.5, entCZ+entD*0.88);
    box("entry_door",    "glass_entry",entW*0.65, fH*0.80, 0.22, bX, foundH+fH*0.43, entCZ);
    // スロープ (バリアフリー)
    box("ramp",          "ramp",       entW*0.55, foundH, entD*0.55, bX-entW*0.25, foundH*0.5, entCZ+entD*0.55);

    // クリニックサイン (医療十字)
    box("sign_h",        "sign_red",   2.4, 0.40, 0.14,  bX+bW*0.26, foundH+fH*0.86, bZ+bD*0.502);
    box("sign_v",        "sign_red",   0.40, 2.4, 0.14,  bX+bW*0.26, foundH+fH*0.72, bZ+bD*0.502);
    // 看板プレート
    box("signboard",     "wall_accent",bW*0.50, fH*0.18, 0.12, bX-bW*0.08, foundH+bodyH+parH*0.40, bZ+bD*0.502);

    // ── 駐車場 ───────────────────────────────────────────────────────────────
    box("parking_base",  "pavement",   parkW, 0.20, parkD,  parkX, 0.10, parkZ);
    // 駐車スペースライン (6台)
    for (let i = 0; i < nSpaces; i++) {
      const sx = parkX - parkW*0.5 + spaceW*(i+0.5) + 0.5;
      box(`pk_line_${i}`, "parking_line", 0.10, 0.06, spaceD, sx, 0.22, parkZ);
    }
    // 駐車場前面境界ライン
    box("pk_front_line", "parking_line", parkW, 0.06, 0.10, parkX, 0.22, parkZ+parkD*0.5);
    // 車止め (6台分)
    for (let i = 0; i < nSpaces; i++) {
      const sx = parkX - parkW*0.5 + spaceW*(i+0.5) + 0.5;
      box(`pk_stop_${i}`, "concrete",  spaceW*0.60, 0.15, 0.22, sx, 0.28, parkZ-parkD*0.5+0.5);
    }

    // 屋上設備
    box("ac_unit",       "concrete",  2.0, 1.2, 1.4,  bX+bW*0.28, pY+parH+roofSlabH+0.6, bZ-bD*0.22);

    // ── Surface details ───────────────────────────────────────────────────────
    const regions = ["facade", "window", "roof", "entrance", "parking"];
    const types   = ["panel_seam", "window_grid", "weathering", "trim_line", "concrete_texture"];
    let sdIdx = 1;
    for (const region of regions) {
      for (let i = 0; i < 8; i++) {
        pushSurface(`sd_${sdIdx++}`, region, types[i % types.length],
          0.10 + (i % 5) * 0.04,
          [Math.sin(i*0.9)*0.014, Math.cos(i*0.7)*0.011, ((i%4)-1.5)*0.009]);
      }
    }

    const totalH = foundH + bodyH + parH + roofSlabH;
    spec.globalScale = { height: rounded(totalH), width: rounded(_siteW), depth: rounded(_siteD) };
    spec.parts = parts;
    spec.surfaceDetails = surfaceDetails;
    return spec;
  }
  // ── END facility_clinic override ─────────────────────────────────────────────

  // ── 200床病院: 外来棟 + 病棟2翼 + 救急入口 ─────────────────────────────────
  if (archetype === "facility_hospital") {
    // Materials
    spec.materials = {
      wall_main:    { baseColor: "#EDF0EC", roughness: 0.88, metalness: 0.03 },
      wall_accent:  { baseColor: "#B8D0E0", roughness: 0.82, metalness: 0.08 },
      concrete:     { baseColor: "#C8CCC8", roughness: 0.92, metalness: 0.02 },
      glass_win:    { baseColor: "#7ABCD8", roughness: 0.08, metalness: 0.90 },
      glass_entry:  { baseColor: "#A8D0E8", roughness: 0.06, metalness: 0.88 },
      canopy:       { baseColor: "#D0D8D4", roughness: 0.85, metalness: 0.10 },
      sign_red:     { baseColor: "#CC2020", roughness: 0.40, metalness: 0.10 },
      sign_green:   { baseColor: "#208040", roughness: 0.40, metalness: 0.10 },
      steel_frame:  { baseColor: "#909898", roughness: 0.55, metalness: 0.60 },
      pavement:     { baseColor: "#B0B4B0", roughness: 0.96, metalness: 0.01 },
      roof_flat:    { baseColor: "#A8B0A8", roughness: 0.90, metalness: 0.05 },
      helipad_mark: { baseColor: "#E8E020", roughness: 0.50, metalness: 0.05 },
    };

    // ── 寸法設計 ─────────────────────────────────────────────────────────────
    // 200床規模 3階建て: 階高4.0m × 3F = 12.0m + 基礎0.5m + パラペット1.2m
    const fH      = 4.0;          // 1フロア高さ
    const floors  = 3;
    const foundH  = 0.5;          // 基礎立上り
    const parH    = 1.2;          // パラペット高さ
    const parT    = 0.35;         // パラペット厚
    const roofSlabH = 0.3;        // 屋根スラブ厚
    const bodyH   = fH * floors;  // 12.0m
    const totalH  = foundH + bodyH + parH + roofSlabH;

    // 外来棟 (main outpatient / admin block) — 前面
    const opW = 42.0;  // 外来棟 幅
    const opD = 18.0;  // 外来棟 奥行き
    const opZ =  0.0;  // 外来棟 Z中心

    // 病棟A (Ward A) — 右翼
    const wdW = 18.0;  // 病棟 幅
    const wdD = 34.0;  // 病棟 奥行き (3F×100床/2棟=50床/翼/F)
    const wdAX =  opW * 0.5 - wdW * 0.5;              //  右寄せ
    const wdBX = -opW * 0.5 + wdW * 0.5;              //  左寄せ
    const wdZ  = -(opD * 0.5 + wdD * 0.5);            //  外来棟後方に接続

    // 渡り廊下 (link corridor)
    const lkW  = opW - wdW * 2;   // 病棟間距離
    const lkD  = 5.0;
    const lkH  = fH * 1.2;
    const lkZ  = wdZ + wdD * 0.5 - lkD * 0.5 - wdD * 0.4;

    // 救急棟/ポーチ (ER wing — left side of main)
    const erW  = 16.0;
    const erD  = 12.0;
    const erX  = -(opW * 0.5 + erW * 0.5);
    const erZ  =  opD * 0.1;

    // 救急ポーチ (ambulance canopy)
    const pchW = erW + 4.0;
    const pchD = 10.0;
    const pchH = foundH + fH * 0.75;

    // ── 敷地 ─────────────────────────────────────────────────────────────────
    // 全建物フットプリントを包む敷地を厳密に計算
    const _siteMargin = 4.0;
    const _siteMinX = erX - erW * 0.5 - _siteMargin;        // ER左端
    const _siteMaxX = opW * 0.5      + _siteMargin;          // 外来棟右端
    const _siteMinZ = wdZ - wdD * 0.5 - _siteMargin;         // 病棟後端
    const _siteMaxZ = Math.max(opZ + opD * 0.5 + 5.5, erZ + erD * 0.5 + pchD + 2) + _siteMargin; // 外来入口 or 救急ポーチ前端の広い方
    const _siteCX   = (_siteMinX + _siteMaxX) * 0.5;
    const _siteCZ   = (_siteMinZ + _siteMaxZ) * 0.5;
    const siteW     = _siteMaxX - _siteMinX;
    const siteD     = _siteMaxZ - _siteMinZ;
    box("site_pave",    "pavement",  siteW, 0.20, siteD,  _siteCX, 0.10, _siteCZ);

    // ── 外来棟 ────────────────────────────────────────────────────────────────
    // 基礎
    box("op_found",     "concrete",  opW+0.4, foundH, opD+0.4,     0, foundH*0.5, opZ);
    // 1F–3F ウォール (3フロア分)
    for (let f = 0; f < floors; f++) {
      const fy0 = foundH + f * fH;
      box(`op_wall_f${f+1}`, "wall_main", opW, fH - 0.15, opD,     0, fy0 + (fH-0.15)*0.5, opZ);
      // 水平帯 (floor band)
      box(`op_band_f${f+1}`, "wall_accent", opW+0.1, 0.15, opD+0.1, 0, fy0, opZ);
      // 窓: 前面
      box(`op_win_f_f${f+1}`, "glass_win", opW*0.68, fH*0.52, 0.20,  0, fy0+fH*0.54, opZ + opD*0.5);
      // 窓: 後面
      box(`op_win_b_f${f+1}`, "glass_win", opW*0.55, fH*0.46, 0.20,  0, fy0+fH*0.52, opZ - opD*0.5);
    }
    // パラペット
    box("op_par_f",     "concrete",  opW+parT*2, parH, parT,   0, foundH+bodyH+parH*0.5,  opZ+opD*0.5+parT*0.5);
    box("op_par_b",     "concrete",  opW+parT*2, parH, parT,   0, foundH+bodyH+parH*0.5,  opZ-opD*0.5-parT*0.5);
    box("op_par_L",     "concrete",  parT, parH, opD,         -opW*0.5-parT*0.5, foundH+bodyH+parH*0.5, opZ);
    box("op_par_R",     "concrete",  parT, parH, opD,          opW*0.5+parT*0.5, foundH+bodyH+parH*0.5, opZ);
    // 屋根スラブ
    box("op_roof",      "roof_flat", opW+parT*2, roofSlabH, opD+parT*2, 0, foundH+bodyH+parH+roofSlabH*0.5, opZ);

    // 外来入口 (外来正面ポーチ)
    const opEntryW = opW * 0.44;
    const opEntryD = 5.5;
    box("op_entry_canopy","canopy",  opEntryW, 0.28, opEntryD,    0, foundH+fH*0.88, opZ+opD*0.5+opEntryD*0.5);
    box("op_entry_col_L","steel_frame", 0.30, foundH+fH*0.88, 0.30, -opEntryW*0.40, (foundH+fH*0.88)*0.5, opZ+opD*0.5+opEntryD);
    box("op_entry_col_R","steel_frame", 0.30, foundH+fH*0.88, 0.30,  opEntryW*0.40, (foundH+fH*0.88)*0.5, opZ+opD*0.5+opEntryD);
    box("op_entry_door", "glass_entry", opEntryW*0.60, fH*0.82, 0.25,  0, foundH+fH*0.44, opZ+opD*0.5);
    // 外来サイン
    box("op_sign_h",    "sign_red",  4.0, 0.50, 0.15,   opW*0.20, foundH+bodyH*0.88, opZ+opD*0.505);
    box("op_sign_v",    "sign_red",  0.50, 4.0, 0.15,   opW*0.20, foundH+bodyH*0.66, opZ+opD*0.505);

    // ── 救急棟 ────────────────────────────────────────────────────────────────
    box("er_found",     "concrete",  erW+0.3, foundH, erD+0.3,  erX, foundH*0.5, erZ);
    for (let f = 0; f < floors; f++) {
      const fy0 = foundH + f * fH;
      box(`er_wall_f${f+1}`, "wall_main", erW, fH-0.15, erD,   erX, fy0+(fH-0.15)*0.5, erZ);
      box(`er_band_f${f+1}`, "wall_accent", erW+0.1, 0.15, erD+0.1, erX, fy0, erZ);
      box(`er_win_f${f+1}`,  "glass_win", erW*0.55, fH*0.46, 0.20,  erX, fy0+fH*0.52, erZ+erD*0.5);
    }
    box("er_par_f",     "concrete",  erW+parT*2, parH, parT,   erX, foundH+bodyH+parH*0.5, erZ+erD*0.5+parT*0.5);
    box("er_par_b",     "concrete",  erW+parT*2, parH, parT,   erX, foundH+bodyH+parH*0.5, erZ-erD*0.5-parT*0.5);
    box("er_par_L",     "concrete",  parT, parH, erD,          erX-erW*0.5-parT*0.5, foundH+bodyH+parH*0.5, erZ);
    box("er_par_R",     "concrete",  parT, parH, erD,          erX+erW*0.5+parT*0.5, foundH+bodyH+parH*0.5, erZ);
    box("er_roof",      "roof_flat", erW+parT*2, roofSlabH, erD+parT*2, erX, foundH+bodyH+parH+roofSlabH*0.5, erZ);

    // 救急入口ドア (南面)
    box("er_door",      "glass_entry", erW*0.55, fH*0.78, 0.25,  erX, foundH+fH*0.42, erZ+erD*0.5);
    // 救急サイン
    box("er_sign_h",    "sign_red",  3.2, 0.45, 0.15,  erX, foundH+fH*0.92, erZ+erD*0.505);
    box("er_sign_v",    "sign_red",  0.45, 3.2, 0.15,  erX, foundH+fH*0.74, erZ+erD*0.505);

    // 救急ポーチ (ambulance porte-cochère)
    const pchY = pchH;
    box("pch_roof",     "canopy",    pchW, 0.30, pchD,          erX-1.0, pchY, erZ+erD*0.5+pchD*0.5);
    box("pch_col_LL",   "steel_frame", 0.28, pchH, 0.28,        erX-1.0-pchW*0.38, pchH*0.5, erZ+erD*0.5+pchD*0.88);
    box("pch_col_LR",   "steel_frame", 0.28, pchH, 0.28,        erX-1.0+pchW*0.38, pchH*0.5, erZ+erD*0.5+pchD*0.88);
    // 救急車路 (ambulance driveway — ground marking)
    box("er_driveway",  "pavement",  pchW+2, 0.22, pchD+6,      erX-1.0, 0.11, erZ+erD*0.5+pchD*0.5+2);

    // ── 病棟A (右翼) ─────────────────────────────────────────────────────────
    box("wdA_found",    "concrete",  wdW+0.3, foundH, wdD+0.3,  wdAX, foundH*0.5, wdZ);
    for (let f = 0; f < floors; f++) {
      const fy0 = foundH + f * fH;
      box(`wdA_wall_f${f+1}`, "wall_main",  wdW, fH-0.15, wdD,  wdAX, fy0+(fH-0.15)*0.5, wdZ);
      box(`wdA_band_f${f+1}`, "wall_accent",wdW+0.1, 0.15, wdD+0.1, wdAX, fy0, wdZ);
      // 窓: 東面 (外側)
      box(`wdA_winE_f${f+1}`,"glass_win",0.20,fH*0.52,wdD*0.72, wdAX+wdW*0.5, fy0+fH*0.54, wdZ);
      // 窓: 西面 (廊下側)
      box(`wdA_winW_f${f+1}`,"glass_win",0.20,fH*0.40,wdD*0.55, wdAX-wdW*0.5, fy0+fH*0.52, wdZ);
    }
    box("wdA_par_f",    "concrete",  wdW+parT*2, parH, parT,    wdAX, foundH+bodyH+parH*0.5, wdZ+wdD*0.5+parT*0.5);
    box("wdA_par_b",    "concrete",  wdW+parT*2, parH, parT,    wdAX, foundH+bodyH+parH*0.5, wdZ-wdD*0.5-parT*0.5);
    box("wdA_par_E",    "concrete",  parT, parH, wdD,           wdAX+wdW*0.5+parT*0.5, foundH+bodyH+parH*0.5, wdZ);
    box("wdA_par_W",    "concrete",  parT, parH, wdD,           wdAX-wdW*0.5-parT*0.5, foundH+bodyH+parH*0.5, wdZ);
    box("wdA_roof",     "roof_flat", wdW+parT*2, roofSlabH, wdD+parT*2, wdAX, foundH+bodyH+parH+roofSlabH*0.5, wdZ);

    // ── 病棟B (左翼) ─────────────────────────────────────────────────────────
    box("wdB_found",    "concrete",  wdW+0.3, foundH, wdD+0.3,  wdBX, foundH*0.5, wdZ);
    for (let f = 0; f < floors; f++) {
      const fy0 = foundH + f * fH;
      box(`wdB_wall_f${f+1}`, "wall_main",  wdW, fH-0.15, wdD,  wdBX, fy0+(fH-0.15)*0.5, wdZ);
      box(`wdB_band_f${f+1}`, "wall_accent",wdW+0.1, 0.15, wdD+0.1, wdBX, fy0, wdZ);
      box(`wdB_winW_f${f+1}`,"glass_win",0.20,fH*0.52,wdD*0.72, wdBX-wdW*0.5, fy0+fH*0.54, wdZ);
      box(`wdB_winE_f${f+1}`,"glass_win",0.20,fH*0.40,wdD*0.55, wdBX+wdW*0.5, fy0+fH*0.52, wdZ);
    }
    box("wdB_par_f",    "concrete",  wdW+parT*2, parH, parT,    wdBX, foundH+bodyH+parH*0.5, wdZ+wdD*0.5+parT*0.5);
    box("wdB_par_b",    "concrete",  wdW+parT*2, parH, parT,    wdBX, foundH+bodyH+parH*0.5, wdZ-wdD*0.5-parT*0.5);
    box("wdB_par_E",    "concrete",  parT, parH, wdD,           wdBX+wdW*0.5+parT*0.5, foundH+bodyH+parH*0.5, wdZ);
    box("wdB_par_W",    "concrete",  parT, parH, wdD,           wdBX-wdW*0.5-parT*0.5, foundH+bodyH+parH*0.5, wdZ);
    box("wdB_roof",     "roof_flat", wdW+parT*2, roofSlabH, wdD+parT*2, wdBX, foundH+bodyH+parH+roofSlabH*0.5, wdZ);

    // ── 渡り廊下 (link corridor between wards) ───────────────────────────────
    box("link_wall",    "wall_main",  lkW, lkH, lkD,           0, foundH+lkH*0.5, lkZ);
    box("link_win_f",   "glass_win",  lkW*0.80, lkH*0.55, 0.18, 0, foundH+lkH*0.58, lkZ+lkD*0.5);
    box("link_win_b",   "glass_win",  lkW*0.80, lkH*0.55, 0.18, 0, foundH+lkH*0.58, lkZ-lkD*0.5);

    // ── 屋上 (rooftop) ────────────────────────────────────────────────────────
    // ヘリポート (helipad on outpatient roof)
    const hpY = foundH + bodyH + parH + roofSlabH;
    shape("helipad_circle","cylinder","helipad_mark",10.0, 0.08, 10.0, 0, hpY+0.04, opZ);
    box("helipad_H_h",  "sign_red",  5.0, 0.10, 1.2,   0, hpY+0.09, opZ);
    box("helipad_H_v1", "sign_red",  1.2, 0.10, 3.8, -1.5, hpY+0.09, opZ);
    box("helipad_H_v2", "sign_red",  1.2, 0.10, 3.8,  1.5, hpY+0.09, opZ);
    // 屋上設備 (rooftop equipment — AC units etc)
    box("ac_unit_1",    "concrete",  3.0, 1.8, 2.0,   opW*0.30, hpY+0.9, opZ-opD*0.28);
    box("ac_unit_2",    "concrete",  3.0, 1.8, 2.0,  -opW*0.30, hpY+0.9, opZ-opD*0.28);

    // ── Surface details ───────────────────────────────────────────────────────
    const hosp_regions  = ["facade", "window", "roof", "entrance", "ward"];
    const hosp_types    = ["panel_seam", "window_grid", "weathering", "trim_line", "concrete_texture"];
    let sdIdx = 1;
    for (const region of hosp_regions) {
      for (let i = 0; i < 8; i++) {
        pushSurface(`sd_${sdIdx++}`, region, hosp_types[i % hosp_types.length],
          0.10 + (i % 5) * 0.04,
          [Math.sin(i*0.9)*0.014, Math.cos(i*0.7)*0.011, ((i%4)-1.5)*0.009]);
      }
    }

    spec.globalScale = { height: rounded(totalH), width: rounded(opW + erW), depth: rounded(opD + wdD) };
    spec.parts = parts;
    spec.surfaceDetails = surfaceDetails;
    return spec;
  }
  // ── END facility_hospital override ───────────────────────────────────────────

  // ── 警察署: 厳格・威圧的な公安施設 ──────────────────────────────────────────
  if (archetype === "facility_police") {
    spec.materials = {
      wall_main:    { baseColor: "#484C52", roughness: 0.90, metalness: 0.05 },
      wall_dark:    { baseColor: "#2E3238", roughness: 0.92, metalness: 0.04 },
      wall_trim:    { baseColor: "#1A1E24", roughness: 0.88, metalness: 0.08 },
      concrete_hvy: { baseColor: "#5A5E64", roughness: 0.94, metalness: 0.03 },
      glass_win:    { baseColor: "#3A4858", roughness: 0.12, metalness: 0.86 },
      glass_entry:  { baseColor: "#4A6070", roughness: 0.08, metalness: 0.88 },
      sign_navy:    { baseColor: "#1030A0", roughness: 0.38, metalness: 0.15 },
      sign_white:   { baseColor: "#E8EEF0", roughness: 0.55, metalness: 0.05 },
      flagpole:     { baseColor: "#B0B4B8", roughness: 0.40, metalness: 0.80 },
      flag_navy:    { baseColor: "#0A2070", roughness: 0.65, metalness: 0.05 },
      fence:        { baseColor: "#282C30", roughness: 0.85, metalness: 0.25 },
      fence_top:    { baseColor: "#1A1E22", roughness: 0.72, metalness: 0.45 },
      paving_main:  { baseColor: "#9A9C98", roughness: 0.95, metalness: 0.02 },
      paving_entry: { baseColor: "#B0B4AC", roughness: 0.94, metalness: 0.02 },
      step_stone:   { baseColor: "#4A4E52", roughness: 0.90, metalness: 0.04 },
      parking_line: { baseColor: "#DCDCDC", roughness: 0.60, metalness: 0.05 },
      roof_flat:    { baseColor: "#3C4044", roughness: 0.92, metalness: 0.06 },
    };

    // ── 寸法: 5階建て・威圧的プロポーション ─────────────────────────────────
    const fH      = 4.0;
    const floors  = 5;
    const foundH  = 1.0;   // 高い台座
    const parH    = 1.0;
    const parT    = 0.40;
    const roofSlabH = 0.25;
    const bodyH   = fH * floors;  // 20m
    const bW      = 32.0;
    const bD      = 20.0;
    const bX      = 0.0;
    const bZ      = 0.0;
    const stepsZ  = bZ + bD * 0.5;
    const stepsD  = 6.0;
    const colH    = foundH + bodyH * 0.38;

    // パトカーガレージ (右側)
    const gbW = 16.0, gbD = 9.0, gbH = fH * 1.25;
    const gbX = bW * 0.5 + gbW * 0.5 + 0.6;
    const gbZ = bZ + bD * 0.5 - gbD * 0.5;

    // フェンス基準
    const fenceH     = 2.4;
    const fenceT     = 0.15;
    const gateW      = 7.0;
    const fenceZ_front = stepsZ + stepsD + 2.5;
    const fenceZ_back  = bZ - bD * 0.5 - 3.5;
    const fenceX_left  = -bW * 0.5 - 2.5;
    const fenceX_right =  gbX + gbW * 0.5 + 2.0;
    const fenceSpan    =  fenceX_right - fenceX_left;

    // 敷地バウンディング
    const margin = 3.5;
    const _siteMinX = fenceX_left  - margin;
    const _siteMaxX = fenceX_right + margin;
    const _siteMinZ = fenceZ_back  - margin;
    const _siteMaxZ = fenceZ_front + margin;
    const _siteCX   = (_siteMinX + _siteMaxX) * 0.5;
    const _siteCZ   = (_siteMinZ + _siteMaxZ) * 0.5;
    const _siteW    = _siteMaxX - _siteMinX;
    const _siteD    = _siteMaxZ - _siteMinZ;

    // ── 敷地 ─────────────────────────────────────────────────────────────
    box("site_pave",    "paving_main",  _siteW, 0.20, _siteD, _siteCX, 0.10, _siteCZ);

    // ── 本館 ─────────────────────────────────────────────────────────────
    box("plinth",       "concrete_hvy", bW+1.0, foundH, bD+1.0,  bX, foundH*0.5, bZ);
    for (let f = 0; f < floors; f++) {
      const fy0 = foundH + f * fH;
      box(`wall_f${f+1}`,  "wall_main",  bW,     fH-0.18, bD,     bX, fy0+(fH-0.18)*0.5, bZ);
      box(`trim_f${f+1}`,  "wall_trim",  bW+0.1, 0.18,    bD+0.1, bX, fy0, bZ);
      // 前面窓 (小窓×5スパン — セキュリティ感)
      for (let w = -2; w <= 2; w++) {
        box(`win_f_f${f+1}_${w+3}`, "glass_win", bW*0.088, fH*0.46, 0.20,
          bX + w * bW * 0.17, fy0+fH*0.55, bZ+bD*0.5);
      }
      // 後面窓 (さらに小さく)
      for (let w = -1; w <= 1; w++) {
        box(`win_b_f${f+1}_${w+2}`, "glass_win", bW*0.07, fH*0.34, 0.20,
          bX + w * bW * 0.22, fy0+fH*0.52, bZ-bD*0.5);
      }
    }
    // パラペット
    const pY = foundH + bodyH;
    box("par_f",  "wall_dark", bW+parT*2, parH, parT, bX,              pY+parH*0.5, bZ+bD*0.5+parT*0.5);
    box("par_b",  "wall_dark", bW+parT*2, parH, parT, bX,              pY+parH*0.5, bZ-bD*0.5-parT*0.5);
    box("par_L",  "wall_dark", parT, parH, bD,         bX-bW*0.5-parT*0.5, pY+parH*0.5, bZ);
    box("par_R",  "wall_dark", parT, parH, bD,         bX+bW*0.5+parT*0.5, pY+parH*0.5, bZ);
    box("roof",   "roof_flat", bW+parT*2, roofSlabH, bD+parT*2, bX, pY+parH+roofSlabH*0.5, bZ);
    // 屋上突出部 (階段室)
    box("penthouse", "wall_dark", bW*0.16, fH*0.65, bD*0.16,  bX+bW*0.26, pY+parH+roofSlabH+fH*0.33, bZ-bD*0.20);

    // ── 入口柱廊 (重厚なポルティコ) ──────────────────────────────────────
    const entW = bW * 0.46;
    // 重厚な庇/エンタブレチャー
    box("lintel",     "concrete_hvy", entW+2.4, 0.90, 1.2,  bX, foundH+fH*1.12, stepsZ+0.6);
    // 角柱 6本
    for (let c = -2; c <= 2; c++) {
      box(`col_${c+3}`, "concrete_hvy", 0.80, colH, 0.80,
        bX + c * entW * 0.22, foundH + colH*0.5, stepsZ);
    }
    // 入口ドア (重厚な引き戸)
    box("entry_door", "glass_entry", entW*0.36, fH*0.80, 0.22,  bX, foundH+fH*0.43, stepsZ);
    // 庁舎サイン
    box("sign_board", "sign_navy",  entW*0.58, fH*0.17, 0.14,  bX, foundH+fH*1.35, stepsZ+0.02);
    box("sign_text",  "sign_white", entW*0.46, fH*0.09, 0.15,  bX, foundH+fH*1.35, stepsZ+0.03);

    // ── 入口階段 (4段) ────────────────────────────────────────────────────
    for (let s = 0; s < 4; s++) {
      box(`step_${s}`, "step_stone", bW*0.60, foundH*0.23, 1.5,
        bX, foundH*(0.11 + s*0.23), stepsZ + 1.5 + s*1.5);
    }
    box("approach",   "paving_entry", bW*0.62, 0.20, stepsD,  bX, 0.10, stepsZ+stepsD*0.5);

    // ── 国旗ポール (2本) ──────────────────────────────────────────────────
    for (const side of [-1, 1]) {
      shape(`flagpole_${side<0?"L":"R"}`, "cylinder", "flagpole",
        0.15, foundH+bodyH*0.58, 0.15,
        side * bW * 0.32, (foundH+bodyH*0.58)*0.5, stepsZ+stepsD*0.28);
      box(`flag_${side<0?"L":"R"}`, "flag_navy", 1.8, 0.85, 0.08,
        side * bW * 0.32 + 0.9, foundH+bodyH*0.56, stepsZ+stepsD*0.28);
    }

    // ── パトカーガレージ (右翼) ──────────────────────────────────────────
    box("gb_found",   "concrete_hvy", gbW+0.3, foundH, gbD+0.3, gbX, foundH*0.5, gbZ);
    box("gb_body",    "wall_dark",    gbW,      gbH,    gbD,     gbX, foundH+gbH*0.5, gbZ);
    for (let b = -1; b <= 1; b++) {
      box(`bay_${b+2}`, "wall_trim", gbW*0.24, gbH*0.80, 0.22,
        gbX + b*gbW*0.30, foundH+gbH*0.43, gbZ+gbD*0.5);
    }
    box("gb_roof",    "roof_flat",   gbW+0.2, roofSlabH, gbD+0.2, gbX, foundH+gbH+roofSlabH*0.5, gbZ);

    // ── セキュリティフェンス ──────────────────────────────────────────────
    const fSeg = (fenceSpan - gateW) * 0.5;
    const fCx  = (fenceX_left + fenceX_right) * 0.5;
    // 前面 左右セグメント
    box("fence_f_L",   "fence",  fSeg, fenceH, fenceT,  fenceX_left+fSeg*0.5,  fenceH*0.5, fenceZ_front);
    box("fence_f_R",   "fence",  fSeg, fenceH, fenceT,  fenceX_right-fSeg*0.5, fenceH*0.5, fenceZ_front);
    // 後面・左右
    box("fence_b",     "fence",  fenceSpan, fenceH, fenceT,  fCx, fenceH*0.5, fenceZ_back);
    box("fence_side_L","fence",  fenceT, fenceH, fenceZ_front-fenceZ_back, fenceX_left,  fenceH*0.5, (fenceZ_front+fenceZ_back)*0.5);
    box("fence_side_R","fence",  fenceT, fenceH, fenceZ_front-fenceZ_back, fenceX_right, fenceH*0.5, (fenceZ_front+fenceZ_back)*0.5);
    // 天端セキュリティレール
    box("fence_rail_L","fence_top", fSeg, 0.20, fenceT+0.12, fenceX_left+fSeg*0.5,  fenceH+0.10, fenceZ_front);
    box("fence_rail_R","fence_top", fSeg, 0.20, fenceT+0.12, fenceX_right-fSeg*0.5, fenceH+0.10, fenceZ_front);
    // ゲートポスト
    box("gate_post_L", "wall_dark", 0.65, fenceH+0.6, 0.65, -gateW*0.5+0.33, (fenceH+0.6)*0.5, fenceZ_front);
    box("gate_post_R", "wall_dark", 0.65, fenceH+0.6, 0.65,  gateW*0.5-0.33, (fenceH+0.6)*0.5, fenceZ_front);

    // ── 駐車場 (建物左側) ───────────────────────────────────────────────
    const pkW = 14.0, pkD = 16.0;
    const pkX = fenceX_left + pkW*0.5 + 0.5;
    const pkZ = bZ + bD*0.5 - pkD*0.5 - 1.0;
    box("pk_base",    "paving_main", pkW, 0.20, pkD, pkX, 0.10, pkZ);
    for (let i = 1; i < 5; i++) {
      box(`pk_ln_${i}`, "parking_line", 0.10, 0.06, 5.0, pkX-pkW*0.5+i*2.8, 0.22, pkZ);
    }
    box("pk_front_ln","parking_line", pkW, 0.06, 0.10, pkX, 0.22, pkZ+pkD*0.5);

    // ── Surface details ───────────────────────────────────────────────────
    const polRegions = ["facade", "column", "fence", "entrance", "roof"];
    const polTypes   = ["concrete_texture", "panel_seam", "weathering", "trim_line", "window_grid"];
    let sdIdx = 1;
    for (const region of polRegions) {
      for (let i = 0; i < 8; i++) {
        pushSurface(`sd_${sdIdx++}`, region, polTypes[i % polTypes.length],
          0.12 + (i%5)*0.04,
          [Math.sin(i*0.9)*0.012, Math.cos(i*0.7)*0.010, ((i%4)-1.5)*0.008]);
      }
    }

    const totalH = foundH + bodyH + parH + roofSlabH;
    spec.globalScale = { height: rounded(totalH), width: rounded(_siteW), depth: rounded(_siteD) };
    spec.parts = parts;
    spec.surfaceDetails = surfaceDetails;
    return spec;
  }
  // ── END facility_police override ─────────────────────────────────────────────

  // ── 消防署: 車両出入り対応・大型シャッター付き ───────────────────────────────
  if (archetype === "facility_fire") {
    spec.materials = {
      wall_main:    { baseColor: "#D8D0C4", roughness: 0.88, metalness: 0.03 },
      wall_red:     { baseColor: "#B82020", roughness: 0.72, metalness: 0.10 },
      wall_dark:    { baseColor: "#3A3030", roughness: 0.90, metalness: 0.05 },
      concrete:     { baseColor: "#C0BCB4", roughness: 0.92, metalness: 0.02 },
      glass_win:    { baseColor: "#6090B0", roughness: 0.10, metalness: 0.88 },
      glass_entry:  { baseColor: "#80B0C8", roughness: 0.06, metalness: 0.88 },
      shutter:      { baseColor: "#B0B4B8", roughness: 0.60, metalness: 0.50 },
      shutter_red:  { baseColor: "#CC2010", roughness: 0.55, metalness: 0.45 },
      sign_red:     { baseColor: "#CC1010", roughness: 0.38, metalness: 0.12 },
      sign_white:   { baseColor: "#F0F0F0", roughness: 0.55, metalness: 0.05 },
      steel_frame:  { baseColor: "#909898", roughness: 0.55, metalness: 0.62 },
      flagpole:     { baseColor: "#B8BCBC", roughness: 0.40, metalness: 0.82 },
      flag_red:     { baseColor: "#CC1010", roughness: 0.65, metalness: 0.05 },
      paving_main:  { baseColor: "#B0B4AC", roughness: 0.95, metalness: 0.01 },
      paving_apron: { baseColor: "#C8C4BC", roughness: 0.94, metalness: 0.01 },
      apron_line:   { baseColor: "#E8E020", roughness: 0.58, metalness: 0.05 },
      roof_flat:    { baseColor: "#8A8C88", roughness: 0.90, metalness: 0.05 },
      hose_tower:   { baseColor: "#D0281C", roughness: 0.75, metalness: 0.08 },
    };

    // ── 寸法設計 ─────────────────────────────────────────────────────────────
    // 車庫棟: 消防車3台 + 救急車2台 = 5バイ
    // 消防車バイ: 幅4.5m × 奥行12m × 高さ5.5m
    // 救急車バイ: 幅3.2m × 奥行9m  × 高さ4.0m
    const nFire   = 3;    // 消防車バイ数
    const nAmbu   = 2;    // 救急車バイ数
    const fireBW  = 4.5;  // 消防車1バイ幅
    const ambuBW  = 3.2;  // 救急車1バイ幅
    const fireGH  = 5.5;  // 消防車ガレージ高さ (大型対応)
    const ambuGH  = 4.0;  // 救急車ガレージ高さ
    const fireGD  = 12.0; // 消防車ガレージ奥行き
    const ambuGD  = 9.0;  // 救急車ガレージ奥行き
    const foundH  = 0.4;

    // 車庫棟幅 = 消防車ゾーン + 救急車ゾーン
    const fireZoneW = nFire * fireBW;   // 13.5m
    const ambuZoneW = nAmbu * ambuBW;   //  6.4m
    const garageW   = fireZoneW + ambuZoneW + 0.6;  // 20.5m
    const garageX   = 0.0;
    const garageZ   = 0.0;  // 車庫中心
    const garageD   = Math.max(fireGD, ambuGD);  // 12m（奥行き最大値で揃える）

    // 管理棟 (右翼: 事務・宿直・訓練室)
    const adW   = 16.0;
    const adD   = 14.0;
    const adH   = 3.6;   // フロア高
    const adFloors = 3;
    const adBodyH  = adH * adFloors;
    const adX   = garageW * 0.5 + adW * 0.5 + 0.4;
    const adZ   = garageZ + garageD * 0.5 - adD * 0.5;  // 前面揃え

    // ホースタワー (乾燥用) — 管理棟屋上
    const towerH = adBodyH + 8.0;
    const towerX = adX + adW * 0.3;
    const towerZ = adZ;

    // 前面アプローチ (出動路)
    const apronD = 14.0;   // 出動路奥行き (前面余裕)
    const apronZ = garageZ + garageD * 0.5 + apronD * 0.5;

    // 敷地バウンディング (fire_side_L が garage 外に張り出すため厳密に計算)
    const margin   = 4.0;
    const _siteMinX = garageX - ambuZoneW*0.5 - fireZoneW - 1.5 - margin;  // fire_side_L 左端 (fireZoneX-fireZoneW/2-1.2)
    const _siteMaxX = adX + adW * 0.5 + margin;
    const _siteMinZ = garageZ - garageD * 0.5 - margin;
    const _siteMaxZ = apronZ + apronD * 0.5 + margin;
    const _siteCX   = (_siteMinX + _siteMaxX) * 0.5;
    const _siteCZ   = (_siteMinZ + _siteMaxZ) * 0.5;
    const _siteW    = _siteMaxX - _siteMinX;
    const _siteD    = _siteMaxZ - _siteMinZ;

    // ── 敷地 ─────────────────────────────────────────────────────────────────
    box("site_pave",    "paving_main",  _siteW, 0.20, _siteD, _siteCX, 0.10, _siteCZ);

    // ── 出動アプローチ (前面エプロン) ────────────────────────────────────────
    box("apron",        "paving_apron", garageW + adW + 1.0, 0.22, apronD,
      (garageX + adX) * 0.5, 0.11, apronZ);
    // 出動ライン (黄色)
    for (let b = 0; b < nFire + nAmbu; b++) {
      const lx = garageX - garageW*0.5 + (b + 0.5) * garageW / (nFire + nAmbu);
      box(`apron_line_${b}`, "apron_line", 0.12, 0.08, apronD * 0.85,
        lx, 0.25, apronZ);
    }

    // ── 消防車ガレージ棟 ─────────────────────────────────────────────────────
    // 消防車ゾーン (左側: 3バイ)
    const fireZoneX = garageX - ambuZoneW * 0.5 - fireZoneW * 0.5 - 0.3;
    box("fire_found",   "concrete",    fireZoneW + 0.3, foundH, fireGD + 0.3,
      fireZoneX, foundH*0.5, garageZ - (fireGD - garageD)*0.5);
    box("fire_back",    "wall_red",    fireZoneW, fireGH, 2.0,
      fireZoneX, foundH + fireGH*0.5, garageZ - garageD*0.5 + 1.0);
    box("fire_side_L",  "wall_main",   1.2, fireGH, fireGD,
      fireZoneX - fireZoneW*0.5 - 0.6, foundH + fireGH*0.5, garageZ);
    box("fire_roof",    "roof_flat",   fireZoneW + 1.2, 0.25, fireGD + 0.25,
      fireZoneX - 0.3, foundH + fireGH + 0.125, garageZ);
    // 消防車シャッター (3枚・赤)
    for (let b = 0; b < nFire; b++) {
      const bx = fireZoneX - fireZoneW*0.5 + fireBW*(b+0.5);
      box(`shutter_f_${b}`, "shutter_red", fireBW - 0.2, fireGH*0.90, 0.25,
        bx, foundH + fireGH*0.46, garageZ + garageD*0.5);
      // シャッター枠
      box(`frame_f_${b}`,   "wall_dark",   fireBW - 0.1, 0.25, 0.30,
        bx, foundH + fireGH, garageZ + garageD*0.5);
    }

    // 救急車ゾーン (右側: 2バイ)
    const ambuZoneX = garageX + fireZoneW * 0.5 + ambuZoneW * 0.5 + 0.3;
    box("ambu_found",   "concrete",    ambuZoneW + 0.3, foundH, ambuGD + 0.3,
      ambuZoneX, foundH*0.5, garageZ + (garageD - ambuGD)*0.5);
    box("ambu_back",    "wall_main",   ambuZoneW, ambuGH, 2.0,
      ambuZoneX, foundH + ambuGH*0.5, garageZ - garageD*0.5 + (garageD - ambuGD) + 1.0);
    box("ambu_side_R",  "wall_main",   1.0, ambuGH, ambuGD,
      ambuZoneX + ambuZoneW*0.5 + 0.5, foundH + ambuGH*0.5,
      garageZ + (garageD - ambuGD)*0.5);
    box("ambu_roof",    "roof_flat",   ambuZoneW + 1.0, 0.22, ambuGD + 0.22,
      ambuZoneX + 0.25, foundH + ambuGH + 0.11, garageZ + (garageD - ambuGD)*0.5);
    // 救急車シャッター (2枚・グレー)
    for (let b = 0; b < nAmbu; b++) {
      const bx = ambuZoneX - ambuZoneW*0.5 + ambuBW*(b+0.5);
      box(`shutter_a_${b}`, "shutter",   ambuBW - 0.2, ambuGH*0.88, 0.22,
        bx, foundH + ambuGH*0.45, garageZ + garageD*0.5);
      box(`frame_a_${b}`,   "wall_dark", ambuBW - 0.1, 0.22, 0.28,
        bx, foundH + ambuGH, garageZ + garageD*0.5);
    }
    // ガレージ前面 赤ライン帯
    box("red_stripe",   "wall_red",    garageW + 0.6, 0.60, 0.20,
      garageX, foundH + fireGH + 0.35, garageZ + garageD*0.5);

    // ── 管理棟 (右翼) ─────────────────────────────────────────────────────────
    box("ad_found",     "concrete",    adW+0.3, foundH, adD+0.3, adX, foundH*0.5, adZ);
    for (let f = 0; f < adFloors; f++) {
      const fy0 = foundH + f * adH;
      box(`ad_wall_f${f+1}`, "wall_main",  adW, adH-0.14, adD, adX, fy0+(adH-0.14)*0.5, adZ);
      box(`ad_band_f${f+1}`, "wall_red",   adW+0.1, 0.14, adD+0.1, adX, fy0, adZ);
      box(`ad_win_f${f+1}`,  "glass_win",  adW*0.58, adH*0.50, 0.18, adX, fy0+adH*0.55, adZ+adD*0.5);
      box(`ad_win_b${f+1}`,  "glass_win",  adW*0.46, adH*0.44, 0.18, adX, fy0+adH*0.52, adZ-adD*0.5);
    }
    const adPY = foundH + adBodyH;
    box("ad_par_f",     "concrete",    adW+0.3*2, 0.8, 0.28, adX, adPY+0.4, adZ+adD*0.5+0.14);
    box("ad_par_b",     "concrete",    adW+0.3*2, 0.8, 0.28, adX, adPY+0.4, adZ-adD*0.5-0.14);
    box("ad_par_L",     "concrete",    0.28, 0.8, adD, adX-adW*0.5-0.14, adPY+0.4, adZ);
    box("ad_par_R",     "concrete",    0.28, 0.8, adD, adX+adW*0.5+0.14, adPY+0.4, adZ);
    box("ad_roof",      "roof_flat",   adW+0.6, 0.22, adD+0.6, adX, adPY+0.8+0.11, adZ);

    // 管理棟入口
    const adEntZ = adZ + adD * 0.5;
    box("ad_entry_can", "wall_main",   adW*0.45, 0.22, 3.5,  adX, foundH+adH*0.82, adEntZ+1.75);
    box("ad_entry_col_L","steel_frame",0.22, foundH+adH*0.82, 0.22, adX-adW*0.18, (foundH+adH*0.82)*0.5, adEntZ+3.3);
    box("ad_entry_col_R","steel_frame",0.22, foundH+adH*0.82, 0.22, adX+adW*0.18, (foundH+adH*0.82)*0.5, adEntZ+3.3);
    box("ad_door",      "glass_entry", adW*0.28, adH*0.78, 0.20, adX, foundH+adH*0.42, adEntZ);
    // 消防署サイン
    box("sign_h",       "sign_red",    2.8, 0.40, 0.14, adX+adW*0.22, foundH+adBodyH*0.88, adEntZ+0.01);
    box("sign_v",       "sign_red",    0.40, 2.8, 0.14, adX+adW*0.22, foundH+adBodyH*0.72, adEntZ+0.01);

    // ── ホースタワー (乾燥用高塔) ────────────────────────────────────────────
    box("tower_body",   "hose_tower",  2.2, towerH, 2.2, towerX, towerH*0.5, towerZ);
    box("tower_top",    "wall_dark",   2.6, 0.60, 2.6,  towerX, towerH+0.30, towerZ);
    // タワー窓 (細長い)
    for (let f = 1; f <= 5; f++) {
      box(`tower_win_${f}`, "glass_win", 0.50, 1.20, 0.18,
        towerX, towerH * (f / 6.5), towerZ + 1.1);
    }

    // ── 国旗ポール ────────────────────────────────────────────────────────────
    shape("flagpole", "cylinder", "flagpole", 0.14, adBodyH*0.55, 0.14,
      adX - adW*0.30, adBodyH*0.275, adEntZ + 3.0);
    box("flag",       "flag_red", 1.6, 0.80, 0.08,
      adX - adW*0.30 + 0.8, adBodyH*0.52, adEntZ + 3.0);

    // ── Surface details ───────────────────────────────────────────────────────
    const fireRegions = ["facade", "garage", "tower", "entrance", "roof"];
    const fireTypes   = ["panel_seam", "concrete_texture", "weathering", "trim_line", "window_grid"];
    let sdIdx = 1;
    for (const region of fireRegions) {
      for (let i = 0; i < 8; i++) {
        pushSurface(`sd_${sdIdx++}`, region, fireTypes[i % fireTypes.length],
          0.10 + (i%5)*0.04,
          [Math.sin(i*0.9)*0.013, Math.cos(i*0.7)*0.011, ((i%4)-1.5)*0.009]);
      }
    }

    const totalH = towerH + 0.6;  // ホースタワーが最高点
    spec.globalScale = { height: rounded(totalH), width: rounded(_siteW), depth: rounded(_siteD) };
    spec.parts = parts;
    spec.surfaceDetails = surfaceDetails;
    return spec;
  }
  // ── END facility_fire override ────────────────────────────────────────────────

  // ── 老人ホーム・介護施設: 100名規模・3階・デイサービス入口・駐車場 ─────────────
  if (archetype === "facility_nursing") {
    spec.materials = {
      wall_main:    { baseColor: "#EEE8DC", roughness: 0.88, metalness: 0.02 },
      wall_warm:    { baseColor: "#DDD0B8", roughness: 0.90, metalness: 0.02 },
      wall_accent:  { baseColor: "#A8C88C", roughness: 0.82, metalness: 0.04 },  // やわらかい緑
      wall_day:     { baseColor: "#C8E0D0", roughness: 0.84, metalness: 0.03 },  // デイサービス棟
      concrete:     { baseColor: "#C8C4BC", roughness: 0.92, metalness: 0.02 },
      glass_win:    { baseColor: "#90C8B0", roughness: 0.10, metalness: 0.86 },
      glass_entry:  { baseColor: "#B0D8C8", roughness: 0.06, metalness: 0.86 },
      canopy:       { baseColor: "#D8E4DC", roughness: 0.84, metalness: 0.08 },
      handrail:     { baseColor: "#A0A8A0", roughness: 0.50, metalness: 0.55 },
      steel_frame:  { baseColor: "#9AA09A", roughness: 0.52, metalness: 0.60 },
      sign_green:   { baseColor: "#309050", roughness: 0.40, metalness: 0.08 },
      sign_white:   { baseColor: "#F0F4F0", roughness: 0.55, metalness: 0.04 },
      paving_main:  { baseColor: "#C0BEB8", roughness: 0.95, metalness: 0.01 },
      paving_walk:  { baseColor: "#D0CEC8", roughness: 0.94, metalness: 0.01 },
      parking_line: { baseColor: "#E0E0D8", roughness: 0.60, metalness: 0.04 },
      garden:       { baseColor: "#6A9A58", roughness: 0.96, metalness: 0.00 },
      roof_flat:    { baseColor: "#B0B8B0", roughness: 0.90, metalness: 0.04 },
      ramp:         { baseColor: "#C8C4BC", roughness: 0.94, metalness: 0.01 },
    };

    // ── 寸法設計 ─────────────────────────────────────────────────────────────
    // 100名規模 3階建て: 各フロア約34名 × 3F
    // 居室ゾーン (東西2翼) + 共用棟 (中央) + デイサービス棟 (独立翼)
    const fH      = 3.4;    // フロア高 (福祉施設: やや低め)
    const floors  = 3;
    const foundH  = 0.5;
    const parH    = 0.8;
    const parT    = 0.28;
    const roofSlabH = 0.20;
    const bodyH   = fH * floors;   // 10.2m

    // ── 共用棟 (中央: エントランス・食堂・スタッフ) ──────────────────────────
    const cW = 22.0;   // 共用棟 幅
    const cD = 14.0;   // 共用棟 奥行き
    const cX = 0.0;
    const cZ = 0.0;

    // ── 居室A棟 (東翼) ────────────────────────────────────────────────────────
    const wW = 14.0;   // 翼棟 幅
    const wD = 32.0;   // 翼棟 奥行き (各フロア16〜17室想定)
    const wAX =  cW * 0.5 + wW * 0.5;
    const wBX = -cW * 0.5 - wW * 0.5;
    const wZ  = cZ - cD * 0.5 - wD * 0.5 + 2.0;  // 共用棟後方に接続

    // ── 渡り廊下 ──────────────────────────────────────────────────────────────
    const lkW = cW - 2.0;
    const lkD = 4.5;
    const lkZ = wZ + wD * 0.5 - lkD * 0.5 - wD * 0.38;

    // ── デイサービス棟 (前面左翼: 1〜2階) ────────────────────────────────────
    const dsW = 18.0;
    const dsD = 12.0;
    const dsH = fH * 2;   // 2階分
    const dsX = -(cW * 0.5 + dsW * 0.5 + 0.4);
    const dsZ =  cZ + cD * 0.5 - dsD * 0.5;   // 共用棟前面に揃える

    // ── 駐車場 (前面右側) ────────────────────────────────────────────────────
    const pkW     = 22.0;
    const spaceW  = 2.5;
    const spaceD  = 5.0;
    const aisleD  = 6.0;
    const pkD     = spaceD + aisleD;   // 11m
    const pkNSpaces = 8;
    const pkX     = cW * 0.5 + wW + pkW * 0.5 - wW * 0.5 + 0.5;
    const pkZ     = cZ + cD * 0.5 - pkD * 0.5;

    // ── 敷地バウンディング ────────────────────────────────────────────────────
    const margin   = 4.0;
    const _siteMinX = Math.min(dsX - dsW*0.5, wBX - wW*0.5) - margin;
    const _siteMaxX = Math.max(pkX + pkW*0.5, wAX + wW*0.5) + margin;
    const _siteMinZ = Math.min(wZ - wD*0.5 - 8.5, cZ - cD*0.5) - margin;  // 庭（wZ-wD/2-4.5 中心、深さ8m）まで含む
    const _siteMaxZ = cZ + cD*0.5 + 8.0 + margin;  // 正面アプローチ
    const _siteCX   = (_siteMinX + _siteMaxX) * 0.5;
    const _siteCZ   = (_siteMinZ + _siteMaxZ) * 0.5;
    const _siteW    = _siteMaxX - _siteMinX;
    const _siteD    = _siteMaxZ - _siteMinZ;

    // ── 敷地・アプローチ ─────────────────────────────────────────────────────
    box("site_pave",   "paving_main",  _siteW, 0.20, _siteD, _siteCX, 0.10, _siteCZ);
    // 歩道 (メインアプローチ)
    box("walkway",     "paving_walk",  cW*0.55, 0.22, 7.5,   cX, 0.11, cZ+cD*0.5+3.75);
    // 庭・緑地 (建物後方)
    box("garden",      "garden",       wW*1.2, 0.20, 8.0,    cX, 0.10, wZ-wD*0.5-4.5);

    // ── 共用棟 ───────────────────────────────────────────────────────────────
    box("c_found",     "concrete",     cW+0.3, foundH, cD+0.3,  cX, foundH*0.5, cZ);
    for (let f = 0; f < floors; f++) {
      const fy0 = foundH + f * fH;
      box(`c_wall_f${f+1}`, "wall_main",  cW, fH-0.13, cD,  cX, fy0+(fH-0.13)*0.5, cZ);
      box(`c_band_f${f+1}`, "wall_accent",cW+0.1, 0.13, cD+0.1, cX, fy0, cZ);
      // 前面 大窓 (食堂・交流スペース)
      box(`c_winF_f${f+1}`, "glass_win", cW*0.70, fH*0.56, 0.18, cX, fy0+fH*0.57, cZ+cD*0.5);
      // 後面窓
      box(`c_winB_f${f+1}`, "glass_win", cW*0.55, fH*0.48, 0.18, cX, fy0+fH*0.54, cZ-cD*0.5);
    }
    const cPY = foundH + bodyH;
    box("c_par_f",  "concrete", cW+parT*2, parH, parT, cX, cPY+parH*0.5, cZ+cD*0.5+parT*0.5);
    box("c_par_b",  "concrete", cW+parT*2, parH, parT, cX, cPY+parH*0.5, cZ-cD*0.5-parT*0.5);
    box("c_par_L",  "concrete", parT, parH, cD,        cX-cW*0.5-parT*0.5, cPY+parH*0.5, cZ);
    box("c_par_R",  "concrete", parT, parH, cD,        cX+cW*0.5+parT*0.5, cPY+parH*0.5, cZ);
    box("c_roof",   "roof_flat",cW+parT*2, roofSlabH, cD+parT*2, cX, cPY+parH+roofSlabH*0.5, cZ);

    // メイン入口 (バリアフリー: 広いアプローチ + スロープ + キャノピー)
    const entW = cW * 0.50;
    const entZ = cZ + cD * 0.5;
    box("entry_can",   "canopy",     entW+1.0, 0.24, 5.0,   cX, foundH+fH*0.82, entZ+2.5);
    box("entry_col_L", "steel_frame",0.20, foundH+fH*0.82, 0.20, cX-entW*0.42, (foundH+fH*0.82)*0.5, entZ+4.8);
    box("entry_col_R", "steel_frame",0.20, foundH+fH*0.82, 0.20, cX+entW*0.42, (foundH+fH*0.82)*0.5, entZ+4.8);
    box("entry_door",  "glass_entry",entW*0.60, fH*0.84, 0.20,   cX, foundH+fH*0.44, entZ);
    // スロープ (バリアフリー: 緩やかな傾斜)
    box("ramp_main",   "ramp",       entW*0.55, foundH, 4.5,  cX+entW*0.22, foundH*0.5, entZ+2.25);
    // 手すり
    box("handrail_L",  "handrail",   0.08, 0.90, 4.5,  cX-entW*0.16, foundH+0.45, entZ+2.25);
    box("handrail_R",  "handrail",   0.08, 0.90, 4.5,  cX+entW*0.48, foundH+0.45, entZ+2.25);
    // 施設サイン
    box("sign_board",  "wall_accent",entW*0.70, fH*0.20, 0.14, cX, foundH+bodyH*0.88, entZ+0.01);
    box("sign_text",   "sign_white", entW*0.55, fH*0.12, 0.15, cX, foundH+bodyH*0.88, entZ+0.02);

    // ── 居室A棟 (東翼) ────────────────────────────────────────────────────────
    box("wA_found",    "concrete",   wW+0.3, foundH, wD+0.3,  wAX, foundH*0.5, wZ);
    for (let f = 0; f < floors; f++) {
      const fy0 = foundH + f * fH;
      box(`wA_wall_f${f+1}`, "wall_warm", wW, fH-0.13, wD,  wAX, fy0+(fH-0.13)*0.5, wZ);
      box(`wA_band_f${f+1}`, "wall_accent",wW+0.1, 0.13, wD+0.1, wAX, fy0, wZ);
      // 東面 各居室窓 (居室: 1室約5m間隔)
      for (let r = -2; r <= 2; r++) {
        box(`wA_winE_f${f+1}_r${r+3}`, "glass_win", 1.6, fH*0.52, 0.18,
          wAX + wW*0.5, fy0+fH*0.57, wZ + r * wD*0.18);
      }
      // 廊下側窓 (西面: 小窓)
      box(`wA_winW_f${f+1}`, "glass_win", 0.18, fH*0.44, wD*0.68, wAX-wW*0.5, fy0+fH*0.54, wZ);
    }
    const wAPY = foundH + bodyH;
    box("wA_par_f",  "concrete", wW+parT*2, parH, parT,  wAX, wAPY+parH*0.5, wZ+wD*0.5+parT*0.5);
    box("wA_par_b",  "concrete", wW+parT*2, parH, parT,  wAX, wAPY+parH*0.5, wZ-wD*0.5-parT*0.5);
    box("wA_par_E",  "concrete", parT, parH, wD,          wAX+wW*0.5+parT*0.5, wAPY+parH*0.5, wZ);
    box("wA_par_W",  "concrete", parT, parH, wD,          wAX-wW*0.5-parT*0.5, wAPY+parH*0.5, wZ);
    box("wA_roof",   "roof_flat",wW+parT*2, roofSlabH, wD+parT*2, wAX, wAPY+parH+roofSlabH*0.5, wZ);

    // ── 居室B棟 (西翼) ────────────────────────────────────────────────────────
    box("wB_found",    "concrete",   wW+0.3, foundH, wD+0.3,  wBX, foundH*0.5, wZ);
    for (let f = 0; f < floors; f++) {
      const fy0 = foundH + f * fH;
      box(`wB_wall_f${f+1}`, "wall_warm", wW, fH-0.13, wD,  wBX, fy0+(fH-0.13)*0.5, wZ);
      box(`wB_band_f${f+1}`, "wall_accent",wW+0.1, 0.13, wD+0.1, wBX, fy0, wZ);
      for (let r = -2; r <= 2; r++) {
        box(`wB_winW_f${f+1}_r${r+3}`, "glass_win", 1.6, fH*0.52, 0.18,
          wBX - wW*0.5, fy0+fH*0.57, wZ + r * wD*0.18);
      }
      box(`wB_winE_f${f+1}`, "glass_win", 0.18, fH*0.44, wD*0.68, wBX+wW*0.5, fy0+fH*0.54, wZ);
    }
    const wBPY = foundH + bodyH;
    box("wB_par_f",  "concrete", wW+parT*2, parH, parT,  wBX, wBPY+parH*0.5, wZ+wD*0.5+parT*0.5);
    box("wB_par_b",  "concrete", wW+parT*2, parH, parT,  wBX, wBPY+parH*0.5, wZ-wD*0.5-parT*0.5);
    box("wB_par_E",  "concrete", parT, parH, wD,          wBX+wW*0.5+parT*0.5, wBPY+parH*0.5, wZ);
    box("wB_par_W",  "concrete", parT, parH, wD,          wBX-wW*0.5-parT*0.5, wBPY+parH*0.5, wZ);
    box("wB_roof",   "roof_flat",wW+parT*2, roofSlabH, wD+parT*2, wBX, wBPY+parH+roofSlabH*0.5, wZ);

    // ── 渡り廊下 ─────────────────────────────────────────────────────────────
    box("link_wall",   "wall_main",  lkW, fH*1.1, lkD,   cX, foundH+fH*0.55, lkZ);
    box("link_winF",   "glass_win",  lkW*0.78, fH*0.52, 0.16, cX, foundH+fH*0.58, lkZ+lkD*0.5);
    box("link_winB",   "glass_win",  lkW*0.78, fH*0.52, 0.16, cX, foundH+fH*0.58, lkZ-lkD*0.5);

    // ── デイサービス棟 ────────────────────────────────────────────────────────
    box("ds_found",    "concrete",   dsW+0.3, foundH, dsD+0.3,  dsX, foundH*0.5, dsZ);
    for (let f = 0; f < 2; f++) {
      const fy0 = foundH + f * fH;
      box(`ds_wall_f${f+1}`, "wall_day",  dsW, fH-0.13, dsD,  dsX, fy0+(fH-0.13)*0.5, dsZ);
      box(`ds_band_f${f+1}`, "wall_accent",dsW+0.1, 0.13, dsD+0.1, dsX, fy0, dsZ);
      box(`ds_winF_f${f+1}`, "glass_win", dsW*0.65, fH*0.54, 0.18,  dsX, fy0+fH*0.57, dsZ+dsD*0.5);
      box(`ds_winB_f${f+1}`, "glass_win", dsW*0.50, fH*0.46, 0.18,  dsX, fy0+fH*0.53, dsZ-dsD*0.5);
    }
    const dsPY = foundH + dsH;
    box("ds_par_f",  "concrete", dsW+parT*2, parH, parT, dsX, dsPY+parH*0.5, dsZ+dsD*0.5+parT*0.5);
    box("ds_par_b",  "concrete", dsW+parT*2, parH, parT, dsX, dsPY+parH*0.5, dsZ-dsD*0.5-parT*0.5);
    box("ds_par_L",  "concrete", parT, parH, dsD,         dsX-dsW*0.5-parT*0.5, dsPY+parH*0.5, dsZ);
    box("ds_par_R",  "concrete", parT, parH, dsD,         dsX+dsW*0.5+parT*0.5, dsPY+parH*0.5, dsZ);
    box("ds_roof",   "roof_flat",dsW+parT*2, roofSlabH, dsD+parT*2, dsX, dsPY+parH+roofSlabH*0.5, dsZ);

    // デイサービス専用入口 (前面・バス横付け対応)
    const dsEntZ = dsZ + dsD * 0.5;
    box("ds_can",      "canopy",     dsW*0.62, 0.22, 5.5,   dsX, foundH+fH*0.80, dsEntZ+2.75);
    box("ds_col_L",    "steel_frame",0.20, foundH+fH*0.80, 0.20, dsX-dsW*0.25, (foundH+fH*0.80)*0.5, dsEntZ+5.3);
    box("ds_col_R",    "steel_frame",0.20, foundH+fH*0.80, 0.20, dsX+dsW*0.25, (foundH+fH*0.80)*0.5, dsEntZ+5.3);
    box("ds_door",     "glass_entry",dsW*0.48, fH*0.82, 0.20,   dsX, foundH+fH*0.43, dsEntZ);
    // デイサービス スロープ
    box("ds_ramp",     "ramp",       dsW*0.40, foundH, 4.0,  dsX, foundH*0.5, dsEntZ+2.0);
    box("ds_rail_L",   "handrail",   0.08, 0.88, 4.0, dsX-dsW*0.18, foundH+0.44, dsEntZ+2.0);
    box("ds_rail_R",   "handrail",   0.08, 0.88, 4.0, dsX+dsW*0.18, foundH+0.44, dsEntZ+2.0);
    // デイサービスサイン
    box("ds_sign",     "wall_day",   dsW*0.55, fH*0.19, 0.14, dsX, dsPY*0.88, dsEntZ+0.01);
    box("ds_sign_txt", "sign_white", dsW*0.44, fH*0.10, 0.15, dsX, dsPY*0.88, dsEntZ+0.02);
    // バス乗降スペース表示
    box("ds_bus_zone", "paving_walk",dsW*0.80, 0.22, 6.0,   dsX, 0.11, dsEntZ+3.0);

    // ── 駐車場 (前面右側) ────────────────────────────────────────────────────
    box("pk_base",     "paving_main",pkW, 0.20, pkD,  pkX, 0.10, pkZ);
    for (let i = 0; i <= pkNSpaces; i++) {
      box(`pk_ln_${i}`, "parking_line", 0.10, 0.06, spaceD,
        pkX - pkW*0.5 + i*spaceW + (pkW - pkNSpaces*spaceW)*0.5, 0.22, pkZ - aisleD*0.5 + spaceD*0.5);
    }
    box("pk_aisle_ln", "parking_line", pkW, 0.06, 0.10, pkX, 0.22, pkZ-aisleD*0.5);
    // 車止め
    for (let i = 0; i < pkNSpaces; i++) {
      const sx = pkX - pkW*0.5 + (i+0.5)*spaceW + (pkW - pkNSpaces*spaceW)*0.5;
      box(`pk_stop_${i}`, "concrete", spaceW*0.58, 0.14, 0.20, sx, 0.27, pkZ-pkD*0.5+0.5);
    }
    // 福祉車両スペースサイン (ICFマーク的)
    box("pk_welfare_sign","wall_accent", 2.5, 0.22, 0.10,
      pkX - pkW*0.5 + spaceW*0.5 + (pkW - pkNSpaces*spaceW)*0.5, 0.33, pkZ - pkD*0.5);

    // ── Surface details ───────────────────────────────────────────────────────
    const nsRegions = ["facade", "window", "garden", "entrance", "dayservice"];
    const nsTypes   = ["panel_seam", "window_grid", "weathering", "trim_line", "concrete_texture"];
    let sdIdx = 1;
    for (const region of nsRegions) {
      for (let i = 0; i < 8; i++) {
        pushSurface(`sd_${sdIdx++}`, region, nsTypes[i % nsTypes.length],
          0.10 + (i%5)*0.04,
          [Math.sin(i*0.9)*0.013, Math.cos(i*0.7)*0.011, ((i%4)-1.5)*0.009]);
      }
    }

    const totalH = foundH + bodyH + parH + roofSlabH;
    spec.globalScale = { height: rounded(totalH), width: rounded(_siteW), depth: rounded(_siteD) };
    spec.parts = parts;
    spec.surfaceDetails = surfaceDetails;
    return spec;
  }
  // ── END facility_nursing override ─────────────────────────────────────────────

  // ── 学校: 校舎・体育館・校庭・正門 ──────────────────────────────────────────
  if (archetype === "facility_school") {
    spec.materials = {
      wall_main:    { baseColor: "#E8E0CC", roughness: 0.88, metalness: 0.02 },
      wall_accent:  { baseColor: "#4878B8", roughness: 0.70, metalness: 0.12 },  // 青帯
      wall_gym:     { baseColor: "#D8D0BC", roughness: 0.88, metalness: 0.02 },
      concrete:     { baseColor: "#C4C0B8", roughness: 0.92, metalness: 0.02 },
      glass_win:    { baseColor: "#7AB0D0", roughness: 0.10, metalness: 0.86 },
      glass_entry:  { baseColor: "#9AC8E0", roughness: 0.06, metalness: 0.86 },
      glass_gym:    { baseColor: "#88A8C0", roughness: 0.12, metalness: 0.84 },
      canopy:       { baseColor: "#D0D8E0", roughness: 0.84, metalness: 0.08 },
      steel_frame:  { baseColor: "#909898", roughness: 0.52, metalness: 0.62 },
      roof_flat:    { baseColor: "#9A9C98", roughness: 0.90, metalness: 0.04 },
      roof_gym:     { baseColor: "#6A7C8A", roughness: 0.85, metalness: 0.08 },
      paving_main:  { baseColor: "#B8B4AC", roughness: 0.95, metalness: 0.01 },
      paving_walk:  { baseColor: "#C8C4BC", roughness: 0.94, metalness: 0.01 },
      schoolyard:   { baseColor: "#C8A878", roughness: 0.98, metalness: 0.00 },  // 砂校庭
      yard_line:    { baseColor: "#E8E4D8", roughness: 0.70, metalness: 0.02 },
      gate_pillar:  { baseColor: "#484440", roughness: 0.88, metalness: 0.08 },
      gate_fence:   { baseColor: "#3A3830", roughness: 0.85, metalness: 0.20 },
      sign_navy:    { baseColor: "#1A2A60", roughness: 0.40, metalness: 0.10 },
      sign_white:   { baseColor: "#F0F0EC", roughness: 0.55, metalness: 0.04 },
      flagpole:     { baseColor: "#C0C4C0", roughness: 0.42, metalness: 0.78 },
      pool_water:   { baseColor: "#3898C0", roughness: 0.08, metalness: 0.80 },
      pool_wall:    { baseColor: "#C8E0EC", roughness: 0.82, metalness: 0.05 },
    };

    // ── 寸法設計 ─────────────────────────────────────────────────────────────
    // 校舎: 4階建て・L字またはコの字型 = 主棟 + 東翼
    // 体育館: 独立棟（大型・高い）
    // 校庭: 100m × 70m
    const fH      = 3.6;    // フロア高
    const floors  = 4;      // 4階建て
    const foundH  = 0.5;
    const parH    = 0.8;
    const parT    = 0.28;
    const roofSlabH = 0.20;
    const bodyH   = fH * floors;   // 14.4m

    // ── 主棟 (メイン校舎: 横長) ──────────────────────────────────────────────
    const mW = 60.0;   // 主棟 幅
    const mD = 12.0;   // 主棟 奥行き (片廊下型)
    const mX = 0.0;
    const mZ = 0.0;
    const mFront = mZ + mD * 0.5;  // 主棟前面 Z

    // ── 東翼棟 (クラス棟: 縦長) ──────────────────────────────────────────────
    const eW = 12.0;
    const eD = 36.0;
    const eX = mW * 0.5 - eW * 0.5;
    const eZ = mZ - mD * 0.5 - eD * 0.5;  // 主棟後方に接続

    // ── 西翼棟 ────────────────────────────────────────────────────────────────
    const wWg = 12.0;
    const wDg = 28.0;
    const wX = -mW * 0.5 + wWg * 0.5;
    const wZg = mZ - mD * 0.5 - wDg * 0.5;

    // ── 体育館 ────────────────────────────────────────────────────────────────
    const gymW = 26.0;
    const gymD = 42.0;
    const gymH = 9.5;   // 高い天井
    const gymX = -(mW * 0.5 + gymW * 0.5 + 3.0);
    const gymZ = mZ - mD * 0.5 - gymD * 0.5 + mD;

    // ── 校庭 ─────────────────────────────────────────────────────────────────
    const yardW = 100.0;
    const yardD = 72.0;
    const yardX = gymX * 0.5;   // 体育館と校舎の間でやや右寄り
    const yardZ = mFront + 8.0 + yardD * 0.5;

    // ── プール ────────────────────────────────────────────────────────────────
    const poolW = 25.0;
    const poolD = 13.0;
    const poolX = gymX - gymW * 0.5 - poolW * 0.5 - 2.0;
    const poolZ = gymZ - gymD * 0.5 - poolD * 0.5 - 2.0;

    // ── 正門・アプローチ ──────────────────────────────────────────────────────
    const gateZ   = yardZ + yardD * 0.5 + 5.0;
    const gateW_  = 8.0;
    const gateH_  = 3.2;
    const fenceZ  = gateZ;
    const fenceSpan = mW + 6.0;

    // 敷地バウンディング
    const margin  = 5.0;
    const _siteMinX = Math.min(poolX - poolW*0.5, gymX - gymW*0.5) - margin;
    const _siteMaxX = Math.max(eX + eW*0.5, mX + mW*0.5) + margin;
    const _siteMinZ = Math.min(eZ - eD*0.5, gymZ - gymD*0.5, poolZ - poolD*0.5) - margin;
    const _siteMaxZ = gateZ + 3.0 + margin;
    const _siteCX   = (_siteMinX + _siteMaxX) * 0.5;
    const _siteCZ   = (_siteMinZ + _siteMaxZ) * 0.5;
    const _siteW    = _siteMaxX - _siteMinX;
    const _siteD    = _siteMaxZ - _siteMinZ;

    // ── 敷地 ─────────────────────────────────────────────────────────────────
    box("site_pave",   "paving_main",  _siteW, 0.20, _siteD, _siteCX, 0.10, _siteCZ);

    // ── 校庭 ─────────────────────────────────────────────────────────────────
    box("schoolyard",  "schoolyard",   yardW, 0.22, yardD,   yardX, 0.11, yardZ);
    // 校庭ライン (トラック外周・外側)
    box("yard_ln_f",   "yard_line",    yardW*0.88, 0.08, 0.18,  yardX, 0.26, yardZ+yardD*0.44);
    box("yard_ln_b",   "yard_line",    yardW*0.88, 0.08, 0.18,  yardX, 0.26, yardZ-yardD*0.44);
    box("yard_ln_L",   "yard_line",    0.18, 0.08, yardD*0.82,  yardX-yardW*0.42, 0.26, yardZ);
    box("yard_ln_R",   "yard_line",    0.18, 0.08, yardD*0.82,  yardX+yardW*0.42, 0.26, yardZ);
    // バスケットゴール柱
    for (const side of [-1, 1]) {
      shape(`basket_pole_${side<0?"L":"R"}`, "cylinder", "steel_frame",
        0.18, 3.2, 0.18, yardX + side*yardW*0.22, 1.6, yardZ + side*yardD*0.36);
      box(`basket_board_${side<0?"L":"R"}`, "concrete", 1.8, 1.2, 0.12,
        yardX + side*yardW*0.22, 3.6, yardZ + side*yardD*0.36);
    }
    // 国旗掲揚ポール
    shape("flag_pole", "cylinder", "flagpole",  0.14, 8.0, 0.14,
      yardX - yardW*0.38, 4.0, yardZ + yardD*0.44);
    box("flag",        "wall_accent",  1.8, 0.90, 0.08,
      yardX - yardW*0.38 + 0.9, 7.6, yardZ + yardD*0.44);

    // ── 主棟 校舎 ────────────────────────────────────────────────────────────
    box("m_found",     "concrete",    mW+0.4, foundH, mD+0.4,  mX, foundH*0.5, mZ);
    for (let f = 0; f < floors; f++) {
      const fy0 = foundH + f * fH;
      box(`m_wall_f${f+1}`,  "wall_main",  mW, fH-0.14, mD,   mX, fy0+(fH-0.14)*0.5, mZ);
      box(`m_band_f${f+1}`,  "wall_accent",mW+0.1, 0.14, mD+0.1, mX, fy0, mZ);
      // 前面: 教室窓 (8スパン)
      for (let w = -3; w <= 3; w++) {
        box(`m_winF_f${f+1}_${w+4}`, "glass_win", mW*0.095, fH*0.60, 0.18,
          mX + w * mW*0.136, fy0+fH*0.60, mFront);
      }
      // 後面: 廊下窓
      box(`m_winB_f${f+1}`, "glass_win", mW*0.78, fH*0.38, 0.16, mX, fy0+fH*0.56, mZ-mD*0.5);
    }
    const mPY = foundH + bodyH;
    box("m_par_f",  "concrete", mW+parT*2, parH, parT,  mX, mPY+parH*0.5, mFront+parT*0.5);
    box("m_par_b",  "concrete", mW+parT*2, parH, parT,  mX, mPY+parH*0.5, mZ-mD*0.5-parT*0.5);
    box("m_par_L",  "concrete", parT, parH, mD,          mX-mW*0.5-parT*0.5, mPY+parH*0.5, mZ);
    box("m_par_R",  "concrete", parT, parH, mD,          mX+mW*0.5+parT*0.5, mPY+parH*0.5, mZ);
    box("m_roof",   "roof_flat",mW+parT*2, roofSlabH, mD+parT*2, mX, mPY+parH+roofSlabH*0.5, mZ);

    // ── 玄関ホール (主棟中央前面) ────────────────────────────────────────────
    const entW = mW * 0.28;
    const entD = 4.5;
    const entZ = mFront;
    box("ent_can",   "canopy",    entW+1.0, 0.24, entD+0.5,  mX, foundH+fH*0.84, entZ+entD*0.5+0.25);
    box("ent_col_L", "steel_frame",0.22, foundH+fH*0.84, 0.22, mX-entW*0.42, (foundH+fH*0.84)*0.5, entZ+entD);
    box("ent_col_R", "steel_frame",0.22, foundH+fH*0.84, 0.22, mX+entW*0.42, (foundH+fH*0.84)*0.5, entZ+entD);
    box("ent_door",  "glass_entry",entW*0.62, fH*0.82, 0.22,   mX, foundH+fH*0.44, entZ);
    // 学校名看板
    box("ent_sign",  "sign_navy",  entW*0.80, fH*0.22, 0.14,  mX, mPY*0.88, entZ+0.01);
    box("ent_sign_t","sign_white", entW*0.66, fH*0.12, 0.15,  mX, mPY*0.88, entZ+0.02);
    // 校門へのアプローチ舗装
    box("approach",  "paving_walk",entW+4.0, 0.22, yardD*0.5+8.0, mX, 0.11, (entZ + gateZ)*0.5);

    // ── 東翼棟 ────────────────────────────────────────────────────────────────
    box("e_found",   "concrete",   eW+0.3, foundH, eD+0.3,  eX, foundH*0.5, eZ);
    for (let f = 0; f < floors; f++) {
      const fy0 = foundH + f * fH;
      box(`e_wall_f${f+1}`,  "wall_main",  eW, fH-0.14, eD,   eX, fy0+(fH-0.14)*0.5, eZ);
      box(`e_band_f${f+1}`,  "wall_accent",eW+0.1, 0.14, eD+0.1, eX, fy0, eZ);
      // 東面: 教室窓 (5スパン)
      for (let w = -2; w <= 2; w++) {
        box(`e_winE_f${f+1}_${w+3}`, "glass_win", 0.18, fH*0.60, eD*0.14,
          eX+eW*0.5, fy0+fH*0.60, eZ + w*eD*0.18);
      }
      box(`e_winW_f${f+1}`, "glass_win", 0.16, fH*0.38, eD*0.78, eX-eW*0.5, fy0+fH*0.55, eZ);
    }
    const ePY = foundH + bodyH;
    box("e_par_f",  "concrete", eW+parT*2, parH, parT,   eX, ePY+parH*0.5, eZ+eD*0.5+parT*0.5);
    box("e_par_b",  "concrete", eW+parT*2, parH, parT,   eX, ePY+parH*0.5, eZ-eD*0.5-parT*0.5);
    box("e_par_E",  "concrete", parT, parH, eD,           eX+eW*0.5+parT*0.5, ePY+parH*0.5, eZ);
    box("e_par_W",  "concrete", parT, parH, eD,           eX-eW*0.5-parT*0.5, ePY+parH*0.5, eZ);
    box("e_roof",   "roof_flat",eW+parT*2, roofSlabH, eD+parT*2, eX, ePY+parH+roofSlabH*0.5, eZ);

    // ── 西翼棟 ────────────────────────────────────────────────────────────────
    box("w_found",   "concrete",   wWg+0.3, foundH, wDg+0.3,  wX, foundH*0.5, wZg);
    for (let f = 0; f < floors; f++) {
      const fy0 = foundH + f * fH;
      box(`w_wall_f${f+1}`,  "wall_main",  wWg, fH-0.14, wDg,  wX, fy0+(fH-0.14)*0.5, wZg);
      box(`w_band_f${f+1}`,  "wall_accent",wWg+0.1, 0.14, wDg+0.1, wX, fy0, wZg);
      for (let w = -1; w <= 1; w++) {
        box(`w_winW_f${f+1}_${w+2}`, "glass_win", 0.18, fH*0.60, wDg*0.18,
          wX-wWg*0.5, fy0+fH*0.60, wZg + w*wDg*0.28);
      }
      box(`w_winE_f${f+1}`, "glass_win", 0.16, fH*0.38, wDg*0.78, wX+wWg*0.5, fy0+fH*0.55, wZg);
    }
    const wPY = foundH + bodyH;
    box("w_par_f",  "concrete", wWg+parT*2, parH, parT,  wX, wPY+parH*0.5, wZg+wDg*0.5+parT*0.5);
    box("w_par_b",  "concrete", wWg+parT*2, parH, parT,  wX, wPY+parH*0.5, wZg-wDg*0.5-parT*0.5);
    box("w_par_E",  "concrete", parT, parH, wDg,          wX+wWg*0.5+parT*0.5, wPY+parH*0.5, wZg);
    box("w_par_W",  "concrete", parT, parH, wDg,          wX-wWg*0.5-parT*0.5, wPY+parH*0.5, wZg);
    box("w_roof",   "roof_flat",wWg+parT*2, roofSlabH, wDg+parT*2, wX, wPY+parH+roofSlabH*0.5, wZg);

    // ── 体育館 ────────────────────────────────────────────────────────────────
    box("gym_found",  "concrete",  gymW+0.4, foundH, gymD+0.4,  gymX, foundH*0.5, gymZ);
    box("gym_wall",   "wall_gym",  gymW, gymH, gymD,             gymX, foundH+gymH*0.5, gymZ);
    box("gym_band_b", "wall_accent",gymW+0.1, 0.50, gymD+0.1,   gymX, foundH+1.0, gymZ);
    // 側面 高窓 (ハイサイドライト)
    for (let w = -2; w <= 2; w++) {
      box(`gym_winS_${w+3}`, "glass_gym", gymW*0.10, gymH*0.28, 0.18,
        gymX + w * gymW*0.18, foundH+gymH*0.76, gymZ+gymD*0.5);
      box(`gym_winN_${w+3}`, "glass_gym", gymW*0.10, gymH*0.28, 0.18,
        gymX + w * gymW*0.18, foundH+gymH*0.76, gymZ-gymD*0.5);
    }
    // 体育館 大屋根 (わずかに弧状に見せるため中央高め)
    box("gym_roof_main","roof_gym",  gymW+0.4, 0.60, gymD+0.4,  gymX, foundH+gymH+0.30, gymZ);
    box("gym_roof_ridge","roof_gym", gymW*0.40, 0.50, gymD*0.96, gymX, foundH+gymH+0.80, gymZ);
    // 体育館入口
    box("gym_entry",  "glass_entry",gymW*0.30, gymH*0.68, 0.22,  gymX, foundH+gymH*0.37, gymZ+gymD*0.5);
    box("gym_ent_can","canopy",     gymW*0.40, 0.22, 3.5,        gymX, foundH+gymH*0.72, gymZ+gymD*0.5+1.75);

    // ── プール ────────────────────────────────────────────────────────────────
    box("pool_deck",  "pool_wall",  poolW+2.0, 0.55, poolD+2.0,  poolX, 0.28, poolZ);
    box("pool_water", "pool_water", poolW,     0.40, poolD,       poolX, 0.40, poolZ);
    box("pool_wall_f","pool_wall",  poolW+2.0, 0.55, 0.30,        poolX, 0.28, poolZ+poolD*0.5+0.15);
    box("pool_wall_b","pool_wall",  poolW+2.0, 0.55, 0.30,        poolX, 0.28, poolZ-poolD*0.5-0.15);
    box("pool_wall_L","pool_wall",  0.30, 0.55, poolD+2.0,        poolX-poolW*0.5-0.15, 0.28, poolZ);
    box("pool_wall_R","pool_wall",  0.30, 0.55, poolD+2.0,        poolX+poolW*0.5+0.15, 0.28, poolZ);
    // レーンライン (8レーン想定: 25mプール)
    for (let l = 1; l <= 6; l++) {
      box(`pool_lane_${l}`, "sign_white", 0.10, 0.06, poolD*0.88,
        poolX - poolW*0.5 + l * poolW/7, 0.46, poolZ);
    }

    // ── 正門 ─────────────────────────────────────────────────────────────────
    // 門柱 × 2 (太く重厚)
    box("gate_post_L",  "gate_pillar",  1.2, gateH_+0.4, 1.2, -gateW_*0.5-0.6, (gateH_+0.4)*0.5, gateZ);
    box("gate_post_R",  "gate_pillar",  1.2, gateH_+0.4, 1.2,  gateW_*0.5+0.6, (gateH_+0.4)*0.5, gateZ);
    // 門扉 (左右2枚)
    box("gate_door_L",  "gate_fence",   gateW_*0.44, gateH_*0.82, 0.12, -gateW_*0.22, gateH_*0.44, gateZ);
    box("gate_door_R",  "gate_fence",   gateW_*0.44, gateH_*0.82, 0.12,  gateW_*0.22, gateH_*0.44, gateZ);
    // 門扉上部飾り
    box("gate_top",     "gate_pillar",  gateW_+1.5, 0.30, 0.30,  0, gateH_+0.55, gateZ);
    // フェンス (左右)
    const fSegW = (fenceSpan - gateW_ - 1.4) * 0.5;
    box("fence_L",  "gate_fence",  fSegW, gateH_*0.78, 0.12,
      -(gateW_*0.5 + 1.4 + fSegW*0.5), gateH_*0.42, gateZ);
    box("fence_R",  "gate_fence",  fSegW, gateH_*0.78, 0.12,
       (gateW_*0.5 + 1.4 + fSegW*0.5), gateH_*0.42, gateZ);
    // 校名石碑 (右門柱横)
    box("school_sign",  "gate_pillar",  0.30, 1.80, 0.80,
      gateW_*0.5+1.5, 0.90, gateZ - 1.0);
    box("school_sign_txt","sign_white", 0.08, 1.40, 0.58,
      gateW_*0.5+1.36, 0.90, gateZ - 1.0);

    // ── Surface details ───────────────────────────────────────────────────────
    const schRegions = ["facade", "gym", "schoolyard", "window", "entrance"];
    const schTypes   = ["panel_seam", "window_grid", "concrete_texture", "weathering", "trim_line"];
    let sdIdx = 1;
    for (const region of schRegions) {
      for (let i = 0; i < 8; i++) {
        pushSurface(`sd_${sdIdx++}`, region, schTypes[i % schTypes.length],
          0.10 + (i%5)*0.04,
          [Math.sin(i*0.9)*0.013, Math.cos(i*0.7)*0.011, ((i%4)-1.5)*0.009]);
      }
    }

    const totalH = foundH + gymH + 0.80 + 0.50;  // 体育館が最高点
    spec.globalScale = { height: rounded(totalH), width: rounded(_siteW), depth: rounded(_siteD) };
    spec.parts = parts;
    spec.surfaceDetails = surfaceDetails;
    return spec;
  }
  // ── END facility_school override ──────────────────────────────────────────────

  // ── 市役所・区役所・町役場: 5階建て・議会棟・大駐車場 ─────────────────────────
  if (archetype === "facility_cityhall") {
    spec.materials = {
      wall_main:    { baseColor: "#D8D4C8", roughness: 0.88, metalness: 0.04 },
      wall_base:    { baseColor: "#C4BEb0", roughness: 0.90, metalness: 0.03 },
      wall_accent:  { baseColor: "#8A7A60", roughness: 0.85, metalness: 0.05 },
      wall_council: { baseColor: "#C8C0A8", roughness: 0.88, metalness: 0.04 },
      concrete:     { baseColor: "#C0BCB4", roughness: 0.92, metalness: 0.02 },
      column:       { baseColor: "#D4D0C4", roughness: 0.86, metalness: 0.04 },
      glass_win:    { baseColor: "#7AACC8", roughness: 0.10, metalness: 0.88 },
      glass_curtain:{ baseColor: "#90C0D8", roughness: 0.06, metalness: 0.90 },
      glass_entry:  { baseColor: "#A8D0E4", roughness: 0.05, metalness: 0.88 },
      canopy:       { baseColor: "#D0CCC0", roughness: 0.84, metalness: 0.08 },
      steel_frame:  { baseColor: "#9A9E9A", roughness: 0.52, metalness: 0.64 },
      sign_gold:    { baseColor: "#B09030", roughness: 0.35, metalness: 0.75 },
      sign_dark:    { baseColor: "#2A2820", roughness: 0.45, metalness: 0.12 },
      sign_white:   { baseColor: "#F0EEE8", roughness: 0.55, metalness: 0.04 },
      flagpole:     { baseColor: "#C0C4C0", roughness: 0.40, metalness: 0.80 },
      flag_green:   { baseColor: "#2A7840", roughness: 0.65, metalness: 0.05 },
      paving_main:  { baseColor: "#B8B4A8", roughness: 0.95, metalness: 0.01 },
      paving_plaza: { baseColor: "#C8C4B8", roughness: 0.93, metalness: 0.01 },
      parking_line: { baseColor: "#DCDCCC", roughness: 0.58, metalness: 0.04 },
      roof_flat:    { baseColor: "#9E9C98", roughness: 0.90, metalness: 0.05 },
      council_roof: { baseColor: "#8A8880", roughness: 0.88, metalness: 0.06 },
    };

    // ── 寸法設計 ─────────────────────────────────────────────────────────────
    // 本庁舎: 5階建て・幅広・大型エントランス
    // 議会棟: 独立翼・ドーム風天井（低層大スパン）
    // 駐車場: 正面右側 + 議会棟横
    const fH      = 3.8;    // フロア高（公共施設: やや高め）
    const floors  = 5;
    const foundH  = 0.8;    // 台座（公共建築らしい格式）
    const parH    = 1.0;
    const parT    = 0.35;
    const roofSlabH = 0.25;
    const bodyH   = fH * floors;   // 19.0m

    // ── 本庁舎 (メイン: 横長5F) ──────────────────────────────────────────────
    const mW = 54.0;
    const mD = 18.0;
    const mX = 0.0;
    const mZ = 0.0;
    const mFront = mZ + mD * 0.5;

    // ── 議会棟 (右翼: 低層・大スパン) ───────────────────────────────────────
    const cW = 24.0;   // 議会棟 幅
    const cD = 20.0;   // 議会棟 奥行き
    const cH = fH * 2.5;  // 約9.5m（大空間）
    const cX = mW * 0.5 + cW * 0.5 + 0.5;
    const cZ = mZ + mD * 0.5 - cD * 0.5;  // 前面揃え

    // ── 別館 (左翼: 3階建て・窓口業務) ────────────────────────────────────
    const aW = 18.0;
    const aD = 14.0;
    const aH = fH * 3;
    const aX = -(mW * 0.5 + aW * 0.5 + 0.5);
    const aZ = mZ + mD * 0.5 - aD * 0.5;

    // ── 駐車場A (本庁舎正面右側) ─────────────────────────────────────────────
    const pkAW    = 28.0;
    const pkANs   = 10;
    const pkASpW  = 2.5;
    const pkASpD  = 5.0;
    const pkAAisleD = 6.5;
    const pkAD    = pkASpD + pkAAisleD;
    const pkAX    = cX + cW * 0.5 + pkAW * 0.5 + 1.5;
    const pkAZ    = mZ + mD * 0.5 - pkAD * 0.5;

    // ── 駐車場B (議会棟後方) ────────────────────────────────────────────────
    const pkBW    = cW + 4.0;
    const pkBNs   = 7;
    const pkBSpW  = 2.5;
    const pkBSpD  = 5.0;
    const pkBAisleD = 6.0;
    const pkBD    = pkBSpD + pkBAisleD;
    const pkBX    = cX;
    const pkBZ    = cZ - cD * 0.5 - pkBD * 0.5 - 1.0;

    // 正門・広場
    const plazaD  = 16.0;   // 正面広場奥行き
    const plazaZ  = mFront + plazaD * 0.5;
    const gateZ   = mFront + plazaD + 3.0;

    // 敷地バウンディング
    const margin  = 5.0;
    const _siteMinX = Math.min(aX - aW*0.5, pkAX - pkAW*0.5) - margin;
    const _siteMaxX = Math.max(pkAX + pkAW*0.5, cX + cW*0.5) + margin;
    const _siteMinZ = Math.min(pkBZ - pkBD*0.5, mZ - mD*0.5) - margin;
    const _siteMaxZ = gateZ + 3.0 + margin;
    const _siteCX   = (_siteMinX + _siteMaxX) * 0.5;
    const _siteCZ   = (_siteMinZ + _siteMaxZ) * 0.5;
    const _siteW    = _siteMaxX - _siteMinX;
    const _siteD    = _siteMaxZ - _siteMinZ;

    // ── 敷地 ─────────────────────────────────────────────────────────────────
    box("site_pave",   "paving_main",  _siteW, 0.20, _siteD, _siteCX, 0.10, _siteCZ);

    // ── 正面広場 (市民プラザ) ─────────────────────────────────────────────────
    box("plaza",       "paving_plaza", mW*1.10, 0.22, plazaD, mX, 0.11, plazaZ);
    // 広場 モニュメント (中央噴水台座)
    shape("monument_base", "cylinder", "column", 4.0, 0.60, 4.0,  mX, 0.30, plazaZ);
    shape("monument_col",  "cylinder", "sign_gold", 0.50, 3.5, 0.50, mX, 2.05, plazaZ);
    box("monument_top", "sign_gold",  1.2, 0.50, 1.2,  mX, 4.05, plazaZ);
    // 国旗ポール (3本: 国旗・都道府県旗・市区町村旗)
    for (let i = -1; i <= 1; i++) {
      shape(`flag_pole_${i+2}`, "cylinder", "flagpole", 0.12, bodyH*0.72, 0.12,
        mX + i * 5.5, bodyH*0.36, plazaZ + plazaD*0.38);
      box(`flag_${i+2}`, "flag_green", 1.6, 0.80, 0.08,
        mX + i*5.5 + 0.80, bodyH*0.68, plazaZ + plazaD*0.38);
    }

    // ── 本庁舎 ───────────────────────────────────────────────────────────────
    box("m_found",     "concrete",    mW+0.6, foundH, mD+0.6, mX, foundH*0.5, mZ);
    for (let f = 0; f < floors; f++) {
      const fy0 = foundH + f * fH;
      box(`m_wall_f${f+1}`,  "wall_main",  mW, fH-0.16, mD, mX, fy0+(fH-0.16)*0.5, mZ);
      box(`m_band_f${f+1}`,  "wall_accent",mW+0.1, 0.16, mD+0.1, mX, fy0, mZ);
      // 前面 カーテンウォール (1F: 大窓, 2F以上: 連続窓)
      if (f === 0) {
        box(`m_curt_f1`,  "glass_curtain", mW*0.58, fH*0.72, 0.20, mX, fy0+fH*0.56, mFront);
      } else {
        for (let w = -3; w <= 3; w++) {
          box(`m_winF_f${f+1}_${w+4}`, "glass_win", mW*0.096, fH*0.60, 0.20,
            mX + w*mW*0.145, fy0+fH*0.62, mFront);
        }
      }
      // 後面窓
      box(`m_winB_f${f+1}`, "glass_win", mW*0.68, fH*0.48, 0.18, mX, fy0+fH*0.56, mZ-mD*0.5);
      // 側面窓
      box(`m_winL_f${f+1}`, "glass_win", 0.18, fH*0.50, mD*0.60, mX-mW*0.5, fy0+fH*0.58, mZ);
      box(`m_winR_f${f+1}`, "glass_win", 0.18, fH*0.50, mD*0.60, mX+mW*0.5, fy0+fH*0.58, mZ);
    }
    const mPY = foundH + bodyH;
    box("m_par_f",  "concrete", mW+parT*2, parH, parT, mX, mPY+parH*0.5, mFront+parT*0.5);
    box("m_par_b",  "concrete", mW+parT*2, parH, parT, mX, mPY+parH*0.5, mZ-mD*0.5-parT*0.5);
    box("m_par_L",  "concrete", parT, parH, mD,         mX-mW*0.5-parT*0.5, mPY+parH*0.5, mZ);
    box("m_par_R",  "concrete", parT, parH, mD,         mX+mW*0.5+parT*0.5, mPY+parH*0.5, mZ);
    box("m_roof",   "roof_flat",mW+parT*2, roofSlabH, mD+parT*2, mX, mPY+parH+roofSlabH*0.5, mZ);
    // 屋上突出部 (機械室)
    box("m_pent",   "concrete",  mW*0.22, fH*0.60, mD*0.55, mX+mW*0.20, mPY+parH+roofSlabH+fH*0.30, mZ-mD*0.12);

    // ── 大エントランス (正面中央: コロネード) ───────────────────────────────
    const entW = mW * 0.44;
    const entZ = mFront;
    const colH_ = foundH + bodyH * 0.45;
    // 庇 (大型)
    box("ent_lintel",  "concrete",   entW+2.0, 0.90, 1.4,   mX, foundH+fH*1.14, entZ+0.7);
    // 円柱 6本
    for (let c = -2; c <= 2; c++) {
      shape(`ent_col_${c+3}`, "cylinder", "column", 0.72, colH_, 0.72,
        mX + c * entW*0.22, foundH + colH_*0.5, entZ);
    }
    // エントランスドア (幅広自動ドア × 3連)
    for (let d = -1; d <= 1; d++) {
      box(`ent_door_${d+2}`, "glass_entry", entW*0.22, fH*0.84, 0.22,
        mX + d*entW*0.26, foundH+fH*0.44, entZ);
    }
    // 庁舎名看板
    box("hall_sign",  "sign_dark",  entW*0.72, fH*0.22, 0.14, mX, foundH+bodyH*0.90, entZ+0.01);
    box("hall_sign_t","sign_gold",  entW*0.58, fH*0.12, 0.15, mX, foundH+bodyH*0.90, entZ+0.02);
    // 入口階段 (5段)
    for (let s = 0; s < 5; s++) {
      box(`step_${s}`, "concrete", entW+2.0+s*0.5, foundH*0.18, 1.4,
        mX, foundH*(0.09 + s*0.18), entZ + 1.4 + s*1.4);
    }

    // ── 議会棟 ───────────────────────────────────────────────────────────────
    box("c_found",    "concrete",   cW+0.4, foundH, cD+0.4,  cX, foundH*0.5, cZ);
    box("c_wall",     "wall_council",cW, cH, cD,             cX, foundH+cH*0.5, cZ);
    box("c_band_b",   "wall_accent", cW+0.1, 0.25, cD+0.1,   cX, foundH+0.50, cZ);
    // 議場 ハイサイドライト (高い位置の窓)
    for (let w = -1; w <= 1; w++) {
      box(`c_win_f_${w+2}`, "glass_win", cW*0.18, cH*0.24, 0.20,
        cX + w*cW*0.28, foundH+cH*0.80, cZ+cD*0.5);
      box(`c_win_b_${w+2}`, "glass_win", cW*0.18, cH*0.24, 0.20,
        cX + w*cW*0.28, foundH+cH*0.80, cZ-cD*0.5);
    }
    // 議会棟屋根 (台形状: 格調)
    box("c_roof_main","council_roof",cW+0.4, roofSlabH+0.20, cD+0.4, cX, foundH+cH+0.25, cZ);
    box("c_roof_ridge","council_roof",cW*0.55, 0.40, cD*0.90, cX, foundH+cH+0.65, cZ);
    // 議会棟入口
    box("c_entry",    "glass_entry", cW*0.34, cH*0.50, 0.22, cX, foundH+cH*0.28, cZ+cD*0.5);
    box("c_ent_can",  "canopy",      cW*0.44, 0.22, 3.0,     cX, foundH+cH*0.55, cZ+cD*0.5+1.5);
    // 議会棟サイン
    box("c_sign",     "sign_dark",   cW*0.55, cH*0.14, 0.14, cX, foundH+cH*0.72, cZ+cD*0.502);
    box("c_sign_t",   "sign_gold",   cW*0.44, cH*0.08, 0.15, cX, foundH+cH*0.72, cZ+cD*0.503);

    // ── 別館 ─────────────────────────────────────────────────────────────────
    box("a_found",    "concrete",   aW+0.3, foundH, aD+0.3,  aX, foundH*0.5, aZ);
    for (let f = 0; f < 3; f++) {
      const fy0 = foundH + f * fH;
      box(`a_wall_f${f+1}`, "wall_main",  aW, fH-0.16, aD, aX, fy0+(fH-0.16)*0.5, aZ);
      box(`a_band_f${f+1}`, "wall_accent",aW+0.1, 0.16, aD+0.1, aX, fy0, aZ);
      box(`a_winF_f${f+1}`, "glass_win",  aW*0.62, fH*0.56, 0.18, aX, fy0+fH*0.60, aZ+aD*0.5);
      box(`a_winB_f${f+1}`, "glass_win",  aW*0.50, fH*0.46, 0.18, aX, fy0+fH*0.56, aZ-aD*0.5);
    }
    const aPY = foundH + aH;
    box("a_par_f",  "concrete", aW+parT*2, parH, parT,  aX, aPY+parH*0.5, aZ+aD*0.5+parT*0.5);
    box("a_par_b",  "concrete", aW+parT*2, parH, parT,  aX, aPY+parH*0.5, aZ-aD*0.5-parT*0.5);
    box("a_par_L",  "concrete", parT, parH, aD,          aX-aW*0.5-parT*0.5, aPY+parH*0.5, aZ);
    box("a_par_R",  "concrete", parT, parH, aD,          aX+aW*0.5+parT*0.5, aPY+parH*0.5, aZ);
    box("a_roof",   "roof_flat",aW+parT*2, roofSlabH, aD+parT*2, aX, aPY+parH+roofSlabH*0.5, aZ);
    // 別館入口
    box("a_entry",  "glass_entry",aW*0.36, fH*0.80, 0.20, aX, foundH+fH*0.42, aZ+aD*0.5);
    box("a_can",    "canopy",     aW*0.46, 0.20, 3.2,      aX, foundH+fH*0.84, aZ+aD*0.5+1.6);

    // ── 駐車場A (正面右) ─────────────────────────────────────────────────────
    box("pkA_base",  "paving_main", pkAW, 0.20, pkAD,  pkAX, 0.10, pkAZ);
    for (let i = 0; i <= pkANs; i++) {
      box(`pkA_ln_${i}`, "parking_line", 0.10, 0.06, pkASpD,
        pkAX - pkAW*0.5 + i*pkASpW + (pkAW - pkANs*pkASpW)*0.5,
        0.22, pkAZ - pkAAisleD*0.5 + pkASpD*0.5);
    }
    box("pkA_aisle", "parking_line", pkAW, 0.06, 0.10, pkAX, 0.22, pkAZ - pkAAisleD*0.5);
    for (let i = 0; i < pkANs; i++) {
      const sx = pkAX - pkAW*0.5 + (i+0.5)*pkASpW + (pkAW - pkANs*pkASpW)*0.5;
      box(`pkA_stop_${i}`, "concrete", pkASpW*0.58, 0.14, 0.20, sx, 0.27, pkAZ - pkAD*0.5 + 0.5);
    }

    // ── 駐車場B (議会棟後方) ────────────────────────────────────────────────
    box("pkB_base",  "paving_main", pkBW, 0.20, pkBD,  pkBX, 0.10, pkBZ);
    for (let i = 0; i <= pkBNs; i++) {
      box(`pkB_ln_${i}`, "parking_line", 0.10, 0.06, pkBSpD,
        pkBX - pkBW*0.5 + i*pkBSpW + (pkBW - pkBNs*pkBSpW)*0.5,
        0.22, pkBZ - pkBAisleD*0.5 + pkBSpD*0.5);
    }
    box("pkB_aisle", "parking_line", pkBW, 0.06, 0.10, pkBX, 0.22, pkBZ - pkBAisleD*0.5);

    // ── Surface details ───────────────────────────────────────────────────────
    const chRegions = ["facade", "council", "entrance", "plaza", "parking"];
    const chTypes   = ["panel_seam", "concrete_texture", "window_grid", "weathering", "trim_line"];
    let sdIdx = 1;
    for (const region of chRegions) {
      for (let i = 0; i < 8; i++) {
        pushSurface(`sd_${sdIdx++}`, region, chTypes[i % chTypes.length],
          0.10 + (i%5)*0.04,
          [Math.sin(i*0.9)*0.013, Math.cos(i*0.7)*0.011, ((i%4)-1.5)*0.009]);
      }
    }

    const totalH = foundH + bodyH + parH + roofSlabH;
    spec.globalScale = { height: rounded(totalH), width: rounded(_siteW), depth: rounded(_siteD) };
    spec.parts = parts;
    spec.surfaceDetails = surfaceDetails;
    return spec;
  }
  // ── END facility_cityhall override ────────────────────────────────────────────

  // ── facility_university override ──────────────────────────────────────────────
  if (archetype === "facility_university") {
    // ── Materials ──────────────────────────────────────────────────────────────
    spec.materials = {
      concrete_main:   { baseColor: "#C8C4B8", roughness: 0.88, metalness: 0.04 },
      concrete_dark:   { baseColor: "#8A8880", roughness: 0.86, metalness: 0.04 },
      brick_warm:      { baseColor: "#B87050", roughness: 0.90, metalness: 0.02 },
      glass_blue:      { baseColor: "#5890C8", roughness: 0.08, metalness: 0.85 },
      glass_green:     { baseColor: "#60B890", roughness: 0.08, metalness: 0.85 },
      roof_flat:       { baseColor: "#6A6860", roughness: 0.88, metalness: 0.06 },
      roof_tile:       { baseColor: "#3A5A3A", roughness: 0.88, metalness: 0.04 },
      road_asphalt:    { baseColor: "#3C3C3C", roughness: 0.96, metalness: 0.02 },
      road_line:       { baseColor: "#E8E8E0", roughness: 0.80, metalness: 0.02 },
      paving_main:     { baseColor: "#B8B4A8", roughness: 0.88, metalness: 0.02 },
      paving_path:     { baseColor: "#C8C0A0", roughness: 0.90, metalness: 0.02 },
      grass_green:     { baseColor: "#4A7A30", roughness: 0.98, metalness: 0.00 },
      tree_foliage:    { baseColor: "#2A6020", roughness: 0.98, metalness: 0.00 },
      tree_trunk:      { baseColor: "#6A4820", roughness: 0.96, metalness: 0.00 },
      fence_metal:     { baseColor: "#404848", roughness: 0.60, metalness: 0.60 },
      sign_white:      { baseColor: "#F0F0F0", roughness: 0.60, metalness: 0.10 },
      sign_blue:       { baseColor: "#1A4080", roughness: 0.50, metalness: 0.15, emissive: "#0A2040" },
      steel_gray:      { baseColor: "#808888", roughness: 0.50, metalness: 0.70 },
      water_fountain:  { baseColor: "#4080B0", roughness: 0.10, metalness: 0.20 },
      gym_wall:        { baseColor: "#D0C8A8", roughness: 0.90, metalness: 0.02 },
      track_red:       { baseColor: "#CC3A20", roughness: 0.90, metalness: 0.02 },
      field_green:     { baseColor: "#3A8028", roughness: 0.98, metalness: 0.00 },
      parking_asphalt: { baseColor: "#484848", roughness: 0.94, metalness: 0.02 }
    };

    const parts = [];
    const surfaceDetails = [];

    const box = (id, mat, w, h, d, x, y, z) => {
      parts.push({ id, kind: "box", material: mat,
        size: [+w.toFixed(3), +h.toFixed(3), +d.toFixed(3)],
        position: [+x.toFixed(3), +y.toFixed(3), +z.toFixed(3)] });
    };
    const cyl = (id, mat, r, h, x, y, z) => {
      parts.push({ id, kind: "cylinder", material: mat,
        size: [+(r*2).toFixed(3), +h.toFixed(3), +(r*2).toFixed(3)],
        position: [+x.toFixed(3), +y.toFixed(3), +z.toFixed(3)] });
    };
    const sd = (id, type, mat, w, h, d, x, y, z, extra = {}) => {
      surfaceDetails.push({ id, type, material: mat,
        size: [+w.toFixed(3), +h.toFixed(3), +d.toFixed(3)],
        position: [+x.toFixed(3), +y.toFixed(3), +z.toFixed(3)], ...extra });
    };

    // ──────────────────────────────────────────────────────────────────────────
    // Campus layout (all units in meters, Y=up, +Z=front/street)
    //
    //  Total site: 320m (X) × 240m (Z)
    //  Site center: (0, 0, 0)  → site spans X[-160..+160], Z[-120..+120]
    //
    //  Street (main gate) is at Z=+120 (south edge)
    //  Main axis runs north (−Z direction) through the center
    //
    //  Zone layout (Z origin = street side):
    //    Z [+120..+90]  : entrance plaza / gate / approach
    //    Z [+90..+50]   : central mall  (front quads)
    //    Z [+50..−50]   : core academic buildings (8 lecture halls)
    //    Z [−50..−80]   : library + admin tower + cafeteria
    //    Z [−80..−120]  : sports / gym / athletics track
    //    X [+100..+160] : parking lots A & B
    //    X [−160..−100] : parking lot C + bicycle parking
    // ──────────────────────────────────────────────────────────────────────────

    // ── Ground plane (site_pave) ─────────────────────────────────────────────
    box("site_pave", "paving_main", 326, 0.20, 256, 0, 0.10, -3.5);

    // ── Perimeter fence ──────────────────────────────────────────────────────
    // South fence (with gate gap 14m wide)
    box("fence_s_l", "fence_metal", 153, 2.0, 0.4,  -83.5, 1.0, 120);
    box("fence_s_r", "fence_metal", 153, 2.0, 0.4,   83.5, 1.0, 120);
    // North fence
    box("fence_n",   "fence_metal", 320, 2.0, 0.4,    0,   1.0, -120);
    // East fence
    box("fence_e",   "fence_metal", 0.4, 2.0, 240,  160,   1.0,    0);
    // West fence
    box("fence_w",   "fence_metal", 0.4, 2.0, 240, -160,   1.0,    0);

    // ── Main gate pillars ─────────────────────────────────────────────────────
    box("gate_pillar_l",  "concrete_dark", 3.5, 5.0, 3.5, -10.0, 2.5, 120);
    box("gate_pillar_r",  "concrete_dark", 3.5, 5.0, 3.5,  10.0, 2.5, 120);
    box("gate_arch",      "concrete_dark", 20,  1.0, 1.2,   0,   5.5, 120);
    // University name sign on arch
    box("gate_sign",      "sign_blue",     16,  1.5, 0.3,   0,   6.5, 119.8);

    // ── Guard booth ───────────────────────────────────────────────────────────
    box("guard_booth",    "concrete_main",  4,  3.0, 4.0,  16,  1.5, 118);
    box("guard_roof",     "roof_flat",      4.4,0.3, 4.4,  16,  3.15,118);

    // ── Entrance plaza (Z=+90..+120) ──────────────────────────────────────────
    box("plaza_pave",     "paving_path", 90, 0.25, 30,  0, 0.125, 105);
    // Central fountain
    cyl("fountain_basin", "water_fountain", 5.0, 0.8,   0, 0.4, 105);
    cyl("fountain_pillar","concrete_dark",  0.4, 2.0,   0, 1.0, 105);
    cyl("fountain_top",   "water_fountain", 1.5, 0.3,   0, 2.2, 105);
    // Approach trees (6 pairs along main axis)
    for (let i = 0; i < 6; i++) {
      const tz = 118 - i * 5.5;
      cyl(`tree_approach_l_${i}`, "tree_trunk", 0.4, 3.0, -18, 1.5, tz);
      cyl(`tree_approach_r_${i}`, "tree_trunk", 0.4, 3.0,  18, 1.5, tz);
      cyl(`tree_foliage_l_${i}`,  "tree_foliage",2.2, 3.5, -18, 4.5, tz);
      cyl(`tree_foliage_r_${i}`,  "tree_foliage",2.2, 3.5,  18, 4.5, tz);
    }
    // Flagpoles (3)
    cyl("flag_pole_l",  "steel_gray", 0.15, 12,  -8, 6.0, 95);
    cyl("flag_pole_c",  "steel_gray", 0.15, 12,   0, 6.0, 95);
    cyl("flag_pole_r",  "steel_gray", 0.15, 12,   8, 6.0, 95);
    box("flag_l",       "sign_blue",  2.8, 1.6, 0.05, -6.6, 11.2, 95);
    box("flag_c",       "sign_blue",  2.8, 1.6, 0.05,  1.4, 11.2, 95);
    box("flag_r",       "sign_white", 2.8, 1.6, 0.05,  9.4, 11.2, 95);

    // ── Central mall lawn (Z=+90..+50) ────────────────────────────────────────
    box("mall_lawn_l",   "grass_green", 30, 0.20, 40, -35, 0.10, 70);
    box("mall_lawn_r",   "grass_green", 30, 0.20, 40,  35, 0.10, 70);
    box("mall_path",     "paving_path", 14, 0.22, 40,   0, 0.11, 70);
    // Bench rows along path
    for (let i = 0; i < 4; i++) {
      const bz = 85 - i * 9;
      box(`bench_l_${i}`, "concrete_dark", 2.5, 0.6, 0.8, -8,  0.3, bz);
      box(`bench_r_${i}`, "concrete_dark", 2.5, 0.6, 0.8,  8,  0.3, bz);
    }
    // Mall trees
    for (let i = 0; i < 5; i++) {
      const tz = 87 - i * 8;
      cyl(`mall_tree_ll_${i}`, "tree_trunk",   0.35, 2.5, -26, 1.25, tz);
      cyl(`mall_tree_rl_${i}`, "tree_trunk",   0.35, 2.5,  26, 1.25, tz);
      cyl(`mall_foliage_ll_${i}`,"tree_foliage",2.0, 3.0, -26, 3.75, tz);
      cyl(`mall_foliage_rl_${i}`,"tree_foliage",2.0, 3.0,  26, 3.75, tz);
    }

    // ── Helper: lecture building (4F, brick+glass) ────────────────────────────
    const lecBuilding = (prefix, bx, bz, bW, bD) => {
      const fH = 3.8, nF = 4;
      const bH = fH * nF;
      // Main body
      box(`${prefix}_body`,    "brick_warm",   bW,      bH,      bD,      bx,  bH*0.5,      bz);
      // Flat roof
      box(`${prefix}_roof`,    "roof_flat",    bW+0.4,  0.4,     bD+0.4,  bx,  bH+0.2,      bz);
      // Curtain glass front (south face)
      box(`${prefix}_glass_f`, "glass_blue",   bW*0.80, bH*0.88, 0.25,    bx,  bH*0.5+0.2,  bz+bD*0.5);
      // Entrance canopy
      box(`${prefix}_canopy`,  "concrete_dark",bW*0.35, 0.30,    3.0,     bx,  fH*0.5+fH,   bz+bD*0.5+1.5);
      // Floor bands
      for (let f = 1; f < nF; f++) {
        box(`${prefix}_band_${f}`, "concrete_dark", bW+0.1, 0.18, bD+0.1, bx, fH*f, bz);
      }
      // Windows on back face
      for (let f = 0; f < nF; f++) {
        for (let w = 0; w < 4; w++) {
          const wx = bx - bW*0.35 + w * (bW*0.70/3);
          const wy = fH*0.35 + f*fH + fH*0.20;
          box(`${prefix}_win_b_${f}_${w}`, "glass_green", bW*0.13, fH*0.50, 0.15, wx, wy, bz-bD*0.5);
        }
      }
      // Entrance steps
      box(`${prefix}_step1`,   "concrete_dark", bW*0.30, 0.18, 1.0, bx, 0.18, bz+bD*0.5+2.8);
      box(`${prefix}_step2`,   "concrete_dark", bW*0.30, 0.36, 0.7, bx, 0.36, bz+bD*0.5+2.0);
    };

    // ── 8 Lecture buildings ──────────────────────────────────────────────────
    // Row A: 4 buildings on west side, Z=+40..−20  (X≈−55)
    // Row B: 4 buildings on east side, Z=+40..−20  (X≈+55)
    const lecW = 36, lecD = 18;
    const lecPositions = [
      // Row A (west)
      { prefix: "lec_a1", bx: -55, bz:  32 },
      { prefix: "lec_a2", bx: -55, bz:   6 },
      { prefix: "lec_a3", bx: -55, bz: -20 },
      { prefix: "lec_a4", bx: -55, bz: -46 },
      // Row B (east)
      { prefix: "lec_b1", bx:  55, bz:  32 },
      { prefix: "lec_b2", bx:  55, bz:   6 },
      { prefix: "lec_b3", bx:  55, bz: -20 },
      { prefix: "lec_b4", bx:  55, bz: -46 },
    ];
    for (const lp of lecPositions) {
      lecBuilding(lp.prefix, lp.bx, lp.bz, lecW, lecD);
    }

    // Internal east-west paths between buildings
    for (let i = 0; i < 5; i++) {
      const pz = 44 - i * 26;
      box(`inner_path_${i}`, "paving_path", 86, 0.22, 5, 0, 0.11, pz);
    }

    // ── Library (6F, central axis, Z=−60..−80) ────────────────────────────────
    const libX = -28, libZ = -70, libW = 50, libD = 20, libH = 6 * 3.8;
    box("library_body",   "concrete_main", libW,     libH,     libD,     libX, libH*0.5,     libZ);
    box("library_roof",   "roof_flat",     libW+0.4, 0.40,     libD+0.4, libX, libH+0.2,     libZ);
    box("library_glass_f","glass_blue",    libW*0.75,libH*0.90,0.25,     libX, libH*0.5+0.3, libZ+libD*0.5);
    // Entrance portico
    box("lib_portico",    "concrete_dark", libW*0.40,3.6,      2.5,      libX, 3.8+1.8,      libZ+libD*0.5+1.25);
    for (let c = 0; c < 4; c++) {
      const cx = libX - libW*0.15 + c*(libW*0.30/3);
      cyl(`lib_col_${c}`,  "concrete_dark", 0.35, 3.6, cx, 1.8, libZ+libD*0.5+1.25);
    }
    box("lib_sign",       "sign_blue",     12,  1.4, 0.30,     libX, libH+1.1,              libZ+libD*0.5);
    // Window bands
    for (let f = 0; f < 6; f++) {
      for (let w = 0; w < 5; w++) {
        const wx = libX - libW*0.34 + w*(libW*0.68/4);
        const wy = 3.8*0.35 + f*3.8 + 3.8*0.20;
        box(`lib_win_${f}_${w}`, "glass_green", libW*0.10, 3.8*0.50, 0.15, wx, wy, libZ-libD*0.5);
      }
    }

    // ── Admin tower (6F, central right, Z=−60..−80) ───────────────────────────
    const admX = 28, admZ = -70, admW = 24, admD = 16, admH = 6 * 3.8;
    box("admin_body",     "concrete_main", admW,     admH,     admD,     admX, admH*0.5,     admZ);
    box("admin_roof",     "roof_flat",     admW+0.4, 0.40,     admD+0.4, admX, admH+0.2,     admZ);
    box("admin_glass_f",  "glass_blue",    admW*0.75,admH*0.90,0.25,     admX, admH*0.5+0.3, admZ+admD*0.5);
    box("admin_sign",     "sign_blue",     10,  1.2, 0.30,     admX, admH+1.0,              admZ+admD*0.5);

    // ── Cafeteria / student union (2F, Z=−56..−70, between lib and sports) ────
    const cafX = 0, cafZ = -58, cafW = 40, cafD = 14, cafH = 2 * 3.8;
    box("cafe_body",      "brick_warm",    cafW,     cafH,     cafD,     cafX, cafH*0.5,     cafZ);
    box("cafe_roof",      "roof_flat",     cafW+0.4, 0.35,     cafD+0.4, cafX, cafH+0.18,    cafZ);
    box("cafe_glass_f",   "glass_blue",    cafW*0.70,cafH*0.85,0.25,     cafX, cafH*0.5+0.2, cafZ+cafD*0.5);
    box("cafe_terrace",   "paving_path",   cafW*0.60,0.22,     4.0,      cafX, cafH+0.11,    cafZ+cafD*0.5+2.0);
    // Terrace railing
    box("cafe_rail_f",    "steel_gray",    cafW*0.60,0.9,      0.08,     cafX, cafH+0.66,    cafZ+cafD*0.5+4.0);

    // ── Gymnasium (large single-story shed, Z=−85..−115) ─────────────────────
    const gymX = -25, gymZ = -100, gymW = 60, gymD = 30, gymH = 10.0;
    box("gym_body",       "gym_wall",      gymW,     gymH,     gymD,     gymX, gymH*0.5,     gymZ);
    box("gym_roof_ridge", "roof_flat",     gymW+0.6, 0.50,     gymD+0.6, gymX, gymH+0.25,   gymZ);
    box("gym_glass_f",    "glass_green",   gymW*0.60,gymH*0.55,0.25,     gymX, gymH*0.5,    gymZ+gymD*0.5);
    // High-side clerestory windows
    box("gym_clerestory", "glass_blue",    gymW*0.80,1.8,      0.20,     gymX, gymH*0.85,   gymZ+gymD*0.5);
    // Entrance
    box("gym_entry",      "concrete_dark", 10,  0.30,  3.5,    gymX, gymH*0.4,              gymZ+gymD*0.5+1.75);

    // ── Athletics track + field ───────────────────────────────────────────────
    // Field (soccer / multi-use) center
    const fieldX = 50, fieldZ = -98;
    box("track_outer",    "track_red",     90, 0.22, 60,  fieldX, 0.11, fieldZ);
    box("field_inner",    "field_green",   74, 0.25, 44,  fieldX, 0.13, fieldZ);
    // Track lane lines (4 lines each side)
    for (let i = 0; i < 4; i++) {
      const off = 6 + i * 2.5;
      box(`track_line_l_${i}`, "road_line", 0.15, 0.26, 60, fieldX - 37 + off, 0.14, fieldZ);
      box(`track_line_r_${i}`, "road_line", 0.15, 0.26, 60, fieldX + 37 - off, 0.14, fieldZ);
    }
    // Scoreboard
    box("scoreboard_post_l","steel_gray",  0.6, 8, 0.6,  fieldX-8, 4.0, fieldZ-30.5);
    box("scoreboard_post_r","steel_gray",  0.6, 8, 0.6,  fieldX+8, 4.0, fieldZ-30.5);
    box("scoreboard_panel", "sign_blue",   18,  5, 0.4,  fieldX,   9.5, fieldZ-30.5);

    // ── Parking lot A (east, X=+100..+155, Z=+20..−60) ───────────────────────
    const pAX = 127.5, pAZ = -20;
    box("parking_a_pave", "parking_asphalt", 55, 0.22, 80, pAX, 0.11, pAZ);
    // Drive lane
    box("parking_a_lane", "road_asphalt",    6.5, 0.24, 80, pAX-24.25, 0.12, pAZ);
    // Parking space lines (20 spaces on east row)
    for (let i = 0; i < 20; i++) {
      const spz = pAZ - 38 + i * 4.0;
      box(`pa_line_l_${i}`, "road_line", 0.12, 0.25, 2.4, pAX-22.0, 0.13, spz+2.0);
      box(`pa_line_r_${i}`, "road_line", 0.12, 0.25, 2.4, pAX+8.0,  0.13, spz+2.0);
    }
    // Stop bar at entrance
    box("pa_stop_bar",    "road_line",  6.5, 0.25, 0.25, pAX-24.25, 0.13, pAZ+40.0);

    // ── Parking lot B (west, X=−100..−155, Z=+20..−60) ───────────────────────
    const pBX = -127.5, pBZ = -20;
    box("parking_b_pave", "parking_asphalt", 55, 0.22, 80, pBX, 0.11, pBZ);
    box("parking_b_lane", "road_asphalt",    6.5, 0.24, 80, pBX+24.25, 0.12, pBZ);
    for (let i = 0; i < 20; i++) {
      const spz = pBZ - 38 + i * 4.0;
      box(`pb_line_l_${i}`, "road_line", 0.12, 0.25, 2.4, pBX-8.0,  0.13, spz+2.0);
      box(`pb_line_r_${i}`, "road_line", 0.12, 0.25, 2.4, pBX+22.0, 0.13, spz+2.0);
    }
    box("pb_stop_bar",    "road_line",  6.5, 0.25, 0.25, pBX+24.25, 0.13, pBZ+40.0);

    // ── Bicycle parking shelter (east, near gate) ─────────────────────────────
    const bpX = 130, bpZ = 108;
    box("bike_park_floor","paving_path",  20, 0.22, 8,  bpX, 0.11, bpZ);
    box("bike_park_roof", "roof_flat",    20.6, 0.3, 8.6, bpX, 3.2, bpZ);
    box("bike_park_col_l","steel_gray",   0.2, 3.0, 0.2, bpX-9.5, 1.5, bpZ+4.0);
    box("bike_park_col_r","steel_gray",   0.2, 3.0, 0.2, bpX+9.5, 1.5, bpZ+4.0);

    // ── Campus park / garden (southeast quadrant, X=+10..+90, Z=+30..+60) ─────
    box("park_lawn",       "grass_green",  80, 0.22, 30,  45, 0.11, 45);
    box("park_path_main",  "paving_path",  4,  0.24, 30,  45, 0.12, 45);
    // Ornamental pond
    cyl("pond_water",      "water_fountain", 7.0, 0.5,  70, 0.25, 40);
    cyl("pond_edge",       "concrete_dark",  7.4, 0.6,  70, 0.3,  40);
    // Park benches
    for (let i = 0; i < 5; i++) {
      box(`park_bench_${i}`, "concrete_dark", 2.0, 0.6, 0.6, 30 + i*10, 0.3, 50);
    }
    // Park trees (scattered)
    const parkTrees = [
      [32,38],[38,55],[48,44],[58,50],[68,38],[72,54],[35,48],[62,42]
    ];
    for (let i = 0; i < parkTrees.length; i++) {
      const [tx, tz] = parkTrees[i];
      cyl(`park_trunk_${i}`,   "tree_trunk",   0.35, 2.8, tx, 1.4, tz);
      cyl(`park_foliage_${i}`, "tree_foliage", 2.2,  3.5, tx, 4.5, tz);
    }

    // ── Scattered campus trees along roads ────────────────────────────────────
    const roadTrees = [
      [-15,20],[-15,-5],[-15,-30],[-15,-55],
      [ 15,20],[ 15,-5],[ 15,-30],[ 15,-55],
      [-90, 5],[-90,-20],[-90,-45],
      [ 90, 5],[ 90,-20],[ 90,-45],
    ];
    for (let i = 0; i < roadTrees.length; i++) {
      const [tx, tz] = roadTrees[i];
      cyl(`rd_trunk_${i}`,   "tree_trunk",   0.35, 2.8, tx, 1.4, tz);
      cyl(`rd_foliage_${i}`, "tree_foliage", 2.2,  3.5, tx, 4.5, tz);
    }

    // ── Internal roads ────────────────────────────────────────────────────────
    // Main north-south road (center, 7m wide)
    box("road_ns_main",  "road_asphalt",  7.0, 0.23, 210,    0, 0.12, -15);
    // East service road
    box("road_e_service","road_asphalt",  5.0, 0.23, 180,   95, 0.12, -10);
    // West service road
    box("road_w_service","road_asphalt",  5.0, 0.23, 180,  -95, 0.12, -10);
    // East-west connector (mid campus)
    box("road_ew_mid",   "road_asphalt",  190, 0.23, 5.0,   -5, 0.12,   0);
    // South approach road (widened, 10m)
    box("road_approach", "road_asphalt",  10,  0.23, 32,     0, 0.12, 104);

    // ── Manhole / decorative road markings ───────────────────────────────────
    box("cross_mark_n",  "road_line", 10, 0.24, 0.25, 0, 0.12,  50);
    box("cross_mark_s",  "road_line", 10, 0.24, 0.25, 0, 0.12, -50);
    box("cross_mark_e",  "road_line", 0.25, 0.24, 10, 95, 0.12,   0);
    box("cross_mark_w",  "road_line", 0.25, 0.24, 10,-95, 0.12,   0);

    // ── Bounding check & site_pave coverage ─────────────────────────────────
    // Site: X[-160..+160], Z[-120..+120]  — all parts designed to fit within this

    spec.parts          = parts;
    spec.surfaceDetails = surfaceDetails;
    return spec;
  }
  // ── END facility_university override ──────────────────────────────────────────

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

  // ── Japanese traditional house (和風戸建て) — full override ──────────────────
  if (archetype === "house_jp") {
    // Cap to realistic residential height (default building H is 90m; houses are ~8-9m)
    const Hw = Math.min(H, 8.5);

    spec.materials = {
      stone_main:    { baseColor: "#A0A09A", roughness: 0.96, metalness: 0.03 },
      stone_step:    { baseColor: "#8A8A84", roughness: 0.94, metalness: 0.02 },
      plaster_white: { baseColor: "#F4F2EC", roughness: 0.92, metalness: 0.01 },
      wood_dark:     { baseColor: "#5D4037", roughness: 0.88, metalness: 0.02 },
      wood_light:    { baseColor: "#8D6E63", roughness: 0.86, metalness: 0.02 },
      tile_roof:     { baseColor: "#4A4E5D", roughness: 0.80, metalness: 0.10 },
      tile_ridge:    { baseColor: "#3A3840", roughness: 0.82, metalness: 0.08 },
      shoji:         { baseColor: "#F2F0E8", roughness: 0.78, metalness: 0.01 },
      fusuma:        { baseColor: "#8B4513", roughness: 0.85, metalness: 0.04 },
      glass_wa:      { baseColor: "#3A5870", roughness: 0.18, metalness: 0.86 },
    };
    spec.globalScale = { height: Hw, width: rounded(Hw * 1.50), depth: rounded(Hw * 1.12) };

    // ── Vertical zones ────────────────────────────────────────────────────────
    const baseH    = Hw * 0.058;   // 0.5m concrete foundation
    const f1H      = Hw * 0.340;   // 2.9m first-floor walls
    const eave1H   = Hw * 0.047;   // 0.4m low eave slab
    const f2H      = Hw * 0.270;   // 2.3m second-floor walls
    const roofH    = Hw * 0.285;   // 2.4m hip roof

    const yF1   = baseH;
    const yEav1 = yF1   + f1H;
    const yF2   = yEav1 + eave1H;
    const yRoof = yF2   + f2H;

    // ── Plan dimensions ───────────────────────────────────────────────────────
    const bsW = Hw * 1.50;   const bsD = Hw * 1.12;   // base footprint
    const wW  = Hw * 1.25;   const wD  = Hw * 0.875;  // first-floor walls
    const eW  = Hw * 1.56;   const eD  = Hw * 1.19;   // low-eave overhang
    const f2W = Hw * 0.875;  const f2D = Hw * 0.625;  // second-floor (narrower)
    const rW1 = Hw * 1.30;   const rD1 = Hw * 1.19;   // roof eave layer
    const rW2 = Hw * 0.975;  const rD2 = Hw * 0.875;  // roof body
    const pW  = Hw * 0.038;                            // post width

    // ── Foundation & stone steps ──────────────────────────────────────────────
    box("foundation", "stone_main",  bsW,          baseH,          bsD,          0,  baseH*0.50,              0);
    box("step_1",     "stone_step",  Hw*0.30,      baseH*1.60,     Hw*0.08,      0,  baseH*1.30,  bsD*0.50+Hw*0.04);
    box("step_2",     "stone_step",  Hw*0.30,      baseH*0.90,     Hw*0.08,      0,  baseH*0.80,  bsD*0.50+Hw*0.12);

    // ── Engawa (縁側 — perimeter wooden deck) ─────────────────────────────────
    box("engawa_front",  "wood_light", eW*0.88,  Hw*0.042, Hw*0.20,  0,           yF1+Hw*0.021,  wD*0.52);
    box("engawa_side_L", "wood_light", Hw*0.20,  Hw*0.042, wD*0.88, -wW*0.52,    yF1+Hw*0.021,  0);
    box("engawa_side_R", "wood_light", Hw*0.20,  Hw*0.042, wD*0.88,  wW*0.52,    yF1+Hw*0.021,  0);

    // ── First floor body ──────────────────────────────────────────────────────
    box("wall_f1", "plaster_white", wW, f1H, wD, 0, yF1 + f1H*0.5, 0);

    // ── Corner posts 1F (柱) ──────────────────────────────────────────────────
    for (const [sx, sz] of [[-1,-1],[-1,1],[1,-1],[1,1]]) {
      box(`post1_${sx<0?"L":"R"}${sz<0?"B":"F"}`, "wood_dark",
        pW, f1H*1.05, pW,
        sx*(wW*0.50+pW*0.30), yF1+f1H*0.525, sz*(wD*0.50+pW*0.30));
    }

    // ── 1F front facade: fusuma doors + shoji windows ────────────────────────
    box("fusuma_1",    "fusuma", wW*0.14, f1H*0.66, wD*0.03,  wW*0.13,  yF1+f1H*0.38,  wD*0.505);
    box("fusuma_2",    "fusuma", wW*0.14, f1H*0.66, wD*0.03,  wW*0.29,  yF1+f1H*0.38,  wD*0.505);
    box("shoji_f1_L",  "shoji",  wW*0.28, f1H*0.52, wD*0.03, -wW*0.28,  yF1+f1H*0.42,  wD*0.505);
    box("shoji_f1_R",  "shoji",  wW*0.24, f1H*0.52, wD*0.03,  wW*0.42,  yF1+f1H*0.42,  wD*0.505);
    box("shoji_bar_1", "wood_dark", wW*0.28, f1H*0.020, wD*0.035, -wW*0.28, yF1+f1H*0.54, wD*0.505);
    box("shoji_bar_2", "wood_dark", wW*0.28, f1H*0.020, wD*0.035, -wW*0.28, yF1+f1H*0.38, wD*0.505);
    box("lintel",      "wood_dark", wW*0.58, f1H*0.038, wD*0.04,  wW*0.10,  yF1+f1H*0.74,  wD*0.505);

    // ── Low eave / ひさし ─────────────────────────────────────────────────────
    box("eave_low",    "tile_roof",  eW,       eave1H,       eD,         0, yEav1+eave1H*0.50, 0);
    box("eave_soffit", "wood_light", eW*0.96,  eave1H*0.18,  eD*0.96,    0, yEav1+eave1H*0.09, 0);

    // ── Second floor body ─────────────────────────────────────────────────────
    box("wall_f2", "plaster_white", f2W, f2H, f2D, 0, yF2 + f2H*0.5, 0);

    // ── Corner posts 2F ───────────────────────────────────────────────────────
    for (const [sx, sz] of [[-1,-1],[-1,1],[1,-1],[1,1]]) {
      box(`post2_${sx<0?"L":"R"}${sz<0?"B":"F"}`, "wood_dark",
        pW*0.85, f2H*1.04, pW*0.85,
        sx*(f2W*0.50+pW*0.22), yF2+f2H*0.52, sz*(f2D*0.50+pW*0.22));
    }

    // ── 2F front shoji windows ────────────────────────────────────────────────
    box("shoji_f2_L",     "shoji",    f2W*0.30, f2H*0.50, f2D*0.03, -f2W*0.28, yF2+f2H*0.42, f2D*0.505);
    box("shoji_f2_C",     "shoji",    f2W*0.18, f2H*0.50, f2D*0.03,  0,         yF2+f2H*0.42, f2D*0.505);
    box("shoji_f2_R",     "shoji",    f2W*0.30, f2H*0.50, f2D*0.03,  f2W*0.28,  yF2+f2H*0.42, f2D*0.505);
    box("shoji2_bar_top", "wood_dark", f2W*0.86, f2H*0.022, f2D*0.04, 0, yF2+f2H*0.68, f2D*0.505);
    box("shoji2_bar_bot", "wood_dark", f2W*0.86, f2H*0.022, f2D*0.04, 0, yF2+f2H*0.20, f2D*0.505);

    // ── Hip roof (寄棟造) — three stacked layers + ridge ──────────────────────
    box("roof_eave",   "tile_roof",  rW1,       roofH*0.28, rD1,       0, yRoof+roofH*0.14, 0);
    box("roof_mid",    "tile_roof",  rW2,       roofH*0.38, rD2*0.96,  0, yRoof+roofH*0.47, 0);
    box("roof_cap",    "tile_roof",  rW2*0.62,  roofH*0.26, rD2*0.62,  0, yRoof+roofH*0.79, 0);
    box("ridge",       "tile_ridge", rW2*0.58,  roofH*0.06, Hw*0.055,  0, yRoof+roofH*0.96, 0);
    box("onigawara_L", "tile_ridge", Hw*0.07,   roofH*0.09, Hw*0.055, -rW2*0.29, yRoof+roofH*0.97, 0);
    box("onigawara_R", "tile_ridge", Hw*0.07,   roofH*0.09, Hw*0.055,  rW2*0.29, yRoof+roofH*0.97, 0);
    // Hip-corner rafter lines (斜めの流れ)
    for (const [sx, sz] of [[-1,-1],[-1,1],[1,-1],[1,1]]) {
      box(`hip_${sx<0?"L":"R"}${sz<0?"B":"F"}`, "tile_roof",
        Hw*0.055, roofH*0.52, rD1*0.38,
        sx*rW1*0.37, yRoof+roofH*0.50, sz*rD1*0.18);
    }

    // ── Railing on engawa (縁側手すり) ────────────────────────────────────────
    box("railing_front", "wood_dark", eW*0.88, Hw*0.032, Hw*0.025, 0, yF1+Hw*0.13, wD*0.60);

    // Surface details
    const jpRegions   = ["facade", "roof", "engawa", "window", "entrance"];
    const jpDetailTypes = ["wood_grain", "tile_texture", "plaster_texture", "shoji_grid", "panel_seam"];
    let jpIdx = 1;
    for (const region of jpRegions) {
      for (let i = 0; i < 8; i++) {
        pushSurface(`sd_${jpIdx++}`, region, jpDetailTypes[i % jpDetailTypes.length],
          0.12 + (i%5)*0.05,
          [Math.sin(i*0.9)*0.015, Math.cos(i*0.7)*0.012, ((i%4)-1.5)*0.010]);
      }
    }

    spec.parts = parts;
    spec.surfaceDetails = surfaceDetails;
    return spec;
  }
  // ── END house_jp override ────────────────────────────────────────────────────

  // ── Modern house archetype ───────────────────────────────────────────────────
  if (archetype === "house_modern") {
    const Hw = Math.min(H, 8.5);

    spec.materials = {
      concrete:     { baseColor: "#C0C8CA", roughness: 0.88, metalness: 0.04 },
      wall_main:    { baseColor: "#EDEEF0", roughness: 0.86, metalness: 0.01 },
      wall_dark:    { baseColor: "#2E3234", roughness: 0.90, metalness: 0.02 },
      wall_wood:    { baseColor: "#8D6E4A", roughness: 0.82, metalness: 0.02 },
      glass_win:    { baseColor: "#7AB8D8", roughness: 0.08, metalness: 0.88 },
      glass_dark:   { baseColor: "#2A4860", roughness: 0.10, metalness: 0.90 },
      steel_frame:  { baseColor: "#8A9298", roughness: 0.38, metalness: 0.80 },
      steel_dark:   { baseColor: "#3A4042", roughness: 0.42, metalness: 0.84 },
      door_main:    { baseColor: "#1E2628", roughness: 0.55, metalness: 0.42 },
      roof_flat:    { baseColor: "#8A9298", roughness: 0.86, metalness: 0.06 },
      parapet:      { baseColor: "#DADEE0", roughness: 0.86, metalness: 0.02 },
      louvre:       { baseColor: "#8A9298", roughness: 0.40, metalness: 0.72 },
      paving:       { baseColor: "#A4AEB0", roughness: 0.92, metalness: 0.02 },
      fence:        { baseColor: "#C4CCCC", roughness: 0.88, metalness: 0.04 },
    };

    // ── Vertical zones ────────────────────────────────────────────────────────
    const baseH    = Hw * 0.050;  // concrete plinth
    const f1H      = Hw * 0.375;  // 1F walls
    const slabH    = Hw * 0.038;  // inter-floor slab
    const f2H      = Hw * 0.325;  // 2F walls
    const parapetH = Hw * 0.062;  // parapet
    const copeH    = Hw * 0.014;  // coping

    const yF1   = baseH;
    const ySlab = yF1   + f1H;
    const yF2   = ySlab + slabH;
    const yPar  = yF2   + f2H;
    const yCope = yPar  + parapetH;

    // ── Plan dimensions ───────────────────────────────────────────────────────
    const mW = Hw * 1.10;   // main body width
    const mD = Hw * 0.94;   // main body depth
    const gW = Hw * 0.44;   // garage width (left side)
    const gH = f1H + slabH; // garage height = single storey
    const gX = -(mW * 0.5 + gW * 0.5);  // garage center X

    spec.globalScale = { height: Hw, width: rounded((mW + gW) * 1.02), depth: rounded(mD * 1.04) };

    // ── Foundation plinth ─────────────────────────────────────────────────────
    box("plinth_main",   "concrete", mW,           baseH, mD, 0,  baseH*0.5, 0);
    box("plinth_garage", "concrete", gW+Hw*0.02,   baseH, mD, gX, baseH*0.5, 0);

    // ── 1F main body ──────────────────────────────────────────────────────────
    box("f1_body",   "wall_main", mW, f1H, mD, 0,  yF1+f1H*0.5, 0);

    // ── Garage body (single storey, white wall) ───────────────────────────────
    box("garage_body", "wall_main", gW, gH, mD, gX, yF1+gH*0.5, 0);

    // ── Inter-floor slab band (visible front edge) ────────────────────────────
    box("slab_band", "concrete", mW, slabH, mD*1.01, 0, ySlab+slabH*0.5, 0);

    // ── 2F body — three horizontal panels: wood / dark / white ───────────────
    // Panels span full mW: wood 15% | dark 30% | white 55%
    box("f2_wood_panel", "wall_wood", mW*0.15, f2H, mD, -mW*0.425, yF2+f2H*0.5, 0);
    box("f2_dark_panel", "wall_dark", mW*0.30, f2H, mD, -mW*0.200, yF2+f2H*0.5, 0);
    box("f2_right",      "wall_main", mW*0.55, f2H, mD,  mW*0.225, yF2+f2H*0.5, 0);

    // ── Garage flat roof ──────────────────────────────────────────────────────
    box("garage_roof", "roof_flat", gW+Hw*0.04, slabH*0.80, mD+Hw*0.04, gX, ySlab+slabH*0.40, 0);

    // ── Roof deck (flat roof of main body) ────────────────────────────────────
    box("roof_deck", "roof_flat", mW, slabH*0.70, mD, 0, yPar-slabH*0.35, 0);

    // ── Parapet (4 sides) ─────────────────────────────────────────────────────
    const pT = Hw * 0.030;  // parapet thickness
    box("parapet_front", "parapet", mW+pT*2, parapetH, pT,    0,       yPar+parapetH*0.5,  mD*0.5+pT*0.5);
    box("parapet_back",  "parapet", mW+pT*2, parapetH, pT,    0,       yPar+parapetH*0.5, -mD*0.5-pT*0.5);
    box("parapet_L",     "parapet", pT,       parapetH, mD,   -mW*0.5, yPar+parapetH*0.5, 0);
    box("parapet_R",     "parapet", pT,       parapetH, mD,    mW*0.5, yPar+parapetH*0.5, 0);

    // ── Parapet coping (steel cap strip) ──────────────────────────────────────
    const co = Hw * 0.010;
    box("cope_front", "steel_frame", mW+pT*2+co*2, copeH, pT+co*2,  0,       yCope+copeH*0.5,  mD*0.5+pT*0.5);
    box("cope_back",  "steel_frame", mW+pT*2+co*2, copeH, pT+co*2,  0,       yCope+copeH*0.5, -mD*0.5-pT*0.5);
    box("cope_L",     "steel_frame", pT+co*2,       copeH, mD+co*2, -mW*0.5, yCope+copeH*0.5, 0);
    box("cope_R",     "steel_frame", pT+co*2,       copeH, mD+co*2,  mW*0.5, yCope+copeH*0.5, 0);

    // ── Entrance canopy ───────────────────────────────────────────────────────
    const cX  = mW * 0.18;   // slightly right of center
    const cW  = mW * 0.42;
    const cY  = yF1 + f1H * 0.76;
    box("canopy",           "concrete",   cW,       slabH*0.65, Hw*0.30, cX,          cY,        mD*0.5+Hw*0.15);
    box("canopy_support_L", "steel_dark", Hw*0.018, cY,         Hw*0.018, cX-cW*0.42, cY*0.5,    mD*0.5+Hw*0.06);
    box("canopy_support_R", "steel_dark", Hw*0.018, cY,         Hw*0.018, cX+cW*0.42, cY*0.5,    mD*0.5+Hw*0.06);

    // ── Entry steps ───────────────────────────────────────────────────────────
    box("step_1", "paving", cW*0.85, baseH*1.5, Hw*0.12, cX, baseH*0.75, mD*0.5+Hw*0.20);
    box("step_2", "paving", cW*0.75, baseH*0.9, Hw*0.10, cX, baseH*0.45, mD*0.5+Hw*0.32);

    // ── Entry door + sidelights ───────────────────────────────────────────────
    box("entry_frame",  "steel_frame", Hw*0.200, f1H*0.77, Hw*0.028, cX,           yF1+f1H*0.39, mD*0.504);
    box("entry_door",   "door_main",   Hw*0.135, f1H*0.74, Hw*0.030, cX,           yF1+f1H*0.38, mD*0.506);
    box("sidelight_L",  "glass_win",   Hw*0.052, f1H*0.66, Hw*0.030, cX-Hw*0.108, yF1+f1H*0.38, mD*0.506);
    box("sidelight_R",  "glass_win",   Hw*0.052, f1H*0.66, Hw*0.030, cX+Hw*0.108, yF1+f1H*0.38, mD*0.506);

    // ── 1F large curtain-wall window (living/dining, left zone) ───────────────
    const wLX = -mW * 0.30;
    box("f1_win_L",       "glass_win",   mW*0.38, f1H*0.60, Hw*0.030, wLX, yF1+f1H*0.46, mD*0.508);
    box("f1_win_frame_L", "steel_frame", mW*0.40, f1H*0.62, Hw*0.026, wLX, yF1+f1H*0.46, mD*0.506);

    // ── 1F right small window ─────────────────────────────────────────────────
    box("f1_win_R",       "glass_win",   mW*0.18, f1H*0.44, Hw*0.030, mW*0.36, yF1+f1H*0.44, mD*0.508);
    box("f1_win_frame_R", "steel_frame", mW*0.20, f1H*0.46, Hw*0.026, mW*0.36, yF1+f1H*0.44, mD*0.506);

    // ── Garage door (horizontal panel style) ──────────────────────────────────
    const gdZ = mD*0.5 + Hw*0.012;
    const gdH = gH * 0.62;
    box("garage_door",        "steel_dark",  gW*0.80, gdH,       Hw*0.026, gX, yF1+gdH*0.50,    gdZ);
    box("garage_door_seam_1", "steel_frame", gW*0.80, gH*0.025,  Hw*0.028, gX, yF1+gdH*0.25,    gdZ);
    box("garage_door_seam_2", "steel_frame", gW*0.80, gH*0.025,  Hw*0.028, gX, yF1+gdH*0.50,    gdZ);
    box("garage_door_seam_3", "steel_frame", gW*0.80, gH*0.025,  Hw*0.028, gX, yF1+gdH*0.75,    gdZ);

    // ── 2F balcony (front, above living area) ─────────────────────────────────
    const bkW = mW * 0.40;
    const bkX = -mW * 0.10;
    box("balcony_slab",       "concrete",    bkW,      slabH*0.85, Hw*0.28,  bkX,         yF2+slabH*0.43, mD*0.5+Hw*0.14);
    box("balcony_rail_front", "steel_frame", bkW,      Hw*0.050,   Hw*0.018, bkX,         yF2+Hw*0.100,   mD*0.5+Hw*0.27);
    box("balcony_rail_L",     "steel_frame", Hw*0.018, Hw*0.050,   Hw*0.28,  bkX-bkW*0.5, yF2+Hw*0.100,   mD*0.5+Hw*0.14);
    box("balcony_rail_R",     "steel_frame", Hw*0.018, Hw*0.050,   Hw*0.28,  bkX+bkW*0.5, yF2+Hw*0.100,   mD*0.5+Hw*0.14);

    // ── 2F front windows ──────────────────────────────────────────────────────
    box("f2_win_L",       "glass_win",   mW*0.30, f2H*0.56, Hw*0.030, -mW*0.26, yF2+f2H*0.44, mD*0.508);
    box("f2_win_C",       "glass_dark",  mW*0.20, f2H*0.56, Hw*0.030,  mW*0.03, yF2+f2H*0.44, mD*0.508);
    box("f2_win_R",       "glass_win",   mW*0.20, f2H*0.48, Hw*0.030,  mW*0.32, yF2+f2H*0.40, mD*0.508);
    box("f2_win_frame_L", "steel_frame", mW*0.32, f2H*0.58, Hw*0.026, -mW*0.26, yF2+f2H*0.44, mD*0.506);
    box("f2_win_frame_C", "steel_frame", mW*0.22, f2H*0.58, Hw*0.026,  mW*0.03, yF2+f2H*0.44, mD*0.506);
    box("f2_win_frame_R", "steel_frame", mW*0.22, f2H*0.50, Hw*0.026,  mW*0.32, yF2+f2H*0.40, mD*0.506);

    // ── Horizontal louvres (sun-shading over 1F large window) ─────────────────
    for (let li = 0; li < 5; li++) {
      box(`louvre_${li+1}`, "louvre", mW*0.44, Hw*0.012, Hw*0.10,
        wLX, yF1+f1H*0.76+li*Hw*0.018, mD*0.5+Hw*0.055);
    }

    // ── AC unit on roof ───────────────────────────────────────────────────────
    box("ac_unit", "steel_dark", Hw*0.14, Hw*0.070, Hw*0.18, mW*0.34, yPar+Hw*0.035, -mD*0.28);

    // ── Front yard fence & gate posts ─────────────────────────────────────────
    box("fence_L",     "fence",    Hw*0.014, Hw*0.090, mD*0.36, gX-gW*0.36,  Hw*0.045, mD*0.32);
    box("fence_R",     "fence",    Hw*0.014, Hw*0.090, mD*0.24, mW*0.50,     Hw*0.045, mD*0.12);
    box("gate_post_L", "concrete", Hw*0.044, Hw*0.115, Hw*0.044, gX-gW*0.10, Hw*0.058, mD*0.5+Hw*0.10);
    box("gate_post_R", "concrete", Hw*0.044, Hw*0.115, Hw*0.044, mW*0.44,    Hw*0.058, mD*0.5+Hw*0.10);
    box("paving_front","paving",   mW*0.30,  baseH*0.28, Hw*0.52, cX,        baseH*0.14, mD*0.5+Hw*0.26);

    // ── Surface details ───────────────────────────────────────────────────────
    const modRegions     = ["facade", "roof", "garage", "window", "balcony", "entrance"];
    const modDetailTypes = ["panel_seam", "concrete_texture", "metal_panel", "window_grid", "wood_grain", "weathering"];
    let modIdx = 1;
    for (const region of modRegions) {
      for (let i = 0; i < 7; i++) {
        pushSurface(`sd_${modIdx++}`, region, modDetailTypes[i % modDetailTypes.length],
          0.10 + (i % 5) * 0.04,
          [Math.sin(i * 0.9) * 0.014, Math.cos(i * 0.7) * 0.011, ((i % 4) - 1.5) * 0.009]);
      }
    }

    spec.parts = parts;
    spec.surfaceDetails = surfaceDetails;
    return spec;
  }
  // ── END house_modern override ────────────────────────────────────────────────

  // ── 大邸宅: 和風平屋建て (Japanese grand estate, single-story) ───────────────
  if (archetype === "mansion_estate") {
    // Override materials to Japanese wood / tile palette
    spec.materials = {
      wood_main:    { baseColor: "#7A5230", roughness: 0.82, metalness: 0.02 },
      wood_dark:    { baseColor: "#4A2E12", roughness: 0.88, metalness: 0.01 },
      wood_deck:    { baseColor: "#8C6238", roughness: 0.78, metalness: 0.02 },
      roof_tile:    { baseColor: "#2E2A28", roughness: 0.80, metalness: 0.08 },
      roof_copper:  { baseColor: "#5A8060", roughness: 0.55, metalness: 0.55 },
      shoji:        { baseColor: "#E8E4D8", roughness: 0.95, metalness: 0.00 },
      stone_wall:   { baseColor: "#9A9488", roughness: 0.94, metalness: 0.03 },
      stone_ground: { baseColor: "#B4B0A4", roughness: 0.96, metalness: 0.01 },
      gravel:       { baseColor: "#D0CCC0", roughness: 0.98, metalness: 0.00 },
      pond:         { baseColor: "#3A6878", roughness: 0.12, metalness: 0.80 },
    };

    // Dimensions — site scales with H (default H=90 → site ~50m × 40m)
    const siteW   = rounded(H * 0.56);   // site width
    const siteD   = rounded(H * 0.44);   // site depth
    const wallH   = 1.8;                 // 塀 height
    const wallT   = 0.35;                // 塀 thickness
    const gateW   = 4.0;                 // 門 opening width
    const gateH   = 2.8;                 // 門 post height
    const bodyH   = 3.0;                 // house wall height (平屋)
    const eaveT   = 0.18;                // eave slab thickness
    const eaveOv  = 1.2;                 // eave overhang each side
    const ridgeH  = 1.6;                 // ridge (tri_prism) height
    const foundH  = 0.4;                 // foundation stone height

    // Site layout:
    //   +Z = front (street side / 門)
    //   -Z = back  (garden side)
    //   center = (0, 0, 0)

    // ── 敷地 (site base: gravel) ─────────────────────────────────────────────
    box("site_gravel",   "gravel",       siteW - wallT*2, 0.20, siteD - wallT*2, 0, 0.10, 0);

    // ── 母屋 (main building) ─────────────────────────────────────────────────
    const mW = rounded(siteW * 0.50);    // 母屋 width
    const mD = rounded(siteD * 0.42);    // 母屋 depth
    const mZ = -siteD * 0.04;            // slightly back of center
    const mY0 = foundH;                  // floor level

    // Foundation plinth
    box("main_found",    "stone_wall",   mW + 0.4, foundH, mD + 0.4,  0,  foundH*0.5,  mZ);
    // Wall body
    box("main_body",     "wood_main",    mW,        bodyH,  mD,         0,  mY0+bodyH*0.5, mZ);
    // Shoji panels (front face)
    box("shoji_front",   "shoji",        mW*0.72,   bodyH*0.68, 0.12,   0,  mY0+bodyH*0.46, mZ + mD*0.5);
    // Shoji panels (back face)
    box("shoji_back",    "shoji",        mW*0.60,   bodyH*0.60, 0.12,   0,  mY0+bodyH*0.44, mZ - mD*0.5);
    // Lower eave slab
    const rW = mW + eaveOv*2;
    const rD = mD + eaveOv*2;
    const eaveY = mY0 + bodyH;
    box("main_eave",     "roof_tile",    rW, eaveT, rD,   0, eaveY + eaveT*0.5, mZ);
    // Ridge (入母屋 upper)
    shape("main_ridge",  "tri_prism", "roof_tile", mW*0.96, ridgeH, mD*0.94,
      0, eaveY + eaveT + ridgeH*0.5, mZ);
    // Copper ridge cap
    box("ridge_cap",     "roof_copper",  mW*0.90, 0.14, 0.20,  0, eaveY + eaveT + ridgeH - 0.06, mZ);

    // ── 縁側 (engawa — wooden veranda, front) ────────────────────────────────
    const engW = mW * 0.90;
    const engD = 1.2;
    const engZ = mZ + mD*0.5 + engD*0.5;
    box("engawa_deck",   "wood_deck",    engW, 0.22, engD,   0, mY0 - 0.06, engZ);
    // Engawa roof (shallow lean-to)
    box("engawa_eave",   "roof_tile",    engW + eaveOv, eaveT, engD + 0.4,
      0, eaveY + eaveT*0.5 - 0.25, engZ + 0.1);

    // ── 離れ (secondary wing — east side) ────────────────────────────────────
    const swW = rounded(siteW * 0.18);
    const swD = rounded(mD * 0.62);
    const swX = mW*0.5 + swW*0.5 + 0.8;
    box("south_found",   "stone_wall",   swW+0.3, foundH, swD+0.3,  swX, foundH*0.5, mZ);
    box("south_body",    "wood_main",    swW,      bodyH*0.88, swD,  swX, mY0+bodyH*0.44, mZ);
    box("south_shoji",   "shoji",        swW*0.68, bodyH*0.60, 0.10, swX, mY0+bodyH*0.40, mZ+swD*0.5);
    box("south_eave",    "roof_tile",    swW+eaveOv*1.4, eaveT, swD+eaveOv,
      swX, mY0+bodyH*0.88+eaveT*0.5, mZ);
    shape("south_ridge", "tri_prism",    "roof_tile", swW*0.90, ridgeH*0.75, swD*0.88,
      swX, mY0+bodyH*0.88+eaveT+ridgeH*0.375, mZ);

    // ── 塀 (perimeter walls) ─────────────────────────────────────────────────
    const fZ = siteD*0.5 - wallT*0.5;     // front wall Z center
    const bZ = -siteD*0.5 + wallT*0.5;    // back wall Z center
    const lX = -siteW*0.5 + wallT*0.5;    // left wall X center
    const rX =  siteW*0.5 - wallT*0.5;    // right wall X center

    // Back wall
    box("wall_back",     "stone_wall",   siteW, wallH, wallT,  0,    wallH*0.5, bZ);
    // East wall
    box("wall_east",     "stone_wall",   wallT, wallH, siteD, rX,   wallH*0.5, 0);
    // West wall
    box("wall_west",     "stone_wall",   wallT, wallH, siteD, lX,   wallH*0.5, 0);
    // Front wall left segment (西側)
    const gapHalf = gateW*0.5 + wallT;
    const fSegW = (siteW - gateW)*0.5 - wallT;
    box("wall_front_W",  "stone_wall",   fSegW, wallH, wallT, -(gateW*0.5 + fSegW*0.5), wallH*0.5, fZ);
    // Front wall right segment (東側)
    box("wall_front_E",  "stone_wall",   fSegW, wallH, wallT,  (gateW*0.5 + fSegW*0.5), wallH*0.5, fZ);
    // 塀の瓦笠木 (tile coping on walls)
    box("cope_back",     "roof_tile",    siteW+0.1, 0.12, wallT+0.1,    0,    wallH+0.06, bZ);
    box("cope_east",     "roof_tile",    wallT+0.1, 0.12, siteD+0.1,   rX,   wallH+0.06, 0);
    box("cope_west",     "roof_tile",    wallT+0.1, 0.12, siteD+0.1,   lX,   wallH+0.06, 0);
    box("cope_front_W",  "roof_tile",    fSegW+0.1, 0.12, wallT+0.1, -(gateW*0.5+fSegW*0.5), wallH+0.06, fZ);
    box("cope_front_E",  "roof_tile",    fSegW+0.1, 0.12, wallT+0.1,  (gateW*0.5+fSegW*0.5), wallH+0.06, fZ);

    // ── 門 (gate) ────────────────────────────────────────────────────────────
    box("gate_post_W",   "wood_dark",    0.28, gateH, 0.28, -gateW*0.5+0.14, gateH*0.5,  fZ);
    box("gate_post_E",   "wood_dark",    0.28, gateH, 0.28,  gateW*0.5-0.14, gateH*0.5,  fZ);
    box("gate_lintel",   "wood_dark",    gateW+0.28, 0.24, 0.36, 0, gateH+0.12, fZ);
    box("gate_nagedashi","roof_tile",    gateW+0.80, 0.16, 0.60, 0, gateH+0.32, fZ);
    shape("gate_roof",   "tri_prism",    "roof_tile", gateW+0.60, 0.65, 0.55,
      0, gateH+0.49, fZ);

    // ── 庭 (garden — rear area) ──────────────────────────────────────────────
    const gardenZ = -siteD*0.28;
    // 池 (pond)
    box("pond",          "pond",         siteW*0.16, 0.18, siteD*0.10,  siteW*0.10, 0.09, gardenZ);
    // 石灯籠 (stone lantern base + body + cap)
    box("lantern_base",  "stone_wall",   0.50, 0.20, 0.50,  -siteW*0.16, 0.10, gardenZ);
    box("lantern_body",  "stone_wall",   0.28, 0.80, 0.28,  -siteW*0.16, 0.60, gardenZ);
    box("lantern_cap",   "stone_wall",   0.54, 0.18, 0.54,  -siteW*0.16, 1.09, gardenZ);
    // 松 (pine tree trunk + canopy)
    shape("pine_trunk",  "cylinder",  "wood_dark", 0.30, 3.8, 0.30,
      siteW*0.16, 1.9, gardenZ - siteD*0.06);
    shape("pine_canopy", "sphere",    "wood_main", 3.0, 2.4, 3.0,
      siteW*0.16, 4.8, gardenZ - siteD*0.06);
    // 飛び石 (stepping stones, from gate to entrance)
    for (let i = 0; i < 6; i++) {
      box(`step_${i}`,   "stone_ground", 0.55, 0.10, 0.42,
        (i%2===0 ? -0.3 : 0.3), 0.30, fZ - 1.0 - i*1.6);
    }

    // ── Surface details ───────────────────────────────────────────────────────
    const estRegions  = ["main_body", "roof", "wall", "engawa", "garden"];
    const estTypes    = ["wood_grain", "tile_seam", "weathering", "trim_line", "panel_seam"];
    let sdIdx = 1;
    for (const region of estRegions) {
      for (let i = 0; i < 8; i++) {
        pushSurface(`sd_${sdIdx++}`, region, estTypes[i % estTypes.length],
          0.12 + (i % 5) * 0.04,
          [Math.sin(i*0.9)*0.014, Math.cos(i*0.7)*0.011, ((i%4)-1.5)*0.009]);
      }
    }

    spec.globalScale = { height: rounded(mY0+bodyH+eaveT+ridgeH), width: siteW, depth: siteD };
    spec.parts = parts;
    spec.surfaceDetails = surfaceDetails;
    return spec;
  }
  // ── END mansion_estate override ──────────────────────────────────────────────

  // ── Modern apartment archetype ───────────────────────────────────────────────
  if (archetype === "apartment_mid" || archetype === "apartment_2f") {
    const Hw = Math.min(H, 14);

    spec.materials = {
      concrete:    { baseColor: "#C4C8CA", roughness: 0.88, metalness: 0.04 },
      wall_main:   { baseColor: "#EAECEE", roughness: 0.86, metalness: 0.01 },
      wall_accent: { baseColor: "#2C3034", roughness: 0.90, metalness: 0.02 },
      slab_band:   { baseColor: "#B0B8BA", roughness: 0.90, metalness: 0.03 },
      glass_win:   { baseColor: "#7ABCD8", roughness: 0.08, metalness: 0.88 },
      glass_lobby: { baseColor: "#5AA0C0", roughness: 0.06, metalness: 0.92 },
      steel_frame: { baseColor: "#8A9298", roughness: 0.38, metalness: 0.80 },
      steel_dark:  { baseColor: "#3A4042", roughness: 0.42, metalness: 0.84 },
      balk_slab:   { baseColor: "#B8BCBE", roughness: 0.88, metalness: 0.04 },
      rail_steel:  { baseColor: "#90989C", roughness: 0.36, metalness: 0.82 },
      roof_flat:   { baseColor: "#8A9298", roughness: 0.86, metalness: 0.06 },
      parapet:     { baseColor: "#D8DCDE", roughness: 0.86, metalness: 0.02 },
      door_auto:   { baseColor: "#1E2426", roughness: 0.52, metalness: 0.44 },
      mailbox:     { baseColor: "#5A6268", roughness: 0.50, metalness: 0.60 },
      paving:      { baseColor: "#A4AEB0", roughness: 0.92, metalness: 0.02 },
    };

    // ── Vertical zones (4 floors) ──────────────────────────────────────────
    const baseH    = Hw * 0.028;
    const floorH   = Hw * 0.215;  // per floor
    const slabH    = Hw * 0.020;  // inter-floor slab
    const parapetH = Hw * 0.033;
    const copeH    = Hw * 0.009;

    const yF1   = baseH;
    const ySlb1 = yF1   + floorH;
    const yF2   = ySlb1 + slabH;
    const ySlb2 = yF2   + floorH;
    const yF3   = ySlb2 + slabH;
    const ySlb3 = yF3   + floorH;
    const yF4   = ySlb3 + slabH;
    const yPar  = yF4   + floorH;
    const yCope = yPar  + parapetH;

    // ── Plan (3 bays) ─────────────────────────────────────────────────────
    const bW   = Hw * 1.60;
    const bD   = Hw * 0.52;
    const bayW = bW / 3;

    spec.globalScale = { height: Hw, width: rounded(bW * 1.04), depth: rounded(bD * 1.04) };

    // ── Plinth ────────────────────────────────────────────────────────────
    box("plinth", "concrete", bW + Hw*0.04, baseH, bD + Hw*0.04, 0, baseH*0.5, 0);

    // ── Wall: vertical dark accent strips (L/R edges) + white body ────────
    const accW  = Hw * 0.042;
    const wallH = yPar - yF1;
    box("accent_L",  "wall_accent", accW,         wallH, bD, -bW*0.5 + accW*0.5, yF1+wallH*0.5, 0);
    box("accent_R",  "wall_accent", accW,         wallH, bD,  bW*0.5 - accW*0.5, yF1+wallH*0.5, 0);
    box("body_main", "wall_main",   bW - accW*2,  wallH, bD,  0,                 yF1+wallH*0.5, 0);

    // ── Inter-floor slab bands ────────────────────────────────────────────
    box("slab_1", "slab_band", bW+Hw*0.02, slabH, bD+Hw*0.02, 0, ySlb1+slabH*0.5, 0);
    box("slab_2", "slab_band", bW+Hw*0.02, slabH, bD+Hw*0.02, 0, ySlb2+slabH*0.5, 0);
    box("slab_3", "slab_band", bW+Hw*0.02, slabH, bD+Hw*0.02, 0, ySlb3+slabH*0.5, 0);

    // ── Parapet (4 sides) + coping + roof deck ────────────────────────────
    const pT = Hw * 0.026;
    box("parapet_front", "parapet",     bW+pT*2, parapetH, pT,  0,       yPar+parapetH*0.5,  bD*0.5+pT*0.5);
    box("parapet_back",  "parapet",     bW+pT*2, parapetH, pT,  0,       yPar+parapetH*0.5, -bD*0.5-pT*0.5);
    box("parapet_L",     "parapet",     pT,       parapetH, bD, -bW*0.5, yPar+parapetH*0.5, 0);
    box("parapet_R",     "parapet",     pT,       parapetH, bD,  bW*0.5, yPar+parapetH*0.5, 0);
    box("cope_front",    "steel_frame", bW+pT*2+Hw*0.01, copeH, pT+Hw*0.01, 0, yCope+copeH*0.5, bD*0.5+pT*0.5);
    box("roof_deck",     "roof_flat",   bW, slabH*0.60, bD, 0, yPar-slabH*0.30, 0);

    // ── Entrance lobby (center bay, 1F) ───────────────────────────────────
    const lobW = bayW * 0.72;
    const lobH = floorH * 0.76;
    const canY = yF1 + floorH * 0.82;
    box("lobby_frame",  "steel_dark",  lobW+Hw*0.030, lobH+Hw*0.018, Hw*0.028, 0, yF1+lobH*0.5,  bD*0.504);
    box("lobby_glass",  "glass_lobby", lobW,          lobH,          Hw*0.030, 0, yF1+lobH*0.5,  bD*0.508);
    box("lobby_canopy", "concrete",    lobW+bayW*0.20, slabH*0.60, Hw*0.28,   0, canY,           bD*0.5+Hw*0.14);
    box("canopy_sup_L", "steel_dark",  Hw*0.016, canY, Hw*0.016, -(lobW*0.5+bayW*0.05), canY*0.5, bD*0.5+Hw*0.06);
    box("canopy_sup_R", "steel_dark",  Hw*0.016, canY, Hw*0.016,  (lobW*0.5+bayW*0.05), canY*0.5, bD*0.5+Hw*0.06);

    // ── Entry steps ───────────────────────────────────────────────────────
    box("step_1", "paving", lobW*1.10, baseH*1.6, Hw*0.10, 0, baseH*0.80, bD*0.5+Hw*0.18);
    box("step_2", "paving", lobW*0.90, baseH*0.9, Hw*0.08, 0, baseH*0.45, bD*0.5+Hw*0.28);

    // ── Mailbox unit (right of lobby, 1F) ────────────────────────────────
    box("mailbox_unit", "mailbox", bayW*0.38, floorH*0.50, Hw*0.030, bayW*0.56, yF1+floorH*0.35, bD*0.508);

    // ── 1F side windows (L & R bays; center = lobby) ─────────────────────
    box("f1_win_L",       "glass_win",   bayW*0.52, floorH*0.50, Hw*0.030, -bayW, yF1+floorH*0.45, bD*0.508);
    box("f1_win_frame_L", "steel_frame", bayW*0.55, floorH*0.52, Hw*0.026, -bayW, yF1+floorH*0.45, bD*0.506);
    box("f1_win_R",       "glass_win",   bayW*0.52, floorH*0.50, Hw*0.030,  bayW, yF1+floorH*0.45, bD*0.508);
    box("f1_win_frame_R", "steel_frame", bayW*0.55, floorH*0.52, Hw*0.026,  bayW, yF1+floorH*0.45, bD*0.506);

    // ── 2F–4F windows (3 bays × 3 floors = 18 glass + 18 frames) ─────────
    const upperFloors = [
      { nm: "f2", yF: yF2 },
      { nm: "f3", yF: yF3 },
      { nm: "f4", yF: yF4 },
    ];
    for (const { nm, yF } of upperFloors) {
      for (const [sfx, bx] of [["L", -bayW], ["C", 0], ["R", bayW]]) {
        box(`${nm}_win_${sfx}`,       "glass_win",   bayW*0.52, floorH*0.48, Hw*0.030, bx, yF+floorH*0.44, bD*0.508);
        box(`${nm}_win_frame_${sfx}`, "steel_frame", bayW*0.55, floorH*0.50, Hw*0.026, bx, yF+floorH*0.44, bD*0.506);
      }
    }

    // ── Balconies (2F–4F, full-width slab + rail + end dividers) ──────────
    const balkD = Hw * 0.15;
    for (const { nm, yF } of upperFloors) {
      const by = yF - slabH * 0.10;
      box(`balk_slab_${nm}`,  "balk_slab",  bW*0.92,  slabH*0.80, balkD,    0,          by+slabH*0.40,  bD*0.5+balkD*0.5);
      box(`balk_rail_${nm}`,  "rail_steel",  bW*0.92,  Hw*0.044,   Hw*0.014, 0,          by+Hw*0.088,    bD*0.5+balkD);
      box(`balk_div_L_${nm}`, "concrete",    Hw*0.014, Hw*0.088,   balkD,   -bW*0.5*0.9, by+Hw*0.044,    bD*0.5+balkD*0.5);
      box(`balk_div_R_${nm}`, "concrete",    Hw*0.014, Hw*0.088,   balkD,    bW*0.5*0.9, by+Hw*0.044,    bD*0.5+balkD*0.5);
    }

    // ── Roof AC units + utility ────────────────────────────────────────────
    box("ac_unit_1",    "steel_dark", Hw*0.14, Hw*0.065, Hw*0.18, -bW*0.25,         yPar+Hw*0.033, -bD*0.22);
    box("ac_unit_2",    "steel_dark", Hw*0.14, Hw*0.065, Hw*0.18,  bW*0.20,         yPar+Hw*0.033, -bD*0.22);
    box("utility_pipe", "steel_dark", Hw*0.016, wallH,   Hw*0.016,  bW*0.5-Hw*0.065, yF1+wallH*0.5, -bD*0.30);

    // ── Surface details ───────────────────────────────────────────────────
    const aptRegions     = ["facade", "balcony", "lobby", "window", "roof", "base"];
    const aptDetailTypes = ["panel_seam", "concrete_texture", "glass_reflection", "window_grid", "metal_panel", "weathering"];
    let aptIdx = 1;
    for (const region of aptRegions) {
      for (let i = 0; i < 7; i++) {
        pushSurface(`sd_${aptIdx++}`, region, aptDetailTypes[i % aptDetailTypes.length],
          0.10 + (i % 5) * 0.04,
          [Math.sin(i * 0.9) * 0.014, Math.cos(i * 0.7) * 0.011, ((i % 4) - 1.5) * 0.009]);
      }
    }

    spec.parts = parts;
    spec.surfaceDetails = surfaceDetails;
    return spec;
  }
  // ── END apartment_mid override ───────────────────────────────────────────────

  // ── Generic building geometry ───────────────────────────────────────────────
  box("base", "facade_secondary", width * 1.04, baseHeight, depth * 1.04, 0, baseHeight * 0.5, 0);
  box("body", "facade_main", width, bodyHeight, depth, 0, baseHeight + bodyHeight * 0.5, 0);

  if (false && archetype === "house_jp") {
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
    // position: bottom flush with body top (H - roofHeight), center raised by half the shape height
    shape("roof", "tri_prism", "roof", width * 0.96, roofHeight * 0.62, depth * 0.92, 0, H - roofHeight + roofHeight * 0.62 * 0.5, 0);
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
  const isRunner      = styles.includes("runner") || /marathon|\u30de\u30e9\u30bd\u30f3|\u30e9\u30f3\u30ca\u30fc/iu.test(prompt);
  const isSuit        = styles.includes("suit");
  const isSuitWoman   = isSuit && isWoman;

  // Body proportion scaling
  const scale = isChild ? 0.68 : isElderly ? 0.95 : 1.0;
  const sH = H * scale;

  // Canonical proportions (fraction of total height)
  // Children have larger heads and shorter limbs relative to torso
  const prop = isChild ? {
    headH:   sH * 0.175,  headW:  sH * 0.160,  headD:  sH * 0.140,
    neckH:   sH * 0.032,  neckR:  sH * 0.028,
    torsoH:  sH * 0.295,  torsoW: sH * 0.230,  torsoD: sH * 0.130,
    hipH:    sH * 0.110,  hipW:   sH * 0.210,  hipD:   sH * 0.120,
    upperAH: sH * 0.140,  upperAW:sH * 0.068,  upperAD:sH * 0.062,
    lowerAH: sH * 0.125,  lowerAW:sH * 0.054,  lowerAD:sH * 0.048,
    handH:   sH * 0.052,  handW:  sH * 0.055,  handD:  sH * 0.026,
    thighH:  sH * 0.210,  thighW: sH * 0.088,  thighD: sH * 0.085,
    shinH:   sH * 0.185,  shinW:  sH * 0.066,  shinD:  sH * 0.062,
    footH:   sH * 0.038,  footW:  sH * 0.064,  footD:  sH * 0.130
  } : {
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
  const topMat     = isPolice || isFirefighter ? "uniform_main" : isNurse || isDoctor ? (isNurse ? "uniform_main" : "coat") : isChild ? "shirt" : "clothing_main";
  const bottomMat  = isPolice || isFirefighter ? "uniform_main" : isDoctor ? "scrubs" : isNurse ? "uniform_main" : isChild ? "pants" : "clothing_main";
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

  // (child backpack removed)

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
  if (!isPolice && !isFirefighter && !isChild) {
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


  // ── SUIT WOMAN OVERRIDE ────────────────────────────────────────────────────
  if (isSuitWoman) {
    parts.length = 0;
    surfaceDetails.length = 0;

    spec.promptInterpretation.humanType = "suited_woman";
    spec.style.bodyLanguage = "standing_confident_feminine";

    const skirtH  = prop.hipH + prop.thighH;
    const skirtCY = yThigh + skirtH * 0.5;

    // ── Heeled shoes ──────────────────────────────────────────────────────────
    for (const side of ["L", "R"]) {
      const sx = side === "L" ? -prop.footW * 0.48 : prop.footW * 0.48;
      box(`foot_${side}`,     "heel_shoe", prop.footW * 0.88, prop.footH * 0.65, prop.footD * 0.92, sx, yFoot + prop.footH * 0.40, prop.footD * 0.08);
      box(`shoe_toe_${side}`, "heel_shoe", prop.footW * 0.52, prop.footH * 0.28, prop.footD * 0.26, sx, yFoot + prop.footH * 0.16, prop.footD * 0.50);
      box(`heel_${side}`,     "heel_shoe", prop.footW * 0.18, prop.footH * 1.50, prop.footD * 0.16, sx, yFoot + prop.footH * 0.75, -prop.footD * 0.36);
      box(`sole_${side}`,     "shoe_sole", prop.footW * 0.90, prop.footH * 0.10, prop.footD * 0.94, sx, yFoot + prop.footH * 0.05, prop.footD * 0.08);
    }

    // ── Legs (slender, visible below skirt) ───────────────────────────────────
    for (const side of ["L", "R"]) {
      const sx = side === "L" ? -prop.thighW * 0.42 : prop.thighW * 0.42;
      shape(`shin_${side}`, "cylinder", "skin", prop.shinW * 0.75, prop.shinH,        prop.shinD * 0.75, sx, yShin  + prop.shinH  * 0.5,   0);
      shape(`knee_${side}`, "sphere",   "skin", prop.shinW * 0.70, prop.shinW * 0.70, prop.shinD * 0.70, sx, yThigh - prop.shinW  * 0.28,   0);
    }

    // ── Skirt (pencil/A-line, knee-length) ────────────────────────────────────
    box("skirt_body", "skirt",      prop.hipW * 1.04, skirtH,          prop.hipD * 1.00, 0, skirtCY, 0);
    box("skirt_slit", "skirt_dark", prop.hipW * 0.06, skirtH * 0.22,   prop.hipD * 0.04, 0, skirtCY - skirtH * 0.24, prop.hipD * 0.52);

    // ── Blouse ───────────────────────────────────────────────────────────────
    box("blouse_front",    "blouse", prop.torsoW * 0.15, prop.torsoH * 0.90, prop.torsoD * 0.04, 0,                  yTorso + prop.torsoH * 0.46, prop.torsoD * 0.50);
    box("blouse_collar_L", "blouse", prop.torsoW * 0.13, prop.neckH  * 1.10, prop.torsoD * 0.04, -prop.neckR * 0.72, yNeck  - prop.neckH  * 0.10,  prop.torsoD * 0.46);
    box("blouse_collar_R", "blouse", prop.torsoW * 0.13, prop.neckH  * 1.10, prop.torsoD * 0.04,  prop.neckR * 0.72, yNeck  - prop.neckH  * 0.10,  prop.torsoD * 0.46);

    // ── Jacket ───────────────────────────────────────────────────────────────
    box("jacket_body",       "suit_jacket", prop.torsoW * 0.98,  prop.torsoH * 0.96, prop.torsoD,         0,                    yTorso + prop.torsoH * 0.46, 0);
    box("jacket_lapel_L",    "suit_jacket", prop.torsoW * 0.20,  prop.torsoH * 0.44, prop.torsoD * 0.04, -prop.torsoW * 0.15,  yTorso + prop.torsoH * 0.62, prop.torsoD * 0.50);
    box("jacket_lapel_R",    "suit_jacket", prop.torsoW * 0.20,  prop.torsoH * 0.44, prop.torsoD * 0.04,  prop.torsoW * 0.15,  yTorso + prop.torsoH * 0.62, prop.torsoD * 0.50);
    box("jacket_shoulder_L", "suit_jacket", prop.upperAW * 1.20, prop.torsoH * 0.07, prop.torsoD * 1.00, -(prop.torsoW * 0.48 + prop.upperAW * 0.36), yNeck - prop.neckH * 0.28, 0);
    box("jacket_shoulder_R", "suit_jacket", prop.upperAW * 1.20, prop.torsoH * 0.07, prop.torsoD * 1.00,  (prop.torsoW * 0.48 + prop.upperAW * 0.36), yNeck - prop.neckH * 0.28, 0);
    shape("jacket_btn_1",    "sphere", "button_silver", prop.torsoW * 0.025, prop.torsoW * 0.025, prop.torsoD * 0.04, 0, yTorso + prop.torsoH * 0.40, prop.torsoD * 0.51);
    shape("jacket_btn_2",    "sphere", "button_silver", prop.torsoW * 0.025, prop.torsoW * 0.025, prop.torsoD * 0.04, 0, yTorso + prop.torsoH * 0.56, prop.torsoD * 0.51);
    box("jacket_pocket_L",   "suit_jacket", prop.torsoW * 0.18, prop.torsoH * 0.03, prop.torsoD * 0.04, -prop.torsoW * 0.28, yTorso + prop.torsoH * 0.28, prop.torsoD * 0.51);
    box("jacket_pocket_R",   "suit_jacket", prop.torsoW * 0.18, prop.torsoH * 0.03, prop.torsoD * 0.04,  prop.torsoW * 0.28, yTorso + prop.torsoH * 0.28, prop.torsoD * 0.51);
    box("chest_pocket",      "suit_jacket", prop.torsoW * 0.11, prop.torsoH * 0.05, prop.torsoD * 0.03, -prop.torsoW * 0.24, yTorso + prop.torsoH * 0.77, prop.torsoD * 0.51);
    box("brooch",            "accent_pin",  prop.torsoW * 0.06, prop.torsoW * 0.06, prop.torsoD * 0.04, -prop.torsoW * 0.22, yTorso + prop.torsoH * 0.82, prop.torsoD * 0.53);

    // ── Arms (suit sleeves) ───────────────────────────────────────────────────
    for (const side of ["L", "R"]) {
      const sx   = side === "L" ? -(prop.torsoW * 0.48 + prop.upperAW * 0.55) : (prop.torsoW * 0.48 + prop.upperAW * 0.55);
      const yArm = yTorso + prop.torsoH * 0.84;
      shape(`upper_arm_${side}`, "cylinder", "suit_jacket", prop.upperAW * 0.92, prop.upperAH,  prop.upperAD,        sx, yArm,                                              0);
      shape(`elbow_${side}`,     "sphere",   "suit_jacket", prop.upperAW * 0.86, prop.upperAW * 0.86, prop.upperAD,  sx, yArm - prop.upperAH * 0.48,                       0);
      shape(`lower_arm_${side}`, "cylinder", "suit_jacket", prop.lowerAW * 0.90, prop.lowerAH,  prop.lowerAD,        sx, yArm - prop.upperAH * 0.50 - prop.lowerAH * 0.50, 0);
      box(`cuff_${side}`,        "blouse",   prop.lowerAW * 1.10, prop.lowerAH * 0.12, prop.lowerAD * 1.10, sx, yArm - prop.upperAH * 0.50 - prop.lowerAH * 0.92, 0);
      box(`hand_${side}`,        "skin",     prop.handW * 0.90, prop.handH, prop.handD, sx, yArm - prop.upperAH * 0.50 - prop.lowerAH - prop.handH * 0.50, 0);
    }

    // ── Neck ─────────────────────────────────────────────────────────────────
    shape("neck", "cylinder", "skin", prop.neckR * 1.85, prop.neckH, prop.neckR * 1.85, 0, yNeck + prop.neckH * 0.5, 0);

    // ── Head & hair (bob) ─────────────────────────────────────────────────────
    shape("head",        "sphere", "skin", prop.headW,        prop.headH,        prop.headD,        0,               yHead + prop.headH * 0.5,  0);
    // Bob hair — front faces kept well behind head-sphere front (Z < +headD*0.20)
    // to prevent Z-fighting that makes face appear transparent.
    // hair_top: depth 0.70, center Z=-0.14 → front face at +headD*0.21
    box("hair_top",    "hair", prop.headW * 1.06, prop.headH * 0.70, prop.headD * 0.70,  0,               yHead + prop.headH * 0.86, -prop.headD * 0.14);
    // hair_back: hugs rear skull (already well behind face)
    box("hair_back",   "hair", prop.headW * 1.10, prop.headH * 0.72, prop.headD * 0.26,  0,               yHead + prop.headH * 0.57, -prop.headD * 0.44);
    // bangs: intentionally at forehead front surface
    box("bangs_L",     "hair", prop.headW * 0.36, prop.headH * 0.36, prop.headD * 0.12, -prop.headW * 0.17, yHead + prop.headH * 0.80,  prop.headD * 0.38);
    box("bangs_R",     "hair", prop.headW * 0.36, prop.headH * 0.36, prop.headD * 0.12,  prop.headW * 0.17, yHead + prop.headH * 0.80,  prop.headD * 0.38);
    // hair_side: depth 0.65, center Z=-0.24 → front face at +headD*0.085 (behind sphere)
    box("hair_side_L", "hair", prop.headW * 0.14, prop.headH * 0.58, prop.headD * 0.65, -prop.headW * 0.52, yHead + prop.headH * 0.60, -prop.headD * 0.24);
    box("hair_side_R", "hair", prop.headW * 0.14, prop.headH * 0.58, prop.headD * 0.65,  prop.headW * 0.52, yHead + prop.headH * 0.60, -prop.headD * 0.24);

    // ── Face detail ───────────────────────────────────────────────────────────
    shape("ear_L",     "sphere", "skin", prop.headW * 0.10, prop.headH * 0.13, prop.headD * 0.08, -prop.headW * 0.52, yHead + prop.headH * 0.44, 0);
    shape("ear_R",     "sphere", "skin", prop.headW * 0.10, prop.headH * 0.13, prop.headD * 0.08,  prop.headW * 0.52, yHead + prop.headH * 0.44, 0);

    // Glasses — placed clearly IN FRONT of face (Z > headD*0.50) to avoid Z-fighting
    box("glass_frame",  "glass_frame", prop.headW * 1.02, prop.headH * 0.06, prop.headD * 0.03, 0,                yHead + prop.headH * 0.50, prop.headD * 0.55);
    box("glass_lens_L", "glass_lens",  prop.headW * 0.36, prop.headH * 0.09, prop.headD * 0.02, -prop.headW * 0.24, yHead + prop.headH * 0.50, prop.headD * 0.56);
    box("glass_lens_R", "glass_lens",  prop.headW * 0.36, prop.headH * 0.09, prop.headD * 0.02,  prop.headW * 0.24, yHead + prop.headH * 0.50, prop.headD * 0.56);

    shape("eye_L",     "sphere", "skin", prop.headW * 0.10, prop.headH * 0.09, prop.headD * 0.06, -prop.headW * 0.22, yHead + prop.headH * 0.50, prop.headD * 0.48);
    shape("eye_R",     "sphere", "skin", prop.headW * 0.10, prop.headH * 0.09, prop.headD * 0.06,  prop.headW * 0.22, yHead + prop.headH * 0.50, prop.headD * 0.48);
    box("eyebrow_L",   "hair", prop.headW * 0.14, prop.headH * 0.024, prop.headD * 0.02, -prop.headW * 0.22, yHead + prop.headH * 0.58, prop.headD * 0.47);
    box("eyebrow_R",   "hair", prop.headW * 0.14, prop.headH * 0.024, prop.headD * 0.02,  prop.headW * 0.22, yHead + prop.headH * 0.58, prop.headD * 0.47);
    shape("nose",      "sphere", "skin", prop.headW * 0.09, prop.headH * 0.11, prop.headD * 0.13, 0, yHead + prop.headH * 0.36, prop.headD * 0.50);
    box("upper_lip",   "skin", prop.headW * 0.17, prop.headH * 0.028, prop.headD * 0.04, 0, yHead + prop.headH * 0.25, prop.headD * 0.48);
    box("lower_lip",   "skin", prop.headW * 0.19, prop.headH * 0.030, prop.headD * 0.05, 0, yHead + prop.headH * 0.21, prop.headD * 0.47);
    shape("chin",      "sphere", "skin", prop.headW * 0.20, prop.headH * 0.15, prop.headD * 0.17, 0,               yHead + prop.headH * 0.10, prop.headD * 0.40);
    shape("cheek_L",   "sphere", "skin", prop.headW * 0.17, prop.headH * 0.13, prop.headD * 0.12, -prop.headW * 0.28, yHead + prop.headH * 0.34, prop.headD * 0.44);
    shape("cheek_R",   "sphere", "skin", prop.headW * 0.17, prop.headH * 0.13, prop.headD * 0.12,  prop.headW * 0.28, yHead + prop.headH * 0.34, prop.headD * 0.44);

    // Surface details
    const wRegions    = ["head", "jacket", "skirt", "blouse", "shoes"];
    const wDetailTypes = ["fabric_weave", "seam_stitch", "crease", "skin_pore", "button_detail"];
    let wdIdx = 1;
    for (const region of wRegions) {
      for (let i = 0; i < 8; i++) {
        surfaceDetails.push({ id: `surface_detail_${wdIdx++}`, region, type: wDetailTypes[i % wDetailTypes.length],
          strength: rounded(0.10 + (i % 5) * 0.06),
          offset: [Math.sin(i * 0.9) * 0.012, Math.cos(i * 0.7) * 0.010, ((i % 4) - 1.5) * 0.008].map(rounded) });
      }
    }
    spec.parts = parts;
    spec.surfaceDetails = surfaceDetails;
    return spec;
  }
  // ── END SUIT WOMAN OVERRIDE ──────────────────────────────────────────────────

  // ── SUIT OVERRIDE ─────────────────────────────────────────────────────────
  if (isSuit) {
    parts.length = 0;
    surfaceDetails.length = 0;

    spec.promptInterpretation.humanType = "suited_man";
    spec.style.bodyLanguage = "standing_confident";

    // ── Dress shoes ────────────────────────────────────────────────────────
    for (const side of ["L", "R"]) {
      const sx = side === "L" ? -prop.footW * 0.55 : prop.footW * 0.55;
      box(`foot_${side}`,     "dress_shoe", prop.footW * 1.02, prop.footH * 0.72, prop.footD * 1.10, sx, yFoot + prop.footH * 0.36, prop.footD * 0.06);
      box(`shoe_toe_${side}`, "dress_shoe", prop.footW * 0.90, prop.footH * 0.42, prop.footD * 0.28, sx, yFoot + prop.footH * 0.22, prop.footD * 0.46);
      box(`sole_${side}`,     "shoe_sole",  prop.footW * 1.04, prop.footH * 0.14, prop.footD * 1.12, sx, yFoot + prop.footH * 0.07, prop.footD * 0.06);
    }

    // ── Legs (suit pants) ──────────────────────────────────────────────────
    for (const side of ["L", "R"]) {
      const sx = side === "L" ? -prop.thighW * 0.48 : prop.thighW * 0.48;
      shape(`shin_${side}`,  "cylinder", "suit_pants", prop.shinW * 0.92,  prop.shinH,  prop.shinD * 0.92,  sx, yShin  + prop.shinH  * 0.5, 0);
      shape(`knee_${side}`,  "sphere",   "suit_pants", prop.shinW * 0.88,  prop.shinW * 0.88, prop.shinD * 0.88, sx, yShin + prop.shinH * 0.95, 0);
      shape(`thigh_${side}`, "cylinder", "suit_pants", prop.thighW * 0.92, prop.thighH, prop.thighD * 0.92, sx, yThigh + prop.thighH * 0.5, 0);
    }

    // ── Hips & belt ────────────────────────────────────────────────────────
    box("hips",        "suit_pants",  prop.hipW,        prop.hipH,          prop.hipD,          0, yHip + prop.hipH * 0.5,  0);
    box("belt",        "belt",        prop.hipW * 1.02, prop.hipH * 0.14,   prop.hipD * 1.04,   0, yHip + prop.hipH * 0.86, 0);
    box("belt_buckle", "belt_buckle", prop.hipW * 0.08, prop.hipH * 0.13,   prop.hipD * 0.06,   0, yHip + prop.hipH * 0.86, prop.hipD * 0.52);

    // ── Dress shirt (placket + collar) ─────────────────────────────────────
    box("shirt_placket",   "dress_shirt", prop.torsoW * 0.14, prop.torsoH * 0.92, prop.torsoD * 0.04, 0,                yTorso + prop.torsoH * 0.46, prop.torsoD * 0.50);
    box("shirt_collar_L",  "dress_shirt", prop.torsoW * 0.14, prop.neckH * 1.20,  prop.torsoD * 0.05, -prop.neckR * 0.80, yNeck - prop.neckH * 0.10,   prop.torsoD * 0.46);
    box("shirt_collar_R",  "dress_shirt", prop.torsoW * 0.14, prop.neckH * 1.20,  prop.torsoD * 0.05,  prop.neckR * 0.80, yNeck - prop.neckH * 0.10,   prop.torsoD * 0.46);

    // ── Tie ────────────────────────────────────────────────────────────────
    box("tie_knot", "tie", prop.neckR * 0.90, prop.neckH * 0.65,  prop.torsoD * 0.08, 0, yNeck + prop.neckH * 0.10,   prop.torsoD * 0.44);
    box("tie_body", "tie", prop.torsoW * 0.07, prop.torsoH * 0.58, prop.torsoD * 0.04, 0, yTorso + prop.torsoH * 0.54, prop.torsoD * 0.52);
    box("tie_tip",  "tie", prop.torsoW * 0.06, prop.torsoH * 0.10, prop.torsoD * 0.04, 0, yTorso + prop.torsoH * 0.19, prop.torsoD * 0.52);

    // ── Jacket body ────────────────────────────────────────────────────────
    box("jacket_body",       "suit_jacket", prop.torsoW * 1.04,  prop.torsoH * 0.96, prop.torsoD,          0,                    yTorso + prop.torsoH * 0.46, 0);
    box("jacket_lapel_L",    "suit_jacket", prop.torsoW * 0.22,  prop.torsoH * 0.46, prop.torsoD * 0.04,  -prop.torsoW * 0.17,  yTorso + prop.torsoH * 0.64,  prop.torsoD * 0.50);
    box("jacket_lapel_R",    "suit_jacket", prop.torsoW * 0.22,  prop.torsoH * 0.46, prop.torsoD * 0.04,   prop.torsoW * 0.17,  yTorso + prop.torsoH * 0.64,  prop.torsoD * 0.50);
    box("jacket_shoulder_L", "suit_jacket", prop.upperAW * 1.30, prop.torsoH * 0.08, prop.torsoD * 1.02,  -(prop.torsoW * 0.5 + prop.upperAW * 0.40), yNeck - prop.neckH * 0.28, 0);
    box("jacket_shoulder_R", "suit_jacket", prop.upperAW * 1.30, prop.torsoH * 0.08, prop.torsoD * 1.02,   (prop.torsoW * 0.5 + prop.upperAW * 0.40), yNeck - prop.neckH * 0.28, 0);
    shape("jacket_btn_1", "sphere", "button_silver", prop.torsoW * 0.025, prop.torsoW * 0.025, prop.torsoD * 0.04, 0, yTorso + prop.torsoH * 0.38, prop.torsoD * 0.51);
    shape("jacket_btn_2", "sphere", "button_silver", prop.torsoW * 0.025, prop.torsoW * 0.025, prop.torsoD * 0.04, 0, yTorso + prop.torsoH * 0.51, prop.torsoD * 0.51);
    shape("jacket_btn_3", "sphere", "button_silver", prop.torsoW * 0.025, prop.torsoW * 0.025, prop.torsoD * 0.04, 0, yTorso + prop.torsoH * 0.64, prop.torsoD * 0.51);
    box("jacket_pocket_L",     "suit_jacket",  prop.torsoW * 0.18, prop.torsoH * 0.03, prop.torsoD * 0.04, -prop.torsoW * 0.28, yTorso + prop.torsoH * 0.28, prop.torsoD * 0.51);
    box("jacket_pocket_R",     "suit_jacket",  prop.torsoW * 0.18, prop.torsoH * 0.03, prop.torsoD * 0.04,  prop.torsoW * 0.28, yTorso + prop.torsoH * 0.28, prop.torsoD * 0.51);
    box("jacket_chest_pocket", "suit_jacket",  prop.torsoW * 0.12, prop.torsoH * 0.06, prop.torsoD * 0.03, -prop.torsoW * 0.24, yTorso + prop.torsoH * 0.76, prop.torsoD * 0.51);
    box("pocket_square",       "pocket_square",prop.torsoW * 0.08, prop.torsoH * 0.04, prop.torsoD * 0.03, -prop.torsoW * 0.24, yTorso + prop.torsoH * 0.81, prop.torsoD * 0.53);

    // ── Arms (suit sleeves + shirt cuffs) ──────────────────────────────────
    for (const side of ["L", "R"]) {
      const sx = side === "L" ? -(prop.torsoW * 0.5 + prop.upperAW * 0.6) : (prop.torsoW * 0.5 + prop.upperAW * 0.6);
      const yArm = yTorso + prop.torsoH * 0.84;
      shape(`upper_arm_${side}`, "cylinder", "suit_jacket", prop.upperAW * 1.04, prop.upperAH,  prop.upperAD,        sx, yArm,                                             0);
      shape(`elbow_${side}`,     "sphere",   "suit_jacket", prop.upperAW,        prop.upperAW,  prop.upperAD,        sx, yArm - prop.upperAH * 0.48,                       0);
      shape(`lower_arm_${side}`, "cylinder", "suit_jacket", prop.lowerAW * 1.04, prop.lowerAH,  prop.lowerAD,        sx, yArm - prop.upperAH * 0.50 - prop.lowerAH * 0.50, 0);
      box(`cuff_${side}`,        "dress_shirt", prop.lowerAW * 1.22, prop.lowerAH * 0.13, prop.lowerAD * 1.22, sx, yArm - prop.upperAH * 0.50 - prop.lowerAH * 0.94,   0);
      box(`hand_${side}`,        "skin",        prop.handW,  prop.handH, prop.handD,  sx, yArm - prop.upperAH * 0.50 - prop.lowerAH - prop.handH * 0.50,  0);
    }

    // ── Neck ───────────────────────────────────────────────────────────────
    shape("neck", "cylinder", "skin", prop.neckR * 2, prop.neckH, prop.neckR * 2, 0, yNeck + prop.neckH * 0.5, 0);

    // ── Head & face detail ─────────────────────────────────────────────────
    shape("head",      "sphere", "skin", prop.headW,       prop.headH,       prop.headD,       0,               yHead + prop.headH * 0.5,  0);
    // Hair: top dome — centered at crown (88% from bottom = near head top)
    shape("hair_top",  "sphere", "hair", prop.headW * 0.98, prop.headH * 0.62, prop.headD * 0.94, 0, yHead + prop.headH * 0.88, 0);
    // Bangs (前髪) — front surface of forehead
    box("bangs",       "hair", prop.headW * 0.76, prop.headH * 0.18, prop.headD * 0.14, 0, yHead + prop.headH * 0.74, prop.headD * 0.40);
    // Back of head — hug the skull surface
    box("hair_back",   "hair", prop.headW * 0.88, prop.headH * 0.55, prop.headD * 0.22, 0, yHead + prop.headH * 0.72, -prop.headD * 0.44);
    // Side panels — on side surface of skull
    box("hair_side_L", "hair", prop.headW * 0.10, prop.headH * 0.50, prop.headD * 0.82, -prop.headW * 0.50, yHead + prop.headH * 0.68, -prop.headD * 0.06);
    box("hair_side_R", "hair", prop.headW * 0.10, prop.headH * 0.50, prop.headD * 0.82,  prop.headW * 0.50, yHead + prop.headH * 0.68, -prop.headD * 0.06);
    shape("ear_L",  "sphere", "skin", prop.headW * 0.10, prop.headH * 0.14, prop.headD * 0.08, -prop.headW * 0.52, yHead + prop.headH * 0.44, 0);
    shape("ear_R",  "sphere", "skin", prop.headW * 0.10, prop.headH * 0.14, prop.headD * 0.08,  prop.headW * 0.52, yHead + prop.headH * 0.44, 0);
    // Eyes
    shape("eye_L",  "sphere", "skin", prop.headW * 0.10, prop.headH * 0.09, prop.headD * 0.06, -prop.headW * 0.22, yHead + prop.headH * 0.50, prop.headD * 0.48);
    shape("eye_R",  "sphere", "skin", prop.headW * 0.10, prop.headH * 0.09, prop.headD * 0.06,  prop.headW * 0.22, yHead + prop.headH * 0.50, prop.headD * 0.48);
    // Eyebrows
    box("eyebrow_L", "hair", prop.headW * 0.14, prop.headH * 0.026, prop.headD * 0.02, -prop.headW * 0.22, yHead + prop.headH * 0.58, prop.headD * 0.47);
    box("eyebrow_R", "hair", prop.headW * 0.14, prop.headH * 0.026, prop.headD * 0.02,  prop.headW * 0.22, yHead + prop.headH * 0.58, prop.headD * 0.47);
    // Nose
    shape("nose",      "sphere", "skin", prop.headW * 0.10, prop.headH * 0.12, prop.headD * 0.14, 0, yHead + prop.headH * 0.36, prop.headD * 0.50);
    // Mouth
    box("upper_lip",   "skin", prop.headW * 0.18, prop.headH * 0.028, prop.headD * 0.04, 0, yHead + prop.headH * 0.25, prop.headD * 0.48);
    box("lower_lip",   "skin", prop.headW * 0.20, prop.headH * 0.030, prop.headD * 0.05, 0, yHead + prop.headH * 0.21, prop.headD * 0.47);
    // Jaw & cheeks
    shape("chin",    "sphere", "skin", prop.headW * 0.22, prop.headH * 0.16, prop.headD * 0.18, 0,               yHead + prop.headH * 0.10, prop.headD * 0.40);
    shape("cheek_L", "sphere", "skin", prop.headW * 0.18, prop.headH * 0.14, prop.headD * 0.12, -prop.headW * 0.30, yHead + prop.headH * 0.34, prop.headD * 0.44);
    shape("cheek_R", "sphere", "skin", prop.headW * 0.18, prop.headH * 0.14, prop.headD * 0.12,  prop.headW * 0.30, yHead + prop.headH * 0.34, prop.headD * 0.44);

    // Surface details
    const suitRegions    = ["head", "jacket", "shirt", "pants", "shoes"];
    const suitDetailTypes = ["fabric_weave", "seam_stitch", "crease", "skin_pore", "button_detail"];
    let sdIdx = 1;
    for (const region of suitRegions) {
      for (let i = 0; i < 8; i++) {
        surfaceDetails.push({ id: `surface_detail_${sdIdx++}`, region, type: suitDetailTypes[i % suitDetailTypes.length],
          strength: rounded(0.10 + (i % 5) * 0.06),
          offset: [Math.sin(i * 0.9) * 0.012, Math.cos(i * 0.7) * 0.010, ((i % 4) - 1.5) * 0.008].map(rounded) });
      }
    }
    spec.parts = parts;
    spec.surfaceDetails = surfaceDetails;
    return spec;
  }
  // ── END SUIT OVERRIDE ─────────────────────────────────────────────────────

  // ── RUNNER POSE OVERRIDE ──────────────────────────────────────────────────
  if (isRunner) {
    // Clear base human parts — runner replaces them entirely
    parts.length = 0;
    surfaceDetails.length = 0;

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
        surfaceDetails.push({ id: `surface_detail_${sdIdx++}`, region, type: runDetailTypes[i%runDetailTypes.length],
          strength: rounded(0.10+(i%5)*0.06),
          offset: [Math.sin(i*0.9)*0.012, Math.cos(i*0.7)*0.010, ((i%4)-1.5)*0.008].map(rounded) });
      }
    }
    spec.parts = parts;
    spec.surfaceDetails = surfaceDetails;
    return spec;
  }
  // ── END RUNNER POSE OVERRIDE ──────────────────────────────────────────────

  spec.parts = parts;
  spec.surfaceDetails = surfaceDetails;
  return spec;
}

function buildFerrisWheelSpec(prompt, height, styles) {
  const H    = height;           // total height (ground → top of wheel)
  const R    = H * 0.43;         // wheel radius  (top at H, bottom clearance H*0.14)
  const hubY = H - R;            // hub/axle center height

  const base = buildHighDensityMeta(prompt, "ferris_wheel", height, styles);
  const spec = {
    ...base,
    globalScale: { height: H, diameter: rounded(R * 2), depth: rounded(R * 0.55) },
    style: {
      silhouette: "ferris_wheel_amusement",
      mood: "festive",
      genre: "amusement_attraction",
      detailDensity: "high",
      bodyLanguage: "static_structure",
      shapeLanguage: ["circular_rim", "radial_spokes", "gondolas", "a_frame_support"],
    },
    materials: {
      steel_frame:  { baseColor: "#CC2020", roughness: 0.38, metalness: 0.88 },
      steel_rim:    { baseColor: "#DD2222", roughness: 0.35, metalness: 0.90 },
      steel_spoke:  { baseColor: "#BB1A1A", roughness: 0.42, metalness: 0.85 },
      support_red:  { baseColor: "#CC2020", roughness: 0.40, metalness: 0.82 },
      hub_gold:     { baseColor: "#D4A820", roughness: 0.26, metalness: 0.92 },
      gondola_body: { baseColor: "#F5F5F5", roughness: 0.50, metalness: 0.08 },
      gondola_red:  { baseColor: "#DD2222", roughness: 0.45, metalness: 0.10 },
      gondola_win:  { baseColor: "#88BBDD", roughness: 0.12, metalness: 0.85 },
      base_conc:    { baseColor: "#C0C0B8", roughness: 0.92, metalness: 0.03 },
      accent_gold:  { baseColor: "#D4A820", roughness: 0.28, metalness: 0.92 },
      light_warm:   { baseColor: "#FFD080", roughness: 0.10, metalness: 0.00, emissive: "#FFB020" },
    },
    parts: [],
    surfaceDetails: [],
    ornaments: [],
    pose: { preset: "static" },
    animationHints: {},
    lod: { high: "full", medium: "reduce_gondolas", low: "merge_rim_spokes" },
    exportOptions: { formats: ["gltf", "glb"], previewHtml: true },
  };

  // Apply user-specified color to structural materials
  if (styles.userColor) {
    const uc = styles.userColor;
    for (const k of ["steel_frame", "steel_rim", "steel_spoke", "support_red"]) {
      spec.materials[k] = { ...spec.materials[k], baseColor: uc.hex, roughness: uc.roughness, metalness: uc.metalness };
    }
  }

  const parts = [];
  const surfaceDetails = [];

  function cyl(id, mat, sx, sy, sz, px, py, pz, rx = 0, ry = 0, rz = 0) {
    parts.push({
      id, kind: "cylinder", material: mat,
      size:     [rounded(sx), rounded(sy), rounded(sz)],
      position: [rounded(px), rounded(py), rounded(pz)],
      rotation: [rounded(rx), rounded(ry), rounded(rz)],
    });
  }
  function box(id, mat, sx, sy, sz, px, py, pz, rx = 0, ry = 0, rz = 0) {
    parts.push({
      id, kind: "box", material: mat,
      size:     [rounded(sx), rounded(sy), rounded(sz)],
      position: [rounded(px), rounded(py), rounded(pz)],
      rotation: [rounded(rx), rounded(ry), rounded(rz)],
    });
  }

  // ── GROUND BASE ──────────────────────────────────────────────────────────────
  box("ground_slab",   "base_conc", R*2.8, R*0.04, R*0.55, 0, R*0.02, 0);
  box("footing_L",     "base_conc", R*0.5, R*0.10, R*0.50, -R*0.60, R*0.05, 0);
  box("footing_R",     "base_conc", R*0.5, R*0.10, R*0.50,  R*0.60, R*0.05, 0);

  // ── A-FRAME SUPPORT LEGS ─────────────────────────────────────────────────────
  // Each leg goes from ground (X=±R*0.58, Y=0) diagonally up to hub (X=0, Y=hubY).
  // Direction vector (bottom→top): [∓R*0.58, hubY, 0] → rotation around Z.
  // Rotating Y-axis by rz around Z gives (-sin(rz), cos(rz), 0).
  // For left leg [+R*0.58, hubY, 0] normalized: rz = -atan2(R*0.58, hubY).
  const legBeta = Math.atan2(R * 0.58, hubY);
  const legLen  = Math.sqrt((R * 0.58) ** 2 + hubY ** 2);
  const legCX   = -R * 0.29;   // midpoint X for left legs
  const legCY   = hubY * 0.5;  // midpoint Y

  cyl("leg_L_front", "support_red", R*0.07, legLen, R*0.07, legCX, legCY,  R*0.20, 0, 0, -legBeta);
  cyl("leg_L_rear",  "support_red", R*0.07, legLen, R*0.07, legCX, legCY, -R*0.20, 0, 0, -legBeta);
  cyl("leg_R_front", "support_red", R*0.07, legLen, R*0.07,-legCX, legCY,  R*0.20, 0, 0,  legBeta);
  cyl("leg_R_rear",  "support_red", R*0.07, legLen, R*0.07,-legCX, legCY, -R*0.20, 0, 0,  legBeta);

  // Cross-braces connecting left pair and right pair at different heights
  box("brace_L_lo_F", "support_red", R*0.60, R*0.04, R*0.04, -R*0.30, hubY*0.28,  R*0.20);
  box("brace_L_md_F", "support_red", R*0.40, R*0.04, R*0.04, -R*0.20, hubY*0.55,  R*0.20);
  box("brace_L_hi_F", "support_red", R*0.20, R*0.04, R*0.04, -R*0.10, hubY*0.80,  R*0.20);
  box("brace_R_lo_F", "support_red", R*0.60, R*0.04, R*0.04,  R*0.30, hubY*0.28,  R*0.20);
  box("brace_R_md_F", "support_red", R*0.40, R*0.04, R*0.04,  R*0.20, hubY*0.55,  R*0.20);
  box("brace_R_hi_F", "support_red", R*0.20, R*0.04, R*0.04,  R*0.10, hubY*0.80,  R*0.20);
  box("brace_L_lo_R", "support_red", R*0.60, R*0.04, R*0.04, -R*0.30, hubY*0.28, -R*0.20);
  box("brace_L_md_R", "support_red", R*0.40, R*0.04, R*0.04, -R*0.20, hubY*0.55, -R*0.20);
  box("brace_L_hi_R", "support_red", R*0.20, R*0.04, R*0.04, -R*0.10, hubY*0.80, -R*0.20);
  box("brace_R_lo_R", "support_red", R*0.60, R*0.04, R*0.04,  R*0.30, hubY*0.28, -R*0.20);
  box("brace_R_md_R", "support_red", R*0.40, R*0.04, R*0.04,  R*0.20, hubY*0.55, -R*0.20);
  box("brace_R_hi_R", "support_red", R*0.20, R*0.04, R*0.04,  R*0.10, hubY*0.80, -R*0.20);
  // Z-direction cross links (front↔rear at each height)
  box("z_link_L_lo", "support_red", R*0.04, R*0.04, R*0.45, -R*0.30, hubY*0.28, 0);
  box("z_link_L_md", "support_red", R*0.04, R*0.04, R*0.45, -R*0.20, hubY*0.55, 0);
  box("z_link_R_lo", "support_red", R*0.04, R*0.04, R*0.45,  R*0.30, hubY*0.28, 0);
  box("z_link_R_md", "support_red", R*0.04, R*0.04, R*0.45,  R*0.20, hubY*0.55, 0);

  // ── HUB / AXLE ───────────────────────────────────────────────────────────────
  // Axle is a horizontal cylinder along X → rotate Y-axis by -π/2 around Z
  cyl("axle",      "hub_gold", R*0.05, R*0.52, R*0.05, 0, hubY, 0, 0, 0, -Math.PI/2);
  cyl("hub_front", "hub_gold", R*0.24, R*0.06, R*0.24, 0, hubY,  R*0.20);
  cyl("hub_rear",  "hub_gold", R*0.24, R*0.06, R*0.24, 0, hubY, -R*0.20);
  cyl("hub_cap",   "hub_gold", R*0.14, R*0.10, R*0.14, 0, hubY, 0);

  // ── OUTER RIM  (24 chord segments) ───────────────────────────────────────────
  // Segment at angle θ (0=top, clockwise): center = [R·sinθ, hubY+R·cosθ, 0]
  // Chord length = 2·R·sin(π/24).  Rotation around Z: -(θ + π/2)
  const N_RIM    = 24;
  const rimChord = 2 * R * Math.sin(Math.PI / N_RIM) * 1.005; // tiny overlap to avoid gaps
  const rimD     = R * 0.055; // rim cylinder diameter
  for (let i = 0; i < N_RIM; i++) {
    const θ  = (i / N_RIM) * Math.PI * 2;
    const rz = -(θ + Math.PI / 2);
    cyl(`rim_F_${i}`, "steel_rim", rimD, rimChord, rimD,
      R * Math.sin(θ), hubY + R * Math.cos(θ),  R*0.18, 0, 0, rz);
    cyl(`rim_R_${i}`, "steel_rim", rimD, rimChord, rimD,
      R * Math.sin(θ), hubY + R * Math.cos(θ), -R*0.18, 0, 0, rz);
  }

  // ── SPOKES (16 radial spokes, each hub→rim) ───────────────────────────────────
  // Spoke at angle θ: center = [R/2·sinθ, hubY+R/2·cosθ], length=R, rotation_z = -θ
  const N_SPOKE = 16;
  const spokeD  = R * 0.028;
  for (let i = 0; i < N_SPOKE; i++) {
    const θ = (i / N_SPOKE) * Math.PI * 2;
    cyl(`spoke_F_${i}`, "steel_spoke", spokeD, R, spokeD,
      (R / 2) * Math.sin(θ), hubY + (R / 2) * Math.cos(θ),  R*0.18, 0, 0, -θ);
    cyl(`spoke_R_${i}`, "steel_spoke", spokeD, R, spokeD,
      (R / 2) * Math.sin(θ), hubY + (R / 2) * Math.cos(θ), -R*0.18, 0, 0, -θ);
  }
  // Z-axis tie rods connecting front/rear spokes at the rim end
  for (let i = 0; i < N_SPOKE; i++) {
    const θ = (i / N_SPOKE) * Math.PI * 2;
    box(`rod_rim_${i}`, "steel_frame", spokeD, spokeD, R*0.40,
      R * Math.sin(θ), hubY + R * Math.cos(θ), 0);
  }

  // ── GONDOLAS (16, one per spoke tip) ─────────────────────────────────────────
  // Gondolas hang from rim — placed just outside the rim attachment point.
  const N_GONDOLA = 16;
  const gW = R * 0.10, gH = R * 0.12, gD = R * 0.08;
  for (let i = 0; i < N_GONDOLA; i++) {
    const θ  = (i / N_GONDOLA) * Math.PI * 2;
    const gx = R * Math.sin(θ);
    const gy = hubY + R * Math.cos(θ) - gH * 0.5 - rimD; // hang below rim
    box(`gondola_${i}`,     "gondola_body", gW,       gH,       gD,      gx, gy, 0);
    box(`gondola_roof_${i}`, "gondola_red", gW*1.05,  gH*0.12,  gD*1.05, gx, gy + gH*0.5 + gH*0.06, 0);
    box(`gondola_win_F_${i}`, "gondola_win", gW*0.65,  gH*0.48,  gD*0.08, gx, gy + gH*0.05, gD*0.5);
    box(`gondola_win_R_${i}`, "gondola_win", gW*0.65,  gH*0.48,  gD*0.08, gx, gy + gH*0.05,-gD*0.5);
  }

  // ── DECORATIVE LIGHTS on outer rim ───────────────────────────────────────────
  const N_LIGHT = 16;
  for (let i = 0; i < N_LIGHT; i++) {
    const θ = (i / N_LIGHT) * Math.PI * 2;
    box(`light_${i}`, "light_warm", rimD*0.9, rimD*0.9, rimD*0.9,
      R * Math.sin(θ), hubY + R * Math.cos(θ), R*0.19);
  }

  // ── SURFACE DETAILS ───────────────────────────────────────────────────────────
  const sdRegions = ["rim", "spokes", "gondolas", "support", "hub"];
  const sdTypes   = ["panel_seam", "bolt_pattern", "paint_wear", "weld_seam", "edge_trim"];
  let sdIdx = 1;
  for (const region of sdRegions) {
    for (let i = 0; i < 5; i++) {
      surfaceDetails.push({
        id: `sd_${sdIdx++}`, region, type: sdTypes[i % sdTypes.length],
        strength: rounded(0.12 + (i % 4) * 0.05),
        offset: [Math.sin(i * 0.8) * 0.015, Math.cos(i * 0.5) * 0.012, ((i % 4) - 1.5) * 0.01].map(rounded),
      });
    }
  }

  spec.parts = parts;
  spec.surfaceDetails = surfaceDetails;
  return spec;
}

// Builder dispatch map  - add new subject builders here alongside SUBJECT_REGISTRY.
const SUBJECT_BUILDERS = {
  ferris_wheel: (...a) => buildFerrisWheelSpec(...a),
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
  styles.userColor = parseUserColor(prompt);
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
      indices.push(a, a + 1, b, b, a + 1, b + 1);  // CCW = outward front faces
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

function eulerToQuat(rx, ry, rz) {
  // ZYX Euler angles (radians) → GLTF quaternion [x, y, z, w]
  const cx = Math.cos(rx / 2), sx = Math.sin(rx / 2);
  const cy = Math.cos(ry / 2), sy = Math.sin(ry / 2);
  const cz = Math.cos(rz / 2), sz = Math.sin(rz / 2);
  return [
    sx * cy * cz - cx * sy * sz,
    cx * sy * cz + sx * cy * sz,
    cx * cy * sz - sx * sy * cz,
    cx * cy * cz + sx * sy * sz,
  ];
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
    const rot = part.rotation;
    if (rot && (rot[0] !== 0 || rot[1] !== 0 || rot[2] !== 0)) {
      node.setRotation(eulerToQuat(rot[0], rot[1], rot[2]));
    }

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
    [/\u30ed\u30dc/u,                                          "robot"],
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
    [/\u30de\u30e9\u30bd\u30f3/u,                              "marathon_runner"],
    [/\u30e9\u30f3\u30ca\u30fc/u,                              "runner"],
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

  const lines = [
    "<!doctype html>",
    "<html lang='ja'>",
    "<head>",
    "  <meta charset='utf-8'>",
    "  <meta name='viewport' content='width=device-width,initial-scale=1'>",
    "  <title>prompt2gltf &middot; Gallery</title>",
    "  <link rel='preconnect' href='https://fonts.googleapis.com'>",
    "  <link href='https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Noto+Sans+JP:wght@300;400&display=swap' rel='stylesheet'>",
    "  <style>",
    "    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }",
    "    :root {",
    "      --bg: #0a0a0f; --surface: #12121a; --border: #2a2a3a;",
    "      --accent: #6ee7f7; --accent2: #a78bfa; --text: #e0e0f0; --muted: #5a5a7a;",
    "    }",
    "    body { background: var(--bg); color: var(--text); font-family: 'Noto Sans JP', sans-serif; height: 100vh; display: flex; flex-direction: column; overflow: hidden; }",
    "    header { padding: 14px 22px; border-bottom: 1px solid var(--border); display: flex; align-items: center; gap: 14px; background: var(--surface); flex-shrink: 0; }",
    "    .logo { font-family: 'Space Mono', monospace; font-size: 12px; letter-spacing: .2em; color: var(--accent); text-transform: uppercase; }",
    "    .logo span { color: var(--accent2); }",
    "    .hint { margin-left: auto; font-size: 11px; color: var(--muted); font-family: 'Space Mono', monospace; letter-spacing: .05em; }",
    "    .main { flex: 1; display: flex; overflow: hidden; }",
    "    #sidebar { width: 220px; min-width: 220px; background: var(--surface); border-right: 1px solid var(--border); display: flex; flex-direction: column; overflow: hidden; }",
    "    .sidebar-hd { padding: 14px 14px 8px; display: flex; align-items: center; justify-content: space-between; flex-shrink: 0; border-bottom: 1px solid var(--border); }",
    "    .sidebar-label { font-family: 'Space Mono', monospace; font-size: 10px; letter-spacing: .14em; color: var(--muted); text-transform: uppercase; }",
    "    .model-count { font-family: 'Space Mono', monospace; font-size: 10px; color: var(--accent2); background: rgba(167,139,250,.12); padding: 2px 7px; border-radius: 10px; }",
    "    #model-list { overflow-y: auto; flex: 1; padding: 6px 0; }",
    "    #model-list::-webkit-scrollbar { width: 4px; }",
    "    #model-list::-webkit-scrollbar-track { background: transparent; }",
    "    #model-list::-webkit-scrollbar-thumb { background: var(--border); border-radius: 2px; }",
    "    .mbtn { display: block; width: 100%; text-align: left; padding: 9px 16px 9px 14px; background: none; border: none; border-left: 2px solid transparent; color: var(--muted); cursor: pointer; font-size: 12px; font-family: 'Space Mono', monospace; letter-spacing: .04em; transition: background .12s, border-color .12s, color .12s; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }",
    "    .mbtn:hover { background: rgba(110,231,247,.04); color: var(--text); }",
    "    .mbtn.active { border-left-color: var(--accent); background: rgba(110,231,247,.06); color: var(--accent); }",
    "    .mbtn .dot { display: inline-block; width: 5px; height: 5px; border-radius: 50%; background: var(--accent2); margin-right: 8px; vertical-align: middle; opacity: 0; transition: opacity .15s; }",
    "    .mbtn.active .dot { opacity: 1; }",
    "    #viewer { flex: 1; position: relative; overflow: hidden; }",
    "    canvas { display: block; width: 100% !important; height: 100% !important; }",
    "    .grid-bg { position: absolute; inset: 0; background-image: linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px); background-size: 40px 40px; opacity: .18; pointer-events: none; z-index: 0; }",
    "    #info { position: absolute; top: 14px; left: 14px; font-family: 'Space Mono', monospace; font-size: 10px; color: var(--muted); z-index: 5; line-height: 1.9; opacity: 0; transition: opacity .3s; background: rgba(10,10,15,.75); padding: 10px 14px; border-radius: 8px; border: 1px solid var(--border); backdrop-filter: blur(6px); }",
    "    #info.visible { opacity: 1; }",
    "    .controls-bar { position: absolute; bottom: 18px; left: 50%; transform: translateX(-50%); display: flex; gap: 8px; z-index: 5; opacity: 0; transition: opacity .3s; }",
    "    .controls-bar.visible { opacity: 1; }",
    "    .ctrl-btn { background: rgba(18,18,26,.90); border: 1px solid var(--border); color: var(--text); font-family: 'Space Mono', monospace; font-size: 10px; letter-spacing: .06em; padding: 7px 14px; border-radius: 6px; cursor: pointer; backdrop-filter: blur(8px); transition: border-color .15s, color .15s; }",
    "    .ctrl-btn:hover { border-color: var(--accent); color: var(--accent); }",
    "    .ctrl-btn.on { border-color: var(--accent2); color: var(--accent2); }",
    "    #status-bar { position: absolute; bottom: 18px; right: 18px; font-family: 'Space Mono', monospace; font-size: 10px; color: var(--muted); z-index: 5; background: rgba(10,10,15,.75); padding: 6px 14px; border-radius: 20px; border: 1px solid var(--border); backdrop-filter: blur(6px); letter-spacing: .04em; }",
    "  </style>",
    "</head>",
    "<body>",
    "  <header>",
    "    <div class='logo'>PROMPT2GLTF <span>//</span> Gallery</div>",
    "    <div class='hint'>drag &middot; scroll &middot; pinch to navigate</div>",
    "  </header>",
    "  <div class='main'>",
    "    <div id='sidebar'>",
    "      <div class='sidebar-hd'>",
    "        <span class='sidebar-label'>Models</span>",
    "        <span class='model-count' id='count-badge'>0</span>",
    "      </div>",
    "      <div id='model-list'></div>",
    "    </div>",
    "    <div id='viewer'>",
    "      <div class='grid-bg'></div>",
    "      <canvas id='c'></canvas>",
    "      <div id='info'></div>",
    "      <div class='controls-bar' id='controls-bar'>",
    "        <button class='ctrl-btn' id='btn-reset'>&#x27F3; RESET</button>",
    "        <button class='ctrl-btn' id='btn-wire'>&#x25FB; WIRE</button>",
    "        <button class='ctrl-btn on' id='btn-rotate'>&#x27F2; AUTO</button>",
    "      </div>",
    "      <div id='status-bar'>Loading...</div>",
    "    </div>",
    "  </div>",
    "  <!-- Three.js r128 UMD (last version with examples/js UMD addons) -->",
    "  <script src='https://cdn.jsdelivr.net/npm/three@0.128.0/build/three.min.js'></script>",
    "  <script src='https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js'></script>",
    "  <script src='https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/GLTFLoader.js'></script>",
    "  <script>",
    "    if(location.protocol==='file:'){",
    "      document.getElementById('status-bar').innerHTML='&#x26A0; file:// では GLB を読み込めません。<br>VSCode ターミナルで <b>node serve.cjs</b> を実行し、<br>ブラウザで <b>http://localhost:3456/</b> を開いてください。';",
    "      document.getElementById('status-bar').style.cssText='position:absolute;inset:0;display:flex;align-items:center;justify-content:center;text-align:center;font-family:monospace;font-size:13px;color:#6ee7f7;background:#0a0a0f;z-index:99;padding:40px;line-height:2;';",
    "    }",
    "    var MODELS  = " + modelsJson + ";",
    "    var INITIAL = " + currentJson + ";",
    "    var COUNT   = " + countStr + ";",
    "    document.getElementById('count-badge').textContent = COUNT;",
    "    var statusEl  = document.getElementById('status-bar');",
    "    var infoEl    = document.getElementById('info');",
    "    var ctrlBar   = document.getElementById('controls-bar');",
    "    var listEl    = document.getElementById('model-list');",
    "    var canvas    = document.getElementById('c');",
    "    var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });",
    "    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));",
    "    renderer.toneMapping = THREE.ACESFilmicToneMapping;",
    "    renderer.toneMappingExposure = 1.1;",
    "    var scene = new THREE.Scene();",
    "    scene.background = new THREE.Color(0x0a0a0f);",
    "    var camera = new THREE.PerspectiveCamera(50, 1, 0.1, 10000);",
    "    var controls = new THREE.OrbitControls(camera, renderer.domElement);",
    "    controls.enableDamping = true; controls.dampingFactor = 0.08;",
    "    var amb = new THREE.AmbientLight(0xffffff, 0.4); scene.add(amb);",
    "    var dir1 = new THREE.DirectionalLight(0x6ee7f7, 2.2); dir1.position.set(180,260,140); scene.add(dir1);",
    "    var dir2 = new THREE.DirectionalLight(0xa78bfa, 1.0); dir2.position.set(-120,90,-160); scene.add(dir2);",
    "    var dir3 = new THREE.DirectionalLight(0xffffff, 0.8); dir3.position.set(0,-100,0); scene.add(dir3);",
    "    scene.add(new THREE.GridHelper(600, 60, 0x2a2a3a, 0x1a1a28));",
    "    var ground = new THREE.Mesh(new THREE.PlaneGeometry(800,800), new THREE.MeshStandardMaterial({color:0x0a0a0f,roughness:0.98}));",
    "    ground.rotation.x = -Math.PI/2; ground.position.y = -0.02; scene.add(ground);",
    "    function resize() { var w=canvas.clientWidth,h=canvas.clientHeight; renderer.setSize(w,h,false); camera.aspect=w/h; camera.updateProjectionMatrix(); }",
    "    window.addEventListener('resize', resize); resize();",
    "    function frameObject(obj) {",
    "      var box=new THREE.Box3().setFromObject(obj), size=new THREE.Vector3(), center=new THREE.Vector3();",
    "      box.getSize(size); box.getCenter(center);",
    "      obj.position.x -= center.x; obj.position.y -= box.min.y; obj.position.z -= center.z;",
    "      var maxDim=Math.max(size.x,size.y,size.z), dist=Math.max(60,maxDim*1.8);",
    "      camera.near=Math.max(0.1,maxDim/500); camera.far=Math.max(1000,maxDim*20); camera.updateProjectionMatrix();",
    "      scene.fog=new THREE.Fog(0x0a0a0f,dist*2.5,dist*9);",
    "      camera.position.set(dist*0.72,size.y*0.62+dist*0.22,dist);",
    "      controls.target.set(0,size.y*0.42,0); controls.update();",
    "    }",
    "    var loader = new THREE.GLTFLoader();",
    "    var currentObj=null, wireframe=false, autoRotate=true;",
    "    function loadModel(filename) {",
    "      if(currentObj){ scene.remove(currentObj); currentObj=null; }",
    "      infoEl.classList.remove('visible'); ctrlBar.classList.remove('visible');",
    "      statusEl.textContent='Loading '+filename+' ...';",
    "      var glbPath = (location.protocol==='file:') ? 'generated/'+filename : 'generated/'+filename;",
    "      loader.load(glbPath,",
    "        function(gltf){",
    "          currentObj=gltf.scene; scene.add(currentObj);",
    "          frameObject(currentObj);",
    "          currentObj.traverse(function(n){ if(n.isMesh) n.material.wireframe=wireframe; });",
    "          var meshCount=0; currentObj.traverse(function(n){ if(n.isMesh) meshCount++; });",
    "          var box=new THREE.Box3().setFromObject(currentObj), sz=new THREE.Vector3(); box.getSize(sz);",
    "          infoEl.innerHTML='FILE: '+filename+'<br>MESHES: '+meshCount+'<br>SIZE: '+sz.x.toFixed(1)+' x '+sz.y.toFixed(1)+' x '+sz.z.toFixed(1)+' m';",
    "          infoEl.classList.add('visible'); ctrlBar.classList.add('visible');",
    "          statusEl.textContent=filename+' &#x2713;';",
    "        },",
    "        function(evt){ statusEl.textContent=evt.total?'Loading... '+Math.round(evt.loaded/evt.total*100)+'%':'Loading... '+Math.round(evt.loaded/1024)+' KB'; },",
    "        function(err){ statusEl.textContent='Load failed: '+(err.message||err); }",
    "      );",
    "    }",
    "    MODELS.forEach(function(filename){",
    "      var btn=document.createElement('button');",
    "      btn.className='mbtn'+(filename===INITIAL?' active':'');",
    "      btn.title=filename;",
    "      var label=filename.replace(/\.glb$/,'').replace(/_/g,' ');",
    "      var _sp=document.createElement('span'); _sp.className='dot'; btn.textContent=label; btn.prepend(_sp);",
    "      btn.onclick=function(){ document.querySelectorAll('.mbtn').forEach(function(b){b.classList.remove('active');}); btn.classList.add('active'); loadModel(filename); };",
    "      listEl.appendChild(btn);",
    "    });",
    "    document.getElementById('btn-reset').onclick=function(){ if(currentObj){ frameObject(currentObj); } };",
    "    document.getElementById('btn-wire').onclick=function(){ wireframe=!wireframe; this.classList.toggle('on',wireframe); if(currentObj) currentObj.traverse(function(n){ if(n.isMesh) n.material.wireframe=wireframe; }); this.textContent=wireframe?'&#x25A0; SOLID':'&#x25FB; WIRE'; };",
    "    document.getElementById('btn-rotate').onclick=function(){ autoRotate=!autoRotate; this.classList.toggle('on',autoRotate); };",
    "    controls.addEventListener('start',function(){ autoRotate=false; document.getElementById('btn-rotate').classList.remove('on'); });",
    "    (function render(){ controls.update(); if(currentObj&&autoRotate) currentObj.rotation.y+=0.003; renderer.render(scene,camera); requestAnimationFrame(render); })();",
    "    loadModel(INITIAL);",
    "  </script>",
    "</body>",
    "</html>",
  ];

  return lines.join("\n");
}


async function loadTemplateSpec(templatePath, prompt) {
  const raw = await fs.readFile(templatePath, "utf-8");
  const spec = JSON.parse(raw);
  // Update prompt-specific fields so meta reflects the current run
  spec.meta.generatedFrom = prompt;
  spec.meta.createdAt = new Date().toISOString();
  spec.promptInterpretation.originalPrompt = prompt;
  return spec;
}

async function main() {
  const prompt = getArg("--prompt");
  if (!prompt) {
    console.error('Usage: node tools/prompt2gltf/src/index.mjs --prompt "100m邏壹・蟾ｨ莠ｺ繧剃ｽ懊▲縺ｦ"');
    process.exit(1);
  }

  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  // If --template is provided, load that spec as the base; otherwise build from scratch
  const templateArg = getArg("--template");
  let spec;
  if (templateArg) {
    const templatePath = path.isAbsolute(templateArg)
      ? templateArg
      : path.resolve(PLUGIN_ROOT, templateArg);
    console.log(`Using template: ${templatePath}`);
    spec = await loadTemplateSpec(templatePath, prompt);
  } else {
    spec = buildSpec(prompt);
  }
  const specPath = path.join(OUTPUT_DIR, "model_spec.json");
  await fs.writeFile(specPath, JSON.stringify(spec, null, 2), "utf-8");

  const doc = buildDocumentFromSpec(spec);
  const io = new NodeIO();

  // GLB: self-contained binary (no external files)
  const glbPath = path.join(OUTPUT_DIR, "model.glb");
  await io.write(glbPath, doc);

  // GLTF: embed binary buffer as base64 data URI so no .bin file is needed
  const gltfPath = path.join(OUTPUT_DIR, "model.gltf");
  const { json, resources } = await io.writeJSON(doc);
  for (const [resPath, data] of Object.entries(resources)) {
    if (resPath.endsWith(".bin")) {
      const b64 = Buffer.from(data).toString("base64");
      const bufIdx = json.buffers.findIndex(b => b.uri === resPath || !b.uri);
      if (bufIdx >= 0) json.buffers[bufIdx].uri = `data:application/octet-stream;base64,${b64}`;
    }
  }
  await fs.writeFile(gltfPath, JSON.stringify(json, null, 2), "utf-8");

  console.log("prompt2gltf generation complete.");
  if (templateArg) console.log(`Template: ${templateArg}`);
  console.log(`Prompt: ${prompt}`);
  console.log(`Subject: ${spec.promptInterpretation.normalizedSubject || spec.promptInterpretation.subject}`);
  console.log(`Parts: ${spec.parts.length}`);
  console.log(`SurfaceDetails: ${spec.surfaceDetails?.length ?? 0}`);
  console.log(`Ornaments: ${spec.ornaments?.length ?? 0}`);
  console.log(`Output: ${OUTPUT_DIR}`);
  console.log(`- ${specPath}`);
  console.log(`- ${gltfPath}`);
  console.log(`- ${glbPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});






