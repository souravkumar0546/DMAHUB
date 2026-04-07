import React, { useState } from "react";
import GroupDuplicatesPage from "./pages/GroupDuplicatesPage";
import LookupPage from "./pages/LookupPage";
import MasterBuilderPage from "./pages/MasterBuilderPage";
import ClassifyPage from "./pages/ClassifyPage";
import DataEnrichmentPage from "./pages/DataEnrichmentPage";

const AGENTS = [
  {
    id: "group",
    icon: "🔍",
    title: "Group Duplicates",
    desc: "Upload an Excel file and find duplicate or near-duplicate rows across multiple columns using TF-IDF similarity with AI variant filtering.",
    tag: "Deduplication",
  },
  {
    id: "lookup",
    icon: "📋",
    title: "Lookup Agent",
    desc: "Check if a new material already exists in your reference database. Per-column similarity scoring with weighted verdict.",
    tag: "Search & Match",
  },
  {
    id: "master-builder",
    icon: "🔧",
    title: "Master Builder",
    desc: "Upload raw master data, fix inconsistent classifications using AI, and save a corrected master organized by material type.",
    tag: "Master Data",
  },
  {
    id: "classify",
    icon: "🏷️",
    title: "Material Classification",
    desc: "Classify new materials (single or batch) against persisted master data. AI-powered lookup and categorization into L2 categories.",
    tag: "AI Classification",
  },
  {
    id: "enrichment",
    icon: "🧬",
    title: "Data Enrichment",
    desc: "Enrich material data by looking up CAS numbers on BLDPharm to fetch product taxonomy and classification hierarchy.",
    tag: "CAS Lookup",
  },
];

export default function App() {
  const [activeAgent, setActiveAgent] = useState(null);

  return (
    <div className="app">
      <header className="hero">
        <div className="hero-content">
          {activeAgent && (
            <button className="hero-back" onClick={() => setActiveAgent(null)}>
              ← Back to Agents
            </button>
          )}
          <h1>Data Transformation Agent Hub</h1>
          <p>Intelligent agents for pharma material data management, deduplication &amp; classification</p>
        </div>
      </header>

      {!activeAgent && (
        <div className="agent-grid">
          {AGENTS.map((a) => (
            <div className="agent-card" key={a.id} onClick={() => setActiveAgent(a.id)}>
              <div className="agent-card-icon">{a.icon}</div>
              <h3>{a.title}</h3>
              <p>{a.desc}</p>
              <span className="agent-card-tag">{a.tag}</span>
            </div>
          ))}
        </div>
      )}

      <div className={activeAgent === "group" ? "tab-panel" : "tab-panel hidden"}>
        <GroupDuplicatesPage />
      </div>
      <div className={activeAgent === "lookup" ? "tab-panel" : "tab-panel hidden"}>
        <LookupPage />
      </div>
      <div className={activeAgent === "master-builder" ? "tab-panel" : "tab-panel hidden"}>
        <MasterBuilderPage />
      </div>
      <div className={activeAgent === "classify" ? "tab-panel" : "tab-panel hidden"}>
        <ClassifyPage />
      </div>
      <div className={activeAgent === "enrichment" ? "tab-panel" : "tab-panel hidden"}>
        <DataEnrichmentPage />
      </div>

      <footer className="app-footer">
        Data Transformation Agent Hub &mdash; Powered by AI
      </footer>
    </div>
  );
}
