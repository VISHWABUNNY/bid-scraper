import { useState, useEffect } from 'react';

const API = 'http://localhost:5000';

type PortalKey = 'ALL' | 'GEM' | 'CPPP' | 'AP' | 'TS' | 'MH' | 'UP';

interface Bid {
  id: string;
  bidId: string;
  portal?: PortalKey;
  title: string;
  organisation: string;
  departmentName: string | null;
  organisationName: string | null;
  itemCategory: string | null;
  gemUrl: string;
  value: number | null;
  closingDate: string | null;
  bidOpeningDate: string | null;
  isMsme: boolean;
  isStartup: boolean;
  keyword: string;
}

const PORTALS: { key: PortalKey; label: string }[] = [
  { key: 'ALL', label: '🌐 All Portals' },
  { key: 'GEM', label: '🏛️ GeM Portal' },
  { key: 'CPPP', label: '🇮🇳 CPPP Portal' },
  { key: 'AP', label: '⚡ AP eProcurement' },
  { key: 'TS', label: '🏛️ TS eProcurement' },
  { key: 'MH', label: '🏢 MH MahaTenders' },
  { key: 'UP', label: '🚩 UP eTender' },
];

export default function App() {
  const [bids, setBids] = useState<Bid[]>([]);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);
  const [activePortal, setActivePortal] = useState<PortalKey>('ALL');

  async function fetchShortlisted(portalKey: PortalKey = activePortal) {
    try {
      const url = portalKey && portalKey !== 'ALL' ? `${API}/shortlisted?portal=${portalKey}` : `${API}/shortlisted`;
      const res = await fetch(url);
      const json = await res.json();
      if (json.success) setBids(json.data);
    } catch {
      setStatus('Unable to connect to backend.');
    }
  }

  useEffect(() => {
    fetchShortlisted(activePortal);
  }, [activePortal]);

  async function runScrape() {
    setLoading(true);
    const portalName = PORTALS.find((p) => p.key === activePortal)?.label || activePortal;
    setStatus(`Launching scraper for ${portalName} in background...`);

    try {
      const res = await fetch(`${API}/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ portal: activePortal }),
      });
      const json = await res.json();
      if (!json.success) {
        setStatus(`Error: ${json.error || json.message}`);
        setLoading(false);
        return;
      }
    } catch {
      setStatus('Failed to connect to scraper backend.');
      setLoading(false);
      return;
    }

    // Poll backend progress and stream live shortlisted bids every 800ms
    const progressInterval = setInterval(async () => {
      try {
        const res = await fetch(`${API}/progress`);
        const json = await res.json();
        if (json.success && json.progress) {
          const p = json.progress;

          // Instantly refresh bid list on UI while scraping is active!
          await fetchShortlisted(activePortal);

          if (p.isScraping) {
            const currentPortalLabel = p.currentPortal || activePortal;
            const kwText = p.currentKeyword ? `Searching ${currentPortalLabel} for: "${p.currentKeyword}"` : `Searching ${currentPortalLabel}...`;
            const countText = p.totalKeywords > 0 ? ` (${p.currentIndex}/${p.totalKeywords})` : '';
            const remainingText = p.remainingKeywords >= 0 ? ` — ${p.remainingKeywords} word${p.remainingKeywords !== 1 ? 's' : ''} left` : '';
            const foundText = p.shortlistedCount > 0 ? ` [${p.shortlistedCount} shortlisted lead${p.shortlistedCount !== 1 ? 's' : ''} live]` : '';

            setStatus(`${kwText}${countText}${remainingText}${foundText}`);
          } else {
            // Background scraping complete!
            clearInterval(progressInterval);
            setLoading(false);
            setStatus(`Scrape finished — checked keywords across portal(s), ${p.shortlistedCount} shortlisted leads found!`);
            await fetchShortlisted(activePortal);
          }
        }
      } catch {
        // Ignore status poll error
      }
    }, 800);
  }

  async function clearData() {
    if (!confirm('Wipe all saved shortlisted bids?')) return;
    await fetch(`${API}/clear`, { method: 'DELETE' });
    setBids([]);
    setStatus('All data cleared.');
  }

  return (
    <div className="container">
      <header>
        <div>
          <h1>TenderIQ Engine</h1>
          <p style={{ fontSize: '0.85rem', color: '#94a3b8', marginTop: '0.2rem' }}>
            Multi-Portal Procurement Lead Finder & IT Evaluator (GeM · CPPP · AP · TS · MH · UP)
          </p>
        </div>
        <div className="controls">
          <button className="btn-clear" onClick={clearData} disabled={loading}>Clear Data</button>
          <button className="btn-run" onClick={runScrape} disabled={loading}>
            {loading ? 'Scraping Portals...' : `Run Scrape (${activePortal})`}
          </button>
        </div>
      </header>

      {/* Multi-portal Selection Tabs */}
      <div className="portal-bar">
        {PORTALS.map((portal) => (
          <button
            key={portal.key}
            className={`portal-tab ${activePortal === portal.key ? 'portal-tab--active' : ''}`}
            onClick={() => setActivePortal(portal.key)}
            disabled={loading}
          >
            {portal.label}
          </button>
        ))}
      </div>

      {status && <div className="status">{status}</div>}

      <div className="bid-count">
        <strong>{bids.length}</strong> verified IT bid{bids.length !== 1 ? 's' : ''} available on <strong>{activePortal}</strong> view
      </div>

      {bids.length === 0 ? (
        <div className="empty">
          <h2>No shortlisted bids found for {activePortal} portal</h2>
          <p>Click "Run Scrape ({activePortal})" above to search government procurement portals.</p>
        </div>
      ) : (
        <div className="bids-grid">
          {bids.map((bid) => (
            <div key={bid.id} className="bid-card">
              {/* Card Header — Bid ID & Portal Badges */}
              <div className="bid-card-header">
                <span className="bid-id-badge">{bid.bidId}</span>
                <span className={`portal-badge portal-badge--${(bid.portal || 'GEM').toLowerCase()}`}>
                  {bid.portal || 'GEM'} PORTAL
                </span>
              </div>

              {/* Structured key-value details */}
              <div className="bid-details">
                <div className="detail-row">
                  <span className="detail-label">Bid End Date/Time</span>
                  <span className="detail-value detail-value--highlight">
                    {bid.closingDate || '—'}
                  </span>
                </div>

                <div className="detail-row">
                  <span className="detail-label">Bid Opening Date/Time</span>
                  <span className="detail-value">
                    {bid.bidOpeningDate || '—'}
                  </span>
                </div>

                <div className="detail-row">
                  <span className="detail-label">Department Name</span>
                  <span className="detail-value">
                    {bid.departmentName || bid.organisation || '—'}
                  </span>
                </div>

                <div className="detail-row">
                  <span className="detail-label">Organisation Name</span>
                  <span className="detail-value">
                    {bid.organisationName || '—'}
                  </span>
                </div>

                <div className="detail-row">
                  <span className="detail-label">Item Category</span>
                  <span className="detail-value">
                    {bid.itemCategory || bid.title || '—'}
                  </span>
                </div>

                <div className="detail-row">
                  <span className="detail-label">Searched Strings used in Procurement</span>
                  <span className="detail-value">
                    <span className="tag tag-keyword">{bid.keyword}</span>
                  </span>
                </div>

                <div className="detail-row">
                  <span className="detail-label">Searched Result generated in Portal</span>
                  <span className="detail-value">{bid.title}</span>
                </div>

                <div className="detail-row">
                  <span className="detail-label">MSE Relaxation for Years of Experience and Turnover</span>
                  <span className={`detail-value ${bid.isMsme ? 'detail-value--yes' : 'detail-value--no'}`}>
                    {bid.isMsme ? 'Yes' : 'No'}
                  </span>
                </div>

                <div className="detail-row">
                  <span className="detail-label">Startup Relaxation for Years of Experience and Turnover</span>
                  <span className={`detail-value ${bid.isStartup ? 'detail-value--yes' : 'detail-value--no'}`}>
                    {bid.isStartup ? 'Yes' : 'No'}
                  </span>
                </div>

                <div className="detail-row">
                  <span className="detail-label">Project Value</span>
                  <span className="detail-value detail-value--highlight">
                    {bid.value ? `₹${bid.value} Lakh` : 'Not Disclosed'}
                  </span>
                </div>
              </div>

              {/* Action buttons */}
              <div className="bid-actions">
                <a
                  className="bid-btn btn-view"
                  href={bid.gemUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  🔗 View Tender Document ({bid.portal || 'GEM'}) ↗
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
