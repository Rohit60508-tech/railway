import React from 'react';
import CisoCertRailAuditLogsWidget from '../components/CisoCertRailAuditLogsWidget';
import ExportReportingSuiteWidget from '../components/ExportReportingSuiteWidget';
import { FileText, Shield, Cpu, Database, CheckCircle2 } from 'lucide-react';

export default function ProjectSummaryView() {
  return (
    <div style={{ padding: '28px 32px', maxWidth: '1440px', margin: '0 auto' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '1.55rem', fontWeight: '800', color: '#003366' }}>
          RAKSHA PATH — Executive Project Summary & Architecture Docs
        </h1>
        <p style={{ fontSize: '0.85rem', color: '#64748B', marginTop: '2px' }}>
          Indian Railways AI Command, Automatic Block Planning & Persistent Telemetry Platform
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '28px' }}>
        <div style={{ background: '#FFFFFF', border: '1px solid rgba(195,178,150,0.38)', borderRadius: '12px', padding: '20px' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: '800', color: '#003366', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Shield size={18} />
            <span>Operational Roles & Access Control</span>
          </h2>
          <ul style={{ fontSize: '0.84rem', color: '#334155', lineHeight: '1.8', paddingLeft: '20px' }}>
            <li><strong>Executive / Admin (`admin`)</strong>: Full system command, model retraining, corridor overrides.</li>
            <li><strong>Field Engineer (`field-engineer`)</strong>: Maintenance work orders, gang possessions, USFD flaw verification.</li>
            <li><strong>Control Office Controller (`control-office`)</strong>: Live train traffic, headway clearance, 25kV power block isolation.</li>
            <li><strong>Surveillance Inspector (`surveillance`)</strong>: Automated vision alerts, drone RGB scans, OMS dynamic oscillations.</li>
          </ul>
        </div>

        <div style={{ background: '#FFFFFF', border: '1px solid rgba(195,178,150,0.38)', borderRadius: '12px', padding: '20px' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: '800', color: '#003366', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Cpu size={18} />
            <span>AI/ML Engine Specifications (Section 8)</span>
          </h2>
          <ul style={{ fontSize: '0.84rem', color: '#334155', lineHeight: '1.8', paddingLeft: '20px' }}>
            <li><strong>Defect Priority Engine</strong>: Self-Learning XGBoost + Statutory Policy RAG (IRPWM Para 268 & ACTM Vol II).</li>
            <li><strong>Time-to-Event Failure Risk</strong>: Survival Analysis (Cox Proportional Hazards + Weibull Degradation).</li>
            <li><strong>Corridor Block Scheduler</strong>: Constraint Programming / MIP (Google OR-Tools CP-SAT Solver).</li>
            <li><strong>Local LLM Assistance</strong>: Ollama `llama3.2:1b` for operational Q&A and audit trail explanations.</li>
          </ul>
        </div>
      </div>

      {/* CISO & CERT-Rail Cybersecurity Audit & Access Review Log (PRD §5) */}
      <CisoCertRailAuditLogsWidget />

      {/* Executive Report Generation & Export Suite (PRD §12 FR-12) */}
      <ExportReportingSuiteWidget />
    </div>
  );
}
