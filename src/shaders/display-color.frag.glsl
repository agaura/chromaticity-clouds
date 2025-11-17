precision highp float;

varying vec3 vXYZColor;

const mat3 XYZ_TO_P3 = transpose(mat3(
  2.493496912, -0.931383618, -0.402710784,
 -0.829488970,  1.762664060,  0.023624686,
  0.035845830, -0.076172389,  0.956884524
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

void main() {
  vec3 p3_color = XYZ_TO_P3 * vXYZColor;
  gl_FragColor = vec4(applyDisplayGamma(p3_color), 1.0);
}
