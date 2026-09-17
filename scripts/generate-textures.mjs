/**
 * Generates the eight abstract textures in `public/textures/`.
 *
 * Why procedural rather than a diffusion model: the design doc
 * (docs/superpowers/specs/2026-09-17-landing-page-enhancement-design.md) requires
 * imagery that carries NO brand mark, NO lettering and NO recognisable product,
 * keyed to four exact palette tokens. A prompt can only ask a model for that and
 * hope. Here it is guaranteed by construction — the only colours that can appear
 * are the four below, and nothing in this file can draw a glyph.
 *
 * It is also reproducible. Seeds are fixed, so re-running this script reproduces
 * the committed files byte for byte, and a texture can be tuned by editing a
 * number rather than by re-rolling a prompt.
 *
 * Each texture is a HEIGHT FIELD that is then lit. That is what separates a
 * material study from coloured noise: surface normals are taken from the height
 * field by central difference and shaded against a directional light, so silk
 * reads as folded cloth and guilloché reads as cut metal. Shading happens in
 * linear light and is converted back to sRGB at the end, otherwise the midtones
 * go muddy.
 *
 * Run: node scripts/generate-textures.mjs
 */

import sharp from "sharp";
import { mkdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "textures");

/** The four tokens from globals.css. No other colour may appear. */
const IVORY = [0xf4, 0xf0, 0xe8];
const INK = [0x11, 0x10, 0x0f];
const GOLD = [0xb9, 0x9a, 0x62];
const CHAMPAGNE = [0xd8, 0xc5, 0xa0];

const TAU = Math.PI * 2;

// ---------------------------------------------------------------------------
// Noise
// ---------------------------------------------------------------------------

/** Seeded xorshift, used only to shuffle the permutation table. */
function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5;
    s >>>= 0;
    return s / 4294967296;
  };
}

function makePerm(seed) {
  const rand = rng(seed);
  const base = new Uint8Array(256);
  for (let i = 0; i < 256; i++) base[i] = i;
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const t = base[i];
    base[i] = base[j];
    base[j] = t;
  }
  const p = new Uint8Array(512);
  for (let i = 0; i < 512; i++) p[i] = base[i & 255];
  return p;
}

const GRAD = [
  [1, 1],
  [-1, 1],
  [1, -1],
  [-1, -1],
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
const lerp = (a, b, t) => a + (b - a) * t;

/**
 * Gradient (Perlin) noise, roughly [-1, 1]. Gradient rather than value noise
 * because value noise shows its grid as visible horizontal and vertical seams,
 * which on a marble or silk surface reads immediately as fake.
 */
function perlin(p, x, y) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const X = xi & 255;
  const Y = yi & 255;
  const xf = x - xi;
  const yf = y - yi;
  const u = fade(xf);
  const v = fade(yf);
  const g = (h, dx, dy) => {
    const gr = GRAD[h & 7];
    return gr[0] * dx + gr[1] * dy;
  };
  const aa = p[p[X] + Y];
  const ab = p[p[X] + Y + 1];
  const ba = p[p[X + 1] + Y];
  const bb = p[p[X + 1] + Y + 1];
  const x1 = lerp(g(aa, xf, yf), g(ba, xf - 1, yf), u);
  const x2 = lerp(g(ab, xf, yf - 1), g(bb, xf - 1, yf - 1), u);
  return lerp(x1, x2, v);
}

/** Fractal Brownian motion. Normalised to roughly [-1, 1]. */
function fbm(p, x, y, oct = 5, lac = 2, gain = 0.5) {
  let amp = 1;
  let freq = 1;
  let sum = 0;
  let norm = 0;
  for (let i = 0; i < oct; i++) {
    sum += amp * perlin(p, x * freq, y * freq);
    norm += amp;
    amp *= gain;
    freq *= lac;
  }
  return sum / norm;
}

/** Ridged multifractal, [0, 1]. Sharp creases — used for stone and crinkle. */
function ridged(p, x, y, oct = 4) {
  let amp = 1;
  let freq = 1;
  let sum = 0;
  let norm = 0;
  for (let i = 0; i < oct; i++) {
    sum += amp * (1 - Math.abs(perlin(p, x * freq, y * freq)));
    norm += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return sum / norm;
}

/** Triangle wave, [-1, 1]. Machined grooves have flat flanks, not sine bellies. */
const tri = (x) => (Math.asin(Math.sin(x)) * 2) / Math.PI;

/**
 * One height band, expressed as the surface SLOPE it contributes rather than
 * its amplitude.
 *
 * This matters more than it looks. Shading reads the gradient of the height
 * field, and the gradient of a wave scales with its frequency — so a weave at
 * 150 cycles and a fold at 2 cycles, given the same amplitude, differ in slope
 * by 75x and the weave annihilates the fold. Tuning amplitudes by eye produces
 * grey fuzz every time. Asking for slope directly makes the bands composable:
 * `band(0.3, ...)` always contributes about a 17-degree tilt, whatever its
 * frequency.
 *
 * `freq` is the band's dominant spatial frequency in cycles across the tile.
 * For fbm, the octaves each contribute comparable slope, so pass roughly
 * `base * octaves * 0.4`.
 */
const band = (slope, freq, value) => (slope * value) / (TAU * freq);

const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);

function smoothstep(a, b, x) {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
}

/** Stable per-pixel hash for film grain, so output stays reproducible. */
function grainAt(i) {
  let h = (i * 2654435761) >>> 0;
  h ^= h >> 15;
  h = (h * 2246822519) >>> 0;
  h ^= h >> 13;
  return h / 4294967296 - 0.5;
}

// ---------------------------------------------------------------------------
// Colour
// ---------------------------------------------------------------------------

const srgbToLinear = (c) => {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
};

const linearToSrgb = (l) => {
  const v = l <= 0.0031308 ? l * 12.92 : 1.055 * Math.pow(l, 1 / 2.4) - 0.055;
  return clamp01(v) * 255;
};

const toLinear = (c) => c.map(srgbToLinear);

// ---------------------------------------------------------------------------
// Renderer
// ---------------------------------------------------------------------------

/**
 * Renders one texture.
 *
 * `field(u, v)` returns `{ h, t, g }`:
 *   h — surface height, built from `band()` so its gradient is calibrated
 *   t — mix from colourA toward colourB, [0, 1]
 *   g — mix of the result toward colourC (the accent), [0, 1]
 *   d — diffuse scale, default 1
 *   s — specular scale, default 1
 *
 * `d` and `s` are what separate metal from everything else, and a texture that
 * mixes the two needs them per pixel. A dielectric — stone, silk, powder — is
 * mostly diffuse: its colour is in the pigment. A metal is the reverse: its
 * diffuse is nearly black and its colour lives in a COLOURED reflection. Lighting
 * gold leaf as a bright diffuse gold is what makes it come out as mustard paint,
 * so the leaf is given `d` near 0.3 and `s` near 1 while the stone beside it
 * keeps `d` at 1 and drops `s` to almost nothing.
 *
 * With the default `relief` of 700 the surface slope equals dh/du exactly, so
 * the slope asked for in `band()` is the slope that gets shaded. Keep `t` low
 * and let the LIGHT make the tonal range: a silk is one colour, and it is the
 * shading of its folds that gives it depth. Driving `t` up toward ink instead
 * just desaturates the warm ivory into grey.
 *
 * Rendered at 2x and downsampled with Lanczos. The weave and guilloché
 * frequencies are near the pixel grid, and without supersampling they alias into
 * moiré — which looks like a compression artefact, not a fabric.
 */
async function render(spec) {
  const {
    name,
    out: [outW, outH],
    field,
    colorA = IVORY,
    colorB = INK,
    colorC = GOLD,
    light = [-0.55, -0.6, 0.58],
    relief = 700,
    ambient = 0.42,
    ambientTint = [1.12, 1.0, 0.8],
    specular = 0,
    shininess = 24,
    specColor = IVORY,
    grain = 0.014,
    vignette = 0.16,
    quality = 82,
  } = spec;

  const SS = 2;
  const W = outW * SS;
  const H = outH * SS;
  const n = W * H;

  const heights = new Float32Array(n);
  const tints = new Float32Array(n);
  const accents = new Float32Array(n);
  const diffuses = new Float32Array(n);
  const speculars = new Float32Array(n);

  for (let y = 0; y < H; y++) {
    const v = y / (H - 1);
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const r = field(x / (W - 1), v);
      heights[i] = r.h;
      tints[i] = r.t;
      accents[i] = r.g || 0;
      diffuses[i] = r.d === undefined ? 1 : r.d;
      speculars[i] = r.s === undefined ? 1 : r.s;
    }
  }

  const ll = Math.hypot(light[0], light[1], light[2]);
  const lx = light[0] / ll;
  const ly = light[1] / ll;
  const lz = light[2] / ll;
  // Blinn-Phong half-vector, view fixed down the z axis.
  const hx0 = lx;
  const hy0 = ly;
  const hz0 = lz + 1;
  const hl = Math.hypot(hx0, hy0, hz0);
  const hx = hx0 / hl;
  const hy = hy0 / hl;
  const hz = hz0 / hl;

  const A = toLinear(colorA);
  const B = toLinear(colorB);
  const C = toLinear(colorC);
  const S = toLinear(specColor);

  // Relief is expressed per output pixel, so a texture keeps the same apparent
  // depth regardless of the resolution it is rendered at.
  const reliefScale = (relief * W) / 1400;

  const buf = Buffer.allocUnsafe(n * 3);

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const xm = x > 0 ? i - 1 : i;
      const xp = x < W - 1 ? i + 1 : i;
      const ym = y > 0 ? i - W : i;
      const yp = y < H - 1 ? i + W : i;

      const dx = (heights[xp] - heights[xm]) * reliefScale;
      const dy = (heights[yp] - heights[ym]) * reliefScale;
      const inv = 1 / Math.sqrt(dx * dx + dy * dy + 1);
      const nx = -dx * inv;
      const ny = -dy * inv;
      const nz = inv;

      const diff = Math.max(0, nx * lx + ny * ly + nz * lz);
      const key = (1 - ambient) * diff;

      let sp = 0;
      if (specular > 0) {
        const nh = Math.max(0, nx * hx + ny * hy + nz * hz);
        sp = Math.pow(nh, shininess) * specular * speculars[i];
      }

      const t = tints[i];
      const g = accents[i];

      // Vignette and grain are applied to the light, not the pigment, so the
      // palette stays exactly the four tokens.
      const cu = x / (W - 1) - 0.5;
      const cv = y / (H - 1) - 0.5;
      const vig = 1 - vignette * Math.pow(Math.min(1, Math.hypot(cu, cv) * 1.5), 2.4);
      const gn = (1 + grainAt(i) * grain) * vig;

      const o = i * 3;
      for (let c = 0; c < 3; c++) {
        const base = lerp(lerp(A[c], B[c], t), C[c], g);
        // The ambient term is TINTED, the key light is not. These pigments are
        // close to neutral, and darkening a neutral in linear light leaves it
        // neutral — which is why an untinted fill turns ivory silk into grey
        // plastic. Warm bounce in the shadows is what reads as material.
        buf[o + c] = linearToSrgb(
          base * diffuses[i] * (ambient * ambientTint[c] + key) * gn + S[c] * sp,
        );
      }
    }
  }

  const path = join(OUT_DIR, `${name}.webp`);
  await sharp(buf, { raw: { width: W, height: H, channels: 3 } })
    .resize(outW, outH, { kernel: "lanczos3" })
    .webp({ quality, effort: 6 })
    .toFile(path);

  return path;
}

// ---------------------------------------------------------------------------
// The eight textures
// ---------------------------------------------------------------------------

const SECTOR = [1000, 600]; // 5:3 landscape
const HERO = [1100, 1375]; // 4:5 portrait

/** Broad cloth folds: a wave whose phase is pushed around by low-frequency noise. */
function foldWave(p, u, v, { angle = 0.35, count = 2.2, warp = 0.22, seed = 0, sharp = 1.15 } = {}) {
  const s = u * Math.cos(angle) - v * Math.sin(angle);
  // The warp is deliberately ANISOTROPIC — stretched along the fold direction.
  // An isotropic warp shifts the phase as fast across a fold as along it, which
  // breaks the wave into blobs; drapery has to stay coherent down its length.
  const w = fbm(p, s * 2.6 + seed, (u * Math.sin(angle) + v * Math.cos(angle)) * 0.5 + seed, 4) * warp;
  const raw = Math.sin((s + w) * TAU * count);
  // Cloth gathers into narrow creases with broad flats between, the opposite of
  // a sine. Slightly above 1 pinches the troughs; push it far and the creases
  // turn into cracks.
  const shaped = Math.sign(raw) * Math.pow(Math.abs(raw), sharp);
  // Some folds run deeper than others, and a few fade out entirely.
  const depth = 0.4 + 0.6 * (0.5 + 0.5 * fbm(p, s * 1.3 + 11, v * 0.6 + 7, 3));
  return shaped * depth;
}

/** Plain-weave over-under, the fine structure under silk. */
function weave(u, v, freq) {
  return Math.sin(u * TAU * freq) * Math.sin(v * TAU * freq);
}

const TEXTURES = [
  // -- hero -----------------------------------------------------------------
  // Silk above, pale stone below, a single torn seam of gold leaf where they
  // meet. Portrait, because it sits in the hero's right column.
  (() => {
    const p = makePerm(0x51_1c_01);
    const q = makePerm(0x9a_1d_02);
    return {
      name: "hero",
      out: HERO,
      light: [-0.46, -0.68, 0.57],
      ambient: 0.42,
      specular: 1.3,
      shininess: 15,
      specColor: CHAMPAGNE,
      vignette: 0.2,
      quality: 84,
      field(u, v) {
        // Folds run down the tile: this is a tall image, and vertical drapery
        // uses the height. An earlier version split silk from stone across a
        // horizontal seam, which in portrait read as a landscape horizon.
        const silk =
          band(0.68, 2.4, foldWave(p, u, v, { angle: 0.08, count: 2.4, warp: 0.18 })) +
          band(0.22, 5.8, foldWave(p, u, v, { angle: 0.08, count: 5.8, warp: 0.13, seed: 6 })) +
          band(0.11, 150, weave(u, v, 150)) +
          band(0.07, 30, fbm(p, u * 26, v * 26, 3));

        // Broad torn sheets of leaf, not a ribbon.
        //
        // Two earlier versions drew the leaf as a narrow diagonal seam, and both
        // failed the same way: a thin band on a near-flat field reads as an
        // OBJECT lying on a wall — a rope, a smear — rather than as one of two
        // materials the image is made of. Widening the band and re-tuning its
        // facets did not fix it, because the fault was the composition.
        //
        // `materials` is the texture that does read as gold leaf, and the reason
        // is that its leaf mask is a large organic region covering much of the
        // frame, so the eye reads a torn SURFACE. This uses the same
        // construction: a broad mask with progressively finer noise added, so
        // the tear is ragged at every scale.
        const broad = fbm(q, u * 1.8, v * 2.1, 3);
        const mid = fbm(q, u * 6.2 + 3, v * 7 + 7, 3);
        const fineEdge = fbm(q, u * 18 + 11, v * 20 + 2, 2);
        // The bias keeps the editorial diagonal — leaf gathers toward the lower
        // left and thins toward the upper right — without the shape ever
        // becoming a stripe.
        const bias = 0.3 * (u * 0.7 + v * -0.72);
        const leaf = smoothstep(-0.3, 0.02, broad + 0.36 * mid + 0.14 * fineEdge + bias);

        // Facet scale matched to `materials`. At the frequencies used before,
        // facets were finer than the leaf was wide, so no single facet could
        // hold the light: the flashes averaged into grey-brown noise under
        // downscale instead of glinting.
        const crinkle =
          band(1.15, 11, ridged(q, u * 7, v * 7, 2) - 0.5) +
          band(0.5, 30, ridged(q, u * 21, v * 21, 3) - 0.5) +
          band(0.14, 110, fbm(q, u * 90, v * 90, 2));

        const t = 0.02 + 0.03 * (0.5 + 0.5 * fbm(q, u * 4, v * 4, 3));
        const sheen = clamp01(0.5 + 0.5 * fbm(p, u * 1.3 + 30, v * 1.3, 3)) * 0.2;
        return {
          // The silk keeps showing through the leaf rather than being replaced,
          // so the drape reads as continuous under both materials.
          h: lerp(silk, crinkle + 0.4 * silk, leaf),
          t: clamp01(t),
          g: clamp01(leaf * 0.95 + sheen * (1 - leaf)),
          // This image is displayed at roughly half the resolution it is
          // rendered at, and downscaling averages the facets together. A
          // physically-dim metal diffuse survives that average as olive, so the
          // target here is the AVERAGE reading as gold, not the peak.
          d: lerp(1, 0.72, leaf),
          s: lerp(0.12, 1, leaf),
        };
      },
    };
  })(),

  // -- fashion --------------------------------------------------------------
  // Folded silk under raking light, so the weave catches on every crest. Two
  // fold families at different angles keep it from reading as corrugation.
  (() => {
    const p = makePerm(0x0f_a5_11);
    return {
      name: "fashion",
      out: SECTOR,
      light: [-0.84, -0.36, 0.41], // low and from the side: raking
      ambient: 0.4,
      specular: 0.12,
      shininess: 30,
      specColor: CHAMPAGNE,
      colorC: CHAMPAGNE,
      field(u, v) {
        const h =
          band(0.46, 2.6, foldWave(p, u, v, { angle: 0.34, count: 2.6, warp: 0.2 })) +
          band(0.12, 6.2, foldWave(p, u, v, { angle: 0.34, count: 6.2, warp: 0.14, seed: 4 })) +
          band(0.11, 130, weave(u, v, 130)) +
          band(0.07, 34, fbm(p, u * 28, v * 28, 3));
        const t = 0.02 + 0.035 * (0.5 + 0.5 * fbm(p, u * 3 + 4, v * 3 + 9, 3));
        const sheen = clamp01(0.5 + 0.5 * fbm(p, u * 1.4 + 30, v * 1.4, 3));
        return { h, t, g: sheen * 0.42 };
      },
    };
  })(),

  // -- automotive -----------------------------------------------------------
  // Brushed aluminium: noise stretched several hundred times along one axis, so
  // the grain runs in a single direction the way a linished panel does. The
  // grooves are SHALLOW — what makes metal read as metal is a tight specular
  // over a dark base, not deep relief.
  (() => {
    const p = makePerm(0x0a_07_23);
    const q = makePerm(0xc4_11_07);
    return {
      name: "automotive",
      out: SECTOR,
      light: [-0.7, -0.52, 0.49],
      ambient: 0.5,
      ambientTint: [1.0, 1.0, 1.06], // the only cool surface here: metal
      specular: 1.15,
      shininess: 9,
      specColor: CHAMPAGNE,
      colorA: [0xa8, 0xa6, 0xa1], // aluminium: ivory pulled down toward neutral
      colorB: INK,
      vignette: 0.24,
      field(u, v) {
        // Linishing grain: noise stretched ~400x along one axis. The slope has
        // to be real, not decorative — a brushed finish reads entirely through
        // the way these grooves chop the specular into streaks.
        // Grain runs across the tile, the direction a panel is actually linished.
        const brush =
          band(0.62, 220, fbm(p, u * 1.8, v * 360, 3)) +
          band(0.4, 780, fbm(p, u * 3, v * 1300, 2)) +
          band(0.16, 2400, fbm(p, u * 5, v * 4200, 1));
        // Panel undulation, so the reflection has something to bend over.
        // No twill: blocking it into cells printed a visible rectangular grid,
        // which reads as tiled wallpaper and gives the whole tile away.
        const panel = band(0.2, 1.4, fbm(p, u * 1.2 + 3, v * 1.2, 3));

        const t = 0.2 + 0.1 * fbm(q, u * 3, v * 3, 3);
        // ONE warm reflection, and narrow. Spread across the panel it stopped
        // being a reflection and just made the aluminium look like brass.
        const sweep = Math.pow(1 - smoothstep(0, 0.26, Math.abs(u * 0.72 + v * 0.55 - 0.58)), 2);
        return { h: brush + panel, t: clamp01(t), g: sweep * 0.44, d: 0.5, s: 1 };
      },
    };
  })(),

  // -- watches --------------------------------------------------------------
  // Guilloché. A rose-engine lathe cuts by modulating the radius of a circular
  // pass, which is exactly tri(freq * (r + amp * sin(petals * theta))). Triangle
  // waves rather than sine because the cutter leaves flat flanks.
  //
  // The centre sits well OUTSIDE the tile. Placing it inside gave a starburst:
  // the radial barleycorn converged on a point and the rings beat against it
  // into op-art moiré — loud, and exactly what "no neon, no glow" rules out.
  // Pushed off the edge, the same passes read as calm sweeping arcs.
  (() => {
    const p = makePerm(0x77_a7_c4);
    return {
      name: "watches",
      out: SECTOR,
      light: [-0.58, -0.64, 0.5],
      ambient: 0.46,
      specular: 0.95,
      shininess: 11,
      specColor: IVORY,
      colorA: CHAMPAGNE,
      colorB: INK,
      colorC: GOLD,
      vignette: 0.2,
      field(u, v) {
        const cx = (u + 0.62) * 1.66; // undo the 5:3 aspect; centre off-tile
        const cy = v - 0.46;
        const r = Math.hypot(cx, cy);
        const th = Math.atan2(cy, cx);

        // Rose-engine rosette: the radius of each pass is modulated by theta.
        const rosette = r + 0.05 * Math.sin(th * 9) + 0.02 * Math.sin(th * 21 + 1.1);
        const rings = band(0.58, 26, tri(rosette * 118));
        // A finer second pass, slightly out of phase — real dials are layered.
        const fine = band(0.13, 78, tri((r + 0.016 * Math.sin(th * 30)) * 360));
        const wobble = band(0.05, 9, fbm(p, u * 7, v * 7, 3));

        const t = 0.1 + 0.16 * smoothstep(0.35, 1.25, r);
        const g = 0.52 * (1 - smoothstep(0.4, 1.35, r));
        return { h: rings + fine + wobble, t, g, d: 0.52 };
      },
    };
  })(),

  // -- materials ------------------------------------------------------------
  // Torn gold leaf laid over pale limestone. Leaf covers most of the field and
  // the stone shows through where it has torn, not the other way round — sparse
  // gold islands read as camouflage. The look lives in the crinkle: leaf is
  // thinner than paper, so it is all facet and no thickness.
  (() => {
    const p = makePerm(0x6e_a1_10);
    const q = makePerm(0x3b_cc_92);
    return {
      name: "materials",
      out: SECTOR,
      light: [-0.6, -0.6, 0.53],
      ambient: 0.4,
      specular: 1.5,
      shininess: 16, // tight lobe: individual facets flash, rather than a wash
      specColor: CHAMPAGNE,
      vignette: 0.18,
      field(u, v) {
        const stone =
          band(0.22, 5, fbm(p, u * 4.2, v * 4.2, 4)) +
          band(0.14, 28, ridged(p, u * 18, v * 18, 4) - 0.5) +
          band(0.07, 100, fbm(p, u * 80, v * 80, 2));

        // Tear edges: broad shape, then progressively finer detail so the
        // boundary is ragged at every scale the way real leaf is.
        const broad = fbm(q, u * 1.9, v * 1.9, 3);
        const mid = fbm(q, u * 6.5 + 3, v * 6.5 + 7, 3);
        const fineEdge = fbm(q, u * 19 + 11, v * 19 + 2, 2);
        const leaf = smoothstep(-0.34, -0.04, broad + 0.36 * mid + 0.14 * fineEdge);

        // Facets, not stucco. Leaf crumples into flat planes meeting at hard
        // creases, so the slope has to be steep enough to swing a normal right
        // through the specular lobe and back — that flash across a crease is
        // the whole reason gold leaf looks like metal and paint does not.
        const crinkle =
          band(1.15, 11, ridged(q, u * 7, v * 7, 2) - 0.5) +
          band(0.5, 30, ridged(q, u * 21, v * 21, 3) - 0.5) +
          band(0.14, 110, fbm(q, u * 90, v * 90, 2));

        const t = 0.03 + 0.045 * (0.5 + 0.5 * fbm(p, u * 3, v * 3, 3));
        return {
          h: lerp(stone, crinkle + 0.35 * stone, leaf),
          t,
          g: leaf * 0.95,
          d: lerp(1, 0.62, leaf), // leaf is metal: darker diffuse, colour in the reflection
          s: lerp(0.04, 1, leaf), // limestone barely reflects
        };
      },
    };
  })(),

  // -- conglomerate ---------------------------------------------------------
  // Pale marble. Veins come from domain warping: noise sampled at coordinates
  // that have themselves been displaced by noise, which is what produces the
  // folded, geological look instead of smooth blobs. The linear term is kept
  // well above the warp term, otherwise the veins close into contour rings and
  // the tile reads as a topographic map.
  (() => {
    const p = makePerm(0x11_d0_51);
    const q = makePerm(0x8a_3f_44);
    return {
      name: "conglomerate",
      out: SECTOR,
      light: [-0.5, -0.66, 0.56],
      ambient: 0.54,
      specular: 0.1,
      shininess: 36,
      vignette: 0.13,
      field(u, v) {
        const w1 = fbm(p, u * 1.9, v * 1.9, 4);
        const w2 = fbm(p, u * 1.9 + 3.4 * w1 + 5.2, v * 1.9 + 3.4 * w1 + 1.3, 5);

        const band1 = (u * 3.9 + v * 1.5 + w2 * 1.6) * Math.PI;
        const vein = Math.pow(1 - Math.abs(Math.sin(band1)), 11);
        const hair = 0.34 * Math.pow(1 - Math.abs(Math.sin(band1 * 2.7 + 1.4)), 16);

        const gband = (u * 2.6 - v * 1.7 + fbm(q, u * 2.2 + 9, v * 2.2 + 2, 4) * 1.5) * Math.PI;
        const seam = Math.pow(1 - Math.abs(Math.sin(gband)), 26);

        const h =
          band(0.14, 7, fbm(p, u * 6, v * 6, 4)) +
          band(0.3, 6, -vein) +
          band(0.12, 16, -hair) +
          band(0.1, 6, seam);

        const t = clamp01(0.025 + 0.6 * vein + 0.22 * hair);
        return { h, t, g: clamp01(seam * 0.85) };
      },
    };
  })(),

  // -- beauty ---------------------------------------------------------------
  // Loose pigment, swirled. The colour field is sampled at coordinates rotated
  // by an angle that grows with radius, which is what a stirred powder does.
  // Matte: no specular at all, high ambient, almost no relief.
  (() => {
    const p = makePerm(0xbe_a0_77);
    return {
      name: "beauty",
      out: SECTOR,
      light: [-0.42, -0.7, 0.58],
      ambient: 0.66,
      specular: 0,
      vignette: 0.12,
      colorB: CHAMPAGNE, // the dark end is champagne, not ink: nothing harsh
      colorC: GOLD,
      field(u, v) {
        const cx = (u - 0.5) * 1.66;
        const cy = v - 0.5;
        const rad = Math.hypot(cx, cy);
        const ang = Math.atan2(cy, cx) + rad * 2.6 + fbm(p, u * 1.6, v * 1.6, 4) * 1.5;
        const sx = 0.5 + Math.cos(ang) * rad;
        const sy = 0.5 + Math.sin(ang) * rad;

        const swirl = 0.5 + 0.5 * fbm(p, sx * 3.4, sy * 3.4, 5);

        const h =
          band(0.2, 4, swirl) +
          band(0.08, 60, fbm(p, u * 50, v * 50, 3)) +
          band(0.05, 200, fbm(p, u * 170, v * 170, 2));
        const t = clamp01(swirl * 0.85);
        return { h, t, g: clamp01((swirl - 0.62) * 1.5) * 0.38 };
      },
    };
  })(),

  // -- hospitality ----------------------------------------------------------
  // Travertine in late light. The stone is bedded, so the noise is stretched
  // across the horizontal and compressed vertically to give strata; the pitting
  // is a separate thresholded field cut into the surface.
  (() => {
    const p = makePerm(0x40_5e_11);
    const q = makePerm(0x7c_10_8b);
    return {
      name: "hospitality",
      out: SECTOR,
      light: [-0.86, -0.32, 0.39], // low, warm, late afternoon
      ambient: 0.34,
      specular: 0.06,
      shininess: 24,
      colorC: CHAMPAGNE,
      vignette: 0.18,
      field(u, v) {
        const strata =
          band(0.6, 2.6, fbm(p, u * 0.8, v * 2.8, 4)) +
          band(0.34, 8, fbm(p, u * 1.8, v * 8, 3)) +
          band(0.16, 30, ridged(p, u * 20, v * 24, 3) - 0.5);

        // Porosity: only the top of the noise becomes a void, so pits stay
        // sparse, and they are stretched along the bedding the way travertine
        // vugs are. Sampling this isotropically gave an even stipple, which is
        // what made the stone read as smooth plaster.
        const pore = smoothstep(0.5, 0.86, 0.5 + 0.5 * fbm(q, u * 9, v * 26, 3));
        const pit = pore * (0.5 + 0.5 * fbm(q, u * 26 + 5, v * 60 + 2, 2));

        const t = 0.035 + 0.06 * (0.5 + 0.5 * fbm(p, u * 2.4, v * 5, 3));
        const warm = clamp01(0.32 + 0.5 * (0.5 + 0.5 * fbm(p, u * 1.8 + 12, v * 1.8, 3)));
        return { h: strata + band(1.1, 16, -pit), t, g: warm * 0.44 };
      },
    };
  })(),
];

// ---------------------------------------------------------------------------

mkdirSync(OUT_DIR, { recursive: true });

for (const spec of TEXTURES) {
  const started = Date.now();
  const path = await render(spec);
  const kB = Math.round(statSync(path).size / 1024);
  console.log(
    `${spec.name.padEnd(14)} ${String(kB).padStart(4)} kB  ${Date.now() - started} ms`,
  );
}
