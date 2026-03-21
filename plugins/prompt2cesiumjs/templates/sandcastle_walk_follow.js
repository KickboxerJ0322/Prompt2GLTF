// ==============================
// Cesium Sandcastle 用
// Google Photorealistic 3D Tiles
// {{DESCRIPTION}}
// カメラは真後ろから追尾
// ==============================

// ------------------------------------
// モデル向き補正
// ------------------------------------
const HEADING_FIX_DEG = {{HEADING_FIX_DEG}};
const PITCH_FIX_DEG = {{PITCH_FIX_DEG}};
const ROLL_FIX_DEG = {{ROLL_FIX_DEG}};

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
// キャラクター設定
// ------------------------------------
const PERSON = {
  name: "{{NAME}}",
  glb: (() => {
    const modelUrl = "{{MODEL_URL}}".trim();
    return !modelUrl || modelUrl === "{{MODEL_URL}}"
      ? "https://raw.githubusercontent.com/KickboxerJ0322/Prompt2GLTF/master/glb/robo.glb"
      : modelUrl;
  })(),
  scale: 0.05, // robo用
  minimumPixelSize: 64,
  maximumScale: 20,
  heightMeters: 40, // 40程度
  speedMultiplier: 1, // 1.0程度
  pathWidth: 4, // 4程度

  // 真後ろ追尾カメラ
  followOffset: new Cesium.Cartesian3(-3.0, -0.0, 3.0), //デフォルト(-3.0, -0.0, 3.0)
  lookOffset: new Cesium.Cartesian3({{LOOK_X}}, {{LOOK_Y}}, {{LOOK_Z}}), //デフォルト(0.0, 0.0, 2.2)
  cameraSmooth: {{CAMERA_SMOOTH}}, //デフォルト0.10
};

// ------------------------------------
// ルート
// [秒, 経度, 緯度]
// ------------------------------------
const route2D = {{ROUTE_2D}};

// ------------------------------------
// 周辺地名ラベル（10件）
// 必要に応じて Skill 側で差し替え可
// ------------------------------------
// const DEFAULT_PLACE_LABELS = [
//   { name: "台場公園", lon: 139.7709, lat: 35.6308, height: 20, color: "CYAN" },
//   { name: "お台場海浜公園", lon: 139.7769, lat: 35.6299, height: 20, color: "WHITE" },
//   { name: "自由の女神像", lon: 139.7731, lat: 35.6303, height: 20, color: "YELLOW" },
//   { name: "フジテレビ", lon: 139.7797, lat: 35.6279, height: 20, color: "LIME" },
//   { name: "デックス東京ビーチ", lon: 139.7747, lat: 35.6317, height: 20, color: "WHITE" },
//   { name: "アクアシティお台場", lon: 139.7737, lat: 35.6287, height: 20, color: "WHITE" },
//   { name: "レインボーブリッジ", lon: 139.7757, lat: 35.6365, height: 30, color: "ORANGE" },
//   { name: "台場駅", lon: 139.7760, lat: 35.6256, height: 20, color: "CYAN" },
//   { name: "東京国際クルーズターミナル", lon: 139.7787, lat: 35.6188, height: 20, color: "WHITE" },
//   { name: "船の科学館", lon: 139.7784, lat: 35.6197, height: 20, color: "WHITE" }
// ];

// ------------------------------------
// 時刻設定
// ------------------------------------
const startIso = "{{START_ISO}}";
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
// プレイヤー高さオフセット（Q/Eで上下）
// ------------------------------------
let playerHeightOffset = 0;
const HEIGHT_STEP = 1.0; // 1mずつ

const offsetPosition = new Cesium.CallbackProperty(function (time, result) {
  const p = position.getValue(time);
  if (!Cesium.defined(p)) return undefined;
  const up = Cesium.Ellipsoid.WGS84.geodeticSurfaceNormal(p, new Cesium.Cartesian3());
  return Cesium.Cartesian3.add(
    p,
    Cesium.Cartesian3.multiplyByScalar(up, playerHeightOffset, new Cesium.Cartesian3()),
    result || new Cesium.Cartesian3()
  );
}, false);

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
  name: "{{ROUTE_NAME}}",
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
    text: "{{START_LABEL}}",
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
    text: "{{END_LABEL}}",
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
// 任意の経由点マーカー
// ------------------------------------
const WAYPOINTS = {{WAYPOINTS}};

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
  position: offsetPosition,
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
});

// ------------------------------------
// 軌跡（path）は SampledPositionProperty を使う別エンティティ
// CallbackProperty は getValueInReferenceFrame 未実装のため path に使えない
// ------------------------------------
viewer.entities.add({
  position: position,
  availability: new Cesium.TimeIntervalCollection([
    new Cesium.TimeInterval({ start, stop }),
  ]),
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
// 最初に全体を見せる
// ------------------------------------
await viewer.camera.flyTo({
  destination: Cesium.Cartesian3.fromDegrees(
    {{FLYTO_LON}},
    {{FLYTO_LAT}},
    {{FLYTO_HEIGHT}}
  ),
  orientation: {
    heading: Cesium.Math.toRadians({{FLYTO_HEADING_DEG}}),
    pitch: Cesium.Math.toRadians({{FLYTO_PITCH_DEG}}),
    roll: 0,
  },
  duration: 1.5,
});

// ------------------------------------
// 真後ろから追尾カメラ
// カメラは baseOrientation を使う
// ------------------------------------
let smoothCamPos;
let followCamera = true; // false = フリーカメラモード

viewer.scene.preRender.addEventListener(function (_scene, time) {
  if (!followCamera) return;

  const p = position.getValue(time);
  const q = baseOrientation.getValue(time);

  if (!Cesium.defined(p) || !Cesium.defined(q)) return;

  // 高さオフセットを適用したプレイヤー位置
  const pUp = Cesium.Ellipsoid.WGS84.geodeticSurfaceNormal(p, new Cesium.Cartesian3());
  const pOffset = Cesium.Cartesian3.add(
    p,
    Cesium.Cartesian3.multiplyByScalar(pUp, playerHeightOffset, new Cesium.Cartesian3()),
    new Cesium.Cartesian3()
  );

  const rot = Cesium.Matrix3.fromQuaternion(q);

  const worldFollowOffset = Cesium.Matrix3.multiplyByVector(
    rot,
    PERSON.followOffset,
    new Cesium.Cartesian3()
  );

  const desiredCamPos = Cesium.Cartesian3.add(
    pOffset,
    worldFollowOffset,
    new Cesium.Cartesian3()
  );

  const worldLookOffset = Cesium.Matrix3.multiplyByVector(
    rot,
    PERSON.lookOffset,
    new Cesium.Cartesian3()
  );

  const targetLookAt = Cesium.Cartesian3.add(
    pOffset,
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

// ------------------------------------
// キーボード操作
// Q/E : プレイヤーを上下
// F   : フォローカメラ ⇔ フリーカメラ 切り替え
// ------------------------------------
document.addEventListener("keydown", function (e) {
  switch (e.key) {
    case "q":
    case "Q":
      playerHeightOffset += HEIGHT_STEP;
      break;
    case "e":
    case "E":
      playerHeightOffset -= HEIGHT_STEP;
      break;
    case "f":
    case "F":
      followCamera = !followCamera;
      if (followCamera) {
        // フォローモードに戻ったらスムージングをリセット
        smoothCamPos = undefined;
      }
      console.log("カメラモード:", followCamera ? "フォロー" : "フリー");
      break;
  }
});

// ------------------------------------
// 操作ガイド HUD（左上）
// ------------------------------------
const hud = document.createElement("div");
hud.style.cssText = `
  position: absolute;
  top: 16px;
  left: 16px;
  background: rgba(0, 0, 0, 0.55);
  color: #fff;
  font-family: sans-serif;
  font-size: 13px;
  line-height: 1.8;
  padding: 10px 14px;
  border-radius: 6px;
  pointer-events: none;
  z-index: 999;
  white-space: nowrap;
`;
hud.innerHTML = `
  <div style="font-size:15px; font-weight:bold; margin-bottom:6px;">🚶 Walk Follow Mode</div>
  <div><kbd style="background:#444;padding:1px 6px;border-radius:3px;">Q</kbd> &nbsp;ロボを上昇</div>
  <div><kbd style="background:#444;padding:1px 6px;border-radius:3px;">E</kbd> &nbsp;ロボを下降</div>
  <div><kbd style="background:#444;padding:1px 6px;border-radius:3px;">F</kbd> &nbsp;フォロー ⇔ フリーカメラ</div>
`;
document.getElementById("cesiumContainer").appendChild(hud);

console.log("読み込み完了: {{LOG_LABEL}}");
console.log("操作: Q=上昇 / E=下降 / F=フォロー⇔フリーカメラ切り替え");
