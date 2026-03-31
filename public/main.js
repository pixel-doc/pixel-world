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

  // Store body parts for animation
  group.userData.parts = {};

  // Body
  const bodyGeo = new THREE.BoxGeometry(0.4, 0.6, 0.3);
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x7af7ff, emissive: 0x3a7a80 });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.position.y = 0.5;
  group.add(body);
  group.userData.parts.body = body;

  // Head
  const headGeo = new THREE.BoxGeometry(0.35, 0.35, 0.35);
  const head = new THREE.Mesh(headGeo, bodyMat);
  head.position.y = 1.0;
  group.add(head);
  group.userData.parts.head = head;

  // Eyes
  const eyeGeo = new THREE.BoxGeometry(0.08, 0.08, 0.05);
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x1a1a2e });
  const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
  leftEye.position.set(-0.08, 1.0, 0.18);
  group.add(leftEye);
  const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
  rightEye.position.set(0.08, 1.0, 0.18);
  group.add(rightEye);

  // Arms
  const armGeo = new THREE.BoxGeometry(0.1, 0.4, 0.1);
  const leftArm = new THREE.Mesh(armGeo, bodyMat);
  leftArm.position.set(-0.3, 0.5, 0);
  group.add(leftArm);
  group.userData.parts.leftArm = leftArm;
  const rightArm = new THREE.Mesh(armGeo, bodyMat);
  rightArm.position.set(0.3, 0.5, 0);
  group.add(rightArm);
  group.userData.parts.rightArm = rightArm;

  // Legs
  const legGeo = new THREE.BoxGeometry(0.12, 0.3, 0.12);
  const legMat = new THREE.MeshStandardMaterial({ color: 0x3a3a5a });
  const leftLeg = new THREE.Mesh(legGeo, legMat);
  leftLeg.position.set(-0.1, 0.15, 0);
  group.add(leftLeg);
  const rightLeg = new THREE.Mesh(legGeo, legMat);
  rightLeg.position.set(0.1, 0.15, 0);
  group.add(rightLeg);

  // Action label (debug/visual stub)
  const labelCanvas = document.createElement('canvas');
  labelCanvas.width = 128;
  labelCanvas.height = 32;
  const labelCtx = labelCanvas.getContext('2d');
  labelCtx.fillStyle = '#ff7af7';
  labelCtx.font = 'bold 16px Courier New';
  labelCtx.textAlign = 'center';
  labelCtx.fillText('', 64, 20);
  const labelTexture = new THREE.CanvasTexture(labelCanvas);
  const labelMat = new THREE.SpriteMaterial({ map: labelTexture, transparent: true });
  const actionLabel = new THREE.Sprite(labelMat);
  actionLabel.scale.set(2, 0.5, 1);
  actionLabel.position.y = 2.2;
  group.add(actionLabel);
  group.userData.parts.actionLabel = actionLabel;
  group.userData.parts.labelCtx = labelCtx;
  group.userData.parts.labelTexture = labelTexture;

  return group;
}

// Animate avatar based on action
function animateAvatar(group, action, time) {
  if (!group.userData.parts) return;
  const { leftArm, rightArm, body, head, actionLabel, labelCtx, labelTexture } = group.userData.parts;

  // Reset
  leftArm.rotation.set(0, 0, 0);
  rightArm.rotation.set(0, 0, 0);
  body.position.y = 0.5;
  group.position.y = 0;

  // Visual stubs for actions
  if (action === 'wave') {
    leftArm.rotation.z = Math.sin(time * 8) * 0.8;
    actionLabel && (labelCtx.fillStyle = '#ff7af7', labelCtx.fillText('Waving!', 64, 20), labelTexture.needsUpdate = true);
  } else if (action === 'jump') {
    group.position.y = Math.abs(Math.sin(time * 12)) * 0.5;
    actionLabel && (labelCtx.fillStyle = '#7aff7a', labelCtx.fillText('Jumping!', 64, 20), labelTexture.needsUpdate = true);
  } else if (action === 'dance') {
    group.rotation.y = time * 6;
    body.position.y = 0.5 + Math.sin(time * 10) * 0.1;
    actionLabel && (labelCtx.fillStyle = '#ffff7a', labelCtx.fillText('Dancing!', 64, 20), labelTexture.needsUpdate = true);
  } else if (action === 'sleep') {
    group.rotation.x = Math.PI / 2;
    group.position.y = 0.2;
    actionLabel && (labelCtx.fillStyle = '#7af7ff', labelCtx.fillText('Sleeping...', 64, 20), labelTexture.needsUpdate = true);
  } else if (action === 'walk') {
    leftArm.rotation.x = Math.sin(time * 15) * 0.3;
    rightArm.rotation.x = -Math.sin(time * 15) * 0.3;
    actionLabel && (labelCtx.fillStyle = '#ffaa7a', labelCtx.fillText('Walking...', 64, 20), labelTexture.needsUpdate = true);
  } else if (action === 'idle' || !action) {
    // Subtle idle breathing
    body.position.y = 0.5 + Math.sin(time * 2) * 0.02;
    actionLabel && (labelCtx.clearRect(0, 0, 128, 32), labelTexture.needsUpdate = true);
  }
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

// Text bubble above avatar
function updateTextBubble(mesh, props) {
  if (!mesh.userData.bubble && props.say) {
    // Create bubble
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = 256;
    canvas.height = 128;
    
    // Draw bubble
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 20px Courier New';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const lines = props.say.match(/.{1,20}/g) || [props.say];
    lines.forEach((line, i) => {
      ctx.fillText(line, canvas.width / 2, 32 + i * 24);
    });

    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(3, 1.5, 1);
    sprite.position.y = 2.5;
    mesh.add(sprite);
    mesh.userData.bubble = sprite;
    mesh.userData.bubbleText = props.say;
  } else if (mesh.userData.bubble && (!props.say || mesh.userData.bubbleText !== props.say)) {
    // Remove old bubble
    mesh.remove(mesh.userData.bubble);
    mesh.userData.bubble = null;
    mesh.userData.bubbleText = null;
  }
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
      
      // Set initial avatar state
      if (obj.id === 'avatar' && obj.properties) {
        const props = JSON.parse(obj.properties);
        avatarAction = props.action || 'idle';
      }
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
      if (data.properties) {
        const props = JSON.parse(data.properties);
        if (data.type === 'avatar') {
          updateTextBubble(mesh, props);
          avatarAction = props.action || 'idle';
        }
      }
    }
  } else if (type === 'object_deleted') {
    const mesh = objects.get(data.id);
    if (mesh) {
      scene.remove(mesh);
      objects.delete(data.id);
    }
  } else if (type === 'mood_changed') {
    console.log('Mood changed:', data.mood);
    // TODO: affect weather
  }
};

// Resize handler
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

let avatarAction = 'idle';
let lastAvatarId = null;

// Animation loop
function animate() {
  requestAnimationFrame(animate);
  
  const time = performance.now() * 0.001;
  
  controls.update();
  updateTime();
  
  // Animate avatar
  const avatarMesh = objects.get('avatar');
  if (avatarMesh) {
    animateAvatar(avatarMesh, avatarAction, time);
  }
  
  renderer.render(scene, camera);
}

// Start
loadWorld();
animate();
console.log('Pixel World loaded!');