import React, { useState, useEffect } from "react";
import { Glass } from "../components/ui/Glass";
import { api } from "../lib/api";

export function AuditPage() {
  const [runs, setRuns] = useState([]);

  useEffect(() => {
    api('GET', '/audit').then(d => setRuns(d || [])).catch(() => {});
  }, []);

  return (
    <div style={{ maxWidth: 860, margin: '0 auto' }}>
      <div style={{ marginBottom: 28 }}>
        <span className="eyebrow" style={{ display: 'block', marginBottom: 6 }}>System</span>
        <div className="h4">Agent Audit Log</div>
      </div>

      {runs.length === 0 ? (
        <Glass padding={24}>
          <div className="body-sm">No agent runs recorded yet.</div>
        </Glass>
      ) : (
        <Glass padding={0} style={{ overflow: 'hidden' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Agent</th>
                <th>Model</th>
                <th>Started</th>
                <th>Latency</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((r, i) => (
                <tr key={i}>
                  <td style={{ fontWeight: 500 }}>{r.agent_name}</td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-secondary)' }}>
                    {r.model}
                  </td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>
                    {r.started_at?.slice(0, 19).replace('T', ' ')}
                  </td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-secondary)' }}>
                    {r.latency_ms != null ? `${r.latency_ms}ms` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Glass>
      )}
    </div>
  );
}
