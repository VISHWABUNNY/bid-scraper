import { useState, useEffect } from 'react';

const API = 'http://localhost:5000';

interface Bid {
  id: string;
  bidId: string;
  title: string;
  organisation: string;
  gemUrl: string;
  value: number | null;
  closingDate: string | null;
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
              <div className="bid-header">
                <span className="bid-id-badge">{bid.bidId}</span>
                <span className="tag tag-keyword">Keyword: <strong>{bid.keyword}</strong></span>
              </div>
              <h2 className="bid-title">{bid.title}</h2>
              {bid.organisation && (
                <div className="bid-org">
                  🏢 <strong>Department:</strong> {bid.organisation}
                </div>
              )}
              <div className="bid-meta">
                {bid.closingDate && (
                  <span className="tag tag-closing">
                    ⏰ Closing: <strong>{bid.closingDate}</strong>
                  </span>
                )}
                {bid.isMsme && <span className="tag tag-msme">MSME</span>}
                {bid.isStartup && <span className="tag tag-startup">Startup</span>}
                {bid.value && <span className="tag tag-value">₹{bid.value}L</span>}
              </div>
              <div className="bid-actions">
                <a
                  className="bid-btn btn-view"
                  href={bid.gemUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  🔗 View Bid Document (GeM) ↗
                </a>
                <a
                  className="bid-btn btn-download"
                  href={bid.gemUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  download={`Bid_${bid.bidId.replace(/\//g, '_')}.pdf`}
                >
                  📥 Download PDF Document
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
