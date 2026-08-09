// Evaluates a bid against strict IT & Software procurement criteria
// Shortlisting rules:
// 1. IT/Software-related project (software, web portal, mobile app, AI, IT services, digital platform, etc.)
// 2. Value ≤ ₹20,00,000 (20 Lakhs) or undisclosed/unknown
// 3. Rejects purely physical hardware, equipment, civil, and non-IT goods (cameras, mobile handsets, switches, furniture, etc.)
// 4. Dynamic scoring for MSME / Startup eligibility

const IT_SOFTWARE_KEYWORDS = [
  'software',
  'web portal',
  'website',
  'web app',
  'web application',
  'mobile app',
  'mobile application',
  'application development',
  'software development',
  'portal development',
  'system development',
  'custom software',
  'it service',
  'it support',
  'it consulting',
  'it amc',
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
  'analytics dashboard',
  'monitoring dashboard',
  'crm',
  'cloud software',
  'saas',
  'e-governance',
  'e governance',
  'workflow automation',
  'intranet portal',
  'cyber security',
  'security audit',
  'vulnerability assessment',
  'data analytics',
  'hrms portal',
  'e-office',
  'gis portal',
  'simulation software',
  'asset management software',
  'asset tracking software',
  'fleet management software',
  'inventory management software',
  'maintenance management software',
  'document management software',
  'custom bid for services',
];

// Hardware, equipment, and physical product keywords that MUST trigger rejection
const HARDWARE_PHYSICAL_REJECT_KEYWORDS = [
  'dashboard camera',
  'dashcam',
  'cctv camera',
  'camera',
  'personal mobile',
  'mobile phone',
  'mobile handset',
  'mobile charger',
  'interactive panel',
  'display panel',
  'led panel',
  'tv panel',
  'conductive',
  'level switch',
  'pressure switch',
  'release switch',
  'toggle switch',
  'shotcrete',
  'shot-crete',
  'construction',
  'civil work',
  'electrical work',
  'furniture',
  'printing paper',
  'catering',
  'housekeeping',
  'security guard',
  'road work',
  'building construction',
  'water pipe',
  'sanitation',
  'jacket',
  'garment',
  'clothing',
  'hearing aid',
  'air conditioner',
  'transformer',
  'tyre',
  'soap',
  'towel',
  'table chair',
  'chair',
  'table',
  'desk',
  'cabinet',
  'rack',
  'ups battery',
  'battery',
  'cable',
  'wire',
];

const MAX_VALUE_LAKH = 20;
const MAX_VALUE_RUPEES = 2000000;

export function evaluate(bid: {
  title: string;
  value: number | null;
  isMsme: boolean;
  isStartup: boolean;
}): { shortlisted: boolean; score: number; reason: string } {
  const text = bid.title.toLowerCase();

  // 1. Hard Physical Product & Non-IT Rejection
  const hasHardwareReject = HARDWARE_PHYSICAL_REJECT_KEYWORDS.some((kw) => text.includes(kw));
  if (hasHardwareReject && !/software|web portal|mobile app|digital platform/i.test(text)) {
    return { shortlisted: false, score: 0.0, reason: 'Rejected: Physical product / hardware / non-IT keyword present' };
  }

  // 2. Verified IT / Software Category Check
  const matchingITTerms = IT_SOFTWARE_KEYWORDS.filter((kw) => text.includes(kw));
  const isITSoftware = matchingITTerms.length > 0;
  if (!isITSoftware) {
    return { shortlisted: false, score: 0.0, reason: 'Rejected: Not a verified IT software / digital services project' };
  }

  // 3. Budget Cap Check (≤ ₹20 Lakhs)
  if (bid.value !== null) {
    const valueInLakhs = bid.value > 1000 ? bid.value / 100000 : bid.value;
    if (valueInLakhs > MAX_VALUE_LAKH) {
      return { shortlisted: false, score: 0.0, reason: `Rejected: Estimated value (₹${valueInLakhs.toFixed(2)}L) exceeds ₹20L cap` };
    }
  }

  // 4. Calculate Shortlist Score (Base 8.0)
  let score = 8.0;
  if (bid.isMsme) score += 0.5;
  if (bid.isStartup) score += 0.5;
  if (matchingITTerms.length >= 2) score += 0.5;
  if (bid.value !== null && bid.value <= MAX_VALUE_RUPEES) score += 0.5;

  const finalScore = Math.min(10.0, Number(score.toFixed(1)));

  return {
    shortlisted: true,
    score: finalScore,
    reason: `Passes criteria (${finalScore}/10.0) — Verified IT Software Domain${bid.isMsme || bid.isStartup ? ' + MSME/Startup Eligible' : ''}`,
  };
}
