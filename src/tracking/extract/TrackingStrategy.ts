export interface TrackingStrategy {
  match(text: string): boolean;
  extract(text: string): string | null;
}

export interface CarrierStrategy {
  match(text: string): boolean;
  extract(text: string): string | null;
}

function cleanCarrierName(raw: string): string {
  let text = raw.replace(/\s+/g, " ").trim();
  // Strip a trailing sentence period, but keep abbreviation periods (Inc. / Ltd.).
  if (/\.$/.test(text) && !/\b(Inc|Ltd|LLC|Corp|Co|GmbH|S\.A)\.$/i.test(text)) {
    text = text.slice(0, -1).trim();
  }
  return text;
}

export class EnglishTrackingStrategy implements TrackingStrategy {
  match(text: string): boolean {
    return /Tracking\s*ID:/i.test(text);
  }

  extract(text: string): string | null {
    const match = text.match(/Tracking\s*ID:\s*(\S+)/i);
    return match ? match[1].replace(/[.,;]+$/, "") : null;
  }
}

export class SpanishTrackingStrategy implements TrackingStrategy {
  match(text: string): boolean {
    return /ID\s*de\s*seguimiento/i.test(text);
  }

  extract(text: string): string | null {
    const match = text.match(/ID\s*de\s*seguimiento:\s*(\S+)/i);
    return match ? match[1].replace(/[.,;]+$/, "") : null;
  }
}

/** DE: Sendungsnummer / Sendungsnr. */
export class GermanTrackingStrategy implements TrackingStrategy {
  match(text: string): boolean {
    return /Sendungs(?:nummer|nr\.?)\s*:/i.test(text);
  }

  extract(text: string): string | null {
    const match = text.match(/Sendungs(?:nummer|nr\.?)\s*:\s*(\S+)/i);
    return match ? match[1].replace(/[.,;]+$/, "") : null;
  }
}

/** FR/CA: Numéro de suivi */
export class FrenchTrackingStrategy implements TrackingStrategy {
  match(text: string): boolean {
    return /Num[eé]ro\s+de\s+suivi\s*:/i.test(text);
  }

  extract(text: string): string | null {
    const match = text.match(/Num[eé]ro\s+de\s+suivi\s*:\s*(\S+)/i);
    return match ? match[1].replace(/[.,;]+$/, "") : null;
  }
}

export class AmazonCarrierStrategy implements CarrierStrategy {
  match(text: string): boolean {
    // Prefer specific "shipped with" / "Delivery By" phrases over bare "amazon" in longer sentences
    if (/(?:it\s+was\s+)?shipped\s+with/i.test(text)) return false;
    if (/Delivery\s+By/i.test(text)) return false;
    if (/Se\s+envi[oó]\s+con/i.test(text)) return false;
    if (/Versendet\s+mit/i.test(text)) return false;
    if (/Exp[eé]di[eé]\s+avec/i.test(text)) return false;
    return /\bamazon\b/i.test(text);
  }

  extract(): string {
    return "Amazon";
  }
}

export class ShippedWithStrategy implements CarrierStrategy {
  match(text: string): boolean {
    return /(?:it\s+was\s+)?shipped\s+with/i.test(text);
  }

  extract(text: string): string {
    const match = text.match(/(?:it\s+was\s+)?shipped\s+with\s+(.+)/i);
    return cleanCarrierName(match?.[1] ?? text);
  }
}

export class SpanishCarrierStrategy implements CarrierStrategy {
  match(text: string): boolean {
    return /Se\s+envi[oó]\s+con/i.test(text);
  }

  extract(text: string): string | null {
    const match = text.match(/Se\s+envi[oó]\s+con\s+(.+)/i);
    return cleanCarrierName(match?.[1] ?? text.replace(/Se\s+envi[oó]\s+con/i, ""));
  }
}

export class GermanCarrierStrategy implements CarrierStrategy {
  match(text: string): boolean {
    return /Versendet\s+mit/i.test(text);
  }

  extract(text: string): string | null {
    const match = text.match(/Versendet\s+mit\s+(.+)/i);
    return cleanCarrierName(match?.[1] ?? "");
  }
}

export class FrenchCarrierStrategy implements CarrierStrategy {
  match(text: string): boolean {
    return /Exp[eé]di[eé]\s+avec/i.test(text);
  }

  extract(text: string): string | null {
    const match = text.match(/Exp[eé]di[eé]\s+avec\s+(.+)/i);
    return cleanCarrierName(match?.[1] ?? "");
  }
}

export class DeliveryByStrategy implements CarrierStrategy {
  match(text: string): boolean {
    return /Delivery\s+By/i.test(text);
  }

  extract(text: string): string {
    const match = text.match(/Delivery\s+By\s+(.+)/i);
    return cleanCarrierName(match?.[1] ?? text.replace(/Delivery\s+By/i, ""));
  }
}
