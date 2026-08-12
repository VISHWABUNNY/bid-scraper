import { readFileSync, existsSync } from 'fs';
import path from 'path';

const CORE_KEYWORDS = [
  'software',
  'web portal',
  'website',
  'application development',
  'custom software',
  'mobile app',
  'mis portal',
  'dashboard',
  'it services',
  'digital portal',
  'e-governance',
  'automation',
  'system development',
  'asset management',
  'fleet management',
  'inventory management',
  'document management',
  'cyber security',
  'saas',
  'crm',
  'hrms',
  'e-office',
  'gis',
  'data analytics',
  'security audit',
  'monitoring system',
  'drone',
  'rfid',
];

const IGNORED_KEYWORD_PATTERNS = [
  /^(shortlist|criteria|organisation|organization|design|develop|integrate|use|search|try|copy|meaning|best|ready|highest|focus|power|most|advanced|defence)$/i,
  /^keywords?[:]?$/i,
  /^organisation[:]?$/i,
  /^organization[:]?$/i,
  /^(and|or|the|for|with|of)$/i,
  /^\d+$/, 
];

function normalizeKeyword(raw: string): string | null {
  let cleaned = raw
    .replace(/^\d+[\t\s]+/, '')
    .replace(/^[\-•*]+\s*/, '')
    .replace(/[★✓✗⚠🔍💻📱🖥️🧠🏛️📊🔐🎯🚀🔰🛡👉💡1️⃣2️⃣3️⃣4️⃣5️⃣“"”'•]/g, '')
    .replace(/[:\\]/g, '')
    .trim();

  if (!cleaned) return null;

  cleaned = cleaned.replace(/^\.\s*/, '').trim();
  cleaned = cleaned.replace(/\s+/g, ' ');

  if (cleaned.length < 3 || cleaned.length > 60) return null;
  if (IGNORED_KEYWORD_PATTERNS.some((re) => re.test(cleaned))) return null;
  if (/[₹✓✗★⚠≤="']/i.test(cleaned)) return null;

  return cleaned.toLowerCase();
}

// Cleanly loads IT search keywords without bloated combinatorial expansions
export function loadKeywords(): string[] {
  const file = path.resolve(__dirname, '../Search keywords.md');
  const uniqueKeywords = new Set<string>(CORE_KEYWORDS);
  let parsingKeywords = false;

  if (existsSync(file)) {
    try {
      const raw = readFileSync(file, 'utf8');
      const lines = raw.split(/\r?\n/);

      for (const line of lines) {
        const trimmed = line.trim();
        if (!parsingKeywords && /^keywords?[:]?$/i.test(trimmed)) {
          parsingKeywords = true;
          continue;
        }
        if (!parsingKeywords) continue;

        const normalized = normalizeKeyword(trimmed);
        if (normalized) {
          uniqueKeywords.add(normalized);
        }
      }
    } catch {
      // Fallback to core keywords if file reading fails
    }
  }

  // Filter and deduplicate cleanly
  return Array.from(uniqueKeywords).filter(
    (kw) => kw.length >= 3 && kw.length <= 50
  );
}
