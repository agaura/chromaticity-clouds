precision highp float;
#define M_PI 3.1415926535897932384626433832795
#define WHITEPOINT_SCALE 0.916

uniform float uTime;
uniform sampler2D uSpectrumLookupX;
uniform sampler2D uSpectrumLookupY;
uniform sampler2D uSpectrumLookupZ;
uniform float uSpectrumWidth;
uniform float uPointSize;
uniform vec2 uChromaticityMatch;
uniform vec2 uChromaticityMatchHover;

varying vec3 vXYZColor;

{{CLOUD_UTILS}}

void main() {
  vec3 distribution = cylindricalCloudDistribute(position, uTime);
  vec3 xyz = pushIntoDisplayableXYZCloud(
    uSpectrumLookupX,
    uSpectrumLookupY,
    uSpectrumLookupZ,
    distribution,
    uSpectrumWidth
  );
  vXYZColor = xyz;

  vec3 placed = {{PLACEMENT}};
  if (any(isnan(placed))) {
    placed = vec3(0.0);
  }
  float chromaSum = max(xyz.x + xyz.y + xyz.z, 1e-5);
  vec2 chromaticity = xyz.xy / chromaSum;
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
