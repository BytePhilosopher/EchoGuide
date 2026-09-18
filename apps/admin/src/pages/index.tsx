import React from 'react';

export default function AdminDashboard() {
  return (
    <div style={{ padding: '2rem', fontFamily: 'system-ui, sans-serif', backgroundColor: '#0d1117', color: '#f0f6fc', minHeight: '100vh' }}>
      <h1>EchoGuide — Support & Admin Portal</h1>
      <p style={{ color: '#8b949e' }}>Audited administrative management interface (§13.1)</p>

      {/* Main Architecture Overview Section */}
      <div style={{ background: '#161b22', padding: '1.5rem', borderRadius: '8px', border: '1px solid #30363d', marginBottom: '2rem' }}>
        <h2>System Architecture Overview</h2>
        <img
          src="/assets/system_architecture_diagram.svg"
          alt="System Architecture Diagram"
          style={{ width: '100%', maxHeight: '400px', objectFit: 'contain' }}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem' }}>
        <div style={{ background: '#161b22', padding: '1rem', borderRadius: '8px', border: '1px solid #30363d' }}>
          <h3>User Lookup</h3>
          <p style={{ fontSize: '0.9rem', color: '#8b949e' }}>Permission: <code>users.read</code> (Audited)</p>
          <input type="text" placeholder="Search by Hashed Phone ID..." style={{ padding: '0.5rem', width: '90%', background: '#0d1117', color: '#fff', border: '1px solid #30363d' }} />
        </div>

        <div style={{ background: '#161b22', padding: '1rem', borderRadius: '8px', border: '1px solid #30363d' }}>
          <h3>Consent Revocation</h3>
          <p style={{ fontSize: '0.9rem', color: '#8b949e' }}>Permission: <code>consent.revoke</code> (Audited)</p>
          <button style={{ padding: '0.5rem 1rem', background: '#da3633', color: '#fff', border: 'none', borderRadius: '4px' }}>Revoke User Consent</button>
        </div>
      </div>
    </div>
  );
}
