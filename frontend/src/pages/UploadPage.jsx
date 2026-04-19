import React, { useState, useRef } from "react";
import { Glass } from "../components/ui/Glass";
import { Btn } from "../components/ui/Btn";
import { Chip } from "../components/ui/Chip";

// ── helpers ────────────────────────────────────────────────────────────────

const EMPTY_PART = {
  sku_code: '', description: '', supplier_name: '',
  supplier_country: '', tier: '1', annual_quantity: '',
  unit_cost_usd: '', hs_code: '', lead_time_weeks: '', critical_path: false,
};

function partsToCsv(parts) {
  const header = 'sku_code,description,supplier_name,supplier_country,tier,annual_quantity,unit_cost_usd,hs_code';
  const rows = parts.map(p =>
    [
      p.sku_code,
      `"${(p.description || '').replace(/"/g, '""')}"`,
      `"${(p.supplier_name || '').replace(/"/g, '""')}"`,
      p.supplier_country,
      p.tier || 1,
      p.annual_quantity || '',
      p.unit_cost_usd || '',
      p.hs_code || '',
    ].join(',')
  );
  return [header, ...rows].join('\n');
}

const inputStyle = {
  padding: '8px 10px', borderRadius: 7, border: '1px solid var(--border-1)',
  background: 'var(--grey-025)', fontSize: 13, color: 'var(--fg-1)',
  outline: 'none', fontFamily: 'var(--font-sans)', width: '100%', boxSizing: 'border-box',
};
const labelStyle = { display: 'block', marginBottom: 5, fontWeight: 500, color: 'var(--fg-2)', fontSize: 12 };

// ── Product Card ──────────────────────────────────────────────────────────

function ProductCard({ product, onRemove }) {
  const [open, setOpen] = useState(false);
  const statusColor = product.status === 'done' ? '#16a34a'
    : product.status === 'error' ? '#D14343' : '#D97706';
  const statusLabel = product.status === 'done' ? 'Uploaded'
    : product.status === 'error' ? 'Failed' : 'Pending';

  return (
    <Glass padding={16} style={{ cursor: 'pointer' }} onClick={() => setOpen(o => !o)}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: 40, height: 40, borderRadius: 10, flexShrink: 0,
          background: 'rgba(76,111,174,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 18,
        }}>☕</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 14 }}>{product.name || 'Untitled Product'}</div>
          <div style={{ fontSize: 11, color: 'var(--fg-3)', marginTop: 2, fontFamily: 'var(--font-mono)' }}>
            {product.parts.length} part{product.parts.length !== 1 ? 's' : ''}
            {product.csvFile ? ` · CSV: ${product.csvFile.name}` : ''}
            {product.pdfFiles?.length ? ` · ${product.pdfFiles.length} PDF` : ''}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            fontSize: 10, fontWeight: 700, fontFamily: 'var(--font-mono)',
            color: statusColor, background: `${statusColor}18`, borderRadius: 6, padding: '2px 8px',
          }}>{statusLabel}</span>
          {product.status !== 'done' && (
            <button onClick={e => { e.stopPropagation(); onRemove(); }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fg-3)', fontSize: 16, lineHeight: 1, padding: 4 }}>
              ✕
            </button>
          )}
          <span style={{ color: 'var(--fg-3)', fontSize: 12 }}>{open ? '▴' : '▾'}</span>
        </div>
      </div>

      {open && product.parts.length > 0 && (
        <div style={{ marginTop: 12, borderTop: '1px solid var(--border-1)', paddingTop: 12 }} onClick={e => e.stopPropagation()}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, fontFamily: 'var(--font-mono)' }}>
            <thead>
              <tr style={{ color: 'var(--fg-3)', borderBottom: '1px solid var(--border-1)' }}>
                {['SKU', 'Description', 'Supplier', 'Country', 'Qty', 'Cost', 'HS'].map(h => (
                  <th key={h} style={{ padding: '4px 6px', textAlign: 'left', fontWeight: 500 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {product.parts.map((p, i) => (
                <tr key={i} style={{ borderBottom: '1px solid var(--border-1)' }}>
                  <td style={{ padding: '4px 6px' }}>{p.sku_code || '—'}</td>
                  <td style={{ padding: '4px 6px', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.description}</td>
                  <td style={{ padding: '4px 6px', color: 'var(--fg-3)' }}>{p.supplier_name || '—'}</td>
                  <td style={{ padding: '4px 6px' }}>{p.supplier_country}</td>
                  <td style={{ padding: '4px 6px' }}>{p.annual_quantity || '—'}</td>
                  <td style={{ padding: '4px 6px' }}>{p.unit_cost_usd ? `$${Number(p.unit_cost_usd).toFixed(2)}` : '—'}</td>
                  <td style={{ padding: '4px 6px', color: p.hs_code ? 'var(--fg-1)' : 'var(--fg-3)' }}>{p.hs_code || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {open && product.result && (
        <div style={{ marginTop: 10, fontSize: 11, color: 'var(--fg-3)', borderTop: '1px solid var(--border-1)', paddingTop: 10 }}
          onClick={e => e.stopPropagation()}>
          {product.result.tariff_event_id && (
            <span style={{ color: '#D97706' }}>⚡ Tariff event detected on upload · </span>
          )}
          bom_id: {product.result.bom_id}
        </div>
      )}
      {open && product.error && (
        <div style={{ marginTop: 10, fontSize: 11, color: '#D14343', borderTop: '1px solid var(--border-1)', paddingTop: 10 }}>
          {product.error}
        </div>
      )}
    </Glass>
  );
}

// ── Add Product Modal ──────────────────────────────────────────────────────

function AddProductModal({ onSave, onClose }) {
  const [name, setName] = useState('');
  const [tab, setTab] = useState('manual'); // 'manual' | 'upload'
  const [parts, setParts] = useState([]);
  const [newPart, setNewPart] = useState(EMPTY_PART);
  const [csvFile, setCsvFile] = useState(null);
  const [pdfFiles, setPdfFiles] = useState([]);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [partError, setPartError] = useState('');
  const csvRef = useRef();
  const pdfRef = useRef();

  function addPart() {
    if (!newPart.description && !newPart.sku_code) { setPartError('Description or SKU required.'); return; }
    setParts(p => [...p, { ...newPart }]);
    setNewPart(EMPTY_PART);
    setPartError('');
  }
  function removePart(i) { setParts(p => p.filter((_, idx) => idx !== i)); }
  function handleSave() {
    if (!name.trim() && parts.length === 0 && !csvFile && pdfFiles.length === 0) return;
    onSave({ name: name.trim() || 'Untitled Product', parts, csvFile, pdfFiles });
  }

  const hasContent = parts.length > 0 || csvFile || pdfFiles.length > 0;

  const TAB_BTN = (key, label) => (
    <button key={key} onClick={() => setTab(key)} style={{
      flex: 1, padding: '9px 0', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
      borderRadius: 8,
      background: tab === key ? 'var(--surface)' : 'transparent',
      color: tab === key ? 'var(--fg-1)' : 'var(--fg-3)',
      boxShadow: tab === key ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
    }}>{label}</button>
  );

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 2000,
      background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 24,
    }} onClick={onClose}>
      <div style={{
        background: '#FFFFFF', borderRadius: 16, width: '100%', maxWidth: 560,
        maxHeight: '90vh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 24px 80px rgba(0,0,0,0.25)',
      }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ padding: '18px 20px 14px', borderBottom: '1px solid var(--border-1)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontWeight: 700, fontSize: 16 }}>Add Product</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: 'var(--fg-3)', lineHeight: 1, padding: 4 }}>✕</button>
        </div>

        {/* Scrollable body */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '16px 20px' }}>

          {/* Product name */}
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Product Name</label>
            <input type="text" placeholder="e.g. House Blend Coffee, Retail Packaging Kit…"
              value={name} onChange={e => setName(e.target.value)} autoFocus
              style={{ ...inputStyle, fontSize: 14, padding: '9px 11px' }} />
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: 4, background: '#ECECEF', borderRadius: 10, padding: 4, marginBottom: 16 }}>
            {TAB_BTN('manual', '✏️  Add Parts Manually')}
            {TAB_BTN('upload', '📄  Upload CSV / PDF')}
          </div>

          {/* Manual tab */}
          {tab === 'manual' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {/* Parts added so far */}
              {parts.length > 0 && (
                <div style={{ borderRadius: 8, border: '1px solid var(--border-1)', overflow: 'hidden', marginBottom: 4 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, fontFamily: 'var(--font-mono)' }}>
                    <thead>
                      <tr style={{ background: 'var(--grey-025)', color: 'var(--fg-3)' }}>
                        {['SKU', 'Description', 'Country', 'Cost', ''].map((h, i) => (
                          <th key={i} style={{ padding: '5px 8px', textAlign: 'left', fontWeight: 500 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {parts.map((p, i) => (
                        <tr key={i} style={{ borderTop: '1px solid var(--border-1)' }}>
                          <td style={{ padding: '4px 8px' }}>{p.sku_code || '—'}</td>
                          <td style={{ padding: '4px 8px', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.description}</td>
                          <td style={{ padding: '4px 8px' }}>{p.supplier_country}</td>
                          <td style={{ padding: '4px 8px' }}>{p.unit_cost_usd ? `$${Number(p.unit_cost_usd).toFixed(2)}` : '—'}</td>
                          <td style={{ padding: '4px 8px' }}>
                            <button onClick={() => removePart(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#D14343', fontSize: 13 }}>✕</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* New part inputs */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div>
                  <label style={labelStyle}>SKU Code</label>
                  <input type="text" placeholder="GCB-ETH-001" value={newPart.sku_code}
                    style={inputStyle} onChange={e => setNewPart(p => ({ ...p, sku_code: e.target.value }))} />
                </div>
                <div>
                  <label style={labelStyle}>Supplier Country <span style={{ color: '#D14343' }}>*</span></label>
                  <input type="text" placeholder="China, Vietnam, CN…" value={newPart.supplier_country}
                    style={inputStyle} onChange={e => setNewPart(p => ({ ...p, supplier_country: e.target.value }))} />
                </div>
              </div>
              <div>
                <label style={labelStyle}>Description <span style={{ color: '#D14343' }}>*</span></label>
                <input type="text" placeholder="e.g. 12oz Kraft Bag w/ One-Way Valve" value={newPart.description}
                  style={inputStyle} onChange={e => setNewPart(p => ({ ...p, description: e.target.value }))}
                  onKeyDown={e => e.key === 'Enter' && addPart()} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div>
                  <label style={labelStyle}>Unit Cost (USD)</label>
                  <input type="number" placeholder="0.00" min="0" step="0.01" value={newPart.unit_cost_usd}
                    style={inputStyle} onChange={e => setNewPart(p => ({ ...p, unit_cost_usd: e.target.value }))} />
                </div>
                <div>
                  <label style={labelStyle}>Annual Quantity</label>
                  <input type="number" placeholder="5000" min="0" value={newPart.annual_quantity}
                    style={inputStyle} onChange={e => setNewPart(p => ({ ...p, annual_quantity: e.target.value }))} />
                </div>
              </div>

              {showAdvanced && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '10px 12px', background: 'var(--grey-025)', borderRadius: 8, border: '1px solid var(--border-1)' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--fg-3)', letterSpacing: '0.05em' }}>ADVANCED</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <div>
                      <label style={labelStyle}>Supplier Name</label>
                      <input type="text" placeholder="Company name" value={newPart.supplier_name}
                        style={inputStyle} onChange={e => setNewPart(p => ({ ...p, supplier_name: e.target.value }))} />
                    </div>
                    <div>
                      <label style={labelStyle}>HS Code</label>
                      <input type="text" placeholder="0901.11" value={newPart.hs_code}
                        style={inputStyle} onChange={e => setNewPart(p => ({ ...p, hs_code: e.target.value }))} />
                    </div>
                    <div>
                      <label style={labelStyle}>Supply Tier</label>
                      <select value={newPart.tier} style={inputStyle} onChange={e => setNewPart(p => ({ ...p, tier: e.target.value }))}>
                        <option value="1">Tier 1 — Direct</option>
                        <option value="2">Tier 2</option>
                        <option value="3">Tier 3</option>
                        <option value="4">Tier 4 — Raw</option>
                      </select>
                    </div>
                    <div>
                      <label style={labelStyle}>Lead Time (weeks)</label>
                      <input type="number" placeholder="8" min="0" value={newPart.lead_time_weeks}
                        style={inputStyle} onChange={e => setNewPart(p => ({ ...p, lead_time_weeks: e.target.value }))} />
                    </div>
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                    <input type="checkbox" checked={newPart.critical_path}
                      onChange={e => setNewPart(p => ({ ...p, critical_path: e.target.checked }))} />
                    <span style={{ fontSize: 12, color: 'var(--fg-2)' }}>Critical path</span>
                  </label>
                </div>
              )}

              {partError && <div style={{ color: '#D14343', fontSize: 12 }}>{partError}</div>}

              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={addPart} style={{
                  flex: 1, padding: '8px 14px', borderRadius: 8, border: '1px dashed var(--accent)',
                  background: 'rgba(76,111,174,0.06)', color: 'var(--accent)', fontSize: 13,
                  fontWeight: 600, cursor: 'pointer',
                }}>+ Add Part</button>
                <button onClick={() => setShowAdvanced(a => !a)} style={{
                  padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border-1)',
                  background: 'none', color: 'var(--fg-3)', fontSize: 12, cursor: 'pointer',
                }}>{showAdvanced ? 'Fewer fields' : 'More fields'}</button>
              </div>
            </div>
          )}

          {/* Upload tab */}
          {tab === 'upload' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ fontSize: 13, color: 'var(--fg-2)', lineHeight: 1.6, padding: '10px 12px', background: 'rgba(76,111,174,0.06)', borderRadius: 8 }}>
                Upload a <strong>CSV/TSV</strong> and our AI extracts all parts, supplier countries, HS codes, and costs automatically. Attach <strong>PDFs</strong> for extra context.
              </div>

              {/* CSV drop zone */}
              <div>
                <label style={{ ...labelStyle, marginBottom: 8 }}>Materials Spreadsheet (CSV / TSV)</label>
                <div onClick={() => csvRef.current?.click()} style={{
                  border: `2px dashed ${csvFile ? '#16a34a' : 'var(--border-1)'}`,
                  borderRadius: 10, padding: '24px 16px', textAlign: 'center', cursor: 'pointer',
                  background: csvFile ? 'rgba(22,163,74,0.05)' : 'var(--grey-025)',
                  transition: 'border-color 0.15s',
                }}>
                  <div style={{ fontSize: 28, marginBottom: 6 }}>{csvFile ? '✅' : '📄'}</div>
                  <div style={{ fontSize: 13, color: csvFile ? '#16a34a' : 'var(--fg-2)', fontWeight: csvFile ? 600 : 400 }}>
                    {csvFile ? csvFile.name : 'Click to choose CSV / TSV'}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--fg-3)', marginTop: 4 }}>
                    SKU · Description · Supplier Country · Cost · HS Code
                  </div>
                  <input ref={csvRef} type="file" accept=".csv,.tsv" style={{ display: 'none' }}
                    onChange={e => setCsvFile(e.target.files?.[0] || null)} />
                </div>
                {csvFile && (
                  <button onClick={() => setCsvFile(null)} style={{ marginTop: 5, fontSize: 11, color: 'var(--fg-3)', background: 'none', border: 'none', cursor: 'pointer' }}>Remove</button>
                )}
              </div>

              {/* PDF drop zone */}
              <div>
                <label style={{ ...labelStyle, marginBottom: 8 }}>Supporting PDFs <span style={{ color: 'var(--fg-3)', fontWeight: 400 }}>(optional)</span></label>
                <div onClick={() => pdfRef.current?.click()} style={{
                  border: `2px dashed ${pdfFiles.length ? '#16a34a' : 'var(--border-1)'}`,
                  borderRadius: 10, padding: '20px 16px', textAlign: 'center', cursor: 'pointer',
                  background: pdfFiles.length ? 'rgba(22,163,74,0.05)' : 'var(--grey-025)',
                }}>
                  <div style={{ fontSize: 28, marginBottom: 6 }}>{pdfFiles.length ? '✅' : '📑'}</div>
                  <div style={{ fontSize: 13, color: pdfFiles.length ? '#16a34a' : 'var(--fg-2)', fontWeight: pdfFiles.length ? 600 : 400 }}>
                    {pdfFiles.length ? `${pdfFiles.length} file${pdfFiles.length > 1 ? 's' : ''} selected` : 'Product sheets, tariff rulings…'}
                  </div>
                  <input ref={pdfRef} type="file" accept=".pdf" multiple style={{ display: 'none' }}
                    onChange={e => setPdfFiles(Array.from(e.target.files || []))} />
                </div>
                {pdfFiles.length > 0 && (
                  <button onClick={() => setPdfFiles([])} style={{ marginTop: 5, fontSize: 11, color: 'var(--fg-3)', background: 'none', border: 'none', cursor: 'pointer' }}>Remove all</button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '12px 20px', borderTop: '1px solid var(--border-1)', flexShrink: 0,
          display: 'flex', justifyContent: 'flex-end', gap: 8,
          background: '#F4F4F6', borderRadius: '0 0 16px 16px',
        }}>
          <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
          <Btn onClick={handleSave} disabled={!hasContent && !name.trim()}>
            Save &amp; Upload
          </Btn>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────

export function UploadPage({ setPage, loadEvents, loadBoms }) {
  const [products, setProducts]   = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [globalError, setGlobalError] = useState(null);

  async function uploadProduct(product) {
    const id = Date.now();
    setProducts(p => [...p, { ...product, id, status: 'uploading' }]);
    setModalOpen(false);

    try {
      const fd = new FormData();

      if (product.parts.length > 0 && !product.csvFile) {
        const csv = partsToCsv(product.parts);
        fd.append('bom_csv', new Blob([csv], { type: 'text/csv' }), `${product.name}.csv`);
      } else if (product.csvFile) {
        fd.append('bom_csv', product.csvFile);
      }
      for (const f of (product.pdfFiles || [])) fd.append('pdfs', f);

      // Pass product name as form field via the name inside the file blob name already
      const r = await fetch('/api/v1/materials/upload', { method: 'POST', body: fd });
      if (!r.ok) {
        const msg = await r.text();
        let detail = msg;
        try { detail = JSON.parse(msg)?.detail || msg; } catch {}
        setProducts(p => p.map(x => x.id === id ? { ...x, status: 'error', error: detail } : x));
        return;
      }
      const data = await r.json();
      setProducts(p => p.map(x => x.id === id ? { ...x, status: 'done', result: data } : x));
      if (typeof loadEvents === 'function') loadEvents();
      if (typeof loadBoms === 'function') loadBoms();
    } catch (e) {
      setProducts(p => p.map(x => x.id === id ? { ...x, status: 'error', error: e.message } : x));
    }
  }

  function removeProduct(id) {
    setProducts(p => p.filter(x => x.id !== id));
  }

  const doneCount  = products.filter(p => p.status === 'done').length;
  const errorCount = products.filter(p => p.status === 'error').length;
  const hasTariffEvent = products.some(p => p.result?.tariff_event_id);

  return (
    <div style={{ maxWidth: 820, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <div className="h4" style={{ marginBottom: 4 }}>Products</div>
          <div className="body-sm" style={{ color: 'var(--fg-3)' }}>
            Add products and their parts. Upload a CSV or PDF and the AI extracts everything for you.
          </div>
        </div>
        {products.length > 0 && (
          <Btn onClick={() => setModalOpen(true)}>+ Add Product</Btn>
        )}
      </div>

      {/* Upload summary banner */}
      {(doneCount > 0 || errorCount > 0) && (
        <div style={{
          marginBottom: 20, padding: '12px 16px', borderRadius: 10,
          background: errorCount ? 'rgba(209,67,67,0.07)' : 'rgba(22,163,74,0.07)',
          border: `1px solid ${errorCount ? 'rgba(209,67,67,0.2)' : 'rgba(22,163,74,0.2)'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ fontSize: 13 }}>
            {doneCount > 0 && <span style={{ color: '#16a34a', fontWeight: 600 }}>✓ {doneCount} uploaded</span>}
            {errorCount > 0 && <span style={{ color: '#D14343', fontWeight: 600, marginLeft: 12 }}>✕ {errorCount} failed</span>}
            {hasTariffEvent && <span style={{ color: '#D97706', marginLeft: 12 }}>⚡ Tariff events detected on your parts</span>}
          </div>
          {doneCount > 0 && setPage && (
            <div style={{ display: 'flex', gap: 8 }}>
              {hasTariffEvent && (
                <Btn small onClick={() => setPage('events')}>View Tariff Events</Btn>
              )}
              <Btn small variant="ghost" onClick={() => setPage('dashboard')}>Back to Dashboard</Btn>
            </div>
          )}
        </div>
      )}

      {/* Products list */}
      {products.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {products.map(product => (
            <ProductCard
              key={product.id}
              product={product}
              onRemove={() => removeProduct(product.id)}
            />
          ))}
        </div>
      ) : (
        /* Empty state — centered Add Product CTA */
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          minHeight: 380, textAlign: 'center',
        }}>
          <div onClick={() => setModalOpen(true)} style={{
            width: 72, height: 72, borderRadius: 20, background: 'rgba(76,111,174,0.1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 32, marginBottom: 20, cursor: 'pointer',
            transition: 'background 0.15s',
          }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(76,111,174,0.2)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(76,111,174,0.1)'}
          >+</div>
          <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 8 }}>Add a product</div>
          <div style={{ fontSize: 14, color: 'var(--fg-3)', maxWidth: 360, lineHeight: 1.6, marginBottom: 28 }}>
            Define a product and its parts manually, or upload a CSV / PDF and let the AI build your Bill of Materials.
          </div>
          <Btn onClick={() => setModalOpen(true)} style={{ padding: '12px 28px', fontSize: 15 }}>
            + Add Product
          </Btn>

          {/* Feature pills */}
          <div style={{ display: 'flex', gap: 10, marginTop: 28, flexWrap: 'wrap', justifyContent: 'center' }}>
            {['AI extracts parts from CSV / PDF', 'Auto-detects HS codes', 'Maps tariff exposure', 'Supplier country required for map'].map(t => (
              <span key={t} style={{
                fontSize: 11, padding: '4px 10px', borderRadius: 20,
                background: 'var(--grey-025)', border: '1px solid var(--border-1)', color: 'var(--fg-3)',
              }}>{t}</span>
            ))}
          </div>
        </div>
      )}

      {globalError && (
        <div style={{ marginTop: 16, color: '#D14343', fontSize: 13 }}>{globalError}</div>
      )}

      {modalOpen && (
        <AddProductModal
          onSave={uploadProduct}
          onClose={() => setModalOpen(false)}
        />
      )}
    </div>
  );
}
