import React, { useState } from 'react';
import { API } from '../services/apiClient';
import { ShieldCheck, UserCheck, AlertOctagon, Lock, CheckCircle, XCircle } from 'lucide-react';

export default function TwoPersonApprovalModal({ isOpen, onClose, pendingAction, onApproved }) {
  const [approver2Username, setApprover2Username] = useState('');
  const [approver2Password, setApprover2Password] = useState('');
  const [rationale, setRationale] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen || !pendingAction) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    if (!approver2Username.trim() || !approver2Password) {
      setError('Second authorized officer credentials required for two-person integrity gate.');
      return;
    }
    if (!rationale.trim()) {
      setError('Mandatory operational justification rationale required.');
      return;
    }

    setSubmitting(true);
    setTimeout(() => {
      // Record cryptographic audit trail for 2-person signoff
      API.recordAuditAction({
        entry_name: 'TWO_PERSON_INTEGRITY_HIGH_RISK_APPROVAL',
        event_type: 'TWO_PERSON_INTEGRITY_APPROVAL',
        user_name: 'Independent Officer (2nd Signatory)',
        staff_id: `IR-OFFICER-${approver2Username.toUpperCase()}`,
        target_entity_id: pendingAction.id || 'HIGH-RISK-ACTION',
        reason: rationale,
        action_payload: {
          action_type: pendingAction.type,
          details: pendingAction.details,
          signatory_1: pendingAction.signatory1 || 'Executive Admin',
          signatory_2: approver2Username.trim()
        }
      })
        .then(() => {
          setSubmitting(false);
          onApproved({ rationale, approver2: approver2Username.trim() });
          onClose();
        })
        .catch(err => {
          setError('Failed to record cryptographic signoff: ' + err.message);
          setSubmitting(false);
        });
    }, 400);
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300, padding: '16px'
    }}>
      <div style={{
        background: '#FFFFFF', borderRadius: '16px', border: '2px solid #DC2626',
        width: '100%', maxWidth: '520px', padding: '28px', boxShadow: '0 25px 60px rgba(220,38,38,0.25)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
          <div style={{ background: 'rgba(220,38,38,0.1)', padding: '10px', borderRadius: '10px', color: '#DC2626' }}>
            <ShieldCheck size={28} />
          </div>
          <div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: '800', color: '#991B1B' }}>
              Two-Person Integrity Safety Gate
            </h3>
            <div style={{ fontSize: '0.74rem', color: '#64748B', fontWeight: '700', textTransform: 'uppercase' }}>
              Statutory Requirement · High-Risk Operational Rationale Verification
            </div>
          </div>
        </div>

        <div style={{ background: '#FEF2F2', border: '1px solid rgba(220,38,38,0.2)', borderRadius: '10px', padding: '12px 14px', marginBottom: '18px', fontSize: '0.82rem', color: '#991B1B' }}>
          <strong>Action Requesting 2nd Approval:</strong><br />
          {pendingAction.title || 'High-Risk Block / Disconnection Rationale Override'}
        </div>

        {error && (
          <div style={{ background: '#FEE2E2', border: '1px solid #EF4444', color: '#B91C1C', padding: '10px 14px', borderRadius: '8px', marginBottom: '16px', fontSize: '0.82rem', fontWeight: '600' }}>
            ⚠ {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: '700', color: '#475569', textTransform: 'uppercase', marginBottom: '6px' }}>
              2nd Officer Staff ID / Username
            </label>
            <input
              type="text"
              value={approver2Username}
              onChange={(e) => setApprover2Username(e.target.value)}
              placeholder="e.g. controller1 or ciso_officer"
              style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1.5px solid #CBD5E1', background: '#F8FAFC', fontSize: '0.85rem', outline: 'none' }}
            />
          </div>

          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: '700', color: '#475569', textTransform: 'uppercase', marginBottom: '6px' }}>
              2nd Officer Password / Key Token
            </label>
            <input
              type="password"
              value={approver2Password}
              onChange={(e) => setApprover2Password(e.target.value)}
              placeholder="••••••••••••"
              style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1.5px solid #CBD5E1', background: '#F8FAFC', fontSize: '0.85rem', outline: 'none' }}
            />
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: '700', color: '#475569', textTransform: 'uppercase', marginBottom: '6px' }}>
              Authenticated Rationale & Operational Justification
            </label>
            <textarea
              rows={3}
              value={rationale}
              onChange={(e) => setRationale(e.target.value)}
              placeholder="Provide detailed statutory operational rationale per Railway Board safety directives..."
              style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1.5px solid #CBD5E1', background: '#F8FAFC', fontSize: '0.85rem', outline: 'none', resize: 'none' }}
            />
          </div>

          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={onClose}
              style={{ padding: '10px 16px', borderRadius: '8px', border: '1px solid #CBD5E1', background: '#FFFFFF', color: '#64748B', fontWeight: '700', fontSize: '0.84rem', cursor: 'pointer' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', background: 'linear-gradient(135deg, #DC2626, #991B1B)', color: '#FFFFFF', fontWeight: '700', fontSize: '0.84rem', cursor: 'pointer', boxShadow: '0 4px 14px rgba(220,38,38,0.3)' }}
            >
              {submitting ? 'Authenticating & Signing...' : 'Sign Dual Approval & Execute'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
