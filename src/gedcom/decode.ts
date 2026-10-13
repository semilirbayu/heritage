// Byte → text for .ged files. Lenient by design: sniff BOM, try strict
// UTF-8, fall back to WINDOWS-1252 (covers ANSEL-adjacent western bytes;
// exact ANSEL mapping is a ticket-04-known-limitation, recorded in report).

export interface DecodedGedcom {
  text: string;
  encoding: "UTF-8" | "UTF-16LE" | "UTF-16BE" | "WINDOWS-1252";
  hadBom: boolean;
}

export function decodeGedcom(bytes: Uint8Array): DecodedGedcom {
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return {
      text: new TextDecoder("utf-8").decode(bytes.slice(3)),
      encoding: "UTF-8",
      hadBom: true,
    };
  }
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    return {
      text: new TextDecoder("utf-16le").decode(bytes.slice(2)),
      encoding: "UTF-16LE",
      hadBom: true,
    };
  }
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    return {
      text: new TextDecoder("utf-16be").decode(bytes.slice(2)),
      encoding: "UTF-16BE",
      hadBom: true,
    };
  }
  try {
    return {
      text: new TextDecoder("utf-8", { fatal: true }).decode(bytes),
      encoding: "UTF-8",
      hadBom: false,
    };
  } catch {
    return {
      text: new TextDecoder("windows-1252").decode(bytes),
      encoding: "WINDOWS-1252",
      hadBom: false,
    };
  }
}
