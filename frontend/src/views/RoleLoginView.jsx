import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { ROLES_CATALOG } from '../services/userStore';
import { ArrowLeft, ArrowRight, Lock, User, AlertCircle, ShieldCheck } from 'lucide-react';

export default function RoleLoginView() {
  const { login } = useAuth();
  const [selectedRole, setSelectedRole] = useState(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSelectRole = (role) => {
    setSelectedRole(role);
    setUsername('');
    setPassword('');
    setError('');
  };

  const handleBackToRoles = () => {
    setSelectedRole(null);
    setUsername('');
    setPassword('');
    setError('');
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    if (!selectedRole) {
      setError('Please select an access role first.');
      return;
    }
    if (!username.trim()) {
      setError('Please enter your username / employee ID.');
      return;
    }
    if (!password) {
      setError('Please enter your password.');
      return;
    }

    setLoading(true);
    setTimeout(() => {
      try {
        login(username.trim(), password, selectedRole.key);
      } catch (err) {
        setError(err.message || 'Authentication failed.');
        setLoading(false);
      }
    }, 350);
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '24px 16px',
      backgroundImage: `linear-gradient(135deg, rgba(3, 7, 18, 0.70) 0%, rgba(15, 23, 42, 0.50) 50%, rgba(3, 7, 18, 0.80) 100%), url('../vande_bharat_bg.jpg'), url('/frontend/vande_bharat_bg.jpg'), url('/vande_bharat_bg.jpg')`,
      backgroundPosition: 'center',
      backgroundSize: 'cover',
      backgroundRepeat: 'no-repeat',
      backgroundAttachment: 'fixed'
    }}>
      <div style={{
        width: '100%', maxWidth: '520px',
        background: 'rgba(15, 23, 42, 0.62)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        borderRadius: '24px',
        border: '1px solid rgba(255, 255, 255, 0.16)',
        boxShadow: '0 30px 60px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.2)',
        padding: '36px',
        color: '#F8FAFC'
      }}>
        {!selectedRole ? (
          <div>
            <div style={{ textAlign: 'center', marginBottom: '28px' }}>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: '8px',
                fontSize: '0.74rem', fontWeight: '800', color: '#F97316',
                letterSpacing: '1.2px', textTransform: 'uppercase',
                background: 'rgba(249, 115, 22, 0.15)', border: '1px solid rgba(249, 115, 22, 0.3)',
                padding: '5px 14px', borderRadius: '20px'
              }}>
                <ShieldCheck size={14} />
                <span>Indian Railways Access Gateway</span>
              </div>
              <h1 style={{ fontSize: '1.65rem', fontWeight: '800', color: '#FFFFFF', marginTop: '12px', letterSpacing: '0.4px' }}>
                Select Access Role
              </h1>
              <p style={{ fontSize: '0.86rem', color: '#CBD5E1', marginTop: '6px', lineHeight: '1.5' }}>
                Choose your operational command authority to enter the platform.
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {ROLES_CATALOG.map(r => (
                <div
                  key={r.key}
                  onClick={() => handleSelectRole(r)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '16px 18px',
                    borderRadius: '14px',
                    background: 'rgba(255, 255, 255, 0.08)',
                    border: '1px solid rgba(255, 255, 255, 0.14)',
                    cursor: 'pointer',
                    transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                    position: 'relative', overflow: 'hidden'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.16)';
                    e.currentTarget.style.borderColor = r.color;
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = `0 10px 25px ${r.color}35`;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.14)';
                    e.currentTarget.style.transform = 'none';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div style={{
                      width: '46px', height: '46px', borderRadius: '12px',
                      background: 'rgba(255, 255, 255, 0.12)', border: `1px solid ${r.color}60`,
                      color: r.color,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '1.4rem', flexShrink: 0
                    }}>
                      {r.icon}
                    </div>
                    <div>
                      <div style={{ fontSize: '1rem', fontWeight: '700', color: '#FFFFFF' }}>{r.label}</div>
                      <div style={{ fontSize: '0.76rem', color: '#94A3B8', marginTop: '2px' }}>{r.dept}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem', fontWeight: '700', color: '#60A5FA' }}>
                    <span>Sign In</span>
                    <ArrowRight size={15} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
              <button
                type="button"
                onClick={handleBackToRoles}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  background: 'rgba(255, 255, 255, 0.1)', border: '1px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: '8px', padding: '6px 12px', color: '#E2E8F0',
                  fontWeight: '700', fontSize: '0.8rem', cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                <ArrowLeft size={15} />
                <span>Change Access Role</span>
              </button>

              <div style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '6px 14px', borderRadius: '20px',
                background: 'rgba(255, 255, 255, 0.12)', border: `1px solid ${selectedRole.color}`,
                color: '#FFFFFF', fontWeight: '700', fontSize: '0.8rem'
              }}>
                <span>{selectedRole.icon}</span>
                <span>{selectedRole.label}</span>
              </div>
            </div>

            <div style={{ marginBottom: '24px' }}>
              <h2 style={{ fontSize: '1.5rem', fontWeight: '800', color: '#FFFFFF', letterSpacing: '0.3px' }}>
                Sign In as {selectedRole.label}
              </h2>
              <p style={{ fontSize: '0.85rem', color: '#94A3B8', marginTop: '4px', lineHeight: '1.5' }}>
                Enter your authorized credentials for {selectedRole.dept}.
              </p>
            </div>

            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: '18px' }}>
                <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: '700', color: '#CBD5E1', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '8px' }}>
                  Username / Employee ID
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Enter username / employee ID"
                    style={{
                      width: '100%', padding: '14px 16px', borderRadius: '12px',
                      border: '1px solid rgba(255, 255, 255, 0.2)', background: 'rgba(15, 23, 42, 0.6)',
                      fontSize: '0.95rem', color: '#FFFFFF', outline: 'none',
                      boxShadow: 'inset 0 2px 4px rgba(0, 0, 0, 0.3)'
                    }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: '700', color: '#CBD5E1', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '8px' }}>
                  Password
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password"
                    style={{
                      width: '100%', padding: '14px 16px', borderRadius: '12px',
                      border: '1px solid rgba(255, 255, 255, 0.2)', background: 'rgba(15, 23, 42, 0.6)',
                      fontSize: '0.95rem', color: '#FFFFFF', outline: 'none',
                      boxShadow: 'inset 0 2px 4px rgba(0, 0, 0, 0.3)'
                    }}
                  />
                </div>
              </div>

              {error && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '12px 14px', borderRadius: '10px',
                  background: 'rgba(220, 38, 38, 0.2)', border: '1px solid rgba(220, 38, 38, 0.4)',
                  color: '#FCA5A5', fontSize: '0.84rem', fontWeight: '600', marginBottom: '20px'
                }}>
                  <AlertCircle size={18} />
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                style={{
                  width: '100%', padding: '15px', borderRadius: '12px',
                  border: 'none',
                  background: 'linear-gradient(135deg, #F97316 0%, #EA580C 100%)',
                  color: '#FFFFFF', fontSize: '0.96rem', fontWeight: '800',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  boxShadow: '0 8px 24px rgba(249, 115, 22, 0.4)',
                  letterSpacing: '0.4px',
                  transition: 'all 0.18s ease'
                }}
              >
                {loading ? 'Authenticating...' : `Sign In as ${selectedRole.label}`}
              </button>
            </form>
          </div>
        )}

        <div style={{ marginTop: '28px', paddingTop: '18px', borderTop: '1px solid rgba(255, 255, 255, 0.1)', textAlign: 'center', fontSize: '0.72rem', color: '#94A3B8', lineHeight: '1.6' }}>
          Access restricted to authorized Indian Railways personnel.<br />
          RAKSHA PATH v2.4.1 · High-Speed Corridor Command
        </div>
      </div>
    </div>
  );
}
