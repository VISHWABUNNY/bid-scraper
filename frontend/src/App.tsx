import { useState, useEffect } from 'react';

const API = 'http://localhost:5000';

interface Bid {
  id: string;
  bidId: string;
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

export default function App() {
  const [bids, setBids] = useState<Bid[]>([]);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);

  async function fetchShortlisted() {
    try {
      const res = await fetch(`${API}/shortlisted`);
      const json = await res.json();
      if (json.success) setBids(json.data);
    } catch {
      setStatus('Unable to connect to backend.');
    }
  }

  useEffect(() => {
    fetchShortlisted();
  }, []);

  async function runScrape() {
    setLoading(true);
    setStatus('Searching GeM portal for active IT bids across keywords...');
    try {
      const res = await fetch(`${API}/run`, { method: 'POST' });
      const json = await res.json();
      if (json.success) {
        setStatus(`Scrape finished — checked bids, ${json.shortlisted} shortlisted leads found!`);
        await fetchShortlisted();
      } else {
        setStatus(`Error: ${json.error}`);
      }
    } catch {
      setStatus('Failed to connect to scraper backend.');
    } finally {
      setLoading(false);
    }
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
            Autonomous GeM Lead Finder & IT Document Evaluator
          </p>
        </div>
        <div className="controls">
          <button className="btn-clear" onClick={clearData} disabled={loading}>Clear Data</button>
          <button className="btn-run" onClick={runScrape} disabled={loading}>
            {loading ? 'Scraping GeM...' : 'Run Scrape'}
          </button>
        </div>
      </header>

      {status && <div className="status">{status}</div>}

      <div className="bid-count">
        <strong>{bids.length}</strong> verified IT bid{bids.length !== 1 ? 's' : ''} available
      </div>

      {bids.length === 0 ? (
        <div className="empty">
          <h2>No shortlisted bids found yet</h2>
          <p>Click "Run Scrape" above to search GeM portal using your keyword list.</p>
        </div>
      ) : (
        <div className="bids-grid">
          {bids.map((bid) => (
            <div key={bid.id} className="bid-card">
              {/* Card Header — Bid ID badge */}
              <div className="bid-card-header">
                <span className="bid-id-badge">{bid.bidId}</span>
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
                  <span className="detail-label">Searched Strings used in GeMARPTS</span>
                  <span className="detail-value">
                    <span className="tag tag-keyword">{bid.keyword}</span>
                  </span>
                </div>

                <div className="detail-row">
                  <span className="detail-label">Searched Result generated in GeMARPTS</span>
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
                  🔗 View on GeM ↗
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
