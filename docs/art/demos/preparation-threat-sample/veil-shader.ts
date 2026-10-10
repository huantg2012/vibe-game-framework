export const VEIL_VERTEX_SHADER = `#version 300 es
precision highp float;
void main() {
  vec2 point = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(point * 2.0 - 1.0, 0.0, 1.0);
}
`;

/** Two transported, torn sheets; broad rolls carry fine edges with them. */
export const VEIL_FRAGMENT_SHADER = `#version 300 es
precision highp float;
uniform vec2 uResolution;
uniform vec4 uActor;
uniform vec2 uLevels;
uniform float uTravel;
out vec4 outColor;

float hash21(vec2 p) {
  vec3 q = fract(vec3(p.xyx) * vec3(.1031, .1030, .0973));
  q += dot(q, q.yzx + 33.33);
  return fract((q.x + q.y) * q.z);
}
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash21(i), hash21(i + vec2(1,0)), u.x),
             mix(hash21(i + vec2(0,1)), hash21(i + vec2(1,1)), u.x), u.y);
}
float fbm(vec2 p) {
  float value = 0.0, weight = .5333;
  const mat2 turn = mat2(.80, -.60, .60, .80);
  for (int i = 0; i < 4; i++) {
    value += weight * noise(p);
    p = turn * p * 2.03 + vec2(11.7, 4.9);
    weight *= .5;
  }
  return value;
}
float joinFronts(float a, float b) {
  float h = max(42.0 - abs(a-b), 0.0) / 42.0;
  return max(a,b) + h*h*10.5;
}
float gaussian(float x) { return exp(-x*x); }
float interval(float p, float a, float b, float feather) {
  return smoothstep(a, a + feather, p) * (1.0 - smoothstep(b - feather, b, p));
}
float coverageAt(vec2 p, float level) {
  // Low: only two separated incursions. The large untouched intervals are
  // deliberate negative space, not a weak but still continuous decorative rim.
  float lowTop = interval(p.x, 440.0, 835.0, 80.0) * interval(p.y, -100.0, 170.0, 70.0);
  float lowRight = interval(p.x, 778.0, 1080.0, 85.0) * interval(p.y, 378.0, 720.0, 90.0);
  float low = max(lowTop, lowRight);
  // Medium: broaden those two, then add a third broken reach at lower left.
  float midTop = interval(p.x, 385.0, 890.0, 90.0) * interval(p.y, -100.0, 245.0, 80.0);
  float midRight = interval(p.x, 710.0, 1080.0, 95.0) * interval(p.y, 255.0, 735.0, 90.0);
  float midBottom = interval(p.x, -90.0, 395.0, 110.0) * interval(p.y, 428.0, 760.0, 100.0);
  float medium = max(midTop, max(midRight, midBottom));
  // Several sides can enclose the high grade; edge light is still torn apart
  // by its internal material mask below, never a closed luminous outline.
  float heavy = .90 + .10 * gaussian((p.x - 665.0) / 430.0);
  float first = mix(low, medium, smoothstep(0.0, 1.0, level));
  return mix(first, heavy, smoothstep(1.0, 2.0, level));
}
float frontAt(vec2 p, float level, float folds) {
  float topWeight = .50 + .50 * gaussian((p.x - 625.0) / 365.0);
  float rightWeight = .40 + .60 * gaussian((p.y - 280.0) / 205.0);
  float bottomWeight = .34 + .66 * gaussian((p.x - 310.0) / 350.0);
  float top = (43.0 + level * 65.0) * topWeight - p.y;
  float right = (60.0 + level * 72.0) * rightWeight - (uResolution.x - p.x);
  float bottom = (41.0 + level * 55.0) * bottomWeight - (uResolution.y - p.y);
  float left = 24.0 + level * 23.0 - p.x;
  return joinFronts(joinFronts(top, right), joinFronts(bottom, left)) + (folds - .48) * 126.0;
}
void main() {
  vec2 p = vec2(gl_FragCoord.x, uResolution.y - gl_FragCoord.y);
  float level = uLevels.x, trailLevel = uLevels.y;

  // The main sheet moves down and inward. Curl is attached to transported
  // coordinates, so its recognisable edges travel rather than boil in place.
  vec2 q = p - vec2(.26, .966) * uTravel;
  vec2 rolling = vec2(fbm(q * .0046 + vec2(7.4, 2.1)),
                      fbm(q * .0046 + vec2(19.1, 11.3)));
  vec2 warped = q + (rolling - .5) * 112.0;
  float folds = fbm(warped * .0082);
  float grain = fbm(warped * .029 + vec2(2.1, 9.6));
  float front = frontAt(p, level, folds) + (grain - .5) * 26.0;
  float sheet = smoothstep(-22.0, 24.0, front);
  float crestWidth = mix(3.0, 11.0, folds);
  float crestDepth = mix(12.0, 31.0, grain);
  float crest = (1.0 - smoothstep(crestWidth * .22, crestWidth, abs(front - crestDepth)))
                * smoothstep(.40, .64, grain) * smoothstep(.34, .61, folds);
  float edgeStrength = mix(.50, 1.0, smoothstep(0.0, 2.0, level));
  crest *= edgeStrength;
  float channels = smoothstep(.32, .70, folds);
  float hollow = smoothstep(.49, .78, grain) * smoothstep(8.0, 80.0, front);
  float mainAlpha = sheet * (.27 + level * .065) * (1.0 - hollow * .58)
                    + crest * (.22 + level * .025);
  mainAlpha *= coverageAt(p, level);
  vec3 charcoal = vec3(.103, .121, .109);
  vec3 bodyColor = mix(charcoal, vec3(.193, .209, .174), channels);
  bodyColor = mix(bodyColor, vec3(.340, .359, .310), crest * .78);
  bodyColor *= .89 + grain * .22;

  // A thinner sheet sweeps from the right toward the lower left at 1.5x speed.
  // Anisotropic coordinates give long tears, not bubbles or a particle field.
  vec2 r = p - vec2(-.866, .5) * uTravel * 1.5;
  vec2 drag = vec2(fbm(r * .0051 + vec2(43.2, 2.3)),
                   fbm(r * .0051 + vec2(5.8, 37.9)));
  vec2 thinPoint = r + (drag - .5) * 154.0;
  float thinFolds = fbm(thinPoint * vec2(.006, .013));
  float thinGrain = fbm(thinPoint * vec2(.017, .043) + vec2(23.4, 6.2));
  float thinFront = frontAt(p, trailLevel, thinFolds) - 20.0 + (thinGrain - .5) * 24.0;
  float thinSheet = smoothstep(-30.0, 22.0, thinFront);
  float tear = (1.0 - smoothstep(.012, .067, abs(thinFolds - .50)))
               * smoothstep(.43, .64, thinGrain)
               * mix(.50, 1.0, smoothstep(0.0, 2.0, trailLevel));
  float broken = smoothstep(.39, .66, thinGrain);
  float thinAlpha = thinSheet * ((.070 + trailLevel * .025) * broken + tear * broken * .15);
  // Main coverage clears before the trailing transparent film when decreasing.
  float retreat = clamp(trailLevel - level, 0.0, 1.0);
  thinAlpha *= 1.0 - retreat * .30;
  vec3 thinColor = mix(vec3(.179, .196, .170), vec3(.34, .35, .298), tear * .80);

  // Very sparse stretched strands ride the thinner sheet. They have no
  // independent particle motion, no blinking and no screen-wide brightness pulse.
  float strandField = noise(thinPoint * vec2(.011, .085) + vec2(9.0, 31.0));
  float strand = (1.0 - smoothstep(.015, .052, abs(strandField - .49)))
                 * smoothstep(.57, .75, thinGrain) * thinSheet;
  thinAlpha += strand * .08;
  thinAlpha *= coverageAt(p, trailLevel);

  float alpha = 1.0 - (1.0 - mainAlpha) * (1.0 - thinAlpha);
  vec3 premultiplied = bodyColor * mainAlpha * (1.0 - thinAlpha) + thinColor * thinAlpha;
  vec3 color = premultiplied / max(alpha, .0001);

  // One stable actor opening shared by every grade and phase.
  float actorDistance = length((p - uActor.xy) / max(uActor.zw, vec2(1.0)));
  float actorProtection = smoothstep(1.0, 1.85, actorDistance);
  // Suppress material contrast behind the facts; the DOM is never sampled,
  // displaced or filtered. The broad mask has no rectangular panel edge.
  float reading = smoothstep(485.0, 555.0, p.x) * (1.0 - smoothstep(874.0, 946.0, p.x))
                  * smoothstep(165.0, 215.0, p.y) * (1.0 - smoothstep(500.0, 558.0, p.y));
  alpha *= actorProtection * (1.0 - reading * .55);
  color = mix(color, vec3(.118, .131, .116), reading * .58);
  outColor = vec4(color, clamp(alpha, 0.0, .72));
}
`;
