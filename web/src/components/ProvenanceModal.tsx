import React from 'react';
import { Provenance, RunInfo } from '../types';
import { FileText, X, CheckCircle, Database, GitCommit } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  provenance: Provenance;
  runInfo: RunInfo;
}

export const ProvenanceModal: React.FC<Props> = ({ isOpen, onClose, provenance, runInfo }) => {
  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 50,
        padding: '1rem',
      }}
      onClick={onClose}
    >
      <div
        className="panel-card"
        style={{
          maxWidth: '650px',
          width: '100%',
          maxHeight: '90vh',
          overflowY: 'auto',
          background: '#0f172a',
          border: '1px solid #475569',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid #334155', paddingBottom: '0.75rem' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#38bdf8' }}>
            <FileText size={20} />
            Data Provenance & Traceability Record
          </h3>
          <button
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
          >
            <X size={20} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', fontSize: '0.85rem', color: '#cbd5e1' }}>
          {/* Datasets */}
          <div>
            <h4 style={{ fontWeight: 600, color: '#f8fafc', marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Database size={16} style={{ color: '#38bdf8' }} /> Scientific Datasets
            </h4>
            <div style={{ background: '#1e293b', padding: '0.5rem 0.75rem', borderRadius: '0.375rem', border: '1px solid #334155' }}>
              {provenance.datasets.map((d, i) => (
                <div key={i} style={{ marginBottom: i < provenance.datasets.length - 1 ? '0.5rem' : 0 }}>
                  <div style={{ fontWeight: 600, color: '#f8fafc' }}>{d.name} ({d.version})</div>
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8', wordBreak: 'break-all' }}>{d.source_url}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Ephemeris Kernels */}
          <div>
            <h4 style={{ fontWeight: 600, color: '#f8fafc', marginBottom: '0.4rem' }}>
              Ephemeris Kernels & Models
            </h4>
            <div style={{ background: '#1e293b', padding: '0.5rem 0.75rem', borderRadius: '0.375rem', border: '1px solid #334155' }}>
              {provenance.kernels.map((k, i) => (
                <div key={i}>
                  <span style={{ fontWeight: 600, color: '#f8fafc' }}>{k.name}</span>
                  <div className="mono" style={{ fontSize: '0.7rem', color: '#64748b' }}>SHA256: {k.checksum}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Parameters & Tolerances */}
          <div>
            <h4 style={{ fontWeight: 600, color: '#f8fafc', marginBottom: '0.4rem' }}>
              Deterministic Parameters & Formulas
            </h4>
            <div style={{ background: '#1e293b', padding: '0.5rem 0.75rem', borderRadius: '0.375rem', border: '1px solid #334155', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem', fontSize: '0.8rem' }}>
              <div>Moon Radius (R): <strong className="mono">1737400.0 m</strong></div>
              <div>Datum Frame: <strong className="mono">MOON_ME</strong></div>
              <div>Curvature: <strong className="mono">Exact Spherical</strong></div>
              <div>Slope Method: <strong className="mono">Horn (1981)</strong></div>
            </div>
          </div>

          {/* Software Versions & Git Commit */}
          <div>
            <h4 style={{ fontWeight: 600, color: '#f8fafc', marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <GitCommit size={16} style={{ color: '#4ade80' }} /> Execution Metadata (Run Info)
            </h4>
            <div style={{ background: '#1e293b', padding: '0.5rem 0.75rem', borderRadius: '0.375rem', border: '1px solid #334155', fontSize: '0.8rem' }}>
              <div style={{ marginBottom: '0.25rem' }}>
                Git Commit: <strong className="mono" style={{ color: '#38bdf8' }}>{runInfo.git_commit.slice(0, 10)}</strong>
              </div>
              <div style={{ marginBottom: '0.25rem' }}>
                Run UTC: <strong className="mono">{runInfo.created_utc}</strong>
              </div>
              <div style={{ color: '#94a3b8' }}>
                Environment: Python {runInfo.software_versions.python}, NumPy {runInfo.software_versions.numpy}, LightPath {runInfo.software_versions.lightpath}
              </div>
            </div>
          </div>

          {/* Test Verification Summary */}
          <div style={{ background: 'rgba(74, 222, 128, 0.1)', border: '1px solid rgba(74, 222, 128, 0.3)', borderRadius: '0.375rem', padding: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <CheckCircle size={20} style={{ color: '#4ade80', flexShrink: 0 }} />
            <div>
              <div style={{ fontWeight: 600, color: '#4ade80' }}>
                Pipeline Test Verification: {provenance.tests_summary.tests_passed} / {provenance.tests_summary.tests_total} Tests Passed
              </div>
              <div style={{ fontSize: '0.75rem', color: '#cbd5e1' }}>
                All mathematical formulas and schemas rigorously verified prior to export.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
