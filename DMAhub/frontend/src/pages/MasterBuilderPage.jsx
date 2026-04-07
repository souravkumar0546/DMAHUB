import { useState, useCallback, useRef, useEffect } from "react";
import FileUpload from "../components/FileUpload";
import PreviewTable from "../components/PreviewTable";
import StepProgress from "../components/StepProgress";
import { SingleColumnPicker } from "../components/ColumnPicker";
import {
  masterBuilderFixMaster,
  masterBuilderAddToMaster,
  getMasters,
  getMasterData,
  downloadMaster,
  getTaxonomyOptions,
} from "../api";
import FlowDiagram, { MASTER_BUILDER_FLOW } from "../components/FlowDiagram";
import ClassificationSettings from "../components/ClassificationSettings";

const FIX_STEPS = [
  { label: "Cleaning descriptions", sub: "Stripping catalog numbers, brands, units, quantities" },
  { label: "Generating blocking keys & building candidate groups", sub: "Multi-key blocking with stemmed signatures" },
  { label: "TF-IDF refinement within candidate groups", sub: "Char n-gram cosine similarity to validate groupings" },
  { label: "Identifying inconsistent groups", sub: "Groups with mixed classifications" },
  { label: "AI validating groups — removing outliers", sub: "Azure OpenAI checks group membership" },
  { label: "AI reclassifying inconsistent groups", sub: "Assigning correct L2 category to each group" },
  { label: "Saving corrected master to disk", sub: "Persisting to master/{taxonomy_key}/" },
];

const HIGHLIGHT_BG = "#fff9cc";

export default function MasterBuilderPage() {
  const [fileData, setFileData] = useState(null);
  const [descCol, setDescCol] = useState("");
  const [classCol, setClassCol] = useState("");
  const [poCol, setPoCol] = useState("");
  const [statusCol, setStatusCol] = useState("");
  const [simThreshold, setSimThreshold] = useState(0.65);
  const [aiBatchSize, setAiBatchSize] = useState(5);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [addingToMaster, setAddingToMaster] = useState(false);

  const [taxonomyOptions, setTaxonomyOptions] = useState([]);
  const [taxonomyKey, setTaxonomyKey] = useState("ZSC1");

  const [existingMasters, setExistingMasters] = useState([]);
  const [masterPreview, setMasterPreview] = useState(null);

  const [fixLoading, setFixLoading] = useState(false);
  const [fixError, setFixError] = useState("");
  const [fixResult, setFixResult] = useState(null);
  const [fixStep, setFixStep] = useState(-1);

  const fixIntervalRef = useRef(null);

  useEffect(() => {
    getTaxonomyOptions().then(setTaxonomyOptions).catch(() => {});
    refreshMasters();
    return () => { if (fixIntervalRef.current) clearInterval(fixIntervalRef.current); };
  }, []);

  function refreshMasters() {
    getMasters().then(setExistingMasters).catch(() => {});
  }

  const onUpload = useCallback((data) => {
    setFileData(data);
    setDescCol(""); setClassCol(""); setPoCol(""); setStatusCol("");
    setFixResult(null); setFixError("");
  }, []);

  async function handleFix() {
    if (!fileData || !descCol || !classCol) return;
    setFixLoading(true); setFixError(""); setFixResult(null); setFixStep(0);
    let step = 0;
    fixIntervalRef.current = setInterval(() => {
      step++;
      if (step < FIX_STEPS.length - 1) setFixStep(step);
    }, 4000);
    try {
      const data = await masterBuilderFixMaster(fileData.file, {
        descCol, classCol, poCol, statusCol, simThreshold, aiBatchSize, taxonomyKey,
      });
      clearInterval(fixIntervalRef.current);
      setFixStep(FIX_STEPS.length);
      setFixResult(data);
      refreshMasters();
    } catch (err) {
      clearInterval(fixIntervalRef.current);
      setFixError(err.response?.data?.detail || err.message || "Fix master failed");
    } finally {
      setFixLoading(false);
    }
  }

  async function handlePreviewMaster(key) {
    try {
      const data = await getMasterData(key);
      setMasterPreview(data);
    } catch { setMasterPreview(null); }
  }

  async function handleDownloadMaster(key) {
    try {
      const blob = await downloadMaster(key);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url;
      a.download = `master_${key}.xlsx`; a.click();
      URL.revokeObjectURL(url);
    } catch (e) { alert(e.message || "Download failed"); }
  }

  const cols = fileData?.columns || [];
  const canFix = fileData && descCol && classCol;
  const fixRows = fixResult?.rows || [];
  const fixCols = fixResult?.columns || [];
  const changedSet = new Set((fixResult?.changed_row_indices || []).map(Number));

  return (
    <div className="agent-layout">
      <div className="agent-sidebar">
        <FlowDiagram title={MASTER_BUILDER_FLOW.title} phases={MASTER_BUILDER_FLOW.phases} />
      </div>
      <div className="card">
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
          <div>
            <h2>Master Builder Agent</h2>
            <p className="muted">
              Fix inconsistent classifications in master data using AI, then save the corrected master to disk organized by material type.
            </p>
          </div>
          <button className="settings-gear" title="Settings" onClick={() => setSettingsOpen(true)}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
            </svg>
          </button>
        </div>

        <ClassificationSettings
          open={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          simThreshold={simThreshold}
          setSimThreshold={setSimThreshold}
          aiBatchSize={aiBatchSize}
          setAiBatchSize={setAiBatchSize}
          taxonomyKey={taxonomyKey}
        />

        {/* ── Existing Masters (filtered to selected taxonomy) ── */}
        {existingMasters.filter((m) => m.key === taxonomyKey).length > 0 && (
          <>
            <div className="divider" />
            <div className="section-label">Existing Masters</div>
            <div className="table-container" style={{ maxHeight: 200 }}>
              <table>
                <thead>
                  <tr><th>Material Type</th><th>Rows</th><th>Last Updated</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {existingMasters.filter((m) => m.key === taxonomyKey).map((m) => (
                    <tr key={m.key}>
                      <td style={{ fontWeight: 600 }}>{m.key}</td>
                      <td>{m.row_count}</td>
                      <td>{m.last_updated ? new Date(m.last_updated).toLocaleDateString() : "—"}</td>
                      <td>
                        <button className="btn btn-sm btn-outline" onClick={() => handlePreviewMaster(m.key)}>Preview</button>{" "}
                        <button className="btn btn-sm btn-outline" onClick={() => handleDownloadMaster(m.key)}>Download</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {masterPreview && (
              <div className="table-container" style={{ maxHeight: 300, marginTop: 8 }}>
                <div className="table-header">
                  Master Preview: {masterPreview.meta?.taxonomy_key} ({masterPreview.total_rows} rows, showing first 500)
                </div>
                <table>
                  <thead><tr>{masterPreview.columns.map((c) => <th key={c}>{c}</th>)}</tr></thead>
                  <tbody>
                    {masterPreview.rows.slice(0, 100).map((r, i) => (
                      <tr key={i}>{masterPreview.columns.map((c) => <td key={c}>{r[c] ?? ""}</td>)}</tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {/* ── Upload & Configure ── */}
        <div className="divider" />
        <div className="section-label">Step 1 — Select Material Type & Upload</div>
        <div className="form-group" style={{ maxWidth: 400, marginBottom: 14 }}>
          <label>Material Type</label>
          <select value={taxonomyKey} onChange={(e) => setTaxonomyKey(e.target.value)}>
            {taxonomyOptions.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
            {taxonomyOptions.length === 0 && <option value="ZSC1">Consumables - ZSC1</option>}
          </select>
        </div>
        <FileUpload onUpload={onUpload} label="Upload Raw Master Data File" />

        {fileData && (
          <>
            <PreviewTable columns={fileData.columns} rows={fileData.preview} rowCount={fileData.row_count} title="Upload Preview" />

            <div className="divider" />
            <div className="section-label">Step 2 — Column Mapping</div>
            <div className="form-row">
              <SingleColumnPicker columns={cols} value={descCol} onChange={setDescCol} label="Description Column" placeholder="Select description..." />
              <SingleColumnPicker columns={cols} value={classCol} onChange={setClassCol} label="Classification Column" placeholder="Select class..." />
            </div>
            <div className="form-row">
              <SingleColumnPicker columns={cols} value={poCol} onChange={setPoCol} label="PO / Text Column (optional)" placeholder="None" />
              <SingleColumnPicker columns={cols} value={statusCol} onChange={setStatusCol} label="Status Column (optional)" placeholder="None" />
            </div>
            <div className="divider" />
            <div className="section-label">Step 3 — Fix & Save Master</div>
            <div className="btn-row">
              <button className="btn btn-primary" disabled={!canFix || fixLoading} onClick={handleFix}>
                {fixLoading && <span className="spinner" />}
                {fixLoading ? "Processing..." : "Fix Master"}
              </button>
            </div>

            {fixLoading && <StepProgress steps={FIX_STEPS} currentStep={fixStep} />}
            {fixError && <div className="alert alert-error">{fixError}</div>}

            {fixResult && !fixLoading && (
              <>
                <div className="alert alert-info">
                  Review the results below. Yellow rows have been reclassified. Click "Add to Master" to save to disk.
                </div>
                <div className="metrics">
                  <div className="metric"><div className="metric-value">{fixResult.summary?.groups ?? 0}</div><div className="metric-label">Semantic Groups</div></div>
                  <div className="metric"><div className="metric-value">{fixResult.summary?.inconsistent_groups ?? 0}</div><div className="metric-label">Inconsistent</div></div>
                  <div className="metric"><div className="metric-value">{fixResult.summary?.rows_updated ?? 0}</div><div className="metric-label">Rows Updated</div></div>
                </div>

                {fixRows.length > 0 && fixCols.length > 0 && (
                  <div className="table-container" style={{ maxHeight: 420 }}>
                    <div className="table-header">Fixed data — review ({fixRows.length} rows, {changedSet.size} changed)</div>
                    <table>
                      <thead><tr>{fixCols.map((c) => <th key={c}>{c}</th>)}</tr></thead>
                      <tbody>
                        {fixRows.map((r, i) => (
                          <tr key={i} style={{ background: changedSet.has(i) ? HIGHLIGHT_BG : undefined }}>
                            {fixCols.map((c) => <td key={c}>{r[c] ?? ""}</td>)}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                <div className="btn-row">
                  <button
                    className="btn btn-primary"
                    disabled={addingToMaster}
                    onClick={async () => {
                      if (!fixResult?.review_id) return;
                      setAddingToMaster(true);
                      try {
                        const res = await masterBuilderAddToMaster(fixResult.review_id);
                        refreshMasters();
                        setFixResult(null);
                        setFileData(null);
                        alert(`Added to master. Total rows: ${res.total_master_rows}`);
                      } catch (e) {
                        alert(e.response?.data?.detail || e.message || "Failed to add to master");
                      } finally {
                        setAddingToMaster(false);
                      }
                    }}
                  >
                    {addingToMaster && <span className="spinner" />}
                    {addingToMaster ? "Saving..." : "Add to Master"}
                  </button>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
