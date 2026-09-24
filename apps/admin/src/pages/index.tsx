import React, { useState } from 'react';

// Permission Types (§10.4, §13.1)
type Permission = 'users.read' | 'users.suspend' | 'consent.read' | 'consent.revoke' | 'telemetry.read' | 'billing.refund';

interface AuditLogEntry {
  id: string;
  timestamp: string;
  agentId: string;
  permission: Permission;
  action: string;
  targetId: string;
  status: 'SUCCESS' | 'FAILED';
}

interface UserRecord {
  id: string;
  phoneHash: string;
  language: 'am-ET' | 'en-US';
  wakeWord: string;
  lastSeen: string;
  status: 'ACTIVE' | 'SUSPENDED';
}

const mockUsers: UserRecord[] = [
  {
    id: 'usr_8f9a2b7c4d1e',
    phoneHash: 'sha256:8f9a2b7c4d1e0f3a7c6e9d2a...',
    language: 'am-ET',
    wakeWord: '፩-አሌፍ (Addis AI)',
    lastSeen: '2026-09-24 20:45:12',
    status: 'ACTIVE',
  },
  {
    id: 'usr_3c4d5e6f7a8b',
    phoneHash: 'sha256:3c4d5e6f7a8b9c0d1e2f3a4b...',
    language: 'en-US',
    wakeWord: 'EchoGuide Standard',
    lastSeen: '2026-09-24 19:12:00',
    status: 'ACTIVE',
  },
];

const mockConsentEvents = [
  { id: 'cns_101', scope: 'voice_data_processing', granted: true, timestamp: '2026-09-01 10:00:00' },
  { id: 'cns_102', scope: 'audio_retention_opt_in', granted: false, timestamp: '2026-09-01 10:00:00' },
];

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<'users' | 'consent' | 'telemetry' | 'billing' | 'audit'>('users');
  const [searchQuery, setSearchQuery] = useState('');
  const [users, setUsers] = useState<UserRecord[]>(mockUsers);
  const [selectedUser, setSelectedUser] = useState<UserRecord | null>(mockUsers[0]);
  const [refundAmount, setRefundAmount] = useState('');
  const [refundReason, setRefundReason] = useState('');

  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([
    {
      id: 'aud_901',
      timestamp: '2026-09-24 20:30:15',
      agentId: 'agent_sarah',
      permission: 'users.read',
      action: 'Lookup user record',
      targetId: 'usr_8f9a2b7c4d1e',
      status: 'SUCCESS',
    },
    {
      id: 'aud_902',
      timestamp: '2026-09-24 19:15:00',
      agentId: 'agent_alex',
      permission: 'billing.refund',
      action: 'Issued subscription refund $9.99',
      targetId: 'usr_3c4d5e6f7a8b',
      status: 'SUCCESS',
    },
  ]);

  const logAuditAction = (permission: Permission, action: string, targetId: string) => {
    const newEntry: AuditLogEntry = {
      id: `aud_${Date.now()}`,
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      agentId: 'agent_admin_current',
      permission,
      action,
      targetId,
      status: 'SUCCESS',
    };
    setAuditLogs((prev) => [newEntry, ...prev]);
  };

  const handleToggleSuspend = (userId: string) => {
    setUsers((prev) =>
      prev.map((u) => {
        if (u.id === userId) {
          const newStatus = u.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
          logAuditAction(
            'users.suspend',
            `${newStatus === 'SUSPENDED' ? 'Suspended' : 'Reactivated'} user account`,
            userId
          );
          const updated = { ...u, status: newStatus as 'ACTIVE' | 'SUSPENDED' };
          if (selectedUser?.id === userId) setSelectedUser(updated);
          return updated;
        }
        return u;
      })
    );
  };

  const handleRevokeConsent = (userId: string) => {
    logAuditAction('consent.revoke', 'Revoked user voice consent on request', userId);
    alert(`Voice processing consent for user ${userId} has been revoked and logged to audit stream.`);
  };

  const handleProcessRefund = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser || !refundAmount) return;
    logAuditAction(
      'billing.refund',
      `Processed refund of $${refundAmount} (Reason: ${refundReason || 'Customer Request'})`,
      selectedUser.id
    );
    alert(`Refund of $${refundAmount} processed for ${selectedUser.id}. Audited.`);
    setRefundAmount('');
    setRefundReason('');
  };

  return (
    <div style={styles.pageContainer}>
      {/* Header Bar */}
      <header style={styles.header}>
        <div>
          <h1 style={styles.headerTitle}>EchoGuide Support & Admin Portal</h1>
          <p style={styles.headerSubtitle}>
            Audited Administrative Operations & Telemetry (§13.1) • No DB Direct Access
          </p>
        </div>
        <div style={styles.agentBadge}>
          <span style={styles.agentDot} />
          <span>LoggedIn: agent_admin_current</span>
        </div>
      </header>

      {/* Main Navigation Tabs */}
      <nav style={styles.navBar}>
        <button
          style={{ ...styles.navTab, ...(activeTab === 'users' ? styles.navTabActive : {}) }}
          onClick={() => setActiveTab('users')}
        >
          👥 User Lookup & Action (users.read, users.suspend)
        </button>
        <button
          style={{ ...styles.navTab, ...(activeTab === 'consent' ? styles.navTabActive : {}) }}
          onClick={() => setActiveTab('consent')}
        >
          🔒 Consent Management (consent.read, consent.revoke)
        </button>
        <button
          style={{ ...styles.navTab, ...(activeTab === 'telemetry' ? styles.navTabActive : {}) }}
          onClick={() => setActiveTab('telemetry')}
        >
          📊 Telemetry & SLO (telemetry.read)
        </button>
        <button
          style={{ ...styles.navTab, ...(activeTab === 'billing' ? styles.navTabActive : {}) }}
          onClick={() => setActiveTab('billing')}
        >
          💳 Billing & Refunds (billing.refund)
        </button>
        <button
          style={{ ...styles.navTab, ...(activeTab === 'audit' ? styles.navTabActive : {}) }}
          onClick={() => setActiveTab('audit')}
        >
          📜 Live Audit Log ({auditLogs.length})
        </button>
      </nav>

      {/* Main Content Area */}
      <main style={styles.mainContent}>
        {/* TAB 1: USER LOOKUP & SUSPEND */}
        {activeTab === 'users' && (
          <div>
            <div style={styles.card}>
              <div style={styles.cardHeaderRow}>
                <h3>User Lookup & Account Suspension</h3>
                <span style={styles.permissionTag}>Permission: users.read, users.suspend (Audited)</span>
              </div>
              <p style={styles.cardSub}>
                Search by Hashed Phone ID or User UUID. Support staff never see command content (§13.1).
              </p>

              <input
                type="text"
                placeholder="Search by Hashed Phone ID or User ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={styles.inputField}
              />

              <div style={styles.gridTwoCol}>
                {/* User List */}
                <div>
                  <h4 style={styles.sectionHeading}>Matching User Records</h4>
                  {users
                    .filter((u) => u.phoneHash.includes(searchQuery) || u.id.includes(searchQuery))
                    .map((user) => (
                      <div
                        key={user.id}
                        onClick={() => setSelectedUser(user)}
                        style={{
                          ...styles.listItem,
                          ...(selectedUser?.id === user.id ? styles.listItemActive : {}),
                        }}
                      >
                        <div>
                          <strong>{user.id}</strong>
                          <div style={{ fontSize: '0.8rem', color: '#8b949e' }}>{user.phoneHash}</div>
                        </div>
                        <span style={user.status === 'ACTIVE' ? styles.badgeSuccess : styles.badgeDanger}>
                          {user.status}
                        </span>
                      </div>
                    ))}
                </div>

                {/* User Detail & Actions */}
                {selectedUser && (
                  <div style={styles.detailCard}>
                    <h4 style={styles.sectionHeading}>User Record Details</h4>
                    <div style={styles.detailRow}>
                      <span style={styles.detailLabel}>User ID:</span>
                      <code>{selectedUser.id}</code>
                    </div>
                    <div style={styles.detailRow}>
                      <span style={styles.detailLabel}>Hashed Phone ID (§10.4):</span>
                      <code>{selectedUser.phoneHash}</code>
                    </div>
                    <div style={styles.detailRow}>
                      <span style={styles.detailLabel}>Primary Language:</span>
                      <span>{selectedUser.language === 'am-ET' ? 'አማርኛ (Amharic)' : 'English (US)'}</span>
                    </div>
                    <div style={styles.detailRow}>
                      <span style={styles.detailLabel}>Wake-Word Model:</span>
                      <span>{selectedUser.wakeWord}</span>
                    </div>
                    <div style={styles.detailRow}>
                      <span style={styles.detailLabel}>Last Active Timestamp:</span>
                      <span>{selectedUser.lastSeen}</span>
                    </div>

                    <div style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid #30363d' }}>
                      <button
                        onClick={() => handleToggleSuspend(selectedUser.id)}
                        style={selectedUser.status === 'ACTIVE' ? styles.btnDanger : styles.btnSuccess}
                      >
                        {selectedUser.status === 'ACTIVE' ? '🚫 Suspend User Account' : '✓ Reactivate User Account'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: CONSENT MANAGEMENT */}
        {activeTab === 'consent' && (
          <div>
            <div style={styles.card}>
              <div style={styles.cardHeaderRow}>
                <h3>Consent Timeline & Revocation</h3>
                <span style={styles.permissionTag}>Permission: consent.read, consent.revoke (Audited)</span>
              </div>
              <p style={styles.cardSub}>
                Append-only consent grant log (§9.3). Revocation writes a new row and notifies backend pipeline immediately.
              </p>

              {selectedUser && (
                <div style={styles.detailCard}>
                  <h4>Consent Status for User: {selectedUser.id}</h4>
                  <div style={{ marginTop: '1rem' }}>
                    {mockConsentEvents.map((evt) => (
                      <div key={evt.id} style={styles.timelineItem}>
                        <div>
                          <strong>{evt.scope}</strong>
                          <div style={{ fontSize: '0.8rem', color: '#8b949e' }}>{evt.timestamp}</div>
                        </div>
                        <span style={evt.granted ? styles.badgeSuccess : styles.badgeDanger}>
                          {evt.granted ? 'GRANTED' : 'REVOKED'}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div style={{ marginTop: '1.5rem' }}>
                    <button
                      onClick={() => handleRevokeConsent(selectedUser.id)}
                      style={styles.btnDanger}
                    >
                      🛡️ Revoke Voice Processing Consent on Request (Audited)
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: TELEMETRY & SLO */}
        {activeTab === 'telemetry' && (
          <div>
            <div style={styles.card}>
              <div style={styles.cardHeaderRow}>
                <h3>Telemetry & Latency SLO Dashboard (§3, §12)</h3>
                <span style={styles.permissionTag}>Permission: telemetry.read (Aggregate Only)</span>
              </div>

              {/* SLO Cards */}
              <div style={styles.statsGrid}>
                <div style={styles.statBox}>
                  <div style={styles.statLabel}>Command Success Rate</div>
                  <div style={styles.statValue}>94.2%</div>
                  <div style={styles.statMeta}>Target: &gt; 90.0% (SLO OK)</div>
                </div>

                <div style={styles.statBox}>
                  <div style={styles.statLabel}>Time to First Audio (p95)</div>
                  <div style={styles.statValue}>4.8 s</div>
                  <div style={styles.statMeta}>Target: &lt; 6.0 s (SLO OK)</div>
                </div>

                <div style={styles.statBox}>
                  <div style={styles.statLabel}>API Probe Availability</div>
                  <div style={styles.statValue}>99.8%</div>
                  <div style={styles.statMeta}>Target: 99.5% (SLO OK)</div>
                </div>

                <div style={styles.statBox}>
                  <div style={styles.statLabel}>Provider Error Rate</div>
                  <div style={styles.statValue}>0.6%</div>
                  <div style={styles.statMeta}>Target: &lt; 2.0% (SLO OK)</div>
                </div>
              </div>

              {/* Pipeline Stage Breakdown */}
              <h4 style={{ marginTop: '2rem', marginBottom: '1rem' }}>Pipeline Stage Latency Breakdown (§7.1)</h4>
              <div style={styles.stageBarContainer}>
                <div style={styles.stageBarRow}>
                  <span>VAD Buffer (0.4 s):</span>
                  <div style={styles.barFill}><div style={{ width: '15%', backgroundColor: '#1f6feb', height: '100%', borderRadius: '4px' }} /></div>
                  <span>400ms</span>
                </div>
                <div style={styles.stageBarRow}>
                  <span>Upload PCM (16 kHz):</span>
                  <div style={styles.barFill}><div style={{ width: '25%', backgroundColor: '#238636', height: '100%', borderRadius: '4px' }} /></div>
                  <span>650ms</span>
                </div>
                <div style={styles.stageBarRow}>
                  <span>Addis STT Transcribe:</span>
                  <div style={styles.barFill}><div style={{ width: '45%', backgroundColor: '#d29922', height: '100%', borderRadius: '4px' }} /></div>
                  <span>1,200ms</span>
                </div>
                <div style={styles.stageBarRow}>
                  <span>Addis LLM Action Planner:</span>
                  <div style={styles.barFill}><div style={{ width: '70%', backgroundColor: '#a371f7', height: '100%', borderRadius: '4px' }} /></div>
                  <span>1,800ms</span>
                </div>
                <div style={styles.stageBarRow}>
                  <span>Exec + TTS Response:</span>
                  <div style={styles.barFill}><div style={{ width: '35%', backgroundColor: '#3fb950', height: '100%', borderRadius: '4px' }} /></div>
                  <span>750ms</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: BILLING & REFUNDS */}
        {activeTab === 'billing' && (
          <div>
            <div style={styles.card}>
              <div style={styles.cardHeaderRow}>
                <h3>Billing & Subscription Refunds</h3>
                <span style={styles.permissionTag}>Permission: billing.refund (Audited)</span>
              </div>

              <form onSubmit={handleProcessRefund} style={styles.refundForm}>
                <h4>Process Subscription Refund</h4>
                <div style={{ marginBottom: '1rem' }}>
                  <label style={styles.detailLabel}>Target User ID:</label>
                  <input
                    type="text"
                    value={selectedUser?.id || ''}
                    readOnly
                    style={styles.inputField}
                  />
                </div>

                <div style={{ marginBottom: '1rem' }}>
                  <label style={styles.detailLabel}>Refund Amount ($):</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="9.99"
                    value={refundAmount}
                    onChange={(e) => setRefundAmount(e.target.value)}
                    required
                    style={styles.inputField}
                  />
                </div>

                <div style={{ marginBottom: '1rem' }}>
                  <label style={styles.detailLabel}>Refund Reason:</label>
                  <input
                    type="text"
                    placeholder="Customer request / service outage"
                    value={refundReason}
                    onChange={(e) => setRefundReason(e.target.value)}
                    required
                    style={styles.inputField}
                  />
                </div>

                <button type="submit" style={styles.btnPrimary}>
                  💳 Process Refund & Log Audit Event
                </button>
              </form>
            </div>
          </div>
        )}

        {/* TAB 5: LIVE AUDIT LOG STREAM */}
        {activeTab === 'audit' && (
          <div>
            <div style={styles.card}>
              <div style={styles.cardHeaderRow}>
                <h3>Administrative Audit Stream (§8.3, §13.1)</h3>
                <span style={styles.permissionTag}>Audited Log - Immutable</span>
              </div>

              <table style={styles.table}>
                <thead>
                  <tr style={styles.tableHeaderRow}>
                    <th style={styles.th}>Log ID</th>
                    <th style={styles.th}>Timestamp</th>
                    <th style={styles.th}>Agent</th>
                    <th style={styles.th}>Permission</th>
                    <th style={styles.th}>Action Description</th>
                    <th style={styles.th}>Target User ID</th>
                    <th style={styles.th}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLogs.map((log) => (
                    <tr key={log.id} style={styles.tableRow}>
                      <td style={styles.td}><code>{log.id}</code></td>
                      <td style={styles.td}>{log.timestamp}</td>
                      <td style={styles.td}>{log.agentId}</td>
                      <td style={styles.td}><span style={styles.permBadge}>{log.permission}</span></td>
                      <td style={styles.td}>{log.action}</td>
                      <td style={styles.td}><code>{log.targetId}</code></td>
                      <td style={styles.td}><span style={styles.badgeSuccess}>{log.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

// Inline Glassmorphic Dark Design System Tokens
const styles: { [key: string]: React.CSSProperties } = {
  pageContainer: {
    minHeight: '100vh',
    backgroundColor: '#0d1117',
    color: '#f0f6fc',
    fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '1.5rem 2rem',
    backgroundColor: '#161b22',
    borderBottom: '1px solid #30363d',
  },
  headerTitle: {
    fontSize: '1.5rem',
    fontWeight: '700',
    color: '#238636',
    margin: 0,
  },
  headerSubtitle: {
    fontSize: '0.875rem',
    color: '#8b949e',
    marginTop: '0.25rem',
  },
  agentBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    backgroundColor: '#0d1117',
    padding: '0.5rem 1rem',
    borderRadius: '20px',
    border: '1px solid #30363d',
    fontSize: '0.85rem',
  },
  agentDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    backgroundColor: '#2ea043',
  },
  navBar: {
    display: 'flex',
    gap: '0.5rem',
    padding: '0.75rem 2rem',
    backgroundColor: '#161b22',
    borderBottom: '1px solid #30363d',
    overflowX: 'auto',
  },
  navTab: {
    backgroundColor: 'transparent',
    color: '#8b949e',
    border: 'none',
    padding: '0.6rem 1rem',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '0.875rem',
    fontWeight: '600',
    transition: 'all 0.2s ease',
  },
  navTabActive: {
    backgroundColor: '#238636',
    color: '#ffffff',
  },
  mainContent: {
    padding: '2rem',
    maxWidth: '1280px',
    margin: '0 auto',
  },
  card: {
    backgroundColor: '#161b22',
    borderRadius: '10px',
    border: '1px solid #30363d',
    padding: '1.5rem',
  },
  cardHeaderRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '0.5rem',
  },
  cardSub: {
    color: '#8b949e',
    fontSize: '0.875rem',
    marginBottom: '1.5rem',
  },
  permissionTag: {
    backgroundColor: 'rgba(31, 111, 235, 0.15)',
    color: '#58a6ff',
    border: '1px solid #1f6feb',
    padding: '0.25rem 0.75rem',
    borderRadius: '12px',
    fontSize: '0.75rem',
    fontWeight: '600',
  },
  inputField: {
    width: '100%',
    padding: '0.75rem 1rem',
    backgroundColor: '#0d1117',
    border: '1px solid #30363d',
    borderRadius: '6px',
    color: '#f0f6fc',
    fontSize: '0.9rem',
    boxSizing: 'border-box',
    marginBottom: '1.5rem',
  },
  gridTwoCol: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '1.5rem',
  },
  sectionHeading: {
    fontSize: '1rem',
    color: '#f0f6fc',
    marginBottom: '1rem',
  },
  listItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#0d1117',
    border: '1px solid #30363d',
    borderRadius: '6px',
    padding: '1rem',
    marginBottom: '0.75rem',
    cursor: 'pointer',
  },
  listItemActive: {
    borderColor: '#238636',
    backgroundColor: 'rgba(35, 134, 54, 0.1)',
  },
  detailCard: {
    backgroundColor: '#0d1117',
    border: '1px solid #30363d',
    borderRadius: '8px',
    padding: '1.5rem',
  },
  detailRow: {
    display: 'flex',
    justifyContent: 'space-between',
    paddingVertical: '0.5rem',
    borderBottom: '1px solid #21262d',
    fontSize: '0.875rem',
  },
  detailLabel: {
    color: '#8b949e',
  },
  btnDanger: {
    backgroundColor: '#da3633',
    color: '#ffffff',
    border: 'none',
    padding: '0.75rem 1.25rem',
    borderRadius: '6px',
    fontWeight: '600',
    cursor: 'pointer',
    width: '100%',
  },
  btnSuccess: {
    backgroundColor: '#238636',
    color: '#ffffff',
    border: 'none',
    padding: '0.75rem 1.25rem',
    borderRadius: '6px',
    fontWeight: '600',
    cursor: 'pointer',
    width: '100%',
  },
  btnPrimary: {
    backgroundColor: '#1f6feb',
    color: '#ffffff',
    border: 'none',
    padding: '0.75rem 1.25rem',
    borderRadius: '6px',
    fontWeight: '600',
    cursor: 'pointer',
    width: '100%',
  },
  badgeSuccess: {
    backgroundColor: 'rgba(46, 160, 67, 0.15)',
    color: '#3fb950',
    padding: '0.2rem 0.6rem',
    borderRadius: '12px',
    fontSize: '0.75rem',
    fontWeight: '600',
  },
  badgeDanger: {
    backgroundColor: 'rgba(248, 81, 73, 0.15)',
    color: '#f85149',
    padding: '0.2rem 0.6rem',
    borderRadius: '12px',
    fontSize: '0.75rem',
    fontWeight: '600',
  },
  timelineItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '0.75rem 0',
    borderBottom: '1px solid #21262d',
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '1rem',
  },
  statBox: {
    backgroundColor: '#0d1117',
    border: '1px solid #30363d',
    borderRadius: '8px',
    padding: '1.25rem',
  },
  statLabel: {
    fontSize: '0.85rem',
    color: '#8b949e',
  },
  statValue: {
    fontSize: '1.8rem',
    fontWeight: '700',
    color: '#f0f6fc',
    margin: '0.5rem 0',
  },
  statMeta: {
    fontSize: '0.75rem',
    color: '#3fb950',
  },
  stageBarContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
  },
  stageBarRow: {
    display: 'grid',
    gridTemplateColumns: '200px 1fr 80px',
    alignItems: 'center',
    gap: '1rem',
    fontSize: '0.875rem',
  },
  barFill: {
    backgroundColor: '#0d1117',
    height: '14px',
    borderRadius: '4px',
    overflow: 'hidden',
    border: '1px solid #30363d',
  },
  refundForm: {
    maxWidth: '500px',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '0.875rem',
  },
  tableHeaderRow: {
    borderBottom: '2px solid #30363d',
    textAlign: 'left',
  },
  th: {
    padding: '0.75rem',
    color: '#8b949e',
  },
  tableRow: {
    borderBottom: '1px solid #21262d',
  },
  td: {
    padding: '0.75rem',
  },
  permBadge: {
    backgroundColor: '#21262d',
    color: '#d29922',
    padding: '0.15rem 0.5rem',
    borderRadius: '4px',
    fontSize: '0.75rem',
  },
};
