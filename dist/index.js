// @bun
// src/domain/tree.ts
function newId(prefix) {
  return `${prefix}_${crypto.randomUUID()}`;
}
function emptyTree() {
  return { persons: [], families: [], notes: [], sources: [], media: [] };
}
function newEvent(input) {
  return {
    id: newId("e"),
    type: input.type,
    dateRaw: input.dateRaw,
    place: input.placeRaw ? { raw: input.placeRaw } : undefined,
    noteIds: [],
    mediaIds: [],
    sources: [],
    extensions: {}
  };
}
function displayName(input) {
  if (input.display)
    return input.display;
  return [input.given, input.surname].filter(Boolean).join(" ");
}
function createPerson(input) {
  const names = [
    {
      display: displayName(input),
      given: input.given,
      surname: input.surname
    }
  ];
  return {
    id: newId("p"),
    names,
    sex: input.sex ?? "U",
    events: [],
    biography: "",
    researchNotes: [],
    famc: [],
    fams: [],
    isLiving: input.isLiving ?? true,
    private: false,
    mediaIds: [],
    sources: [],
    externalIds: [],
    extensions: {}
  };
}
function createFamily(input) {
  return {
    id: newId("f"),
    partners: input.partners ?? [],
    children: [],
    extensions: {}
  };
}
function addChild(input) {
  const { family, childId, parent, child } = input;
  const nextFamily = {
    ...family,
    children: family.children.includes(childId) ? family.children : [...family.children, childId]
  };
  const updatedParent = {
    ...parent,
    fams: parent.fams.includes(family.id) ? parent.fams : [...parent.fams, family.id]
  };
  const updatedChild = child ? {
    ...child,
    famc: child.famc.some((l) => l.familyId === family.id) ? child.famc : [...child.famc, { familyId: family.id }]
  } : undefined;
  return { family: nextFamily, updatedParent, updatedChild };
}
function updatePerson(person, patch) {
  const primary = person.names[0] ?? { display: "" };
  const given = patch.given ?? primary.given;
  const surname = patch.surname ?? primary.surname;
  const touchesName = patch.given !== undefined || patch.surname !== undefined || patch.display !== undefined;
  const nextPrimary = {
    ...primary,
    given,
    surname,
    prefix: patch.prefix ?? primary.prefix,
    suffix: patch.suffix ?? primary.suffix,
    nick: patch.nick ?? primary.nick,
    display: touchesName ? patch.display ?? [given, surname].filter(Boolean).join(" ") : primary.display
  };
  return {
    ...person,
    names: [nextPrimary, ...person.names.slice(1)],
    sex: patch.sex ?? person.sex,
    biography: patch.biography ?? person.biography,
    private: patch.private ?? person.private
  };
}
function setDeceased(person, input) {
  const hasDeat = person.events.some((e) => e.type === "DEAT");
  const death = newEvent({ type: "DEAT", ...input });
  if (input.cause !== undefined)
    death.cause = input.cause;
  return {
    ...person,
    isLiving: false,
    events: hasDeat ? person.events : [...person.events, death]
  };
}
function setLiving(person) {
  return {
    ...person,
    isLiving: true,
    events: person.events.filter((e) => e.type !== "DEAT")
  };
}
function addResearchNote(person, text) {
  return { ...person, researchNotes: [...person.researchNotes, text] };
}
function linkFams(person, familyId) {
  return {
    ...person,
    fams: person.fams.includes(familyId) ? person.fams : [...person.fams, familyId]
  };
}
function linkFamc(person, link) {
  const existing = person.famc.find((l) => l.familyId === link.familyId);
  if (!existing)
    return { ...person, famc: [...person.famc, link] };
  if (existing.pedi === link.pedi)
    return person;
  return {
    ...person,
    famc: person.famc.map((l) => l.familyId === link.familyId ? { ...l, pedi: link.pedi } : l)
  };
}
function addParent(input) {
  const base = input.family ?? createFamily({ partners: [] });
  const family = {
    ...base,
    partners: base.partners.includes(input.parent.id) ? base.partners : [...base.partners, input.parent.id],
    children: base.children.includes(input.child.id) ? base.children : [...base.children, input.child.id]
  };
  return {
    family,
    updatedChild: linkFamc(input.child, {
      familyId: family.id,
      pedi: input.pedi
    }),
    updatedParent: linkFams(input.parent, family.id)
  };
}
function addSibling(input) {
  const family = {
    ...input.family,
    children: input.family.children.includes(input.siblingId) ? input.family.children : [...input.family.children, input.siblingId]
  };
  const updatedSibling = input.sibling ? linkFamc(input.sibling, { familyId: family.id, pedi: input.pedi }) : undefined;
  return { family, updatedSibling };
}
function addPartner(input) {
  const base = input.family ?? createFamily({ partners: [] });
  const partners = [...base.partners];
  for (const id of [input.a.id, input.b.id]) {
    if (!partners.includes(id))
      partners.push(id);
  }
  const family = { ...base, partners };
  return {
    family,
    updatedA: linkFams(input.a, family.id),
    updatedB: linkFams(input.b, family.id)
  };
}
function detachChild(input) {
  const family = {
    ...input.family,
    children: input.family.children.filter((c) => c !== input.childId)
  };
  const updatedChild = input.child ? {
    ...input.child,
    famc: input.child.famc.filter((l) => l.familyId !== family.id)
  } : undefined;
  return { family, updatedChild };
}
function detachPartner(input) {
  const family = {
    ...input.family,
    partners: input.family.partners.filter((p) => p !== input.partnerId)
  };
  const updatedPartner = input.partner ? {
    ...input.partner,
    fams: input.partner.fams.filter((f) => f !== family.id)
  } : undefined;
  return { family, updatedPartner };
}
function setDivorce(input) {
  if (input.family.divorce) {
    return {
      family: input.family,
      updatedA: input.partnerA,
      updatedB: input.partnerB
    };
  }
  const divorce = newEvent({ type: "DIV", ...input });
  const mirror = (p) => p.events.some((e) => e.id === divorce.id || e.type === "DIV") ? p : { ...p, events: [...p.events, { ...divorce }] };
  return {
    family: { ...input.family, divorce },
    updatedA: mirror(input.partnerA),
    updatedB: mirror(input.partnerB)
  };
}
function setMarriage(input) {
  if (input.family.marriage) {
    return {
      family: input.family,
      updatedA: input.partnerA,
      updatedB: input.partnerB
    };
  }
  const marriage = newEvent({ type: "MARR", ...input });
  const mirror = (p) => p.events.some((e) => e.id === marriage.id || e.type === "MARR") ? p : { ...p, events: [...p.events, { ...marriage }] };
  return {
    family: { ...input.family, marriage },
    updatedA: mirror(input.partnerA),
    updatedB: mirror(input.partnerB)
  };
}
function preferredEvent(events, type) {
  return events.find((e) => e.type === type);
}
function preferredName(person) {
  return person.names[0]?.display ?? "";
}
function kinOf(tree, person) {
  const byId = new Map(tree.persons.map((p) => [p.id, p]));
  const mine = tree.families.filter((f) => person.fams.includes(f.id));
  const fromFamc = tree.families.filter((f) => person.famc.some((l) => l.familyId === f.id));
  const pick = (ids) => {
    const seen = new Set;
    const out = [];
    for (const id of ids) {
      const p = byId.get(id);
      if (p && !seen.has(id)) {
        seen.add(id);
        out.push(p);
      }
    }
    return out;
  };
  return {
    parents: pick(fromFamc.flatMap((f) => f.partners)),
    partners: pick(mine.flatMap((f) => f.partners).filter((id) => id !== person.id)),
    children: pick(mine.flatMap((f) => f.children))
  };
}
function addFact(person, input) {
  const fact = {
    ...newEvent({ type: input.type, dateRaw: input.dateRaw }),
    place: input.placeRaw ? { raw: input.placeRaw } : undefined,
    noteIds: input.noteIds ?? [],
    mediaIds: input.mediaIds ?? [],
    sources: input.sources ?? []
  };
  return { person: { ...person, events: [...person.events, fact] }, fact };
}
function updateFact(person, factId, patch) {
  return {
    ...person,
    events: person.events.map((e) => e.id !== factId ? e : {
      ...e,
      type: patch.type ?? e.type,
      dateRaw: patch.dateRaw ?? e.dateRaw,
      cause: patch.cause ?? e.cause,
      place: patch.placeRaw !== undefined ? { raw: patch.placeRaw } : e.place,
      noteIds: patch.noteIds ?? e.noteIds,
      mediaIds: patch.mediaIds ?? e.mediaIds,
      sources: patch.sources ?? e.sources
    })
  };
}
function deleteFact(person, factId) {
  return { ...person, events: person.events.filter((e) => e.id !== factId) };
}
// src/domain/media.ts
var SIDECAR_DIR = "media";
function addMedia(tree, input) {
  const media = {
    id: newId("m"),
    path: input.path,
    ...input.mime ? { mime: input.mime } : {},
    ...input.title ? { title: input.title } : {},
    ...input.dateRaw ? { dateRaw: input.dateRaw } : {},
    ...input.placeRaw ? { place: { raw: input.placeRaw } } : {}
  };
  return { tree: { ...tree, media: [...tree.media, media] }, media };
}
function setPersonalPhoto(person, mediaId) {
  return { ...person, mediaIds: [mediaId, ...person.mediaIds.filter((m) => m !== mediaId)] };
}
function personalPhoto(person, tree) {
  const first = person.mediaIds[0];
  if (!first)
    return;
  return tree.media.find((m) => m.id === first);
}
function resolveMediaPath(stored) {
  if (/^([a-z]+:)?\/\//i.test(stored) || stored.startsWith("/") || stored === SIDECAR_DIR || stored.startsWith(`${SIDECAR_DIR}/`)) {
    return stored;
  }
  return `${SIDECAR_DIR}/${stored}`;
}
// src/gedcom/decode.ts
function decodeGedcom(bytes) {
  if (bytes.length >= 3 && bytes[0] === 239 && bytes[1] === 187 && bytes[2] === 191) {
    return {
      text: new TextDecoder("utf-8").decode(bytes.slice(3)),
      encoding: "UTF-8",
      hadBom: true
    };
  }
  if (bytes.length >= 2 && bytes[0] === 255 && bytes[1] === 254) {
    return {
      text: new TextDecoder("utf-16le").decode(bytes.slice(2)),
      encoding: "UTF-16LE",
      hadBom: true
    };
  }
  if (bytes.length >= 2 && bytes[0] === 254 && bytes[1] === 255) {
    return {
      text: new TextDecoder("utf-16be").decode(bytes.slice(2)),
      encoding: "UTF-16BE",
      hadBom: true
    };
  }
  try {
    return {
      text: new TextDecoder("utf-8", { fatal: true }).decode(bytes),
      encoding: "UTF-8",
      hadBom: false
    };
  } catch {
    return {
      text: new TextDecoder("windows-1252").decode(bytes),
      encoding: "WINDOWS-1252",
      hadBom: false
    };
  }
}
// src/gedcom/lines.ts
var LINE_RE = /^(\d+)\s+(?:@([^@\s]+)@\s+)?([A-Za-z0-9_]+)(?:[ \t](.*))?$/;
function parseLines(text) {
  const out = [];
  let prevLevel = -1;
  for (const raw of text.split(/\r\n|\r|\n/)) {
    if (raw.trim() === "")
      continue;
    const line = raw.trimStart();
    const m = LINE_RE.exec(line);
    if (!m) {
      const host = out[out.length - 1];
      if (host)
        host.value += `
${line}`;
      else
        out.push({ level: 0, tag: "_TEXT", value: line, clamped: true });
      continue;
    }
    const level = Number(m[1]);
    const tag = m[3];
    const value = m[4] ?? "";
    if ((tag === "CONC" || tag === "CONT") && out.length > 0) {
      const host = out[out.length - 1];
      host.value += tag === "CONC" ? value : `
${value}`;
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
      ...m[2] ? { xref: m[2] } : {},
      tag,
      value,
      ...clamped ? { clamped: true } : {}
    });
    prevLevel = finalLevel;
  }
  return out;
}
// src/gedcom/date.ts
var CAL_ESCAPE = /^@#D([A-Za-z_ ]+)@\s*/;
var CAL_WORD = /^(GREGORIAN|JULIAN|HEBREW|FRENCH\s+R|ROMAN|UNKNOWN|ISLAMIC)\s+/i;
var MODIFIER = /^(ABT|CAL|EST|BEF|AFT)\s+(.+)$/i;
var BET = /^BET\s+(.+?)\s+AND\s+(.+)$/i;
var FROM_TO = /^FROM\s+(.+?)\s+TO\s+(.+)$/i;
var FROM = /^FROM\s+(.+)$/i;
var TO = /^TO\s+(.+)$/i;
function calendarOf(s) {
  const esc = CAL_ESCAPE.exec(s);
  if (esc)
    return { calendar: esc[1].trim().toUpperCase(), rest: s.slice(esc[0].length) };
  const word = CAL_WORD.exec(s);
  if (word)
    return { calendar: word[1].replace(/\s+/g, " ").toUpperCase(), rest: s.slice(word[0].length) };
  return { rest: s };
}
function parseGEDCOMDate(raw) {
  const s = raw.trim();
  if (s === "")
    return {};
  const { calendar, rest } = calendarOf(s);
  const base = calendar ? { calendar } : {};
  const bet = BET.exec(rest);
  if (bet)
    return { ...base, qualifier: "BET", range: { from: bet[1].trim(), to: bet[2].trim() } };
  const fromTo = FROM_TO.exec(rest);
  if (fromTo)
    return { ...base, qualifier: "FROM", range: { from: fromTo[1].trim(), to: fromTo[2].trim() } };
  const from = FROM.exec(rest);
  if (from)
    return { ...base, qualifier: "FROM", range: { from: from[1].trim() } };
  const to = TO.exec(rest);
  if (to)
    return { ...base, qualifier: "TO", range: { to: to[1].trim() } };
  const mod = MODIFIER.exec(rest);
  if (mod)
    return { ...base, qualifier: mod[1].toUpperCase() };
  return base;
}
// src/gedcom/import.ts
var EVENT_TAGS = new Set([
  "BIRT",
  "CHR",
  "DEAT",
  "BURI",
  "CREM",
  "ADOP",
  "BAPM",
  "BARM",
  "BASM",
  "BLES",
  "CHRA",
  "CONF",
  "FCOM",
  "ORDN",
  "NATU",
  "EMIG",
  "IMMI",
  "CENS",
  "PROB",
  "WILL",
  "GRAD",
  "RETI",
  "OCCU",
  "EDUC",
  "RELI",
  "DSCR",
  "IDNO",
  "NATI",
  "CAST",
  "EVEN",
  "FACT"
]);
var DEATH_TAGS = new Set(["DEAT", "BURI", "CREM"]);
var FORM_MIME = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  bmp: "image/bmp",
  tif: "image/tiff",
  tiff: "image/tiff",
  pdf: "application/pdf",
  mp3: "audio/mpeg",
  mp4: "video/mp4",
  wav: "audio/wav"
};
function nest(lines, from, level) {
  const nodes = [];
  let i = from;
  while (i < lines.length && lines[i].level > level) {
    if (lines[i].level !== level + 1) {
      i++;
      continue;
    }
    const inner = nest(lines, i + 1, level + 1);
    nodes.push({ line: lines[i], kids: inner.nodes });
    i = inner.next;
  }
  return { nodes, next: i };
}
function ptr(value) {
  const m = /^@([^@]+)@$/.exec(value.trim());
  return m ? m[1] : undefined;
}
function kidValue(kids, tag) {
  return kids.find((k) => k.line.tag === tag)?.line.value;
}
function foldUnknown(prefix, kids, extensions) {
  for (const k of kids) {
    extensions[`${prefix}.${k.line.tag}`] = k.line.value;
    if (k.kids.length > 0)
      foldUnknown(`${prefix}.${k.line.tag}`, k.kids, extensions);
  }
}
function mapPedi(raw) {
  if (!raw)
    return;
  const v = raw.trim().toUpperCase();
  if (v === "ADOPTED")
    return "adoptive";
  if (v === "FOSTER")
    return "foster";
  if (v === "BIRTH")
    return "biological";
  return;
}
function parseName(value, kids) {
  const display = value.replace(/\//g, "").replace(/\s+/g, " ").trim();
  const slash = /^(.*?)\/([^/]*)\/?(.*)$/.exec(value);
  const givn = kidValue(kids, "GIVN");
  const surn = kidValue(kids, "SURN");
  const spfx = kidValue(kids, "SPFX");
  let given = givn;
  let surname = surn;
  if (slash) {
    given ??= slash[1].trim() || undefined;
    surname ??= slash[2].trim() || undefined;
  } else if (!givn && !surn) {
    given = display || undefined;
  }
  if (spfx && surname && !surname.startsWith(spfx))
    surname = `${spfx} ${surname}`;
  else if (spfx && !surname)
    surname = spfx;
  const primary = {
    display: display || [given, surname].filter(Boolean).join(" "),
    ...given ? { given } : {},
    ...surname ? { surname } : {},
    ...["NPFX", "NSFX", "NICK"].reduce((acc, t) => {
      const v = kidValue(kids, t);
      if (v !== undefined)
        acc[t === "NPFX" ? "prefix" : t === "NSFX" ? "suffix" : "nick"] = v;
      return acc;
    }, {})
  };
  return primary;
}
function normalizeSex(value) {
  const c = value.trim().toUpperCase().charAt(0);
  if (c === "M")
    return "M";
  if (c === "F")
    return "F";
  if (c === "X")
    return "X";
  return "U";
}
function importGedcom(input) {
  const warnings = [];
  const warn = (code, message) => {
    warnings.push({ code, message });
  };
  let text;
  let encoding;
  let hadBom;
  if (typeof input === "string") {
    text = input;
    encoding = "UTF-8";
    hadBom = false;
  } else {
    ({ text, encoding, hadBom } = decodeGedcom(input));
  }
  const lines = parseLines(text);
  for (const l of lines) {
    if (l.clamped)
      warn("level-clamp", `Clamped level for ${l.tag} "${l.value.slice(0, 40)}"`);
  }
  const records = [];
  let current = null;
  let body = [];
  const flush = () => {
    if (current)
      records.push({ ...current, kids: nest(body, 0, 0).nodes });
  };
  for (const l of lines) {
    if (l.level === 0) {
      flush();
      current = { tag: l.tag, kids: [], value: l.value };
      if (l.xref)
        current.xref = l.xref;
      if (l.value && l.tag !== "NOTE" && l.tag !== "SNOTE") {
        warn("level0-value", `Level-0 ${l.tag} carries a value, kept as extension`);
      }
      body = [];
    } else if (current) {
      body.push(l);
    } else {
      current = { tag: "_LEAD", kids: [], value: "" };
      body = [l];
    }
  }
  flush();
  if (records.length === 0 || records[records.length - 1].tag !== "TRLR") {
    warn("missing-trailer", "No trailing 0 TRLR record; imported anyway");
  }
  let version = "unknown";
  const head = records.find((r) => r.tag === "HEAD");
  if (head) {
    const gedc = head.kids.find((k) => k.line.tag === "GEDC");
    const vers = gedc ? kidValue(gedc.kids, "VERS") : undefined;
    if (vers) {
      version = vers.trim();
    } else {
      warn("missing-version", "HEAD.GEDC.VERS missing; version unknown");
    }
    const char = kidValue(head.kids, "CHAR");
    if (char && encoding === "WINDOWS-1252" && char.toUpperCase().includes("UTF")) {
      warn("encoding-fallback", `HEAD.CHAR says ${char} but bytes are not valid UTF-8; fell back to WINDOWS-1252`);
    }
  } else {
    warn("missing-header", "No 0 HEAD record");
  }
  const tree = emptyTree();
  const personsByXref = new Map;
  const familiesByXref = new Map;
  const notesByXref = new Map;
  const sourcesByXref = new Map;
  const mediaByXref = new Map;
  const claimXref = (kind, xref) => {
    if (!xref)
      return true;
    const exists = personsByXref.has(xref) || familiesByXref.has(xref) || notesByXref.has(xref) || sourcesByXref.has(xref) || mediaByXref.has(xref);
    if (exists) {
      warn("duplicate-xref", `Duplicate @${xref}@ (${kind}); first record wins`);
      return false;
    }
    return true;
  };
  const addNote = (text2, shared) => {
    const note = { id: newId("n"), text: text2, shared };
    tree.notes.push(note);
    return note;
  };
  for (const r of records) {
    if (!r.xref)
      continue;
    if (r.tag === "NOTE" || r.tag === "SNOTE") {
      if (!claimXref(r.tag, r.xref))
        continue;
      const note = { id: newId("n"), text: r.value, shared: true };
      notesByXref.set(r.xref, note);
      tree.notes.push(note);
    } else if (r.tag === "SOUR") {
      if (!claimXref("SOUR", r.xref))
        continue;
      const source = { id: newId("s"), title: kidValue(r.kids, "TITL") ?? "" };
      sourcesByXref.set(r.xref, source);
      tree.sources.push(source);
    } else if (r.tag === "REPO") {
      if (!claimXref("REPO", r.xref))
        continue;
      const source = { id: newId("s"), title: kidValue(r.kids, "NAME") ?? "" };
      sourcesByXref.set(r.xref, source);
      tree.sources.push(source);
    } else if (r.tag === "OBJE") {
      if (!claimXref("OBJE", r.xref))
        continue;
      const media = mediaFromKids(r.kids, r.xref);
      mediaByXref.set(r.xref, media);
      tree.media.push(media);
    }
  }
  function mediaFromKids(kids, context) {
    const fileNode = kids.find((k) => k.line.tag === "FILE");
    const file = fileNode?.line.value ?? "";
    const form = ((fileNode && kidValue(fileNode.kids, "FORM")) ?? kidValue(kids, "FORM") ?? "").toLowerCase();
    if (file === "")
      warn("empty-obje", `OBJE${context ? ` @${context}@` : ""} without FILE path`);
    return {
      id: newId("m"),
      path: file,
      mime: FORM_MIME[form] ?? (form || undefined),
      title: kidValue(kids, "TITL")
    };
  }
  const resolveNote = (node, owner) => {
    const target = ptr(node.line.value);
    if (target) {
      const note = notesByXref.get(target);
      if (note)
        owner.noteIds.push(note.id);
      else
        warn("dangling-pointer", `NOTE @${target}@ not found`);
    } else {
      owner.noteIds.push(addNote(node.line.value, false).id);
    }
  };
  const resolvePersonNote = (node, person) => {
    const target = ptr(node.line.value);
    if (target) {
      const note = notesByXref.get(target);
      if (note)
        person.researchNotes.push(note.text);
      else
        warn("dangling-pointer", `NOTE @${target}@ not found`);
    } else {
      person.researchNotes.push(node.line.value);
    }
  };
  const resolveSource = (node, owner, extKey) => {
    const target = ptr(node.line.value);
    if (!target) {
      owner.extensions[extKey] = node.line.value;
      return;
    }
    const source = sourcesByXref.get(target);
    if (!source) {
      warn("dangling-pointer", `SOUR @${target}@ not found`);
      return;
    }
    owner.sources.push({
      sourceId: source.id,
      ...kidValue(node.kids, "PAGE") ? { page: kidValue(node.kids, "PAGE") } : {}
    });
  };
  const resolveMedia = (node, owner) => {
    const target = ptr(node.line.value);
    if (target) {
      const media2 = mediaByXref.get(target);
      if (media2)
        owner.mediaIds.push(media2.id);
      else
        warn("dangling-pointer", `OBJE @${target}@ not found`);
      return;
    }
    if (node.kids.every((k) => k.line.tag !== "FILE")) {
      warn("empty-obje", "OBJE without pointer or FILE; skipped");
      return;
    }
    const media = mediaFromKids(node.kids, undefined);
    tree.media.push(media);
    owner.mediaIds.push(media.id);
  };
  const buildEvent = (node) => {
    const tag = node.line.tag;
    const type = (tag === "EVEN" || tag === "FACT" ? kidValue(node.kids, "TYPE") : undefined) ?? tag;
    const event = newEvent({ type });
    for (const k of node.kids) {
      const t = k.line.tag;
      if (t === "DATE") {
        event.dateRaw = k.line.value;
        const norm = parseGEDCOMDate(k.line.value);
        if (Object.keys(norm).length > 0)
          event.dateNorm = norm;
      } else if (t === "PLAC") {
        event.place = { raw: k.line.value };
      } else if (t === "CAUS") {
        event.cause = k.line.value;
      } else if (t === "TYPE" && (tag === "EVEN" || tag === "FACT")) {
        continue;
      } else if (t === "NOTE") {
        resolveNote(k, event);
      } else if (t === "SOUR") {
        resolveSource(k, event, `${type}.SOUR.inline`);
      } else if (t === "OBJE") {
        resolveMedia(k, event);
      } else {
        event.extensions[`${type}.${t}`] = k.line.value;
        if (k.kids.length > 0)
          foldUnknown(`${type}.${t}`, k.kids, event.extensions);
      }
    }
    return event;
  };
  const KNOWN_TOP = new Set(["HEAD", "TRLR", "INDI", "FAM", "NOTE", "SNOTE", "SOUR", "REPO", "OBJE", "SUBM", "SUBN"]);
  const pendingFamLinks = [];
  for (const r of records) {
    if (r.tag !== "INDI" || !r.xref) {
      if (!KNOWN_TOP.has(r.tag)) {
        warn("unknown-record", `Level-0 ${r.tag}${r.xref ? ` @${r.xref}@` : ""} is not modeled; skipped`);
      } else if (r.tag === "INDI" && !r.xref) {
        warn("missing-xref", "INDI without a pointer; skipped");
      }
      continue;
    }
    if (!claimXref("INDI", r.xref))
      continue;
    const person = {
      id: newId("p"),
      xref: r.xref,
      names: [],
      sex: "U",
      events: [],
      biography: "",
      researchNotes: [],
      famc: [],
      fams: [],
      isLiving: true,
      private: false,
      mediaIds: [],
      sources: [],
      externalIds: [],
      extensions: {}
    };
    personsByXref.set(r.xref, person);
    tree.persons.push(person);
    const famc = [];
    const fams = [];
    for (const n of r.kids) {
      const t = n.line.tag;
      if (t === "NAME") {
        const primary = parseName(n.line.value, n.kids);
        if (person.names.length === 0)
          person.names.push(primary);
        else
          person.names[0].alternates = [...person.names[0].alternates ?? [], primary.display];
      } else if (t === "SEX") {
        person.sex = normalizeSex(n.line.value);
      } else if (t === "FAMC") {
        const target = ptr(n.line.value);
        if (target) {
          const pediRaw = kidValue(n.kids, "PEDI");
          famc.push({ xref: target, ...pediRaw ? { pedi: pediRaw } : {} });
          for (const k of n.kids) {
            if (k.line.tag !== "PEDI") {
              person.extensions[`INDI.FAMC.${k.line.tag}`] = k.line.value;
            }
          }
        } else {
          warn("bad-pointer", `FAMC value "${n.line.value}" is not a pointer; skipped`);
        }
      } else if (t === "FAMS") {
        const target = ptr(n.line.value);
        if (target)
          fams.push(target);
        else
          warn("bad-pointer", `FAMS value "${n.line.value}" is not a pointer; skipped`);
      } else if (t === "NOTE") {
        resolvePersonNote(n, person);
      } else if (t === "SOUR") {
        resolveSource(n, person, "INDI.SOUR.inline");
      } else if (t === "OBJE") {
        resolveMedia(n, person);
      } else if (t === "CHAN") {
        person.extensions["INDI.CHAN"] = kidValue(n.kids, "DATE") ?? n.line.value;
      } else if (["RIN", "RFN", "AFN", "REFN"].includes(t)) {
        person.externalIds.push({ type: t, value: n.line.value });
      } else if (EVENT_TAGS.has(t)) {
        person.events.push(buildEvent(n));
      } else {
        person.extensions[`INDI.${t}`] = n.line.value;
        if (n.kids.length > 0)
          foldUnknown(`INDI.${t}`, n.kids, person.extensions);
      }
    }
    if (person.names.length === 0)
      person.names.push({ display: "" });
    if (person.events.some((e) => DEATH_TAGS.has(e.type)))
      person.isLiving = false;
    pendingFamLinks.push({ person, famc, fams });
  }
  const pendingFamMembers = [];
  for (const r of records) {
    if (r.tag !== "FAM" || !r.xref) {
      if (r.tag === "FAM" && !r.xref)
        warn("missing-xref", "FAM without a pointer; skipped");
      continue;
    }
    if (!claimXref("FAM", r.xref))
      continue;
    const family = { id: newId("f"), xref: r.xref, partners: [], children: [], extensions: {} };
    familiesByXref.set(r.xref, family);
    tree.families.push(family);
    const partners = [];
    const children = [];
    for (const n of r.kids) {
      const t = n.line.tag;
      if (t === "HUSB" || t === "WIFE") {
        const target = ptr(n.line.value);
        if (target)
          partners.push(target);
        else
          warn("bad-pointer", `${t} value "${n.line.value}" is not a pointer; skipped`);
      } else if (t === "CHIL") {
        const target = ptr(n.line.value);
        if (target)
          children.push(target);
        else
          warn("bad-pointer", `CHIL value "${n.line.value}" is not a pointer; skipped`);
      } else if (t === "MARR") {
        family.marriage = buildEvent(n);
      } else if (t === "DIV") {
        family.divorce = buildEvent(n);
      } else if (EVENT_TAGS.has(t)) {
        family.extensions[`FAM.${t}`] = n.line.value;
        if (n.kids.length > 0)
          foldUnknown(`FAM.${t}`, n.kids, family.extensions);
      } else if (t === "NOTE") {
        const target = ptr(n.line.value);
        const text2 = target ? notesByXref.get(target)?.text ?? "" : n.line.value;
        if (target && !notesByXref.has(target)) {
          warn("dangling-pointer", `NOTE @${target}@ not found`);
        } else if (text2 !== "") {
          const prev = family.extensions["FAM.NOTE"];
          family.extensions["FAM.NOTE"] = prev ? `${prev}
${text2}` : text2;
        }
      } else if (t === "SOUR" || t === "OBJE" || t === "CHAN") {
        family.extensions[`FAM.${t}`] = n.line.value;
      } else {
        family.extensions[`FAM.${t}`] = n.line.value;
        if (n.kids.length > 0)
          foldUnknown(`FAM.${t}`, n.kids, family.extensions);
      }
    }
    pendingFamMembers.push({ family, partners, children });
  }
  for (const { family, partners, children } of pendingFamMembers) {
    for (const xref of partners) {
      const p = personsByXref.get(xref);
      if (!p) {
        warn("dangling-pointer", `Family @${family.xref}@ partner @${xref}@ not found`);
        continue;
      }
      family.partners.push(p.id);
    }
    for (const xref of children) {
      const p = personsByXref.get(xref);
      if (!p) {
        warn("dangling-pointer", `Family @${family.xref}@ child @${xref}@ not found`);
        continue;
      }
      family.children.push(p.id);
    }
  }
  for (const { person, famc, fams } of pendingFamLinks) {
    for (const link of famc) {
      const f = familiesByXref.get(link.xref);
      if (!f) {
        warn("dangling-pointer", `Person @${person.xref}@ FAMC @${link.xref}@ not found`);
        continue;
      }
      const pedi = mapPedi(link.pedi);
      person.famc.push({ familyId: f.id, ...pedi ? { pedi } : {} });
      if (link.pedi && !pedi) {
        person.extensions[`INDI.FAMC.${f.id}.PEDI`] = link.pedi;
      }
      if (!f.children.includes(person.id))
        f.children.push(person.id);
    }
    for (const xref of fams) {
      const f = familiesByXref.get(xref);
      if (!f) {
        warn("dangling-pointer", `Person @${person.xref}@ FAMS @${xref}@ not found`);
        continue;
      }
      person.fams.push(f.id);
      if (!f.partners.includes(person.id))
        f.partners.push(person.id);
    }
  }
  for (const family of tree.families) {
    for (const pid of family.partners) {
      const p = tree.persons.find((q) => q.id === pid);
      if (p && !p.fams.includes(family.id))
        p.fams.push(family.id);
    }
    for (const cid of family.children) {
      const c = tree.persons.find((q) => q.id === cid);
      if (c && !c.famc.some((l) => l.familyId === family.id)) {
        c.famc.push({ familyId: family.id });
      }
    }
  }
  return {
    tree,
    report: {
      version,
      encoding,
      hadBom,
      counts: {
        individuals: tree.persons.length,
        families: tree.families.length,
        notes: tree.notes.length,
        sources: tree.sources.length,
        media: tree.media.length
      },
      warnings
    }
  };
}
// src/gedcom/export.ts
var MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
function exportDateForGedcom(raw) {
  if (!raw)
    return;
  return raw.replace(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\b/gi, (m) => m.toUpperCase());
}
var MIME_FORM = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/bmp": "bmp",
  "image/tiff": "tif",
  "application/pdf": "pdf",
  "audio/mpeg": "mp3",
  "video/mp4": "mp4",
  "audio/wav": "wav"
};
var PEDI_EXPORT = {
  adoptive: "ADOPTED",
  foster: "FOSTER",
  biological: "BIRTH"
};

class Emitter {
  lines = [];
  at(level, tag, value = "") {
    const chunks = splitGedValue(value);
    this.lines.push(`${level} ${tag}${chunks[0] ? ` ${chunks[0]}` : ""}`);
    for (const c of chunks.slice(1))
      this.lines.push(`${level + 1} CONC${c ? ` ${c}` : ""}`);
  }
  text(level, tag, value) {
    const [first, ...rest] = value.split(`
`);
    this.at(level, tag, first ?? "");
    for (const r of rest)
      this.at(level + 1, "CONT", r);
  }
}
function splitGedValue(value, limit = 240) {
  if (value.length <= limit)
    return [value];
  const out = [];
  let rest = value;
  while (rest.length > limit) {
    out.push(rest.slice(0, limit));
    rest = rest.slice(limit);
  }
  out.push(rest);
  return out;
}
function exportHead(e, o) {
  const now = new Date;
  const stamp = `${now.getDate()} ${MONTHS[now.getMonth()]} ${now.getFullYear()}`;
  e.at(0, "HEAD");
  e.at(1, "SOUR HERITAGE");
  e.at(2, "VERS 0.1.0");
  e.at(2, "NAME Heritage");
  e.at(2, "CORP Heritage");
  e.at(1, "DEST HERITAGE");
  e.at(1, "DATE", stamp);
  if (o.version === "5.5.1")
    e.at(1, "CHAR UTF-8");
  e.at(1, "GEDC");
  e.at(2, "VERS", o.version);
  if (o.version === "5.5.1")
    e.at(2, "FORM LINEAGE-LINKED");
  e.at(1, "SUBM @U1@");
  e.at(1, "FILE heritage.ged");
  e.at(0, "@U1@ SUBM");
  e.at(1, "NAME", o.submitterName);
}
function redact(p) {
  return {
    ...p,
    names: [{ display: "Living" }],
    events: [],
    biography: "",
    researchNotes: [],
    mediaIds: [],
    sources: [],
    externalIds: [],
    extensions: {}
  };
}
function collectBranch(tree, rootId) {
  if (!tree.persons.some((p) => p.id === rootId))
    throw new Error(`branch root ${rootId} not in tree`);
  const downPersons = new Set([rootId]);
  const downFamilies = new Set;
  const todo = [rootId];
  while (todo.length > 0) {
    const pid = todo.pop();
    for (const f of tree.families) {
      if (!f.partners.includes(pid) || downFamilies.has(f.id))
        continue;
      downFamilies.add(f.id);
      for (const other of [...f.partners, ...f.children]) {
        if (!downPersons.has(other)) {
          downPersons.add(other);
          todo.push(other);
        }
      }
    }
  }
  return {
    persons: tree.persons.filter((p) => downPersons.has(p.id)),
    families: tree.families.filter((f) => downFamilies.has(f.id))
  };
}
function exportEvent(e, level, event, xrefOf) {
  e.at(level, event.type);
  const date = exportDateForGedcom(event.dateRaw);
  if (date)
    e.at(level + 1, "DATE", date);
  if (event.place)
    e.at(level + 1, "PLAC", event.place.raw);
  if (event.cause)
    e.at(level + 1, "CAUS", event.cause);
  for (const n of event.noteIds ?? []) {
    const x = xrefOf("note", n);
    if (x)
      e.at(level + 1, `NOTE @${x}@`);
  }
  for (const s of event.sources ?? []) {
    const x = xrefOf("source", s.sourceId);
    if (x) {
      e.at(level + 1, `SOUR @${x}@`);
      if (s.page)
        e.at(level + 2, "PAGE", s.page);
    }
  }
  const inlineSour = event.extensions[`${event.type}.SOUR.inline`];
  if (inlineSour !== undefined)
    e.at(level + 1, "SOUR", inlineSour);
  for (const m of event.mediaIds ?? []) {
    const x = xrefOf("media", m);
    if (x)
      e.at(level + 1, `OBJE @${x}@`);
  }
  for (const [k, v] of Object.entries(event.extensions)) {
    const prefix = `${event.type}.`;
    if (!k.startsWith(prefix) || k === `${event.type}.SOUR.inline`)
      continue;
    const sub = k.slice(prefix.length);
    if (sub.includes("."))
      continue;
    e.at(level + 1, sub, v);
  }
}
function exportName(e, p) {
  const primary = p.names[0] ?? { display: "" };
  const core = [
    primary.given ?? "",
    primary.surname ? `/${primary.surname}/` : "",
    primary.suffix ?? ""
  ].join(" ").replace(/\s+/g, " ").trim();
  e.at(1, "NAME", core || primary.display);
  if (primary.given)
    e.at(2, "GIVN", primary.given);
  if (primary.surname)
    e.at(2, "SURN", primary.surname);
  if (primary.prefix)
    e.at(2, "NPFX", primary.prefix);
  if (primary.suffix)
    e.at(2, "NSFX", primary.suffix);
  if (primary.nick)
    e.at(2, "NICK", primary.nick);
  for (const alt of primary.alternates ?? [])
    e.at(1, "NAME", alt);
}
function exportGedcom(tree, options = {}) {
  const version = options.version ?? "5.5.1";
  const includeMedia = options.includeMedia ?? true;
  const livingFilter = options.livingFilter ?? "none";
  const submitterName = options.submitterName ?? "Heritage";
  let persons = tree.persons;
  let families = tree.families;
  if (options.branchRootId) {
    ({ persons, families } = collectBranch(tree, options.branchRootId));
  }
  if (livingFilter === "exclude") {
    const living = new Set(persons.filter((p) => p.isLiving).map((p) => p.id));
    persons = persons.filter((p) => !living.has(p.id));
    families = families.map((f) => ({
      ...f,
      partners: f.partners.filter((p) => !living.has(p)),
      children: f.children.filter((p) => !living.has(p))
    })).filter((f) => f.partners.length > 0 || f.children.length > 0);
  }
  const shown = (p) => livingFilter === "redact" && p.isLiving ? redact(p) : p;
  persons = persons.map(shown);
  const personIds = new Set(persons.map((p) => p.id));
  families = families.map((f) => ({
    ...f,
    partners: f.partners.filter((p) => personIds.has(p)),
    children: f.children.filter((p) => personIds.has(p))
  }));
  const e = new Emitter;
  exportHead(e, { version, submitterName });
  const noteX = new Map;
  const sourceX = new Map;
  const mediaX = new Map;
  const personX = new Map;
  const familyX = new Map;
  persons.forEach((p, i) => personX.set(p.id, `I${i + 1}`));
  families.forEach((f, i) => familyX.set(f.id, `F${i + 1}`));
  const notes = tree.notes.filter((n) => persons.some((p) => p.researchNotes.includes(n.text) || p.events.some((ev) => ev.noteIds?.includes(n.id))) || options.branchRootId === undefined);
  notes.forEach((n, i) => noteX.set(n.id, `N${i + 1}`));
  const usedSources = new Set;
  const usedMedia = new Set;
  for (const p of persons) {
    for (const ev of p.events) {
      for (const s of ev.sources ?? [])
        usedSources.add(s.sourceId);
      if (includeMedia)
        for (const m of ev.mediaIds ?? [])
          usedMedia.add(m);
    }
    for (const s of p.sources)
      usedSources.add(s.sourceId);
    if (includeMedia)
      for (const m of p.mediaIds)
        usedMedia.add(m);
  }
  tree.sources.filter((s) => usedSources.has(s.id)).forEach((s, i) => sourceX.set(s.id, `S${i + 1}`));
  if (includeMedia) {
    tree.media.filter((m) => usedMedia.has(m.id)).forEach((m, i) => mediaX.set(m.id, `O${i + 1}`));
  }
  const xrefOf = (kind, id) => kind === "note" ? noteX.get(id) : kind === "source" ? sourceX.get(id) : mediaX.get(id);
  for (const n of notes) {
    if (n.text)
      e.text(0, `@${noteX.get(n.id)}@ NOTE`, n.text);
    else
      e.at(0, `@${noteX.get(n.id)}@ NOTE`);
  }
  for (const s of tree.sources) {
    const x = sourceX.get(s.id);
    if (!x)
      continue;
    e.at(0, `@${x}@ SOUR`);
    if (s.title)
      e.at(1, "TITL", s.title);
  }
  if (includeMedia) {
    const byId = new Map(tree.media.map((m) => [m.id, m]));
    for (const [id, x] of mediaX) {
      const m = byId.get(id);
      e.at(0, `@${x}@ OBJE`);
      e.at(1, "FILE", resolveMediaPath(m.path));
      const form = mimeToForm(m);
      if (form)
        e.at(2, "FORM", form);
      if (m.title)
        e.at(1, "TITL", m.title);
    }
  }
  for (const p of persons) {
    e.at(0, `@${personX.get(p.id)}@ INDI`);
    exportName(e, p);
    e.at(1, "SEX", p.sex);
    for (const ev of p.events)
      exportEvent(e, 1, ev, xrefOf);
    for (const l of p.famc) {
      const x = familyX.get(l.familyId);
      if (x) {
        e.at(1, `FAMC @${x}@`);
        if (l.pedi && l.pedi !== "biological")
          e.at(2, "PEDI", PEDI_EXPORT[l.pedi] ?? l.pedi);
      }
    }
    for (const f of p.fams) {
      const x = familyX.get(f);
      if (x)
        e.at(1, `FAMS @${x}@`);
    }
    for (const t of p.researchNotes)
      e.text(1, "NOTE", t);
    for (const s of p.sources) {
      const x = sourceX.get(s.sourceId);
      if (x) {
        e.at(1, `SOUR @${x}@`);
        if (s.page)
          e.at(2, "PAGE", s.page);
      }
    }
    if (includeMedia) {
      for (const m of p.mediaIds) {
        const x = mediaX.get(m);
        if (x)
          e.at(1, `OBJE @${x}@`);
      }
    }
    for (const [k, v] of Object.entries(p.extensions)) {
      if (!k.startsWith("INDI."))
        continue;
      const tag = k.slice("INDI.".length);
      if (tag === "SOUR.inline") {
        e.at(1, "SOUR", v);
        continue;
      }
      if (tag.includes("."))
        continue;
      e.at(1, tag, v);
    }
    for (const xid of p.externalIds)
      e.at(1, xid.type, xid.value);
  }
  for (const f of families) {
    e.at(0, `@${familyX.get(f.id)}@ FAM`);
    for (const partner of f.partners.slice(0, 2)) {
      const isFirst = f.partners[0] === partner;
      e.at(1, `${isFirst ? "HUSB" : "WIFE"} @${personX.get(partner)}@`);
    }
    for (const extra of f.partners.slice(2))
      e.at(1, `HUSB @${personX.get(extra)}@`);
    for (const c of f.children)
      e.at(1, `CHIL @${personX.get(c)}@`);
    if (f.marriage)
      exportEvent(e, 1, { ...f.marriage, type: "MARR" }, xrefOf);
    if (f.divorce)
      exportEvent(e, 1, { ...f.divorce, type: "DIV" }, xrefOf);
    const famNote = f.extensions["FAM.NOTE"];
    if (famNote !== undefined)
      e.text(1, "NOTE", famNote);
    for (const [k, v] of Object.entries(f.extensions)) {
      if (!k.startsWith("FAM.") || k === "FAM.NOTE")
        continue;
      const tag = k.slice("FAM.".length);
      if (!tag.includes("."))
        e.at(1, tag, v);
    }
  }
  e.at(0, "TRLR");
  return `${e.lines.join(`
`)}
`;
}
function mimeToForm(m) {
  if (!m.mime)
    return "";
  const lower = m.mime.toLowerCase();
  if (MIME_FORM[lower])
    return MIME_FORM[lower];
  if (!lower.includes("/"))
    return m.mime;
  return lower.split("/")[1];
}
// src/views/family.ts
var NODE_W = 232;
var NODE_H = 88;
var COUPLE_GAP = 32;
var X_GAP = 56;
var Y_GAP = 72;
var COUPLE_PITCH = NODE_W + COUPLE_GAP;
var CARD_H_SHORT = 68;
var CARD_H_TALL = 68;
function wrapDisplayName(name) {
  const words = String(name || "").split(/\s+/).filter(Boolean);
  if (words.length === 0)
    return ["?"];
  if (words.join(" ").length <= 26)
    return [words.join(" ")];
  let first = "";
  for (const word of words) {
    const next = first ? `${first} ${word}` : word;
    if (next.length <= 25)
      first = next;
    else
      break;
  }
  if (!first)
    return [`${words[0].slice(0, 25)}\u2026`];
  return [`${first}\u2026`];
}
function cardHeightFor(displayName2) {
  return wrapDisplayName(displayName2).length > 1 ? CARD_H_TALL : CARD_H_SHORT;
}
var MAX_COLUMNS = 4;
var MAX_VISIBLE_PEOPLE = 500;
var MAX_SIBLINGS = 12;
function rowWidth(count) {
  return count <= 0 ? 0 : count * NODE_W + (count - 1) * COUPLE_GAP;
}
function buildBuses(nodes, families, included) {
  const at = new Map(nodes.map((n) => [n.personId, n]));
  const raw = [];
  for (const f of families) {
    if (!included.has(f.id))
      continue;
    const partners = f.partners.filter((p) => at.has(p)).sort((a, b) => at.get(a).x - at.get(b).x);
    const kids = f.children.filter((c) => at.has(c)).sort((a, b) => at.get(a).x - at.get(b).x);
    if (partners.length === 0 || kids.length === 0)
      continue;
    const legs = partners.map((p) => at.get(p).x + NODE_W / 2);
    const top = Math.max(...partners.map((p) => at.get(p).y + (at.get(p).h ?? NODE_H) / 2));
    const pbot = Math.max(...partners.map((p) => at.get(p).y + (at.get(p).h ?? NODE_H)));
    const x = (at.get(partners[0]).x + at.get(partners[partners.length - 1]).x + NODE_W) / 2;
    const kidTop = Math.min(...kids.map((c) => at.get(c).y));
    if (kidTop <= top)
      continue;
    raw.push({ x, top, kidTop, kids: kids.map((c) => at.get(c).x + NODE_W / 2), legs, pbot, pl: legs[0], pr: legs[legs.length - 1] });
  }
  const buses = [];
  const byGap = new Map;
  for (const r of raw) {
    const key = `${r.top}|${r.kidTop}`;
    const list = byGap.get(key) ?? [];
    list.push(r);
    byGap.set(key, list);
  }
  for (const list of byGap.values()) {
    const spans = list.map((r) => {
      const xs = [...r.legs, ...r.kids];
      return { r, lo: Math.min(...xs), hi: Math.max(...xs), lane: 0 };
    });
    spans.sort((a, b) => a.lo - b.lo);
    const laneEnds = [];
    for (const s of spans) {
      let lane = 0;
      while (lane < laneEnds.length && laneEnds[lane] > s.lo)
        lane++;
      s.lane = lane;
      laneEnds[lane] = s.hi;
    }
    const lanes = Math.max(1, laneEnds.length);
    for (const s of spans) {
      const frac = lanes === 1 ? 0.5 : 0.4 + 0.2 * s.lane / (lanes - 1);
      const bus = s.r.top + (s.r.kidTop - s.r.top) * frac;
      buses.push({ x: s.r.x, top: s.r.top, bus, kids: s.r.kids, kidTop: s.r.kidTop, legs: s.r.legs, pbot: s.r.pbot, pl: s.r.pl, pr: s.r.pr });
    }
  }
  return buses;
}
function layoutFamilyView(tree, rootId, maxDepth, collapsed, expandedAncestors, minimizedAncestorIds, showSiblings, siblingPersonIds, showYears, showPhotos, familiesByPartner, familiesByChild) {
  const STEP_X = NODE_W + X_GAP;
  const sexById = new Map(tree.persons.map((p) => [p.id, p.sex]));
  const gen = new Map([[rootId, 0]]);
  const included = new Set;
  const truncated = new Set;
  const visited = new Set([rootId]);
  const siblingAdded = new Set;
  const cap = (id, g) => {
    if (visited.has(id))
      return false;
    if (visited.size >= MAX_VISIBLE_PEOPLE) {
      truncated.add(id);
      return false;
    }
    visited.add(id);
    gen.set(id, g);
    return true;
  };
  const descStack = [rootId];
  const doneDesc = new Set;
  while (descStack.length > 0) {
    const pid = descStack.pop();
    if (doneDesc.has(pid))
      continue;
    doneDesc.add(pid);
    const g = gen.get(pid);
    for (const f of familiesByPartner.get(pid) ?? []) {
      included.add(f.id);
      for (const q of f.partners)
        if (cap(q, g))
          descStack.push(q);
      if (g >= maxDepth || collapsed.has(f.id))
        continue;
      for (const c of f.children)
        if (cap(c, g + 1))
          descStack.push(c);
    }
  }
  const siblingAnchor = new Map;
  const siblingGroup = new Map;
  const addSiblingsOf = (pid, force = false) => {
    const g = gen.get(pid);
    if (g === undefined)
      return;
    if (!force && Math.abs(g) > maxDepth)
      return;
    for (const f of familiesByChild.get(pid) ?? []) {
      included.add(f.id);
      const sibs = f.children.filter((id) => id !== pid);
      for (const s of sibs.slice(0, MAX_SIBLINGS)) {
        if (!cap(s, g))
          continue;
        siblingAdded.add(s);
        siblingAnchor.set(s, pid);
        siblingGroup.set(s, f.id);
        for (const sf of familiesByPartner.get(s) ?? []) {
          included.add(sf.id);
          for (const q of sf.partners) {
            if (cap(q, g)) {
              siblingAdded.add(q);
              siblingAnchor.set(q, pid);
              siblingGroup.set(q, f.id);
            }
          }
        }
      }
      for (const s of sibs.slice(MAX_SIBLINGS))
        truncated.add(s);
    }
  };
  if (showSiblings)
    addSiblingsOf(rootId);
  const ancStack = [rootId];
  for (const id of expandedAncestors) {
    if (gen.has(id) && !ancStack.includes(id))
      ancStack.push(id);
  }
  const doneAnc = new Set;
  while (ancStack.length > 0) {
    const pid = ancStack.pop();
    if (doneAnc.has(pid))
      continue;
    doneAnc.add(pid);
    if (minimizedAncestorIds.has(pid))
      continue;
    const g = gen.get(pid);
    if (Math.abs(g) >= maxDepth && !expandedAncestors.has(pid))
      continue;
    for (const f of familiesByChild.get(pid) ?? []) {
      included.add(f.id);
      for (const q of f.partners) {
        if (!cap(q, g - 1))
          continue;
        ancStack.push(q);
        if (showSiblings && !minimizedAncestorIds.has(q))
          addSiblingsOf(q);
      }
    }
  }
  for (const sid of siblingPersonIds) {
    if (gen.has(sid))
      addSiblingsOf(sid);
  }
  const colStack = [...siblingAdded];
  const doneCol = new Set;
  while (colStack.length > 0) {
    const pid = colStack.pop();
    if (doneCol.has(pid))
      continue;
    doneCol.add(pid);
    const g = gen.get(pid);
    if (g === undefined)
      continue;
    for (const f of familiesByPartner.get(pid) ?? []) {
      included.add(f.id);
      for (const q of f.partners)
        if (cap(q, g))
          colStack.push(q);
      if (g >= maxDepth || collapsed.has(f.id))
        continue;
      for (const c of f.children)
        if (cap(c, g + 1))
          colStack.push(c);
    }
  }
  const descendantKids = new Map;
  for (const family of tree.families) {
    for (const partner of family.partners) {
      const kids = descendantKids.get(partner) ?? new Set;
      for (const child of family.children)
        kids.add(child);
      descendantKids.set(partner, kids);
    }
  }
  const rel = new Map;
  const positioned = new Set;
  const active = new Set;
  const placedKidsByParent = new Map;
  function descBlock(pid) {
    if (active.has(pid))
      return { width: 0, members: [] };
    active.add(pid);
    const g = gen.get(pid);
    const unit = [pid];
    const fams = (familiesByPartner.get(pid) ?? []).filter((f) => included.has(f.id));
    for (const f of fams) {
      for (const q of f.partners) {
        if (q !== pid && gen.get(q) === g && gen.has(q) && !positioned.has(q) && !unit.includes(q)) {
          unit.push(q);
        }
      }
    }
    const sexRank = (id) => {
      const s = sexById.get(id);
      return s === "M" ? 0 : s === "F" ? 1 : 2;
    };
    unit.sort((a, b) => sexRank(a) - sexRank(b));
    const kids = [];
    if (g < maxDepth) {
      const seenKid = new Set;
      const mine = placedKidsByParent.get(pid) ?? new Set;
      for (const f of fams) {
        if (collapsed.has(f.id))
          continue;
        for (const c of f.children) {
          if (seenKid.has(c) || positioned.has(c) || gen.get(c) !== g + 1)
            continue;
          seenKid.add(c);
          mine.add(c);
          kids.push(descBlock(c));
        }
      }
      placedKidsByParent.set(pid, mine);
    }
    const coupleW = rowWidth(unit.length);
    const kidsW = kids.reduce((a, k) => a + k.width, 0) + Math.max(0, kids.length - 1) * X_GAP;
    const width2 = Math.max(coupleW, kidsW);
    unit.forEach((q, i) => {
      rel.set(q, -coupleW / 2 + NODE_W / 2 + i * COUPLE_PITCH);
      positioned.add(q);
    });
    let x = -kidsW / 2;
    for (const k of kids) {
      const shift = x + k.width / 2;
      for (const m of k.members)
        rel.set(m, rel.get(m) + shift);
      x += k.width + X_GAP;
    }
    active.delete(pid);
    return { width: width2, members: [...unit, ...kids.flatMap((k) => k.members)] };
  }
  descBlock(rootId);
  const occupied = new Map;
  for (const [id, g] of gen) {
    if (!positioned.has(id))
      continue;
    const row = occupied.get(g) ?? new Set;
    row.add(rel.get(id));
    occupied.set(g, row);
  }
  const claim = (g, desiredX) => {
    const row = occupied.get(g) ?? new Set;
    let x = desiredX;
    for (;; ) {
      let next = x;
      for (const y of row) {
        if (Math.abs(next - y) < NODE_W + X_GAP)
          next = Math.max(next, y + STEP_X);
      }
      if (next === x)
        break;
      x = next;
    }
    row.add(x);
    occupied.set(g, row);
    return x;
  };
  const activeA = new Set;
  function placeAncestors(pid) {
    if (activeA.has(pid))
      return;
    activeA.add(pid);
    const baseX = rel.get(pid) ?? 0;
    const myG = gen.get(pid);
    const fresh = [];
    for (const f of familiesByChild.get(pid) ?? []) {
      if (!included.has(f.id))
        continue;
      for (const q of f.partners) {
        if (gen.get(q) === myG - 1 && !fresh.includes(q) && !positioned.has(q))
          fresh.push(q);
      }
    }
    fresh.sort((a, b) => {
      const ra = sexById.get(a) === "M" ? 0 : sexById.get(a) === "F" ? 1 : 2;
      const rb = sexById.get(b) === "M" ? 0 : sexById.get(b) === "F" ? 1 : 2;
      return ra - rb;
    });
    const targets = fresh.map((q, i) => fresh.length === 1 ? baseX : baseX - rowWidth(fresh.length) / 2 + NODE_W / 2 + i * COUPLE_PITCH);
    let pairShift = 0;
    for (let iter = 0;iter < 12; iter++) {
      let need = pairShift;
      for (const d of targets) {
        const row = occupied.get(myG - 1) ?? new Set;
        let x = d + pairShift;
        for (;; ) {
          let next = x;
          for (const y of row) {
            if (Math.abs(next - y) < NODE_W + X_GAP)
              next = Math.max(next, y + STEP_X);
          }
          if (next === x)
            break;
          x = next;
        }
        need = Math.max(need, x - d);
      }
      if (need === pairShift)
        break;
      pairShift = need;
    }
    fresh.forEach((q, i) => {
      rel.set(q, targets[i] + pairShift);
      positioned.add(q);
      const row = occupied.get(myG - 1) ?? new Set;
      row.add(targets[i] + pairShift);
      occupied.set(myG - 1, row);
      placeAncestors(q);
    });
    activeA.delete(pid);
  }
  if (positioned.has(rootId))
    placeAncestors(rootId);
  for (const id of expandedAncestors) {
    if (id !== rootId && gen.has(id) && positioned.has(id))
      placeAncestors(id);
  }
  function shiftBlock(members) {
    let shift = 0;
    for (let iter = 0;iter < 12; iter++) {
      let need = shift;
      for (const m of members) {
        const g = gen.get(m);
        if (g === undefined)
          continue;
        const row = occupied.get(g) ?? new Set;
        let x = rel.get(m) + shift;
        for (;; ) {
          let next = x;
          for (const y of row) {
            if (Math.abs(next - y) < NODE_W + X_GAP)
              next = Math.max(next, y + STEP_X);
          }
          if (next === x)
            break;
          x = next;
        }
        need = Math.max(need, x - rel.get(m));
      }
      if (need === shift)
        break;
      shift = need;
    }
    for (const m of members) {
      const g = gen.get(m);
      if (g === undefined)
        continue;
      rel.set(m, rel.get(m) + shift);
      positioned.add(m);
      const row = occupied.get(g) ?? new Set;
      row.add(rel.get(m));
      occupied.set(g, row);
    }
  }
  const hasScopedKids = (id) => {
    const g = gen.get(id);
    if (g === undefined)
      return false;
    return (familiesByPartner.get(id) ?? []).some((f) => included.has(f.id) && !collapsed.has(f.id) && f.children.some((c) => gen.get(c) === g + 1));
  };
  const pendingByGen = new Map;
  for (const id of siblingAdded) {
    if (positioned.has(id))
      continue;
    const anchor = siblingAnchor.get(id);
    if (!anchor || !positioned.has(anchor))
      continue;
    const g = gen.get(id);
    const list = pendingByGen.get(g) ?? [];
    list.push(id);
    pendingByGen.set(g, list);
  }
  for (const [g, ids] of pendingByGen) {
    let rowEdge = -Infinity;
    for (const [id, gg] of gen) {
      if (gg === g && positioned.has(id))
        rowEdge = Math.max(rowEdge, rel.get(id) + NODE_W / 2);
    }
    if (!Number.isFinite(rowEdge))
      continue;
    const shareFamily = (a, b) => (familiesByPartner.get(a) ?? []).some((f) => included.has(f.id) && f.partners.includes(b));
    let prevGroup;
    let prevId;
    for (const id of ids) {
      const group = siblingGroup.get(id);
      if (g < 0 && hasScopedKids(id))
        continue;
      if (g >= 0 && siblingAnchor.get(id) === rootId && hasScopedKids(id))
        continue;
      const gap = prevId !== undefined && shareFamily(prevId, id) ? COUPLE_GAP : prevGroup !== undefined && group !== undefined && group !== prevGroup ? X_GAP * 2 : X_GAP;
      rowEdge += gap + NODE_W / 2;
      rel.set(id, rowEdge);
      positioned.add(id);
      const row = occupied.get(g) ?? new Set;
      row.add(rowEdge);
      occupied.set(g, row);
      rowEdge += NODE_W / 2;
      prevGroup = group;
      prevId = id;
    }
  }
  for (const id of siblingAdded) {
    const g = gen.get(id);
    if (g === undefined || positioned.has(id))
      continue;
    if (g >= 0 && siblingAnchor.get(id) !== rootId)
      continue;
    if (!hasScopedKids(id))
      continue;
    const { members } = descBlock(id);
    shiftBlock(members);
  }
  let minX = Infinity;
  let minG = 0;
  for (const [id, g] of gen) {
    if (!positioned.has(id))
      continue;
    minX = Math.min(minX, rel.get(id) - NODE_W / 2);
    minG = Math.min(minG, g);
  }
  if (!Number.isFinite(minX))
    minX = 0;
  const rowH = new Map;
  const uniformH = !showYears && !showPhotos ? 48 : CARD_H_SHORT;
  for (const [id, g] of gen) {
    if (!positioned.has(id))
      continue;
    rowH.set(g, Math.max(rowH.get(g) ?? 0, uniformH));
  }
  const rowY = new Map;
  {
    let cursorY = 0;
    const gens = [...rowH.keys()].sort((a, b) => a - b);
    for (const g of gens) {
      rowY.set(g, cursorY);
      cursorY += rowH.get(g) + Y_GAP;
    }
  }
  const nodes = [];
  let width = 1;
  let height = 1;
  const countHiddenAncestors = (id) => {
    const seen = new Set([id]);
    const stack = [id];
    let count = 0;
    while (stack.length > 0) {
      const pid = stack.pop();
      for (const f of familiesByChild.get(pid) ?? []) {
        for (const q of f.partners) {
          if (seen.has(q))
            continue;
          seen.add(q);
          if (!positioned.has(q))
            count++;
          stack.push(q);
        }
      }
    }
    return count;
  };
  for (const [id, g] of gen) {
    if (!positioned.has(id))
      continue;
    const x = rel.get(id) - NODE_W / 2 - minX;
    const y = rowY.get(g) ?? 0;
    const h = rowH.get(g) ?? NODE_H;
    const treeKids = descendantKids.get(id) ?? new Set;
    const placedKids = placedKidsByParent.get(id) ?? new Set;
    const branchFamilies = (familiesByPartner.get(id) ?? []).filter((f) => f.children.length > 0);
    const branchFamilyIds = branchFamilies.map((f) => f.id);
    const atDepthLimit = g >= 0 && g >= maxDepth;
    const hasAncestors = (familiesByChild.get(id)?.length ?? 0) > 0;
    const parentIds = (familiesByChild.get(id) ?? []).flatMap((f) => f.partners);
    const hasHiddenParents = hasAncestors && !parentIds.some((p) => positioned.has(p));
    nodes.push({
      personId: id,
      x,
      y,
      h,
      generation: g,
      hasDescendants: placedKids.size > 0 || treeKids.size > 0 && (atDepthLimit || branchFamilyIds.some((fid) => collapsed.has(fid))),
      descendantCount: treeKids.size,
      collapsed: branchFamilyIds.length > 0 && branchFamilyIds.every((fid) => collapsed.has(fid)),
      atDepthLimit,
      branchFamilyIds,
      hasAncestors,
      atAncestorDepthLimit: g < 0 && -g >= maxDepth && !expandedAncestors.has(id) && hasAncestors,
      hasHiddenParents,
      hiddenAncestorCount: countHiddenAncestors(id),
      isFocus: id === rootId
    });
    width = Math.max(width, x + NODE_W);
    height = Math.max(height, y + h);
  }
  const atX = new Map(nodes.map((n) => [n.personId, n.x]));
  const edges = [];
  for (const f of tree.families) {
    if (!included.has(f.id))
      continue;
    const placedPartners = f.partners.filter((p) => atX.has(p)).sort((a, b) => atX.get(a) - atX.get(b));
    for (let i = 1;i < placedPartners.length; i++) {
      edges.push({ from: placedPartners[i - 1], to: placedPartners[i], kind: "partner" });
    }
    const placedChildren = f.children.filter((c) => atX.has(c));
    if (placedChildren.length > 0 && placedPartners.length > 0) {
      const anchor = placedPartners[0];
      for (const c of placedChildren)
        edges.push({ from: anchor, to: c, kind: "parent" });
    }
  }
  const siblingIds = new Set;
  for (const family of familiesByChild.get(rootId) ?? []) {
    for (const child of family.children)
      if (child !== rootId)
        siblingIds.add(child);
  }
  return {
    nodes,
    edges,
    buses: buildBuses(nodes, tree.families, included),
    width,
    height,
    siblingCount: siblingIds.size,
    showSiblings,
    truncatedCount: truncated.size,
    nodeWidth: NODE_W,
    nodeHeight: NODE_H,
    view: "family"
  };
}
function familyLayout(tree, rootId, opts = {}) {
  const view = opts.view ?? "family";
  const nodeWidth = view === "fan" ? 142 : NODE_W;
  const nodeHeight = view === "fan" ? 58 : NODE_H;
  if (!tree.persons.some((p) => p.id === rootId)) {
    throw new Error(`person ${rootId} not in tree`);
  }
  const rawDepth = opts.depth;
  const maxDepth = typeof rawDepth === "number" && Number.isFinite(rawDepth) && rawDepth >= 0 ? Math.floor(rawDepth) : Number.POSITIVE_INFINITY;
  const familiesByPartner = new Map;
  const familiesByChild = new Map;
  const addIndex = (index, id, family) => {
    const related = index.get(id);
    if (related)
      related.push(family);
    else
      index.set(id, [family]);
  };
  for (const family of tree.families) {
    for (const partner of family.partners)
      addIndex(familiesByPartner, partner, family);
    for (const child of family.children)
      addIndex(familiesByChild, child, family);
  }
  if (view === "family") {
    return layoutFamilyView(tree, rootId, maxDepth, opts.collapsedFamilyIds ?? new Set, opts.expandedAncestorIds ?? new Set, opts.minimizedAncestorIds ?? new Set, opts.showSiblings ?? false, opts.siblingPersonIds ?? new Set, opts.showYears ?? true, opts.showPhotos ?? false, familiesByPartner, familiesByChild);
  }
  const gen = new Map([[rootId, 0]]);
  const includedFamilies = new Set;
  const truncatedPeople = new Set;
  const addPerson = (id, generation) => {
    if (gen.has(id))
      return false;
    if (gen.size >= MAX_VISIBLE_PEOPLE) {
      truncatedPeople.add(id);
      return false;
    }
    gen.set(id, generation);
    return true;
  };
  const ancestorQueue = [rootId];
  const expandedAncestors = new Set;
  const userExpandedAncestors = opts.expandedAncestorIds ?? new Set;
  while (ancestorQueue.length > 0) {
    const personId = ancestorQueue.pop();
    if (expandedAncestors.has(personId))
      continue;
    expandedAncestors.add(personId);
    const generation = gen.get(personId);
    if (Math.abs(generation) >= maxDepth && !userExpandedAncestors.has(personId))
      continue;
    for (const family of familiesByChild.get(personId) ?? []) {
      includedFamilies.add(family.id);
      for (const parentId of family.partners) {
        if (addPerson(parentId, generation - 1))
          ancestorQueue.push(parentId);
      }
    }
  }
  const descendantQueue = [];
  const expandedDescendants = new Set;
  const collapsed = opts.collapsedFamilyIds ?? new Set;
  while (descendantQueue.length > 0) {
    const personId = descendantQueue.pop();
    if (expandedDescendants.has(personId))
      continue;
    expandedDescendants.add(personId);
    const generation = gen.get(personId);
    for (const family of familiesByPartner.get(personId) ?? []) {
      includedFamilies.add(family.id);
      for (const partnerId of family.partners) {
        if (addPerson(partnerId, generation))
          descendantQueue.push(partnerId);
      }
      if (generation >= maxDepth || collapsed.has(family.id))
        continue;
      for (const childId of family.children) {
        if (addPerson(childId, generation + 1))
          descendantQueue.push(childId);
      }
    }
  }
  const descendantIdsByPerson = new Map;
  for (const family of tree.families) {
    for (const partner of family.partners) {
      const childIds = descendantIdsByPerson.get(partner) ?? new Set;
      for (const child of family.children)
        childIds.add(child);
      descendantIdsByPerson.set(partner, childIds);
    }
  }
  const byGen = new Map;
  for (const [pid, g] of gen) {
    const list = byGen.get(g) ?? [];
    list.push(pid);
    byGen.set(g, list);
  }
  const nodes = [];
  const minGeneration = Math.min(0, ...byGen.keys());
  const maxGeneration = Math.max(0, ...byGen.keys());
  let width = MAX_COLUMNS * nodeWidth + (MAX_COLUMNS - 1) * X_GAP;
  let height = 1;
  const generations = [...byGen.entries()].sort((a, b) => a[0] - b[0]);
  if (view === "fan") {
    const maxAncestorDepth = Math.max(1, ...[...gen.values()].map((generation) => -generation));
    const radiusStep = NODE_H + Y_GAP;
    const maxRadius = maxAncestorDepth * radiusStep;
    const centerX = maxRadius + nodeWidth / 2;
    const centerY = maxRadius + nodeHeight / 2;
    width = centerX * 2;
    height = centerY + nodeHeight / 2;
    for (const [generation, ids] of generations) {
      const distance = -generation;
      ids.forEach((personId, index) => {
        const angle = distance === 0 ? -Math.PI / 2 : Math.PI + (index + 0.5) / ids.length * Math.PI;
        const radius = distance * radiusStep;
        const descendants = descendantIdsByPerson.get(personId) ?? new Set;
        nodes.push({
          personId,
          x: centerX + radius * Math.cos(angle) - nodeWidth / 2,
          y: centerY + radius * Math.sin(angle) - nodeHeight / 2,
          h: nodeHeight,
          generation,
          hasDescendants: false,
          descendantCount: descendants.size,
          collapsed: false,
          atDepthLimit: false,
          branchFamilyIds: [],
          hasAncestors: (familiesByChild.get(personId)?.length ?? 0) > 0,
          atAncestorDepthLimit: generation < 0 && -generation >= maxDepth && !userExpandedAncestors.has(personId) && (familiesByChild.get(personId)?.length ?? 0) > 0,
          hasHiddenParents: false,
          hiddenAncestorCount: 0,
          isFocus: personId === rootId
        });
      });
    }
  } else {
    const yByGeneration = new Map;
    let cursorY = 0;
    for (let generation = minGeneration;generation <= maxGeneration; generation++) {
      const rowCount = Math.max(1, Math.ceil((byGen.get(generation)?.length ?? 0) / MAX_COLUMNS));
      yByGeneration.set(generation, cursorY);
      cursorY += rowCount * (nodeHeight + Y_GAP);
    }
    for (const [generation, ids] of generations) {
      for (let rowStart = 0;rowStart < ids.length; rowStart += MAX_COLUMNS) {
        const row = ids.slice(rowStart, rowStart + MAX_COLUMNS);
        const rowOffset = (MAX_COLUMNS - row.length) * (nodeWidth + X_GAP) / 2;
        row.forEach((personId, column) => {
          const descendants = descendantIdsByPerson.get(personId) ?? new Set;
          const branchFamilies = (familiesByPartner.get(personId) ?? []).filter((family) => family.children.length > 0);
          const branchFamilyIds = branchFamilies.map((family) => family.id);
          nodes.push({
            personId,
            x: rowOffset + column * (nodeWidth + X_GAP),
            y: (yByGeneration.get(generation) ?? 0) + Math.floor(rowStart / MAX_COLUMNS) * (nodeHeight + Y_GAP),
            h: nodeHeight,
            generation,
            hasDescendants: false,
            descendantCount: descendants.size,
            collapsed: branchFamilyIds.length > 0 && branchFamilyIds.every((familyId) => collapsed.has(familyId)),
            atDepthLimit: false,
            branchFamilyIds,
            hasAncestors: (familiesByChild.get(personId)?.length ?? 0) > 0,
            atAncestorDepthLimit: generation < 0 && generation * -1 >= maxDepth && !userExpandedAncestors.has(personId) && (familiesByChild.get(personId)?.length ?? 0) > 0,
            hasHiddenParents: false,
            hiddenAncestorCount: 0,
            isFocus: personId === rootId
          });
        });
      }
    }
  }
  const nodeById = new Map(nodes.map((n) => [n.personId, n]));
  const edges = [];
  for (const f of tree.families) {
    if (!includedFamilies.has(f.id))
      continue;
    const [a, b] = f.partners;
    if (a && b && nodeById.has(a) && nodeById.has(b))
      edges.push({ from: a, to: b, kind: "partner" });
    const anchor = a && nodeById.has(a) ? a : b;
    for (const c of f.children) {
      if (anchor && nodeById.has(c))
        edges.push({ from: anchor, to: c, kind: "parent" });
    }
  }
  for (const node of nodes) {
    height = Math.max(height, node.y + (node.h ?? nodeHeight));
  }
  const siblingIds = new Set;
  for (const family of familiesByChild.get(rootId) ?? []) {
    for (const child of family.children)
      if (child !== rootId)
        siblingIds.add(child);
  }
  return {
    nodes,
    edges,
    buses: buildBuses(nodes, tree.families, includedFamilies),
    width,
    height,
    siblingCount: siblingIds.size,
    showSiblings: false,
    truncatedCount: truncatedPeople.size,
    nodeWidth,
    nodeHeight,
    view
  };
}
// src/views/list.ts
function yearOf(dateRaw) {
  if (!dateRaw)
    return;
  const m = dateRaw.match(/\d{3,4}/);
  return m ? m[0] : undefined;
}
function listPeople(tree, query = {}) {
  const filter = query.surname?.trim().toLowerCase();
  const rows = [];
  for (const p of tree.persons) {
    const surname = p.names[0]?.surname;
    const display = preferredName(p) || "(no name)";
    if (filter && !(surname?.toLowerCase().includes(filter) || display.toLowerCase().includes(filter))) {
      continue;
    }
    const birth = preferredEvent(p.events, "BIRT");
    const death = preferredEvent(p.events, "DEAT");
    const birthYear = yearOf(birth?.dateRaw);
    const deathYear = yearOf(death?.dateRaw);
    rows.push({
      personId: p.id,
      display,
      ...surname ? { surname } : {},
      ...birthYear ? { birthYear } : {},
      ...deathYear ? { deathYear } : {},
      ...birth?.place ? { birthPlace: birth.place.raw } : {}
    });
  }
  const sort = query.sort ?? "surname";
  const key = (r) => {
    switch (sort) {
      case "given":
        return r.display.toLowerCase();
      case "birth":
        return `${r.birthYear ?? "~~~~"} ${r.display.toLowerCase()}`;
      case "death":
        return `${r.deathYear ?? "~~~~"} ${r.display.toLowerCase()}`;
      default:
        return `${r.surname?.toLowerCase() ?? "~~~~"} ${r.display.toLowerCase()}`;
    }
  };
  return rows.sort((a, b) => key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0);
}
// src/app/pages.ts
var BUILD_ID = new Date().toISOString();
function esc(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
var TOKENS = `:root{color-scheme:light;--page:#f2f5f1;--surface:#fff;--surface-alt:#f8faf7;--ink:#20352d;--muted:#728078;--line:#dce5de;--forest:#365a49;--forest-dark:#244234;--forest-pale:#e8f0eb;--clay:#a26243;--clay-pale:#f5ece5;--gold:#d5b978;--shadow:0 12px 32px rgba(31,54,43,.08)}
*{box-sizing:border-box}html{min-width:320px}body{margin:0;background:var(--page);color:var(--ink);font:15px/1.5 Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;min-height:100vh}
a{color:var(--forest);text-decoration:none}a:hover{color:var(--clay)}button,input,select,textarea{font:inherit;color:inherit}button{cursor:pointer}button:focus-visible,a:focus-visible,input:focus-visible,select:focus-visible,textarea:focus-visible{outline:3px solid #bc8e55;outline-offset:2px}
.site-header{height:76px;background:rgba(255,255,255,.94);border-bottom:1px solid var(--line);display:flex;align-items:center;padding:0 clamp(18px,4vw,64px);gap:48px;position:relative;z-index:4}
.brand{display:flex;align-items:center;gap:11px;color:var(--forest-dark);font-weight:720;font-size:19px;letter-spacing:-.04em;white-space:nowrap}.brand-mark{width:34px;height:34px;border-radius:11px;background:var(--forest);display:grid;place-items:center;color:white}.brand-mark svg{width:22px;height:22px}
.site-nav{height:100%;display:flex;align-items:center;gap:8px}.site-nav a{height:40px;padding:0 15px;display:flex;align-items:center;border-radius:9px;color:#65746c;font-weight:580}.site-nav a:hover{background:var(--surface-alt);color:var(--forest-dark)}.site-nav a.active{background:var(--forest-pale);color:var(--forest-dark)}
.header-spacer{flex:1}.header-help{color:var(--muted);font-size:13px}
.page{max-width:1500px;margin:0 auto;padding:34px clamp(18px,4vw,64px) 48px}.page:has(#viewer){max-width:none;padding:22px clamp(12px,2vw,32px) 32px}.page-heading{display:flex;align-items:flex-end;justify-content:space-between;gap:24px;margin-bottom:23px}.page-heading h1{font:600 clamp(28px,3vw,38px)/1.12 Georgia,'Iowan Old Style',serif;letter-spacing:-.035em;margin:0;color:var(--ink)}.page-heading p{margin:8px 0 0;color:var(--muted);font-size:14px}.heading-actions{display:flex;align-items:center;gap:10px}
.eyebrow{font-size:12px;color:var(--forest);font-weight:650;margin:0 0 8px}.primary,.secondary,.icon-button{height:42px;border-radius:9px;border:1px solid transparent;padding:0 16px;display:inline-flex;align-items:center;justify-content:center;gap:8px;font-weight:620;white-space:nowrap}.primary{background:var(--forest);color:white}.primary:hover{background:var(--forest-dark);color:white}.secondary{background:white;color:var(--ink);border-color:var(--line)}.secondary:hover,.icon-button:hover{background:var(--forest-pale);border-color:#bed0c3}.icon-button{width:42px;padding:0;background:white;color:var(--forest);border-color:var(--line);font-size:19px}
.panel{background:var(--surface);border:1px solid var(--line);border-radius:14px;box-shadow:var(--shadow)}.muted{color:var(--muted)}.quiet{font-size:13px;color:var(--muted)}
input,select,textarea{height:42px;background:#fff;border:1px solid var(--line);border-radius:8px;padding:0 12px;min-width:0}input::placeholder,textarea::placeholder{color:#98a39d}textarea{height:auto;padding:10px 12px;resize:vertical}label{font-weight:560;color:#52635a;font-size:13px}label input,label select{display:block;margin-top:6px;width:100%}
.check-option{display:flex;align-items:center;gap:9px;min-height:42px;cursor:pointer;color:#52635a}.check-option input[type=checkbox]{display:inline-block;width:18px;height:18px;margin:0;accent-color:var(--forest);flex:0 0 auto}.form-grid label textarea{display:block;width:100%;margin-top:6px}
form.inline{display:inline}button:disabled{opacity:.5;cursor:not-allowed}
#toolbar{display:flex;align-items:center;gap:12px;padding:12px 14px;background:#fff;border:1px solid var(--line);border-bottom:0;border-radius:13px 13px 0 0;flex-wrap:wrap}#toolbar label{display:flex;align-items:center;gap:9px;color:var(--muted);font-size:13px;white-space:nowrap}#toolbar select{height:38px;min-width:150px;padding-right:30px}#toolbar .control-divider{height:26px;width:1px;background:var(--line);margin:0 2px}#toolbar .toolbar-search{margin-left:auto;position:relative;flex:1;min-width:185px;max-width:280px}#toolbar .toolbar-search input{height:38px;width:100%;padding-left:35px;background:var(--surface-alt)}#toolbar .toolbar-search span{position:absolute;left:12px;top:7px;color:#87958c}#toolbar .toolbar-count{font-size:13px;color:var(--muted);padding:0 7px;white-space:nowrap}
.tree-notice{margin:0;padding:10px 14px;border:1px solid #e5d4ae;background:#fcf7ea;color:#785d2f;font-size:13px}.tree-notice[hidden]{display:none}#siblingsBtn[aria-pressed="true"]{background:var(--forest-pale);border-color:#bed0c3;color:var(--forest-dark)}
.person-suggestions{position:absolute;left:0;right:0;top:calc(100% + 7px);z-index:5;background:#fff;border:1px solid var(--line);border-radius:10px;box-shadow:0 12px 30px rgba(31,54,43,.15);overflow:hidden}.person-suggestion{display:block;width:100%;border:0;border-bottom:1px solid #edf1ed;border-radius:0;padding:11px 13px;text-align:left;background:#fff;color:var(--ink);font-weight:560}.person-suggestion:last-child{border-bottom:0}.person-suggestion:hover{background:var(--forest-pale);color:var(--forest-dark)}.person-suggestion.empty{font-size:13px;color:var(--muted);font-weight:400;cursor:default}#toolbar strong{color:var(--forest-dark);max-width:160px;overflow:hidden;text-overflow:ellipsis}
.toolbar-menu-wrap{position:relative}.settings-menu{position:absolute;right:0;top:calc(100% + 8px);z-index:6;width:252px;background:#fff;border:1px solid var(--line);border-radius:12px;box-shadow:0 16px 40px rgba(24,49,36,.18);padding:16px}.settings-menu[hidden]{display:none}.settings-menu .settings-title{font-size:12px;color:var(--muted);margin:0 0 8px}.settings-menu .settings-title:not(:first-child){margin-top:14px}.settings-menu .check-option{margin-bottom:6px}.settings-menu select{width:100%;margin-top:6px}
#viewer:fullscreen{height:100vh;min-height:0;border-radius:0;border:0}
.tree-view-tabs{display:flex;gap:5px;width:max-content;max-width:100%;padding:4px;margin-bottom:12px;border:1px solid var(--line);border-radius:10px;background:#e9efea;overflow-x:auto}.tree-view-tabs a{padding:7px 14px;border-radius:7px;color:#637168;font-size:13px;font-weight:600;white-space:nowrap}.tree-view-tabs a.active{background:#fff;color:var(--forest-dark);box-shadow:0 1px 3px rgba(31,54,43,.1)}.tree-view-tabs a:hover{color:var(--forest-dark)}
#viewer{position:relative;height:min(82vh,940px);min-height:520px;background-color:#fbfcfa;background-image:radial-gradient(#cbd7ce 0.8px,transparent .8px);background-size:22px 22px;overflow:hidden;touch-action:none;border:1px solid var(--line);border-radius:0 0 13px 13px;box-shadow:var(--shadow)}#viewer svg{display:block;width:100%;height:100%;cursor:grab}#viewer svg:active{cursor:grabbing}#viewer .node{cursor:pointer}#viewer .node rect{fill:#fff;stroke:#b3beb6;stroke-width:2;filter:drop-shadow(0 5px 8px rgba(30,57,43,.08))}#viewer .node.sex-m rect{stroke:#6fa8cf}#viewer .node.sex-f rect{stroke:#d693a5}#viewer .node.sex-u rect{stroke:#b3beb6}#viewer .node:hover rect{stroke-width:2.5;filter:drop-shadow(0 7px 12px rgba(30,57,43,.14))}#viewer .node.selected rect{stroke:var(--clay);stroke-width:2.5}#viewer text{font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;fill:#2b3a42}#viewer .node .node-name{font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-weight:700;font-size:14px}#viewer .node .node-sub{fill:#6b7c8d;font-size:12px}#viewer .node-add{fill:var(--forest)}#viewer .node-add-bg{fill:#fff;stroke:#c3d2c7;stroke-width:1.25}#viewer .node .node-avatar-m{fill:#e3eef6}#viewer .node .node-avatar-f{fill:#f9e8ec}#viewer .node .node-avatar-u{fill:#edf1ee}#viewer .node .node-initials-m{fill:#3d7aa5;font-weight:700}#viewer .node .node-initials-f{fill:#b0526a;font-weight:700}#viewer .node .node-initials-u{fill:#5c6f63;font-weight:700}#viewer .node.focus rect{stroke-width:3}#viewer .node.focus.sex-m rect{stroke:#3d7aa5;fill:#f2f8fc}#viewer .node.focus.sex-f rect{stroke:#b0526a;fill:#fdf2f5}#viewer .node.focus.sex-u rect{stroke:var(--forest);fill:#f2f7f2}#viewer .node .fan-person{stroke:#557461;stroke-width:1.4;filter:drop-shadow(0 3px 5px rgba(30,57,43,.12))}#viewer .node .fan-initials{font-size:10px;font-weight:700;fill:#244234}#viewer .node .fan-name{font-size:9px;fill:#52675b}#viewer .node.sib rect{stroke:#C9A227;stroke-width:2;stroke-dasharray:6 3}#viewer .node.dimmed{opacity:.18}
.canvas-hint{position:absolute;bottom:16px;left:16px;padding:7px 11px;border:1px solid #e2e9e3;border-radius:8px;background:rgba(255,255,255,.93);font-size:12px;color:#6b7971;pointer-events:none}.canvas-legend{position:absolute;bottom:16px;right:16px;padding:8px 12px;border:1px solid #e2e9e3;border-radius:8px;background:rgba(255,255,255,.93);font-size:12px;color:#68766e;display:flex;gap:14px}.legend-dot{display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--forest);margin-right:5px}.legend-dot.deceased{background:#a9b2ac}
#drawer{position:absolute;top:12px;left:12px;bottom:12px;width:min(360px,calc(100% - 24px));background:#fff;border:1px solid var(--line);border-radius:13px;padding:22px;overflow:auto;box-shadow:0 16px 45px rgba(24,49,36,.19);z-index:2}#drawer[hidden]{display:none}#drawer h2{font:600 26px/1.2 Georgia,serif;letter-spacing:-.02em;margin:0 0 5px}#drawer h3{font-size:13px;color:#718078;margin:22px 0 8px}#drawer .drawer-close{position:absolute;right:14px;top:14px}#drawer .drawer-fact{padding:9px 0;border-bottom:1px solid #eef2ee;font-size:13px}#drawer .drawer-actions{display:flex;gap:8px;margin-top:20px}
#viewer .branch-pill{fill:#fff;stroke:#9db3a4;stroke-width:1.25;filter:drop-shadow(0 2px 4px rgba(30,57,43,.12))}#viewer a:hover .branch-pill{stroke:var(--clay);stroke-width:2}#viewer .branch-pill-text{fill:var(--forest);font-weight:700}#viewer .branch-toggle{opacity:0;transition:opacity .15s ease}#viewer .branch-toggle.always{opacity:1}#viewer .node:hover .branch-toggle,#viewer .node:focus-within .branch-toggle{opacity:1}
.zoom-cluster{position:absolute;right:14px;bottom:14px;display:flex;flex-direction:column;gap:6px;z-index:2}.zoom-cluster .icon-button{box-shadow:0 4px 12px rgba(24,49,36,.14)}
.empty-panel{max-width:820px;margin:56px auto;padding:48px;display:grid;grid-template-columns:1fr 240px;gap:36px;align-items:center}.empty-illustration{height:190px;display:grid;place-items:center;color:#9ab1a0;background:linear-gradient(145deg,#f2f7f2,#e7f0e9);border-radius:15px}.empty-illustration svg{width:145px;height:145px}.empty-panel h2{font:600 28px/1.2 Georgia,serif;margin:0 0 10px}.empty-panel p{color:var(--muted);margin:0 0 22px}.quick-add{display:flex;gap:8px;flex-wrap:wrap}.quick-add input{flex:1;min-width:140px}.empty-divider{border-top:1px solid var(--line);margin-top:24px;padding-top:17px;font-size:13px;color:var(--muted)}
.list-tools{display:flex;align-items:flex-end;gap:12px;flex-wrap:wrap;padding:17px;margin-bottom:14px}.list-tools label:first-child{flex:1;min-width:220px}.list-tools label:first-child input{max-width:420px}.result-count{margin-left:auto;color:var(--muted);font-size:13px;padding-bottom:10px}.people-table-wrap{overflow:auto}.people-table{width:100%;border-collapse:collapse}.people-table th{background:#f7f9f7;color:#78857d;font-size:11px;font-weight:650;text-transform:uppercase;letter-spacing:.07em;padding:12px 16px;text-align:left;border-bottom:1px solid var(--line)}.people-table td{padding:12px 16px;border-bottom:1px solid #edf1ed;color:#64736a}.people-table tr:last-child td{border-bottom:0}.people-table tbody tr:hover{background:#f8fbf8}.person-link{font-weight:620;color:var(--ink)}.person-cell{display:flex;align-items:center;gap:11px}.mini-avatar{width:35px;height:35px;border-radius:50%;display:grid;place-items:center;background:var(--forest-pale);color:var(--forest);font-size:12px;font-weight:700}
.record-grid{display:grid;grid-template-columns:minmax(0,1.35fr) minmax(280px,.65fr);gap:18px;align-items:start}.record-main,.record-side{display:grid;gap:16px}.section-card{padding:22px}.section-card h2{font:600 21px/1.25 Georgia,serif;margin:0 0 17px}.section-card h3{font-size:14px;margin:20px 0 9px}.form-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:13px}.form-grid .span-2{grid-column:span 2}.form-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:16px}.fact-list{width:100%;border-collapse:collapse}.fact-list th{text-align:left;color:var(--muted);font-size:12px;padding:8px;border-bottom:1px solid var(--line)}.fact-list td{padding:10px 8px;border-bottom:1px solid #edf1ed}.fact-list tbody tr:last-child td{border-bottom:0}.relation-list{list-style:none;margin:0;padding:0}.relation-list li{padding:10px 0;border-bottom:1px solid #edf1ed}.stack-form{display:grid;gap:12px}.stack-form .pair{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.upload-panel{padding:32px;max-width:760px}.upload-zone{border:1.5px dashed #b5c8ba;background:#f8fbf8;border-radius:12px;padding:32px;text-align:center;margin:18px 0}.upload-zone p{color:var(--muted);font-size:13px}.import-report{padding:22px;margin-top:18px}.report-stats{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin:18px 0}.stat{background:var(--surface-alt);border:1px solid #edf1ed;border-radius:9px;padding:12px}.stat strong{display:block;font:600 22px Georgia,serif}.stat span{font-size:12px;color:var(--muted)}
.export-panel{max-width:760px;padding:28px}.option-row{display:flex;align-items:center;justify-content:space-between;gap:24px;padding:15px 0;border-bottom:1px solid #edf1ed}.option-row label{font-size:14px;color:var(--ink)}.option-row p{margin:4px 0 0;font-size:12px;color:var(--muted)}.option-row select{min-width:220px}
.inline-button{background:none;border:0;color:var(--clay);padding:3px 6px;font-size:12px}.status-chip{display:inline-flex;align-items:center;gap:6px;background:#edf5ef;color:#456650;border-radius:99px;padding:4px 9px;font-size:12px}.status-chip.private{background:#f7eee8;color:#9b5a3f}
@media(max-width:760px){.site-header{height:auto;min-height:68px;padding:12px 18px;gap:16px;flex-wrap:wrap}.brand{font-size:17px}.site-nav{height:auto;order:3;width:100%;justify-content:space-between}.site-nav a{padding:0 11px}.header-help{display:none}.page{padding:24px 16px 32px}.page-heading{align-items:flex-start;flex-direction:column;margin-bottom:18px}.heading-actions{width:100%}.heading-actions .primary{flex:1}#toolbar{gap:8px;padding:10px}#toolbar label{flex:1;min-width:125px}#toolbar select{min-width:0;width:100%}#toolbar .control-divider{display:none}#toolbar .toolbar-search{margin:0;flex:1;min-width:100%}#toolbar .toolbar-search input{width:100%}#toolbar .toolbar-count{margin-left:auto}#viewer{height:72vh;min-height:440px}.canvas-legend{display:none}.canvas-hint{bottom:10px;left:10px;font-size:11px}.empty-panel{margin:20px auto;padding:24px;grid-template-columns:1fr}.empty-illustration{height:130px;grid-row:1}.empty-illustration svg{width:110px;height:110px}.record-grid{grid-template-columns:1fr}.section-card{padding:18px}.report-stats{grid-template-columns:repeat(2,1fr)}.report-stats .stat:last-child{grid-column:span 2}.upload-panel,.export-panel{padding:20px}.option-row{align-items:flex-start;flex-direction:column;gap:10px}.option-row select{width:100%}.result-count{margin-left:0;width:100%;padding:0}.people-table th,.people-table td{padding:10px 9px}.people-table th:nth-child(3),.people-table td:nth-child(3),.people-table th:nth-child(5),.people-table td:nth-child(5){display:none}.people-table th:nth-child(1){min-width:150px}.form-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.form-grid .span-2{grid-column:span 2}.option-row .check-option{align-self:stretch}}
@media(prefers-reduced-motion:no-preference){.primary,.secondary,.icon-button,.site-nav a{transition:background-color .16s ease,border-color .16s ease,color .16s ease}}`;
function shell(title, body, active = "tree") {
  const item = (key, href, label) => `<a href="${href}" class="${active === key ? "active" : ""}"${active === key ? ' aria-current="page"' : ""}>${label}</a>`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)} \xB7 Heritage</title>
<style>${TOKENS}</style>
</head><body><header class="site-header"><a href="/" class="brand"><span class="brand-mark"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M12 20V11M12 14 7 9M12 14l5-5M7 9V5M17 9V5M12 11V5"/><circle cx="7" cy="4" r="2" fill="currentColor"/><circle cx="17" cy="4" r="2" fill="currentColor"/><circle cx="12" cy="4" r="2" fill="currentColor"/></svg></span>Heritage</a><nav class="site-nav" aria-label="Main navigation">${item("tree", "/", "Tree")}${item("people", "/list", "People")}${item("import", "/import", "Import")}${item("export", "/export", "Export")}</nav><span class="header-spacer"></span><span class="header-help">Your family archive</span></header>
<main class="page">${body}</main></body></html>`;
}
function lifeYears(p) {
  const b = yearOf(preferredEvent(p.events, "BIRT")?.dateRaw);
  const d = yearOf(preferredEvent(p.events, "DEAT")?.dateRaw);
  if (!b && !d)
    return "";
  return `${b ?? "?"}\u2013${d ?? (p.isLiving ? "" : "?")}`;
}
function initialsFor(name) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0] ?? "").join("").toUpperCase() || "?";
}
var VIEWER_JS = `(() => {
const mount = document.getElementById('viewer');
const svg = document.getElementById('stage');
const drawer = document.getElementById('drawer');
const counts = document.getElementById('counts');
const rootName = document.getElementById('rootName');
const personSearch = document.getElementById('treeSearch');
const suggestions = document.getElementById('personSuggestions');
const NS = 'http://www.w3.org/2000/svg';
let W = Number(mount.dataset.w), H = Number(mount.dataset.h);
let root = mount.dataset.root, depth = mount.dataset.depth || 'all';
let currentView = mount.dataset.view || 'family';
let collapsed = new Set((mount.dataset.collapsed || '').split(',').filter(Boolean));
let expandedAncestors = new Set((mount.dataset.expanded || '').split(',').filter(Boolean));
let sibExpanded = new Set((mount.dataset.sibexp || '').split(',').filter(Boolean));
let minimizedAncestors = new Set((mount.dataset.minimized || '').split(',').filter(Boolean));
let showSiblings = mount.dataset.siblings === '1';
let nodes = [], edges = [], buses = [], worldW = 1, worldH = 1, totalPeople = 0;
let scale = 1, tx = 0, ty = 0, selected = null, highlightIds = new Set();
const settingsKey = 'heritage-viewer-settings';
console.info('[heritage] viewer build ${BUILD_ID} \u2014 hard-refresh after server restarts; check x-heritage-build header to confirm');
let settings = { showPhotos: false, showYears: true, defaultView: 'family' };
try { Object.assign(settings, JSON.parse(localStorage.getItem(settingsKey) || '{}')); } catch {}
if (!['family', 'pedigree', 'fan'].includes(settings.defaultView)) settings.defaultView = 'family';
const saveSettings = () => { try { localStorage.setItem(settingsKey, JSON.stringify(settings)); } catch {} };
const apply = () => viewport.setAttribute('transform', 'translate(' + tx + ' ' + ty + ') scale(' + scale + ')');
let viewport;
const el = (tag, attrs, text) => {
  const n = document.createElementNS(NS, tag);
  for (const k in attrs) n.setAttribute(k, attrs[k]);
  if (text !== undefined) n.textContent = text;
  return n;
};
function focusBranch(id, name, afterLoad) {
  root = id;
  rootName.textContent = name;
  collapsed.clear();
  expandedAncestors.clear();
  minimizedAncestors.clear();
  sibExpanded.clear();
  showSiblings = true;
  selected = null;
  highlightIds = new Set();
  drawer.hidden = true;
  suggestions.hidden = true;
  personSearch.value = '';
  load().then(() => { if (afterLoad) afterLoad(); });
}
let searchTimer = 0, searchRequest = 0;
async function searchPeople(term) {
  const requestId = ++searchRequest;
  if (term.trim().length < 2) { suggestions.hidden = true; return; }
  const res = await fetch('/api/people?q=' + encodeURIComponent(term.trim()));
  if (!res.ok || requestId !== searchRequest) return;
  const data = await res.json();
  if (requestId !== searchRequest) return;
  suggestions.replaceChildren();
  for (const person of data.people) {
    const option = document.createElement('button');
    option.type = 'button'; option.className = 'person-suggestion'; option.textContent = person.name;
    option.addEventListener('click', () => focusBranch(person.id, person.name));
    suggestions.appendChild(option);
  }
  if (!data.people.length) {
    const empty = document.createElement('span'); empty.className = 'person-suggestion empty'; empty.textContent = 'No people found';
    suggestions.appendChild(empty);
  } else if (data.total > data.people.length) {
    const more = document.createElement('span'); more.className = 'person-suggestion empty'; more.textContent = 'Keep typing to narrow ' + data.total + ' matches';
    suggestions.appendChild(more);
  }
  suggestions.hidden = false;
}
async function load(syncUrl, recenter) {
  const q = new URLSearchParams({ root });
  q.set('view', currentView);
  q.set('depth', depth);
  if (collapsed.size) q.set('collapsed', [...collapsed].join(','));
  if (expandedAncestors.size) q.set('expand', [...expandedAncestors].join(','));
  if (minimizedAncestors.size) q.set('min', [...minimizedAncestors].join(','));
  if (sibExpanded.size) q.set('siblingsOf', [...sibExpanded].join(','));
  q.set('siblings', showSiblings ? '1' : '0');
  q.set('years', settings.showYears ? '1' : '0');
  q.set('photos', settings.showPhotos ? '1' : '0');
  if (syncUrl !== false) {
    const url = new URL(location.href);
    url.searchParams.set('root', root);
    if (currentView === 'family') url.searchParams.delete('view'); else url.searchParams.set('view', currentView);
    url.searchParams.set('depth', depth);
    if (collapsed.size) url.searchParams.set('collapsed', [...collapsed].join(',')); else url.searchParams.delete('collapsed');
    if (expandedAncestors.size) url.searchParams.set('expand', [...expandedAncestors].join(',')); else url.searchParams.delete('expand');
    if (minimizedAncestors.size) url.searchParams.set('min', [...minimizedAncestors].join(',')); else url.searchParams.delete('min');
    if (sibExpanded.size) url.searchParams.set('siblingsOf', [...sibExpanded].join(',')); else url.searchParams.delete('siblingsOf');
    url.searchParams.set('siblings', showSiblings ? '1' : '0');
    url.searchParams.set('years', settings.showYears ? '1' : '0');
    url.searchParams.set('photos', settings.showPhotos ? '1' : '0');
    history.replaceState(null, '', url);
  }
  const res = await fetch('/api/tree?' + q);
  if (!res.ok) { counts.textContent = 'tree failed to load'; return; }
  const data = await res.json();
  nodes = data.nodes; edges = data.edges; buses = data.buses || []; worldW = data.width; worldH = data.height; totalPeople = data.totalPeople;
  W = data.nodeWidth || W; H = data.nodeHeight || H; currentView = data.view || currentView;
  rootName.textContent = nodes.find(n => n.personId === root)?.name || 'Selected person';
  const siblingButton = document.getElementById('siblingsBtn');
  siblingButton.hidden = !data.siblingCount;
  siblingButton.textContent = showSiblings ? 'Hide siblings' : 'Show siblings (' + data.siblingCount + ')';
  siblingButton.setAttribute('aria-pressed', String(showSiblings));
  const notice = document.getElementById('treeNotice');
  notice.hidden = !data.truncatedCount;
  notice.textContent = data.truncatedCount ? 'Showing a limited branch for performance. Search or focus on a person to explore other branches.' : '';
  counts.textContent = nodes.length + ' people shown';
  draw();
  if (recenter !== false) centerOnRoot();
}
function draw() {
  svg.replaceChildren();
  viewport = el('g', {});
  svg.appendChild(viewport);
  const byId = new Map(nodes.map(n => [n.personId, n]));
  // MyHeritage Family-view wiring: spouses read as a couple by proximity
  // (no bar between cards); children hang off a horizontal bus dropped
  // from the parents' midpoint. Every corner is rounded (radius R) exactly
  // like MyHeritage \u2014 the server precomputes bus geometry, we fillet here.
  const WIRE = '#8a9aa8';
  // Generous MyHeritage-like corner radius (~0.09 \xD7 card width). Crowded
  // ends (a kid within one diameter of the drop) stay straight instead.
  const R = 20;
  const sameX = (a, b) => Math.abs(a - b) < 0.01;
  const path = (d) => viewport.appendChild(el('path', { d, fill: 'none', stroke: WIRE, 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }));
  for (const e of edges) {
    const a = byId.get(e.from), b = byId.get(e.to);
    if (!a || !b) continue;
    if (currentView === 'fan') {
      const x1 = a.x + W / 2, y1 = a.y + H / 2, x2 = b.x + W / 2, y2 = b.y + H / 2;
      viewport.appendChild(el('path', { d: 'M' + x1 + ' ' + y1 + ' Q' + (worldW / 2) + ' ' + (worldH - H / 2) + ' ' + x2 + ' ' + y2, fill: 'none', stroke: '#879a8b', 'stroke-width': 1.25 }));
    } else if (e.kind === 'parent' && !buses.length) {
      const x1 = a.x + W / 2, y1 = a.y + H, x2 = b.x + W / 2, y2 = b.y;
      if (y2 <= y1) continue;
      const mid = (y1 + y2) / 2, s = x2 >= x1 ? 1 : -1;
      if (Math.abs(x2 - x1) < 2 * R || (mid - y1) < R || (y2 - mid) < R) {
        path('M' + x1 + ' ' + y1 + ' V' + mid + ' H' + x2 + ' V' + y2);
      } else {
        path('M' + x1 + ' ' + y1 + ' V' + (mid - R) + ' Q' + x1 + ' ' + mid + ' ' + (x1 + s * R) + ' ' + mid + ' H' + (x2 - s * R) + ' Q' + x2 + ' ' + mid + ' ' + x2 + ' ' + (mid + R) + ' V' + y2);
      }
    }
  }
  for (const b of buses) {
    const legs = Array.isArray(b.legs) && b.legs.length ? [...b.legs].sort((p, q) => p - q) : [b.x];
    const pbot = typeof b.pbot === 'number' ? b.pbot : b.top;
    const span = [...legs, ...b.kids];
    const left = Math.min(...span), right = Math.max(...span);
    if (sameX(left, right)) {
      path('M' + left + ' ' + Math.min(pbot, b.kidTop) + ' V' + Math.max(pbot, b.kidTop));
      continue;
    }
    // Rounded elbows at every bus span end \u2014 whether the vertical is a
    // parent drop (card\u2192bus) or a child drop (bus\u2192card). Exactly one curve
    // per end (kid wins if both share the end); the bus meets elbow tips.
    const roomy = right - left > 2 * R + 4;
    const legAt = (x) => legs.some((v) => sameX(v, x));
    const kidAt = (x) => b.kids.some((kx) => sameX(kx, x));
    const elbowLeft = roomy && (kidAt(left) || (!kidAt(left) && legAt(left)));
    const elbowRight = roomy && (kidAt(right) || (!kidAt(right) && legAt(right)));
    // Parent drops: straight verticals; rounded elbow only at bus ends.
    for (const lx of legs) {
      if (sameX(lx, left) && elbowLeft && !kidAt(left)) {
        path('M' + lx + ' ' + pbot + ' V' + (b.bus - R) + ' Q' + lx + ' ' + b.bus + ' ' + (lx + R) + ' ' + b.bus);
      } else if (sameX(lx, right) && elbowRight && !kidAt(right)) {
        path('M' + lx + ' ' + pbot + ' V' + (b.bus - R) + ' Q' + lx + ' ' + b.bus + ' ' + (lx - R) + ' ' + b.bus);
      } else {
        path('M' + lx + ' ' + pbot + ' V' + b.bus);
      }
    }
    // Kid drops: rounded elbow at bus ends, straight T-joint in the middle.
    for (const kx of b.kids) {
      if (sameX(kx, left) && elbowLeft) {
        path('M' + (kx + R) + ' ' + b.bus + ' Q' + kx + ' ' + b.bus + ' ' + kx + ' ' + (b.bus + R) + ' V' + b.kidTop);
      } else if (sameX(kx, right) && elbowRight) {
        path('M' + (kx - R) + ' ' + b.bus + ' Q' + kx + ' ' + b.bus + ' ' + kx + ' ' + (b.bus + R) + ' V' + b.kidTop);
      } else {
        path('M' + kx + ' ' + b.bus + ' V' + b.kidTop);
      }
    }
    // Bus bar meets elbow tips exactly \u2014 tangent-continuous, never overlaps.
    const h0 = left + (elbowLeft ? R : 0), h1 = right - (elbowRight ? R : 0);
    path('M' + h0 + ' ' + b.bus + ' H' + Math.max(h1, h0));
  }
  const search = (document.getElementById('treeSearch').value || '').trim().toLowerCase();
  const matchCount = search ? nodes.filter(n => n.name.toLowerCase().includes(search)).length : nodes.length;
  counts.textContent = search
    ? (matchCount ? matchCount + ' match' + (matchCount === 1 ? '' : 'es') : 'No matches') + ' \xB7 ' + totalPeople + ' in tree'
    : nodes.length + ' shown \xB7 ' + totalPeople + ' in tree';
  for (const n of nodes) {
    const matches = !search || n.name.toLowerCase().includes(search);
    const sexCls = n.sex === 'M' ? 'sex-m' : n.sex === 'F' ? 'sex-f' : 'sex-u';
    const g = el('g', { class: 'node ' + sexCls + (selected === n.personId ? ' selected' : '') + (n.isFocus ? ' focus' : '') + (highlightIds.has(n.personId) ? ' sib' : '') + (!matches ? ' dimmed' : ''), tabindex: '0', role: 'button', 'aria-label': n.name });
    if (currentView === 'fan') {
      const fanColors = ['#dce9df','#c8ddce','#b6d0bf','#a2c1ae','#8eaf9a','#7a9d87','#688d75'];
      const radius = Math.min(W, H) * 0.34;
      const cx = n.x + W / 2, cy = n.y + H / 2;
      if (settings.showPhotos) {
        const initials = n.name.split(/\\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase();
        g.appendChild(el('circle', { class: 'fan-person', cx, cy, r: radius, fill: fanColors[Math.min(fanColors.length - 1, Math.abs(n.generation))] }));
        g.appendChild(el('text', { class: 'fan-initials', x: cx, y: cy + 4, 'font-size': 11, 'text-anchor': 'middle' }, initials || '?'));
      }
      const shortName = n.name.split(/\\s+/).filter(Boolean).slice(-1)[0] || n.name;
      g.appendChild(el('text', { class: 'fan-name', x: cx, y: cy + radius + 14, 'font-size': 9, 'text-anchor': 'middle' }, shortName.length > 12 ? shortName.slice(0, 11) + '\u2026' : shortName));
      g.appendChild(el('title', {}, n.name));
    } else {
      const nh = n.h || H;
      g.appendChild(el('rect', { x: n.x, y: n.y, width: W, height: nh, rx: 8, class: n.isFocus ? 'focus-card' : '' }));
      // MyHeritage horizontal cards: name (+ years) only when photos are
      // off; round avatar left of the text when photos are on.
      let textX = n.x + 12;
      if (settings.showPhotos) {
        const avatarSize = Math.min(44, nh - 16);
        const avatarX = n.x + 14 + avatarSize / 2;
        const avatarY = n.y + nh / 2;
        const avKind = n.sex === 'M' ? 'm' : n.sex === 'F' ? 'f' : 'u';
        if (n.photo && new RegExp('^https?://', 'i').test(n.photo)) {
          g.appendChild(el('image', { href: n.photo, x: avatarX - avatarSize / 2, y: avatarY - avatarSize / 2, width: avatarSize, height: avatarSize, preserveAspectRatio: 'xMidYMid slice' }));
        } else {
          const initials = n.name.split(/\\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase();
          g.appendChild(el('circle', { class: 'node-avatar-' + avKind, cx: avatarX, cy: avatarY, r: avatarSize / 2 }));
          g.appendChild(el('text', { class: 'node-initials-' + avKind, x: avatarX, y: avatarY + 4.5, 'font-size': 13, 'text-anchor': 'middle' }, initials || '?'));
        }
        textX = n.x + avatarSize + 24;
      }
      const nameLines = Array.isArray(n.nameLines) && n.nameLines.length ? n.nameLines : [n.name];
      const nameY = settings.showYears ? n.y + 40 : n.y + nh / 2 + 5;
      nameLines.forEach((line) => {
        g.appendChild(el('text', { class: 'node-name', x: textX, y: nameY, 'font-size': 14 }, line.length > 26 ? line.slice(0, 25) + '\u2026' : line));
      });
      g.appendChild(el('title', {}, n.name));
      if (settings.showYears) {
        const years = [n.birthYear, n.deathYear].filter(Boolean).join(' \u2013 ');
        g.appendChild(el('text', { class: 'node-sub', x: textX, y: n.y + nh - 14, 'font-size': 12 }, years || (!n.living ? 'Deceased' : 'Living')));
      }
    }
    // Descendant toggle below the card, mirroring the ancestor toggle
    // above: persistent "+ N" pill only while descendants are hidden
    // (collapsed or depth-capped); a plain hover "\u2212" while shown.
    if (n.hasDescendants && currentView === 'family') {
      const hidden = n.collapsed || n.atDepthLimit;
      if (hidden) {
        const pill = el('a', { href: '#', role: 'button', 'aria-label': 'Expand branch of ' + n.name + ' (' + n.descendantCount + ' descendants)', title: 'Expand this branch' });
        const px = n.x + W / 2, py = n.y + (n.h || H) + 12;
        pill.appendChild(el('rect', { x: px - 30, y: py - 10, width: 60, height: 20, rx: 10, class: 'branch-pill' }));
        pill.appendChild(el('text', { x: px, y: py + 4, 'font-size': 11, 'text-anchor': 'middle', class: 'branch-pill-text' }, '+ ' + n.descendantCount));
        pill.addEventListener('click', ev => {
          ev.preventDefault(); ev.stopPropagation();
          if (n.collapsed) n.branchFamilyIds.forEach(id => collapsed.delete(id));
          else if (n.atDepthLimit && depth) depth = String(Math.min(12, Number(depth) + 1));
          load();
        });
        pill.addEventListener('pointerdown', ev => ev.stopPropagation());
        viewport.appendChild(pill);
      } else {
        const min = el('a', { href: '#', role: 'button', 'aria-label': 'Collapse branch of ' + n.name + ' (' + n.descendantCount + ' descendants)', title: 'Minimize this branch', class: 'branch-toggle' });
        min.appendChild(el('circle', { class: 'node-add-bg', cx: n.x + W / 2, cy: n.y + (n.h || H) + 14, r: 11 }));
        min.appendChild(el('text', { class: 'node-add', x: n.x + W / 2, y: n.y + (n.h || H) + 19, 'font-size': 14, 'text-anchor': 'middle' }, '\u2212'));
        min.addEventListener('click', ev => { ev.preventDefault(); ev.stopPropagation(); n.branchFamilyIds.forEach(id => collapsed.add(id)); load(); });
        min.addEventListener('pointerdown', ev => ev.stopPropagation());
        g.appendChild(min);
      }
    }
    // Per-card upstream toggle above the card (MyHeritage branch-icon spot):
    // \u2191 maximizes a hidden parent line (in-law, depth cap, minimized);
    // \u2212 minimizes a shown one. Each line toggles independently \u2014 expanding
    // never minimizes the others, minimizing re-runs the whole layout so
    // everything visible repositions tidily.
    // Ancestor toggle above the card \u2014 the mirror of the descendant pill
    // below: "\u2191 N" maximizes N hidden ancestors (in-law line, depth cap,
    // minimized), "\u2212" on hover minimizes a shown line. Same per-line logic
    // both ways: independent toggles, URL state, full layout recompute.
    if (n.hiddenAncestorCount > 0 && currentView === 'family') {
      const up = el('a', { href: '#', role: 'button', 'aria-label': 'Show ' + n.hiddenAncestorCount + ' hidden ancestors of ' + n.name, title: 'Show this parent line (' + n.hiddenAncestorCount + ' hidden)', class: 'branch-toggle always' });
      const px = n.x + W / 2, py = n.y - 12;
      up.appendChild(el('rect', { x: px - 30, y: py - 10, width: 60, height: 20, rx: 10, class: 'branch-pill' }));
      up.appendChild(el('text', { x: px, y: py + 4, 'font-size': 11, 'text-anchor': 'middle', class: 'branch-pill-text' }, '\u2191 ' + n.hiddenAncestorCount));
      up.addEventListener('click', ev => { ev.preventDefault(); ev.stopPropagation(); minimizedAncestors.delete(n.personId); expandedAncestors.add(n.personId); load(); });
      up.addEventListener('pointerdown', ev => ev.stopPropagation());
      g.appendChild(up);
    } else if (n.hasAncestors && !n.hasHiddenParents && currentView === 'family') {
      const down = el('a', { href: '#', role: 'button', 'aria-label': 'Hide parents of ' + n.name, title: 'Minimize this parent line', class: 'branch-toggle' });
      down.appendChild(el('circle', { class: 'node-add-bg', cx: n.x + W / 2, cy: n.y - 14, r: 11 }));
      down.appendChild(el('text', { class: 'node-add', x: n.x + W / 2, y: n.y - 9, 'font-size': 14, 'text-anchor': 'middle' }, '\u2212'));
      down.addEventListener('click', ev => { ev.preventDefault(); ev.stopPropagation(); minimizedAncestors.add(n.personId); load(); });
      down.addEventListener('pointerdown', ev => ev.stopPropagation());
      g.appendChild(down);
    }
    g.addEventListener('pointerdown', ev => ev.stopPropagation());
    g.addEventListener('click', ev => { ev.stopPropagation(); select(n.personId); });
    g.addEventListener('keydown', ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); select(n.personId); } });
    g.addEventListener('dblclick', ev => { ev.stopPropagation(); focusBranch(n.personId, n.name); });
    viewport.appendChild(g);
  }
  apply();
}
function fit() {
  const r = svg.getBoundingClientRect();
  scale = Math.min(r.width / Math.max(worldW, 1), r.height / Math.max(worldH, 1), 1.35);
  tx = (r.width - worldW * scale) / 2; ty = (r.height - worldH * scale) / 2;
  apply();
}
// MyHeritage opens centered on the main person at reading zoom, not
// fit-to-width (wide ancestor pyramids would shrink cards to dots).
function centerOnRoot() {
  const r = svg.getBoundingClientRect();
  const me = nodes.find(n => n.personId === root) || nodes.find(n => n.isFocus);
  scale = 1;
  const cx = me ? me.x + W / 2 : worldW / 2;
  const cy = me ? me.y + (me.h || H) / 2 : worldH / 2;
  tx = r.width / 2 - cx * scale; ty = r.height / 2 - cy * scale;
  apply();
}
function zoomAt(cx, cy, factor) {
  const next = Math.min(4, Math.max(0.15, scale * factor));
  tx = cx - (cx - tx) * (next / scale); ty = cy - (cy - ty) * (next / scale);
  scale = next; apply();
}
async function select(id) {
  selected = id;
  highlightIds = new Set();
  const me = nodes.find(n => n.personId === id);
  if (me) {
    const cx = me.x + W / 2;
    // Siblings: fellow kids off the same bus bars (geometry carries this;
    // the API below covers parents/partners/children by id instead).
    for (const b of buses) {
      if (b.kids.some(kx => Math.abs(kx - cx) < 0.01)) {
        for (const kx of b.kids) {
          const sib = nodes.find(n => Math.abs((n.x + W / 2) - kx) < 0.01);
          if (sib && sib.personId !== id) highlightIds.add(sib.personId);
        }
      }
    }
  }
  draw();
  const res = await fetch('/api/person/' + encodeURIComponent(id));
  if (!res.ok) return;
  const p = await res.json();
  // Trace the immediate family by id: parents, partners, children, plus
  // the geometric siblings above. Answers "whose child is this?" in one
  // click, at any generation.
  for (const list of [p.parents, p.partners, p.children, p.siblings || []]) {
    for (const q of list || []) {
      if (q && q.id !== id && nodes.some(n => n.personId === q.id)) highlightIds.add(q.id);
    }
  }
  draw();
  drawer.replaceChildren();
  const closeTop = document.createElement('button'); closeTop.type = 'button'; closeTop.className = 'icon-button drawer-close'; closeTop.setAttribute('aria-label', 'Close details'); closeTop.textContent = '\xD7';
  closeTop.addEventListener('click', () => { drawer.hidden = true; selected = null; highlightIds = new Set(); draw(); }); drawer.appendChild(closeTop);
  const h = document.createElement('h2'); h.textContent = p.name; drawer.appendChild(h);
  const meta = document.createElement('p'); meta.className = 'muted';
  meta.textContent = [p.sex, p.living ? 'living' : 'deceased', [p.birthYear, p.deathYear].filter(Boolean).join('\u2013')].filter(Boolean).join(' \xB7 ');
  drawer.appendChild(meta);
  const factTitle = document.createElement('h3'); factTitle.textContent = 'Life events'; drawer.appendChild(factTitle);
  const ul = document.createElement('div');
  for (const f of p.facts) {
    const li = document.createElement('div'); li.className = 'drawer-fact';
    li.textContent = f.type + (f.date ? ' ' + f.date : '') + (f.place ? ', ' + f.place : '');
    ul.appendChild(li);
  }
  if (!p.facts.length) { const li = document.createElement('div'); li.className = 'drawer-fact muted'; li.textContent = 'No life events yet'; ul.appendChild(li); }
  drawer.appendChild(ul);
  const rel = (title, list) => {
    const h3 = document.createElement('h3'); h3.textContent = title; drawer.appendChild(h3);
    const d = document.createElement('div');
    list.forEach((q, i) => {
      if (i) d.appendChild(document.createTextNode(', '));
      const a = document.createElement('a'); a.href = '#'; a.textContent = q.name;
      a.addEventListener('click', ev => { ev.preventDefault();
        if (!nodes.some(n => n.personId === q.id)) { focusBranch(q.id, q.name, () => select(q.id)); }
        else select(q.id);
      });
      d.appendChild(a);
    });
    if (!list.length) d.textContent = '\u2014';
    drawer.appendChild(d);
  };
  rel('Parents', p.parents); rel('Partners', p.partners); rel('Children', p.children);
  if ((p.siblingCount || 0) > 0) {
    const globallyShown = new URL(location.href).searchParams.get('siblings') !== '0';
    const shown = globallyShown || sibExpanded.has(p.id);
    if (!shown) {
      const sibBtn = document.createElement('button');
      sibBtn.type = 'button'; sibBtn.className = 'secondary'; sibBtn.style.marginTop = '10px';
      sibBtn.textContent = 'Show ' + p.siblingCount + ' sibling' + (p.siblingCount === 1 ? '' : 's');
      sibBtn.setAttribute('aria-pressed', 'false');
      sibBtn.addEventListener('click', () => {
        sibExpanded.add(p.id);
        load().then(() => select(p.id));
      });
      drawer.appendChild(sibBtn);
    }
  }
  const actions = document.createElement('div'); actions.className = 'drawer-actions';
  const ea = document.createElement('a'); ea.className = 'secondary'; ea.href = '/person/' + p.id; ea.textContent = 'Edit record';
  actions.appendChild(ea);
  const ka = document.createElement('a'); ka.className = 'primary'; ka.href = '/person/' + p.id + '#add-kin'; ka.textContent = 'Add family';
  actions.appendChild(ka); drawer.appendChild(actions);
  const focus = document.createElement('button'); focus.type = 'button'; focus.className = 'secondary'; focus.style.marginTop = '10px'; focus.textContent = 'Center tree here';
  focus.addEventListener('click', () => focusBranch(p.id, p.name));
  drawer.appendChild(focus);
  drawer.hidden = false;
}
let drag = null;
svg.addEventListener('pointerdown', ev => { drag = { x: ev.clientX, y: ev.clientY, tx, ty }; svg.setPointerCapture(ev.pointerId); });
svg.addEventListener('pointermove', ev => {
  if (!drag) return;
  tx = drag.tx + (ev.clientX - drag.x); ty = drag.ty + (ev.clientY - drag.y); apply();
});
svg.addEventListener('pointerup', () => { drag = null; });
svg.addEventListener('wheel', ev => {
  ev.preventDefault();
  const r = svg.getBoundingClientRect();
  zoomAt(ev.clientX - r.left, ev.clientY - r.top, ev.deltaY < 0 ? 1.12 : 1 / 1.12);
}, { passive: false });
svg.addEventListener('click', () => { drawer.hidden = true; selected = null; highlightIds = new Set(); draw(); });
document.addEventListener('keydown', ev => { if (ev.key === 'Escape' && !drawer.hidden) { drawer.hidden = true; selected = null; highlightIds = new Set(); draw(); } });
document.getElementById('fitBtn').addEventListener('click', fit);
document.getElementById('homeBtn').addEventListener('click', centerOnRoot);
document.getElementById('zoomIn').addEventListener('click', () => { const r = svg.getBoundingClientRect(); zoomAt(r.width / 2, r.height / 2, 1.25); });
document.getElementById('zoomOut').addEventListener('click', () => { const r = svg.getBoundingClientRect(); zoomAt(r.width / 2, r.height / 2, 1 / 1.25); });
document.getElementById('zoomReset').addEventListener('click', () => { scale = 1; const r = svg.getBoundingClientRect(); tx = (r.width - worldW) / 2; ty = (r.height - worldH) / 2; apply(); });
const fullBtn = document.getElementById('fullBtn');
if (!document.fullscreenEnabled) {
  fullBtn.hidden = true;
} else {
  fullBtn.addEventListener('click', () => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else { const p = mount.requestFullscreen(); if (p && p.catch) p.catch(() => {}); }
  });
  document.addEventListener('fullscreenchange', () => {
    const on = !!document.fullscreenElement;
    fullBtn.textContent = on ? '\u2921' : '\u26F6';
    fullBtn.setAttribute('aria-label', on ? 'Exit full screen' : 'View full screen');
    fit();
  });
}
const settingsBtn = document.getElementById('settingsBtn');
const settingsMenu = document.getElementById('settingsMenu');
const setPhotos = document.getElementById('setPhotos');
const setYears = document.getElementById('setYears');
const setDefaultView = document.getElementById('setDefaultView');
setPhotos.checked = settings.showPhotos;
setYears.checked = settings.showYears;
setDefaultView.value = settings.defaultView;
settingsBtn.addEventListener('click', ev => {
  ev.stopPropagation();
  const open = settingsMenu.hidden;
  settingsMenu.hidden = !open;
  settingsBtn.setAttribute('aria-expanded', String(open));
});
document.addEventListener('click', ev => {
  if (!ev.target.closest('.toolbar-menu-wrap')) { settingsMenu.hidden = true; settingsBtn.setAttribute('aria-expanded', 'false'); }
});
document.addEventListener('keydown', ev => {
  if (ev.key === 'Escape' && !settingsMenu.hidden) { settingsMenu.hidden = true; settingsBtn.setAttribute('aria-expanded', 'false'); }
});
setPhotos.addEventListener('change', () => { settings.showPhotos = setPhotos.checked; saveSettings(); load(undefined, false); });
setYears.addEventListener('change', () => { settings.showYears = setYears.checked; saveSettings(); load(undefined, false); });
setDefaultView.addEventListener('change', () => { settings.defaultView = setDefaultView.value; saveSettings(); });
const syncTabs = () => {
  document.querySelectorAll('.tree-view-tabs [role=tab]').forEach(a => {
    const tab = a.getAttribute('href').includes('view=pedigree') ? 'pedigree' : a.getAttribute('href').includes('view=fan') ? 'fan' : a.getAttribute('href').startsWith('/list') ? 'list' : 'family';
    const active = tab === currentView;
    a.classList.toggle('active', active);
    a.setAttribute('aria-selected', String(active));
  });
};
if (!new URL(location.href).searchParams.get('view') && settings.defaultView !== currentView) {
  currentView = settings.defaultView;
  syncTabs();
}
document.getElementById('depthSel').addEventListener('change', ev => { depth = ev.target.value; load(); });
document.getElementById('siblingsBtn').addEventListener('click', () => { showSiblings = !showSiblings; load(); });
personSearch.addEventListener('input', () => {
  draw(); clearTimeout(searchTimer);
  searchTimer = setTimeout(() => searchPeople(personSearch.value), 180);
});
personSearch.addEventListener('keydown', ev => {
  if (ev.key === 'Escape') { suggestions.hidden = true; return; }
  if (ev.key !== 'Enter') return;
  ev.preventDefault();
  const first = suggestions.querySelector('button.person-suggestion');
  if (first) first.click();
});
document.addEventListener('click', ev => { if (!ev.target.closest('.toolbar-search')) suggestions.hidden = true; });
load();
})();`;
var byId = (tree) => new Map(tree.persons.map((p) => [p.id, p]));
function familyPage(tree, rootId, depth, collapsedFamilyIds = new Set, expandedAncestorIds = new Set, showSiblings = false, siblingPersonIds = new Set, view = "family", minimizedAncestorIds = new Set) {
  if (tree.persons.length === 0) {
    return shell("Family tree", `<div class="panel empty-panel"><div><p class="eyebrow">Your family archive</p><h2>Start your family tree</h2><p>Add a person to begin building your family history, or bring in a tree you already have.</p>
      <form class="quick-add" method="post" action="/person/new"><input name="given" placeholder="First name" aria-label="First name" required><input name="surname" placeholder="Last name" aria-label="Last name"><button class="primary">Add person</button></form>
      <div class="empty-divider">Already have a family tree? <a href="/import">Import a GEDCOM file</a></div></div>
      <div class="empty-illustration" aria-hidden="true"><svg viewBox="0 0 160 160" fill="none"><path d="M80 142V93M80 111 51 83M80 111l29-28M51 83V51M109 83V51M80 93V43" stroke="#73917d" stroke-width="3" stroke-linecap="round"/><path d="M35 48c0-9 7-16 16-16s16 7 16 16-7 16-16 16-16-7-16-16ZM93 48c0-9 7-16 16-16s16 7 16 16-7 16-16 16-16-7-16-16ZM64 39c0-9 7-16 16-16s16 7 16 16-7 16-16 16-16-7-16-16Z" fill="#fff" stroke="#73917d" stroke-width="3"/><circle cx="80" cy="126" r="15" fill="#dfece2" stroke="#73917d" stroke-width="3"/></svg></div></div>`, "tree");
  }
  const root = rootId && tree.persons.some((p) => p.id === rootId) ? rootId : tree.persons[0].id;
  const depthValue = depth === undefined ? view === "family" ? "all" : "5" : Number.isFinite(depth) ? String(depth) : "all";
  const depthOptions = view === "family" ? ["1", "2", "3", "4", "5", "6", "12", "all"] : view === "fan" ? ["3", "4", "5", "6", "7", "8", "9"] : ["1", "2", "3", "4", "5", "11", "all"];
  const depths = depthOptions.map((d) => {
    const label = d === "all" ? "All generations" : view === "family" ? d + (d === "1" ? " generation" : " generations") : `${Number(d) + 1} generations`;
    return `<option value="${d}"${depthValue === d ? " selected" : ""}>${label}</option>`;
  }).join("");
  const rootPerson = tree.persons.find((p) => p.id === root);
  const siblingCount = view === "family" ? new Set(rootPerson.famc.flatMap((link) => tree.families.find((f) => f.id === link.familyId)?.children ?? []).filter((id) => id !== root)).size : 0;
  const viewTitle = view === "pedigree" ? "Pedigree view" : view === "fan" ? "Fan view" : "Family tree";
  const viewDescription = view === "pedigree" ? "Follow direct ancestors back through the generations." : view === "fan" ? "See gaps and connections across your ancestor branches." : "Explore your family connections. Select a person to see their story.";
  const fallback = tree.persons.map((p) => `<li><a href="/person/${p.id}">${esc(preferredName(p))}</a></li>`).join("");
  return shell(viewTitle, `<div class="page-heading"><div><p class="eyebrow">Family archive</p><h1>${viewTitle}</h1><p>${viewDescription}</p></div><div class="heading-actions"><a class="primary" href="/person/new"><span aria-hidden="true">\uFF0B</span> Add person</a></div></div>
    <div class="tree-view-tabs" role="tablist" aria-label="Tree views"><a role="tab" aria-selected="${view === "family"}" class="${view === "family" ? "active" : ""}" href="/?root=${encodeURIComponent(root)}">Family</a><a role="tab" aria-selected="${view === "pedigree"}" class="${view === "pedigree" ? "active" : ""}" href="/?view=pedigree&amp;root=${encodeURIComponent(root)}">Pedigree</a><a role="tab" aria-selected="${view === "fan"}" class="${view === "fan" ? "active" : ""}" href="/?view=fan&amp;root=${encodeURIComponent(root)}">Fan</a><a role="tab" aria-selected="false" href="/list">List</a></div>
    <div id="toolbar" role="toolbar" aria-label="Tree controls">
      <label>Branch <strong id="rootName">${esc(preferredName(rootPerson))}</strong></label>
      <label>Generations <select id="depthSel" aria-label="Number of generations">${depths}</select></label>
      <button id="siblingsBtn" class="secondary" type="button"${siblingCount ? "" : " hidden"} aria-pressed="${showSiblings}">${showSiblings ? "Hide siblings" : `Show siblings (${siblingCount})`}</button>
      <span class="control-divider"></span>
      <label class="toolbar-search"><span aria-hidden="true">\u2315</span><input id="treeSearch" type="search" placeholder="Search everyone" aria-label="Search everyone in the tree" autocomplete="off"><div id="personSuggestions" class="person-suggestions" role="listbox" hidden></div></label>
      <span class="toolbar-count" id="counts" aria-live="polite"></span>
      <div class="toolbar-menu-wrap">
        <button id="settingsBtn" class="icon-button" type="button" aria-label="Tree settings" aria-haspopup="true" aria-expanded="false">\u2699</button>
        <div id="settingsMenu" class="settings-menu" hidden role="menu" aria-label="Tree settings">
          <p class="settings-title">Cards show</p>
          <label class="check-option"><input id="setPhotos" type="checkbox"><span>Photos on cards</span></label>
          <label class="check-option"><input id="setYears" type="checkbox" checked><span>Birth and death years</span></label>
          <p class="settings-title">Default view</p>
          <label>Open tree in<select id="setDefaultView"><option value="family">Family</option><option value="pedigree">Pedigree</option><option value="fan">Fan</option></select></label>
        </div>
      </div>
    </div>
    <p id="treeNotice" class="tree-notice" hidden></p>
    <div id="viewer" data-root="${esc(root)}" data-view="${view}" data-depth="${depthValue}" data-collapsed="${esc([...collapsedFamilyIds].join(","))}" data-expanded="${esc([...expandedAncestorIds].join(","))}" data-minimized="${esc([...minimizedAncestorIds].join(","))}" data-siblings="${showSiblings ? "1" : "0"}" data-sibexp="${esc([...siblingPersonIds].join(","))}" data-w="${NODE_W}" data-h="${NODE_H}">
      <svg id="stage" role="img" aria-label="family tree"></svg>
      <aside id="drawer" hidden aria-label="person details"></aside>
      <div class="zoom-cluster" role="toolbar" aria-label="Zoom controls">
        <button id="zoomIn" class="icon-button" type="button" aria-label="Zoom in">\uFF0B</button>
        <button id="zoomOut" class="icon-button" type="button" aria-label="Zoom out">\u2212</button>
        <button id="zoomReset" class="icon-button" type="button" aria-label="Reset zoom">1:1</button>
        <button id="homeBtn" class="icon-button" type="button" aria-label="Center on main person" title="Center on main person">\u2302</button>
        <button id="fitBtn" class="icon-button" type="button" aria-label="Fit tree to view">\u2922</button>
        <button id="fullBtn" class="icon-button" type="button" aria-label="View full screen">\u26F6</button>
      </div>
      <noscript><ul>${fallback}</ul></noscript>
      <div class="canvas-hint">Drag to move \xB7 scroll to zoom \xB7 click a person for details</div>
      <div class="canvas-legend"><span><i class="legend-dot" style="background:#6fa8cf"></i>Male</span><span><i class="legend-dot" style="background:#d693a5"></i>Female</span></div>
    </div>
    <p class="quiet" style="margin:12px 2px 0">Tip: double-click a person to center the tree on them.</p>
    <script>${VIEWER_JS}</script>`, "tree");
}
function listPage(tree, q) {
  const rows = listPeople(tree, q);
  const opts = (v, options) => options.map(([val, label]) => `<option value="${val}"${v === val ? " selected" : ""}>${label}</option>`).join("");
  const trs = rows.map((r) => `<tr><td><div class="person-cell"><span class="mini-avatar">${esc(initialsFor(r.display))}</span><a class="person-link" href="/person/${r.personId}">${esc(r.display)}</a></div></td><td>${esc(r.birthYear ?? "\u2014")}</td><td>${esc(r.birthPlace ?? "\u2014")}</td><td>${esc(r.deathYear ?? "\u2014")}</td><td><a class="quiet" href="/person/${r.personId}">Open record</a></td></tr>`).join("");
  return shell("People", `<div class="page-heading"><div><p class="eyebrow">Family archive</p><h1>People</h1><p>Everyone in your family tree, all in one place.</p></div><div class="heading-actions"><a class="primary" href="/person/new">\uFF0B Add person</a></div></div>
    <form class="panel list-tools" method="get" action="/list"><label>Find by surname<input name="surname" type="search" placeholder="Try a surname" value="${esc(q.surname ?? "")}"></label>
    <label>Sort by<select name="sort">${opts(q.sort, [["surname", "Last name"], ["given", "First name"], ["birth", "Birth year"], ["death", "Death year"]])}</select></label>
    <button class="secondary">Update list</button><span class="result-count">${rows.length} ${rows.length === 1 ? "person" : "people"}</span></form>
    <div class="panel people-table-wrap"><table class="people-table"><thead><tr><th>Name</th><th>Born</th><th>Birthplace</th><th>Died</th><th></th></tr></thead><tbody>${trs || '<tr><td colspan="5" class="quiet">No people match that surname.</td></tr>'}</tbody></table></div>`, "people");
}
function personOptions(tree, exclude) {
  return tree.persons.filter((p) => p.id !== exclude).map((p) => `<option value="${p.id}">${esc(preferredName(p))}</option>`).join("");
}
function personPage(tree, p) {
  const persons = byId(tree);
  const photo = personalPhoto(p, tree);
  const facts = p.events.map((e) => `<tr><td>${esc(e.type)}</td><td>${esc(e.dateRaw ?? "")}</td><td>${esc(e.place?.raw ?? "")}</td>
        <td><form class="inline" method="post" action="/person/${p.id}/fact/delete"><input type="hidden" name="id" value="${e.id}"><button>delete</button></form></td></tr>`).join("");
  const rel = (ids) => ids.map((id) => `<a href="/person/${id}">${esc(preferredName(persons.get(id)))}</a>`).join(", ") || "\u2014";
  const kin = kinOf(tree, p);
  const fams = p.fams.map((fid) => tree.families.find((f) => f.id === fid)).filter(Boolean);
  const partners = kin.partners.map((q) => q.id);
  const children = kin.children.map((q) => q.id);
  const parents = kin.parents.map((q) => q.id);
  const detach = (fid, role) => `<form class="inline" method="post" action="/person/${p.id}/detach"><input type="hidden" name="family" value="${fid}"><input type="hidden" name="role" value="${role}"><button>detach</button></form>`;
  const famsRows = fams.map((f) => `<li>With ${rel(f.partners.filter((id) => id !== p.id)) || "no partner"}<div class="quiet">Children: ${rel(f.children) || "none recorded"}</div>${detach(f.id, "partner")}</li>`).join("");
  return shell(preferredName(p), `<div class="page-heading"><div><p class="eyebrow"><a href="/">Family tree</a> / Person record</p><h1>${esc(preferredName(p) || "Unnamed person")}</h1><p>${lifeYears(p) ? esc(lifeYears(p)) + " \xB7 " : ""}${p.isLiving ? "Living" : "Deceased"}${p.private ? " \xB7 Private" : ""}</p></div><div class="heading-actions"><a class="secondary" href="/">\u2190 Back to tree</a></div></div>
    <div class="record-grid"><div class="record-main">
      <section class="panel section-card"><h2>Personal details</h2><form method="post" action="/person/${p.id}/edit">
      <div class="form-grid"><label>First name<input name="given" value="${esc(p.names[0]?.given ?? "")}" autocomplete="given-name"></label>
      <label>Last name<input name="surname" value="${esc(p.names[0]?.surname ?? "")}" autocomplete="family-name"></label>
      <label>Preferred display name<input name="display" placeholder="Optional name"></label>
      <label>Gender<select name="sex"><option value="U" ${p.sex === "U" ? "selected" : ""}>Not specified</option><option value="F" ${p.sex === "F" ? "selected" : ""}>Female</option><option value="M" ${p.sex === "M" ? "selected" : ""}>Male</option><option value="X" ${p.sex === "X" ? "selected" : ""}>Another identity</option></select></label>
      <label class="span-2">Biography<textarea name="biography" rows="3" placeholder="A short life story">${esc(p.biography)}</textarea></label>
      <label class="check-option"><input type="checkbox" name="living" value="1"${p.isLiving ? " checked" : ""}><span>Living person</span></label>
      <label class="check-option"><input type="checkbox" name="private" value="1"${p.private ? " checked" : ""}><span>Keep private when sharing</span></label></div>
      <div class="form-actions"><button class="primary">Save details</button></div></form></section>
      <section class="panel section-card"><h2>Life events</h2><table class="fact-list"><thead><tr><th>Event</th><th>Date</th><th>Place</th><th></th></tr></thead><tbody>${facts || '<tr><td colspan="4" class="quiet">No events recorded yet.</td></tr>'}</tbody></table>
      <h3>Add an event</h3><form class="form-grid" method="post" action="/person/${p.id}/fact"><label>Event type<input name="type" placeholder="Birth, marriage\u2026" required></label><label>Date<input name="date" placeholder="10 Dec 1815"></label><label class="span-2">Place<input name="place" placeholder="City, region, country"></label><div class="span-2 form-actions"><button class="secondary">Add event</button></div></form></section>
      <section class="panel section-card"><h2>Family connections</h2><h3>Parents</h3><ul class="relation-list">${parents.map((id) => `<li>${rel([id])}</li>`).join("") || '<li class="quiet">No parents linked yet.</li>'}</ul><h3>Partners and children</h3><ul class="relation-list">${famsRows || '<li class="quiet">No partners or children linked yet.</li>'}</ul></section>
    </div><aside class="record-side">
      <section class="panel section-card" id="add-kin"><h2>Add family</h2><form class="stack-form" method="post" action="/person/${p.id}/relation">
      <label>Relationship<select name="kind"><option value="child">Child</option><option value="parent">Parent</option><option value="spouse">Partner or spouse</option><option value="sibling">Sibling</option></select></label>
      <div class="pair"><label>First name<input name="given" placeholder="First name"></label><label>Last name<input name="surname" placeholder="Last name"></label></div>
      <label>Or link an existing person<select name="existing"><option value="">Create a new person</option>${personOptions(tree, p.id)}</select></label>
      <label>Parent relationship<select name="pedi"><option value="">Biological / not specified</option><option value="adoptive">Adoptive</option><option value="foster">Foster</option></select></label>
      <button class="primary">Add relationship</button></form></section>
      <section class="panel section-card"><h2>Portrait</h2>${photo ? `<div class="quiet">Current photo: ${esc(photo.title ?? photo.path)}</div>` : '<p class="quiet">Add a photo link to recognize this person in the tree.</p>'}<form class="stack-form" method="post" action="/person/${p.id}/photo"><label>Photo URL or sidecar path<input name="path" placeholder="media/portrait.jpg or https://\u2026" required></label><label>Caption<input name="title" placeholder="Photo caption"></label><div class="pair"><label>Date<input name="date" placeholder="Year or date"></label><label>Place<input name="place" placeholder="Place"></label></div><button class="secondary">Set portrait</button></form></section>
      <section class="panel section-card"><h2>Research notes</h2><ul class="relation-list">${p.researchNotes.map((n) => `<li>${esc(n)}</li>`).join("") || '<li class="quiet">No research notes yet.</li>'}</ul><form class="stack-form" method="post" action="/person/${p.id}/note"><label>Add a note<textarea name="text" rows="2" placeholder="Source leads, questions, context" required></textarea></label><button class="secondary">Save note</button></form></section>
    </aside></div>`, "people");
}
function newPersonPage() {
  return shell("New person", `<div class="page-heading"><div><p class="eyebrow"><a href="/list">People</a> / New record</p><h1>Add a person</h1><p>Start with a name. You can fill in dates and relationships later.</p></div><a href="/list" class="secondary">Cancel</a></div><section class="panel section-card" style="max-width:680px"><form class="form-grid" method="post" action="/person/new"><label>First name<input name="given" placeholder="First name" required autofocus></label><label>Last name<input name="surname" placeholder="Last name"></label><div class="span-2 form-actions"><button class="primary">Create person</button></div></form></section>`, "people");
}
function importPage(report) {
  const rep = report ? `<section class="panel import-report"><h2>Import complete</h2><p class="quiet">GEDCOM ${esc(report.version)} \xB7 ${esc(report.encoding)}${report.hadBom ? " \xB7 BOM" : ""}</p><div class="report-stats">${[[report.counts.individuals, "People"], [report.counts.families, "Families"], [report.counts.notes, "Notes"], [report.counts.sources, "Sources"], [report.counts.media, "Media"]].map(([n, label]) => `<div class="stat"><strong>${n}</strong><span>${label}</span></div>`).join("")}</div><h3>${report.warnings.length ? "Things to review" : "Everything imported cleanly"}</h3><ul>${report.warnings.map((w) => `<li><b>${esc(w.code)}</b> ${esc(w.message)}</li>`).join("") || "<li>No warnings were reported.</li>"}</ul><a class="primary" href="/">Open family tree</a></section>` : "";
  return shell("Import GEDCOM", `<div class="page-heading"><div><p class="eyebrow">Bring your research with you</p><h1>Import a family tree</h1><p>Upload a GEDCOM file to add its people, relationships, dates, and notes.</p></div></div><section class="panel upload-panel"><h2>Choose a GEDCOM file</h2><p class="quiet">Supported: GEDCOM 5.5, 5.5.1 and 7.x. Your current tree will be replaced by this import.</p><form method="post" action="/import" enctype="multipart/form-data"><div class="upload-zone"><input type="file" name="file" accept=".ged" required><p>Choose a .ged file from your device</p></div><button class="primary">Import family tree</button></form></section>${rep}`, "import");
}
function exportPage(tree) {
  const roots = personOptions(tree);
  return shell("Export", `<div class="page-heading"><div><p class="eyebrow">Take your research anywhere</p><h1>Export your tree</h1><p>Save a GEDCOM copy or share a branch with another genealogy tool.</p></div></div><section class="panel export-panel"><form method="get" action="/export.ged"><div class="option-row"><div><label for="branch">People to include</label><p>Choose the whole family or one person's descendant branch.</p></div><select id="branch" name="branch"><option value="">Whole tree</option>${roots}</select></div>
    <div class="option-row"><div><label for="living">Living people</label><p>Choose whether private details appear in the exported file.</p></div><select id="living" name="living"><option value="none">Include all details</option><option value="redact">Redact names and facts</option><option value="exclude">Exclude living people</option></select></div>
    <div class="option-row"><div><label for="media">Photos</label><p>GEDCOM contains links, not the photo files themselves.</p></div><label class="check-option"><input id="media" type="checkbox" name="media" value="0"><span>Exclude photo links</span></label></div>
    <div class="form-actions"><button class="primary">Download GEDCOM</button></div></form></section>`, "export");
}
function notFound(what) {
  return shell("Not found", `<section class="panel section-card"><p>We couldn't find ${esc(what)}.</p><a class="primary" href="/">Back to family tree</a></section>`);
}

// src/app/app.ts
var html = (body, status = 200) => new Response(body, {
  status,
  headers: {
    "content-type": "text/html; charset=utf-8",
    "x-heritage-build": BUILD_ID,
    "cache-control": "no-store"
  }
});
var seeOther = (location) => new Response(null, { status: 303, headers: { location } });
function replacePerson(tree, updated) {
  return { ...tree, persons: tree.persons.map((p) => p.id === updated.id ? updated : p) };
}
function replaceFamily(tree, updated) {
  return { ...tree, families: tree.families.map((f) => f.id === updated.id ? updated : f) };
}
function createApp(store) {
  return {
    fetch: async (req) => {
      const url = new URL(req.url);
      const path = url.pathname;
      try {
        return await route(store, req, url, path);
      } catch (err) {
        return html(notFound(err instanceof Error ? err.message : "page"), 404);
      }
    }
  };
}
var json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: {
    "content-type": "application/json",
    "x-heritage-build": BUILD_ID,
    "cache-control": "no-store"
  }
});
function parseView(url) {
  const view = url.searchParams.get("view");
  return view === "pedigree" || view === "fan" ? view : "family";
}
function parseDepth(url, view) {
  const raw = url.searchParams.get("depth");
  if (raw === null)
    return { depth: view === "family" ? Number.POSITIVE_INFINITY : 5 };
  if (raw === "")
    return { depth: view === "family" ? Number.POSITIVE_INFINITY : 5 };
  if (raw === "all")
    return { depth: Number.POSITIVE_INFINITY };
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0)
    return { depth: view === "family" ? Number.POSITIVE_INFINITY : 5 };
  return { depth: Math.min(12, Math.floor(n)) };
}
function parseSiblings(url) {
  return parseFlag(url, "siblings", true);
}
function parseFlag(url, param, fallback) {
  const raw = url.searchParams.get(param);
  if (raw === null)
    return fallback;
  return raw !== "0" && raw.toLowerCase() !== "false";
}
function parseIdSet(url, param) {
  return new Set((url.searchParams.get(param) ?? "").split(",").map((id) => id.trim()).filter(Boolean).slice(0, 500));
}
function personSummary(tree, p) {
  const birth = preferredEvent(p.events, "BIRT");
  const death = preferredEvent(p.events, "DEAT");
  return {
    id: p.id,
    name: preferredName(p) || "(no name)",
    nameLines: wrapDisplayName(preferredName(p) || "(no name)"),
    sex: p.sex,
    living: p.isLiving,
    birthYear: yearOf(birth?.dateRaw),
    deathYear: yearOf(death?.dateRaw),
    photo: personalPhoto(p, tree)?.path
  };
}
async function route(store, req, url, path) {
  if (req.method === "GET" && path === "/api/people") {
    const query = (url.searchParams.get("q") ?? "").trim().toLowerCase();
    if (query.length < 2)
      return json({ people: [], total: 0 });
    const matches = store.tree.persons.filter((person) => {
      const name = preferredName(person).toLowerCase();
      return name.includes(query);
    });
    return json({
      total: matches.length,
      people: matches.slice(0, 20).map((person) => ({ id: person.id, name: preferredName(person) || "(no name)" }))
    });
  }
  if (req.method === "GET" && path === "/api/tree") {
    if (store.tree.persons.length === 0)
      return json({ root: null, nodes: [], edges: [], width: 0, height: 0 });
    const root = url.searchParams.get("root") ?? store.tree.persons[0].id;
    const view = parseView(url);
    try {
      const layout = familyLayout(store.tree, root, {
        ...parseDepth(url, view),
        collapsedFamilyIds: parseIdSet(url, "collapsed"),
        expandedAncestorIds: parseIdSet(url, "expand"),
        minimizedAncestorIds: parseIdSet(url, "min"),
        showSiblings: parseSiblings(url),
        siblingPersonIds: parseIdSet(url, "siblingsOf"),
        showYears: parseFlag(url, "years", true),
        showPhotos: parseFlag(url, "photos", false),
        view
      });
      const summaries = new Map(store.tree.persons.map((p) => [p.id, personSummary(store.tree, p)]));
      return json({
        root,
        totalPeople: store.tree.persons.length,
        width: layout.width,
        height: layout.height,
        siblingCount: layout.siblingCount,
        showSiblings: layout.showSiblings,
        truncatedCount: layout.truncatedCount,
        nodeWidth: layout.nodeWidth,
        nodeHeight: layout.nodeHeight,
        view: layout.view,
        nodes: layout.nodes.map((n) => ({ ...n, ...summaries.get(n.personId) })),
        edges: layout.edges,
        buses: layout.buses
      });
    } catch {
      return json({ error: "person not found" }, 404);
    }
  }
  const apiPerson = /^\/api\/person\/([^/]+)$/.exec(path);
  if (req.method === "GET" && apiPerson) {
    const p = store.tree.persons.find((q) => q.id === apiPerson[1]);
    if (!p)
      return json({ error: "person not found" }, 404);
    const nameOf = (q) => preferredName(q) || "(no name)";
    const kin = kinOf(store.tree, p);
    const brief = (q) => ({ id: q.id, name: nameOf(q) });
    const siblingIds = new Set;
    for (const link of p.famc) {
      const fam = store.tree.families.find((f) => f.id === link.familyId);
      for (const child of fam?.children ?? [])
        if (child !== p.id)
          siblingIds.add(child);
    }
    return json({
      ...personSummary(store.tree, p),
      facts: p.events.map((e) => ({ type: e.type, date: e.dateRaw, place: e.place?.raw })),
      parents: kin.parents.map(brief),
      partners: kin.partners.map(brief),
      children: kin.children.map(brief),
      notes: p.researchNotes,
      siblingCount: siblingIds.size
    });
  }
  if (req.method === "GET" && path === "/") {
    const view = parseView(url);
    return html(familyPage(store.tree, url.searchParams.get("root") ?? undefined, url.searchParams.has("depth") ? parseDepth(url, view).depth : undefined, parseIdSet(url, "collapsed"), parseIdSet(url, "expand"), parseSiblings(url), parseIdSet(url, "siblingsOf"), view, parseIdSet(url, "min")));
  }
  if (req.method === "GET" && path === "/list") {
    return html(listPage(store.tree, {
      surname: url.searchParams.get("surname") ?? undefined,
      sort: url.searchParams.get("sort") ?? undefined
    }));
  }
  if (req.method === "GET" && path === "/person/new")
    return html(newPersonPage());
  if (req.method === "POST" && path === "/person/new") {
    const form = await req.formData();
    const p = createPerson({
      given: String(form.get("given") ?? ""),
      surname: String(form.get("surname") ?? "") || undefined
    });
    store.tree = { ...store.tree, persons: [...store.tree.persons, p] };
    return seeOther(`/person/${p.id}`);
  }
  const personMatch = /^\/person\/([^/]+)(\/.*)?$/.exec(path);
  if (personMatch) {
    const person = store.tree.persons.find((p) => p.id === personMatch[1]);
    if (!person)
      return html(notFound("person"), 404);
    const sub = personMatch[2] ?? "";
    if (req.method === "GET" && sub === "")
      return html(personPage(store.tree, person));
    if (req.method === "POST") {
      const form = await req.formData();
      return mutatePerson(store, person, sub, form);
    }
    return html(notFound("page"), 404);
  }
  if (req.method === "GET" && path === "/import") {
    return html(importPage(url.searchParams.get("report") ? store.lastReport : undefined));
  }
  if (req.method === "POST" && path === "/import") {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File))
      return html(notFound("file"), 400);
    const { tree, report } = importGedcom(new Uint8Array(await file.arrayBuffer()));
    store.tree = tree;
    store.lastReport = report;
    return seeOther("/import?report=1");
  }
  if (req.method === "GET" && path === "/export")
    return html(exportPage(store.tree));
  if (req.method === "GET" && path === "/export.ged") {
    const ged = exportGedcom(store.tree, {
      livingFilter: url.searchParams.get("living") ?? "none",
      includeMedia: url.searchParams.get("media") !== "0",
      branchRootId: url.searchParams.get("branch") ?? undefined
    });
    return new Response(ged, {
      headers: { "content-type": "text/plain; charset=utf-8", "content-disposition": 'attachment; filename="heritage.ged"' }
    });
  }
  return html(notFound("page"), 404);
}
function str(form, k) {
  const v = form.get(k);
  return v === null || v === "" ? undefined : String(v);
}
async function mutatePerson(store, person, sub, form) {
  switch (sub) {
    case "/edit": {
      let updated = updatePerson(person, {
        given: str(form, "given"),
        surname: str(form, "surname"),
        display: str(form, "display"),
        sex: str(form, "sex") ?? undefined,
        private: form.get("private") === "1",
        biography: str(form, "biography")
      });
      const living = form.get("living") === "1";
      updated = { ...updated, isLiving: living };
      store.tree = replacePerson(store.tree, updated);
      return seeOther(`/person/${person.id}`);
    }
    case "/fact": {
      const type = str(form, "type");
      if (!type)
        return seeOther(`/person/${person.id}`);
      const { person: updated } = addFact(person, { type, dateRaw: str(form, "date"), placeRaw: str(form, "place") });
      store.tree = replacePerson(store.tree, updated);
      return seeOther(`/person/${person.id}`);
    }
    case "/fact/delete": {
      const id = str(form, "id");
      if (id)
        store.tree = replacePerson(store.tree, deleteFact(person, id));
      return seeOther(`/person/${person.id}`);
    }
    case "/relation":
      return addRelation(store, person, form);
    case "/detach": {
      const fid = str(form, "family");
      const family = store.tree.families.find((f) => f.id === fid);
      if (!family)
        return seeOther(`/person/${person.id}`);
      if (str(form, "role") === "partner") {
        const { family: nf, updatedPartner } = detachPartner({ family, partnerId: person.id, partner: person });
        store.tree = replacePerson(replaceFamily(store.tree, nf), updatedPartner ?? person);
      } else {
        const { family: nf, updatedChild } = detachChild({ family, childId: person.id, child: person });
        store.tree = replacePerson(replaceFamily(store.tree, nf), updatedChild ?? person);
      }
      return seeOther(`/person/${person.id}`);
    }
    case "/photo": {
      const path = str(form, "path");
      if (!path)
        return seeOther(`/person/${person.id}`);
      const { tree: t1, media } = addMedia(store.tree, {
        path,
        title: str(form, "title"),
        dateRaw: str(form, "date"),
        placeRaw: str(form, "place")
      });
      store.tree = replacePerson(t1, setPersonalPhoto(person, media.id));
      return seeOther(`/person/${person.id}`);
    }
    case "/note": {
      const text = str(form, "text");
      if (text)
        store.tree = replacePerson(store.tree, addResearchNote(person, text));
      return seeOther(`/person/${person.id}`);
    }
    default:
      return html(notFound("action"), 404);
  }
}
async function addRelation(store, person, form) {
  const kind = str(form, "kind") ?? "child";
  const pedi = str(form, "pedi") ?? undefined;
  const existingId = str(form, "existing");
  const other = existingId ? store.tree.persons.find((p) => p.id === existingId) ?? person : createPerson({ given: str(form, "given") ?? "Unknown", surname: str(form, "surname") });
  let tree = store.tree;
  if (!existingId)
    tree = { ...tree, persons: [...tree.persons, other] };
  const savePerson = (p) => {
    tree = replacePerson(tree, p);
  };
  const saveFamily = (f) => {
    tree = tree.families.some((x) => x.id === f.id) ? replaceFamily(tree, f) : { ...tree, families: [...tree.families, f] };
  };
  if (kind === "spouse") {
    const { family, updatedA, updatedB } = addPartner({ a: person, b: other });
    saveFamily(family);
    savePerson(updatedA);
    savePerson(updatedB);
  } else if (kind === "parent") {
    const { family, updatedChild, updatedParent } = addParent({ child: person, parent: other, pedi });
    saveFamily(family);
    savePerson(updatedChild);
    savePerson(updatedParent);
  } else if (kind === "sibling") {
    const host = tree.families.find((f) => person.famc.some((l) => l.familyId === f.id)) ?? createFamily({ partners: [] });
    const withSelf = addSibling({ family: host, siblingId: person.id });
    const withOther = addSibling({ family: withSelf.family, siblingId: other.id, sibling: other, pedi });
    saveFamily(withOther.family);
    const cur = tree.persons.find((p) => p.id === person.id);
    if (!cur.famc.some((l) => l.familyId === host.id)) {
      savePerson({ ...cur, famc: [...cur.famc, { familyId: host.id }] });
    }
    if (withOther.updatedSibling)
      savePerson(withOther.updatedSibling);
  } else {
    const host = tree.families.find((f) => person.fams.includes(f.id)) ?? createFamily({ partners: [person.id] });
    const withHost = host.partners.includes(person.id) ? host : { ...host, partners: [...host.partners, person.id] };
    const { family, updatedParent, updatedChild } = addChild({ family: withHost, childId: other.id, parent: person, child: other });
    saveFamily(family);
    const cur = tree.persons.find((p) => p.id === person.id);
    if (!cur.fams.includes(family.id))
      savePerson({ ...cur, fams: [...cur.fams, family.id] });
    if (updatedChild)
      savePerson(updatedChild);
  }
  store.tree = tree;
  return seeOther(`/person/${person.id}`);
}
export {
  yearOf,
  wrapDisplayName,
  updatePerson,
  updateFact,
  setPersonalPhoto,
  setMarriage,
  setLiving,
  setDivorce,
  setDeceased,
  resolveMediaPath,
  preferredName,
  preferredEvent,
  personalPhoto,
  parseLines,
  parseGEDCOMDate,
  newId,
  newEvent,
  listPeople,
  kinOf,
  importGedcom,
  familyLayout,
  exportGedcom,
  exportDateForGedcom,
  emptyTree,
  detachPartner,
  detachChild,
  deleteFact,
  decodeGedcom,
  createPerson,
  createFamily,
  createApp,
  cardHeightFor,
  addSibling,
  addResearchNote,
  addPartner,
  addParent,
  addMedia,
  addFact,
  addChild,
  Y_GAP,
  X_GAP,
  SIDECAR_DIR,
  NODE_W,
  NODE_H,
  COUPLE_PITCH,
  COUPLE_GAP,
  CARD_H_TALL,
  CARD_H_SHORT
};
