precision highp float;

{{COLOR_UTILS}}

varying vec2 vUv;
uniform sampler2D uTexture;

const float ALPHA = 0.38130632325908215;
const float GRAY = 0.3340893499109253;

void main() {
  vec3 xyzSpectrum = texture2D(uTexture, vec2(vUv.x, 0.5)).rgb;
  vec3 p3LinearIdealSpectrum = XYZ_TO_P3 * xyzSpectrum;
  vec3 p3LinearProjectedSpectrum = mix(vec3(GRAY), p3LinearIdealSpectrum, ALPHA);

  vec3 displayColor = applyDisplayGamma(p3LinearProjectedSpectrum);
  gl_FragColor = vec4(displayColor, 1.0);
}
