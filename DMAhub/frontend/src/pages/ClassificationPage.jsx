import React, { useState, useCallback, useRef, useEffect } from "react";
import FileUpload from "../components/FileUpload";
import PreviewTable from "../components/PreviewTable";
import StepProgress from "../components/StepProgress";
import { SingleColumnPicker } from "../components/ColumnPicker";
import {
  classificationFixMaster,
  classificationClassifyNew,
  classificationDownloadHighlighted,
  classificationMasterAddRow,
  getTaxonomyOptions,
} from "../api";
import FlowDiagram, { CLASSIFICATION_FLOW } from "../components/FlowDiagram";
import ClassificationSettings from "../components/ClassificationSettings";

const FIX_STEPS = [
  { label: "Cleaning descriptions", sub: "Stripping catalog numbers, brands, units, quantities" },
  { label: "Generating blocking keys & building candidate groups", sub: "Multi-key blocking with stemmed signatures" },
  { label: "TF-IDF refinement within candidate groups", sub: "Char n-gram cosine similarity to validate groupings" },
  { label: "Identifying inconsistent groups", sub: "Groups with mixed classifications" },
  { label: "AI validating groups — removing outliers", sub: "Azure OpenAI checks group membership" },
  { label: "AI reclassifying inconsistent groups", sub: "Assigning correct L2 category to each group" },
  { label: "Applying corrections to master data", sub: "Updating classification column" },
];

const CLASSIFY_STEPS = [
  { label: "Building semantic index from master data", sub: "TF-IDF vectorization of all descriptions" },
  { label: "Searching for matching material group", sub: "Blocking keys + group-level cosine similarity" },
  { label: "AI confirming match", sub: "Verifying material identity with Azure OpenAI" },
  { label: "Assigning category", sub: "Group match or AI new classification" },
];

const HIGHLIGHT_BG = "#fff9cc";

export default function ClassificationPage() {
  const [fileData, setFileData] = useState(null);
  const [descCol, setDescCol] = useState("");
  const [classCol, setClassCol] = useState("");
  const [poCol, setPoCol] = useState("");
  const [statusCol, setStatusCol] = useState("");
  const [simThreshold, setSimThreshold] = useState(0.65);
  const [aiBatchSize, setAiBatchSize] = useState(5);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const [taxonomyOptions, setTaxonomyOptions] = useState([]);
  const [taxonomyKey, setTaxonomyKey] = useState("ZSC1");

  useEffect(() => {
    getTaxonomyOptions().then(setTaxonomyOptions).catch(() => {});
  }, []);

  const [fixLoading, setFixLoading] = useState(false);
  const [fixError, setFixError] = useState("");
  const [fixResult, setFixResult] = useState(null);
  const [fixStep, setFixStep] = useState(-1);

  const [workingMasterRows, setWorkingMasterRows] = useState([]);
  const [highlightIndices, setHighlightIndices] = useState(() => new Set());

  const [classifyInputs, setClassifyInputs] = useState({});
  const [classifyLoading, setClassifyLoading] = useState(false);
  const [classifyError, setClassifyError] = useState("");
  const [classifyResult, setClassifyResult] = useState(null);
  const [classifyStep, setClassifyStep] = useState(-1);
  const [classifyHistory, setClassifyHistory] = useState([]);

  const fixIntervalRef = useRef(null);
  const clsIntervalRef = useRef(null);

  const onUpload = useCallback((data) => {
    setFileData(data);
    setDescCol("");
    setClassCol("");
    setPoCol("");
    setStatusCol("");
    setFixResult(null);
    setFixError("");
    setClassifyResult(null);
    setClassifyError("");
    setClassifyHistory([]);
    setWorkingMasterRows([]);
    setHighlightIndices(new Set());
  }, []);

  useEffect(() => {
    return () => {
      if (fixIntervalRef.current) clearInterval(fixIntervalRef.current);
      if (clsIntervalRef.current) clearInterval(clsIntervalRef.current);
    };
  }, []);

  async function handleFixMaster() {
    if (!fileData || !descCol || !classCol) return;
    setFixLoading(true);
    setFixError("");
    setFixResult(null);
    setFixStep(0);

    let step = 0;
    fixIntervalRef.current = setInterval(() => {
      step++;
      if (step < FIX_STEPS.length - 1) setFixStep(step);
    }, 4000);

    try {
      const data = await classificationFixMaster(fileData.file, {
        descCol, classCol, poCol, statusCol, simThreshold, aiBatchSize, taxonomyKey,
      });
      clearInterval(fixIntervalRef.current);
      setFixStep(FIX_STEPS.length);
      setFixResult(data);
      const rows = Array.isArray(data.rows) ? data.rows : [];
      setWorkingMasterRows(rows);
      const idx = data.changed_row_indices ?? data.summary?.changed_row_indices ?? [];
      setHighlightIndices(new Set(idx.map(Number)));
    } catch (err) {
      clearInterval(fixIntervalRef.current);
      setFixError(err.response?.data?.detail || err.message || "Fix master failed");
    } finally {
      setFixLoading(false);
    }
  }

  function setClassifyInput(col, val) {
    setClassifyInputs((p) => ({ ...p, [col]: val }));
  }

  async function handleClassifyNew() {
    if (!descCol || !classCol || workingMasterRows.length === 0) return;
    const filled = Object.values(classifyInputs).some((v) => (v || "").trim());
    if (!filled) { setClassifyError("Fill in at least one field."); return; }

    setClassifyLoading(true);
    setClassifyError("");
    setClassifyResult(null);
    setClassifyStep(0);

    let step = 0;
    clsIntervalRef.current = setInterval(() => {
      step++;
      if (step < CLASSIFY_STEPS.length - 1) setClassifyStep(step);
    }, 2500);

    try {
      const data = await classificationClassifyNew({
        descCol,
        classCol,
        simThreshold,
        inputValues: classifyInputs,
        masterId: fixResult?.master_id,
      });
      clearInterval(clsIntervalRef.current);
      if (data.error) {
        setClassifyError(data.error);
      } else {
        setClassifyStep(CLASSIFY_STEPS.length);
        setClassifyResult(data);
        setClassifyHistory((prev) => [
          { input: { ...classifyInputs }, result: data, time: new Date().toLocaleTimeString() },
          ...prev,
        ]);
      }
    } catch (err) {
      clearInterval(clsIntervalRef.current);
      setClassifyError(err.response?.data?.detail || err.message || "Classification failed");
    } finally {
      setClassifyLoading(false);
    }
  }

  async function addToMaster() {
    if (!classifyResult || !fixResult?.columns) return;
    const cat = classifyResult.assigned_category;
    const newCol = fixResult.summary?.new_col || "New Classification";
    const cols = fixResult.columns;
    const newRow = {};
    cols.forEach((c) => { newRow[c] = ""; });
    if (descCol) newRow[descCol] = classifyInputs[descCol] ?? "";
    if (poCol) newRow[poCol] = classifyInputs[poCol] ?? "";
    // New materials: leave original class_col empty, put category in New Classification
    if (classCol) newRow[classCol] = "";
    newRow[newCol] = cat;
    cols.forEach((c) => {
      if (c !== classCol && c !== newCol && newRow[c] === "" && classifyInputs[c] != null && String(classifyInputs[c]).trim()) {
        newRow[c] = classifyInputs[c];
      }
    });

    // Sync to server-side store so Export Master includes this row
    if (fixResult?.master_id) {
      try {
        await classificationMasterAddRow(fixResult.master_id, newRow);
      } catch (e) {
        console.error("Failed to sync row to server:", e);
      }
    }

    setWorkingMasterRows((prev) => {
      const newIdx = prev.length;
      setHighlightIndices((h) => new Set([...h, newIdx]));
      return [...prev, newRow];
    });
    setClassifyResult(null);
    setClassifyInputs({});
  }

  async function downloadHighlightedXlsx() {
    if (!classCol || workingMasterRows.length === 0) return;
    try {
      const blob = await classificationDownloadHighlighted(classCol, fixResult?.master_id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "master_data_highlighted.xlsx";
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
      alert(e.response?.data?.detail || e.message || "Download failed");
    }
  }

  const cols = fileData?.columns || [];
  const canFix = fileData && descCol && classCol;
  const classifyCols = [descCol, poCol].filter(Boolean);
  const masterCols = fixResult?.columns || [];

  return (
    <div className="agent-layout">
    <div className="agent-sidebar">
      <FlowDiagram title={CLASSIFICATION_FLOW.title} phases={CLASSIFICATION_FLOW.phases} />
    </div>
    <div className="card">
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div>
          <h2>Material Classification Agent</h2>
          <p className="muted">
            Fix inconsistent classifications in master data using AI, then classify new materials into the correct L2 category.
          </p>
        </div>
        <button className="settings-gear" title="Classification Settings" onClick={() => setSettingsOpen(true)}>
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

      <div className="divider" />
      <div className="section-label">Step 1 — Select Material Type &amp; Upload</div>
      <div className="form-group" style={{ maxWidth: 400, marginBottom: 14 }}>
        <label>Material Type</label>
        <select value={taxonomyKey} onChange={(e) => setTaxonomyKey(e.target.value)}>
          {taxonomyOptions.map((t) => (
            <option key={t.key} value={t.key}>{t.label}</option>
          ))}
          {taxonomyOptions.length === 0 && <option value="ZSC1">Consumables - ZSC1</option>}
        </select>
        <span className="input-hint">Determines which L2 categories are used for classification</span>
      </div>
      <FileUpload onUpload={onUpload} label="Upload Master Data File" />

      {fileData && (
        <>
          <PreviewTable
            columns={fileData.columns}
            rows={fileData.preview}
            rowCount={fileData.row_count}
            title="Master Data Preview"
          />

          <div className="divider" />
          <div className="section-label">Step 2 — Column Mapping</div>
          <p className="muted" style={{ marginBottom: 8, fontSize: 12 }}>
            Classifying as: <strong>{taxonomyOptions.find(t => t.key === taxonomyKey)?.label || taxonomyKey}</strong>
          </p>
          <div className="form-row">
            <SingleColumnPicker columns={cols} value={descCol} onChange={setDescCol}
              label="Description Column" placeholder="Select description..." />
            <SingleColumnPicker columns={cols} value={classCol} onChange={setClassCol}
              label="Classification Column" placeholder="Select class..." />
          </div>
          <div className="form-row">
            <SingleColumnPicker columns={cols} value={poCol} onChange={setPoCol}
              label="PO / Text Column (optional)" placeholder="None" />
            <SingleColumnPicker columns={cols} value={statusCol} onChange={setStatusCol}
              label="Status Column (optional)" placeholder="None" />
          </div>
          <div className="divider" />
          <div className="section-label">Phase 1 — Fix Inconsistent Classifications</div>
          <p className="muted" style={{ marginBottom: 10 }}>
            Groups similar materials by text similarity, identifies groups with conflicting categories, and uses AI to reclassify them.
          </p>

          <div className="btn-row">
            <button className="btn btn-primary" disabled={!canFix || fixLoading} onClick={handleFixMaster}>
              {fixLoading && <span className="spinner" />}
              {fixLoading ? "Processing..." : "Fix Master Data"}
            </button>
          </div>

          {fixLoading && <StepProgress steps={FIX_STEPS} currentStep={fixStep} />}
          {fixError && <div className="alert alert-error">{fixError}</div>}

          {fixResult && !fixLoading && (
            <>
              <div className="alert alert-success">Master data fixed successfully.</div>
              <div className="metrics">
                <div className="metric">
                  <div className="metric-value">{fixResult.summary?.groups ?? 0}</div>
                  <div className="metric-label">Semantic Groups</div>
                </div>
                <div className="metric">
                  <div className="metric-value">{fixResult.summary?.inconsistent_groups ?? 0}</div>
                  <div className="metric-label">Inconsistent</div>
                </div>
                <div className="metric">
                  <div className="metric-value">{fixResult.summary?.rows_updated ?? 0}</div>
                  <div className="metric-label">Rows Updated</div>
                </div>
              </div>

              {workingMasterRows.length > 0 && masterCols.length > 0 && (
                <>
                  <p className="muted" style={{ marginTop: 12 }}>
                    Yellow rows = edited classification vs. original upload (and any rows you add in Phase 2).
                  </p>
                  <div className="table-container" style={{ maxHeight: 420 }}>
                    <div className="table-header">Fixed master ({workingMasterRows.length} rows)</div>
                    <table>
                      <thead>
                        <tr>{masterCols.map((c) => <th key={c}>{c}</th>)}</tr>
                      </thead>
                      <tbody>
                        {workingMasterRows.map((r, i) => (
                          <tr
                            key={i}
                            style={{
                              background: highlightIndices.has(i) ? HIGHLIGHT_BG : undefined,
                            }}
                          >
                            {masterCols.map((c) => (
                              <td key={c}>{r[c] ?? ""}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}

              <div className="btn-row">
                <button className="btn btn-primary" onClick={downloadHighlightedXlsx}>
                  Export Master
                </button>
              </div>
            </>
          )}

          {fixResult && !fixLoading && (
            <>
              <div className="divider" />
              <div className="section-label">Phase 2 — Classify New Material</div>
              <p className="muted" style={{ marginBottom: 10 }}>
                Master data has been fixed. Enter a new material description to find the best matching category.
              </p>

              {classifyCols.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 12 }}>
                  {classifyCols.map((col) => (
                    <div className="form-group" key={col} style={{ maxWidth: 560 }}>
                      <label>{col}</label>
                      <input
                        type="text"
                        placeholder={`Enter ${col}...`}
                        value={classifyInputs[col] || ""}
                        onChange={(e) => setClassifyInput(col, e.target.value)}
                      />
                    </div>
                  ))}
                </div>
              )}

              <div className="btn-row">
                <button className="btn btn-primary" disabled={!canFix || classifyLoading} onClick={handleClassifyNew}>
                  {classifyLoading && <span className="spinner" />}
                  {classifyLoading ? "Classifying..." : "Classify Material"}
                </button>
              </div>

              {classifyLoading && <StepProgress steps={CLASSIFY_STEPS} currentStep={classifyStep} />}
              {classifyError && <div className="alert alert-error">{classifyError}</div>}

              {classifyResult && !classifyLoading && (
                <div style={{ marginTop: 12 }}>
                  <div className="verdict verdict-match">
                    Category: {classifyResult.assigned_category}
                  </div>
                  <div className="metrics">
                    <div className="metric">
                      <div className="metric-value" style={{ fontSize: 14, color: "var(--text)" }}>
                        {classifyResult.method === "group_match_confirmed" ? "Group Match (AI Confirmed)" : "AI New Classification"}
                      </div>
                      <div className="metric-label">Method</div>
                    </div>
                  </div>
                  {classifyResult.reasoning && (
                    <div className="alert alert-info">{classifyResult.reasoning}</div>
                  )}
                  {classifyResult.matched_rows?.length > 0 && (
                    <div className="table-container" style={{ marginTop: 8 }}>
                      <div className="table-header">Similar Materials in Master</div>
                      <table>
                        <thead>
                          <tr>
                            <th>Description</th>
                            <th>Category</th>
                            <th>Similarity</th>
                          </tr>
                        </thead>
                        <tbody>
                          {classifyResult.matched_rows.map((r, i) => (
                            <tr key={i}>
                              <td>{r.description}</td>
                              <td>{r.category}</td>
                              <td style={{ fontWeight: 700 }}>{(r.score * 100).toFixed(1)}%</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  <div className="btn-row">
                    <button className="btn btn-outline" type="button" onClick={addToMaster}>
                      Add to Master &amp; Continue
                    </button>
                  </div>
                </div>
              )}

              {classifyHistory.length > 0 && (
                <>
                  <div className="divider" />
                  <div className="section-label">Classification History ({classifyHistory.length})</div>
                  <div className="table-container">
                    <table>
                      <thead>
                        <tr>
                          <th>Time</th>
                          <th>Input</th>
                          <th>Category</th>
                          <th>Method</th>
                        </tr>
                      </thead>
                      <tbody>
                        {classifyHistory.map((h, i) => (
                          <tr key={i}>
                            <td>{h.time}</td>
                            <td>{Object.values(h.input).filter(Boolean).join(" | ")}</td>
                            <td style={{ fontWeight: 700, color: "var(--primary)" }}>{h.result.assigned_category}</td>
                            <td>{h.result.method === "group_match_confirmed" ? "Group Match" : "AI New"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </>
          )}
        </>
      )}
    </div>
    </div>
  );
}
