import * as THREE from './assets/vendor/three.module.min.js';

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const mobile = window.matchMedia('(max-width: 760px)').matches;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (t) => t * t * (3 - 2 * t);
const rand = (a, b) => a + Math.random() * (b - a);
const formatTime = (seconds) => {
  const value = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
};

function webglAvailable() {
  try {
    const canvas = document.createElement('canvas');
    return Boolean(window.WebGLRenderingContext && (canvas.getContext('webgl2') || canvas.getContext('webgl')));
  } catch {
    return false;
  }
}

function makeTextTexture(lines, options = {}) {
  const list = Array.isArray(lines) ? lines : [lines];
  const width = options.width || 640;
  const height = options.height || Math.max(160, 72 + list.length * 56);
  const accent = options.accent || '#42e8ff';
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  const radius = 28;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = options.background || 'rgba(3, 10, 24, 0.94)';
  ctx.strokeStyle = accent;
  ctx.lineWidth = options.lineWidth || 5;
  const x = 6;
  const y = 6;
  const boxWidth = width - 12;
  const boxHeight = height - 12;
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + boxWidth - radius, y);
  ctx.quadraticCurveTo(x + boxWidth, y, x + boxWidth, y + radius);
  ctx.lineTo(x + boxWidth, y + boxHeight - radius);
  ctx.quadraticCurveTo(x + boxWidth, y + boxHeight, x + boxWidth - radius, y + boxHeight);
  ctx.lineTo(x + radius, y + boxHeight);
  ctx.quadraticCurveTo(x, y + boxHeight, x, y + boxHeight - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  list.forEach((line, index) => {
    ctx.fillStyle = index === 0 ? '#f4fbff' : (options.secondary || '#9fb6d9');
    ctx.font = index === 0
      ? `${options.weight || 750} ${options.fontSize || 42}px Segoe UI, Arial`
      : `${options.secondaryWeight || 550} ${options.secondarySize || 30}px Segoe UI, Arial`;
    ctx.textAlign = options.align || 'center';
    ctx.textBaseline = 'middle';
    const x = options.align === 'left' ? 34 : width / 2;
    const step = height / (list.length + 1);
    ctx.fillText(line, x, step * (index + 1), width - 60);
  });
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function makeLabel(text, accent = '#42e8ff', scale = [2.5, 0.72, 1], options = {}) {
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: makeTextTexture(text, { accent, ...options }),
    transparent: true,
    depthWrite: false,
  }));
  sprite.scale.set(...scale);
  return sprite;
}

function makePanel(width, height, accent = 0x42e8ff, depth = 0.18) {
  const group = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(width, height, depth),
    new THREE.MeshStandardMaterial({
      color: 0x071326,
      emissive: accent,
      emissiveIntensity: 0.18,
      metalness: 0.48,
      roughness: 0.34,
      transparent: true,
      opacity: 0.96,
    }),
  );
  const frame = new THREE.LineSegments(
    new THREE.EdgesGeometry(body.geometry),
    new THREE.LineBasicMaterial({ color: accent, transparent: true, opacity: 0.6 }),
  );
  group.add(body, frame);
  group.userData.body = body;
  return group;
}

function makeGlowSphere(radius, hex, opacity = 0.45) {
  return new THREE.Mesh(
    new THREE.IcosahedronGeometry(radius, 3),
    new THREE.MeshPhysicalMaterial({
      color: hex,
      emissive: hex,
      emissiveIntensity: 1.45,
      transparent: true,
      opacity,
      roughness: 0.26,
      metalness: 0.18,
      clearcoat: 0.5,
    }),
  );
}

function makeRing(radius, tube, hex, opacity = 0.48) {
  return new THREE.Mesh(
    new THREE.TorusGeometry(radius, tube, 12, 96),
    new THREE.MeshBasicMaterial({
      color: hex,
      transparent: true,
      opacity,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
}

function makeCylinderBetween(a, b, radius, hex, opacity = 0.55) {
  const start = a.clone();
  const end = b.clone();
  const direction = end.clone().sub(start);
  const length = direction.length();
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, 10),
    new THREE.MeshBasicMaterial({ color: hex, transparent: true, opacity }),
  );
  mesh.position.copy(start).add(end).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
  return mesh;
}

function setGroupOpacity(group, opacity) {
  group.traverse((object) => {
    if (!object.material) return;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    materials.forEach((material) => {
      if (!material.userData.baseOpacity) material.userData.baseOpacity = material.opacity ?? 1;
      material.transparent = true;
      material.opacity = material.userData.baseOpacity * opacity;
    });
  });
}

function setGroupScale(group, value) {
  group.scale.setScalar(Math.max(0.001, value));
}

function makeFlowDots(count, hex, size = 0.08) {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({
    color: hex,
    size,
    transparent: true,
    opacity: 0.88,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: true,
  });
  const points = new THREE.Points(geometry, material);
  points.userData.positions = positions;
  points.userData.count = count;
  return points;
}

function pathPoint(points, progress) {
  const t = clamp(progress, 0, 0.999999) * (points.length - 1);
  const index = Math.floor(t);
  const local = t - index;
  return points[index].clone().lerp(points[Math.min(index + 1, points.length - 1)], local);
}

class AnimationScheduler {
  constructor() {
    this.active = new Set();
    this.frameId = 0;
    this.lastTime = 0;
    this.tick = this.tick.bind(this);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.stop();
      else if (this.active.size) this.start();
    });
  }

  setActive(scene, active) {
    if (active) this.active.add(scene);
    else this.active.delete(scene);
    if (this.active.size && !document.hidden) this.start();
    else if (!this.active.size) this.stop();
  }

  start() {
    if (this.frameId || document.hidden) return;
    this.lastTime = performance.now();
    this.frameId = requestAnimationFrame(this.tick);
  }

  stop() {
    if (this.frameId) cancelAnimationFrame(this.frameId);
    this.frameId = 0;
    this.lastTime = 0;
  }

  tick(timestamp) {
    this.frameId = 0;
    if (document.hidden || !this.active.size) return;
    const dt = Math.min(0.05, Math.max(0.001, (timestamp - (this.lastTime || timestamp)) / 1000));
    this.lastTime = timestamp;
    this.active.forEach((scene) => scene.frame(dt, timestamp / 1000));
    if (this.active.size) this.frameId = requestAnimationFrame(this.tick);
  }
}

const scheduler = new AnimationScheduler();

class SceneBase {
  constructor(canvas, options = {}) {
    this.canvas = canvas;
    this.options = options;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(options.fov || 42, 1, 0.1, 250);
    this.camera.position.set(...(options.camera || [0, 2, 14]));
    this.cameraTarget = new THREE.Vector3();
    this.desiredCamera = this.camera.position.clone();
    this.desiredTarget = new THREE.Vector3();
    const lowPower = document.documentElement.dataset.performance === 'low';
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: !mobile && !lowPower,
      powerPreference: lowPower ? 'low-power' : 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, lowPower ? 1 : (mobile ? 1.2 : 1.55)));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = options.exposure || 1.12;
    this.visible = false;
    this.contextLost = false;
    this.hasRendered = false;
    this.pointer = new THREE.Vector2();
    this.pointerTarget = new THREE.Vector2();
    this.drag = false;
    this.dragStart = new THREE.Vector2();
    this.baseRotation = new THREE.Vector2();
    this.root = new THREE.Group();
    this.scene.add(this.root);
    this.setupLights();
    this.bind();
    this.resize();
  }

  setupLights() {
    this.scene.add(new THREE.AmbientLight(0x8fb7ff, 0.74));
    const key = new THREE.DirectionalLight(0xffffff, 2.15);
    key.position.set(7, 9, 8);
    this.scene.add(key);
    const fill = new THREE.PointLight(this.options.accent || 0x42e8ff, 18, 45);
    fill.position.set(-6, 3, 6);
    this.scene.add(fill);
    const rim = new THREE.PointLight(this.options.secondary || 0x9b72ff, 12, 40);
    rim.position.set(7, -2, -3);
    this.scene.add(rim);
  }

  bind() {
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.canvas.parentElement);
    this.intersection = new IntersectionObserver((entries) => {
      const entry = entries[0];
      this.visible = Boolean(entry?.isIntersecting);
      scheduler.setActive(this, this.visible && !this.contextLost);
      if (this.visible && typeof this.onVisible === 'function') this.onVisible();
    }, { threshold: 0.05, rootMargin: '80px 0px' });
    this.intersection.observe(this.canvas);

    const position = (event) => {
      const rect = this.canvas.getBoundingClientRect();
      return new THREE.Vector2(
        ((event.clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1,
        -(((event.clientY - rect.top) / Math.max(1, rect.height)) * 2 - 1),
      );
    };
    this.canvas.addEventListener('pointerdown', (event) => {
      this.drag = true;
      this.dragStart.copy(position(event));
      this.canvas.setPointerCapture?.(event.pointerId);
    });
    this.canvas.addEventListener('pointermove', (event) => {
      const point = position(event);
      this.pointerTarget.copy(point);
      if (this.drag && !reducedMotion) {
        this.baseRotation.y += (point.x - this.dragStart.x) * 0.45;
        this.baseRotation.x += (point.y - this.dragStart.y) * 0.24;
        this.baseRotation.x = clamp(this.baseRotation.x, -0.22, 0.22);
        this.dragStart.copy(point);
      }
    });
    this.canvas.addEventListener('pointerup', () => { this.drag = false; });
    this.canvas.addEventListener('pointerleave', () => {
      this.drag = false;
      this.pointerTarget.set(0, 0);
    });
    this.canvas.addEventListener('keydown', (event) => {
      const step = event.shiftKey ? 0.16 : 0.08;
      if (event.key === 'ArrowLeft') this.baseRotation.y -= step;
      else if (event.key === 'ArrowRight') this.baseRotation.y += step;
      else if (event.key === 'ArrowUp') this.baseRotation.x = clamp(this.baseRotation.x - step, -0.3, 0.3);
      else if (event.key === 'ArrowDown') this.baseRotation.x = clamp(this.baseRotation.x + step, -0.3, 0.3);
      else if (event.key === 'Home') this.baseRotation.set(0, 0);
      else return;
      event.preventDefault();
      scheduler.setActive(this, true);
    });
    this.canvas.addEventListener('webglcontextlost', (event) => {
      event.preventDefault();
      this.contextLost = true;
      scheduler.setActive(this, false);
      this.canvas.parentElement.classList.add('context-lost');
      const fallback = this.canvas.parentElement.querySelector('.stage-fallback');
      if (fallback) {
        fallback.setAttribute('aria-hidden', 'false');
        fallback.innerHTML = '<strong>3D context paused.</strong><span>The static poster remains available while the browser restores WebGL.</span>';
      }
    });
    this.canvas.addEventListener('webglcontextrestored', () => {
      this.contextLost = false;
      this.canvas.parentElement.classList.remove('context-lost');
      this.resize();
      scheduler.setActive(this, this.visible);
    });
    window.addEventListener('portfolio-performance-change', (event) => this.setPerformanceMode(event.detail.mode));
  }

  setPerformanceMode(mode) {
    const low = mode === 'low';
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, low ? 1 : (mobile ? 1.2 : 1.55)));
    this.resize();
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    const width = Math.max(1, rect.width);
    const height = Math.max(1, rect.height);
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  updateBase() {
    this.pointer.lerp(this.pointerTarget, 0.05);
    this.root.rotation.y = lerp(this.root.rotation.y, this.baseRotation.y + this.pointer.x * 0.035, 0.045);
    this.root.rotation.x = lerp(this.root.rotation.x, this.baseRotation.x - this.pointer.y * 0.018, 0.045);
    this.camera.position.lerp(this.desiredCamera, reducedMotion ? 1 : 0.035);
    this.cameraTarget.lerp(this.desiredTarget, reducedMotion ? 1 : 0.045);
    this.camera.lookAt(this.cameraTarget);
  }

  update() {}

  frame(dt, time) {
    if (!this.visible || this.contextLost) return;
    this.updateBase();
    this.update(dt, time);
    this.renderer.render(this.scene, this.camera);
    if (!this.hasRendered) {
      this.hasRendered = true;
      this.canvas.parentElement.classList.add('is-rendered');
      const fallback = this.canvas.parentElement.querySelector('.stage-fallback');
      fallback?.setAttribute('aria-hidden', 'true');
      window.portfolioAnalytics?.track('3d_scene_ready', { scene: this.options.storyId || this.canvas.id });
    }
  }

  destroy() {
    scheduler.setActive(this, false);
    this.intersection?.disconnect();
    this.resizeObserver?.disconnect();
    this.renderer.dispose();
  }
}

class StoryScene extends SceneBase {
  constructor(canvas, options) {
    super(canvas, options);
    this.storyId = options.storyId;
    this.phases = options.phases;
    this.totalDuration = this.phases.reduce((sum, phase) => sum + phase.duration, 0);
    this.elapsed = 0;
    this.playing = !reducedMotion;
    this.started = false;
    this.completed = false;
    this.phaseIndex = 0;
    this.phaseStart = 0;
    this.phaseProgress = 0;
    this.lastUiFrame = 0;
    this.playbackRate = 1;
    this.setupStoryControls();
  }

  setupStoryControls() {
    document.querySelector(`[data-story-play="${this.storyId}"]`)?.addEventListener('click', () => this.toggle());
    document.querySelector(`[data-story-restart="${this.storyId}"]`)?.addEventListener('click', () => this.restart());
    document.querySelector(`[data-story-prev="${this.storyId}"]`)?.addEventListener('click', () => this.step(-1));
    document.querySelector(`[data-story-next="${this.storyId}"]`)?.addEventListener('click', () => this.step(1));
  }

  onVisible() {
    if (!this.started) {
      this.started = true;
      if (!reducedMotion) this.playing = true;
      this.applyPhase(0, true);
    }
  }

  toggle() {
    this.playbackRate = 1;
    this.playing = !this.playing;
    if (this.completed && this.playing) this.restart();
    this.updatePlayButton();
  }

  restart() {
    this.playbackRate = 1;
    this.elapsed = 0;
    this.completed = false;
    this.playing = !reducedMotion;
    this.applyPhase(0, true);
    this.updatePlayButton();
  }

  playFromStart(playbackRate = 1) {
    this.playbackRate = playbackRate;
    this.elapsed = 0;
    this.completed = false;
    this.started = true;
    this.playing = true;
    this.applyPhase(0, true);
    this.updatePlayButton();
  }

  step(direction) {
    const next = clamp(this.phaseIndex + direction, 0, this.phases.length - 1);
    this.setPhaseById(this.phases[next].id, false);
  }

  setPhaseById(id, shouldPlay = false) {
    const index = this.phases.findIndex((phase) => phase.id === id);
    if (index < 0) return;
    this.elapsed = this.phases.slice(0, index).reduce((sum, phase) => sum + phase.duration, 0);
    this.completed = false;
    this.playing = shouldPlay;
    this.applyPhase(index, true);
    this.updatePlayButton();
  }

  applyPhase(index, force = false) {
    if (!force && index === this.phaseIndex) return;
    this.phaseIndex = index;
    this.phaseStart = this.phases.slice(0, index).reduce((sum, phase) => sum + phase.duration, 0);
    const phase = this.phases[index];
    this.onPhaseChange?.(phase, index);
    document.querySelectorAll(`[data-${this.storyId}-phase]`).forEach((button) => {
      const active = button.dataset[`${this.storyId}Phase`] === phase.id;
      button.classList.toggle('active', active);
      if (active) {
        button.setAttribute('aria-current', 'step');
        button.scrollIntoView?.({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'nearest', inline: 'center' });
      } else button.removeAttribute('aria-current');
    });
    this.updateStoryDom(phase);
  }

  updateStoryDom(phase) {
    const status = document.querySelector(`#${this.storyId}-status`);
    if (status) status.textContent = phase.status;
    const caption = document.querySelector(`#${this.storyId}-caption`);
    if (caption) {
      const strong = caption.querySelector('strong');
      const description = caption.querySelector('div > span');
      if (strong) strong.textContent = phase.title;
      if (description) description.textContent = phase.description;
    }
    const why = document.querySelector(`#${this.storyId}-why`);
    if (why) why.textContent = phase.why;
    Object.entries(phase.hud || {}).forEach(([key, value]) => {
      const element = document.querySelector(`#${this.storyId}-hud-${key}`);
      if (element) element.textContent = value;
    });
  }

  updatePlayButton() {
    const button = document.querySelector(`[data-story-play="${this.storyId}"]`);
    if (!button) return;
    const label = this.playing ? 'Pause' : (this.completed ? 'Replay' : 'Play');
    const iconName = this.playing ? 'pause' : (this.completed ? 'replay' : 'play');
    button.innerHTML = `<span>${label}</span>${window.portfolioIcon?.(iconName) || ''}`;
    button.setAttribute('aria-pressed', String(this.playing));
  }

  updateTimeline(dt) {
    if (this.playing && this.started) {
      this.elapsed += dt * this.playbackRate;
      if (this.elapsed >= this.totalDuration) {
        this.elapsed = this.totalDuration;
        this.playing = false;
        if (!this.completed) {
          this.completed = true;
          window.dispatchEvent(new CustomEvent('portfolio-story-complete', { detail: { story: this.storyId } }));
        }
        this.updatePlayButton();
      }
    }

    let sum = 0;
    let index = this.phases.length - 1;
    for (let i = 0; i < this.phases.length; i += 1) {
      if (this.elapsed < sum + this.phases[i].duration || i === this.phases.length - 1) {
        index = i;
        break;
      }
      sum += this.phases[i].duration;
    }
    this.phaseStart = sum;
    this.phaseProgress = clamp((this.elapsed - sum) / this.phases[index].duration, 0, 1);
    this.applyPhase(index);

    this.lastUiFrame += dt;
    if (this.lastUiFrame > 0.08) {
      this.lastUiFrame = 0;
      const progress = document.querySelector(`#${this.storyId}-progress`);
      if (progress) progress.style.width = `${(this.elapsed / this.totalDuration) * 100}%`;
      const time = document.querySelector(`#${this.storyId}-time`);
      if (time) time.textContent = `${formatTime(this.elapsed)} / ${formatTime(this.totalDuration)}`;
      this.onUiTick?.(this.phases[index], this.phaseProgress);
    }
  }

  update(dt, time) {
    this.updateTimeline(dt);
    this.updateStory(dt, time, this.phases[this.phaseIndex], this.phaseProgress);
  }

  updateStory() {}
}

class HeroScene extends SceneBase {
  constructor(canvas) {
    super(canvas, { camera: [0, 1.2, mobile ? 17 : 14], fov: mobile ? 52 : 43, accent: 0x42e8ff, secondary: 0x9b72ff });
    this.mode = 'complaints';
    this.core = makeGlowSphere(1.38, 0x42e8ff, 0.28);
    this.root.add(this.core);
    this.wire = new THREE.Mesh(
      new THREE.IcosahedronGeometry(1.68, 3),
      new THREE.MeshBasicMaterial({ color: 0xb7f5ff, wireframe: true, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending }),
    );
    this.root.add(this.wire);
    this.rings = [
      makeRing(2.25, 0.025, 0x42e8ff, 0.5),
      makeRing(2.8, 0.018, 0x4c7dff, 0.34),
      makeRing(3.4, 0.014, 0x9b72ff, 0.25),
    ];
    this.rings[0].rotation.x = 1.2;
    this.rings[1].rotation.set(0.4, 0.7, 0);
    this.rings[2].rotation.set(1.1, 0.2, 0.4);
    this.rings.forEach((ring) => this.root.add(ring));
    this.nodeCount = mobile ? 100 : 180;
    this.positions = new Float32Array(this.nodeCount * 3);
    this.targets = {
      audit: new Float32Array(this.nodeCount * 3),
      complaints: new Float32Array(this.nodeCount * 3),
      rag: new Float32Array(this.nodeCount * 3),
    };
    this.generateTargets();
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.points = new THREE.Points(geometry, new THREE.PointsMaterial({
      color: 0x7eeeff,
      size: mobile ? 0.09 : 0.073,
      transparent: true,
      opacity: 0.92,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }));
    this.root.add(this.points);
    this.flow = makeFlowDots(mobile ? 24 : 44, 0xffffff, mobile ? 0.09 : 0.07);
    this.root.add(this.flow);
    this.setMode('complaints');
  }

  generateTargets() {
    for (let index = 0; index < this.nodeCount; index += 1) {
      const layer = index % 7;
      this.targets.audit.set([
        -5.8 + layer * 1.9,
        rand(-3, 3) * (0.82 + layer * 0.02),
        rand(-2.4, 2.4),
      ], index * 3);
      const t = index / Math.max(1, this.nodeCount - 1);
      const angle = t * Math.PI * 11;
      const radius = 1.4 + Math.sin(t * Math.PI) * 3.2;
      this.targets.complaints.set([
        -5.8 + t * 11.6,
        Math.sin(angle) * radius * 0.35,
        Math.cos(angle) * radius * 0.72,
      ], index * 3);
      const theta = rand(0, Math.PI * 2);
      const phi = Math.acos(rand(-1, 1));
      const r = rand(2.0, 6.1);
      this.targets.rag.set([
        Math.sin(phi) * Math.cos(theta) * r,
        Math.cos(phi) * r * 0.66,
        Math.sin(phi) * Math.sin(theta) * r,
      ], index * 3);
      this.positions.set([
        this.targets.audit[index * 3],
        this.targets.audit[index * 3 + 1],
        this.targets.audit[index * 3 + 2],
      ], index * 3);
    }
  }

  setMode(mode) {
    this.mode = mode;
    const palette = { audit: 0x42e8ff, complaints: 0xff9b42, rag: 0x9b72ff };
    const value = palette[mode];
    this.core.material.color.setHex(value);
    this.core.material.emissive.setHex(value);
    this.points.material.color.setHex(value);
  }

  update(dt, time) {
    const target = this.targets[this.mode];
    const positions = this.points.geometry.attributes.position.array;
    for (let index = 0; index < positions.length; index += 1) {
      positions[index] = lerp(positions[index], target[index], reducedMotion ? 1 : 0.034);
    }
    this.points.geometry.attributes.position.needsUpdate = true;
    this.core.rotation.y += dt * 0.2;
    this.wire.rotation.y -= dt * 0.12;
    this.wire.rotation.x += dt * 0.06;
    this.rings.forEach((ring, index) => { ring.rotation.z += dt * (0.05 + index * 0.025); });
    const flowPositions = this.flow.userData.positions;
    for (let index = 0; index < this.flow.userData.count; index += 1) {
      const progress = (time * 0.08 + index / this.flow.userData.count) % 1;
      const point = pathPoint([
        new THREE.Vector3(-5.8, 0, 0),
        new THREE.Vector3(-2.2, Math.sin(progress * 6) * 1.2, 0.4),
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(3.2, Math.cos(progress * 5) * 1.2, -0.5),
        new THREE.Vector3(5.8, 0, 0),
      ], progress);
      flowPositions[index * 3] = point.x;
      flowPositions[index * 3 + 1] = point.y;
      flowPositions[index * 3 + 2] = point.z;
    }
    this.flow.geometry.attributes.position.needsUpdate = true;
  }
}

const AUDIT_PHASES = [
  {
    id: 'upload', duration: 6.5, status: 'DATASET ARRIVING', title: 'Dataset enters the audit',
    description: 'A CSV and target column become a visible matrix before any model is allowed to train.',
    why: 'The workflow starts with evidence about the dataset—not assumptions about the model.',
    hud: { input: 'CSV + target', decision: 'Not evaluated', output: 'Profile pending' },
    camera: [-2.4, 4.2, 17.2], target: [-4.2, 0.2, 0],
  },
  {
    id: 'detect', duration: 5.5, status: 'PROBLEM TYPE DETECTED', title: 'The target determines the ML problem',
    description: 'Target values are inspected to decide classification or regression and to choose valid evaluation logic.',
    why: 'Metrics and models are meaningless until the problem type is correctly understood.',
    hud: { input: 'Target: Grade', decision: 'Multiclass', output: 'Metric plan ready' },
    camera: [-1.7, 3.8, 16.3], target: [-2.0, 1.2, 0],
  },
  {
    id: 'audit', duration: 8, status: 'PARALLEL AUDITS RUNNING', title: 'Four deterministic audits run in parallel',
    description: 'Data quality, leakage, imbalance and metric suitability inspect the same dataset from different risk angles.',
    why: 'Parallel checks expose multiple failure modes without asking an LLM to invent a judgment.',
    hud: { input: 'Profile + target', decision: '4 audit branches', output: 'Risk signals forming' },
    camera: [0.2, 4.6, 16], target: [0, 0.3, 0],
  },
  {
    id: 'risk', duration: 6, status: 'WORKFLOW BLOCKED', title: 'A leakage signal stops model training',
    description: 'A target-like feature and suspicious correlation raise a review item; the path to modeling is physically blocked.',
    why: 'Stopping is a feature: a strong-looking model built on leakage is worse than no model.',
    hud: { input: '3 risk items', decision: 'Review required', output: 'Training blocked' },
    camera: [1.9, 3.5, 15], target: [2.0, 0, 0],
  },
  {
    id: 'review', duration: 7, status: 'HUMAN DECISION GATE', title: 'A reviewer decides what happens next',
    description: 'The reviewer can accept risk, mark a false positive, request a data fix, or reject modeling.',
    why: 'The system keeps accountability with a person when context matters more than a threshold.',
    hud: { input: 'Review items', decision: 'Approve with note', output: 'Workflow resumes' },
    camera: [3.6, 3.4, 14.6], target: [3.8, 0.1, 0],
  },
  {
    id: 'models', duration: 6.5, status: 'BASELINES COMPARING', title: 'Simple baseline models create an evidence floor',
    description: 'Approved data moves through preprocessing and several simple models; evaluation is comparison, not AutoML.',
    why: 'A trustworthy baseline tells the team whether the dataset contains usable signal before optimisation.',
    hud: { input: 'Approved dataset', decision: 'Best baseline: RF', output: 'Macro F1: 0.84' },
    camera: [5.5, 3.2, 14.8], target: [5.9, 0.1, 0],
  },
  {
    id: 'explain', duration: 6.5, status: 'EVIDENCE EXPLAINED', title: 'SHAP and MLflow make the result inspectable',
    description: 'Feature impact emerges beside the tracked run so a reviewer can connect performance to evidence.',
    why: 'A metric without provenance or explanation is difficult to review and easy to misuse.',
    hud: { input: 'Best baseline', decision: 'Top drivers visible', output: 'MLflow run logged' },
    camera: [7.3, 3.0, 14.6], target: [7.6, 0.2, 0],
  },
  {
    id: 'report', duration: 6, status: 'AUDIT COMPLETE', title: 'The workflow ends with a reviewable audit package',
    description: 'Metrics, risks, human decisions, model evidence and explanations are assembled into Markdown and JSON reports.',
    why: 'The final output preserves why the workflow continued—not only what score the model achieved.',
    hud: { input: 'All evidence', decision: 'Ready for experiment', output: 'JSON + Markdown report' },
    camera: [8.7, 3.1, 15.2], target: [9.0, 0.2, 0],
  },
];

class AuditStory extends StoryScene {
  constructor(canvas) {
    super(canvas, {
      storyId: 'audit', phases: AUDIT_PHASES, camera: [-2.4, 4.2, mobile ? 20 : 17.2],
      fov: mobile ? 55 : 43, accent: 0x42e8ff, secondary: 0xff5d75,
    });
    this.createWorld();
    this.applyPhase(0, true);
  }

  createWorld() {
    const floor = new THREE.GridHelper(22, 44, 0x1b6c86, 0x0a2740);
    floor.position.y = -3.0;
    floor.material.transparent = true;
    floor.material.opacity = 0.32;
    this.root.add(floor);

    this.file = makePanel(2.1, 1.45, 0x42e8ff);
    this.file.position.set(-6.7, 0.1, 0);
    const fileLabel = makeLabel(['CSV + TARGET', 'student_data.csv'], '#42e8ff', [2.05, 0.72, 1], { secondarySize: 25 });
    fileLabel.position.z = 0.18;
    this.file.add(fileLabel);
    this.root.add(this.file);

    this.grid = new THREE.Group();
    this.grid.position.set(-4.2, 0, 0);
    this.cells = [];
    for (let row = 0; row < 7; row += 1) {
      for (let col = 0; col < 10; col += 1) {
        const risk = (row === 2 && col === 7) || (row === 5 && col === 3) || (row === 1 && col === 4);
        const missing = (row === 4 && col === 8) || (row === 0 && col === 2);
        const material = new THREE.MeshStandardMaterial({
          color: 0x123450,
          emissive: risk ? 0xff5d75 : (missing ? 0x9b72ff : 0x42e8ff),
          emissiveIntensity: 0.15,
          metalness: 0.25,
          roughness: 0.4,
        });
        const cell = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.25, 0.25), material);
        cell.position.set((col - 4.5) * 0.34, (row - 3) * 0.34, 0);
        cell.userData = { risk, missing, baseY: cell.position.y };
        this.grid.add(cell);
        this.cells.push(cell);
      }
    }
    const gridFrame = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(3.8, 2.8, 0.36)),
      new THREE.LineBasicMaterial({ color: 0x42e8ff, transparent: true, opacity: 0.55 }),
    );
    this.grid.add(gridFrame);
    this.gridLabel = makeLabel('DATASET MATRIX', '#42e8ff', [2.55, 0.68, 1]);
    this.gridLabel.position.set(0, 2.05, 0);
    this.grid.add(this.gridLabel);
    this.scanner = new THREE.Mesh(
      new THREE.PlaneGeometry(3.6, 0.18),
      new THREE.MeshBasicMaterial({ color: 0x42e8ff, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }),
    );
    this.scanner.position.z = 0.24;
    this.grid.add(this.scanner);
    this.root.add(this.grid);

    this.problem = makePanel(2.4, 1.2, 0x4c7dff);
    this.problem.position.set(-2.1, 2.0, 0);
    const problemLabel = makeLabel(['PROBLEM TYPE', 'MULTICLASS'], '#4c7dff', [2.3, 0.9, 1], { secondarySize: 28 });
    problemLabel.position.z = 0.18;
    this.problem.add(problemLabel);
    this.root.add(this.problem);

    this.reactor = new THREE.Group();
    this.reactor.position.set(0, 0, 0);
    this.reactorCore = makeGlowSphere(0.85, 0x42e8ff, 0.34);
    this.reactorWire = new THREE.Mesh(
      new THREE.IcosahedronGeometry(1.08, 2),
      new THREE.MeshBasicMaterial({ color: 0x89f4ff, wireframe: true, transparent: true, opacity: 0.44, blending: THREE.AdditiveBlending }),
    );
    this.reactor.add(this.reactorCore, this.reactorWire);
    [1.35, 1.72].forEach((radius, index) => {
      const ring = makeRing(radius, 0.025, index ? 0x4c7dff : 0x42e8ff, 0.42);
      ring.rotation.set(Math.PI / 2 - index * 0.4, index * 0.5, 0);
      this.reactor.add(ring);
    });
    const reactorLabel = makeLabel('RISK AGGREGATOR', '#42e8ff', [2.7, 0.72, 1]);
    reactorLabel.position.set(0, 2.1, 0);
    this.reactor.add(reactorLabel);
    this.root.add(this.reactor);

    const moduleData = [
      ['DATA QUALITY', 0x42e8ff, -1.7, 1.7],
      ['LEAKAGE', 0xff5d75, 1.7, 1.7],
      ['IMBALANCE', 0xff9b42, -1.7, -1.7],
      ['METRICS', 0x9b72ff, 1.7, -1.7],
    ];
    this.auditModules = [];
    moduleData.forEach(([label, accent, x, y]) => {
      const panel = makePanel(1.45, 0.82, accent, 0.14);
      panel.position.set(x, y, 0);
      const sprite = makeLabel(label, `#${accent.toString(16).padStart(6, '0')}`, [1.4, 0.48, 1], { fontSize: 32 });
      sprite.position.z = 0.15;
      panel.add(sprite);
      this.reactor.add(panel);
      this.auditModules.push(panel);
    });

    this.gate = new THREE.Group();
    this.gate.position.set(2.35, 0, 0);
    this.gateBars = [];
    [-0.55, 0, 0.55].forEach((y) => {
      const bar = new THREE.Mesh(
        new THREE.BoxGeometry(0.22, 0.34, 2.9),
        new THREE.MeshStandardMaterial({ color: 0x3a0812, emissive: 0xff314f, emissiveIntensity: 1.2, metalness: 0.4, roughness: 0.28 }),
      );
      bar.position.y = y;
      this.gate.add(bar);
      this.gateBars.push(bar);
    });
    const gateLabel = makeLabel('RISK BLOCK', '#ff314f', [2.0, 0.6, 1]);
    gateLabel.position.set(0, 1.35, 0);
    this.gate.add(gateLabel);
    this.root.add(this.gate);

    this.human = makePanel(2.2, 2.1, 0x49e39c, 0.2);
    this.human.position.set(4.1, 0, 0);
    const humanLabel = makeLabel(['HUMAN REVIEW', 'APPROVE / FIX / STOP'], '#49e39c', [2.05, 0.95, 1], { secondarySize: 25 });
    humanLabel.position.set(0, 0.52, 0.17);
    this.human.add(humanLabel);
    const person = new THREE.Mesh(
      new THREE.SphereGeometry(0.28, 24, 24),
      new THREE.MeshStandardMaterial({ color: 0xbfe9dc, emissive: 0x49e39c, emissiveIntensity: 0.25 }),
    );
    person.position.set(0, -0.45, 0.24);
    this.human.add(person);
    this.root.add(this.human);

    this.models = new THREE.Group();
    this.models.position.set(6.0, -0.15, 0);
    const modelLabel = makeLabel('BASELINE MODELS', '#4c7dff', [2.5, 0.7, 1]);
    modelLabel.position.set(0, 2.15, 0);
    this.models.add(modelLabel);
    const names = ['LR', 'RF', 'SVC'];
    this.modelBars = [];
    [0.71, 0.84, 0.79].forEach((score, index) => {
      const bar = new THREE.Mesh(
        new THREE.BoxGeometry(0.5, score * 2.4, 0.65),
        new THREE.MeshStandardMaterial({ color: index === 1 ? 0x49e39c : 0x4c7dff, emissive: index === 1 ? 0x49e39c : 0x4c7dff, emissiveIntensity: 0.35, metalness: 0.3, roughness: 0.35 }),
      );
      bar.position.set((index - 1) * 0.8, -1.15 + score * 1.2, 0);
      bar.userData.targetScale = 1;
      this.models.add(bar);
      const label = makeLabel(`${names[index]} ${score.toFixed(2)}`, index === 1 ? '#49e39c' : '#4c7dff', [1.1, 0.36, 1], { fontSize: 28 });
      label.position.set((index - 1) * 0.8, -1.55, 0.45);
      this.models.add(label);
      this.modelBars.push(bar);
    });
    this.root.add(this.models);

    this.explain = new THREE.Group();
    this.explain.position.set(7.8, 0, 0);
    const explainPanel = makePanel(2.6, 2.5, 0x9b72ff, 0.18);
    this.explain.add(explainPanel);
    const explainLabel = makeLabel('SHAP + MLFLOW', '#9b72ff', [2.35, 0.65, 1]);
    explainLabel.position.set(0, 1.75, 0.18);
    this.explain.add(explainLabel);
    this.shapBars = [];
    [1.5, 1.15, 0.86, 0.58].forEach((width, index) => {
      const bar = new THREE.Mesh(
        new THREE.BoxGeometry(width, 0.18, 0.14),
        new THREE.MeshBasicMaterial({ color: index < 2 ? 0xff5d75 : 0x42e8ff }),
      );
      bar.position.set(-0.95 + width / 2, 0.8 - index * 0.43, 0.18);
      this.explain.add(bar);
      this.shapBars.push(bar);
    });
    this.root.add(this.explain);

    this.report = makePanel(2.25, 2.7, 0x49e39c, 0.2);
    this.report.position.set(9.8, 0.1, 0);
    const reportLabel = makeLabel(['AUDIT COMPLETE', 'JSON + MARKDOWN'], '#49e39c', [2.1, 0.92, 1], { secondarySize: 26 });
    reportLabel.position.set(0, 0.7, 0.18);
    this.report.add(reportLabel);
    for (let index = 0; index < 5; index += 1) {
      const line = new THREE.Mesh(new THREE.BoxGeometry(1.4 - index * 0.08, 0.06, 0.08), new THREE.MeshBasicMaterial({ color: 0x7db9b0 }));
      line.position.set(0, 0.05 - index * 0.28, 0.18);
      this.report.add(line);
    }
    this.root.add(this.report);

    this.mainPath = [
      new THREE.Vector3(-6.2, 0, 0),
      new THREE.Vector3(-4.3, 0, 0),
      new THREE.Vector3(-2.2, 0.8, 0),
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(2.2, 0, 0),
      new THREE.Vector3(4.1, 0, 0),
      new THREE.Vector3(6, 0, 0),
      new THREE.Vector3(7.8, 0, 0),
      new THREE.Vector3(9.8, 0, 0),
    ];
    for (let index = 0; index < this.mainPath.length - 1; index += 1) {
      this.root.add(makeCylinderBetween(this.mainPath[index], this.mainPath[index + 1], 0.035, 0x42e8ff, 0.25));
    }
    this.pulses = Array.from({ length: mobile ? 10 : 18 }, (_, index) => {
      const pulse = makeGlowSphere(index % 5 === 0 ? 0.12 : 0.07, 0x42e8ff, 0.7);
      pulse.userData.offset = index / (mobile ? 10 : 18);
      this.root.add(pulse);
      return pulse;
    });
  }

  onPhaseChange(phase) {
    this.desiredCamera.set(...phase.camera);
    this.desiredTarget.set(...phase.target);
  }

  onUiTick(phase, progress) {
    if (phase.id === 'audit') {
      const output = document.querySelector('#audit-hud-output');
      if (output) output.textContent = `${Math.min(4, Math.floor(progress * 4) + 1)}/4 checks complete`;
    }
  }

  updateStory(dt, time, phase, progress) {
    this.reactorCore.rotation.y += dt * 0.55;
    this.reactorWire.rotation.y -= dt * 0.28;
    this.reactorWire.rotation.x += dt * 0.18;
    this.scanner.position.y = -1.2 + ((time * 0.55) % 1) * 2.4;

    const phaseOrder = AUDIT_PHASES.findIndex((item) => item.id === phase.id);
    setGroupOpacity(this.file, phaseOrder <= 1 ? 1 : 0.38);
    setGroupOpacity(this.grid, phaseOrder <= 4 ? 1 : 0.42);
    setGroupOpacity(this.problem, phaseOrder >= 1 && phaseOrder <= 3 ? 1 : 0.22);
    setGroupOpacity(this.reactor, phaseOrder >= 2 ? 1 : 0.18);
    setGroupOpacity(this.gate, phaseOrder >= 3 && phaseOrder <= 4 ? 1 : 0.15);
    setGroupOpacity(this.human, phaseOrder >= 4 ? 1 : 0.15);
    setGroupOpacity(this.models, phaseOrder >= 5 ? 1 : 0.12);
    setGroupOpacity(this.explain, phaseOrder >= 6 ? 1 : 0.1);
    setGroupOpacity(this.report, phaseOrder >= 7 ? 1 : 0.08);

    this.scanner.visible = phase.id === 'upload' || phase.id === 'audit';
    this.cells.forEach((cell, index) => {
      const flagged = cell.userData.risk || cell.userData.missing;
      const auditActive = phase.id === 'audit' || phase.id === 'risk';
      cell.material.emissiveIntensity = auditActive && flagged
        ? 1.3 + Math.sin(time * 6 + index) * 0.35
        : 0.16;
      cell.position.z = auditActive && flagged ? 0.18 + Math.sin(time * 4 + index) * 0.05 : 0;
    });

    this.auditModules.forEach((module, index) => {
      const active = phase.id === 'audit' && progress > index / 4;
      module.userData.body.material.emissiveIntensity = active ? 0.9 : 0.16;
      module.scale.setScalar(active ? 1.08 : 1);
    });

    const gateOpen = phase.id === 'review' && progress > 0.45 || phaseOrder > 4;
    this.gateBars.forEach((bar, index) => {
      const targetY = gateOpen ? 2.2 + index * 0.4 : (index - 1) * 0.55;
      bar.position.y = lerp(bar.position.y, targetY, 0.07);
      bar.material.emissiveIntensity = phase.id === 'risk' ? 1.8 + Math.sin(time * 7) * 0.35 : 0.65;
    });

    this.modelBars.forEach((bar, index) => {
      const visible = phaseOrder >= 5;
      const target = visible ? 1 : 0.03;
      bar.scale.y = lerp(bar.scale.y, target, 0.07 + index * 0.01);
    });
    this.shapBars.forEach((bar, index) => {
      const target = phaseOrder >= 6 ? 1 : 0.02;
      bar.scale.x = lerp(bar.scale.x, target, 0.075 + index * 0.012);
    });
    setGroupScale(this.report, lerp(this.report.scale.x, phaseOrder >= 7 ? 1 : 0.02, 0.08));

    const maxPath = [0.16, 0.27, 0.49, 0.52, 0.66, 0.78, 0.9, 1][phaseOrder];
    const blockedAt = phase.id === 'risk' ? 0.48 : maxPath;
    this.pulses.forEach((pulse) => {
      let travel = (time * 0.08 + pulse.userData.offset) % 1;
      travel *= blockedAt;
      pulse.position.copy(pathPoint(this.mainPath, travel));
      pulse.visible = phase.id !== 'risk' || travel < 0.48;
      pulse.material.color.setHex(gateOpen && travel > 0.48 ? 0x49e39c : 0x42e8ff);
      pulse.material.emissive.setHex(gateOpen && travel > 0.48 ? 0x49e39c : 0x42e8ff);
    });
  }
}

const COMPLAINT_PHASES = [
  {
    id: 'raw', duration: 6, status: 'RAW CSV ONLINE', title: '8–9 GB raw complaint source',
    description: 'The pipeline starts with a file too large to load casually inside an interactive dashboard.',
    why: 'Scale is an engineering constraint, so the animation begins with the memory problem.',
    hud: { rows: '0 / 15.95M', format: 'Raw CSV', output: 'Waiting' },
    camera: [-5.8, 4.6, 17.5], target: [-6.1, 0, 0],
  },
  {
    id: 'chunks', duration: 7, status: 'CHUNKS STREAMING', title: 'The file is processed in controlled batches',
    description: 'Rows move through the pipeline as manageable chunks instead of one memory-heavy dataframe.',
    why: 'Chunking makes 15.95M records feasible on a normal machine and creates measurable progress.',
    hud: { rows: 'Streaming batches', format: 'CSV chunks', output: 'Memory controlled' },
    camera: [-3.8, 4.0, 16.5], target: [-3.5, -0.4, 0],
  },
  {
    id: 'validate', duration: 7, status: 'VALIDATION + PRUNING', title: 'Invalid rows and unused columns leave the main flow',
    description: 'Schema checks, cleaning and column pruning visibly separate usable records from rejected or unnecessary data.',
    why: 'A smaller, cleaner analytical layer improves both correctness and runtime performance.',
    hud: { rows: '15.95M checked', format: 'Validated rows', output: 'Noise removed' },
    camera: [-1.8, 4.1, 16], target: [-1.5, 0, 0],
  },
  {
    id: 'parquet', duration: 6.5, status: 'PARQUET LAYERS BUILT', title: 'Raw blocks compress into reusable Parquet layers',
    description: 'The wide raw stream becomes smaller columnar cubes and pre-aggregated summaries for fast dashboard reads.',
    why: 'The application serves prepared evidence instead of repeatedly reprocessing the original 8–9 GB file.',
    hud: { rows: '15.95M retained', format: 'Parquet', output: 'Fast analytical reads' },
    camera: [0.0, 4.5, 15.7], target: [0.4, 0, 0],
  },
  {
    id: 'analytics', duration: 7, status: 'EXECUTIVE ANALYTICS', title: 'The data branches into business questions',
    description: 'Product, company, issue, state and response dimensions become KPI layers instead of one undifferentiated table.',
    why: 'Business users need comparable dimensions and trends—not millions of raw rows.',
    hud: { rows: 'Aggregated views', format: 'KPI tables', output: 'Product · company · state' },
    camera: [2.4, 4.2, 15.5], target: [2.8, 0, 0],
  },
  {
    id: 'intelligence', duration: 7, status: 'RISK + NLP SIGNALS', title: 'Risk, growth and NLP become decision signals',
    description: 'Company risk, growth labels, complaint classification and topics emerge as separate intelligence layers.',
    why: 'The platform moves from “what happened?” to “where should attention go next?”.',
    hud: { rows: 'Text + metadata', format: 'Features + NLP', output: 'Risk priorities' },
    camera: [4.6, 3.8, 15.5], target: [5.0, 0.2, 0],
  },
  {
    id: 'forecast', duration: 8, status: 'FORECAST VALIDATED', title: 'Historical volume becomes a six-month forecast',
    description: 'A holdout segment tests the Prophet forecast before the future curve is shown with its 3.57% MAPE.',
    why: 'Forecasting is presented with validation, not as a decorative future line.',
    hud: { rows: 'Monthly history', format: 'Time series', output: '6-month outlook · 3.57% MAPE' },
    camera: [6.4, 4.4, 15.8], target: [6.8, 0, 0],
  },
  {
    id: 'decisions', duration: 7.5, status: 'ACTION PLAN READY', title: 'All branches merge into executive actions',
    description: 'KPIs, risk, NLP and forecast outputs converge into recommendations for monitoring, prioritisation and capacity planning.',
    why: 'The final product is a decision system, not a collection of charts.',
    hud: { rows: 'All evidence merged', format: 'Executive layer', output: 'Recommended actions' },
    camera: [8.5, 4.1, 16.2], target: [8.7, 0.1, 0],
  },
];

class ComplaintStory extends StoryScene {
  constructor(canvas) {
    super(canvas, {
      storyId: 'complaints', phases: COMPLAINT_PHASES, camera: [-5.8, 4.6, mobile ? 21 : 17.5],
      fov: mobile ? 56 : 43, accent: 0xff9b42, secondary: 0x49e39c,
    });
    this.createWorld();
    this.applyPhase(0, true);
  }

  createWorld() {
    const floor = new THREE.GridHelper(24, 48, 0x6a3a12, 0x28180d);
    floor.position.y = -3.1;
    floor.material.transparent = true;
    floor.material.opacity = 0.32;
    this.root.add(floor);

    this.raw = makePanel(2.5, 2.9, 0xff9b42, 0.35);
    this.raw.position.set(-7.2, 0, 0);
    const rawLabel = makeLabel(['RAW CFPB CSV', '8–9 GB · 15.95M rows'], '#ff9b42', [2.35, 1.05, 1], { secondarySize: 27 });
    rawLabel.position.set(0, 0.75, 0.25);
    this.raw.add(rawLabel);
    for (let index = 0; index < 7; index += 1) {
      const row = new THREE.Mesh(new THREE.BoxGeometry(1.65, 0.07, 0.08), new THREE.MeshBasicMaterial({ color: index % 2 ? 0xffc074 : 0xff8b36 }));
      row.position.set(0, 0.1 - index * 0.26, 0.25);
      this.raw.add(row);
    }
    this.root.add(this.raw);

    this.conveyor = new THREE.Group();
    this.conveyor.position.set(-4.7, -0.4, 0);
    const belt = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.18, 1.35), new THREE.MeshStandardMaterial({ color: 0x2c1b10, metalness: 0.7, roughness: 0.3 }));
    this.conveyor.add(belt);
    this.chunks = [];
    for (let index = 0; index < 12; index += 1) {
      const chunk = new THREE.Mesh(
        new THREE.BoxGeometry(0.34, 0.34, 0.34),
        new THREE.MeshStandardMaterial({ color: 0xff9b42, emissive: 0xff6d1f, emissiveIntensity: 0.35, metalness: 0.35, roughness: 0.3 }),
      );
      chunk.userData.offset = index / 12;
      this.conveyor.add(chunk);
      this.chunks.push(chunk);
    }
    const chunkLabel = makeLabel('100K-ROW CHUNKS', '#ff9b42', [2.5, 0.68, 1]);
    chunkLabel.position.set(0, 1.35, 0);
    this.conveyor.add(chunkLabel);
    this.root.add(this.conveyor);

    this.validation = new THREE.Group();
    this.validation.position.set(-2.2, 0, 0);
    const gate = makePanel(2.1, 2.8, 0xffc15a, 0.28);
    this.validation.add(gate);
    const gateLabel = makeLabel(['VALIDATE', 'SCHEMA · NULLS · TYPES'], '#ffc15a', [2.0, 0.95, 1], { secondarySize: 24 });
    gateLabel.position.set(0, 0.78, 0.2);
    this.validation.add(gateLabel);
    this.rejects = [];
    for (let index = 0; index < 5; index += 1) {
      const reject = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.2), new THREE.MeshBasicMaterial({ color: 0xff314f }));
      reject.position.set(-0.55 + index * 0.28, -0.7, 0.2);
      this.validation.add(reject);
      this.rejects.push(reject);
    }
    this.root.add(this.validation);

    this.parquet = new THREE.Group();
    this.parquet.position.set(0.45, -0.1, 0);
    const parquetLabel = makeLabel(['PARQUET LAYERS', 'COLUMNAR + PRE-AGGREGATED'], '#49e39c', [2.5, 0.95, 1], { secondarySize: 23 });
    parquetLabel.position.set(0, 1.8, 0);
    this.parquet.add(parquetLabel);
    this.parquetBlocks = [];
    for (let layer = 0; layer < 4; layer += 1) {
      for (let index = 0; index < 5 - layer; index += 1) {
        const block = new THREE.Mesh(
          new THREE.BoxGeometry(0.42, 0.32, 0.48),
          new THREE.MeshStandardMaterial({ color: 0x123c34, emissive: 0x49e39c, emissiveIntensity: 0.34, metalness: 0.45, roughness: 0.25 }),
        );
        block.position.set((index - (4 - layer) / 2) * 0.5, -1.05 + layer * 0.38, 0);
        this.parquet.add(block);
        this.parquetBlocks.push(block);
      }
    }
    this.root.add(this.parquet);

    this.analytics = new THREE.Group();
    this.analytics.position.set(3.0, 0, 0);
    const analyticsLabel = makeLabel('ANALYTICS BRANCHES', '#42e8ff', [2.5, 0.72, 1]);
    analyticsLabel.position.set(0, 2.1, 0);
    this.analytics.add(analyticsLabel);
    const analyticsNames = ['PRODUCT', 'COMPANY', 'STATE', 'ISSUE'];
    this.analyticsTowers = [];
    analyticsNames.forEach((name, index) => {
      const tower = makePanel(0.9, 1.25 + index * 0.16, 0x42e8ff, 0.45);
      tower.position.set((index - 1.5) * 0.9, -0.8 + index * 0.08, 0);
      const label = makeLabel(name, '#42e8ff', [0.85, 0.36, 1], { fontSize: 28 });
      label.position.set(0, 0, 0.32);
      tower.add(label);
      this.analytics.add(tower);
      this.analyticsTowers.push(tower);
    });
    this.root.add(this.analytics);

    this.intelligence = new THREE.Group();
    this.intelligence.position.set(5.2, 0, 0);
    this.riskRadar = makeRing(1.05, 0.055, 0xff5d75, 0.75);
    this.riskRadar.rotation.x = Math.PI / 2;
    this.intelligence.add(this.riskRadar);
    const riskCore = makeGlowSphere(0.46, 0xff5d75, 0.5);
    this.intelligence.add(riskCore);
    const intelligenceLabel = makeLabel(['RISK + NLP', 'CLASSIFY · TOPICS · GROWTH'], '#ff5d75', [2.6, 0.95, 1], { secondarySize: 22 });
    intelligenceLabel.position.set(0, 2.0, 0);
    this.intelligence.add(intelligenceLabel);
    this.root.add(this.intelligence);

    this.forecast = new THREE.Group();
    this.forecast.position.set(7.1, 0, 0);
    const forecastPanel = makePanel(2.8, 2.55, 0x9b72ff, 0.22);
    this.forecast.add(forecastPanel);
    const forecastLabel = makeLabel(['6-MONTH FORECAST', 'HOLDOUT MAPE 3.57%'], '#9b72ff', [2.55, 0.9, 1], { secondarySize: 25 });
    forecastLabel.position.set(0, 1.7, 0.2);
    this.forecast.add(forecastLabel);
    const history = [
      new THREE.Vector3(-1.05, -0.7, 0.22), new THREE.Vector3(-0.72, -0.25, 0.22),
      new THREE.Vector3(-0.38, -0.52, 0.22), new THREE.Vector3(-0.05, 0.02, 0.22),
      new THREE.Vector3(0.3, -0.15, 0.22), new THREE.Vector3(0.65, 0.45, 0.22),
      new THREE.Vector3(1.02, 0.62, 0.22),
    ];
    this.forecastLine = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(history),
      new THREE.LineBasicMaterial({ color: 0xcbb5ff, transparent: true, opacity: 0.92 }),
    );
    this.forecast.add(this.forecastLine);
    this.forecastLine.geometry.setDrawRange(0, 1);
    this.root.add(this.forecast);

    this.decisions = new THREE.Group();
    this.decisions.position.set(9.4, 0, 0);
    const decisionsLabel = makeLabel('EXECUTIVE ACTIONS', '#49e39c', [2.6, 0.72, 1]);
    decisionsLabel.position.set(0, 2.05, 0);
    this.decisions.add(decisionsLabel);
    this.decisionCards = [];
    ['MONITOR COMPANY', 'PRIORITISE ISSUE', 'PLAN CAPACITY'].forEach((label, index) => {
      const card = makePanel(2.15, 0.7, 0x49e39c, 0.16);
      card.position.set(0, 0.75 - index * 0.92, 0);
      const sprite = makeLabel(label, '#49e39c', [2.05, 0.42, 1], { fontSize: 30 });
      sprite.position.z = 0.15;
      card.add(sprite);
      this.decisions.add(card);
      this.decisionCards.push(card);
    });
    this.root.add(this.decisions);

    this.riverPath = [
      new THREE.Vector3(-7, -0.7, 0), new THREE.Vector3(-4.7, -0.5, 0),
      new THREE.Vector3(-2.2, -0.3, 0), new THREE.Vector3(0.4, -0.15, 0),
      new THREE.Vector3(3.0, 0, 0), new THREE.Vector3(5.2, 0, 0),
      new THREE.Vector3(7.1, 0, 0), new THREE.Vector3(9.4, 0, 0),
    ];
    for (let index = 0; index < this.riverPath.length - 1; index += 1) {
      this.root.add(makeCylinderBetween(this.riverPath[index], this.riverPath[index + 1], 0.055, index < 3 ? 0xff9b42 : 0x49e39c, 0.28));
    }
    this.dataDots = makeFlowDots(mobile ? 90 : 180, 0xffb35a, mobile ? 0.09 : 0.065);
    this.root.add(this.dataDots);
    this.rejectedDots = makeFlowDots(mobile ? 12 : 28, 0xff314f, mobile ? 0.09 : 0.07);
    this.root.add(this.rejectedDots);
  }

  onPhaseChange(phase) {
    this.desiredCamera.set(...phase.camera);
    this.desiredTarget.set(...phase.target);
  }

  onUiTick(phase, progress) {
    const rows = document.querySelector('#complaints-hud-rows');
    if (!rows) return;
    const index = COMPLAINT_PHASES.findIndex((item) => item.id === phase.id);
    const base = [0, 0.8, 5.3, 9.8, 13.2, 15.1, 15.95, 15.95][index];
    const next = [0.8, 5.3, 9.8, 13.2, 15.1, 15.95, 15.95, 15.95][index];
    const value = lerp(base, next, progress);
    rows.textContent = `${value.toFixed(value < 10 ? 2 : 1)}M / 15.95M`;
  }

  updateStory(dt, time, phase, progress) {
    const phaseOrder = COMPLAINT_PHASES.findIndex((item) => item.id === phase.id);
    setGroupOpacity(this.raw, phaseOrder <= 2 ? 1 : 0.28);
    setGroupOpacity(this.conveyor, phaseOrder >= 1 && phaseOrder <= 3 ? 1 : 0.2);
    setGroupOpacity(this.validation, phaseOrder >= 2 && phaseOrder <= 4 ? 1 : 0.18);
    setGroupOpacity(this.parquet, phaseOrder >= 3 ? 1 : 0.12);
    setGroupOpacity(this.analytics, phaseOrder >= 4 ? 1 : 0.1);
    setGroupOpacity(this.intelligence, phaseOrder >= 5 ? 1 : 0.1);
    setGroupOpacity(this.forecast, phaseOrder >= 6 ? 1 : 0.08);
    setGroupOpacity(this.decisions, phaseOrder >= 7 ? 1 : 0.06);

    this.chunks.forEach((chunk) => {
      const travel = (time * 0.18 + chunk.userData.offset) % 1;
      chunk.position.set(-1.4 + travel * 2.8, 0.28 + Math.sin(travel * Math.PI) * 0.18, (chunk.userData.offset % 0.3) - 0.15);
      chunk.rotation.x += dt * 0.8;
      chunk.rotation.y += dt * 0.6;
    });
    this.rejects.forEach((reject, index) => {
      reject.position.y = -0.65 - Math.abs(Math.sin(time * 1.5 + index)) * 0.55;
      reject.material.opacity = phase.id === 'validate' ? 1 : 0.25;
      reject.material.transparent = true;
    });
    this.parquetBlocks.forEach((block, index) => {
      const target = phaseOrder >= 3 ? 1 : 0.04;
      block.scale.setScalar(lerp(block.scale.x, target, 0.07 + (index % 4) * 0.005));
    });
    this.analyticsTowers.forEach((tower, index) => {
      tower.position.y += Math.sin(time * 1.2 + index) * 0.0015;
    });
    this.riskRadar.rotation.z += dt * 0.38;
    this.intelligence.rotation.y = Math.sin(time * 0.45) * 0.12;

    if (phaseOrder >= 6) {
      const count = Math.max(2, Math.floor(2 + progress * 5));
      this.forecastLine.geometry.setDrawRange(0, count);
    } else {
      this.forecastLine.geometry.setDrawRange(0, 1);
    }
    this.decisionCards.forEach((card, index) => {
      const target = phaseOrder >= 7 && progress > index * 0.18 ? 1 : 0.03;
      card.scale.x = lerp(card.scale.x, target, 0.08);
      card.scale.y = lerp(card.scale.y, target, 0.08);
    });

    const positions = this.dataDots.userData.positions;
    const pathLimit = [0.12, 0.27, 0.39, 0.51, 0.65, 0.78, 0.9, 1][phaseOrder];
    for (let index = 0; index < this.dataDots.userData.count; index += 1) {
      const travel = ((time * 0.08 + index / this.dataDots.userData.count) % 1) * pathLimit;
      const point = pathPoint(this.riverPath, travel);
      positions[index * 3] = point.x + Math.sin(index * 2.1 + time) * 0.07;
      positions[index * 3 + 1] = point.y + Math.sin(index * 1.5 + time * 1.4) * 0.36;
      positions[index * 3 + 2] = point.z + Math.cos(index * 1.7 + time) * 0.55;
    }
    this.dataDots.geometry.attributes.position.needsUpdate = true;

    const rejected = this.rejectedDots.userData.positions;
    for (let index = 0; index < this.rejectedDots.userData.count; index += 1) {
      const p = (time * 0.16 + index / this.rejectedDots.userData.count) % 1;
      rejected[index * 3] = -2.2 + p * 0.5;
      rejected[index * 3 + 1] = -0.4 - p * 2.1;
      rejected[index * 3 + 2] = Math.sin(index) * 0.5;
    }
    this.rejectedDots.visible = phase.id === 'validate';
    this.rejectedDots.geometry.attributes.position.needsUpdate = true;
  }
}

const RAG_PHASES = [
  {
    id: 'ingest', duration: 6.5, status: 'DOCUMENTS ARRIVING', title: 'Seven document formats enter one ingestion layer',
    description: 'PDF, DOCX, CSV, XLS, XLSX, JSON and TXT keep source metadata as they move into the system.',
    why: 'Grounded answers depend on preserving where every piece of evidence came from.',
    hud: { query: 'Corpus loading', route: 'Not selected', output: '0 indexed sources' },
    camera: [-5.5, 4.2, 17.5], target: [-5.5, 0, 0],
  },
  {
    id: 'chunk', duration: 6.5, status: 'PARSING + CHUNKING', title: 'Documents become traceable chunks',
    description: 'Parsers extract text and metadata; long documents split while structured tables keep analytical identity.',
    why: 'Chunking must improve retrieval without destroying file, page, sheet or row context.',
    hud: { query: 'Corpus preparation', route: 'Parser layer', output: 'Traceable chunks' },
    camera: [-3.5, 4.1, 16.5], target: [-3.5, 0, 0],
  },
  {
    id: 'embed', duration: 6.5, status: 'EMBEDDINGS STORED', title: 'Semantic meaning becomes a persistent vector space',
    description: 'Clean chunks are embedded and stored in Chroma while source metadata remains attached.',
    why: 'Persistent embeddings avoid rebuilding the knowledge base for every question.',
    hud: { query: 'Index building', route: 'Embedding model', output: 'Chroma collection ready' },
    camera: [-1.4, 4.2, 16], target: [-1.0, 0, 0],
  },
  {
    id: 'route', duration: 7, status: 'INTENT ROUTER ACTIVE', title: 'The same assistant separates two kinds of questions',
    description: 'An exact spreadsheet question routes to Pandas; a policy question routes to semantic retrieval.',
    why: 'Pure vector search should not guess an exact aggregation that code can compute deterministically.',
    hud: { query: 'Two sample queries', route: 'Analytics / Semantic', output: 'Correct engine selected' },
    camera: [1.0, 4.0, 15.5], target: [1.2, 0, 0],
  },
  {
    id: 'analytics', duration: 7, status: 'PANDAS COMPUTATION', title: 'Exact analytics bypass the LLM',
    description: '“Which department has the highest average salary?” becomes a deterministic dataframe aggregation and exact result.',
    why: 'Numbers are calculated by Pandas, not inferred from nearby text chunks.',
    hud: { query: 'Highest average salary?', route: 'Pandas analytics', output: 'Engineering · ₹92K' },
    camera: [3.0, 4.0, 15.2], target: [3.3, 1.0, 0],
  },
  {
    id: 'retrieve', duration: 8, status: 'VECTOR + BM25', title: 'Semantic questions search through two complementary paths',
    description: 'Dense vectors find related meaning while BM25 preserves exact terms and identifiers; candidates merge and duplicates disappear.',
    why: 'Hybrid retrieval handles both semantic language and exact enterprise vocabulary.',
    hud: { query: 'What is the refund policy?', route: 'Hybrid semantic route', output: '20 merged candidates' },
    camera: [3.8, 3.7, 15.4], target: [4.2, -0.6, 0],
  },
  {
    id: 'rerank', duration: 7, status: 'CROSSENCODER RERANK', title: 'A second model changes the evidence order',
    description: 'Candidate chunks are scored against the query again; irrelevant sources fall while the strongest evidence moves to the top.',
    why: 'The reranker improves context quality before the LLM sees anything.',
    hud: { query: 'Refund policy', route: 'CrossEncoder', output: 'Top 6 evidence chunks' },
    camera: [6.0, 3.4, 15.2], target: [6.2, 0, 0],
  },
  {
    id: 'answer', duration: 9.5, status: 'GROUNDED ANSWER', title: 'The answer is assembled with citations—or refuses',
    description: 'Top evidence becomes bounded context, the response cites source files, and unsupported questions trigger the documented fallback.',
    why: 'A reliable assistant must show evidence and know when the documents cannot answer.',
    hud: { query: 'Refund policy', route: 'Grounded generation', output: 'Answer + 3 citations' },
    camera: [8.3, 3.5, 15.8], target: [8.5, 0.1, 0],
  },
];

class RagStory extends StoryScene {
  constructor(canvas) {
    super(canvas, {
      storyId: 'rag', phases: RAG_PHASES, camera: [-5.5, 4.2, mobile ? 21 : 17.5],
      fov: mobile ? 56 : 43, accent: 0x9b72ff, secondary: 0x42e8ff,
    });
    this.createWorld();
    this.applyPhase(0, true);
  }

  createWorld() {
    const stars = makeFlowDots(mobile ? 100 : 220, 0x9b72ff, mobile ? 0.06 : 0.045);
    const starPositions = stars.userData.positions;
    for (let index = 0; index < stars.userData.count; index += 1) {
      starPositions[index * 3] = rand(-12, 12);
      starPositions[index * 3 + 1] = rand(-5, 5);
      starPositions[index * 3 + 2] = rand(-5, 2);
    }
    stars.geometry.attributes.position.needsUpdate = true;
    stars.material.opacity = 0.28;
    this.root.add(stars);

    this.documents = new THREE.Group();
    this.documents.position.set(-6.2, 0, 0);
    const names = ['PDF', 'DOCX', 'CSV', 'XLS', 'XLSX', 'JSON', 'TXT'];
    const accents = ['#ff5d75', '#4c7dff', '#49e39c', '#49e39c', '#ffd36b', '#9fb6d9', '#ff9b42'];
    this.docCards = [];
    names.forEach((name, index) => {
      const card = makePanel(0.8, 1.0, Number.parseInt(accents[index].slice(1), 16), 0.14);
      const label = makeLabel(name, accents[index], [0.78, 0.34, 1], { fontSize: 29 });
      label.position.z = 0.14;
      card.add(label);
      const angle = index / names.length * Math.PI * 2;
      card.position.set(Math.cos(angle) * 1.8, Math.sin(angle) * 1.8, Math.sin(angle * 2) * 0.5);
      card.userData.angle = angle;
      this.documents.add(card);
      this.docCards.push(card);
    });
    const docsLabel = makeLabel('7 VALIDATED FORMATS', '#9b72ff', [2.5, 0.68, 1]);
    docsLabel.position.set(0, 2.9, 0);
    this.documents.add(docsLabel);
    this.root.add(this.documents);

    this.parser = new THREE.Group();
    this.parser.position.set(-3.8, 0, 0);
    const parserCore = makePanel(2.0, 2.2, 0x4c7dff, 0.35);
    this.parser.add(parserCore);
    const parserLabel = makeLabel(['PARSE + CHUNK', 'SOURCE METADATA KEPT'], '#4c7dff', [2.0, 0.92, 1], { secondarySize: 23 });
    parserLabel.position.set(0, 0.7, 0.23);
    this.parser.add(parserLabel);
    this.chunkBlocks = [];
    for (let index = 0; index < 16; index += 1) {
      const block = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.14, 0.12), new THREE.MeshBasicMaterial({ color: index % 3 === 0 ? 0xff9b42 : 0x7da0ff }));
      block.position.set(-0.75 + (index % 4) * 0.5, -0.5 - Math.floor(index / 4) * 0.25, 0.24);
      this.parser.add(block);
      this.chunkBlocks.push(block);
    }
    this.root.add(this.parser);

    this.vectorSpace = new THREE.Group();
    this.vectorSpace.position.set(-1.1, 0, 0);
    this.vectorCore = makeGlowSphere(1.05, 0x9b72ff, 0.28);
    this.vectorWire = new THREE.Mesh(
      new THREE.IcosahedronGeometry(1.35, 2),
      new THREE.MeshBasicMaterial({ color: 0xc9b8ff, wireframe: true, transparent: true, opacity: 0.42, blending: THREE.AdditiveBlending }),
    );
    this.vectorSpace.add(this.vectorCore, this.vectorWire);
    [1.7, 2.1].forEach((radius, index) => {
      const ring = makeRing(radius, 0.02, index ? 0x4c7dff : 0x9b72ff, 0.32);
      ring.rotation.set(Math.PI / 2 - index * 0.35, index * 0.5, 0);
      this.vectorSpace.add(ring);
    });
    const vectorLabel = makeLabel(['CHROMA VECTOR SPACE', 'EMBEDDINGS + METADATA'], '#9b72ff', [2.6, 0.92, 1], { secondarySize: 22 });
    vectorLabel.position.set(0, 2.55, 0);
    this.vectorSpace.add(vectorLabel);
    this.root.add(this.vectorSpace);

    this.router = new THREE.Group();
    this.router.position.set(1.3, 0, 0);
    const routerCore = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.85, 1),
      new THREE.MeshStandardMaterial({ color: 0x10294d, emissive: 0x42e8ff, emissiveIntensity: 0.7, metalness: 0.5, roughness: 0.22 }),
    );
    this.router.add(routerCore);
    const routerLabel = makeLabel('INTENT ROUTER', '#42e8ff', [2.1, 0.62, 1]);
    routerLabel.position.set(0, 1.8, 0);
    this.router.add(routerLabel);
    this.root.add(this.router);

    this.analyticsLane = new THREE.Group();
    this.analyticsLane.position.set(3.6, 1.4, 0);
    const pandas = makePanel(2.5, 1.65, 0x49e39c, 0.2);
    this.analyticsLane.add(pandas);
    const pandasLabel = makeLabel(['PANDAS ANALYTICS', 'groupby → exact result'], '#49e39c', [2.35, 0.9, 1], { secondarySize: 25 });
    pandasLabel.position.set(0, 0.25, 0.18);
    this.analyticsLane.add(pandasLabel);
    const resultLabel = makeLabel('ENGINEERING · ₹92K', '#49e39c', [2.2, 0.62, 1], { fontSize: 31 });
    resultLabel.position.set(0, -1.35, 0);
    this.analyticsLane.add(resultLabel);
    this.root.add(this.analyticsLane);

    this.semanticLane = new THREE.Group();
    this.semanticLane.position.set(3.8, -1.35, 0);
    this.vectorPath = makePanel(1.65, 1.0, 0x4c7dff, 0.16);
    this.vectorPath.position.set(-1.0, 0.5, 0);
    const vectorPathLabel = makeLabel('VECTOR', '#4c7dff', [1.5, 0.46, 1], { fontSize: 31 });
    vectorPathLabel.position.z = 0.15;
    this.vectorPath.add(vectorPathLabel);
    this.semanticLane.add(this.vectorPath);
    this.bm25Path = makePanel(1.65, 1.0, 0xff9b42, 0.16);
    this.bm25Path.position.set(-1.0, -0.75, 0);
    const bm25Label = makeLabel('BM25', '#ff9b42', [1.5, 0.46, 1], { fontSize: 31 });
    bm25Label.position.z = 0.15;
    this.bm25Path.add(bm25Label);
    this.semanticLane.add(this.bm25Path);
    this.candidates = [];
    for (let index = 0; index < 10; index += 1) {
      const candidate = new THREE.Mesh(
        new THREE.BoxGeometry(0.24, 0.16, 0.1),
        new THREE.MeshBasicMaterial({ color: index % 2 ? 0x4c7dff : 0xff9b42, transparent: true, opacity: 0.85 }),
      );
      candidate.position.set(0.15 + (index % 5) * 0.34, 0.48 - Math.floor(index / 5) * 0.55, 0);
      candidate.userData.rank = index;
      this.semanticLane.add(candidate);
      this.candidates.push(candidate);
    }
    const semanticLabel = makeLabel('MERGE + DEDUPLICATE', '#9b72ff', [2.5, 0.62, 1]);
    semanticLabel.position.set(0.7, -1.55, 0);
    this.semanticLane.add(semanticLabel);
    this.root.add(this.semanticLane);

    this.reranker = new THREE.Group();
    this.reranker.position.set(6.2, 0, 0);
    const rerankPanel = makePanel(2.2, 2.7, 0x49e39c, 0.2);
    this.reranker.add(rerankPanel);
    const rerankLabel = makeLabel(['CROSSENCODER', 'TOP EVIDENCE REORDERED'], '#49e39c', [2.1, 0.88, 1], { secondarySize: 23 });
    rerankLabel.position.set(0, 1.75, 0.2);
    this.reranker.add(rerankLabel);
    this.rankBars = [];
    [0.42, 0.91, 0.76, 0.55, 0.31, 0.22].forEach((score, index) => {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(score * 1.5, 0.18, 0.12), new THREE.MeshBasicMaterial({ color: index < 3 ? 0x49e39c : 0x49617e }));
      bar.position.set(-0.85 + score * 0.75, 0.9 - index * 0.34, 0.2);
      bar.userData.score = score;
      this.reranker.add(bar);
      this.rankBars.push(bar);
    });
    this.root.add(this.reranker);

    this.answer = new THREE.Group();
    this.answer.position.set(8.8, 0, 0);
    const answerPanel = makePanel(2.7, 3.1, 0x9b72ff, 0.22);
    this.answer.add(answerPanel);
    const answerLabel = makeLabel(['GROUNDED ANSWER', '3 SOURCE CITATIONS'], '#9b72ff', [2.55, 0.92, 1], { secondarySize: 25 });
    answerLabel.position.set(0, 2.0, 0.2);
    this.answer.add(answerLabel);
    for (let index = 0; index < 4; index += 1) {
      const line = new THREE.Mesh(new THREE.BoxGeometry(1.7 - index * 0.13, 0.07, 0.08), new THREE.MeshBasicMaterial({ color: 0x9fb6d9 }));
      line.position.set(-0.28 + index * 0.05, 0.75 - index * 0.3, 0.2);
      this.answer.add(line);
    }
    this.citationDots = [];
    for (let index = 0; index < 3; index += 1) {
      const citation = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.24, 0.1), new THREE.MeshBasicMaterial({ color: 0x49e39c }));
      citation.position.set(0, -0.55 - index * 0.36, 0.2);
      this.answer.add(citation);
      this.citationDots.push(citation);
    }
    const fallback = makeLabel('UNSUPPORTED → “I DON’T KNOW”', '#ff5d75', [2.45, 0.62, 1], { fontSize: 27 });
    fallback.position.set(0, -2.05, 0);
    this.answer.add(fallback);
    this.root.add(this.answer);

    const routeStart = new THREE.Vector3(1.3, 0, 0);
    this.root.add(makeCylinderBetween(routeStart, new THREE.Vector3(3.6, 1.4, 0), 0.035, 0x49e39c, 0.35));
    this.root.add(makeCylinderBetween(routeStart, new THREE.Vector3(3.8, -1.35, 0), 0.035, 0x9b72ff, 0.35));
    this.root.add(makeCylinderBetween(new THREE.Vector3(5.0, -1.35, 0), new THREE.Vector3(6.2, 0, 0), 0.035, 0x9b72ff, 0.35));
    this.root.add(makeCylinderBetween(new THREE.Vector3(7.3, 0, 0), new THREE.Vector3(8.8, 0, 0), 0.035, 0x49e39c, 0.35));

    this.queryPulse = makeGlowSphere(0.13, 0x42e8ff, 0.82);
    this.root.add(this.queryPulse);
    this.evidencePulses = Array.from({ length: mobile ? 8 : 14 }, (_, index) => {
      const pulse = makeGlowSphere(0.07, index % 2 ? 0x4c7dff : 0xff9b42, 0.72);
      pulse.userData.offset = index / (mobile ? 8 : 14);
      this.root.add(pulse);
      return pulse;
    });
  }

  onPhaseChange(phase) {
    this.desiredCamera.set(...phase.camera);
    this.desiredTarget.set(...phase.target);
  }

  updateStory(dt, time, phase, progress) {
    const phaseOrder = RAG_PHASES.findIndex((item) => item.id === phase.id);
    setGroupOpacity(this.documents, phaseOrder <= 2 ? 1 : 0.3);
    setGroupOpacity(this.parser, phaseOrder >= 1 && phaseOrder <= 3 ? 1 : 0.2);
    setGroupOpacity(this.vectorSpace, phaseOrder >= 2 ? 1 : 0.12);
    setGroupOpacity(this.router, phaseOrder >= 3 ? 1 : 0.12);
    setGroupOpacity(this.analyticsLane, phaseOrder === 4 ? 1 : 0.1);
    setGroupOpacity(this.semanticLane, phaseOrder >= 5 ? 1 : 0.08);
    setGroupOpacity(this.reranker, phaseOrder >= 6 ? 1 : 0.08);
    setGroupOpacity(this.answer, phaseOrder >= 7 ? 1 : 0.06);

    this.docCards.forEach((card, index) => {
      const angle = card.userData.angle + time * 0.16;
      if (phase.id === 'ingest') {
        card.position.x = Math.cos(angle) * 1.8;
        card.position.y = Math.sin(angle) * 1.8;
        card.position.z = Math.sin(angle * 2) * 0.5;
      } else if (phase.id === 'chunk') {
        card.position.lerp(new THREE.Vector3(2.2, (index - 3) * 0.18, 0), 0.045);
      }
      card.rotation.y += dt * 0.25;
    });
    this.chunkBlocks.forEach((block, index) => {
      const active = phaseOrder >= 1;
      block.scale.setScalar(lerp(block.scale.x, active ? 1 : 0.02, 0.08));
      if (phase.id === 'chunk') block.position.z = 0.24 + Math.sin(time * 2 + index) * 0.08;
    });
    this.vectorCore.rotation.y += dt * 0.38;
    this.vectorWire.rotation.y -= dt * 0.22;
    this.vectorWire.rotation.x += dt * 0.12;
    this.router.rotation.y += dt * (phase.id === 'route' ? 1.1 : 0.18);

    if (phase.id === 'route') {
      const upper = progress < 0.5;
      this.queryPulse.position.copy(pathPoint([
        new THREE.Vector3(-0.4, 0, 0),
        new THREE.Vector3(1.3, 0, 0),
        upper ? new THREE.Vector3(3.6, 1.4, 0) : new THREE.Vector3(3.8, -1.35, 0),
      ], (progress * 2) % 1));
      this.queryPulse.material.color.setHex(upper ? 0x49e39c : 0x9b72ff);
      this.queryPulse.material.emissive.setHex(upper ? 0x49e39c : 0x9b72ff);
      this.queryPulse.visible = true;
    } else if (phase.id === 'analytics') {
      this.queryPulse.position.copy(pathPoint([
        new THREE.Vector3(1.3, 0, 0),
        new THREE.Vector3(2.2, 0.7, 0),
        new THREE.Vector3(3.6, 1.4, 0),
      ], progress));
      this.queryPulse.visible = true;
      this.queryPulse.material.color.setHex(0x49e39c);
      this.queryPulse.material.emissive.setHex(0x49e39c);
    } else {
      this.queryPulse.visible = false;
    }

    this.candidates.forEach((candidate, index) => {
      if (phase.id === 'retrieve') {
        candidate.position.x = lerp(candidate.position.x, 0.15 + (index % 5) * 0.34, 0.08);
        candidate.position.y = lerp(candidate.position.y, 0.48 - Math.floor(index / 5) * 0.55, 0.08);
        candidate.material.opacity = index === 8 || index === 9 ? lerp(candidate.material.opacity, progress > 0.65 ? 0.08 : 0.85, 0.08) : 0.85;
      }
    });
    this.rankBars.forEach((bar, index) => {
      const targetOrder = [1, 0, 2, 3, 4, 5][index];
      const targetY = 0.9 - targetOrder * 0.34;
      if (phaseOrder >= 6) bar.position.y = lerp(bar.position.y, targetY, 0.06);
      bar.scale.x = lerp(bar.scale.x, phaseOrder >= 6 ? 1 : 0.03, 0.08);
    });
    this.citationDots.forEach((citation, index) => {
      const target = phaseOrder >= 7 && progress > 0.3 + index * 0.16 ? 1 : 0.02;
      citation.scale.x = lerp(citation.scale.x, target, 0.08);
    });

    this.evidencePulses.forEach((pulse) => {
      if (phase.id !== 'retrieve' && phase.id !== 'rerank' && phase.id !== 'answer') {
        pulse.visible = false;
        return;
      }
      pulse.visible = true;
      const lane = pulse.userData.offset % 2 < 1 ? 1 : -1;
      const path = [
        new THREE.Vector3(1.3, 0, 0),
        new THREE.Vector3(3.0, lane > 0 ? -0.85 : -1.85, 0),
        new THREE.Vector3(4.8, -1.35, 0),
        new THREE.Vector3(6.2, 0, 0),
        new THREE.Vector3(8.8, 0, 0),
      ];
      const limit = phase.id === 'retrieve' ? 0.56 : phase.id === 'rerank' ? 0.78 : 1;
      const travel = ((time * 0.11 + pulse.userData.offset) % 1) * limit;
      pulse.position.copy(pathPoint(path, travel));
    });
  }
}

const sceneInstances = new Map();
const sceneFactories = {
  hero: () => new HeroScene(document.querySelector('#hero-3d')),
  audit: () => new AuditStory(document.querySelector('#audit-3d')),
  complaints: () => new ComplaintStory(document.querySelector('#complaints-3d')),
  rag: () => new RagStory(document.querySelector('#rag-3d')),
};

function ensureScene(id) {
  if (sceneInstances.has(id)) return sceneInstances.get(id);
  const factory = sceneFactories[id];
  if (!factory) return null;
  const canvas = document.querySelector(`#${id === 'complaints' ? 'complaints' : id}-3d`);
  if (!canvas) return null;
  const scene = factory();
  sceneInstances.set(id, scene);
  if (id !== 'hero') {
    document.querySelectorAll(`[data-${id}-phase]`).forEach((button) => {
      button.addEventListener('click', () => scene.setPhaseById(button.dataset[`${id}Phase`], false));
    });
  }
  return scene;
}

function setupHero() {
  const hero = ensureScene('hero');
  const heroCopy = {
    audit: ['SYSTEM 02 · ML RELIABILITY', 'Inspect the data before trusting the model.', 'Signals move from profiling to risk checks, human review, baseline models and explainability.'],
    complaints: ['SYSTEM 01 · LARGE-SCALE DATA SCIENCE', 'Turn millions of raw records into decision-ready layers.', 'A raw data river becomes Parquet, business dimensions, NLP intelligence, forecast evidence and actions.'],
    rag: ['SYSTEM 03 · APPLIED AI & HYBRID RAG', 'Route computation and retrieval to different systems.', 'Exact analytics goes to Pandas; semantic questions use vector + BM25, reranking and citations.'],
  };
  document.querySelectorAll('[data-hero-scene]').forEach((button) => {
    button.addEventListener('click', () => {
      const mode = button.dataset.heroScene;
      hero?.setMode(mode);
      document.querySelectorAll('[data-hero-scene]').forEach((candidate) => {
        const active = candidate === button;
        candidate.classList.toggle('active', active);
        candidate.setAttribute('aria-selected', String(active));
        candidate.tabIndex = active ? 0 : -1;
      });
      const copy = heroCopy[mode];
      document.querySelector('#hero-scene-kicker').textContent = copy[0];
      document.querySelector('#hero-scene-title').textContent = copy[1];
      document.querySelector('#hero-scene-copy').textContent = copy[2];
      const panel = document.querySelector('#hero-scene-panel');
      panel?.setAttribute('aria-labelledby', button.id);
      window.portfolioAnalytics?.track('hero_scene', { mode });
    });
  });
}

function setupLazyScenes() {
  const stages = {
    audit: document.querySelector('[data-story="audit"]'),
    complaints: document.querySelector('[data-story="complaints"]'),
    rag: document.querySelector('[data-story="rag"]'),
  };
  if (!('IntersectionObserver' in window)) {
    Object.keys(stages).forEach(ensureScene);
    return;
  }
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const id = entry.target.dataset.story;
      ensureScene(id);
      observer.unobserve(entry.target);
    });
  }, { rootMargin: '800px 0px', threshold: 0.01 });
  Object.values(stages).forEach((stage) => stage && observer.observe(stage));
}

function setupTours() {
  const recruiterButton = document.querySelector('#recruiter-tour');
  const deepButton = document.querySelector('#guided-tour');
  const order = ['complaints', 'audit', 'rag'];
  let activeMode = null;
  let current = 0;

  const resetButtons = () => {
    if (recruiterButton) recruiterButton.innerHTML = `<span>See 25-second project tour</span>${window.portfolioIcon?.('play') || ''}`;
    if (deepButton) deepButton.innerHTML = `<span>Explore full 3D stories</span>${window.portfolioIcon?.('play') || ''}`;
  };
  const stop = () => {
    activeMode = null;
    resetButtons();
    sceneInstances.forEach((scene, id) => {
      if (id !== 'hero' && scene instanceof StoryScene) {
        scene.playing = false;
        scene.playbackRate = 1;
        scene.updatePlayButton();
      }
    });
  };
  const startStory = (id) => {
    const story = ensureScene(id);
    const stage = document.querySelector(`[data-story="${id}"]`);
    stage?.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'center' });
    const rate = activeMode === 'recruiter' ? Math.max(1, story.totalDuration / 6.3) : 1;
    window.setTimeout(() => story?.playFromStart(rate), reducedMotion ? 0 : 520);
  };
  const start = (mode) => {
    if (activeMode === mode) { stop(); return; }
    stop();
    activeMode = mode;
    current = 0;
    const activeButton = mode === 'recruiter' ? recruiterButton : deepButton;
    if (activeButton) activeButton.innerHTML = `<span>Stop ${mode === 'recruiter' ? 'recruiter tour' : 'deep dive'}</span>${window.portfolioIcon?.('pause') || ''}`;
    window.portfolioAnalytics?.track(`${mode}_tour_start`);
    startStory(order[current]);
  };
  recruiterButton?.addEventListener('click', () => start('recruiter'));
  deepButton?.addEventListener('click', () => start('deep'));
  window.addEventListener('portfolio-story-complete', (event) => {
    if (!activeMode || event.detail.story !== order[current]) return;
    current += 1;
    if (current >= order.length) {
      window.portfolioAnalytics?.track(`${activeMode}_tour_complete`);
      stop();
      document.querySelector('#contact')?.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' });
      return;
    }
    window.setTimeout(() => startStory(order[current]), reducedMotion ? 0 : 480);
  });
  resetButtons();
}

if (!webglAvailable()) {
  document.documentElement.classList.add('no-webgl');
  document.querySelectorAll('.stage-fallback').forEach((element) => {
    element.style.display = 'block';
    element.setAttribute('aria-hidden', 'false');
  });
} else {
  setupHero();
  setupLazyScenes();
  setupTours();
}

window.__portfolioScenes = sceneInstances;
window.__portfolioEnsureScene = ensureScene;
window.__portfolio3DReady = true;

