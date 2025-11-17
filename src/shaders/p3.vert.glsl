precision highp float;
#define M_PI 3.1415926535897932384626433832795
#define WHITEPOINT_SCALE 0.916

uniform float uTime;
uniform float uPointSize;
uniform vec2 uChromaticityMatch;
uniform vec2 uChromaticityMatchHover;
varying vec3 vXYZColor;

{{CLOUD_UTILS}}

const mat3 P3_TO_XYZ = transpose(mat3(
  0.4865709487307447, 0.2656676932425557, 0.19821728499580404,
  0.2289745642699899, 0.6917385220595262, 0.07928691395103558,
  0.0000000000726714, 0.04511338174818106, 1.0439443689352284
));

void main() {
  vec3 distribution = P3_TO_XYZ * cubicCloudDistribute(position, uTime);
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
