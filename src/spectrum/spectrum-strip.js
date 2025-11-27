import * as THREE from 'three';
import { loadShaderSource } from '../shaders/load-shaders.js';
import { chromaticityState } from '../chromaticity/index.js';

const shaderSourcesPromise = loadSpectrumStripShaders();
const CIE_DATA_URL = new URL('../data/cie1931xyz2e.csv', import.meta.url);

export async function initSpectrumStrip({
  canvas,
  axisContainer,
  d3,
  onChromaticityChange,
}) {
  if (!canvas || !axisContainer || !d3) {
    return null;
  }

  try {
    const cieData = await loadCieTexture(CIE_DATA_URL);
    const renderer = await createSpectrumStripRenderer(canvas, cieData.texture);
    const axisState = createAxisState();
    const renderAxis = createSpectrumStripAxis({
      container: axisContainer,
      d3,
      axisState,
      wavelengths: cieData.wavelengths,
    });
    const markerState = createMarkerState();
    const updateMarkers = () => updateSpectrumMarker({ cieData, markerState, axisState });

    setupSpectrumStripInteraction({
      canvas,
      cieData,
      markerState,
      axisState,
      onChromaticityChange,
      updateMarkers,
    });

    const handleResize = () => {
      renderer.resize();
      renderAxis();
      updateMarkers();
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(handleResize);
      observer.observe(canvas);
      observer.observe(axisContainer);
    }

    return {
      clearMarkers() {
        markerState.activeRatio = null;
        markerState.hoverRatio = null;
        hideSpectrumAxisMarkers(axisState);
      },
      clearHoverMarker() {
        markerState.hoverRatio = null;
        updateMarkers();
      },
    };
  } catch (error) {
    console.error('Failed to initialize spectrum strip', error);
    return null;
  }
}

async function loadSpectrumStripShaders() {
  const base = import.meta.url;
  const [vertex, fragment, colorUtils] = await Promise.all([
    loadShaderSource(new URL('../shaders/spectrum/spectrum-strip.vert.glsl', base)),
    loadShaderSource(new URL('../shaders/spectrum/spectrum-strip.frag.glsl', base)),
    loadShaderSource(new URL('../shaders/color-utils.glsl', base)),
  ]);
  return { vertex, fragment, colorUtils };
}

function createMarkerState() {
  return {
    activeRatio: null,
    hoverRatio: null,
  };
}

function createAxisState() {
  return {
    svg: null,
    axisGroup: null,
    markerGroups: {
      active: null,
      hover: null,
    },
    scale: null,
    width: 0,
    tickLength: 0,
    d3: null,
  };
}

async function createSpectrumStripRenderer(canvas, cieTexture) {
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
  if (renderer.capabilities?.isWebGL2 && cieTexture) {
    cieTexture.internalFormat = 'RGB32F';
    cieTexture.needsUpdate = true;
  }

  const scene = new THREE.Scene();
  scene.background = null;
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
  camera.position.set(0, 0, 2);
  camera.lookAt(0, 0, 0);

  const fragmentShader = shaders.fragment.replace('{{COLOR_UTILS}}', shaders.colorUtils);
  const geometry = new THREE.PlaneGeometry(2, 2);
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTexture: { value: cieTexture },
    },
    vertexShader: shaders.vertex,
    fragmentShader,
  });
  material.toneMapped = false;

  const plane = new THREE.Mesh(geometry, material);
  scene.add(plane);

  const resize = () => {
    const width = Math.max(1, Math.round(canvas.clientWidth || canvas.offsetWidth || 1));
    const height = Math.max(1, Math.round(canvas.clientHeight || canvas.offsetHeight || 1));
    renderer.setSize(width, height, false);
    renderer.render(scene, camera);
  };

  return {
    resize,
  };
}

function createSpectrumStripAxis({ container, d3, axisState, wavelengths }) {
  const svg = d3.select(container).append('svg').attr('class', 'strip-axis-svg');
  const axisGroup = svg.append('g').attr('class', 'axis axis-strip');
  const axisLabel = svg
    .append('text')
    .attr('class', 'axis-label strip-axis-label')
    .attr('text-anchor', 'middle')
    .text('Wavelength (nm)');

  const createMarkerGroup = (mode) => {
    const group = svg
      .append('g')
      .attr('class', `axis axis-strip strip-axis-marker strip-axis-marker--${mode}`)
      .style('display', 'none');
    const line = group.append('line').attr('stroke-width', 1);
    const text = group.append('text').attr('text-anchor', 'middle');
    return { group, line, text };
  };

  axisState.svg = svg;
  axisState.axisGroup = axisGroup;
  axisState.markerGroups = {
    active: createMarkerGroup('active'),
    hover: createMarkerGroup('hover'),
  };
  axisState.d3 = d3;

  return function renderAxis() {
    if (!wavelengths || !wavelengths.length) {
      svg.attr('width', 0).attr('height', 0);
      return;
    }
    const width = Math.max(1, Math.round(container.clientWidth || container.offsetWidth || 1));
    const tickLength = 10;
    const labelPadding = 28;
    const axisHeight = tickLength + labelPadding;
    svg.attr('width', width).attr('height', axisHeight).attr('viewBox', `0 0 ${width} ${axisHeight}`);

    const domain = [wavelengths[0], wavelengths[wavelengths.length - 1]];
    const scale = d3.scaleLinear().domain(domain).range([0, width]);
    axisState.scale = scale;
    axisState.width = width;
    axisState.tickLength = tickLength;

    const tickStep = width > 520 ? 25 : 50;
    let ticks = [];
    for (let value = 400; value <= 700; value += tickStep) {
      if (value >= domain[0] && value <= domain[1]) {
        ticks.push(value);
      }
    }
    if (!ticks.length) {
      ticks = [domain[0], domain[1]].filter((value) => Number.isFinite(value));
    }
    const uniqueTicks = Array.from(new Set(ticks)).sort((a, b) => a - b);

    const axis = d3
      .axisTop(scale)
      .tickValues(uniqueTicks)
      .tickSizeInner(tickLength)
      .tickSizeOuter(0)
      .tickPadding(4);
    axisGroup.attr('transform', `translate(0, ${tickLength})`).call(axis);
    axisGroup.selectAll('text').attr('y', 8);
    axisGroup.select('.domain').style('display', 'none');
    axisLabel.attr('x', width / 2).attr('y', axisHeight - 2);

    Object.values(axisState.markerGroups).forEach((entry) => {
      if (!entry?.group || !entry.line || !entry.text) {
        return;
      }
      entry.group.attr('transform', `translate(0, ${tickLength})`).style('display', 'none');
      entry.line.attr('y1', 0).attr('y2', -tickLength);
      entry.text.attr('y', 8);
    });
    axisGroup.selectAll('.tick text').attr('opacity', 1);
    axisGroup.selectAll('.tick line').attr('opacity', 1);
  };
}

function setupSpectrumStripInteraction({
  canvas,
  cieData,
  markerState,
  axisState,
  onChromaticityChange,
  updateMarkers,
}) {
  if (!canvas || !cieData?.wavelengths?.length || !cieData?.chromaticities?.length) {
    return;
  }

  let isPointerActive = false;

  const ratioFromEvent = (event) => {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width) {
      return null;
    }
    const ratio = (event.clientX - rect.left) / rect.width;
    return THREE.MathUtils.clamp(ratio, 0, 1);
  };

  const chromaticityFromEvent = (event) => {
    const ratio = ratioFromEvent(event);
    if (ratio == null) {
      return null;
    }
    return chromaticityFromRatio(ratio, cieData);
  };

  const applyHoverFromEvent = (event) => {
    const chromaticity = chromaticityFromEvent(event);
    if (!chromaticity) {
      return false;
    }
    chromaticityState.hover.set(chromaticity.x, chromaticity.y);
    if (isPointerActive) {
      chromaticityState.match.copy(chromaticityState.hover);
    }
    if (typeof onChromaticityChange === 'function') {
      onChromaticityChange();
    }
    return true;
  };

  const capturePointer = (event) => {
    if (!event || typeof canvas.setPointerCapture !== 'function') {
      return;
    }
    try {
      canvas.setPointerCapture(event.pointerId);
    } catch (error) {
      // ignore capture errors
    }
  };

  const releasePointer = (event) => {
    if (!event || typeof canvas.releasePointerCapture !== 'function') {
      return;
    }
    try {
      if (
        typeof canvas.hasPointerCapture !== 'function' ||
        canvas.hasPointerCapture(event.pointerId)
      ) {
        canvas.releasePointerCapture(event.pointerId);
      }
    } catch (error) {
      // ignore release errors
    }
  };

  const handlePointerMove = (event) => {
    if (event && event.pointerType === 'touch' && event.cancelable) {
      event.preventDefault();
    }
    if (!applyHoverFromEvent(event)) {
      markerState.hoverRatio = null;
      chromaticityState.isSpectrumHovering = false;
      onChromaticityChange?.();
      updateMarkers();
      return;
    }
    const ratio = ratioFromEvent(event);
    markerState.hoverRatio = ratio;
    chromaticityState.isSpectrumHovering = true;
    onChromaticityChange?.();
    updateMarkers();
  };

  const handlePointerDown = (event) => {
    if (event && event.pointerType === 'touch' && event.cancelable) {
      event.preventDefault();
      capturePointer(event);
    }
    isPointerActive = true;
    if (!applyHoverFromEvent(event)) {
      return;
    }
    chromaticityState.match.copy(chromaticityState.hover);
    const ratio = ratioFromEvent(event);
    markerState.activeRatio = ratio;
    markerState.hoverRatio = ratio;
    chromaticityState.isSpectrumHovering = true;
    chromaticityState.hasSelection = true;
    onChromaticityChange?.();
    updateMarkers();
  };

  const handlePointerUp = (event) => {
    if (event && event.pointerType === 'touch') {
      releasePointer(event);
      chromaticityState.isSpectrumHovering = false;
      chromaticityState.hover.copy(chromaticityState.match);
      markerState.hoverRatio = null;
    }
    isPointerActive = false;
    onChromaticityChange?.();
    updateMarkers();
  };

  const handlePointerLeave = () => {
    isPointerActive = false;
    chromaticityState.hover.copy(chromaticityState.match);
    chromaticityState.isSpectrumHovering = false;
    markerState.hoverRatio = null;
    if (markerState.activeRatio == null) {
      hideSpectrumAxisMarkers(axisState);
    } else {
      updateMarkers();
    }
    onChromaticityChange?.();
  };

  canvas.addEventListener('pointermove', handlePointerMove, { passive: false });
  canvas.addEventListener('pointerdown', handlePointerDown, { passive: false });
  canvas.addEventListener('pointerup', handlePointerUp);
  canvas.addEventListener('pointercancel', handlePointerUp);
  canvas.addEventListener('pointerleave', handlePointerLeave);
}

async function loadCieTexture(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load CIE data from ${url}`);
  }
  const text = await response.text();
  const rows = text
    .trim()
    .split(/\r?\n/)
    .slice(1)
    .map((line) => {
      const [wavelength, x, y, z] = line.split(',');
      return {
        wavelength: parseFloat(wavelength),
        X: parseFloat(x),
        Y: parseFloat(y),
        Z: parseFloat(z),
      };
    })
    .filter((row) => row.wavelength >= 390 && row.wavelength <= 710 && Number.isFinite(row.wavelength));

  const width = rows.length;
  const array = new Float32Array(width * 3);
  rows.forEach((row, index) => {
    const offset = index * 3;
    array[offset] = row.X;
    array[offset + 1] = row.Y;
    array[offset + 2] = row.Z;
  });

  const chromaticities = rows.map((row) => {
    const sum = row.X + row.Y + row.Z;
    if (!Number.isFinite(sum) || sum <= 0) {
      return { x: 0, y: 0 };
    }
    return {
      x: row.X / sum,
      y: row.Y / sum,
    };
  });

  const texture = new THREE.DataTexture(array, width, 1, THREE.RGBFormat, THREE.FloatType);
  texture.needsUpdate = true;
  texture.colorSpace = THREE.NoColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.generateMipmaps = false;

  return {
    texture,
    wavelengths: rows.map((row) => row.wavelength),
    chromaticities,
  };
}

function updateSpectrumMarker({ cieData, markerState, axisState }) {
  if (!cieData?.wavelengths?.length) {
    return;
  }
  const activeRatio = markerState.activeRatio;
  const hoverRatio = markerState.hoverRatio;
  const activeWavelength = Number.isFinite(activeRatio)
    ? ratioToWavelength(activeRatio, cieData)
    : null;
  const hoverWavelength = Number.isFinite(hoverRatio)
    ? ratioToWavelength(hoverRatio, cieData)
    : null;
  if (!Number.isFinite(activeWavelength) && !Number.isFinite(hoverWavelength)) {
    hideSpectrumAxisMarkers(axisState);
    return;
  }
  updateSpectrumAxisMarkers({
    axisState,
    active: activeWavelength,
    hover: hoverWavelength,
  });
}

function ratioToWavelength(ratio, cieData) {
  if (!cieData?.wavelengths?.length) {
    return null;
  }
  const wavelengths = cieData.wavelengths;
  const min = wavelengths[0];
  const max = wavelengths[wavelengths.length - 1];
  return min + THREE.MathUtils.clamp(ratio, 0, 1) * (max - min);
}

function updateSpectrumAxisMarkers({ axisState, active, hover }) {
  if (!axisState.scale || !axisState.markerGroups) {
    return;
  }
  const entries = [
    { key: 'active', value: active },
    { key: 'hover', value: hover },
  ];
  const validEntries = entries.filter((entry) => Number.isFinite(entry.value));
  const tickLength = axisState.tickLength || 10;

  Object.entries(axisState.markerGroups).forEach(([key, groupEntry]) => {
    if (!groupEntry?.group) {
      return;
    }
    const item = validEntries.find((entry) => entry.key === key);
    if (!item) {
      groupEntry.group.style('display', 'none');
      return;
    }
    const x = axisState.scale(item.value);
    if (!Number.isFinite(x)) {
      groupEntry.group.style('display', 'none');
      return;
    }
    groupEntry.group.style('display', null);
    groupEntry.group.attr('transform', `translate(0, ${tickLength})`);
    groupEntry.line.attr('x1', x).attr('x2', x).attr('y1', 0).attr('y2', -tickLength);
    groupEntry.text.attr('x', x).attr('y', 8).text(`${Math.round(item.value)}`);
  });

  if (axisState.axisGroup) {
    const markerPositions = validEntries
      .map((entry) => axisState.scale(entry.value))
      .filter((pos) => Number.isFinite(pos));
    const threshold = 24;
    const d3Local = axisState.d3 || window.d3;
    if (!d3Local) {
      return;
    }
    axisState.axisGroup.selectAll('.tick').each(function (d) {
      const tickX = axisState.scale(d);
      const shouldHide = markerPositions.some((pos) => Math.abs(pos - tickX) < threshold);
      const tickSelection = d3Local.select(this);
      tickSelection.select('text').attr('opacity', shouldHide ? 0 : 1);
      tickSelection.select('line').attr('opacity', shouldHide ? 0 : 1);
    });
  }
}

function hideSpectrumAxisMarkers(axisState) {
  if (axisState.markerGroups) {
    Object.values(axisState.markerGroups).forEach((entry) => {
      if (entry?.group) {
        entry.group.style('display', 'none');
      }
    });
  }
  if (axisState.axisGroup) {
    axisState.axisGroup.selectAll('.tick text').attr('opacity', 1);
    axisState.axisGroup.selectAll('.tick line').attr('opacity', 1);
  }
}

function chromaticityFromRatio(ratio, cieData) {
  if (!cieData?.wavelengths?.length || !cieData?.chromaticities?.length) {
    return null;
  }
  const wavelengths = cieData.wavelengths;
  const chromaticities = cieData.chromaticities;
  const clamped = THREE.MathUtils.clamp(ratio, 0, 1);
  const min = wavelengths[0];
  const max = wavelengths[wavelengths.length - 1];
  const target = min + clamped * (max - min);
  if (!Number.isFinite(target)) {
    return null;
  }
  const index = findInsertionIndex(wavelengths, target);
  if (index <= 0) {
    return chromaticities[0];
  }
  if (index >= wavelengths.length) {
    return chromaticities[wavelengths.length - 1];
  }
  const lowerIndex = index - 1;
  const wl0 = wavelengths[lowerIndex];
  const wl1 = wavelengths[index];
  const span = wl1 - wl0 || 1;
  const t = THREE.MathUtils.clamp((target - wl0) / span, 0, 1);
  const c0 = chromaticities[lowerIndex];
  const c1 = chromaticities[index];
  return {
    x: THREE.MathUtils.lerp(c0.x, c1.x, t),
    y: THREE.MathUtils.lerp(c0.y, c1.y, t),
  };
}

function findInsertionIndex(array, value) {
  let low = 0;
  let high = array.length;
  while (low < high) {
    const mid = (low + high) >> 1;
    if (array[mid] < value) {
      low = mid + 1;
    } else {
      high = mid;
    }
  }
  return low;
}
