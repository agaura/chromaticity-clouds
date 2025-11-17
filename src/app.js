import * as THREE from 'three';
import { chromaticityState, setupChromaticityPointerTracking, updateChromaticityLabels } from './chromaticity/index.js';
import { createCloudViewer } from './viewers/cloud-viewer.js';
import { createComplementSpectrumTextures } from './spectrum-textures.js';
import { initSpectrumStrip } from './spectrum/spectrum-strip.js';

export async function initApp() {
  const chromaticityCanvas = document.getElementById('chromaticityCanvas');
  const spaceCanvas = document.getElementById('spaceCanvas');
  if (!chromaticityCanvas || !spaceCanvas) {
    throw new Error('Required canvas elements are missing.');
  }

  const chromaticityActiveLabel = document.getElementById('chromaticityActiveLabel');
  const chromaticityHoverLabel = document.getElementById('chromaticityHoverLabel');
  const spectrumStripCanvas = document.getElementById('spectrumStripCanvas');
  const spectrumStripAxisContainer = document.getElementById('spectrumStripAxis');
  const pointSizeSlider = document.getElementById('pointSizeSlider');
  const pointSizeValueLabel = document.getElementById('pointSizeValue');
  const toggleMaxGamut = document.getElementById('toggleMaxGamut');
  const toggleP3 = document.getElementById('toggleP3');
  const toggleSRGB = document.getElementById('toggleSRGB');
  const d3Global = window.d3;

  const chromaticityElements = {
    canvas: chromaticityCanvas,
    activeLabel: chromaticityActiveLabel,
    hoverLabel: chromaticityHoverLabel,
  };

  const refreshChromaticityLabels = () => updateChromaticityLabels(chromaticityElements);
  refreshChromaticityLabels();
  window.addEventListener('resize', refreshChromaticityLabels);

  let spectrumControls = null;

  setupChromaticityPointerTracking(chromaticityCanvas, {
    onSelection: () => spectrumControls?.clearMarkers(),
    onHoverExit: () => spectrumControls?.clearHoverMarker(),
    onLabelsChange: refreshChromaticityLabels,
  });

  const initialPointSizeValue = (() => {
    if (!pointSizeSlider) {
      return 1;
    }
    const parsed = parseFloat(pointSizeSlider.value);
    return Number.isFinite(parsed) ? parsed : 1;
  })();

  const spectrumTextures = createComplementSpectrumTextures();
  const viewers = await Promise.all([
    createCloudViewer({
      canvas: chromaticityCanvas,
      placementMode: 'chromaticity',
      spectrumTextures,
      chromaticityMatch: chromaticityState.match,
      chromaticityHover: chromaticityState.hover,
      pointSize: initialPointSizeValue,
    }),
    createCloudViewer({
      canvas: spaceCanvas,
      placementMode: 'display',
      spectrumTextures,
      chromaticityMatch: chromaticityState.match,
      chromaticityHover: chromaticityState.hover,
      pointSize: initialPointSizeValue,
    }),
  ]);

  const syncPointSizeValue = (value) => {
    if (pointSizeValueLabel) {
      pointSizeValueLabel.textContent = value.toFixed(1);
    }
  };

  const applyPointSize = (value) => {
    syncPointSizeValue(value);
    viewers.forEach((viewer) => viewer.setPointSize(value));
  };
  applyPointSize(initialPointSizeValue);

  if (pointSizeSlider) {
    pointSizeSlider.addEventListener('input', (event) => {
      const nextValue = parseFloat(event.target.value);
      if (Number.isFinite(nextValue)) {
        applyPointSize(nextValue);
      }
    });
  }

  const resolveCheckbox = (input, fallback) => {
    if (!input) {
      return fallback;
    }
    return input.checked;
  };

  const applyVisibility = () => {
    const maxEnabled = resolveCheckbox(toggleMaxGamut, true);
    const p3Enabled = resolveCheckbox(toggleP3, true);
    const srgbEnabled = resolveCheckbox(toggleSRGB, true);
    viewers.forEach((viewer) => viewer.setVisibility(maxEnabled, p3Enabled, srgbEnabled));
  };

  applyVisibility();
  [toggleMaxGamut, toggleP3, toggleSRGB].forEach((input) => {
    if (input) {
      input.addEventListener('change', applyVisibility);
    }
  });

  const clock = new THREE.Clock();
  function renderLoop() {
    const elapsedMs = clock.getElapsedTime() * 1000;
    viewers.forEach((viewer) => {
      viewer.updateTime(elapsedMs);
      viewer.render();
    });
    requestAnimationFrame(renderLoop);
  }
  renderLoop();

  if (spectrumStripCanvas && spectrumStripAxisContainer && d3Global) {
    spectrumControls = await initSpectrumStrip({
      canvas: spectrumStripCanvas,
      axisContainer: spectrumStripAxisContainer,
      d3: d3Global,
      onChromaticityChange: refreshChromaticityLabels,
    });
  }
}
