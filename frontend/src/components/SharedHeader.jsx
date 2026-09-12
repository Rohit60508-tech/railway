import React from 'react';
import { useAuth } from '../context/AuthContext';
import { Shield, Wrench, Sliders, Radio, Database, FileText, LogOut, Cpu, Activity } from 'lucide-react';

export default function SharedHeader({ currentTab, setCurrentTab }) {
  const { session, roleMeta, logout } = useAuth();

  const NAV_ITEMS = [
    { key: 'admin', label: 'Executive Admin', icon: Shield, roleAllowed: ['admin'] },
    { key: 'control', label: 'Control Office', icon: Sliders, roleAllowed: ['admin', 'control-office'] },
    { key: 'maintenance', label: 'Field Engineer', icon: Wrench, roleAllowed: ['admin', 'field-engineer'] },
    { key: 'surveillance', label: 'Surveillance', icon: Radio, roleAllowed: ['admin', 'surveillance'] },
    { key: 'dashboard', label: 'Gateway Dashboard', icon: Database, roleAllowed: ['admin', 'control-office', 'field-engineer', 'surveillance'] },
    { key: 'datasources', label: 'Data Sources', icon: Database, roleAllowed: ['admin'] },
    { key: 'aimodels', label: 'MLOps Studio', icon: Cpu, roleAllowed: ['admin'] },
    { key: 'summary', label: 'Executive Summary', icon: FileText, roleAllowed: ['admin', 'field-engineer', 'control-office', 'surveillance'] },
  ];

  const allowedNav = NAV_ITEMS.filter(item =>
    !session || session.role === 'admin' || item.roleAllowed.includes(session.role)
  );

  return (
    <header style={{
      background: 'rgba(255, 255, 255, 0.94)',
      backdropFilter: 'blur(24px)',
      WebkitBackdropFilter: 'blur(24px)',
      borderBottom: '1.5px solid rgba(195, 178, 150, 0.45)',
      boxShadow: '0 4px 24px -4px rgba(0, 51, 102, 0.08), 0 1px 3px rgba(0, 0, 0, 0.04)',
      height: '68px',
      padding: '0 32px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      position: 'sticky',
      top: 0,
      zIndex: 100
    }}>
      {/* Brand Identity */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        <div style={{
          width: '42px', height: '42px', borderRadius: '12px',
          background: 'linear-gradient(135deg, #002244 0%, #004488 50%, #0066CC 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#FFF', fontWeight: '900', fontSize: '1.2rem',
          boxShadow: '0 4px 14px rgba(0, 51, 102, 0.3), inset 0 1px 1px rgba(255,255,255,0.3)',
          letterSpacing: '0.5px',
          border: '1px solid rgba(255,255,255,0.2)'
        }}>
          RP
        </div>
        <div>
          <div style={{ fontSize: '1.15rem', fontWeight: '800', color: '#002244', letterSpacing: '0.8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>RAKSHA PATH</span>
            <span style={{
              fontSize: '0.62rem',
              background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15), rgba(5, 150, 105, 0.25))',
              color: '#047857',
              border: '1px solid rgba(16, 185, 129, 0.35)',
              padding: '2px 8px', borderRadius: '12px', fontWeight: '800',
              display: 'flex', alignItems: 'center', gap: '4px',
              letterSpacing: '0.5px'
            }}>
              <Activity size={10} color="#047857" />
              <span>LIVE SYSTEM</span>
            </span>
          </div>
          <div style={{ fontSize: '0.68rem', color: '#64748B', textTransform: 'uppercase', letterSpacing: '1.2px', fontWeight: '700', marginTop: '1px' }}>
            Indian Railways Sovereign AI Command Platform
          </div>
        </div>
      </div>

      {/* Navigation Pills Bar */}
      <nav style={{
        display: 'flex', alignItems: 'center', gap: '4px',
        background: '#FAF6EE', padding: '5px 6px', borderRadius: '12px',
        border: '1px solid rgba(195, 178, 150, 0.5)',
        boxShadow: 'inset 0 1px 3px rgba(0, 0, 0, 0.04)'
      }}>
        {allowedNav.map(item => {
          const Icon = item.icon;
          const isActive = currentTab === item.key;
          return (
            <button
              key={item.key}
              onClick={() => setCurrentTab(item.key)}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '8px 14px', borderRadius: '9px', border: 'none',
                background: isActive ? 'linear-gradient(135deg, #003366, #0056B3)' : 'transparent',
                color: isActive ? '#FFFFFF' : '#475569',
                fontWeight: isActive ? '800' : '600',
                fontSize: '0.83rem', cursor: 'pointer',
                transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                boxShadow: isActive ? '0 4px 14px rgba(0, 51, 102, 0.28)' : 'none',
                letterSpacing: '0.2px'
              }}
            >
              <Icon size={15} color={isActive ? '#FFFFFF' : '#64748B'} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Auth Session / Officer Info */}
      {session && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px'
          }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '4px 12px', borderRadius: '16px',
              background: 'rgba(0, 51, 102, 0.06)',
              border: '1px solid rgba(0, 51, 102, 0.18)',
              color: '#003366',
              fontWeight: '700', fontSize: '0.78rem'
            }}>
              <span style={{ fontSize: '0.85rem' }}>{roleMeta?.icon || '🛡️'}</span>
              <span>{session.name || roleMeta?.label || session.role}</span>
            </div>
            {session.division && (
              <span style={{ fontSize: '0.65rem', color: '#64748B', fontWeight: '600', paddingRight: '4px' }}>
                {session.division}
              </span>
            )}
          </div>

          <button
            onClick={logout}
            title="Sign Out"
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '8px 14px', borderRadius: '9px',
              border: '1px solid rgba(220, 38, 38, 0.28)',
              background: 'rgba(220, 38, 38, 0.06)',
              color: '#DC2626', fontWeight: '700', fontSize: '0.78rem',
              cursor: 'pointer', transition: 'all 0.18s ease'
            }}
          >
            <LogOut size={14} />
            <span>Sign Out</span>
          </button>
        </div>
      )}
    </header>
  );
}
