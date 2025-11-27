import * as THREE from 'three';
import { loadShaderSource } from '../shaders/load-shaders.js';

const shaderSourcesPromise = loadViewerShaderSources();

export async function createCloudViewer({
  canvas,
  placementMode,
  spectrumTextures,
  chromaticityMatch,
  chromaticityHover,
  pointSize = 1,
}) {
  if (!canvas) {
    throw new Error('Canvas element is required to create a viewer.');
  }
  const shaders = await shaderSourcesPromise;
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.setClearAlpha(0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  if ('outputColorSpace' in renderer && THREE.DisplayP3ColorSpace) {
    renderer.outputColorSpace = THREE.DisplayP3ColorSpace;
  }
  if (renderer.domElement.style) {
    renderer.domElement.style.colorSpace = 'display-p3';
  }

  const scene = new THREE.Scene();
  scene.background = null;

  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 20);
  camera.position.set(0, 0, 6);
  camera.lookAt(0, 0, 0);

  const geometry = buildPointCloudGeometry();
  const maxDrawRange = geometry.getAttribute('position').count;

  const generalMaterial = createPointCloudMaterial({
    shaders,
    placementMode,
    pointSize,
    spectrumTextures,
    chromaUniform: chromaticityMatch,
    chromaHoverUniform: chromaticityHover,
  });
  const p3Material = createP3PointCloudMaterial({
    shaders,
    placementMode,
    pointSize,
    chromaUniform: chromaticityMatch,
    chromaHoverUniform: chromaticityHover,
  });
  const srgbMaterial = createSRGBPointCloudMaterial({
    shaders,
    placementMode,
    pointSize,
    chromaUniform: chromaticityMatch,
    chromaHoverUniform: chromaticityHover,
  });
  const rec2020Material = createRec2020PointCloudMaterial({
    shaders,
    placementMode,
    pointSize,
    chromaUniform: chromaticityMatch,
    chromaHoverUniform: chromaticityHover,
  });

  geometry.setDrawRange(0, maxDrawRange);

  const generalPoints = new THREE.Points(geometry, generalMaterial);
  const p3Points = new THREE.Points(geometry, p3Material);
  const srgbPoints = new THREE.Points(geometry, srgbMaterial);
  const rec2020Points = new THREE.Points(geometry, rec2020Material);

  const group = new THREE.Group();
  group.add(generalPoints);
  group.add(p3Points);
  group.add(srgbPoints);
  group.add(rec2020Points);
  group.scale.setScalar(1.0);
  group.rotation.set(0, 0, 0);
  scene.add(group);

  const rotationState =
    placementMode === 'display'
      ? {
          isDragging: false,
          pointerId: null,
          lastX: 0,
          lastY: 0,
          velocity: new THREE.Vector2(),
        }
      : null;

  if (rotationState) {
    const ROTATION_ACCEL = 0.01;
    const FRICTION = 0.966;
    const MAX_TILT = Math.PI * 0.5;

    const handlePointerDown = (event) => {
      event.preventDefault();
      rotationState.isDragging = true;
      rotationState.pointerId = event.pointerId;
      rotationState.lastX = event.clientX;
      rotationState.lastY = event.clientY;
      rotationState.velocity.set(0, 0);
      canvas.setPointerCapture(event.pointerId);
    };

    const handlePointerMove = (event) => {
      if (!rotationState.isDragging || event.pointerId !== rotationState.pointerId) {
        return;
      }
      event.preventDefault();

      const dx = event.clientX - rotationState.lastX;
      const dy = event.clientY - rotationState.lastY;
      rotationState.lastX = event.clientX;
      rotationState.lastY = event.clientY;

      const deltaYaw = dx * ROTATION_ACCEL;
      const deltaPitch = dy * ROTATION_ACCEL;

      group.rotation.y += deltaYaw;
      const nextPitch = THREE.MathUtils.clamp(group.rotation.x + deltaPitch, -MAX_TILT, MAX_TILT);
      group.rotation.x = nextPitch;

      rotationState.velocity.set(deltaPitch, deltaYaw);
    };

    const handlePointerUp = (event) => {
      if (event.pointerId !== rotationState.pointerId) {
        return;
      }
      event.preventDefault();
      rotationState.isDragging = false;
      rotationState.pointerId = null;
      canvas.releasePointerCapture(event.pointerId);

      if (rotationState.velocity.lengthSq() < 1e-7) {
        rotationState.velocity.set(0, 0);
      }
    };

    canvas.addEventListener('pointerdown', handlePointerDown, { passive: false });
    canvas.addEventListener('pointermove', handlePointerMove, { passive: false });
    canvas.addEventListener('pointerup', handlePointerUp, { passive: false });
    canvas.addEventListener('pointerleave', handlePointerUp, { passive: false });
    canvas.addEventListener('pointercancel', handlePointerUp, { passive: false });

    rotationState.applyMomentum = () => {
      if (rotationState.isDragging) {
        return;
      }
      if (rotationState.velocity.lengthSq() < 1e-7) {
        rotationState.velocity.set(0, 0);
        return;
      }

      group.rotation.y += rotationState.velocity.y;
      const nextPitch = THREE.MathUtils.clamp(
        group.rotation.x + rotationState.velocity.x,
        -MAX_TILT,
        MAX_TILT
      );
      group.rotation.x = nextPitch;

      rotationState.velocity.multiplyScalar(FRICTION);
      if (rotationState.velocity.lengthSq() < 1e-7) {
        rotationState.velocity.set(0, 0);
      }
    };
  }

  const BASE_SIZE = getPanelReferenceSize();
  let lastCanvasWidth = 0;
  let lastCanvasHeight = 0;

  const updateCameraBounds = (width, height) => {
    if (placementMode === 'chromaticity') {
      camera.left = 0.0;
      camera.right = 0.9;
      camera.top = 0.9;
      camera.bottom = 0.0;
    } else {
      const aspect = width / height;
      const view = 1.1;
      camera.top = view;
      camera.bottom = -view;
      camera.left = -view * aspect;
      camera.right = view * aspect;
    }
    camera.updateProjectionMatrix();
  };

  const resize = () => {
    const width = Math.max(1, Math.round(canvas.clientWidth));
    const height = Math.max(1, Math.round(canvas.clientHeight));
    if (width === lastCanvasWidth && height === lastCanvasHeight) {
      return;
    }

    lastCanvasWidth = width;
    lastCanvasHeight = height;

    renderer.setSize(width, height, false);
    updateCameraBounds(width, height);

    const areaRatio = Math.pow((width * height) / (BASE_SIZE * BASE_SIZE), 0.5);
    const drawCount = Math.max(1, Math.floor(maxDrawRange * Math.min(1.0, areaRatio)));
    geometry.setDrawRange(0, drawCount);
  };

  resize();
  window.addEventListener('resize', resize);
  if (typeof ResizeObserver !== 'undefined') {
    const observer = new ResizeObserver(() => resize());
    observer.observe(canvas);
  }

  return {
    setPointSize(value) {
      generalMaterial.uniforms.uPointSize.value = value;
      p3Material.uniforms.uPointSize.value = value;
      srgbMaterial.uniforms.uPointSize.value = value;
      rec2020Material.uniforms.uPointSize.value = value;
    },
    setVisibility(maxEnabled, p3Enabled, srgbEnabled, rec2020Enabled) {
      generalPoints.visible = maxEnabled;
      p3Points.visible = p3Enabled;
      srgbPoints.visible = srgbEnabled;
      rec2020Points.visible = rec2020Enabled;
      generalMaterial.uniforms.uP3Enabled.value = p3Enabled;
      generalMaterial.uniforms.uSRGBEnabled.value = srgbEnabled;
      generalMaterial.uniforms.uShowCube.value =
        maxEnabled && (p3Enabled || srgbEnabled || rec2020Enabled);
      rec2020Material.uniforms.uP3Enabled.value = p3Enabled;
      rec2020Material.uniforms.uSRGBEnabled.value = srgbEnabled;
      rec2020Material.uniforms.uShowCube.value = rec2020Enabled && (p3Enabled || srgbEnabled);
    },
    updateTime(elapsedMs) {
      generalMaterial.uniforms.uTime.value = elapsedMs;
      p3Material.uniforms.uTime.value = elapsedMs;
      srgbMaterial.uniforms.uTime.value = elapsedMs;
      rec2020Material.uniforms.uTime.value = elapsedMs;
    },
    render() {
      if (rotationState?.applyMomentum) {
        rotationState.applyMomentum();
      }
      renderer.render(scene, camera);
    },
    resize,
  };
}

async function loadViewerShaderSources() {
  const base = import.meta.url;
  const paths = {
    cloudUtils: new URL('../shaders/clouds/cloud-utils.glsl', base),
    colorUtils: new URL('../shaders/color-utils.glsl', base),
    generalVertex: new URL('../shaders/clouds/general.vert.glsl', base),
    generalFragment: new URL('../shaders/clouds/general.frag.glsl', base),
    p3Vertex: new URL('../shaders/clouds/p3.vert.glsl', base),
    srgbVertex: new URL('../shaders/clouds/srgb.vert.glsl', base),
    displayFragment: new URL('../shaders/clouds/display-color.frag.glsl', base),
    rec2020Vertex: new URL('../shaders/clouds/rec2020.vert.glsl', base),
    rec2020Fragment: new URL('../shaders/clouds/rec2020.frag.glsl', base),
  };
  const entries = Object.entries(paths);
  const sources = await Promise.all(entries.map(([, url]) => loadShaderSource(url)));
  return entries.reduce((acc, [key], index) => {
    acc[key] = sources[index];
    return acc;
  }, {});
}

function buildPointCloudGeometry() {
  const steps = 40;
  const total = steps * steps * steps;
  const triples = [];
  const margin = 1 / (steps * 2);
  const scale = 1 - 2 * margin;

  for (let i = 0; i < steps; i += 1) {
    const r = margin + scale * ((i + 0.5) / steps);
    for (let j = 0; j < steps; j += 1) {
      const g = margin + scale * ((j + 0.5) / steps);
      for (let k = 0; k < steps; k += 1) {
        const b = margin + scale * ((k + 0.5) / steps);
        triples.push([r, g, b]);
      }
    }
  }

  for (let i = triples.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = triples[i];
    triples[i] = triples[j];
    triples[j] = temp;
  }

  const positions = new Float32Array(total * 3);
  const colors = new Float32Array(total * 3);
  let ptr = 0;
  for (const [r, g, b] of triples) {
    positions[ptr] = r;
    colors[ptr] = r;
    ptr += 1;

    positions[ptr] = g;
    colors[ptr] = g;
    ptr += 1;

    positions[ptr] = b;
    colors[ptr] = b;
    ptr += 1;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.computeBoundingSphere();
  return geometry;
}

function createPointCloudMaterial({
  shaders,
  placementMode,
  pointSize,
  spectrumTextures,
  chromaUniform,
  chromaHoverUniform,
}) {
  const placementExpr =
    placementMode === 'chromaticity' ? 'positionChromaticity(xyz, 1.0)' : 'positionInDisplaySpace(xyz, 1.0)';

  const vertexShader = applyShaderReplacements(shaders.generalVertex, {
    '{{CLOUD_UTILS}}': shaders.cloudUtils,
    '{{PLACEMENT}}': placementExpr,
  });

  const generalFragmentShader = applyShaderReplacements(shaders.generalFragment, {
    '{{COLOR_UTILS}}': shaders.colorUtils,
  });

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uSpectrumLookupX: { value: spectrumTextures?.x ?? null },
      uSpectrumLookupY: { value: spectrumTextures?.y ?? null },
      uSpectrumLookupZ: { value: spectrumTextures?.z ?? null },
      uSpectrumWidth: { value: spectrumTextures?.width ?? 0 },
      uShowCube: { value: true },
      uP3Enabled: { value: true },
      uSRGBEnabled: { value: true },
      uPointSize: { value: pointSize },
      uChromaticityMatch: { value: chromaUniform },
      uChromaticityMatchHover: { value: chromaHoverUniform },
    },
    transparent: true,
    depthTest: true,
    blending: THREE.NormalBlending,
    vertexShader,
    fragmentShader: generalFragmentShader,
  });
  material.toneMapped = false;
  return material;
}

function createP3PointCloudMaterial({
  shaders,
  placementMode,
  pointSize,
  chromaUniform,
  chromaHoverUniform,
}) {
  const placementSnippet =
    placementMode === 'chromaticity'
      ? 'positionChromaticity(distribution, 1.0)'
      : 'positionInDisplaySpace(WHITEPOINT_SCALE * distribution, 1.0)';

  const vertexShader = applyShaderReplacements(shaders.p3Vertex, {
    '{{CLOUD_UTILS}}': shaders.cloudUtils,
    '{{PLACEMENT}}': placementSnippet,
  });

  const displayFragmentShader = applyShaderReplacements(shaders.displayFragment, {
    '{{COLOR_UTILS}}': shaders.colorUtils,
  });

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uPointSize: { value: pointSize },
      uChromaticityMatch: { value: chromaUniform },
      uChromaticityMatchHover: { value: chromaHoverUniform },
    },
    transparent: true,
    depthTest: true,
    blending: THREE.NormalBlending,
    vertexShader,
    fragmentShader: displayFragmentShader,
  });
  material.toneMapped = false;
  return material;
}

function createSRGBPointCloudMaterial({
  shaders,
  placementMode,
  pointSize,
  chromaUniform,
  chromaHoverUniform,
}) {
  const placementSnippet =
    placementMode === 'chromaticity'
      ? 'positionChromaticity(distribution, 1.0)'
      : 'positionInDisplaySpace(WHITEPOINT_SCALE * distribution, 1.0)';

  const vertexShader = applyShaderReplacements(shaders.srgbVertex, {
    '{{CLOUD_UTILS}}': shaders.cloudUtils,
    '{{PLACEMENT}}': placementSnippet,
  });

  const srgbFragmentShader = applyShaderReplacements(shaders.displayFragment, {
    '{{COLOR_UTILS}}': shaders.colorUtils,
  });

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uPointSize: { value: pointSize },
      uChromaticityMatch: { value: chromaUniform },
      uChromaticityMatchHover: { value: chromaHoverUniform },
    },
    transparent: true,
    depthTest: true,
    blending: THREE.NormalBlending,
    vertexShader,
    fragmentShader: srgbFragmentShader,
  });
  material.toneMapped = false;
  return material;
}

function createRec2020PointCloudMaterial({
  shaders,
  placementMode,
  pointSize,
  chromaUniform,
  chromaHoverUniform,
}) {
  const placementSnippet =
    placementMode === 'chromaticity'
      ? 'positionChromaticity(distribution, 1.0)'
      : 'positionInDisplaySpace(WHITEPOINT_SCALE * distribution, 1.0)';

  const vertexShader = applyShaderReplacements(shaders.rec2020Vertex, {
    '{{CLOUD_UTILS}}': shaders.cloudUtils,
    '{{PLACEMENT}}': placementSnippet,
  });

  const rec2020FragmentShader = applyShaderReplacements(shaders.rec2020Fragment, {
    '{{COLOR_UTILS}}': shaders.colorUtils,
  });

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uPointSize: { value: pointSize },
      uChromaticityMatch: { value: chromaUniform },
      uChromaticityMatchHover: { value: chromaHoverUniform },
      uShowCube: { value: true },
      uP3Enabled: { value: true },
      uSRGBEnabled: { value: true },
    },
    transparent: true,
    depthTest: true,
    blending: THREE.NormalBlending,
    vertexShader,
    fragmentShader: rec2020FragmentShader,
  });
  material.toneMapped = false;
  return material;
}

function applyShaderReplacements(source, replacements) {
  return Object.entries(replacements).reduce(
    (result, [token, value]) => result.split(token).join(value),
    source
  );
}

function getPanelReferenceSize() {
  const rootStyles = getComputedStyle(document.documentElement);
  const parsed = parseFloat(rootStyles.getPropertyValue('--panel-size-reference'));
  return Number.isFinite(parsed) ? parsed : 640;
}
