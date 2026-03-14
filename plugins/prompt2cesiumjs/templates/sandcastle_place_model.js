// ==============================
// Cesium Sandcastle 用
// Google Photorealistic 3D Tiles
// {{DESCRIPTION}}
// 固定配置モデル表示テンプレート
// ==============================

// ------------------------------------
// Viewer
// ------------------------------------
const viewer = new Cesium.Viewer("cesiumContainer", {
  globe: false,
  animation: false,
  timeline: false,
  shouldAnimate: true,
  infoBox: false,
  selectionIndicator: false,
  geocoder: false,
});

viewer.scene.skyAtmosphere.show = true;
viewer.scene.fog.enabled = true;

// ------------------------------------
// Google Photorealistic 3D Tiles
// ------------------------------------
try {
  const googleTileset = await Cesium.createGooglePhotorealistic3DTileset();
  viewer.scene.primitives.add(googleTileset);
} catch (error) {
  console.log("Google Photorealistic 3D Tiles の読み込みに失敗:", error);
  throw error;
}

// ------------------------------------
// モデル設定
// ------------------------------------
const MODEL = {
  name: "{{MODEL_NAME}}",
  uri: (() => {
    const modelUrl = "{{MODEL_URL}}".trim();
    return !modelUrl || modelUrl === "{{MODEL_URL}}"
      ? "https://raw.githubusercontent.com/KickboxerJ0322/Prompt2GLTF/master/glb/tower.glb"
      : modelUrl;
  })(),

  // 設置座標
  lat: {{LAT}},
  lon: {{LON}},
  height: {{HEIGHT}},

  // モデル向き
  headingDeg: {{HEADING_DEG}},
  pitchDeg: {{PITCH_DEG}},
  rollDeg: {{ROLL_DEG}},

  // モデルサイズ
  scale: {{SCALE}},
  minimumPixelSize: {{MINIMUM_PIXEL_SIZE}},
  maximumScale: {{MAXIMUM_SCALE}}
};

// ------------------------------------
// 周辺地名ラベル（10件）
// 必要に応じて Skill 側で差し替え可
// ------------------------------------
const DEFAULT_PLACE_LABELS = [
  { name: "台場公園", lon: 139.7709, lat: 35.6308, height: 20, color: "CYAN" },
  { name: "お台場海浜公園", lon: 139.7769, lat: 35.6299, height: 20, color: "WHITE" },
  { name: "自由の女神像", lon: 139.7731, lat: 35.6303, height: 20, color: "YELLOW" },
  { name: "フジテレビ", lon: 139.7797, lat: 35.6279, height: 20, color: "LIME" },
  { name: "デックス東京ビーチ", lon: 139.7747, lat: 35.6317, height: 20, color: "WHITE" },
  { name: "アクアシティお台場", lon: 139.7737, lat: 35.6287, height: 20, color: "WHITE" },
  { name: "レインボーブリッジ", lon: 139.7757, lat: 35.6365, height: 30, color: "ORANGE" },
  { name: "台場駅", lon: 139.7760, lat: 35.6256, height: 20, color: "CYAN" },
  { name: "東京国際クルーズターミナル", lon: 139.7787, lat: 35.6188, height: 20, color: "WHITE" },
  { name: "船の科学館", lon: 139.7784, lat: 35.6197, height: 20, color: "WHITE" }
];

// ------------------------------------
// 位置と向き
// ------------------------------------
const modelPosition = Cesium.Cartesian3.fromDegrees(
  MODEL.lon,
  MODEL.lat,
  MODEL.height
);

const hpr = new Cesium.HeadingPitchRoll(
  Cesium.Math.toRadians(MODEL.headingDeg),
  Cesium.Math.toRadians(MODEL.pitchDeg),
  Cesium.Math.toRadians(MODEL.rollDeg)
);

const modelOrientation = Cesium.Transforms.headingPitchRollQuaternion(
  modelPosition,
  hpr
);

// ------------------------------------
// モデル配置
// モデル名称ラベルは表示しない
// ------------------------------------
const placedModel = viewer.entities.add({
  name: MODEL.name,
  position: modelPosition,
  orientation: modelOrientation,
  model: {
    uri: MODEL.uri,
    scale: MODEL.scale,
    minimumPixelSize: MODEL.minimumPixelSize,
    maximumScale: MODEL.maximumScale,
    runAnimations: false
  }
});

// ------------------------------------
// 設置位置マーカー
// ------------------------------------
viewer.entities.add({
  position: modelPosition,
  point: {
    pixelSize: {{MARKER_PIXEL_SIZE}},
    color: Cesium.Color.{{MARKER_COLOR}},
    outlineColor: Cesium.Color.BLACK,
    outlineWidth: 2,
    disableDepthTestDistance: Number.POSITIVE_INFINITY
  },
  label: {
    text: "{{MARKER_LABEL}}",
    font: "18px sans-serif",
    fillColor: Cesium.Color.{{MARKER_COLOR}},
    outlineColor: Cesium.Color.BLACK,
    outlineWidth: 3,
    style: Cesium.LabelStyle.FILL_AND_OUTLINE,
    pixelOffset: new Cesium.Cartesian2(0, -28),
    disableDepthTestDistance: Number.POSITIVE_INFINITY
  }
});

// ------------------------------------
// 周辺地名ラベル表示
// ------------------------------------
for (const place of DEFAULT_PLACE_LABELS) {
  viewer.entities.add({
    position: Cesium.Cartesian3.fromDegrees(
      place.lon,
      place.lat,
      place.height ?? 20
    ),
    label: {
      text: place.name,
      font: "18px sans-serif",
      fillColor: Cesium.Color[place.color] || Cesium.Color.WHITE,
      outlineColor: Cesium.Color.BLACK,
      outlineWidth: 3,
      style: Cesium.LabelStyle.FILL_AND_OUTLINE,
      showBackground: true,
      backgroundColor: Cesium.Color.BLACK.withAlpha(0.35),
      pixelOffset: new Cesium.Cartesian2(0, -20),
      disableDepthTestDistance: Number.POSITIVE_INFINITY
    }
  });
}

// ------------------------------------
// 初期カメラ
// ------------------------------------
await viewer.camera.flyTo({
  destination: Cesium.Cartesian3.fromDegrees(
    MODEL.lon,
    MODEL.lat,
    {{CAMERA_HEIGHT}}
  ),
  orientation: {
    heading: Cesium.Math.toRadians({{CAMERA_HEADING_DEG}}),
    pitch: Cesium.Math.toRadians({{CAMERA_PITCH_DEG}}),
    roll: 0
  },
  duration: {{FLY_DURATION}}
});

// ------------------------------------
// 読み込み完了
// ------------------------------------
console.log("読み込み完了: {{LOG_LABEL}}");
