// ==============================
// Cesium Sandcastle 用
// Google Photorealistic 3D Tiles
// Toranomon Hills to Tokyo Tower walk route
// Camera follows behind the moving model
// ==============================

// ------------------------------------
// Model orientation fix
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
  console.log("Failed to load Google Photorealistic 3D Tiles", error);
  throw error;
}

// ------------------------------------
// Character settings
// ------------------------------------
const PERSON = {
  name: "\u864e\u30ce\u9580\u30d2\u30eb\u30ba\u304b\u3089\u6771\u4eac\u30bf\u30ef\u30fc\u3078",
  glb: (() => {
    const modelUrl = "".trim();
    return !modelUrl
      ? "https://raw.githubusercontent.com/KickboxerJ0322/Prompt2GLTF/master/glb/car.glb"
      : modelUrl;
  })(),
  scale: 0.3,
  minimumPixelSize: 64,
  maximumScale: 20,
  heightMeters: 40,
  speedMultiplier: 1,
  pathWidth: 4,
  followOffset: new Cesium.Cartesian3(-540.0, -2.0, 300.0),
  lookOffset: new Cesium.Cartesian3(0.0, 0.0, 2.2),
  cameraSmooth: 0.1,
};

// ------------------------------------
// Route
// [seconds, lon, lat]
// ------------------------------------
const route2D = [
  [0, 139.74762388610776, 35.66728037489463],
  [20, 139.74641953951047, 35.66456246414062],
  [40, 139.74424024558465, 35.66227934759829],
  [60, 139.74294031605703, 35.65999616581598],
  [100, 139.74499628926793, 35.655831769448135],
  [110, 139.74541424160032, 35.65520481286661],
  [130, 139.74698960042394, 35.65844403546138],
  [140, 139.7455749925007, 35.65901872252147],
];

// ------------------------------------
// Nearby place labels
// ------------------------------------
const DEFAULT_PLACE_LABELS = [
  {
    name: "\u864e\u30ce\u9580\u30d2\u30eb\u30ba",
    lon: 139.74762388610776,
    lat: 35.66728037489463,
    height: 20,
    color: "CYAN",
  },
  {
    name: "\u829d\u516c\u5712",
    lon: 139.7459,
    lat: 35.6556,
    height: 20,
    color: "WHITE",
  },
  {
    name: "\u6771\u4eac\u30bf\u30ef\u30fc",
    lon: 139.7455749925007,
    lat: 35.65901872252147,
    height: 20,
    color: "ORANGE",
  },
];

// ------------------------------------
// Time settings
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
viewer.clock.clockRange = Cesium.ClockRange.LOOP_STOP;
viewer.clock.multiplier = PERSON.speedMultiplier;
viewer.clock.shouldAnimate = true;

// ------------------------------------
// Position samples
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
// Orientation
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
// Route line
// ------------------------------------
viewer.entities.add({
  name: "\u864e\u30ce\u9580\u30d2\u30eb\u30ba \u2192 \u6771\u4eac\u30bf\u30ef\u30fc",
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
// Start marker
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
    text: "\u51fa\u767a: \u864e\u30ce\u9580\u30d2\u30eb\u30ba",
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
// End marker
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
    text: "\u5230\u7740: \u6771\u4eac\u30bf\u30ef\u30fc",
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
// Waypoints
// ------------------------------------
const WAYPOINTS = [
  {
    lon: 139.75112,
    lat: 35.65715,
    label: "\u829d\u516c\u5712\u4ea4\u5dee\u70b9",
    color: "ORANGE",
  },
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
// Nearby labels
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
// Moving model
// ------------------------------------
viewer.entities.add({
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
// Initial camera
// ------------------------------------
await viewer.camera.flyTo({
  destination: Cesium.Cartesian3.fromDegrees(139.7508, 35.6588, 1200),
  orientation: {
    heading: Cesium.Math.toRadians(10),
    pitch: Cesium.Math.toRadians(-40),
    roll: 0,
  },
  duration: 1.5,
});

// ------------------------------------
// Follow camera
// ------------------------------------
let smoothCamPos;

viewer.scene.preRender.addEventListener(function (scene, time) {
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

console.log("Loaded: Toranomon Hills to Tokyo Tower walk route");
