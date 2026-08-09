// Evaluates a bid against strict mandatory IT procurement criteria
// ALL criteria must pass for a bid to be shortlisted:
// 1. IT-related project (software, web, mobile, AI, IT services, digital platform)
// 2. Value ≤ ₹20,00,000 (20 Lakhs) or undisclosed
// 3. MSME / Startup EMD exemption & relaxation MUST be present (isMsme || isStartup)
// 4. Reject non-IT (construction, supply, electrical, civil, furniture, etc.)

const IT_KEYWORDS = [
  'software',
  'web portal',
  'website',
  'web app',
  'web application',
  'mobile app',
  'application development',
  'custom software',
  'it service',
  'it support',
  'it consulting',
  'digital portal',
  'digital transformation',
  'digital governance',
  'digital platform',
  'artificial intelligence',
  'machine learning',
  'automation software',
  'mis portal',
  'mis system',
  'dashboard development',
  'crm',
  'cloud software',
  'saas',
  'system development',
  'e-governance',
  'e governance',
  'workflow automation',
  'intranet portal',
  'cyber security',
  'data analytics',
  'management system',
  'tracking system',
  'monitoring system',
  'hrms portal',
  'e-office',
  'gis portal',
  'simulation software',
  'asset management',
  'asset tracking',
  'fleet management',
  'inventory management',
  'maintenance management',
  'training management',
  'document management',
  'project monitoring',
  'monitoring dashboard',
  'drone',
  'rfid',
  'inspection',
];

const REJECT_KEYWORDS = [
  'construction',
  'supply',
  'civil',
  'electrical',
  'furniture',
  'printing',
  'catering',
  'manpower',
  'housekeeping',
  'security guard',
  'road',
  'building',
  'water',
  'sanitation',
  'jacket',
  'garment',
  'clothing',
  'apparatus',
  'hearing aid',
  'meter',
  'medical equipment',
  'x-ray',
  'air conditioner',
  'battery',
  'cable',
  'transformer',
  'pipe',
  'vehicle',
  'tyre',
  'camera',
  'container',
  'compactor',
  'locker',
  'storage',
  'rack',
  'stand',
  'box',
  'towel',
  'soap',
  'table',
  'chair',
];

const MAX_VALUE_LAKH = 20;

export function evaluate(bid: {
  title: string;
  value: number | null;
  isMsme: boolean;
  isStartup: boolean;
}): { shortlisted: boolean; score: number; reason: string } {
  const text = bid.title.toLowerCase();

  // 1. Mandatory Check: Non-IT Rejection
  const isRejected = REJECT_KEYWORDS.some((kw) => text.includes(kw));
  if (isRejected) {
    return { shortlisted: false, score: 0.0, reason: 'Rejected: Non-IT / civil product keyword present' };
  }

  // 2. Mandatory Check: IT-related project
  const isIT = IT_KEYWORDS.some((kw) => text.includes(kw));
  if (!isIT) {
    return { shortlisted: false, score: 0.0, reason: 'Rejected: Not IT software / digital services related' };
  }

  // 3. Mandatory Check: Value <= ₹20 Lakhs
  if (bid.value !== null && bid.value > MAX_VALUE_LAKH) {
    return { shortlisted: false, score: 0.0, reason: `Rejected: Contract value ₹${bid.value}L exceeds ₹20L limit` };
  }

  // 4. Mandatory Check: MSME or Startup Exemption & Relaxation MUST be mentioned
  if (!bid.isMsme && !bid.isStartup) {
    return { shortlisted: false, score: 0.0, reason: 'Rejected: Missing MSME or Startup EMD exemption / relaxation' };
  }

  // If ALL mandatory criteria pass:
  let score = 8.5;
  if (bid.isMsme) score += 0.5;
  if (bid.isStartup) score += 0.5;
  if (IT_KEYWORDS.filter((kw) => text.includes(kw)).length >= 2) score += 0.5;
  const finalScore = Math.min(10.0, Number(score.toFixed(1)));

  return {
    shortlisted: true,
    score: finalScore,
    reason: `Passes all criteria (${finalScore}/10.0) — IT Project + Value ≤ ₹20L + MSME/Startup Relaxation`,
  };
}
