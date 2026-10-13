// Lenient GEDCOM DATE → DateNorm. Exact/partial/dual dates yield {} (the
// raw string stays authoritative); modifiers, ranges, and calendar markers
// are extracted best-effort. Unknown shapes → {} rather than an error.

import type { DateNorm } from "../domain/types";

const CAL_ESCAPE = /^@#D([A-Za-z_ ]+)@\s*/;
const CAL_WORD = /^(GREGORIAN|JULIAN|HEBREW|FRENCH\s+R|ROMAN|UNKNOWN|ISLAMIC)\s+/i;
const MODIFIER = /^(ABT|CAL|EST|BEF|AFT)\s+(.+)$/i;
const BET = /^BET\s+(.+?)\s+AND\s+(.+)$/i;
const FROM_TO = /^FROM\s+(.+?)\s+TO\s+(.+)$/i;
const FROM = /^FROM\s+(.+)$/i;
const TO = /^TO\s+(.+)$/i;

function calendarOf(s: string): { calendar?: string; rest: string } {
  const esc = CAL_ESCAPE.exec(s);
  if (esc) return { calendar: esc[1]!.trim().toUpperCase(), rest: s.slice(esc[0].length) };
  const word = CAL_WORD.exec(s);
  if (word) return { calendar: word[1]!.replace(/\s+/g, " ").toUpperCase(), rest: s.slice(word[0].length) };
  return { rest: s };
}

export function parseGEDCOMDate(raw: string): DateNorm {
  const s = raw.trim();
  if (s === "") return {};
  const { calendar, rest } = calendarOf(s);
  const base = calendar ? { calendar } : {};
  const bet = BET.exec(rest);
  if (bet) return { ...base, qualifier: "BET", range: { from: bet[1]!.trim(), to: bet[2]!.trim() } };
  const fromTo = FROM_TO.exec(rest);
  if (fromTo) return { ...base, qualifier: "FROM", range: { from: fromTo[1]!.trim(), to: fromTo[2]!.trim() } };
  const from = FROM.exec(rest);
  if (from) return { ...base, qualifier: "FROM", range: { from: from[1]!.trim() } };
  const to = TO.exec(rest);
  if (to) return { ...base, qualifier: "TO", range: { to: to[1]!.trim() } };
  const mod = MODIFIER.exec(rest);
  if (mod) return { ...base, qualifier: mod[1]!.toUpperCase() as DateNorm["qualifier"] };
  return base;
}
