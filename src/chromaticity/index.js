import * as THREE from 'three';

export const CHROMATICITY_MAX = 0.9;

const chromaticityMatch = new THREE.Vector2(0.0, 0.0);
const chromaticityMatchHover = chromaticityMatch.clone();

export const chromaticityState = {
  match: chromaticityMatch,
  hover: chromaticityMatchHover,
  isDiagramHovering: false,
  isSpectrumHovering: false,
  hasSelection: false,
};

export function setupChromaticityPointerTracking(canvas, callbacks = {}) {
  if (!canvas) {
    return;
  }

  const { onLabelsChange, onSelection, onHoverExit } = callbacks;
  const notifyLabels = () => {
    if (typeof onLabelsChange === 'function') {
      onLabelsChange();
    }
  };

  const updateHoverFromEvent = (event) => {
    if (event && event.cancelable) {
      event.preventDefault();
    }
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) {
      return false;
    }
    const localX = (event.clientX - rect.left) / rect.width;
    const localY = (event.clientY - rect.top) / rect.height;
    const clampedX = THREE.MathUtils.clamp(localX, 0, 1);
    const clampedY = THREE.MathUtils.clamp(localY, 0, 1);
    const chartX = clampedX * CHROMATICITY_MAX;
    const chartY = (1.0 - clampedY) * CHROMATICITY_MAX;
    chromaticityState.hover.set(chartX, chartY);
    return true;
  };

  const handlePointerDown = (event) => {
    const updated = updateHoverFromEvent(event);
    if (!updated) {
      if (typeof onHoverExit === 'function') {
        onHoverExit();
      }
      return;
    }
    chromaticityState.match.copy(chromaticityState.hover);
    chromaticityState.isDiagramHovering = true;
    chromaticityState.hasSelection = true;
    notifyLabels();
    if (typeof onSelection === 'function') {
      onSelection();
    }
  };

  const handlePointerMove = (event) => {
    if (!updateHoverFromEvent(event)) {
      if (typeof onHoverExit === 'function') {
        onHoverExit();
      }
      return;
    }
    chromaticityState.isDiagramHovering = true;
    notifyLabels();
  };

  const handlePointerLeave = () => {
    chromaticityState.hover.copy(chromaticityState.match);
    chromaticityState.isDiagramHovering = false;
    notifyLabels();
    if (typeof onHoverExit === 'function') {
      onHoverExit();
    }
  };

  canvas.addEventListener('pointermove', handlePointerMove, { passive: false });
  canvas.addEventListener('pointerdown', handlePointerDown, { passive: false });
  canvas.addEventListener('pointerleave', handlePointerLeave);
  canvas.addEventListener('pointercancel', handlePointerLeave);
}

export function updateChromaticityLabels({ canvas, activeLabel, hoverLabel }) {
  if (!canvas) {
    return;
  }
  if (chromaticityState.hasSelection) {
    updateChromaticityLabel(canvas, activeLabel, chromaticityState.match);
  } else if (activeLabel) {
    activeLabel.style.display = 'none';
  }
  const hoverVisible = chromaticityState.isDiagramHovering || chromaticityState.isSpectrumHovering;
  if (hoverVisible) {
    updateChromaticityLabel(canvas, hoverLabel, chromaticityState.hover);
  } else if (hoverLabel) {
    hoverLabel.style.display = 'none';
  }
}

function updateChromaticityLabel(canvas, element, match) {
  if (!element || !match) {
    if (element) {
      element.style.display = 'none';
    }
    return;
  }
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  if (!width || !height || !Number.isFinite(match.x) || !Number.isFinite(match.y)) {
    element.style.display = 'none';
    return;
  }
  const offsetLeft = parseFloat(canvas.style.left || '0');
  const offsetTop = parseFloat(canvas.style.top || '0');
  const ratioX = THREE.MathUtils.clamp(match.x / CHROMATICITY_MAX, 0, 1);
  const ratioY = THREE.MathUtils.clamp(match.y / CHROMATICITY_MAX, 0, 1);
  const x = offsetLeft + ratioX * width;
  const y = offsetTop + (1 - ratioY) * height;
  element.style.left = `${x}px`;
  element.style.top = `${y}px`;
  element.textContent = `${match.x.toFixed(3)}, ${match.y.toFixed(3)}`;
  element.style.display = 'block';
}
