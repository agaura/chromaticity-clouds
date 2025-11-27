precision highp float;

#define COMPLEMENT_ALPHA 0.3392828462996986

{{COLOR_UTILS}}

uniform bool uShowCube;
uniform bool uP3Enabled;
uniform bool uSRGBEnabled;
varying vec3 vXYZColor;

const vec3 COMPLEMENT_GRAY = vec3(0.4587381755096547);

void main() {
  vec3 p3Color = XYZ_TO_P3 * vXYZColor;
  vec3 linearResult = mix(COMPLEMENT_GRAY, p3Color, COMPLEMENT_ALPHA);

  if (uShowCube) {
    vec3 realP3 = p3Color / WHITEPOINT_SCALE;
    if (uP3Enabled) {
      if (isWithinUnitCube(realP3)) {
        linearResult = realP3;
      }
    } else if (uSRGBEnabled) {
      vec3 realSrgb = (XYZ_TO_SRGB * vXYZColor) / WHITEPOINT_SCALE;
      if (isWithinUnitCube(realSrgb)) {
        linearResult = realP3;
      }
    }
  }

  gl_FragColor = vec4(applyDisplayGamma(linearResult), 1.0);
}
