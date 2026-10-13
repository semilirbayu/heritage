// Lenient GEDCOM line lexer: `Level [Xref] Tag [Value]`.
// Never drops content: unparseable lines survive as _TEXT continuations,
// level jumps are clamped (flagged), CONC joins and CONT adds a newline.

export interface GedLine {
  level: number;
  xref?: string;
  tag: string;
  value: string;
  /** True when the original level jumped and was clamped to parent+1. */
  clamped?: boolean;
}

const LINE_RE = /^(\d+)\s+(?:@([^@\s]+)@\s+)?([A-Za-z0-9_]+)(?:[ \t](.*))?$/;

export function parseLines(text: string): GedLine[] {
  const out: GedLine[] = [];
  let prevLevel = -1;
  for (const raw of text.split(/\r\n|\r|\n/)) {
    if (raw.trim() === "") continue;
    const line = raw.trimStart();
    const m = LINE_RE.exec(line);
    if (!m) {
      // Malformed but content-bearing: keep as continuation text.
      const host = out[out.length - 1];
      if (host) host.value += `\n${line}`;
      else out.push({ level: 0, tag: "_TEXT", value: line, clamped: true });
      continue;
    }
    const level = Number(m[1]);
    const tag = m[3]!;
    const value = m[4] ?? "";
    if ((tag === "CONC" || tag === "CONT") && out.length > 0) {
      const host = out[out.length - 1]!;
      host.value += tag === "CONC" ? value : `\n${value}`;
      // A CONT/CONC line's level still advances the nesting cursor.
      prevLevel = level;
      continue;
    }
    let clamped = false;
    let finalLevel = level;
    if (level > prevLevel + 1) {
      finalLevel = prevLevel + 1;
      clamped = true;
    }
    out.push({
      level: finalLevel,
      ...(m[2] ? { xref: m[2] } : {}),
      tag,
      value,
      ...(clamped ? { clamped: true } : {}),
    });
    prevLevel = finalLevel;
  }
  return out;
}
