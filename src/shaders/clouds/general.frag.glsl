precision highp float;

#define WHITEPOINT_SCALE 0.916
#define COMPLEMENT_ALPHA 0.3392828462996986

uniform bool uShowCube;
uniform bool uP3Enabled;
uniform bool uSRGBEnabled;
varying vec3 vXYZColor;

const vec3 COMPLEMENT_GRAY = vec3(0.4587381755096547);

const mat3 XYZ_TO_P3 = transpose(mat3(
  2.493496912, -0.931383618, -0.402710784,
 -0.829488970,  1.762664060,  0.023624686,
  0.035845830, -0.076172389,  0.956884524
));

const mat3 XYZ_TO_SRGB = transpose(mat3(
  3.2409699419045226, -1.537383177570094, -0.4986107602930034,
 -0.9692436362808793,  1.8759675015077204,  0.0415550574071756,
  0.0556300796969936, -0.2039769588889765,  1.0569715142428786
));

float linearToDisplayGammaComponent(float channel) {
  return channel <= 0.0031308 ? 12.92 * channel : 1.055 * pow(channel, 1.0 / 2.4) - 0.055;
}

vec3 applyDisplayGamma(vec3 linear) {
  return vec3(
    linearToDisplayGammaComponent(linear.r),
    linearToDisplayGammaComponent(linear.g),
    linearToDisplayGammaComponent(linear.b)
  );
}

bool isWithinUnitCube(vec3 value) {
  return all(greaterThanEqual(value, vec3(0.0))) && all(lessThanEqual(value, vec3(1.0)));
}

void main() {
  vec3 p3_color = XYZ_TO_P3 * vXYZColor;
  vec3 linearResult = mix(COMPLEMENT_GRAY, p3_color, COMPLEMENT_ALPHA);

  if (uShowCube) {
    vec3 real_p3 = p3_color / WHITEPOINT_SCALE;
    if (uP3Enabled) {
      if (isWithinUnitCube(real_p3)) {
        linearResult = real_p3;
      }
    } else if (uSRGBEnabled) {
      vec3 real_srgb = (XYZ_TO_SRGB * vXYZColor) / WHITEPOINT_SCALE;
      if (isWithinUnitCube(real_srgb)) {
        linearResult = real_p3;
      }
    }
  }

  gl_FragColor = vec4(applyDisplayGamma(linearResult), 1.0);
}
