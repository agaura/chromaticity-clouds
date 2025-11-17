precision highp float;
#define M_PI 3.1415926535897932384626433832795
#define WHITEPOINT_SCALE 0.916

uniform float uTime;
uniform float uPointSize;
uniform vec2 uChromaticityMatch;
uniform vec2 uChromaticityMatchHover;
varying vec3 vXYZColor;

{{CLOUD_UTILS}}

const mat3 SRGB_TO_XYZ = transpose(mat3(
  0.4123907992659593, 0.3575843393838776, 0.1804807884018343,
  0.2126390058715102, 0.7151686787677559, 0.0721923153607337,
  0.0193308187155918, 0.1191947797946260, 0.9505321522496607
));

void main() {
  vec3 distribution = SRGB_TO_XYZ * cubicCloudDistribute(position, uTime);
  vXYZColor = distribution;

  vec3 placed = {{PLACEMENT}};
  if (any(isnan(placed))) {
    placed = vec3(0.0);
  }
  float chromaSum = max(distribution.x + distribution.y + distribution.z, 1e-5);
  vec2 chromaticity = distribution.xy / chromaSum;
  float proximityClicked = 10. * pow(
    1.0 - smoothstep(0.0, 0.05, distance(chromaticity, uChromaticityMatch)),
    2.0
  );
  float proximityHover = 10. * pow(
    1.0 - smoothstep(0.0, 0.05, distance(chromaticity, uChromaticityMatchHover)),
    2.0
  );
  float proximity = max(proximityClicked, proximityHover);
  gl_PointSize = uPointSize + proximity;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(placed, 1.0);
}
