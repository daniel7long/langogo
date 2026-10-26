// Splits a dialogue line into plain and tappable parts.
// glosses: [{ text, pos, meaning }]. The first occurrence of each gloss text becomes tappable.
// Returns [{ text, gloss }] where gloss is null for plain parts.
export function splitByGlosses(text, glosses = []) {
  const hits = [];
  for (const g of glosses) {
    const start = text.indexOf(g.text);
    if (start === -1) continue;
    const end = start + g.text.length;
    if (hits.some((h) => start < h.end && end > h.start)) continue; // skip overlaps
    hits.push({ start, end, gloss: g });
  }
  hits.sort((a, b) => a.start - b.start);

  const parts = [];
  let pos = 0;
  for (const h of hits) {
    if (h.start > pos) parts.push({ text: text.slice(pos, h.start), gloss: null });
    parts.push({ text: text.slice(h.start, h.end), gloss: h.gloss });
    pos = h.end;
  }
  if (pos < text.length) parts.push({ text: text.slice(pos), gloss: null });
  return parts.length ? parts : [{ text, gloss: null }];
}
