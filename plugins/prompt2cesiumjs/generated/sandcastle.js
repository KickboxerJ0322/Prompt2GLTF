// ==============================
// Cesium Sandcastle 用
// Google Photorealistic 3D Tiles
// スフィンクス ホルムズ海峡横断
// カメラは真後ろから追尾
// ==============================

// ------------------------------------
// モデル向き補正
// ------------------------------------
const HEADING_FIX_DEG = 0;
const PITCH_FIX_DEG = 0;
const ROLL_FIX_DEG = 0;

// ------------------------------------
// Viewer
// ------------------------------------
const viewer = new Cesium.Viewer("cesiumContainer", {
  globe: false,
  animation: true,
  timeline: true,
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
// キャラクター設定
// ------------------------------------
const PERSON = {
  name: "スフィンクス",
  glb: "https://raw.githubusercontent.com/KickboxerJ0322/polyarch/main/public/gltf/sphinx_realish.gltf",
  scale: 0.2,
  minimumPixelSize: 64,
  maximumScale: 20,
  heightMeters: 40,        // デフォルト歩行高度
  speedMultiplier: 1.0,
  pathWidth: 4,

  // 真後ろ追尾カメラ
  followOffset: new Cesium.Cartesian3(-540.0, -2.0, 300.0),
  lookOffset: new Cesium.Cartesian3(0.0, 0.0, 2.2),
  cameraSmooth: 0.10,
};

// ------------------------------------
// ルート（ホルムズ海峡 イラン→オマーン 南下）
// [秒, 経度, 緯度]
// ------------------------------------
const route2D = [
  [0,   56.2700, 27.1800],  // バンダルアッバース沿岸（イラン・スタート）
  [40,  56.3100, 27.0300],  // 海峡北部
  [80,  56.3800, 26.8800],  // ホルムズ島付近
  [120, 56.4200, 26.7200],  // 海峡最狭部（約54km幅）
  [160, 56.4500, 26.5400],  // 海峡中央部
  [200, 56.4600, 26.3800],  // 海峡南部
  [240, 56.4400, 26.2200],  // ムサンダム半島沖
  [270, 56.4100, 26.0800],  // ムサンダム半島（オマーン・ゴール）
];

// ------------------------------------
// 周辺地名ラベル
// ------------------------------------
const DEFAULT_PLACE_LABELS = [
  { name: "バンダルアッバース（イラン）", lon: 56.2808, lat: 27.1832, height: 40, color: "CYAN" },
  { name: "ホルムズ島",                   lon: 56.4614, lat: 27.0667, height: 40, color: "YELLOW" },
  { name: "ムサンダム半島（オマーン）",   lon: 56.4000, lat: 26.1000, height: 40, color: "CYAN" },
  { name: "ペルシャ湾",                   lon: 55.5000, lat: 27.8000, height: 40, color: "WHITE" },
  { name: "オマーン湾",                   lon: 57.5000, lat: 24.5000, height: 40, color: "WHITE" },
  { name: "アラブ首長国連邦",             lon: 55.2708, lat: 25.2048, height: 40, color: "ORANGE" },
  { name: "イラン",                       lon: 56.0000, lat: 28.0000, height: 40, color: "ORANGE" },
  { name: "オマーン",                     lon: 57.0000, lat: 23.0000, height: 40, color: "LIME" },
];

// ------------------------------------
// 時刻設定
// ------------------------------------
const startIso = "2025-01-01T09:00:00Z";
const start = Cesium.JulianDate.fromIso8601(startIso);
const stop = Cesium.JulianDate.addSeconds(
  start,
  route2D[route2D.length - 1][0],
  new Cesium.JulianDate()
);

viewer.clock.startTime = start.clone();
viewer.clock.stopTime = stop.clone();
viewer.clock.currentTime = start.clone();
viewer.clock.clockRange = Cesium.ClockRange.LOOP_STOP;
viewer.clock.multiplier = PERSON.speedMultiplier;
viewer.clock.shouldAnimate = true;

// ------------------------------------
// 位置サンプル
// ------------------------------------
const position = new Cesium.SampledPositionProperty();

for (const [sec, lon, lat] of route2D) {
  const time = Cesium.JulianDate.addSeconds(start, sec, new Cesium.JulianDate());
  const pos = Cesium.Cartesian3.fromDegrees(lon, lat, PERSON.heightMeters);
  position.addSample(time, pos);
}

position.setInterpolationOptions({
  interpolationDegree: 1,
  interpolationAlgorithm: Cesium.LinearApproximation,
});

// ------------------------------------
// 進行方向ベースの向き
// ------------------------------------
const velocityOrientation = new Cesium.VelocityOrientationProperty(position);

const baseOrientation = new Cesium.CallbackProperty(function (time, result) {
  return velocityOrientation.getValue(time, result);
}, false);

const modelOrientation = new Cesium.CallbackProperty(function (time, result) {
  const baseQ = velocityOrientation.getValue(time, result);
  if (!Cesium.defined(baseQ)) return undefined;

  const fixQ = Cesium.Quaternion.fromHeadingPitchRoll(
    new Cesium.HeadingPitchRoll(
      Cesium.Math.toRadians(HEADING_FIX_DEG),
      Cesium.Math.toRadians(PITCH_FIX_DEG),
      Cesium.Math.toRadians(ROLL_FIX_DEG)
    )
  );

  return Cesium.Quaternion.multiply(baseQ, fixQ, new Cesium.Quaternion());
}, false);

// ------------------------------------
// ルート線
// ------------------------------------
viewer.entities.add({
  name: "ホルムズ海峡横断ルート",
  polyline: {
    positions: route2D.map(([, lon, lat]) =>
      Cesium.Cartesian3.fromDegrees(lon, lat, PERSON.heightMeters)
    ),
    width: PERSON.pathWidth,
    material: new Cesium.PolylineOutlineMaterialProperty({
      color: Cesium.Color.CYAN.withAlpha(0.9),
      outlineColor: Cesium.Color.BLACK,
      outlineWidth: 1,
    }),
  },
});

// ------------------------------------
// 始点マーカー
// ------------------------------------
viewer.entities.add({
  position: Cesium.Cartesian3.fromDegrees(
    route2D[0][1],
    route2D[0][2],
    PERSON.heightMeters
  ),
  point: {
    pixelSize: 14,
    color: Cesium.Color.LIME,
    outlineColor: Cesium.Color.BLACK,
    outlineWidth: 2,
    disableDepthTestDistance: Number.POSITIVE_INFINITY,
  },
  label: {
    text: "バンダルアッバース（出発）",
    font: "20px sans-serif",
    fillColor: Cesium.Color.LIME,
    outlineColor: Cesium.Color.BLACK,
    outlineWidth: 3,
    style: Cesium.LabelStyle.FILL_AND_OUTLINE,
    pixelOffset: new Cesium.Cartesian2(0, -30),
    disableDepthTestDistance: Number.POSITIVE_INFINITY,
  },
});

// ------------------------------------
// 終点マーカー
// ------------------------------------
viewer.entities.add({
  position: Cesium.Cartesian3.fromDegrees(
    route2D[route2D.length - 1][1],
    route2D[route2D.length - 1][2],
    PERSON.heightMeters
  ),
  point: {
    pixelSize: 14,
    color: Cesium.Color.YELLOW,
    outlineColor: Cesium.Color.BLACK,
    outlineWidth: 2,
    disableDepthTestDistance: Number.POSITIVE_INFINITY,
  },
  label: {
    text: "ムサンダム半島（到着）",
    font: "20px sans-serif",
    fillColor: Cesium.Color.YELLOW,
    outlineColor: Cesium.Color.BLACK,
    outlineWidth: 3,
    style: Cesium.LabelStyle.FILL_AND_OUTLINE,
    pixelOffset: new Cesium.Cartesian2(0, -30),
    disableDepthTestDistance: Number.POSITIVE_INFINITY,
  },
});

// ------------------------------------
// 経由点マーカー
// ------------------------------------
const WAYPOINTS = [
  { lon: 56.4614, lat: 27.0667, label: "ホルムズ島",     color: "ORANGE" },
  { lon: 56.4200, lat: 26.7200, label: "海峡最狭部",     color: "ORANGE" },
  { lon: 56.4600, lat: 26.3800, label: "海峡南部",       color: "ORANGE" },
];

for (const wp of WAYPOINTS) {
  viewer.entities.add({
    position: Cesium.Cartesian3.fromDegrees(wp.lon, wp.lat, PERSON.heightMeters),
    point: {
      pixelSize: 10,
      color: Cesium.Color[wp.color] || Cesium.Color.ORANGE,
      outlineColor: Cesium.Color.BLACK,
      outlineWidth: 2,
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
    },
    label: {
      text: wp.label,
      font: "18px sans-serif",
      fillColor: Cesium.Color[wp.color] || Cesium.Color.ORANGE,
      outlineColor: Cesium.Color.BLACK,
      outlineWidth: 3,
      style: Cesium.LabelStyle.FILL_AND_OUTLINE,
      pixelOffset: new Cesium.Cartesian2(0, -26),
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
    },
  });
}

// ------------------------------------
// 周辺地名ラベル表示
// ------------------------------------
for (const place of DEFAULT_PLACE_LABELS) {
  viewer.entities.add({
    position: Cesium.Cartesian3.fromDegrees(
      place.lon,
      place.lat,
      place.height ?? PERSON.heightMeters
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
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
    },
  });
}

// ------------------------------------
// モデル本体
// モデル名称ラベルは表示しない
// ------------------------------------
const player = viewer.entities.add({
  name: PERSON.name,
  position: position,
  orientation: modelOrientation,
  availability: new Cesium.TimeIntervalCollection([
    new Cesium.TimeInterval({ start, stop }),
  ]),
  model: {
    uri: PERSON.glb,
    scale: PERSON.scale,
    minimumPixelSize: PERSON.minimumPixelSize,
    maximumScale: PERSON.maximumScale,
    runAnimations: true,
  },
  path: {
    width: PERSON.pathWidth,
    material: new Cesium.PolylineOutlineMaterialProperty({
      color: Cesium.Color.CYAN.withAlpha(0.55),
      outlineColor: Cesium.Color.BLACK,
      outlineWidth: 1,
    }),
    leadTime: 0,
    trailTime: 9999,
    resolution: 5,
  },
});

// ------------------------------------
// 最初にホルムズ海峡全体を俯瞰
// ------------------------------------
await viewer.camera.flyTo({
  destination: Cesium.Cartesian3.fromDegrees(
    56.3500,
    26.6500,
    200000
  ),
  orientation: {
    heading: Cesium.Math.toRadians(0),
    pitch: Cesium.Math.toRadians(-50),
    roll: 0,
  },
  duration: 1.5,
});

// ------------------------------------
// 真後ろから追尾カメラ
// ------------------------------------
let smoothCamPos;

viewer.scene.preRender.addEventListener(function (_scene, time) {
  const p = position.getValue(time);
  const q = baseOrientation.getValue(time);

  if (!Cesium.defined(p) || !Cesium.defined(q)) return;

  const rot = Cesium.Matrix3.fromQuaternion(q);

  const worldFollowOffset = Cesium.Matrix3.multiplyByVector(
    rot,
    PERSON.followOffset,
    new Cesium.Cartesian3()
  );

  const desiredCamPos = Cesium.Cartesian3.add(
    p,
    worldFollowOffset,
    new Cesium.Cartesian3()
  );

  const worldLookOffset = Cesium.Matrix3.multiplyByVector(
    rot,
    PERSON.lookOffset,
    new Cesium.Cartesian3()
  );

  const targetLookAt = Cesium.Cartesian3.add(
    p,
    worldLookOffset,
    new Cesium.Cartesian3()
  );

  if (!Cesium.defined(smoothCamPos)) {
    smoothCamPos = Cesium.Cartesian3.clone(desiredCamPos);
  } else {
    Cesium.Cartesian3.lerp(
      smoothCamPos,
      desiredCamPos,
      PERSON.cameraSmooth,
      smoothCamPos
    );
  }

  const dir = Cesium.Cartesian3.normalize(
    Cesium.Cartesian3.subtract(
      targetLookAt,
      smoothCamPos,
      new Cesium.Cartesian3()
    ),
    new Cesium.Cartesian3()
  );

  const localUp = Cesium.Ellipsoid.WGS84.geodeticSurfaceNormal(
    smoothCamPos,
    new Cesium.Cartesian3()
  );

  let right = Cesium.Cartesian3.cross(
    dir,
    localUp,
    new Cesium.Cartesian3()
  );

  if (Cesium.Cartesian3.magnitude(right) < 1e-6) {
    right = Cesium.Cartesian3.clone(Cesium.Cartesian3.UNIT_X);
  } else {
    right = Cesium.Cartesian3.normalize(right, right);
  }

  const up = Cesium.Cartesian3.normalize(
    Cesium.Cartesian3.cross(right, dir, new Cesium.Cartesian3()),
    new Cesium.Cartesian3()
  );

  viewer.camera.setView({
    destination: smoothCamPos,
    orientation: {
      direction: dir,
      up: up,
    },
  });
});

console.log("読み込み完了: スフィンクス ホルムズ海峡横断");
