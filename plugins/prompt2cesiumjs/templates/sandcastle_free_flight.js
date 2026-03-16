// ==============================
// Cesium Sandcastle 用
// Free Flight Mode
// Google Photorealistic 3D Tiles 上空
// 初期位置: 晴海ふ頭公園 上空
// ==============================

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
});

viewer.scene.skyAtmosphere.show = true;
viewer.scene.fog.enabled = true;

// ------------------------------------
// Google Photorealistic 3D Tiles
// ------------------------------------
const googleTileset = await Cesium.createGooglePhotorealistic3DTileset();
viewer.scene.primitives.add(googleTileset);

// ------------------------------------
// 初期位置（晴海ふ頭公園 上空あたり）
// ------------------------------------
const START_LON = 139.77116040344728; 
const START_LAT = 35.64800930579617; 
const START_ALT = 260.0;

// ------------------------------------
// モデル向き補正
// ------------------------------------
const MODEL_HEADING_FIX_DEG = 270;
const MODEL_PITCH_FIX_DEG = 0;
const MODEL_ROLL_FIX_DEG = 0;

// ------------------------------------
// 機体状態
// ------------------------------------
let lon = START_LON;
let lat = START_LAT;
let alt = START_ALT;

let heading = Cesium.Math.toRadians(0.0);
let pitch = 0.0;
let roll = 0.0;

let speed = 0.0;
let verticalSpeed = 0.0;

const MAX_SPEED = 1000.0;   // 最高速度
const MIN_SPEED = -200.0;   // 最大後退速度
const ACCEL = 500.0;        // 加速度
const DRAG = 0.990;

const TURN_RATE = Cesium.Math.toRadians(60.0);
const CLIMB_RATE = 36.0;

const MIN_ALT = 20.0;
const MAX_ALT = 3000.0;

// ------------------------------------
// 入力管理
// ------------------------------------
const keys = Object.create(null);

document.addEventListener("keydown", (e) => {
  keys[e.code] = true;
});

document.addEventListener("keyup", (e) => {
  keys[e.code] = false;
});

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
hud.style.lineHeight = "1.5";
hud.style.zIndex = "999";
hud.innerHTML = `
<b>Free Flight Mode</b><br>
W/S: 前進・後退<br>
A/D: 左右旋回<br>
Q/E: 上昇・下降<br>
↑/↓: ピッチ<br>
Z/X: 加速・減速<br>
C: 追尾カメラ ON/OFF<br>
R: リセット
`;
viewer.container.appendChild(hud);

const statusDiv = document.createElement("div");
statusDiv.style.position = "absolute";
statusDiv.style.bottom = "10px";
statusDiv.style.left = "10px";
statusDiv.style.padding = "8px 10px";
statusDiv.style.background = "rgba(0,0,0,0.55)";
statusDiv.style.color = "#fff";
statusDiv.style.font = "14px monospace";
statusDiv.style.borderRadius = "8px";
statusDiv.style.zIndex = "999";
viewer.container.appendChild(statusDiv);

// ------------------------------------
// モデルURL
// ------------------------------------
const HELI_MODEL_URL =
  "https://raw.githubusercontent.com/KickboxerJ0322/Prompt2GLTF/master/glb/heli.glb";

// ------------------------------------
// ヘリモデル
// ------------------------------------
const helicopter = viewer.entities.add({
  name: "Helicopter",
  position: Cesium.Cartesian3.fromDegrees(lon, lat, alt),
  orientation: Cesium.Transforms.headingPitchRollQuaternion(
    Cesium.Cartesian3.fromDegrees(lon, lat, alt),
    new Cesium.HeadingPitchRoll(heading, pitch, roll)
  ),
  model: {
    uri: HELI_MODEL_URL,
    minimumPixelSize: 72,
    maximumScale: 300,
    scale: 1.0,
  },
});

// ------------------------------------
// 追尾カメラ
// ------------------------------------
let chaseCamera = true;

// ------------------------------------
// リセット
// ------------------------------------
function resetHeli() {
  lon = START_LON;
  lat = START_LAT;
  alt = START_ALT;

  heading = Cesium.Math.toRadians(0.0);
  pitch = 0.0;
  roll = 0.0;

  speed = 0.0;
  verticalSpeed = 0.0;
}

document.addEventListener("keydown", (e) => {
  if (e.code === "KeyC") {
    chaseCamera = !chaseCamera;
    if (!chaseCamera) {
      viewer.camera.lookAtTransform(Cesium.Matrix4.IDENTITY);
    }
  }

  if (e.code === "KeyR") {
    resetHeli();
  }
});

// ------------------------------------
// 毎フレーム更新
// ------------------------------------
let lastTime;

viewer.clock.onTick.addEventListener((clock) => {
  const currentTime =
    Cesium.JulianDate.toDate(clock.currentTime).getTime() / 1000.0;

  if (lastTime === undefined) {
    lastTime = currentTime;
    return;
  }

  let dt = currentTime - lastTime;
  lastTime = currentTime;

  dt = Math.min(dt, 0.05);

  // ----------------------------
  // 入力
  // ----------------------------

  if (keys["KeyW"]) speed += ACCEL * dt;
  if (keys["KeyS"]) speed -= ACCEL * dt;

  if (keys["KeyZ"]) speed += ACCEL * 0.7 * dt;
  if (keys["KeyX"]) speed -= ACCEL * 0.7 * dt;

  speed = Cesium.Math.clamp(speed, MIN_SPEED, MAX_SPEED);

  if (keys["KeyA"]) heading -= TURN_RATE * dt;
  if (keys["KeyD"]) heading += TURN_RATE * dt;

  if (keys["KeyQ"]) {
    verticalSpeed = CLIMB_RATE;
  } else if (keys["KeyE"]) {
    verticalSpeed = -CLIMB_RATE;
  } else {
    verticalSpeed = 0.0;
  }

  if (keys["ArrowUp"]) pitch += Cesium.Math.toRadians(35.0) * dt;
  if (keys["ArrowDown"]) pitch -= Cesium.Math.toRadians(35.0) * dt;

  pitch = Cesium.Math.clamp(
    pitch,
    Cesium.Math.toRadians(-25.0),
    Cesium.Math.toRadians(25.0)
  );

  let targetRoll = 0.0;
  if (keys["KeyA"]) targetRoll = Cesium.Math.toRadians(-18.0);
  if (keys["KeyD"]) targetRoll = Cesium.Math.toRadians(18.0);

  roll += (targetRoll - roll) * Math.min(1.0, dt * 4.5);

  speed *= Math.pow(DRAG, dt * 60.0);

  // ----------------------------
  // 前進ベクトル計算（1回目の position）
  // ----------------------------
  const position = Cesium.Cartesian3.fromDegrees(lon, lat, alt);

  const hpr = new Cesium.HeadingPitchRoll(heading, pitch, roll);

  const transform =
    Cesium.Transforms.headingPitchRollToFixedFrame(position, hpr);

  const forward = Cesium.Matrix4.multiplyByPointAsVector(
    transform,
    new Cesium.Cartesian3(0, 1, 0),
    new Cesium.Cartesian3()
  );

  Cesium.Cartesian3.normalize(forward, forward);

  const move = Cesium.Cartesian3.multiplyByScalar(
    forward,
    speed * dt,
    new Cesium.Cartesian3()
  );

  const newPos = Cesium.Cartesian3.add(position, move, new Cesium.Cartesian3());

  newPos.z += verticalSpeed * dt;

  const carto = Cesium.Cartographic.fromCartesian(newPos);

  lon = Cesium.Math.toDegrees(carto.longitude);
  lat = Cesium.Math.toDegrees(carto.latitude);
  alt = carto.height;

  // ----------------------------
  // モデル姿勢更新（2回目: modelPosition に改名）← ここが修正点
  // ----------------------------
  const modelPosition = Cesium.Cartesian3.fromDegrees(lon, lat, alt);

  const modelHpr = new Cesium.HeadingPitchRoll(
    heading + Cesium.Math.toRadians(MODEL_HEADING_FIX_DEG),
    pitch + Cesium.Math.toRadians(MODEL_PITCH_FIX_DEG),
    roll + Cesium.Math.toRadians(MODEL_ROLL_FIX_DEG)
  );

  const orientation =
    Cesium.Transforms.headingPitchRollQuaternion(modelPosition, modelHpr);

  helicopter.position = modelPosition;
  helicopter.orientation = orientation;

  // ----------------------------
  // 追尾カメラ
  // ----------------------------
  if (chaseCamera) {
    const cameraFrame =
      Cesium.Transforms.headingPitchRollToFixedFrame(modelPosition, modelHpr);

    const cameraOffset = new Cesium.Cartesian3(-95.0, 0.0, 34.0);
    viewer.camera.lookAtTransform(cameraFrame, cameraOffset);
  }

  // ----------------------------
  // HUD表示
  // ----------------------------
  statusDiv.innerHTML =
    `SPD ${speed.toFixed(1)} m/s<br>` +
    `ALT ${alt.toFixed(1)} m<br>` +
    `HDG ${Cesium.Math.toDegrees(heading).toFixed(1)} deg<br>` +
    `PIT ${Cesium.Math.toDegrees(pitch).toFixed(1)} deg<br>` +
    `CAM ${chaseCamera ? "CHASE" : "FREE"}`;
});

// ------------------------------------
// 初期カメラ
// ------------------------------------
viewer.camera.flyTo({
  destination: Cesium.Cartesian3.fromDegrees(
    START_LON,
    START_LAT,
    START_ALT + 360.0
  ),
  orientation: {
    heading: Cesium.Math.toRadians(0.0),
    pitch: Cesium.Math.toRadians(-35.0),
    roll: 0.0,
  },
  duration: 1.5,
});