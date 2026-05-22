import React, { useState, useEffect, useCallback } from "react";
import { AppHeader } from "./components/AppHeader";
import { ThemeSwitcher } from "./components/ThemeSwitcher";
import { DashboardPage } from "./pages/DashboardPage";
import { UploadPage } from "./pages/UploadPage";
import { AuditPage } from "./pages/AuditPage";
import { EventsPage } from "./pages/EventsPage";
import { RecommendationsPage } from "./pages/RecommendationsPage";
import { useTheme } from "./hooks/useTheme";
import { api } from "./lib/api";

export default function App() {
  const { activeThemeId, setTheme, themes } = useTheme();

  const [page, setPage]         = useState('dashboard');
  const [events, setEvents]     = useState([]);
  const [boms, setBoms]         = useState([]);
  const [targetRec, setTargetRec]       = useState(null);
  const [activeMapEvent, setActiveMapEvent] = useState(null);

  const loadEvents = useCallback(async () => {
    try {
      const d = await api("GET", "/events");
      setEvents(d.events || []);
    } catch {
      /* ignore */
    }
  }, []);

  const loadBoms = useCallback(async () => {
    try {
      const d = await api("GET", "/boms");
      const seen = new Set();
      setBoms((d || []).filter(b => seen.has(b.id) ? false : seen.add(b.id)));
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    loadEvents();
    loadBoms();
  }, [loadEvents, loadBoms]);

  useEffect(() => {
    if (page !== "dashboard") setActiveMapEvent(null);
  }, [page]);

  const navigate = (p) => setPage(p);

  return (
    <div
      className={page === 'dashboard' ? 'layout-grid' : ''}
      style={page !== 'dashboard' ? { minHeight: '100vh', display: 'flex', flexDirection: 'column' } : {}}
    >
      <h1 className="sr-only">Espada — Supply Chain Intelligence</h1>
      <AppHeader page={page} setPage={setPage} />

      {page === 'dashboard' && (
        <DashboardPage
          boms={boms}
          activeMapEvent={activeMapEvent}
          loadBoms={loadBoms}
          setPage={setPage}
        />
      )}

      {page !== 'dashboard' && (
        <main style={{ padding: '32px 40px', flex: 1, margin: '0 auto', width: '100%', maxWidth: '1100px', overflowY: 'auto' }}>
          {page === 'company' && (
            <UploadPage setPage={navigate} loadEvents={loadEvents} loadBoms={loadBoms} />
          )}
          {page === 'report' && <AuditPage />}
          {page === 'events' && (
            <EventsPage
              events={events}
              setPage={navigate}
              setTargetRec={setTargetRec}
              setActiveMapEvent={setActiveMapEvent}
              activeMapEvent={activeMapEvent}
            />
          )}
          {page === 'scenarios' && (
            <RecommendationsPage targetRec={targetRec} setTargetRec={setTargetRec} />
          )}
        </main>
      )}

      <ThemeSwitcher activeThemeId={activeThemeId} setTheme={setTheme} themes={themes} />
    </div>
  );
}
