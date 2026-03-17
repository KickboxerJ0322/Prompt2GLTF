// ==============================
// Cesium Sandcastle 用
// Google Photorealistic 3D Tiles
// robo.glb 三人称散歩版
// 2Dミニマップ（三角アイコン）付き
// ミニマップ表示/非表示あり
// Free Walk Mode
// ==============================

// ------------------------------------
// 初期位置
// ------------------------------------
const START_LON = 139.75635487016382;
const START_LAT = 35.677767479832035;
const START_ALT = 41.0;

// プレイヤーモデル
const MODEL_URL =
  "https://raw.githubusercontent.com/KickboxerJ0322/Prompt2GLTF/master/glb/robo.glb";

// モデル向き補正
const MODEL_HEADING_FIX_DEG = -90;

// 移動設定
const WALK_SPEED = 2.0;
const RUN_SPEED = 10.0;
const STRAFE_FACTOR = 0.85;
const ROT_SPEED = Cesium.Math.toRadians(2.0);
const ALT_SPEED = 1.2;

// カメラ設定
const CAMERA_LOOK_HEIGHT = 2.2;
const CAM_YAW_SPEED = Cesium.Math.toRadians(2.0);
const CAM_PITCH_SPEED = Cesium.Math.toRadians(1.2);
const CAM_ZOOM_SPEED = 0.5;

const MIN_PITCH = Cesium.Math.toRadians(-70);
const MAX_PITCH = Cesium.Math.toRadians(20);

const MIN_CAMERA_DISTANCE = 4.0;
const MAX_CAMERA_DISTANCE = 40.0;
const DEFAULT_CAMERA_DISTANCE = 16.0;

// 高度制限
const MIN_PLAYER_ALT = 5.0;
const MAX_PLAYER_ALT = 500.0;

// 2Dミニマップ設定
const MINIMAP_HALF_DEG = 0.0035;
const MINIMAP_TRI_SIZE = 0.00018;
const MINIMAP_TRI_REAR_SCALE = 0.55;

// ------------------------------------
// プレイヤー状態
// ------------------------------------
let playerLon = START_LON;
let playerLat = START_LAT;
let playerAlt = START_ALT;
let playerHeading = Cesium.Math.toRadians(0.0);

// カメラ相対角
let camYawOffset = 0.0;
let camPitch = Cesium.Math.toRadians(-18.0);
let cameraDistance = DEFAULT_CAMERA_DISTANCE;

// ミニマップ表示状態
let minimapVisible = true;

// ------------------------------------
// メイン Viewer
// ------------------------------------
const viewer = new Cesium.Viewer("cesiumContainer", {
  globe: false,
  animation: false,
  timeline: false,
  baseLayerPicker: false,
  geocoder: false,
  homeButton: false,
  sceneModePicker: false,
  navigationHelpButton: false,
  infoBox: false,
  selectionIndicator: false,
  shouldAnimate: true,
  requestRenderMode: true,
  maximumRenderTimeChange: 0.0,
  msaaSamples: 1
});

viewer.scene.skyAtmosphere.show = true;
viewer.scene.fog.enabled = true;

// 標準カメラ操作を抑える
const ssc = viewer.scene.screenSpaceCameraController;
ssc.enableTranslate = false;
ssc.enableTilt = false;
ssc.enableLook = false;
ssc.enableRotate = false;
ssc.enableZoom = false;

// ------------------------------------
// HUD
// ------------------------------------
const hud = document.createElement("div");
hud.style.position = "absolute";
hud.style.top = "10px";
hud.style.left = "10px";
hud.style.padding = "10px 12px";
hud.style.background = "rgba(0,0,0,0.55)";
hud.style.color = "#fff";
hud.style.font = "14px sans-serif";
hud.style.borderRadius = "8px";
hud.style.zIndex = "999";
hud.style.lineHeight = "1.5";
hud.innerHTML = `
<b>Free Walk Mode</b><br>
W/S または ↑/↓: 前進・後退<br>
A/D または ←/→: 左右回転<br>
Q/E: 左右平行移動<br>
R/F: 上昇・下降<br>
Shift: 走る<br>
J/L: カメラ左右<br>
I/K: カメラ上下<br>
U/O: ズームイン / ズームアウト<br>
C: カメラ角度リセット<br>
M: ミニマップ 表示/非表示
`;
viewer.container.appendChild(hud);

const status = document.createElement("div");
status.style.position = "absolute";
status.style.bottom = "10px";
status.style.left = "10px";
status.style.padding = "8px 10px";
status.style.background = "rgba(0,0,0,0.55)";
status.style.color = "#fff";
status.style.font = "14px monospace";
status.style.borderRadius = "8px";
status.style.zIndex = "999";
viewer.container.appendChild(status);

// ------------------------------------
// 2Dミニマップ用オーバーレイ
// ------------------------------------
const minimapWrap = document.createElement("div");
minimapWrap.style.position = "absolute";
minimapWrap.style.top = "10px";
minimapWrap.style.right = "10px";
minimapWrap.style.width = "280px";
minimapWrap.style.height = "220px";
minimapWrap.style.border = "2px solid rgba(255,255,255,0.75)";
minimapWrap.style.borderRadius = "10px";
minimapWrap.style.overflow = "hidden";
minimapWrap.style.background = "#fff";
minimapWrap.style.zIndex = "999";
viewer.container.appendChild(minimapWrap);

const minimapLabel = document.createElement("div");
minimapLabel.style.position = "absolute";
minimapLabel.style.top = "0";
minimapLabel.style.left = "0";
minimapLabel.style.right = "0";
minimapLabel.style.padding = "4px 8px";
minimapLabel.style.background = "rgba(0,0,0,0.45)";
minimapLabel.style.color = "#fff";
minimapLabel.style.font = "12px sans-serif";
minimapLabel.style.zIndex = "2";
minimapLabel.textContent = "2D Mini Map";
minimapWrap.appendChild(minimapLabel);

const minimapDiv = document.createElement("div");
minimapDiv.style.position = "absolute";
minimapDiv.style.left = "0";
minimapDiv.style.top = "0";
minimapDiv.style.width = "100%";
minimapDiv.style.height = "100%";
minimapWrap.appendChild(minimapDiv);

// ------------------------------------
// 2Dミニマップ Viewer
// ------------------------------------
const minimapViewer = new Cesium.Viewer(minimapDiv, {
  sceneMode: Cesium.SceneMode.SCENE2D,
  animation: false,
  timeline: false,
  baseLayerPicker: false,
  geocoder: false,
  homeButton: false,
  sceneModePicker: false,
  navigationHelpButton: false,
  infoBox: false,
  selectionIndicator: false,
  fullscreenButton: false,
  shouldAnimate: true,
  requestRenderMode: true,
  maximumRenderTimeChange: 0.0,
  msaaSamples: 1
});

minimapViewer.scene.screenSpaceCameraController.enableInputs = false;
minimapViewer.scene.screenSpaceCameraController.enableZoom = false;
minimapViewer.scene.screenSpaceCameraController.enableTranslate = false;
minimapViewer.scene.screenSpaceCameraController.enableRotate = false;
minimapViewer.scene.screenSpaceCameraController.enableTilt = false;
minimapViewer.scene.screenSpaceCameraController.enableLook = false;

if (minimapViewer.creditContainer) minimapViewer.creditContainer.style.display = "none";
if (minimapViewer.bottomContainer) minimapViewer.bottomContainer.style.display = "none";

// ------------------------------------
// Google Photorealistic 3D Tiles
// ------------------------------------
const googleTileset = await Cesium.createGooglePhotorealistic3DTileset();
viewer.scene.primitives.add(googleTileset);

// ------------------------------------
// 入力
// ------------------------------------
const keys = Object.create(null);

document.addEventListener("keydown", (e) => {
  keys[e.code] = true;

  if (e.code === "KeyC") {
    resetCamera();
    viewer.scene.requestRender();
    minimapViewer.scene.requestRender();
  }

  if (e.code === "KeyM" && !e.repeat) {
    minimapVisible = !minimapVisible;
    minimapWrap.style.display = minimapVisible ? "block" : "none";
    viewer.scene.requestRender();
    minimapViewer.scene.requestRender();
  }
});

document.addEventListener("keyup", (e) => {
  keys[e.code] = false;
  viewer.scene.requestRender();
  minimapViewer.scene.requestRender();
});

// ------------------------------------
// プレイヤーモデル
// ------------------------------------
function getPlayerCartesian() {
  return Cesium.Cartesian3.fromDegrees(playerLon, playerLat, playerAlt);
}

function getModelHpr() {
  return new Cesium.HeadingPitchRoll(
    playerHeading + Cesium.Math.toRadians(MODEL_HEADING_FIX_DEG),
    0.0,
    0.0
  );
}

const player = viewer.entities.add({
  position: new Cesium.CallbackProperty(() => {
    return getPlayerCartesian();
  }, false),
  orientation: new Cesium.CallbackProperty(() => {
    const pos = getPlayerCartesian();
    return Cesium.Transforms.headingPitchRollQuaternion(pos, getModelHpr());
  }, false),
  model: {
    uri: MODEL_URL,
    minimumPixelSize: 72,
    maximumScale: 220,
    scale: 0.05,
    runAnimations: true
  }
});

// ------------------------------------
// 2Dミニマップ上のプレーヤー（三角アイコン）
// ------------------------------------
function getMiniTriangleHierarchy() {
  const frontLon = playerLon + Math.sin(playerHeading) * MINIMAP_TRI_SIZE;
  const frontLat = playerLat + Math.cos(playerHeading) * MINIMAP_TRI_SIZE;

  const rearHeadingLeft = playerHeading + Math.PI - Cesium.Math.toRadians(28);
  const rearHeadingRight = playerHeading + Math.PI + Cesium.Math.toRadians(28);

  const rearSize = MINIMAP_TRI_SIZE * MINIMAP_TRI_REAR_SCALE;

  const leftLon = playerLon + Math.sin(rearHeadingLeft) * rearSize;
  const leftLat = playerLat + Math.cos(rearHeadingLeft) * rearSize;

  const rightLon = playerLon + Math.sin(rearHeadingRight) * rearSize;
  const rightLat = playerLat + Math.cos(rearHeadingRight) * rearSize;

  return new Cesium.PolygonHierarchy(
    Cesium.Cartesian3.fromDegreesArray([
      frontLon, frontLat,
      leftLon, leftLat,
      rightLon, rightLat
    ])
  );
}

const playerMiniTriangle = minimapViewer.entities.add({
  polygon: {
    hierarchy: new Cesium.CallbackProperty(() => {
      return getMiniTriangleHierarchy();
    }, false),
    material: Cesium.Color.RED,
    outline: true,
    outlineColor: Cesium.Color.WHITE,
    height: 0
  }
});

// 位置中心の目印を少し入れる
const playerMiniCenter = minimapViewer.entities.add({
  position: new Cesium.CallbackProperty(() => {
    return Cesium.Cartesian3.fromDegrees(playerLon, playerLat, 0);
  }, false),
  point: {
    pixelSize: 4,
    color: Cesium.Color.WHITE,
    outlineColor: Cesium.Color.BLACK,
    outlineWidth: 1
  }
});

// ------------------------------------
// 補助関数
// ------------------------------------
function moveLonLatByMeters(lon, lat, eastMeters, northMeters) {
  const latRad = Cesium.Math.toRadians(lat);
  const metersPerDegLat = 111320.0;
  const metersPerDegLon = 111320.0 * Math.cos(latRad);

  return {
    lon: lon + eastMeters / metersPerDegLon,
    lat: lat + northMeters / metersPerDegLat
  };
}

function getForward2DFromHeading(heading) {
  return {
    east: Math.sin(heading),
    north: Math.cos(heading)
  };
}

function getRight2DFromHeading(heading) {
  return {
    east: Math.cos(heading),
    north: -Math.sin(heading)
  };
}

function updateThirdPersonCamera() {
  const target = Cesium.Cartesian3.fromDegrees(
    playerLon,
    playerLat,
    playerAlt + CAMERA_LOOK_HEIGHT
  );

  viewer.camera.lookAt(
    target,
    new Cesium.HeadingPitchRange(
      playerHeading + camYawOffset,
      camPitch,
      cameraDistance
    )
  );

  viewer.camera.lookAtTransform(Cesium.Matrix4.IDENTITY);
}

function updateMiniMapCamera() {
  const rect = Cesium.Rectangle.fromDegrees(
    playerLon - MINIMAP_HALF_DEG,
    playerLat - MINIMAP_HALF_DEG,
    playerLon + MINIMAP_HALF_DEG,
    playerLat + MINIMAP_HALF_DEG
  );

  minimapViewer.camera.setView({
    destination: rect
  });
}

function resetCamera() {
  camYawOffset = 0.0;
  camPitch = Cesium.Math.toRadians(-18.0);
  cameraDistance = DEFAULT_CAMERA_DISTANCE;
}

// ------------------------------------
// 初期カメラ
// ------------------------------------
resetCamera();
updateThirdPersonCamera();
updateMiniMapCamera();

// ------------------------------------
// 更新ループ
// ------------------------------------
viewer.clock.onTick.addEventListener(() => {
  const speed = (keys["ShiftLeft"] || keys["ShiftRight"]) ? RUN_SPEED : WALK_SPEED;

  // プレイヤー回転
  if (keys["KeyA"] || keys["ArrowLeft"]) playerHeading -= ROT_SPEED;
  if (keys["KeyD"] || keys["ArrowRight"]) playerHeading += ROT_SPEED;

  // カメラ回転
  if (keys["KeyJ"]) camYawOffset -= CAM_YAW_SPEED;
  if (keys["KeyL"]) camYawOffset += CAM_YAW_SPEED;
  if (keys["KeyI"]) camPitch -= CAM_PITCH_SPEED;
  if (keys["KeyK"]) camPitch += CAM_PITCH_SPEED;

  // ズーム
  if (keys["KeyU"]) cameraDistance -= CAM_ZOOM_SPEED;
  if (keys["KeyO"]) cameraDistance += CAM_ZOOM_SPEED;

  // 高度変更
  if (keys["KeyR"]) playerAlt += ALT_SPEED;
  if (keys["KeyF"]) playerAlt -= ALT_SPEED;

  camPitch = Cesium.Math.clamp(camPitch, MIN_PITCH, MAX_PITCH);
  cameraDistance = Cesium.Math.clamp(
    cameraDistance,
    MIN_CAMERA_DISTANCE,
    MAX_CAMERA_DISTANCE
  );
  playerAlt = Cesium.Math.clamp(
    playerAlt,
    MIN_PLAYER_ALT,
    MAX_PLAYER_ALT
  );

  let moveForward = 0.0;
  let moveRight = 0.0;

  if (keys["KeyW"] || keys["ArrowUp"]) moveForward += speed;
  if (keys["KeyS"] || keys["ArrowDown"]) moveForward -= speed;
  if (keys["KeyE"]) moveRight += speed * STRAFE_FACTOR;
  if (keys["KeyQ"]) moveRight -= speed * STRAFE_FACTOR;

  if (moveForward !== 0.0 || moveRight !== 0.0) {
    const f = getForward2DFromHeading(playerHeading);
    const r = getRight2DFromHeading(playerHeading);

    const eastMeters = f.east * moveForward + r.east * moveRight;
    const northMeters = f.north * moveForward + r.north * moveRight;

    const next = moveLonLatByMeters(
      playerLon,
      playerLat,
      eastMeters,
      northMeters
    );

    playerLon = next.lon;
    playerLat = next.lat;
  }

  updateThirdPersonCamera();

  if (minimapVisible) {
    updateMiniMapCamera();
    minimapViewer.scene.requestRender();
  }

  status.innerHTML =
    `MODE Free Walk Mode<br>` +
    `LON ${playerLon.toFixed(6)}<br>` +
    `LAT ${playerLat.toFixed(6)}<br>` +
    `ALT ${playerAlt.toFixed(2)}<br>` +
    `HDG ${Cesium.Math.toDegrees(playerHeading).toFixed(1)}<br>` +
    `CAMY ${Cesium.Math.toDegrees(camYawOffset).toFixed(1)}<br>` +
    `CAMP ${Cesium.Math.toDegrees(camPitch).toFixed(1)}<br>` +
    `ZOOM ${cameraDistance.toFixed(1)}<br>` +
    `MAP ${minimapVisible ? "ON" : "OFF"}`;

  viewer.scene.requestRender();
});