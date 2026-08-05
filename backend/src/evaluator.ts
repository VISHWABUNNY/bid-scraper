// Evaluates a bid against strict IT procurement criteria
// ✓ IT-related: software, web portal/app, mobile app development, AI, IT services, digital systems
// ✓ Value ≤ ₹20,00,000 (20 lakh)
// ✗ Reject physical hardware & goods: cameras, containers, compactors, lockers, apparel, medical equipment, civil/construction

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
  'ai ',
  'artificial intelligence',
  'machine learning',
  'automation software',
  'mis portal',
  'mis system',
  'dashboard development',
  'erp',
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
];

const REJECT_KEYWORDS = [
  'construction',
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
}): { shortlisted: boolean; reason: string } {
  const text = bid.title.toLowerCase();

  const isRejected = REJECT_KEYWORDS.some((kw) => text.includes(kw));
  if (isRejected) return { shortlisted: false, reason: 'Rejected category/product keyword' };

  const isIT = IT_KEYWORDS.some((kw) => text.includes(kw));
  if (!isIT) return { shortlisted: false, reason: 'Not IT software/services related' };

  if (bid.value !== null && bid.value > MAX_VALUE_LAKH) {
    return { shortlisted: false, reason: `Value ₹${bid.value}L exceeds ₹20L limit` };
  }

  return { shortlisted: true, reason: 'Passes all IT criteria' };
}
