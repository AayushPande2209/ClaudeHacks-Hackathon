import React, { useState, useEffect, useCallback } from "react";
import { Glass } from "../components/ui/Glass";
import { Btn } from "../components/ui/Btn";
import { Chip, StatusChip } from "../components/ui/Chip";
import { api } from "../lib/api";

function SupplierRow({ row }) {
  const w = row.website_or_notes || "";
  const isUrl = /^https?:\/\//i.test(w);
  return (
    <div style={{
      padding: 12,
      borderRadius: 8,
      background: "var(--bg-elevated)",
      border: "1px solid var(--bg-border)",
      marginBottom: 8,
    }}>
      <div style={{ fontWeight: 600, fontSize: 13 }}>{row.company_name}</div>
      <div className="body-sm" style={{ color: "var(--fg-3)", marginTop: 4 }}>
        {row.country} · {row.estimated_lead_time_weeks != null ? `${row.estimated_lead_time_weeks} wk lead` : "—"}
      </div>
      {isUrl ? (
        <a href={w} target="_blank" rel="noreferrer" className="body-sm" style={{ display: "block", marginTop: 6 }}>
          {w}
        </a>
      ) : (
        <div className="body-sm" style={{ marginTop: 6, color: "var(--fg-2)" }}>{w}</div>
      )}
      <div style={{ marginTop: 6, color: "var(--fg-2)" }}>{row.rationale}</div>
      <div style={{ marginTop: 8, fontStyle: 'italic', fontSize: 11, color: "var(--fg-3)" }}>
        * AI-suggested lead — verify independently before contacting.
      </div>
    </div>
  );
}

function RunningAnalysisNotice() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          flexShrink: 0,
          background: "var(--accent)",
          boxShadow: "0 0 6px var(--accent)",
        }} />
        <span style={{ fontSize: 12, color: "var(--text-primary)", fontWeight: 600 }}>
          Analysis running
        </span>
      </div>
      <span style={{ color: "var(--text-muted)", fontSize: 11, fontFamily: "var(--font-mono)" }}>
        Polling recommendation status until results are ready…
      </span>
    </div>
  );
}

function RecDetail({ recId, onBack }) {
  const [rec, setRec] = useState(null);
  const [loading, setLoading] = useState(true);
  const [approvingScenarioId, setApprovingScenarioId] = useState(null);
  const [pendingScenarioId, setPendingScenarioId] = useState(null);

  const refreshRec = useCallback(() => {
    return api("GET", `/recommendations/${recId}`).then(setRec);
  }, [recId]);

  useEffect(() => {
    let interval;
    api("GET", `/recommendations/${recId}`)
      .then((r) => {
        setRec(r);
        setLoading(r.status === "running");
        if (r.status === "running") {
          interval = setInterval(() => {
            api("GET", `/recommendations/${recId}`)
              .then((r2) => {
                setRec(r2);
                if (r2.status === "complete" || r2.status === "error") {
                  clearInterval(interval);
                  setLoading(false);
                }
              })
              .catch(() => {
                clearInterval(interval);
                setLoading(false);
              });
          }, 5000);
        }
      })
      .catch(() => setLoading(false));
    return () => clearInterval(interval);
  }, [recId]);

  useEffect(() => {
    if (!rec || rec.status !== "awaiting_approval") return;
    const ranked = rec.ranked_scenarios || [];
    const needsPoll = ranked.find(
      (s) => s.scenario_id && s.chosen && s.supplier_results == null
    );
    if (needsPoll) {
      queueMicrotask(() => setPendingScenarioId(needsPoll.scenario_id));
    }
  }, [rec]);

  useEffect(() => {
    if (!pendingScenarioId) return;
    const sid = pendingScenarioId;
    const poll = async () => {
      try {
        const s = await api("GET", `/scenarios/${sid}`);
        if (Array.isArray(s.supplier_results)) {
          setPendingScenarioId(null);
          setRec((prev) => {
            if (!prev) return prev;
            const ranked = (prev.ranked_scenarios || []).map((rs) =>
              rs.scenario_id === sid
                ? { ...rs, supplier_results: s.supplier_results, chosen: true }
                : rs
            );
            return { ...prev, ranked_scenarios: ranked };
          });
        }
      } catch {
        /* keep polling */
      }
    };
    poll();
    const id = setInterval(poll, 5000);
    return () => clearInterval(id);
  }, [pendingScenarioId]);

  async function approveScenario(scenarioId) {
    if (!scenarioId) return;
    setApprovingScenarioId(scenarioId);
    try {
      await api("POST", `/scenarios/${scenarioId}/approve`);
      setPendingScenarioId(scenarioId);
      await refreshRec();
    } catch (e) {
      alert(e.message || String(e));
    } finally {
      setApprovingScenarioId(null);
    }
  }

  if (loading && !rec) {
    return (
      <Glass>
        <RunningAnalysisNotice />
      </Glass>
    );
  }
  if (!rec) return <div className="body-sm">Recommendation not found.</div>;

  const ranked = rec.ranked_scenarios || [];
  const anyChosen = ranked.some((x) => x.chosen);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 24 }}>
        <Btn variant="ghost" small onClick={onBack}>← Back</Btn>
        <div style={{ width: 1, height: 16, background: 'var(--bg-border)' }} />
        <span className="eyebrow">Recommendation</span>
        <StatusChip status={rec.status} />
      </div>

      {rec.status === "running" && (
        <Glass style={{ marginBottom: 16 }}>
          <RunningAnalysisNotice />
        </Glass>
      )}

      {rec.status === "error" && rec.error && (
        <Glass
          style={{
            marginBottom: 20,
            border: "1px solid var(--danger-25)",
            background: "var(--danger-dim)",
          }}
        >
          <div className="eyebrow" style={{ marginBottom: 8, color: "var(--danger)" }}>
            Pipeline Error
          </div>
          <div style={{ color: "var(--danger)", whiteSpace: "pre-wrap" }}>{rec.error}</div>
        </Glass>
      )}

      {ranked.length === 0 && rec.status === "complete" && (
        <Glass style={{ marginBottom: 20 }}>
          <div className="body-sm" style={{ padding: 4 }}>
            No affected SKUs found for this event. Try uploading a BOM with supplier country data, or analyze a
            different event.
          </div>
        </Glass>
      )}

      {ranked.length > 0 && (
        <div style={{ marginBottom: 20, display: "flex", flexDirection: "column", gap: 14 }}>
          <span className="eyebrow">Ranked Scenarios</span>
          {ranked.map((s, i) => {
            const st = (s.strategy || s.scenario_type || "").replace("_", " ");
            const sid = s.scenario_id;
            const chosen = !!s.chosen;
            const finding = chosen && pendingScenarioId === sid;
            const results = s.supplier_results;
            const hasSuppliers = Array.isArray(results) && results.length > 0;
            const approveDisabled =
              !sid ||
              (anyChosen && !chosen) ||
              approvingScenarioId != null ||
              (chosen && hasSuppliers);

            return (
              <Glass
                key={sid || i}
                padding={16}
                style={{
                  border: chosen ? "1px solid var(--success-45)" : undefined,
                  boxShadow: chosen ? "0 0 0 1px var(--success-12)" : undefined,
                }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 6 }}>
                      <span style={{ fontWeight: 700, color: "var(--accent)", width: 24 }}>#{s.rank || i + 1}</span>
                      <span style={{ fontWeight: 600, textTransform: "capitalize" }}>{st}</span>
                      {chosen && (
                        <Chip bg="var(--success-10)" fg="var(--success)">
                          Approved
                        </Chip>
                      )}
                      {finding && (
                        <span className="body-sm" style={{ color: "var(--fg-3)" }}>
                          Finding suppliers…
                        </span>
                      )}
                    </div>
                    <div className="body-sm" style={{ color: "var(--fg-2)", marginBottom: 8 }}>
                      {s.recommendation_rationale}
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        color: "var(--fg-3)",
                        fontFamily: "var(--font-mono)",
                      }}
                    >
                      Cost change: {s.annual_cost_delta_usd != null ? `$${Number(s.annual_cost_delta_usd).toLocaleString()}` : "—"}
                      {" · "}
                      Lead time: {s.lead_time_months != null ? `${s.lead_time_months}mo` : "—"}
                      {" · "}
                      Coverage: {s.supplier_coverage_pct != null ? `${s.supplier_coverage_pct}%` : "—"}
                    </div>
                  </div>
                  <div style={{ flexShrink: 0 }}>
                    {rec.status === "complete" && (
                      <Btn
                        small
                        disabled={approveDisabled}
                        onClick={() => approveScenario(sid)}
                      >
                        {approvingScenarioId === sid
                          ? "…"
                          : finding
                            ? "…"
                            : "Approve"}
                      </Btn>
                    )}
                  </div>
                </div>

                {chosen && Array.isArray(results) && results.length > 0 && (
                  <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--bg-border)" }}>
                    <div className="eyebrow" style={{ marginBottom: 10 }}>
                      Supplier candidates
                    </div>
                    {results.map((row, ri) => (
                      <SupplierRow key={ri} row={row} />
                    ))}
                  </div>
                )}
                {chosen && Array.isArray(results) && results.length === 0 && !finding && (
                  <div className="body-sm" style={{ marginTop: 12, color: "var(--fg-3)" }}>
                    No supplier results returned. Try again or check API logs.
                  </div>
                )}
              </Glass>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function RecommendationsPage({ targetRec, setTargetRec }) {
  const [recs, setRecs] = useState([]);
  const [selected, setSelected] = useState(targetRec || null);

  useEffect(() => {
    api("GET", "/recommendations")
      .then((data) => {
        const list = Array.isArray(data) ? data : data.recommendations || [];
        setRecs(list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!targetRec) return;
    queueMicrotask(() => setSelected(targetRec));
  }, [targetRec]);

  if (selected) {
    return (
      <div style={{ maxWidth: 860, margin: "0 auto" }}>
        <RecDetail
          recId={selected}
          onBack={() => {
            setSelected(null);
            setTargetRec(null);
          }}
        />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 860, margin: "0 auto" }}>
      <div style={{ marginBottom: 24 }}>
        <span className="eyebrow" style={{ display: 'block', marginBottom: 6 }}>Analysis</span>
        <div className="h4">Scenarios</div>
      </div>
      {recs.length === 0 ? (
        <Glass>
          <div className="body-sm" style={{ padding: 4 }}>
            No recommendations yet. Go to Events and click Analyze on an event.
          </div>
        </Glass>
      ) : (
        <Glass padding={0} style={{ overflow: 'hidden' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Event</th>
                <th>Status</th>
                <th>Created</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {recs.map((r, i) => (
                <tr key={i}>
                  <td style={{ maxWidth: 300, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {r.event_id}
                  </td>
                  <td>
                    <StatusChip status={r.status} />
                  </td>
                  <td style={{ color: "var(--fg-3)", fontSize: 11, fontFamily: 'var(--font-mono)' }}>
                    {r.created_at ? new Date(r.created_at).toLocaleString() : "—"}
                  </td>
                  <td>
                    <Btn small onClick={() => setSelected(r.id)}>
                      View
                    </Btn>
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
