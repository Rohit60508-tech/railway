import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  Shield, Wrench, Sliders, Radio, Database, FileText, LogOut, Cpu, Activity, 
  ChevronLeft, ChevronRight, Sun, Moon, Bell, RefreshCw, UserCheck, Layers, Terminal, AlertTriangle
} from 'lucide-react';

export default function MasterCommandLayout({ children, currentTab, setCurrentTab }) {
  const { session, roleMeta, logout, login } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [darkMode, setDarkMode] = useState(() => {
    try { return localStorage.getItem('ir_theme_mode') === 'dark'; } catch (_) { return false; }
  });

  const toggleThemeMode = () => {
    const nextTheme = !darkMode ? 'dark' : 'light';
    setDarkMode(!darkMode);
    document.documentElement.setAttribute('data-theme', nextTheme);
    if (document.body) {
      document.body.classList.toggle('dark-mode', nextTheme === 'dark');
      document.body.classList.toggle('light-mode', nextTheme === 'light');
    }
    try { localStorage.setItem('ir_theme_mode', nextTheme); } catch (_) {}
  };

  useEffect(() => {
    const activeMode = darkMode ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', activeMode);
    if (document.body) {
      document.body.classList.toggle('dark-mode', activeMode === 'dark');
      document.body.classList.toggle('light-mode', activeMode === 'light');
    }
  }, [darkMode]);
  const [showRoleDrawer, setShowRoleDrawer] = useState(false);
  const [tickerData, setTickerData] = useState({
    safetyIndex: '99.6%',
    activeDefects: 12,
    aiSanctionRate: '97.2%',
    avgPriority: '8.6',
    trainDelaysAvoided: '358 hrs',
    wsConnected: true
  });

  // Periodically update telemetry metrics for live dynamic feel
  useEffect(() => {
    const interval = setInterval(() => {
      setTickerData(prev => ({
        ...prev,
        activeDefects: Math.max(8, Math.min(20, prev.activeDefects + (Math.random() > 0.5 ? 1 : -1))),
        aiSanctionRate: (96.8 + Math.random() * 0.4).toFixed(1) + '%'
      }));
    }, 3500);
    return () => clearInterval(interval);
  }, []);

  const CATEGORIZED_NAV = [
    {
      group: 'COMMAND OPERATIONS',
      items: [
        { key: 'admin', label: 'Executive Admin', icon: Shield, roleAllowed: ['admin'], desc: 'High-level safety & sanction decision matrix' },
        { key: 'control', label: 'Control Office', icon: Sliders, roleAllowed: ['admin', 'control-office'], desc: 'AI corridor block scheduling & conflict solver' },
      ]
    },
    {
      group: 'FIELD & SURVEILLANCE',
      items: [
        { key: 'maintenance', label: 'Maintenance Cell', icon: Wrench, roleAllowed: ['admin', 'field-engineer'], desc: 'Work order execution & field crew dispatch' },
        { key: 'surveillance', label: 'Surveillance & USFD', icon: Radio, roleAllowed: ['admin', 'surveillance'], desc: 'Track defect telemetry & ultrasonic inspection' },
      ]
    },
    {
      group: 'AI ENGINE & DATA',
      items: [
        { key: 'aimodels', label: 'AI MLOps Studio', icon: Cpu, roleAllowed: ['admin'], desc: 'Model retraining, versioning & confidence logs' },
        { key: 'datasources', label: 'Integration Gateway', icon: Database, roleAllowed: ['admin'], desc: '15 live railway data source streams' },
        { key: 'dashboard', label: 'Full Operations Hub', icon: Layers, roleAllowed: ['admin', 'control-office', 'field-engineer', 'surveillance'], desc: 'Unified multi-system telemetry dashboard' },
      ]
    },
    {
      group: 'PORTAL & SYSTEM',
      items: [
        { key: 'summary', label: 'Executive Summary', icon: FileText, roleAllowed: ['admin', 'field-engineer', 'control-office', 'surveillance'], desc: 'Architecture, ROI & compliance summary' },
      ]
    }
  ];

  const handleQuickRoleSwitch = (username, password, roleKey) => {
    try {
      login(username, password, roleKey);
      setShowRoleDrawer(false);
    } catch (e) {
      alert(e.message);
    }
  };

  const bgGradient = darkMode
    ? 'radial-gradient(circle at 50% 0%, #0B1329 0%, #030712 100%)'
    : 'radial-gradient(circle at 50% 0%, #FFFFFF 0%, #FAF6EE 100%)';

  const textColor = darkMode ? '#F8FAFC' : '#0F172A';
  const cardBg = darkMode ? 'rgba(11, 19, 41, 0.88)' : 'rgba(255, 255, 255, 0.92)';
  const borderColor = darkMode ? 'rgba(0, 229, 255, 0.2)' : 'rgba(195, 178, 150, 0.45)';

  return (
    <div style={{ minHeight: '100vh', background: bgGradient, color: textColor, fontFamily: "'Plus Jakarta Sans', 'Calibri', sans-serif" }}>
      
      {/* ── Top Live Telemetry Ticker Header ── */}
      <div style={{
        height: '38px',
        background: darkMode ? '#020617' : 'linear-gradient(90deg, #001F3F 0%, #003366 50%, #0056B3 100%)',
        color: '#E2E8F0',
        padding: '0 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        fontSize: '0.74rem',
        fontWeight: '600',
        boxShadow: '0 2px 10px rgba(0,0,0,0.15)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.15)',
        zIndex: 100
      }}>
        {/* Left Ticker Items */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#10B981', fontWeight: '800', letterSpacing: '0.5px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10B981', boxShadow: '0 0 10px #10B981', animation: 'pulseGlowRing 2s infinite ease-in-out' }}></span>
            <span>RAKSHA PATH MASTER AI COMMAND</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '18px', color: '#CBD5E1' }}>
            <span>SAFETY INDEX: <strong style={{ color: '#10B981' }}>{tickerData.safetyIndex}</strong></span>
            <span>ACTIVE DEFECTS: <strong style={{ color: '#F59E0B' }}>{tickerData.activeDefects}</strong></span>
            <span>AI SANCTION RATE: <strong style={{ color: '#38BDF8' }}>{tickerData.aiSanctionRate}</strong></span>
            <span>AVG PRIORITY SCORE: <strong style={{ color: '#E0E7FF' }}>{tickerData.avgPriority}/10</strong></span>
          </div>
        </div>

        {/* Right System Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#38BDF8', fontSize: '0.72rem', fontWeight: '700' }}>
            <Activity size={13} color="#38BDF8" />
            <span>LIVE TELEMETRY STREAM</span>
          </div>

          <button 
            onClick={toggleThemeMode}
            style={{ background: 'rgba(255, 255, 255, 0.1)', border: '1px solid rgba(255, 255, 255, 0.2)', borderRadius: '6px', padding: '4px 8px', color: '#E2E8F0', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.72rem', fontWeight: '700' }}
            title="Toggle Light / Dark Command Theme"
          >
            {darkMode ? <Sun size={13} color="#F59E0B" /> : <Moon size={13} color="#94A3B8" />}
            <span>{darkMode ? 'SOVEREIGN LIGHT' : 'DARK COMMAND'}</span>
          </button>
        </div>
      </div>

      {/* ── Main Layout Body ── */}
      <div style={{ display: 'flex', minHeight: 'calc(100vh - 38px)' }}>
        
        {/* ── Master Command Sidebar ── */}
        <aside style={{
          width: collapsed ? '72px' : '265px',
          background: cardBg,
          backdropFilter: 'blur(24px) saturate(2)',
          WebkitBackdropFilter: 'blur(24px) saturate(2)',
          borderRight: `1.5px solid ${borderColor}`,
          transition: 'width 0.28s cubic-bezier(0.16, 1, 0.3, 1)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          position: 'sticky',
          top: '38px',
          height: 'calc(100vh - 38px)',
          zIndex: 90
        }}>
          {/* Top Brand & Nav Section */}
          <div>
            {/* Sidebar Brand Logo */}
            <div style={{
              padding: collapsed ? '16px 12px' : '20px 20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: collapsed ? 'center' : 'space-between',
              borderBottom: `1px solid ${borderColor}`
            }}>
              {!collapsed ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{
                    width: '38px', height: '38px', borderRadius: '12px',
                    background: 'linear-gradient(135deg, #002244 0%, #004488 50%, #0066CC 100%)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#FFF', fontWeight: '900', fontSize: '1.05rem',
                    boxShadow: '0 4px 14px rgba(0, 51, 102, 0.35), inset 0 1px 1px rgba(255,255,255,0.4)',
                    border: '1px solid rgba(255,255,255,0.2)'
                  }}>
                    RP
                  </div>
                  <div>
                    <div style={{ fontSize: '0.98rem', fontWeight: '800', color: darkMode ? '#FFF' : '#002244', letterSpacing: '0.6px' }}>
                      RAKSHA PATH
                    </div>
                    <div style={{ fontSize: '0.62rem', color: '#64748B', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                      Master AI Command
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{
                  width: '38px', height: '38px', borderRadius: '12px',
                  background: 'linear-gradient(135deg, #002244, #0056B3)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#FFF', fontWeight: '900', fontSize: '0.95rem'
                }}>
                  RP
                </div>
              )}

              <button
                onClick={() => setCollapsed(!collapsed)}
                style={{
                  background: 'rgba(0, 51, 102, 0.08)',
                  border: '1px solid rgba(0, 51, 102, 0.15)',
                  borderRadius: '7px',
                  padding: '5px',
                  cursor: 'pointer',
                  color: darkMode ? '#FFF' : '#003366',
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}
              >
                {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
              </button>
            </div>

            {/* Nav Categories */}
            <div style={{ padding: '14px 12px', overflowY: 'auto', maxHeight: 'calc(100vh - 180px)' }}>
              {CATEGORIZED_NAV.map((cat, idx) => {
                const allowedItems = cat.items.filter(item => 
                  !session || session.role === 'admin' || item.roleAllowed.includes(session.role)
                );
                if (allowedItems.length === 0) return null;

                return (
                  <div key={idx} style={{ marginBottom: '18px' }}>
                    {!collapsed && (
                      <div style={{
                        fontSize: '0.62rem', fontWeight: '800', color: '#94A3B8',
                        letterSpacing: '1.2px', textTransform: 'uppercase', padding: '4px 10px 8px'
                      }}>
                        {cat.group}
                      </div>
                    )}
                    {allowedItems.map(item => {
                      const Icon = item.icon;
                      const isActive = currentTab === item.key;
                      return (
                        <button
                          key={item.key}
                          onClick={() => setCurrentTab(item.key)}
                          title={collapsed ? `${item.label} — ${item.desc}` : item.desc}
                          style={{
                            width: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            padding: collapsed ? '10px 0' : '10px 14px',
                            justifyContent: collapsed ? 'center' : 'flex-start',
                            borderRadius: '11px',
                            border: isActive ? '1px solid rgba(255,255,255,0.3)' : '1px solid transparent',
                            marginBottom: '4px',
                            background: isActive
                              ? 'linear-gradient(135deg, #003366 0%, #0056B3 100%)'
                              : 'transparent',
                            color: isActive ? '#FFFFFF' : (darkMode ? '#CBD5E1' : '#475569'),
                            fontWeight: isActive ? '800' : '600',
                            fontSize: '0.84rem',
                            cursor: 'pointer',
                            transition: 'all 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
                            boxShadow: isActive ? '0 6px 20px rgba(0, 51, 102, 0.32)' : 'none'
                          }}
                        >
                          <Icon size={18} color={isActive ? '#FFFFFF' : (darkMode ? '#94A3B8' : '#003366')} />
                          {!collapsed && <span>{item.label}</span>}
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Bottom Officer Profile & Quick Switcher */}
          {session && (
            <div style={{
              padding: '14px 16px',
              borderTop: `1.5px solid ${borderColor}`,
              background: darkMode ? 'rgba(2, 6, 23, 0.6)' : 'rgba(0, 51, 102, 0.03)'
            }}>
              {!collapsed ? (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '1.1rem' }}>{roleMeta?.icon || '🛡️'}</span>
                      <div>
                        <div style={{ fontSize: '0.82rem', fontWeight: '800', color: darkMode ? '#FFF' : '#002244' }}>
                          {session.name}
                        </div>
                        <div style={{ fontSize: '0.65rem', color: '#64748B', fontWeight: '700' }}>
                          {roleMeta?.label || session.role}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '6px', marginTop: '10px' }}>
                    <button
                      onClick={() => setShowRoleDrawer(!showRoleDrawer)}
                      style={{
                        flex: 1, padding: '7px 10px', borderRadius: '8px', border: '1px solid rgba(0, 51, 102, 0.22)',
                        background: 'rgba(0, 51, 102, 0.08)', color: '#003366', fontWeight: '700', fontSize: '0.74rem',
                        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      <UserCheck size={13} />
                      <span>Switch Role</span>
                    </button>
                    <button
                      onClick={logout}
                      style={{
                        padding: '7px 10px', borderRadius: '8px', border: '1px solid rgba(220, 38, 38, 0.3)',
                        background: 'rgba(220, 38, 38, 0.08)', color: '#DC2626', fontWeight: '700', fontSize: '0.74rem',
                        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
                      }}
                      title="Sign Out"
                    >
                      <LogOut size={14} />
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={logout}
                  title="Sign Out"
                  style={{
                    width: '100%', padding: '9px 0', borderRadius: '8px', border: 'none',
                    background: 'rgba(220, 38, 38, 0.1)', color: '#DC2626', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}
                >
                  <LogOut size={16} />
                </button>
              )}
            </div>
          )}
        </aside>

        {/* ── Main View Content Area ── */}
        <main style={{ flex: 1, padding: '28px 36px', overflowY: 'auto' }}>
          
          {/* Quick Role Switcher Drawer Modal */}
          {showRoleDrawer && (
            <div style={{
              marginBottom: '24px', padding: '18px 24px', borderRadius: '16px',
              background: 'linear-gradient(135deg, rgba(0, 51, 102, 0.08), rgba(0, 86, 179, 0.14))',
              border: '1.5px solid rgba(0, 51, 102, 0.25)', boxShadow: '0 8px 30px rgba(0, 51, 102, 0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between'
            }}>
              <div>
                <div style={{ fontWeight: '800', fontSize: '0.95rem', color: '#002244', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>⚡ Quick Officer Role Switcher</span>
                </div>
                <div style={{ fontSize: '0.78rem', color: '#475569', marginTop: '2px' }}>
                  Select an operational role to instantly test permissions across the Master Command Hub:
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  onClick={() => handleQuickRoleSwitch('admin', 'Admin@123', 'admin')}
                  style={{ padding: '8px 14px', borderRadius: '9px', border: 'none', background: '#003366', color: '#FFF', fontWeight: '800', fontSize: '0.78rem', cursor: 'pointer', boxShadow: '0 4px 12px rgba(0, 51, 102, 0.3)' }}
                >
                  🛡️ Admin Executive
                </button>
                <button
                  onClick={() => handleQuickRoleSwitch('controller1', 'Ctrl@789', 'control-office')}
                  style={{ padding: '8px 14px', borderRadius: '9px', border: 'none', background: '#0056B3', color: '#FFF', fontWeight: '800', fontSize: '0.78rem', cursor: 'pointer', boxShadow: '0 4px 12px rgba(0, 86, 179, 0.3)' }}
                >
                  🎛️ Control Office
                </button>
                <button
                  onClick={() => handleQuickRoleSwitch('engineer1', 'Eng@456', 'field-engineer')}
                  style={{ padding: '8px 14px', borderRadius: '9px', border: 'none', background: '#D97706', color: '#FFF', fontWeight: '800', fontSize: '0.78rem', cursor: 'pointer', boxShadow: '0 4px 12px rgba(217, 119, 6, 0.3)' }}
                >
                  🔧 Field Engineer
                </button>
                <button
                  onClick={() => handleQuickRoleSwitch('inspector1', 'Insp@321', 'surveillance')}
                  style={{ padding: '8px 14px', borderRadius: '9px', border: 'none', background: '#059669', color: '#FFF', fontWeight: '800', fontSize: '0.78rem', cursor: 'pointer', boxShadow: '0 4px 12px rgba(5, 150, 105, 0.3)' }}
                >
                  📡 Surveillance
                </button>
              </div>
            </div>
          )}

          {children}
        </main>
      </div>
    </div>
  );
}
