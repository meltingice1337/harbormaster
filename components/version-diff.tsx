import { Fragment } from "react";

type Segment = { text: string; diff: boolean };

// Versions get tokenized on these separators. Separators themselves are
// preserved in the segment list so the original string can be reconstructed
// (e.g. "v1.12.1" → ["v1", ".", "12", ".", "1"]).
const SPLIT_RE = /([.\-_+])/;

export function versionSegments(value: string, compareTo: string | null): Segment[] {
  if (!compareTo || compareTo === value || value === "?" || compareTo === "?") {
    return [{ text: value, diff: false }];
  }
  const a = value.split(SPLIT_RE);
  const b = compareTo.split(SPLIT_RE);
  const out: Segment[] = [];
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const ap = a[i] ?? "";
    const bp = b[i] ?? "";
    const isSeparator = i % 2 === 1;
    if (!ap) continue;
    if (isSeparator || ap === bp) {
      out.push({ text: ap, diff: false });
    } else {
      out.push({ text: ap, diff: true });
    }
  }
  return collapse(out);
}

function collapse(segs: Segment[]): Segment[] {
  // Merge adjacent same-kind segments so the rendered DOM has one <mark> per
  // contiguous diff region instead of one per token.
  const out: Segment[] = [];
  for (const s of segs) {
    const last = out[out.length - 1];
    if (last && last.diff === s.diff) {
      last.text += s.text;
    } else {
      out.push({ ...s });
    }
  }
  return out;
}

type Props = {
  value: string;
  compareTo: string | null;
  diffClassName?: string;
};

export function VersionDiff({
  value,
  compareTo,
  diffClassName = "bg-amber-500/25 text-amber-200 rounded px-0.5",
}: Props) {
  const segs = versionSegments(value, compareTo);
  return (
    <>
      {segs.map((s, i) =>
        s.diff ? (
          <mark key={i} className={diffClassName}>
            {s.text}
          </mark>
        ) : (
          <Fragment key={i}>{s.text}</Fragment>
        ),
      )}
    </>
  );
}
