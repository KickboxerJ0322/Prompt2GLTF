// ==============================
// Cesium Sandcastle 用
// Google Photorealistic 3D Tiles
// 東京ヘリポートセンター → 皇居 ヘリコプター飛行
// カメラはドローン風の上方追尾
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
  const googleTileset = await Cesium.createGooglePhotorealistic3DTileset({
    onlyUsingWithGoogleGeocoder: true,
  });
  viewer.scene.primitives.add(googleTileset);
} catch (error) {
  console.log("Google Photorealistic 3D Tiles の読み込みに失敗:", error);
  throw error;
}

// ------------------------------------
// キャラクター設定（ヘリコプター）
// ------------------------------------
const PERSON = {
  name: "ヘリコプター",
  glb: "https://raw.githubusercontent.com/KickboxerJ0322/Prompt2GLTF/master/glb/heli.glb",
  scale: 4.0,
  minimumPixelSize: 48,
  maximumScale: 600,
  heightMeters: 350,
  speedMultiplier: 4,
  pathWidth: 3,

  // ドローン風追尾カメラ
  followOffset: new Cesium.Cartesian3(-250, 0, 70),
  lookOffset: new Cesium.Cartesian3(100, 0, 0),
  cameraSmooth: 0.06,
};

// ------------------------------------
// ルート: 東京ヘリポートセンター → 東京タワー経由 → 皇居
// [秒, 経度, 緯度, 高度m]
// ビルの間を縫うように低空飛行、東京タワー中腹を通過
// ------------------------------------
const route2D = [
  [0,   139.8170, 35.6490, 100], // 東京ヘリポートセンター（辰巳）離陸
  [10,  139.8050, 35.6550, 320], // 辰巳運河上空　上昇
  [18,  139.7900, 35.6605, 310], // 月島　降下開始
  [26,  139.7780, 35.6648, 250], // 銀座東　低空進入
  [32,  139.7700, 35.6655, 270], // 銀座四丁目　超低空（ビル間）
  [38,  139.7625, 35.6638, 290], // 銀座西・新橋ビル間
  [44,  139.7545, 35.6618, 250], // 新橋・汐留　ビル群縫う
  [50,  139.7475, 35.6592, 300], // 芝公園・御成門方面
  [58,  139.7454, 35.6586, 380], // 東京タワー付近（中腹を通過）
  [65,  139.7440, 35.6645, 250], // 神谷町　ビル群を避けて高め
  [72,  139.7480, 35.6715, 230], // 霞が関　官庁ビル上空
  [80,  139.7515, 35.6768, 200], // 桜田門外　降下開始
  [88,  139.7530, 35.6820, 120], // 皇居南東　低く
  [96,  139.7528, 35.6852,  100], // 皇居（本丸跡）着陸
  [120,  139.7528, 35.6852,  600], // 皇居（本丸跡）上昇
];

// ------------------------------------
// 周辺地名ラベル
// ------------------------------------
const DEFAULT_PLACE_LABELS = [
  { name: "東京ヘリポート",     lon: 139.8170, lat: 35.6490, height: 30,  color: "LIME"   },
  { name: "辰巳運河",           lon: 139.8070, lat: 35.6540, height: 20,  color: "CYAN"   },
  { name: "月島",               lon: 139.7850, lat: 35.6620, height: 20,  color: "WHITE"  },
  { name: "晴海フラッグ",       lon: 139.7780, lat: 35.6576, height: 20,  color: "WHITE"  },
  { name: "銀座四丁目",         lon: 139.7655, lat: 35.6717, height: 20,  color: "YELLOW" },
  { name: "日比谷公園",         lon: 139.7574, lat: 35.6735, height: 20,  color: "LIME"   },
  { name: "東京タワー",         lon: 139.7454, lat: 35.6586, height: 30,  color: "ORANGE" },
  { name: "皇居外苑",           lon: 139.7568, lat: 35.6800, height: 20,  color: "CYAN"   },
  { name: "国会議事堂",         lon: 139.7454, lat: 35.6763, height: 20,  color: "WHITE"  },
  { name: "東京駅",             lon: 139.7671, lat: 35.6812, height: 20,  color: "WHITE"  },
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

for (const [sec, lon, lat, alt] of route2D) {
  const time = Cesium.JulianDate.addSeconds(start, sec, new Cesium.JulianDate());
  // alt が指定されている場合はそれを使い、なければ PERSON.heightMeters にフォールバック
  const pos = Cesium.Cartesian3.fromDegrees(lon, lat, alt ?? PERSON.heightMeters);
  position.addSample(time, pos);
}

position.setInterpolationOptions({
  interpolationDegree: 5,
  interpolationAlgorithm: Cesium.HermitePolynomialApproximation,
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
// 計画ルート（点線）: ウェイポイントを直線でつないだ予定ルート
// ------------------------------------
viewer.entities.add({
  name: "東京ヘリポート〜皇居 計画ルート",
  polyline: {
    positions: route2D.map(([, lon, lat, alt]) =>
      Cesium.Cartesian3.fromDegrees(lon, lat, alt ?? PERSON.heightMeters)
    ),
    width: 2,
    material: new Cesium.PolylineDashMaterialProperty({
      color: Cesium.Color.WHITE.withAlpha(0.55),
      dashLength: 24,
    }),
  },
});

// ------------------------------------
// 始点マーカー（東京ヘリポートセンター）
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
    text: "東京ヘリポートセンター",
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
// 終点マーカー（皇居）
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
    text: "皇居",
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
// 経由地点マーカー
// ------------------------------------
const WAYPOINTS = [
  { label: "銀座低空通過",     lon: 139.7700, lat: 35.6655, color: "ORANGE" },
  { label: "東京タワー（中腹）", lon: 139.7454, lat: 35.6586, color: "RED"    },
  { label: "霞が関低空",       lon: 139.7480, lat: 35.6715, color: "ORANGE" },
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
// モデル本体（ヘリコプター）
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
// 最初に全体を見せる（ルート俯瞰）
// ------------------------------------
await viewer.camera.flyTo({
  destination: Cesium.Cartesian3.fromDegrees(
    139.7850,
    35.6670,
    5000
  ),
  orientation: {
    heading: Cesium.Math.toRadians(0),
    pitch: Cesium.Math.toRadians(-55),
    roll: 0,
  },
  duration: 1.5,
});

// ------------------------------------
// ドローン風の上方追尾カメラ
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

console.log("読み込み完了: 東京ヘリポートセンター → 皇居 ヘリコプター飛行");
