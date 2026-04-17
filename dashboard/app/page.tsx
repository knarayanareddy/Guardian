'use client';

import { useState, useEffect } from 'react';
import { marked } from 'marked';

type View = 'overview' | 'activity' | 'policy' | 'approvals' | 'wiki' | 'monitoring';

export default function CommandCenter() {
  const [activeView, setActiveView] = useState<View>('overview');
  const [stats, setStats] = useState<any>(null);
  const [activity, setActivity] = useState<any[]>([]);
  const [policy, setPolicy] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);
  
  // Wiki state
  const [wikiFiles, setWikiFiles] = useState<any[]>([]);
  const [selectedWikiPath, setSelectedWikiPath] = useState<string | null>(null);
  const [wikiContent, setWikiContent] = useState<string>('');

  // --- Data Fetching ---

  useEffect(() => {
    fetchStats();
    fetchActivity();
    fetchPolicy();
    fetchWikiList();
    
    const interval = setInterval(() => {
      fetchStats();
      fetchActivity();
    }, 30000);
    
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (selectedWikiPath) fetchWikiContent(selectedWikiPath);
  }, [selectedWikiPath]);

  const fetchStats = async () => {
    const res = await fetch('/api/stats');
    const data = await res.json();
    if (!data.error) setStats(data);
  };

  const fetchActivity = async () => {
    const res = await fetch('/api/activity');
    const data = await res.json();
    if (!data.error) setActivity(data);
  };

  const fetchPolicy = async () => {
    const res = await fetch('/api/policy');
    const data = await res.json();
    if (!data.error) setPolicy(data);
  };

  const fetchWikiList = async () => {
    const res = await fetch('/api/wiki/list');
    const data = await res.json();
    if (!data.error) setWikiFiles(data);
  };

  const fetchWikiContent = async (path: string) => {
    const res = await fetch(`/api/wiki/content?path=${encodeURIComponent(path)}`);
    const data = await res.json();
    if (!data.error) setWikiContent(data.content);
  };

  const handleSavePolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const res = await fetch('/api/policy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(policy)
      });
      if (res.ok) alert("Policy saved to disk.");
    } catch (err) {
      alert("Failed to save.");
    } finally {
      setIsSaving(false);
    }
  };

  // --- Render Helpers ---

  const renderNav = (id: View, label: string, icon: string) => (
    <div 
      className={`nav-item ${activeView === id ? 'active' : ''}`}
      onClick={() => setActiveView(id)}
    >
      <span>{icon}</span>
      {label}
    </div>
  );

  const renderWikiTree = (files: any[]) => {
    return files.map(file => (
      <div key={file.path} style={{ marginLeft: file.type === 'directory' ? '0' : '1rem' }}>
        {file.type === 'directory' ? (
          <>
            <div className="wiki-file" style={{ fontWeight: 800, cursor: 'default', color: 'white' }}>📁 {file.name}</div>
            <div style={{ marginLeft: '1rem' }}>{renderWikiTree(file.children)}</div>
          </>
        ) : (
          <div 
            className={`wiki-file ${selectedWikiPath === file.path ? 'active' : ''}`}
            onClick={() => setSelectedWikiPath(file.path)}
          >
            📄 {file.name}
          </div>
        )}
      </div>
    ));
  };

  return (
    <div className="command-center">
      {/* Sidebar Navigation */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <h2 style={{ fontSize: '1.2rem', color: 'white', letterSpacing: '2px' }}>GUARDIAN</h2>
          <p className="mono" style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>UNIFIED COMMAND CENTER</p>
        </div>
        
        <nav className="sidebar-nav">
          {renderNav('overview', 'System Overview', '🏠')}
          {renderNav('activity', 'Activity Logs', '📋')}
          {renderNav('policy', 'Safety Gates', '🛡️')}
          {renderNav('wiki', 'System Wiki', '📚')}
          {renderNav('monitoring', 'Observability', '📈')}
        </nav>

        <div style={{ padding: '2rem', borderTop: '1px solid var(--glass-border)' }}>
          <div className="status-badge status-online">
            <span style={{ width: '8px', height: '8px', background: '#10b981', borderRadius: '50%' }}></span>
            Daemon Online
          </div>
        </div>
      </aside>

      {/* Main View Area */}
      <main className="main-view">
        
        {activeView === 'overview' && (
          <div>
            <h1 style={{ marginBottom: '2rem' }}>System <span className="acc">Overview</span></h1>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '2rem' }}>
              <div className="glass-card">
                <p className="label">Solana Balance</p>
                <p style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--acc-color)' }}>{stats?.balanceSol?.toFixed(4) || '0.000'} <span style={{ fontSize: '1rem', color: 'var(--text-secondary)' }}>SOL</span></p>
              </div>
              <div className="glass-card">
                <p className="label">Total Gated Spend</p>
                <p style={{ fontSize: '2.5rem', fontWeight: 800, color: '#ef4444' }}>{stats?.totalSpentSol?.toFixed(4) || '0.000'} <span style={{ fontSize: '1rem', color: 'var(--text-secondary)' }}>SOL</span></p>
              </div>
              <div className="glass-card">
                <p className="label">Network Status</p>
                <p style={{ fontSize: '2.5rem', fontWeight: 800 }}>{stats?.network?.toUpperCase() || '---'}</p>
              </div>
            </div>
            
            <div className="glass-card" style={{ marginTop: '2rem' }}>
              <h3>Agent Identity</h3>
              <p className="mono" style={{ marginTop: '1rem', color: 'var(--text-secondary)', wordBreak: 'break-all' }}>{stats?.address || 'Loading agent public key...'}</p>
            </div>
          </div>
        )}

        {activeView === 'activity' && (
          <div>
            <h1 style={{ marginBottom: '2rem' }}>Activity <span className="acc">Logs</span></h1>
            <div className="glass-card" style={{ padding: 0 }}>
              {activity.map((item) => (
                <div key={item.id} className="feed-item">
                  <div className="feed-icon">{item.type === 'transaction' ? '💸' : '🧠'}</div>
                  <div className="feed-content">
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <p className="feed-title">{item.title}</p>
                      <p className="feed-time">{new Date(item.timestamp).toLocaleString()}</p>
                    </div>
                    <p className="feed-desc">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeView === 'policy' && (
          <div style={{ maxWidth: '800px' }}>
            <h1 style={{ marginBottom: '2rem' }}>Safety <span className="acc">Gates</span></h1>
            <div className="glass-card">
              <form onSubmit={handleSavePolicy}>
                <div className="input-group">
                  <label className="label">Daily Spend Cap (Lamports)</label>
                  <input type="number" value={policy?.dailySpendCapLamports || 0} onChange={e => setPolicy({...policy, dailySpendCapLamports: Number(e.target.value)})} />
                </div>
                <div className="input-group">
                  <label className="label">Max Single Action (Lamports)</label>
                  <input type="number" value={policy?.maxSingleActionLamports || 0} onChange={e => setPolicy({...policy, maxSingleActionLamports: Number(e.target.value)})} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                  <div className="input-group">
                    <label className="label">Drawdown Threshold (%)</label>
                    <input type="number" value={policy?.drawdownTrigger?.thresholdPct || 0} onChange={e => setPolicy({...policy, drawdownTrigger: {...policy.drawdownTrigger, thresholdPct: Number(e.target.value)}})} />
                  </div>
                  <div className="input-group">
                    <label className="label">Recovery Action</label>
                    <select value={policy?.drawdownTrigger?.deRiskAction || ''} onChange={e => setPolicy({...policy, drawdownTrigger: {...policy.drawdownTrigger, deRiskAction: e.target.value}})}>
                      <option value="swap_to_usdc">Swap to USDC</option>
                      <option value="halt">Halt Execution</option>
                    </select>
                  </div>
                </div>
                <button type="submit" className="btn-primary" disabled={isSaving} style={{ marginTop: '2rem' }}>
                  {isSaving ? 'Applying Changes...' : 'Save & Propagate Policy'}
                </button>
              </form>
            </div>
          </div>
        )}

        {activeView === 'wiki' && (
          <div>
            <h1 style={{ marginBottom: '2rem' }}>System <span className="acc">Wiki</span></h1>
            <div className="wiki-container">
              <aside className="wiki-tree">
                {renderWikiTree(wikiFiles)}
              </aside>
              <article className="wiki-content markdown-body">
                {selectedWikiPath ? (
                  <div dangerouslySetInnerHTML={{ __html: marked(wikiContent) }} />
                ) : (
                  <p style={{ color: 'var(--text-secondary)' }}>Select a wiki entry to view autonomous internal logs.</p>
                )}
              </article>
            </div>
          </div>
        )}

        {activeView === 'monitoring' && (
          <div>
            <h1 style={{ marginBottom: '2rem' }}>Observability <span className="acc">Stack</span></h1>
            <iframe 
              src="http://localhost:8080" 
              className="monitoring-frame"
              title="SigNoz Dashboard"
            ></iframe>
            <p className="mono" style={{ marginTop: '1rem', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
              Connected to SigNoz OTel Collector at http://localhost:8080
            </p>
          </div>
        )}

      </main>
    </div>
  );
}
