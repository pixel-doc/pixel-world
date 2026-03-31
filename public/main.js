import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const canvas = document.getElementById('canvas');
const timeEl = document.getElementById('time');
const visitorsEl = document.getElementById('visitors');

// Scene setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a1a2e);
scene.fog = new THREE.Fog(0x1a1a2e, 10, 50);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(8, 8, 8);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

// Controls
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.maxPolarAngle = Math.PI / 2.1;

// Lighting
const ambientLight = new THREE.AmbientLight(0x404060, 0.5);
scene.add(ambientLight);

const sunLight = new THREE.DirectionalLight(0xfff0dd, 1);
sunLight.position.set(10, 20, 10);
scene.add(sunLight);

// Ground
const groundGeo = new THREE.PlaneGeometry(40, 40, 20, 20);
const groundMat = new THREE.MeshStandardMaterial({
  color: 0x2d4a3e,
  roughness: 0.9,
  flatShading: true
});
const ground = new THREE.Mesh(groundGeo, groundMat);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

// Grid helper
const gridHelper = new THREE.GridHelper(40, 40, 0x3d5a4e, 0x3d5a4e);
gridHelper.position.y = 0.01;
scene.add(gridHelper);

// Store objects by id
const objects = new Map();

// Simple voxel-like avatar
function createAvatar() {
  const group = new THREE.Group();

  // Body
  const bodyGeo = new THREE.BoxGeometry(0.4, 0.6, 0.3);
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x7af7ff, emissive: 0x3a7a80 });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.position.y = 0.5;
  group.add(body);

  // Head
  const headGeo = new THREE.BoxGeometry(0.35, 0.35, 0.35);
  const head = new THREE.Mesh(headGeo, bodyMat);
  head.position.y = 1.0;
  group.add(head);

  // Eyes
  const eyeGeo = new THREE.BoxGeometry(0.08, 0.08, 0.05);
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x1a1a2e });
  const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
  leftEye.position.set(-0.08, 1.0, 0.18);
  group.add(leftEye);
  const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
  rightEye.position.set(0.08, 1.0, 0.18);
  group.add(rightEye);

  // Legs
  const legGeo = new THREE.BoxGeometry(0.12, 0.3, 0.12);
  const legMat = new THREE.MeshStandardMaterial({ color: 0x3a3a5a });
  const leftLeg = new THREE.Mesh(legGeo, legMat);
  leftLeg.position.set(-0.1, 0.15, 0);
  group.add(leftLeg);
  const rightLeg = new THREE.Mesh(legGeo, legMat);
  rightLeg.position.set(0.1, 0.15, 0);
  group.add(rightLeg);

  return group;
}

// Simple plant
function createPlant(type = 'flower') {
  const group = new THREE.Group();

  const stemGeo = new THREE.CylinderGeometry(0.03, 0.04, 0.4, 6);
  const stemMat = new THREE.MeshStandardMaterial({ color: 0x4a8a4a, flatShading: true });
  const stem = new THREE.Mesh(stemGeo, stemMat);
  stem.position.y = 0.2;
  group.add(stem);

  if (type === 'flower') {
    const petalGeo = new THREE.BoxGeometry(0.15, 0.15, 0.05);
    const petalMat = new THREE.MeshStandardMaterial({ color: 0xff7af7, flatShading: true });
    const petal = new THREE.Mesh(petalGeo, petalMat);
    petal.position.y = 0.45;
    group.add(petal);

    const centerGeo = new THREE.BoxGeometry(0.08, 0.08, 0.05);
    const centerMat = new THREE.MeshStandardMaterial({ color: 0xffff7a });
    const center = new THREE.Mesh(centerGeo, centerMat);
    center.position.y = 0.45;
    group.add(center);
  }

  return group;
}

// Create mesh from object data
function createMesh(obj) {
  if (obj.type === 'avatar') {
    return createAvatar();
  } else if (obj.type === 'plant') {
    return createPlant(obj.properties?.plantType || 'flower');
  }

  // Default cube
  const geo = new THREE.BoxGeometry(0.5, 0.5, 0.5);
  const mat = new THREE.MeshStandardMaterial({ color: 0x888888 });
  return new THREE.Mesh(geo, mat);
}

// Update time display
function updateTime() {
  const now = new Date();
  timeEl.textContent = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

// Load world state
async function loadWorld() {
  try {
    const res = await fetch('/api/world');
    const { objects: objs, thoughts } = await res.json();

    // Clear existing
    objects.forEach(mesh => scene.remove(mesh));
    objects.clear();

    // Add objects
    objs.forEach(obj => {
      const mesh = createMesh(obj);
      mesh.position.set(obj.x, obj.y, obj.z);
      mesh.rotation.y = obj.rotation;
      mesh.scale.setScalar(obj.scale);
      mesh.userData.id = obj.id;
      scene.add(mesh);
      objects.set(obj.id, mesh);
    });

    console.log(`Loaded ${objs.length} objects`);
  } catch (e) {
    console.error('Failed to load world:', e);
  }
}

// WebSocket
const ws = new WebSocket(`ws://${location.host}`);
ws.onmessage = (event) => {
  const { type, data } = JSON.parse(event.data);

  if (type === 'object_created') {
    const mesh = createMesh(data);
    mesh.position.set(data.x, data.y, data.z);
    mesh.userData.id = data.id;
    scene.add(mesh);
    objects.set(data.id, mesh);
  } else if (type === 'object_updated') {
    const mesh = objects.get(data.id);
    if (mesh) {
      mesh.position.set(data.x, data.y, data.z);
      mesh.rotation.y = data.rotation;
      mesh.scale.setScalar(data.scale);
    }
  } else if (type === 'object_deleted') {
    const mesh = objects.get(data.id);
    if (mesh) {
      scene.remove(mesh);
      objects.delete(data.id);
    }
  }
};

// Resize handler
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Animation loop
function animate() {
  requestAnimationFrame(animate);
  controls.update();
  updateTime();
  renderer.render(scene, camera);
}

// Start
loadWorld();
animate();
console.log('Pixel World loaded!');