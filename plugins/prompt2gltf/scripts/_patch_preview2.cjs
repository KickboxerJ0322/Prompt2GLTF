"use strict";
const fs   = require("fs");
const path = require("path");

const TARGET = path.join(__dirname, "index.mjs");
let code = fs.readFileSync(TARGET, "utf8");

// ── Locate the function to replace ─────────────────────────────────────────
const fnStart = code.indexOf("function createPreviewHtml(");
const fnEnd   = code.indexOf("\nasync function main()");
if (fnStart < 0 || fnEnd < 0) {
  console.error("Markers not found", fnStart, fnEnd);
  process.exit(1);
}

// ── Build each line of the HTML as a JS string element ──────────────────────
// Lines are joined with \n in the returned string.
// Template expressions like modelsJson / currentJson are injected via concatenation.

function lines(...args) { return args; }

const htmlLines = [
  // ── DOCTYPE / head ──
  "<!doctype html>",
  "<html lang='ja'>",
  "<head>",
  "  <meta charset='utf-8' />",
  "  <meta name='viewport' content='width=device-width,initial-scale=1' />",
  "  <title>Prompt2GLTF · Gallery</title>",
  "  <link rel='preconnect' href='https://fonts.googleapis.com'>",
  "  <link href='https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Noto+Sans+JP:wght@300;400&display=swap' rel='stylesheet'>",
  "  <style>",
  "    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }",
  "    :root {",
  "      --bg: #0a0a0f; --surface: #12121a; --border: #2a2a3a;",
  "      --accent: #6ee7f7; --accent2: #a78bfa; --text: #e0e0f0; --muted: #5a5a7a;",
  "    }",
  "    body { background: var(--bg); color: var(--text); font-family: 'Noto Sans JP', sans-serif; height: 100vh; display: flex; flex-direction: column; overflow: hidden; }",
  // header
  "    header { padding: 14px 22px; border-bottom: 1px solid var(--border); display: flex; align-items: center; gap: 14px; background: var(--surface); flex-shrink: 0; }",
  "    .logo { font-family: 'Space Mono', monospace; font-size: 12px; letter-spacing: .2em; color: var(--accent); text-transform: uppercase; }",
  "    .logo span { color: var(--accent2); }",
  "    .hint { margin-left: auto; font-size: 11px; color: var(--muted); font-family: 'Space Mono', monospace; letter-spacing: .05em; }",
  // main wrapper
  "    .main { flex: 1; display: flex; overflow: hidden; }",
  // sidebar
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
  // viewer
  "    #viewer { flex: 1; position: relative; overflow: hidden; }",
  "    canvas { display: block; width: 100% !important; height: 100% !important; }",
  // grid background
  "    .grid-bg { position: absolute; inset: 0; background-image: linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px); background-size: 40px 40px; opacity: .18; pointer-events: none; z-index: 0; }",
  // info panel
  "    #info { position: absolute; top: 14px; left: 14px; font-family: 'Space Mono', monospace; font-size: 10px; color: var(--muted); z-index: 5; line-height: 1.9; opacity: 0; transition: opacity .3s; background: rgba(10,10,15,.75); padding: 10px 14px; border-radius: 8px; border: 1px solid var(--border); backdrop-filter: blur(6px); }",
  "    #info.visible { opacity: 1; }",
  // controls bar
  "    .controls-bar { position: absolute; bottom: 18px; left: 50%; transform: translateX(-50%); display: flex; gap: 8px; z-index: 5; opacity: 0; transition: opacity .3s; }",
  "    .controls-bar.visible { opacity: 1; }",
  "    .ctrl-btn { background: rgba(18,18,26,.90); border: 1px solid var(--border); color: var(--text); font-family: 'Space Mono', monospace; font-size: 10px; letter-spacing: .06em; padding: 7px 14px; border-radius: 6px; cursor: pointer; backdrop-filter: blur(8px); transition: border-color .15s, color .15s; }",
  "    .ctrl-btn:hover { border-color: var(--accent); color: var(--accent); }",
  "    .ctrl-btn.on { border-color: var(--accent2); color: var(--accent2); }",
  // status bar
  "    #status-bar { position: absolute; bottom: 18px; right: 18px; font-family: 'Space Mono', monospace; font-size: 10px; color: var(--muted); z-index: 5; background: rgba(10,10,15,.75); padding: 6px 14px; border-radius: 20px; border: 1px solid var(--border); backdrop-filter: blur(6px); letter-spacing: .04em; }",
  "  </style>",
  "</head>",
  "<body>",
  // ── header ──
  "  <header>",
  "    <div class='logo'>PROMPT2GLTF <span>//</span> Gallery</div>",
  "    <div class='hint'>drag &middot; scroll &middot; pinch to navigate</div>",
  "  </header>",
  // ── main ──
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
  // ── importmap ──
  "  <script type='importmap'>",
  "  {\"imports\":{\"three\":\"https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js\",\"three/addons/\":\"https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/\"}}",
  "  <\\/script>",
  // ── module script (everything concatenated as separate string segments) ──
];

// Build the new function source
const newFn = `function createPreviewHtml(currentGlb, allGlbs) {
  const modelsJson  = JSON.stringify(allGlbs);
  const currentJson = JSON.stringify(currentGlb);
  const countStr    = String(allGlbs.length);

  const staticHtml = ${JSON.stringify(htmlLines.join("\n"))};

  const scriptBlock = [
    "  <script type='module'>",
    "    import * as THREE from 'three';",
    "    import { OrbitControls } from 'three/addons/controls/OrbitControls.js';",
    "    import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';",
    "    const MODELS  = " + modelsJson + ";",
    "    const INITIAL = " + currentJson + ";",
    "    const COUNT   = " + countStr + ";",
    "    document.getElementById('count-badge').textContent = COUNT;",
    "    const statusEl  = document.getElementById('status-bar');",
    "    const infoEl    = document.getElementById('info');",
    "    const ctrlBar   = document.getElementById('controls-bar');",
    "    const listEl    = document.getElementById('model-list');",
    "    const canvas    = document.getElementById('c');",
    // Three.js setup
    "    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });",
    "    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));",
    "    renderer.toneMapping = THREE.ACESFilmicToneMapping;",
    "    renderer.toneMappingExposure = 1.1;",
    "    const scene = new THREE.Scene();",
    "    scene.background = new THREE.Color(0x0a0a0f);",
    "    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 10000);",
    "    const controls = new OrbitControls(camera, renderer.domElement);",
    "    controls.enableDamping = true; controls.dampingFactor = 0.08;",
    // Lights
    "    const amb = new THREE.AmbientLight(0xffffff, 0.4); scene.add(amb);",
    "    const dir1 = new THREE.DirectionalLight(0x6ee7f7, 2.2); dir1.position.set(180,260,140); scene.add(dir1);",
    "    const dir2 = new THREE.DirectionalLight(0xa78bfa, 1.0); dir2.position.set(-120,90,-160); scene.add(dir2);",
    "    const dir3 = new THREE.DirectionalLight(0xffffff, 0.8); dir3.position.set(0,-100,0); scene.add(dir3);",
    // Grid
    "    scene.add(new THREE.GridHelper(600, 60, 0x2a2a3a, 0x1a1a28));",
    "    const ground = new THREE.Mesh(new THREE.PlaneGeometry(800,800), new THREE.MeshStandardMaterial({color:0x0a0a0f,roughness:0.98}));",
    "    ground.rotation.x = -Math.PI/2; ground.position.y = -0.02; scene.add(ground);",
    // Resize
    "    function resize() { const w=canvas.clientWidth,h=canvas.clientHeight; renderer.setSize(w,h,false); camera.aspect=w/h; camera.updateProjectionMatrix(); }",
    "    window.addEventListener('resize', resize); resize();",
    // frameObject
    "    function frameObject(obj) {",
    "      const box=new THREE.Box3().setFromObject(obj), size=new THREE.Vector3(), center=new THREE.Vector3();",
    "      box.getSize(size); box.getCenter(center);",
    "      obj.position.x -= center.x; obj.position.y -= box.min.y; obj.position.z -= center.z;",
    "      const maxDim=Math.max(size.x,size.y,size.z), dist=Math.max(60,maxDim*1.8);",
    "      camera.near=Math.max(0.1,maxDim/500); camera.far=Math.max(1000,maxDim*20); camera.updateProjectionMatrix();",
    "      scene.fog=new THREE.Fog(0x0a0a0f,dist*2.5,dist*9);",
    "      camera.position.set(dist*0.72,size.y*0.62+dist*0.22,dist);",
    "      controls.target.set(0,size.y*0.42,0); controls.update();",
    "    }",
    // Model loader
    "    const loader=new GLTFLoader();",
    "    let currentObj=null, wireframe=false, autoRotate=true;",
    "    function loadModel(filename) {",
    "      if(currentObj){ scene.remove(currentObj); currentObj=null; }",
    "      infoEl.classList.remove('visible'); ctrlBar.classList.remove('visible');",
    "      statusEl.textContent='Loading '+filename+' ...';",
    "      loader.load('generated/'+filename,",
    "        (gltf)=>{",
    "          currentObj=gltf.scene; scene.add(currentObj);",
    "          frameObject(currentObj);",
    "          // apply wireframe state",
    "          currentObj.traverse(n=>{ if(n.isMesh) n.material.wireframe=wireframe; });",
    "          // info panel",
    "          let meshCount=0; currentObj.traverse(n=>{ if(n.isMesh) meshCount++; });",
    "          const box=new THREE.Box3().setFromObject(currentObj), sz=new THREE.Vector3(); box.getSize(sz);",
    "          infoEl.innerHTML='FILE: '+filename+'<br>MESHES: '+meshCount+'<br>SIZE: '+sz.x.toFixed(1)+' x '+sz.y.toFixed(1)+' x '+sz.z.toFixed(1)+' m';",
    "          infoEl.classList.add('visible'); ctrlBar.classList.add('visible');",
    "          statusEl.textContent=filename+' \\u2713';",
    "        },",
    "        (evt)=>{ statusEl.textContent=evt.total?'Loading... '+Math.round(evt.loaded/evt.total*100)+'%':'Loading... '+Math.round(evt.loaded/1024)+' KB'; },",
    "        (err)=>{ statusEl.textContent='Load failed: '+(err.message||err); }",
    "      );",
    "    }",
    // Sidebar
    "    MODELS.forEach(filename=>{",
    "      const btn=document.createElement('button');",
    "      btn.className='mbtn'+(filename===INITIAL?' active':'');",
    "      btn.title=filename;",
    "      const label=filename.replace(/\\\\.glb$/,'').replace(/_/g,' ');",
    "      const _sp=document.createElement('span'); _sp.className='dot'; btn.textContent=label; btn.prepend(_sp);",
    "      btn.onclick=()=>{",
    "        document.querySelectorAll('.mbtn').forEach(b=>b.classList.remove('active'));",
    "        btn.classList.add('active'); loadModel(filename);",
    "      };",
    "      listEl.appendChild(btn);",
    "    });",
    // Controls
    "    document.getElementById('btn-reset').onclick=()=>{ if(currentObj){ frameObject(currentObj); } };",
    "    document.getElementById('btn-wire').onclick=function(){ wireframe=!wireframe; this.classList.toggle('on',wireframe); if(currentObj) currentObj.traverse(n=>{ if(n.isMesh) n.material.wireframe=wireframe; }); this.textContent=wireframe?'\\u25A0 SOLID':'\\u25FB WIRE'; };",
    "    document.getElementById('btn-rotate').onclick=function(){ autoRotate=!autoRotate; this.classList.toggle('on',autoRotate); };",
    "    controls.addEventListener('start',()=>{ autoRotate=false; document.getElementById('btn-rotate').classList.remove('on'); });",
    // Render loop
    "    (function render(){ controls.update(); if(currentObj&&autoRotate) currentObj.rotation.y+=0.003; renderer.render(scene,camera); requestAnimationFrame(render); })();",
    "    loadModel(INITIAL);",
    "  <\\/script>",
    "</body>",
    "</html>",
  ].join("\\n");

  return staticHtml + "\\n" + scriptBlock;
}

`;

code = code.slice(0, fnStart) + newFn + code.slice(fnEnd);
fs.writeFileSync(TARGET, code, "utf8");
console.log("Done. File length:", code.length);
