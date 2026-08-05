import { readFileSync } from 'fs';
import path from 'path';

// Cleanly loads all keywords from Search keywords.md
export function loadKeywords(): string[] {
  const file = path.resolve(__dirname, '../Search keywords.md');
  const raw = readFileSync(file, 'utf8');
  const lines = raw.split(/\r?\n/);
  const keywords: string[] = [];

  for (const line of lines) {
    let l = line.replace(/^\d+[\t\s]+/, '').trim();
    l = l.split(/\t|\+/)[0].trim();
    l = l.replace(/^[0-9]+[\.\)\s\t]*/, '').trim();
    l = l.replace(/[★✓✗⚠🔍💻📱🖥️🧠🏛️📊🔐🎯🚀🔰🛡👉💡1️⃣2️⃣3️⃣4️⃣5️⃣“"”']/g, '').trim();
    l = l.replace(/^\.\s*/, '').trim();
    if (!l) continue;
    if (l.startsWith('#') || l.startsWith('//')) continue;
    if (l.includes(':')) continue;
    if (/[₹✓✗★⚠≤="']/.test(l)) continue;
    if (/^shortlist criteria$/i.test(l)) continue;
    if (/EMD exemption|Relaxation for Years|Duplicate bid IDs|category saved|Focus First|Copy-paste|Use these|Clients mostly|Meaning|Always try|POWERFUL|IMPORTANT|LESS COMPETITION|VERY IMPORTANT|keywords|search strings|tricks|ment keywords/i.test(l)) continue;
    if (l.length < 2 || l.length > 70) continue;
    keywords.push(l);
  }

  return [...new Set(keywords)];
}
