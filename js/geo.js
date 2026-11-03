// Sphere math. Points are [lat, lon] in degrees unless a name says otherwise.
const D = Math.PI / 180;

export const vec = ([lat, lon]) => {
  const p = lat * D, l = lon * D;
  return [Math.cos(p) * Math.cos(l), Math.cos(p) * Math.sin(l), Math.sin(p)];
};
export const ll = ([x, y, z]) => [Math.atan2(z, Math.hypot(x, y)) / D, Math.atan2(y, x) / D];

const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = a => { const n = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / n, a[1] / n, a[2] / n]; };

/** Angle between two points, radians. */
export const arcRad = (a, b) => {
  const A = vec(a), B = vec(b);
  return Math.atan2(Math.hypot(...cross(A, B)), dot(A, B));
};
export const km = (a, b) => arcRad(a, b) * 6371;

/** Great-circle interpolation between two points. */
export function slerp(a, b, t) {
  const A = vec(a), B = vec(b);
  const w = Math.acos(Math.max(-1, Math.min(1, dot(A, B))));
  if (w < 1e-9) return a.slice();
  const s = Math.sin(w), k0 = Math.sin((1 - t) * w) / s, k1 = Math.sin(t * w) / s;
  return ll([A[0] * k0 + B[0] * k1, A[1] * k0 + B[1] * k1, A[2] * k0 + B[2] * k1]);
}

/**
 * A route as a function of progress f in [0,1]: the great circle from a to b, pushed sideways by
 * `bulge` radians at the middle (positive = to the right of the direction of travel). The pushed
 * arc keeps a there-and-back pair, or the fifth Atlanta hop, visibly apart from the others.
 */
export function makeArc(a, b, bulge = 0) {
  const A = vec(a), B = vec(b);
  const w = Math.acos(Math.max(-1, Math.min(1, dot(A, B))));
  const N = norm(cross(A, B));
  const at = f => {
    let P;
    if (w < 1e-9) P = A;
    else {
      const s = Math.sin(w), k0 = Math.sin((1 - f) * w) / s, k1 = Math.sin(f * w) / s;
      P = [A[0] * k0 + B[0] * k1, A[1] * k0 + B[1] * k1, A[2] * k0 + B[2] * k1];
    }
    if (bulge) {
      const h = -bulge * Math.sin(Math.PI * f);
      P = norm([P[0] + N[0] * h, P[1] + N[1] * h, P[2] + N[2] * h]);
    }
    return ll(P);
  };
  return { at, rad: w };
}

/** Sample an arc into [lon, lat] coordinates with continuous longitude (no jump at the antimeridian). */
export function sampleArc(arc, n, upTo = 1) {
  const out = [];
  let prev = null;
  const push = p => {
    let lon = p[1];
    if (prev !== null) { while (lon - prev > 180) lon -= 360; while (lon - prev < -180) lon += 360; }
    prev = lon;
    out.push([lon, p[0]]);
  };
  const last = Math.floor(upTo * n);
  for (let i = 0; i <= last; i++) push(arc.at(i / n));
  if (upTo * n > last && upTo < 1) push(arc.at(upTo));
  return out;
}

export const lonLat = p => [p[1], p[0]];
export const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
export const smooth = t => t * t * (3 - 2 * t);
export const ease = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2) * 0.55 + smooth(t) * 0.45;

/**
 * van Wijk & Nuij "smooth and efficient zooming and panning", the same curve MapLibre's flyTo uses,
 * but walked along the sphere so a Pacific crossing takes the short way. Widths are in screen px.
 * Returns S (path length) and at(k) -> { u: 0..1 progress of the centre, z: zoom } for k in [0,1].
 */
export function flyCurve(c0, z0, c1, z1, viewPx, rho = 1.42) {
  const rho2 = rho * rho;
  const pxPerRad = 512 * Math.pow(2, z0) / (2 * Math.PI);
  const u1 = arcRad(c0, c1) * pxPerRad;
  const w0 = viewPx, w1 = w0 / Math.pow(2, z1 - z0);
  if (u1 < 0.5) {
    const k = w1 < w0 ? -1 : 1, S = Math.abs(Math.log(w1 / w0)) / rho;
    return { S, at: t => ({ u: t, z: z0 + (z1 - z0) * t }) };
  }
  const b = i => (w1 * w1 - w0 * w0 + (i ? -1 : 1) * rho2 * rho2 * u1 * u1) / (2 * (i ? w1 : w0) * rho2 * u1);
  const r = i => Math.log(Math.sqrt(b(i) * b(i) + 1) - b(i));
  const r0 = r(0), S = (r(1) - r0) / rho;
  const wOf = s => Math.cosh(r0) / Math.cosh(r0 + rho * s);
  const uOf = s => w0 * ((Math.cosh(r0) * Math.tanh(r0 + rho * s) - Math.sinh(r0)) / rho2) / u1;
  return {
    S,
    at: t => (t >= 1 ? { u: 1, z: z1 } : { u: uOf(t * S), z: z0 + Math.log2(1 / wOf(t * S)) }),
  };
}

/** Zoom at which `distKm` fills `frac` of a `viewPx` wide view at latitude `lat`. */
export function zoomToFit(distKm, viewPx, lat = 0, frac = 0.55) {
  const d = Math.max(distKm, 1);
  return Math.log2((frac * viewPx * 40075 * Math.cos(lat * D)) / (512 * d));
}
