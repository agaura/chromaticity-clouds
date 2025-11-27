float rand(vec2 co) {
  return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453);
}

float stable_randomizer(vec3 starter) {
  float r1 = rand(vec2(starter.x * 1502.13, starter.y * 232.82 + starter.z * 800.1));
  float r2 = rand(vec2(starter.y * 545.36, starter.z * 646.2 + r1 * 250.0));
  float r3 = rand(vec2(starter.x * 1408.33, starter.z * 257.9 + r2 * 630.0));

  float p1 = rand(vec2(starter.x * 100.2 + 50.0 * r1, starter.y * 17.6));
  float p2 = rand(vec2(starter.y * 256.4 + 67.8 * r2, starter.z * 179.5));
  float p3 = rand(vec2(starter.z * 98.3 + 98.0 * r3, starter.x * 290.5));

  return rand(vec2(89.8 * p1, rand(vec2(107.9 * p2, 56.03 * p3))));
}

vec3 randomizer(vec3 starter, float time, bool edge) {
  float r1 = rand(vec2(starter.x * 1502.13, starter.y * 232.82 + starter.z * 800.1));
  float r2 = rand(vec2(starter.y * 545.36, starter.z * 646.2 + r1 * 250.0));
  float r3 = rand(vec2(starter.x * 1408.33, starter.z * 257.9 + r2 * 630.0));

  float speed = 1.0 / 1000.0;

  float p1 = (r1 * sin((0.5 + 1.5 * r2) * time * speed + 150.0 * rand(vec2(starter.x * 100.2 + 50.0 * r1, starter.y * 17.6))) + 1.0) * 0.5;
  float p2 = (r2 * sin((0.5 + 1.5 * r3) * time * speed + 276.0 * rand(vec2(starter.y * 256.4 + 67.8 * r2, starter.z * 179.5))) + 1.0) * 0.5;
  float p3 = (r3 * sin((0.5 + 1.5 * r1) * time * speed + 2039.0 * rand(vec2(starter.z * 98.3 + 98.0 * r3, starter.x * 290.5))) + 1.0) * 0.5;

  if (edge) {
    speed = 1.0 / 10000.0;
    p1 = ((sin((0.5 + 1.5 * r2) * time * speed + 150.0 * rand(vec2(starter.x * 100.2 + 50.0 * r1, starter.y * 17.6))) * 2.0) * 0.5 + 1.0) * 0.5;
    p2 = ((sin((0.5 + 1.5 * r3) * time * speed + 276.0 * rand(vec2(starter.y * 256.4 + 67.8 * r2, starter.z * 179.5))) * 2.0) * 0.5 + 1.0) * 0.5;
    p3 = ((sin((0.5 + 1.5 * r1) * time * speed + 2039.0 * rand(vec2(starter.z * 98.3 + 98.0 * r3, starter.x * 290.5))) * 2.0) * 0.5 + 1.0) * 0.5;
  }

  return vec3(p1, p2, p3);
}

float adjustDensity(float x, float A_prime, float B_prime, float S) {
  float B = (B_prime - A_prime) / S + A_prime * (1.0 - (1.0 - S) * (B_prime - A_prime));
  float A = A_prime * (1.0 - (1.0 - S) * (B - A_prime));

  if (x < A) {
    return (A_prime / A) * x;
  } else if (x < B) {
    return A_prime + S * (x - A);
  } else {
    return B_prime + (1.0 - B_prime) / (1.0 - B) * (x - B);
  }
}

vec3 cylindricalCloudDistribute(vec3 pos, float time) {
  float strength = 1.0 / 16.0;
  float r = stable_randomizer(pos);
  bool edge = false;
  if (r < 0.5) {
    strength = 1.0;
    edge = true;
  }

  vec3 new_point = randomizer(pos, time, edge);
  return mod(vec3(stable_randomizer(pos), 0.0, 0.0) + mix(pos.xyz, new_point, strength), 1.0);
}

vec3 cubicCloudDistribute(vec3 pos, float time) {
  float strength = 1.0 / 16.0;
  float r = stable_randomizer(pos);
  bool edge = false;
  if (r < 0.5) {
    strength = 1.0;
    edge = true;
  }

  vec3 new_point = randomizer(pos, time, edge);
  return mix(pos.xyz, new_point, strength);
}

vec3 positionInDisplaySpace(vec3 coord, float scale) {
  const vec3 axisY = normalize(vec3(1.0, 1.0, 1.0));
  const vec3 axisX = normalize(vec3(1.0, -1.0, 0.0));
  const vec3 axisZ = normalize(cross(axisY, axisX));
  const float diagScale = inversesqrt(3.0);

  vec3 centered = coord - vec3(0.5);
  vec3 rotated = vec3(
    dot(centered, axisX),
    dot(centered, axisY) * diagScale,
    - dot(centered, axisZ)
  );

  return 1.45 * scale * rotated;
}

vec3 positionChromaticity(vec3 coord, float scale) {
  float sum = max(coord.x + coord.y + coord.z, 1e-5);
  vec2 chroma = coord.xy / sum;

  vec2 clamped = clamp(chroma, 0.0, 0.9);
  return vec3(clamped * scale, 0.0);
}

vec3 pushIntoDisplayableXYZCloud(
  sampler2D texX,
  sampler2D texY,
  sampler2D texZ,
  vec3 distribution,
  float width
) {
  float redistribution = distribution.x * 2.0;
  float a1 = 0.001 * 2.0;
  float a2 = 0.143 * 2.0;
  float addit = floor(redistribution);
  redistribution = redistribution - addit;
  redistribution = adjustDensity(redistribution, a1, a2, 0.675) + addit;
  redistribution = redistribution / 2.0;

  vec3 value = vec3(
    texture2D(texX, vec2(redistribution, 0.5)).r,
    texture2D(texY, vec2(redistribution, 0.5)).r,
    texture2D(texZ, vec2(redistribution, 0.5)).r
  );
  return mix(value, vec3(distribution.y), distribution.z);
}
