import * as THREE from 'three';
import { COMPLEMENT_LOOKUP_TABLE } from './data/complement-lut.js';

const lookupTable = new Float32Array(
  COMPLEMENT_LOOKUP_TABLE.trim().split(/[\s,]+/).filter(Boolean).map(Number)
);

export function createComplementSpectrumTextures() {
  const width = lookupTable.length / 3;

  const dataX = new Float32Array(width * 4);
  const dataY = new Float32Array(width * 4);
  const dataZ = new Float32Array(width * 4);

  for (let i = 0; i < width; i += 1) {
    const r = lookupTable[3 * i];
    const g = lookupTable[3 * i + 1];
    const b = lookupTable[3 * i + 2];

    const idx = 4 * i;
    dataX[idx] = r;
    dataX[idx + 1] = 0;
    dataX[idx + 2] = 0;
    dataX[idx + 3] = 1;

    dataY[idx] = g;
    dataY[idx + 1] = 0;
    dataY[idx + 2] = 0;
    dataY[idx + 3] = 1;

    dataZ[idx] = b;
    dataZ[idx + 1] = 0;
    dataZ[idx + 2] = 0;
    dataZ[idx + 3] = 1;
  }

  const textureX = createDataTexture(dataX, width);
  const textureY = createDataTexture(dataY, width);
  const textureZ = createDataTexture(dataZ, width);

  return {
    x: textureX,
    y: textureY,
    z: textureZ,
    width,
  };
}

function createDataTexture(data, width) {
  const texture = new THREE.DataTexture(data, width, 1, THREE.RGBAFormat, THREE.FloatType);
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearFilter;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}
