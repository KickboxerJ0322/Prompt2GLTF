// ==============================
// Cesium Sandcastle 用
// Google Photorealistic 3D Tiles
// ヘリ：お台場 → レインボーブリッジ → 東京タワー
// ドローン風上方追尾カメラ
// ==============================

// ------------------------------------
// モデル向き補正
// ------------------------------------
const HEADING_FIX_DEG = 0;
const PITCH_FIX_DEG   = 0;
const ROLL_FIX_DEG    = 0;

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
  name: "ヘリコプター",
  glb: "https://raw.githubusercontent.com/KickboxerJ0322/Prompt2GLTF/master/glb/heli.glb",
  scale: 4.0,
  minimumPixelSize: 48,
  maximumScale: 600,
  heightMeters: 350,
  speedMultiplier: 2,
  pathWidth: 3,

  // ドローン風追尾カメラ
  followOffset: new Cesium.Cartesian3(-250, 0, 70),
  lookOffset:   new Cesium.Cartesian3( 100, 0,  0),
  cameraSmooth: 0.06,
};

// ------------------------------------
// ルート：お台場 → レインボーブリッジ → 東京タワー
// [秒, 経度, 緯度]
// ------------------------------------
const route2D = [
  [  0, 139.7757, 35.6270], // お台場海浜公園（出発）
  [ 12, 139.7680, 35.6298], // レインボーブリッジ東側
  [ 24, 139.7620, 35.6322], // レインボーブリッジ中央
  [ 36, 139.7545, 35.6355], // レインボーブリッジ西側（芝浦）
  [ 48, 139.7515, 35.6420], // 芝浦ふ頭上空
  [ 60, 139.7495, 35.6480], // 港南・田町上空
  [ 72, 139.7470, 35.6535], // 芝・浜松町上空
  [ 88, 139.7454, 35.6586], // 東京タワー（到着）
];

// ------------------------------------
// 周辺地名ラベル（お台場〜東京タワーエリア）
// ------------------------------------
const DEFAULT_PLACE_LABELS = [
  { name: "お台場海浜公園",     lon: 139.7757, lat: 35.6270, height: 20, color: "CYAN"   },
  { name: "レインボーブリッジ", lon: 139.7620, lat: 35.6330, height: 20, color: "YELLOW" },
  { name: "芝浦ふ頭",           lon: 139.7515, lat: 35.6420, height: 20, color: "WHITE"  },
  { name: "東京タワー",         lon: 139.7454, lat: 35.6586, height: 20, color: "ORANGE" },
  { name: "フジテレビ",         lon: 139.7797, lat: 35.6279, height: 20, color: "WHITE"  },
  { name: "有明ガーデン",       lon: 139.7919, lat: 35.6359, height: 20, color: "WHITE"  },
  { name: "汐留",               lon: 139.7582, lat: 35.6608, height: 20, color: "WHITE"  },
  { name: "浜松町",             lon: 139.7565, lat: 35.6554, height: 20, color: "WHITE"  },
  { name: "品川",               lon: 139.7388, lat: 35.6284, height: 20, color: "WHITE"  },
  { name: "増上寺",             lon: 139.7490, lat: 35.6558, height: 20, color: "LIME"   },
];

// ------------------------------------
// 時刻設定
// ------------------------------------
const startIso = new Date().toISOString();
const start = Cesium.JulianDate.fromIso8601(startIso);
const stop = Cesium.JulianDate.addSeconds(
  start,
  route2D[route2D.length - 1][0],
  new Cesium.JulianDate()
);

viewer.clock.startTime = start.clone();
viewer.clock.stopTime = stop.clone();
viewer.clock.currentTime = start.clone();
viewer.clock.clockRange = Cesium.ClockRange.CLAMPED;
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
  interpolationDegree: 3,
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
// ルート線
// ------------------------------------
viewer.entities.add({
  name: "飛行ルート",
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
// 始点マーカー（お台場）
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
    text: "出発：お台場",
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
// 終点マーカー（東京タワー）
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
    text: "到着：東京タワー",
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
  { lon: 139.7620, lat: 35.6322, color: "YELLOW", label: "レインボーブリッジ中央" },
  { lon: 139.7545, lat: 35.6355, color: "WHITE",  label: "芝浦上空"               },
  { lon: 139.7515, lat: 35.6420, color: "CYAN",   label: "芝浦ふ頭上空"           },
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
// 最初に全体を俯瞰
// ------------------------------------
await viewer.camera.flyTo({
  destination: Cesium.Cartesian3.fromDegrees(139.7600, 35.6430, 18000),
  orientation: {
    heading: Cesium.Math.toRadians(0),
    pitch: Cesium.Math.toRadians(-50),
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

console.log("読み込み完了: ヘリ お台場 → レインボーブリッジ → 東京タワー（ドローン追尾カメラ・2倍速・88秒）");
