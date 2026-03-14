// ==============================
// Cesium Sandcastle 用
// Google Photorealistic 3D Tiles
// ヘリコプター：東京ビッグサイト → 皇居
// 後方追尾カメラ付き片道飛行
// ==============================

// ------------------------------------
// モデル向き補正（GLB の前方軸がずれている場合に調整）
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
// ヘリコプター設定
// ------------------------------------
const HELI = {
  name: "ヘリコプター",
  uri: "https://raw.githubusercontent.com/KickboxerJ0322/Prompt2GLTF/master/glb/heli.glb",
  scale: 2.0,
  minimumPixelSize: 48,
  maximumScale: 600,

  // 後方追尾カメラオフセット（モデルローカル座標）
  // X: 前方, Y: 左, Z: 上（VelocityOrientationProperty 基準）
  followOffset: new Cesium.Cartesian3(-250, 0, 70),  // 250m後方・70m上
  lookOffset:   new Cesium.Cartesian3( 100, 0,  0),  // 機体より少し前方を注視
  cameraSmooth: 0.06,                                 // 追尾の滑らかさ（小さいほど遅延大）
};

// ------------------------------------
// 飛行ルート：東京ビッグサイト → 皇居
// [秒, 経度, 緯度, 高度]
// ------------------------------------
const FLIGHT_ROUTE = [
  [  0, 139.7948, 35.6298, 150], // 東京ビッグサイト（出発）
  [ 10, 139.7919, 35.6359, 220], // 有明ガーデン上空
  [ 22, 139.7757, 35.6270, 280], // お台場海浜公園上空
  [ 36, 139.7565, 35.6356, 320], // レインボーブリッジ上空
  [ 48, 139.7450, 35.6450, 300], // 芝浦上空
  [ 60, 139.7454, 35.6586, 350], // 東京タワー上空
  [ 71, 139.7510, 35.6680, 280], // 虎ノ門上空
  [ 80, 139.7520, 35.6740, 220], // 霞が関上空
  [ 87, 139.7540, 35.6800, 160], // 皇居外苑上空
  [ 90, 139.7528, 35.6852, 100], // 皇居（到着）
];

// ------------------------------------
// クロック設定（終点で停止）
// ------------------------------------
const startIso = new Date().toISOString();
const start = Cesium.JulianDate.fromIso8601(startIso);
const totalSec = FLIGHT_ROUTE[FLIGHT_ROUTE.length - 1][0];
const stop = Cesium.JulianDate.addSeconds(start, totalSec, new Cesium.JulianDate());

viewer.clock.startTime = start.clone();
viewer.clock.stopTime = stop.clone();
viewer.clock.currentTime = start.clone();
viewer.clock.clockRange = Cesium.ClockRange.CLAMPED; // 到着で停止
viewer.clock.multiplier = 2;                         // 2倍速

// ------------------------------------
// 飛行ルート（SampledPositionProperty）
// ------------------------------------
const position = new Cesium.SampledPositionProperty();
position.setInterpolationOptions({
  interpolationDegree: 3,
  interpolationAlgorithm: Cesium.HermitePolynomialApproximation,
});

for (const [sec, lon, lat, height] of FLIGHT_ROUTE) {
  const t = Cesium.JulianDate.addSeconds(start, sec, new Cesium.JulianDate());
  position.addSample(t, Cesium.Cartesian3.fromDegrees(lon, lat, height));
}

// ------------------------------------
// 向き（速度方向 + 補正）
// ------------------------------------
const velocityOrientation = new Cesium.VelocityOrientationProperty(position);

// カメラ追尾用（補正なし）
const baseOrientation = new Cesium.CallbackProperty((time, result) => {
  return velocityOrientation.getValue(time, result);
}, false);

// モデル表示用（GLB軸補正あり）
const modelOrientation = new Cesium.CallbackProperty((time, result) => {
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
// ヘリコプター エンティティ
// ------------------------------------
viewer.entities.add({
  name: HELI.name,
  position: position,
  orientation: modelOrientation,
  availability: new Cesium.TimeIntervalCollection([
    new Cesium.TimeInterval({ start, stop }),
  ]),
  model: {
    uri: HELI.uri,
    scale: HELI.scale,
    minimumPixelSize: HELI.minimumPixelSize,
    maximumScale: HELI.maximumScale,
    runAnimations: true,
  },
  path: {
    width: 3,
    material: new Cesium.PolylineGlowMaterialProperty({
      glowPower: 0.2,
      color: Cesium.Color.YELLOW,
    }),
    leadTime: 0,
    trailTime: totalSec,
    resolution: 2,
  },
});

// ------------------------------------
// 飛行ルート ポリライン（全体）
// ------------------------------------
viewer.entities.add({
  polyline: {
    positions: FLIGHT_ROUTE.map(([, lon, lat, h]) =>
      Cesium.Cartesian3.fromDegrees(lon, lat, h)
    ),
    width: 2,
    material: new Cesium.PolylineDashMaterialProperty({
      color: Cesium.Color.YELLOW.withAlpha(0.35),
      dashLength: 16,
    }),
  },
});

// ------------------------------------
// 出発・到着マーカー
// ------------------------------------
const TERMINALS = [
  {
    lon: 139.7948, lat: 35.6298, height: 10,
    text: "出発：東京ビッグサイト",
    color: Cesium.Color.CYAN,
  },
  {
    lon: 139.7528, lat: 35.6852, height: 10,
    text: "到着：皇居",
    color: Cesium.Color.GOLD,
  },
];

for (const t of TERMINALS) {
  viewer.entities.add({
    position: Cesium.Cartesian3.fromDegrees(t.lon, t.lat, t.height),
    point: {
      pixelSize: 14,
      color: t.color,
      outlineColor: Cesium.Color.BLACK,
      outlineWidth: 2,
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
    },
    label: {
      text: t.text,
      font: "18px sans-serif",
      fillColor: t.color,
      outlineColor: Cesium.Color.BLACK,
      outlineWidth: 3,
      style: Cesium.LabelStyle.FILL_AND_OUTLINE,
      showBackground: true,
      backgroundColor: Cesium.Color.BLACK.withAlpha(0.45),
      pixelOffset: new Cesium.Cartesian2(0, -28),
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
    },
  });
}

// ------------------------------------
// 経由地名ラベル
// ------------------------------------
const PLACE_LABELS = [
  { name: "有明ガーデン",       lon: 139.7919, lat: 35.6359, color: "WHITE"  },
  { name: "お台場海浜公園",     lon: 139.7757, lat: 35.6270, color: "CYAN"   },
  { name: "レインボーブリッジ", lon: 139.7565, lat: 35.6356, color: "WHITE"  },
  { name: "東京タワー",         lon: 139.7454, lat: 35.6586, color: "ORANGE" },
  { name: "虎ノ門",             lon: 139.7510, lat: 35.6680, color: "WHITE"  },
  { name: "霞が関",             lon: 139.7520, lat: 35.6740, color: "WHITE"  },
  { name: "皇居外苑",           lon: 139.7540, lat: 35.6800, color: "LIME"   },
];

for (const place of PLACE_LABELS) {
  viewer.entities.add({
    position: Cesium.Cartesian3.fromDegrees(place.lon, place.lat, 20),
    label: {
      text: place.name,
      font: "15px sans-serif",
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
// 最初にルート全体を俯瞰
// ------------------------------------
await viewer.camera.flyTo({
  destination: Cesium.Cartesian3.fromDegrees(139.7730, 35.6580, 18000),
  orientation: {
    heading: Cesium.Math.toRadians(0),
    pitch: Cesium.Math.toRadians(-50),
    roll: 0,
  },
  duration: 2.0,
});

// ------------------------------------
// 後方追尾カメラ（preRender でフレーム毎に更新）
// ------------------------------------
let smoothCamPos;

viewer.scene.preRender.addEventListener(function (_scene, time) {
  const p = position.getValue(time);
  const q = baseOrientation.getValue(time);
  if (!Cesium.defined(p) || !Cesium.defined(q)) return;

  const rot = Cesium.Matrix3.fromQuaternion(q);

  // followOffset をワールド座標へ変換してカメラ目標位置を算出
  const worldFollow = Cesium.Matrix3.multiplyByVector(
    rot, HELI.followOffset, new Cesium.Cartesian3()
  );
  const desiredCamPos = Cesium.Cartesian3.add(p, worldFollow, new Cesium.Cartesian3());

  // lookOffset をワールド座標へ変換して注視点を算出
  const worldLook = Cesium.Matrix3.multiplyByVector(
    rot, HELI.lookOffset, new Cesium.Cartesian3()
  );
  const lookAt = Cesium.Cartesian3.add(p, worldLook, new Cesium.Cartesian3());

  // カメラ位置をスムーズに補間
  if (!Cesium.defined(smoothCamPos)) {
    smoothCamPos = Cesium.Cartesian3.clone(desiredCamPos);
  } else {
    Cesium.Cartesian3.lerp(smoothCamPos, desiredCamPos, HELI.cameraSmooth, smoothCamPos);
  }

  // カメラ方向ベクトルを計算
  const dir = Cesium.Cartesian3.normalize(
    Cesium.Cartesian3.subtract(lookAt, smoothCamPos, new Cesium.Cartesian3()),
    new Cesium.Cartesian3()
  );

  const localUp = Cesium.Ellipsoid.WGS84.geodeticSurfaceNormal(
    smoothCamPos, new Cesium.Cartesian3()
  );

  let right = Cesium.Cartesian3.cross(dir, localUp, new Cesium.Cartesian3());
  if (Cesium.Cartesian3.magnitude(right) < 1e-6) {
    right = Cesium.Cartesian3.clone(Cesium.Cartesian3.UNIT_X);
  } else {
    Cesium.Cartesian3.normalize(right, right);
  }

  const up = Cesium.Cartesian3.normalize(
    Cesium.Cartesian3.cross(right, dir, new Cesium.Cartesian3()),
    new Cesium.Cartesian3()
  );

  viewer.camera.setView({
    destination: smoothCamPos,
    orientation: { direction: dir, up: up },
  });
});

// ------------------------------------
// 読み込み完了
// ------------------------------------
console.log("読み込み完了: ヘリコプター 東京ビッグサイト → 皇居（後方追尾カメラ・6倍速）");
