import { evaluate } from '../src/evaluator';

describe('Shortlist Evaluator', () => {
  it('shortlists valid IT software project', () => {
    const res = evaluate({
      title: 'Custom Web Portal and Application Development for Government Department',
      value: 15,
      isMsme: true,
      isStartup: false,
    });
    expect(res.shortlisted).toBe(true);
    expect(res.score).toBeGreaterThanOrEqual(8.0);
  });

  it('shortlists valid IT project with undisclosed value', () => {
    const res = evaluate({
      title: 'Development of AI-based MIS System and Analytics Dashboard',
      value: null,
      isMsme: false,
      isStartup: true,
    });
    expect(res.shortlisted).toBe(true);
    expect(res.score).toBeGreaterThanOrEqual(8.0);
  });

  it('rejects IT project without MSE or Startup relaxation', () => {
    const res = evaluate({
      title: 'Supply and Implementation of Asset Tracking Management Software',
      value: 12,
      isMsme: false,
      isStartup: false,
    });
    expect(res.shortlisted).toBe(false);
    expect(res.reason).toContain('Missing MSE or Startup relaxation');
  });

  it('shortlists valid IT project with startup relaxation', () => {
    const res = evaluate({
      title: 'Supply and Implementation of Asset Tracking Management Software',
      value: 12,
      isMsme: false,
      isStartup: true,
    });
    expect(res.shortlisted).toBe(true);
    expect(res.score).toBeGreaterThanOrEqual(8.0);
  });

  it('rejects civil construction bid', () => {
    const res = evaluate({
      title: 'Construction of Boundary Wall and Civil Works',
      value: 10,
      isMsme: true,
      isStartup: false,
    });
    expect(res.shortlisted).toBe(false);
    expect(res.score).toBe(0.0);
  });

  it('rejects non-IT supply bid', () => {
    const res = evaluate({
      title: 'Supply of Office Chairs and Wooden Tables',
      value: 5,
      isMsme: false,
      isStartup: false,
    });
    expect(res.shortlisted).toBe(false);
    expect(res.score).toBe(0.0);
  });

  it('rejects IT project exceeding budget cap', () => {
    const res = evaluate({
      title: 'Enterprise ERP Software Implementation',
      value: 50, // 50 Lakhs > 20 Lakhs
      isMsme: true,
      isStartup: true,
    });
    expect(res.shortlisted).toBe(false);
    expect(res.reason).toContain('exceeds ₹20L cap');
  });
});
