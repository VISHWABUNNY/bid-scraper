import { readFileSync } from 'fs';
import path from 'path';

const DEFAULT_KEYWORDS = [
  'website',
  'web portal',
  'application',
  'mobile app',
  'android',
  'ios',
  'software development',
  'custom software',
  'custom bid for services',
  'mis',
  'dashboard',
  'it services',
  'digital portal',
  'e governance',
  'automation',
  'system development',
  'drone',
  'rfid',
  'asset management',
  'asset tracking',
  'fleet management',
  'inventory management',
  'logistics management',
  'maintenance management',
  'training management',
  'document management',
  'workflow automation',
  'cyber security',
  'e-procurement',
  'online service delivery',
  'government website',
  'government portal',
  'digital transformation',
  'cloud software',
  'saas',
  'crm',
  'hrms',
  'e-office',
  'gis',
  'simulation software',
  'project monitoring',
  'monitoring dashboard',
  'asset lifecycle management',
  'software solution',
  'application development',
  'portal development',
  'service provider',
  'it support',
  'digital platform',
  'management system',
  'data analytics',
  'security audit',
  'monitoring system',
];

function normalizeKeyword(raw: string): string | null {
  let cleaned = raw
    .replace(/^\d+[\t\s]+/, '')
    .replace(/^[\-•*]+\s*/, '')
    .replace(/[★✓✗⚠🔍💻📱🖥️🧠🏛️📊🔐🎯🚀🔰🛡👉💡1️⃣2️⃣3️⃣4️⃣5️⃣“"”'•]/g, '')
    .trim();

  if (!cleaned) return null;

  cleaned = cleaned.replace(/^\.\s*/, '').trim();
  cleaned = cleaned.replace(/\s+/g, ' ');

  if (cleaned.length < 2 || cleaned.length > 100) return null;
  if (/^(shortlist criteria|organisation|organization|design, develop, integrate|use these as base searches|clients mostly use formal language like this|meaning|copy-paste|copy paste|best combinations|ready-to-use combined search strings|highest probability keywords for startup|focus first|important|less competition|very important|always try|power searches|search these directly|these match sow language exactly|what it usually refers to|most important keyword|advanced trick|defence depart)$/i.test(cleaned)) {
    return null;
  }

  if (/^(use|search|try|copy|meaning|best|ready|highest|focus|power|most|advanced|defence)/i.test(cleaned)) return null;
  if (/[₹✓✗★⚠≤="']/i.test(cleaned)) return null;
  if (/^(and|or|the|for|with|of)$/i.test(cleaned)) return null;
  if (cleaned.includes(':') && !/(software|portal|application|website|system|service|development|management|dashboard|mobile|security|digital)/i.test(cleaned)) return null;
  if (/^(drdo|ada|indian army|indian navy|indian air force|hal|bel|isro|dae|pgcil|sjvn|nrl|iocl|hpcl|ngri|iia|instem|incois|nin|arai|gsi|iit|aiims|iiit|delhi police|uttar pradesh police|svpnpa|india security press|samagra shiksha|novotel|saint-gobain|chemveda|shivam concrete|srisailam devasthanam)$/i.test(cleaned)) return null;

  return cleaned.toLowerCase();
}

// Cleanly loads all keywords from Search keywords.md and adds practical fallback terms.
export function loadKeywords(): string[] {
  const file = path.resolve(__dirname, '../Search keywords.md');
  const raw = readFileSync(file, 'utf8');
  const lines = raw.split(/\r?\n/);
  const parsedKeywords = new Set<string>();

  for (const line of lines) {
    const normalized = normalizeKeyword(line);
    if (!normalized) continue;

    parsedKeywords.add(normalized);

    const segments = normalized
      .split(/\s*(?:\+|\/|,|;|\s+and\s+|\s+or\s+)\s*/)
      .map((segment) => segment.trim())
      .filter((segment) => segment.length >= 2 && segment.length <= 80);

    segments.forEach((segment) => parsedKeywords.add(segment));
  }

  const combined = [...DEFAULT_KEYWORDS, ...parsedKeywords];
  const expanded = new Set<string>();

  for (const keyword of combined) {
    const base = keyword.trim();
    if (!base) continue;
    expanded.add(base);

    const variants = [
      base,
      base.replace(/\s+/g, ' '),
      base.replace(/\s+/g, '-'),
      base.replace(/\s+/g, '_'),
      base.replace(/\s+/g, ''),
      `${base} services`,
      `${base} development`,
      `${base} system`,
      `${base} solution`,
      `${base} portal`,
      `${base} software`,
      `${base} management`,
    ];

    variants.forEach((variant) => expanded.add(variant.trim()));
  }

  return [...expanded].filter((keyword) => keyword.length >= 2 && keyword.length <= 100);
}
