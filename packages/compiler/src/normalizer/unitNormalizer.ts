/**
 * Normalizes human prompt units (e.g. $50, 24 hours, 2 weeks)
 * into target schema parameter units (e.g. cents, seconds, days).
 */

export interface NormalizedValue {
  value: number;
  note?: string;
}

export function normalizeCurrency(text: string, targetField: string): NormalizedValue | null {
  const match = text.match(/\$(\d+(?:\.\d{1,2})?)/);
  if (!match) return null;

  const dollars = parseFloat(match[1]);

  if (targetField.toLowerCase().includes('cents') || targetField.toLowerCase().endsWith('_cents')) {
    const cents = Math.round(dollars * 100);
    return {
      value: cents,
      note: `Converted $${dollars} in prompt to ${cents} cents`,
    };
  }

  return {
    value: dollars,
  };
}

export function normalizeTimeWindow(text: string): { windowSeconds: number; note?: string } {
  const hourMatch = text.match(/(\d+)\s*[- ]?hour/i);
  if (hourMatch) {
    const hours = parseInt(hourMatch[1], 10);
    return {
      windowSeconds: hours * 3600,
      note: `Converted ${hours} hours to ${hours * 3600} seconds`,
    };
  }

  const dayMatch = text.match(/(\d+)\s*[- ]?day/i);
  if (dayMatch) {
    const days = parseInt(dayMatch[1], 10);
    return {
      windowSeconds: days * 86400,
      note: `Converted ${days} days to ${days * 86400} seconds`,
    };
  }

  // Default rolling 24-hour window
  return { windowSeconds: 86400 };
}
