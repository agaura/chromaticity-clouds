precision highp float;

{{COLOR_UTILS}}

varying vec3 vXYZColor;

void main() {
  vec3 p3Color = XYZ_TO_P3 * vXYZColor;
  gl_FragColor = vec4(applyDisplayGamma(p3Color), 1.0);
}
