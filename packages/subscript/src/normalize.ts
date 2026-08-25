export type Normalized = {
  readonly text: string;
  readonly map: number[];
  readonly origLength: number;
};

const OPERATOR_ONE_TO_ONE: Record<string, string> = {
  "\u2212": "-",
  "\u00d7": "*",
  "\u22c5": "*",
  "\u00f7": "/",
  "\u27f6": "\u2192",
};

const OPERATOR_EXPAND: Record<string, string> = {
  "\u2103": "\u00b0C",
  "\u2109": "\u00b0F",
};

function appendMapped(text: string, map: number[], out: string, origIndex: number): string {
  for (let k = 0; k < out.length; k++) {
    text += out.charAt(k);
    map.push(origIndex);
  }
  return text;
}

export function normalize(input: string): Normalized {
  const nfc = input.normalize("NFC");
  let text = "";
  const map: number[] = [];

  for (let i = 0; i < nfc.length; ) {
    const cp = nfc.codePointAt(i);
    if (cp === undefined) {
      break;
    }
    const ch = String.fromCodePoint(cp);
    const next = i + ch.length;
    const expanded = OPERATOR_EXPAND[ch];
    if (expanded !== undefined) {
      text = appendMapped(text, map, expanded, i);
      i = next;
      continue;
    }
    const mapped = OPERATOR_ONE_TO_ONE[ch] ?? ch;
    text = appendMapped(text, map, mapped, i);
    i = next;
  }

  return { text, map, origLength: nfc.length };
}
