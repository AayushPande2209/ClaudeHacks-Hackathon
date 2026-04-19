import React, { useState, useRef } from "react";
import { Glass } from "../components/ui/Glass";
import { Btn } from "../components/ui/Btn";

const EMPTY_PART = { sku_code: '', description: '', supplier_country: '', unit_cost_usd: '' };

function partsToCsv(parts) {
  const header = 'sku_code,description,supplier_country,unit_cost_usd';
  const rows = parts.map(p =>
    [p.sku_code, `"${(p.description||'').replace(/"/g,'""')}"`, p.supplier_country, p.unit_cost_usd].join(',')
  );
  return [header, ...rows].join('\n');
}

export function UploadPage({ setPage }) {
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(null);
  const [error, setError] = useState(null);
  const [bomFile, setBomFile] = useState(null);
  const [pdfFiles, setPdfFiles] = useState([]);
  const [parts, setParts] = useState([]);
  const [newPart, setNewPart] = useState(EMPTY_PART);
  const fileRef = useRef();

  const inputStyle = {
    padding:'7px 10px', borderRadius:6, border:'1px solid var(--border-1)',
    background:'var(--grey-025)', fontSize:13, color:'var(--fg-1)',
    outline:'none', fontFamily:'var(--font-sans)', width:'100%',
  };
  const labelStyle = { display:'block', marginBottom:6, fontWeight:500, color:'var(--fg-2)', fontSize:13 };
  const fieldGroup = { marginBottom:20 };

  function addPart() {
    if (!newPart.sku_code && !newPart.description) return;
    setParts(prev => [...prev, { ...newPart }]);
    setNewPart(EMPTY_PART);
  }

  function removePart(i) {
    setParts(prev => prev.filter((_, idx) => idx !== i));
  }

  async function submit() {
    setSaving(true); setError(null);
    try {
      const fd = new FormData();

      // If user built parts manually, generate a CSV blob
      if (parts.length > 0 && !bomFile) {
        const csv = partsToCsv(parts);
        fd.append('bom_csv', new Blob([csv], { type: 'text/csv' }), 'materials.csv');
      } else if (bomFile) {
        fd.append('bom_csv', bomFile);
      }
      for (const f of pdfFiles) fd.append('pdfs', f);

      const r = await fetch("/api/v1/materials/upload", { method: 'POST', body: fd });
      if (!r.ok) throw new Error(await r.text());
      const data = await r.json();
      setDone(data);
    } catch(e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  if (done) return (
    <Glass style={{maxWidth:640, margin:'60px auto'}}>
      <div style={{padding:'16px 0'}}>
        <div style={{textAlign:'center', marginBottom:20}}>
          <div style={{fontSize:40, marginBottom:12}}>✓</div>
          <div className="h5" style={{marginBottom:6}}>Materials Uploaded</div>
          <div className="body-sm">
            {done.row_count > 0
              ? `${done.row_count} materials rows stored${done.pdf_chars_extracted ? ` · ${done.pdf_chars_extracted.toLocaleString()} chars from PDFs` : ''}.`
              : done.pdf_chars_extracted ? `${done.pdf_chars_extracted.toLocaleString()} chars extracted from PDFs.`
              : 'No materials uploaded.'}
          </div>
          {done.tariff_event_id && (
            <div className="body-sm" style={{color:'var(--sev-med)', marginTop:8}}>
              Tariff event generated — existing duties identified on your parts.
            </div>
          )}
          {done.bom_id && (
            <div className="body-sm" style={{color:'var(--fg-3)', marginTop:4, fontFamily:'var(--font-mono)', fontSize:11}}>
              bom_id: {done.bom_id}
            </div>
          )}
        </div>
        {done.preview_rows && done.preview_rows.length > 0 && (
          <div style={{marginBottom:20}}>
            <div className="eyebrow" style={{marginBottom:8}}>Preview</div>
            <div style={{overflowX:'auto'}}>
              <table style={{width:'100%', borderCollapse:'collapse', fontSize:12, fontFamily:'var(--font-mono)'}}>
                <thead>
                  <tr style={{borderBottom:'1px solid var(--border-1)', color:'var(--fg-3)'}}>
                    {['SKU','Description','Country','Cost (USD)','HS Code'].map(h=>(
                      <th key={h} style={{padding:'4px 8px', textAlign:'left', fontWeight:500}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {done.preview_rows.map((r,i)=>(
                    <tr key={i} style={{borderBottom:'1px solid var(--border-1)'}}>
                      <td style={{padding:'4px 8px'}}>{r.sku_code}</td>
                      <td style={{padding:'4px 8px', maxWidth:200, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{r.description}</td>
                      <td style={{padding:'4px 8px'}}>{r.supplier_country}</td>
                      <td style={{padding:'4px 8px'}}>{r.unit_cost_usd != null ? `$${Number(r.unit_cost_usd).toFixed(2)}` : '—'}</td>
                      <td style={{padding:'4px 8px', color: r.hs_code ? 'var(--fg-1)' : 'var(--fg-3)'}}>{r.hs_code || 'pending'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {done.validation_errors && done.validation_errors.length > 0 && (
              <div style={{marginTop:8, color:'var(--sev-med)', fontSize:11}}>
                {done.validation_errors.length} validation warning(s)
              </div>
            )}
          </div>
        )}
        <div style={{textAlign:'center', display:'flex', gap:12, justifyContent:'center'}}>
          {done.tariff_event_id && setPage && (
            <Btn onClick={() => setPage('events')}>View Tariff Event</Btn>
          )}
          <Btn variant="ghost" onClick={()=>setDone(null)}>Upload More</Btn>
        </div>
      </div>
    </Glass>
  );

  const canSubmit = parts.length > 0 || bomFile || pdfFiles.length > 0;

  return (
    <div style={{maxWidth:700, margin:'0 auto'}}>
      <div className="h4" style={{marginBottom:4}}>Upload Materials</div>
      <div className="body-sm" style={{marginBottom:24}}>
        Build your parts list manually, upload a CSV, or attach supporting PDFs.
      </div>

      {/* ── Visual BOM builder ─────────────────────────── */}
      <Glass style={{marginBottom:16}}>
        <div className="eyebrow" style={{marginBottom:12}}>Parts List</div>

        {parts.length > 0 && (
          <div style={{overflowX:'auto', marginBottom:12}}>
            <table style={{width:'100%', borderCollapse:'collapse', fontSize:12, fontFamily:'var(--font-mono)'}}>
              <thead>
                <tr style={{borderBottom:'1px solid var(--border-1)', color:'var(--fg-3)'}}>
                  {['SKU','Description','Country','Cost',''].map((h,i) => (
                    <th key={i} style={{padding:'4px 8px', textAlign:'left', fontWeight:500}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {parts.map((p, i) => (
                  <tr key={i} style={{borderBottom:'1px solid var(--border-1)'}}>
                    <td style={{padding:'4px 8px'}}>{p.sku_code}</td>
                    <td style={{padding:'4px 8px', maxWidth:200, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{p.description}</td>
                    <td style={{padding:'4px 8px'}}>{p.supplier_country}</td>
                    <td style={{padding:'4px 8px'}}>{p.unit_cost_usd ? `$${Number(p.unit_cost_usd).toFixed(2)}` : '—'}</td>
                    <td style={{padding:'4px 8px'}}>
                      <button onClick={() => removePart(i)}
                        style={{background:'none', border:'none', color:'var(--fg-3)', cursor:'pointer', fontSize:14, lineHeight:1}}>✕</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div style={{display:'grid', gridTemplateColumns:'1fr 2fr 1fr 1fr auto', gap:8, alignItems:'center'}}>
          {[
            {key:'sku_code', placeholder:'SKU'},
            {key:'description', placeholder:'Description'},
            {key:'supplier_country', placeholder:'Country'},
            {key:'unit_cost_usd', placeholder:'Cost USD', type:'number'},
          ].map(({key, placeholder, type}) => (
            <input key={key} type={type||'text'} placeholder={placeholder}
              value={newPart[key]} style={inputStyle}
              onChange={e => setNewPart(p => ({...p, [key]: e.target.value}))}
              onKeyDown={e => e.key === 'Enter' && addPart()} />
          ))}
          <Btn onClick={addPart} small>+ Add</Btn>
        </div>
        {parts.length > 0 && (
          <div className="body-sm" style={{marginTop:8, color:'var(--fg-3)'}}>
            {parts.length} part{parts.length !== 1 ? 's' : ''} · will be submitted as CSV
          </div>
        )}
      </Glass>

      {/* ── File upload ────────────────────────────────── */}
      <Glass style={{marginBottom:16}}>
        <div className="eyebrow" style={{marginBottom:12}}>Or Upload Files</div>
        <div style={fieldGroup}>
          <label style={labelStyle}>Materials spreadsheet (CSV / TSV)</label>
          <input ref={fileRef} type="file" accept=".csv,.tsv" style={{...inputStyle, padding:'8px 10px'}}
            onChange={e => setBomFile(e.target.files?.[0] || null)} />
          {bomFile && <div style={{marginTop:6, color:'var(--sev-low)', fontSize:13}}>✓ {bomFile.name}</div>}
        </div>
        <div style={fieldGroup}>
          <label style={labelStyle}>Supporting PDFs (optional — product sheets, tariff rulings)</label>
          <input type="file" accept=".pdf" multiple style={{...inputStyle, padding:'8px 10px'}}
            onChange={e => setPdfFiles(Array.from(e.target.files || []))} />
          {pdfFiles.length > 0 && (
            <div style={{marginTop:6, color:'var(--sev-low)', fontSize:13}}>
              ✓ {pdfFiles.map(f => f.name).join(', ')}
            </div>
          )}
        </div>
      </Glass>

      {error && (
        <div style={{background:'var(--orange-050)', border:'1px solid var(--orange-300)',
          borderRadius:8, padding:'10px 14px', marginBottom:16, color:'var(--sev-critical)', fontSize:13}}>
          {error}
        </div>
      )}
      <Btn onClick={submit} disabled={saving || !canSubmit}>
        {saving ? 'Uploading…' : `Upload Materials${parts.length > 0 ? ` (${parts.length} parts)` : ''}`}
      </Btn>
    </div>
  );
}
