precision highp float;
#define M_PI 3.1415926535897932384626433832795
#define WHITEPOINT_SCALE 0.916

uniform float uTime;
uniform float uPointSize;
uniform vec2 uChromaticityMatch;
uniform vec2 uChromaticityMatchHover;
varying vec3 vXYZColor;

{{CLOUD_UTILS}}

const mat3 REC2020_TO_XYZ = transpose(mat3(
  0.6369580483012914, 0.14461690358620832, 0.1688809751641721,
  0.2627002120112671, 0.6779980715188708, 0.05930171646986196,
  0.0000000000000000, 0.02807269304908743, 1.0609850577107910
));

void main() {
  vec3 distribution = REC2020_TO_XYZ * cubicCloudDistribute(position, uTime);
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
