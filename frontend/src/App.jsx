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

  const [page, setPage]   = useState('dashboard');
  const [apiOk, setApiOk] = useState(false);
  const [events, setEvents] = useState([]);
  const [boms, setBoms]     = useState([]);
  const [targetRec, setTargetRec] = useState(null);
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
      setBoms(d);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(()=>{
    api('GET','/health').then(()=>setApiOk(true)).catch(()=>setApiOk(false));
    queueMicrotask(() => {
      loadEvents();
      loadBoms();
    });

    const healthTimer = setInterval(()=>{
      api('GET','/health').then(()=>setApiOk(true)).catch(()=>setApiOk(false));
    }, 5000);
    const eventsTimer = setInterval(loadEvents, 30000);
    return ()=>{ clearInterval(healthTimer); clearInterval(eventsTimer); };
  }, [loadEvents, loadBoms]);

  useEffect(() => {
    if (page !== "dashboard") queueMicrotask(() => setActiveMapEvent(null));
  }, [page]);

  const navigate = (p) => setPage(p);

  return (
    <div className={page === 'dashboard' ? 'layout-grid' : ''} style={page !== 'dashboard' ? {minHeight:'100vh', display:'flex', flexDirection:'column'} : {}}>
      <AppHeader page={page} setPage={setPage} apiOk={apiOk} />

      {page === 'dashboard' && (
        <DashboardPage
          boms={boms}
          events={events}
          activeMapEvent={activeMapEvent}
          setActiveMapEvent={setActiveMapEvent}
          loadBoms={loadBoms}
          setPage={setPage}
        />
      )}

      {page !== 'dashboard' && (
        <main style={{padding:'32px 40px', flex:1, margin:'0 auto', width:'100%', maxWidth:'1100px', overflowY:'auto'}}>
          {page === 'company' && (
            <UploadPage setPage={navigate} loadEvents={loadEvents} loadBoms={loadBoms} />
          )}
          {page === 'report' && <AuditPage />}
          {page === 'events' && <EventsPage events={events} loadEvents={loadEvents} setPage={navigate} setTargetRec={setTargetRec} setActiveMapEvent={setActiveMapEvent} activeMapEvent={activeMapEvent} />}
          {page === 'scenarios' && <RecommendationsPage targetRec={targetRec} setTargetRec={setTargetRec} />}
        </main>
      )}

      <ThemeSwitcher activeThemeId={activeThemeId} setTheme={setTheme} themes={themes} />
    </div>
  );
}
