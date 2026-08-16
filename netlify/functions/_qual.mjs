// Qualification record — the evidence that says why an uploaded file is worth adopting.
//
// The library saves FILES; this saves WHY THE FILE CAN BE TRUSTED. Without it an upload is
// a filename and a size, which is why a contributed library cannot grow past its author:
// nobody can judge a stranger's fabric. A record does not claim the fabric is accurate —
// it states what was measured, by whom, to what method, and what was left at engine default.
//
// Shared by upload.mjs (writes) and qual.mjs (reads) so the two can never drift apart.

// The ten declared fields. Order is the display order.
export const QUAL_FIELDS = [
  ['supplier', 'Supplier / mill'],
  ['batch', 'Batch / roll'],
  ['composition', 'Composition'],
  ['construction', 'Construction'],
  ['weight', 'Weight (g/m²)'],
  ['testMethod', 'Test method(s)'],
  ['testDate', 'Test date'],
  ['lab', 'Lab / operator'],
  ['cloVersion', 'CLO version'],
  ['basePreset', 'Baseline preset'],
];

// The five inputs a cloth simulator actually consumes. Which of these were physically
// measured — as opposed to left at the engine's default — is the one fact that decides
// whether a record can drive a simulation at all. This is the field competitors omit.
export const ENGINE_INPUTS = ['weight', 'thickness', 'bending', 'stretch', 'shear'];

// Two fields are not optional, and the reason is a dated one: CLO ships 2–3 major versions a
// year, and when it revises the numbers behind its built-in generic library, every delta
// measured against the old library stops being true. A record that names its CLO version and
// its baseline preset can be flagged "measured against a superseded baseline" and re-tested.
// A record without them cannot — it just becomes quietly wrong, with nothing to detect it.
// This is the whole mitigation for that risk, so it has to be enforced, not encouraged.
export const REQUIRED_FIELDS = ['cloVersion', 'basePreset'];

export function missingRequired(rec) {
  if (!rec) return [];
  return REQUIRED_FIELDS.filter((k) => !rec[k]);
}

const clean = (v) => String(v == null ? '' : v).replace(/[\r\n\t\x00-\x1f]/g, ' ').trim().slice(0, 120);

// Everything that arrives from a form is hostile until clamped. Same posture as upload.mjs's
// filename handling: coerce to a known shape rather than trusting what was sent.
export function sanitiseQual(raw) {
  let src = raw;
  if (typeof src === 'string') {
    try { src = JSON.parse(src); } catch { return null; }
  }
  if (!src || typeof src !== 'object' || Array.isArray(src)) return null;

  const rec = {};
  for (const [k] of QUAL_FIELDS) rec[k] = clean(src[k]);
  // A date that is not a date is worse than no date — it looks like provenance.
  if (!/^\d{4}-\d{2}-\d{2}$/.test(rec.testDate)) rec.testDate = '';

  const want = Array.isArray(src.measured) ? src.measured : [];
  rec.measured = ENGINE_INPUTS.filter((x) => want.includes(x));

  return rec;
}

// Two counts, both honest and both cheap to show next to a row.
//   m = engine inputs physically measured (0–5)
//   f = declared fields filled in       (0–10)
export function qualCounts(rec) {
  if (!rec) return null;
  const f = QUAL_FIELDS.reduce((n, [k]) => n + (rec[k] ? 1 : 0), 0);
  return { m: (rec.measured || []).length, f };
}

export function isEmptyQual(rec) {
  const c = qualCounts(rec);
  return !c || (c.m === 0 && c.f === 0);
}
