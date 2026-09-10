/**
 * SharedNav.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Unified sticky navigation header for all Indian Railways AI Command dashboards.
 * Renders into <div id="shared-nav"> and replaces per-page headers.
 * Requires auth-guard.js to run first (uses window.IR_AUTH).
 * ─────────────────────────────────────────────────────────────────────────────
 */

(function () {
  'use strict';

  const NAV_LINKS = [
    {
      key: 'admin',
      label: 'Executive Admin',
      icon: '🛡️',
      href: 'admin-dashboard.html',
      pageMatch: 'admin-dashboard',
    },
    {
      key: 'work-orders',
      label: 'Work Orders',
      icon: '🔧',
      href: 'maintenance-dashboard.html',
      pageMatch: 'maintenance-dashboard',
    },
    {
      key: 'control-office',
      label: 'Control Office',
      icon: '🎛️',
      href: 'control-office.html',
      pageMatch: 'control-office',
    },
    {
      key: 'surveillance',
      label: 'Surveillance',
      icon: '📡',
      href: 'surveillance-dashboard.html',
      pageMatch: 'surveillance-dashboard',
    },
    {
      key: 'ai-models',
      label: 'AI MLOps',
      icon: '🧠',
      href: 'ai-model-management.html',
      pageMatch: 'ai-model-management',
    },
    {
      key: 'platform-portal',
      label: 'Platform Portal',
      icon: '🚉',
      href: 'platform-portal.html',
      pageMatch: 'platform-portal',
    },
  ];

  function isActive(link) {
    return window.location.pathname.includes(link.pageMatch);
  }

  function hasPermission(key) {
    if (!window.IR_AUTH) return true; // Default allow in open environment
    if (window.IR_AUTH.isAdmin || window.IR_AUTH.role === 'admin' || window.IR_AUTH.role === 'SUPER_ADMIN') {
      return true; // Admin has 100% unrestricted access to overwrite and change all features
    }
    return (window.IR_AUTH.permissions || []).includes(key) || (window.IR_AUTH.permissions || []).includes('ALL');
  }

  function buildNav() {
    const auth = window.IR_AUTH;
    const path = window.location.pathname;

    const linksHTML = NAV_LINKS.map(link => {
      const active  = isActive(link);
      const allowed = hasPermission(link.key);
      if (!allowed) return ''; // hide forbidden links entirely

      return `
        <a href="${link.href}"
           class="snav-link${active ? ' snav-link--active' : ''}"
           title="${link.label}">
          <span class="snav-link-icon">${link.icon}</span>
          <span class="snav-link-text">${link.label}</span>
          ${active ? '<span class="snav-link-pip"></span>' : ''}
        </a>`;
    }).join('');

    const initial = (auth ? auth.name : '?').charAt(0).toUpperCase();
    const roleColor = auth ? auth.color : '#003366';

    return `
      <header id="ir-shared-nav" class="snav-header">
        <!-- Brand -->
        <a href="../../index.html" class="snav-brand" style="text-decoration: none; color: inherit;" title="Return to RAKSHA PATH Portal">
          <div class="snav-logo">
            <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" width="28" height="28">
              <circle cx="20" cy="20" r="18" stroke="url(#sn-g1)" stroke-width="2"/>
              <path d="M8 24 L20 10 L32 24 L8 24Z" fill="url(#sn-g1)" opacity="0.9"/>
              <rect x="14" y="24" width="12" height="6" rx="2" fill="url(#sn-g2)"/>
              <circle cx="16" cy="32" r="2" fill="#D9531E"/>
              <circle cx="24" cy="32" r="2" fill="#D9531E"/>
              <defs>
                <linearGradient id="sn-g1" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
                  <stop stop-color="#003366"/><stop offset="1" stop-color="#0056B3"/>
                </linearGradient>
                <linearGradient id="sn-g2" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
                  <stop stop-color="#D9531E"/><stop offset="1" stop-color="#E65100"/>
                </linearGradient>
              </defs>
            </svg>
          </div>
          <div class="snav-title-group">
            <span class="snav-title">RAKSHA PATH</span>
            <span class="snav-subtitle">INDIAN RAILWAYS AI COMMAND &amp; BLOCK PLANNING</span>
          </div>
        </a>

        <!-- Navigation Links -->
        <nav class="snav-links" aria-label="Role navigation">
          ${linksHTML}
        </nav>

        <!-- User Panel -->
        <div class="snav-user-panel">
          <div class="snav-status-dot" title="System Online"></div>
          <div class="snav-role-badge" style="--role-color: ${roleColor}">
            <div class="snav-avatar">${initial}</div>
            <div class="snav-role-info">
              <span class="snav-role-name">${auth ? auth.name : 'Unknown'}</span>
              <span class="snav-role-label">${auth ? auth.label : ''}</span>
            </div>
          </div>
          <button class="snav-logout-btn" id="snav-logout-btn" title="Sign Out">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16,17 21,12 16,7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            <span>Logout</span>
          </button>
        </div>
      </header>`;
  }

  const CSS = `
    /* ── SharedNav Styles ──────────────────────────────────────── */
    #shared-nav {
      display: block !important;
      width: 100% !important;
      height: 60px !important;
      min-height: 60px !important;
      margin: 0 !important;
      padding: 0 !important;
      box-sizing: border-box !important;
      flex-shrink: 0 !important;
    }

    #ir-shared-nav.snav-header {
      position: fixed !important;
      top: 0 !important;
      left: 0 !important;
      right: 0 !important;
      width: 100% !important;
      height: 60px !important;
      min-height: 60px !important;
      box-sizing: border-box !important;
      z-index: 100000 !important;
      padding: 0 32px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 24px;
      background: rgba(255, 255, 255, 0.98);
      border-bottom: 1px solid rgba(0, 51, 102, 0.12);
      box-shadow: 0 2px 14px rgba(0, 51, 102, 0.05), 0 1px 2px rgba(0, 0, 0, 0.03);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      transform: none !important;
    }

    /* Brand */
    .snav-brand {
      display: flex;
      align-items: center;
      gap: 12px;
      flex-shrink: 0;
      text-decoration: none;
      cursor: pointer;
    }
    .snav-logo {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 38px;
      height: 38px;
      border-radius: 9px;
      background: linear-gradient(135deg, #f0f5ff 0%, #e8f0fe 100%);
      border: 1px solid rgba(0, 51, 102, 0.15);
      box-shadow: 0 2px 8px rgba(0, 51, 102, 0.08);
      flex-shrink: 0;
    }
    .snav-title-group {
      display: flex;
      flex-direction: column;
      gap: 1px;
    }
    .snav-title {
      font-size: 0.88rem;
      font-weight: 800;
      color: #003366;
      letter-spacing: 0.8px;
      line-height: 1.2;
      white-space: nowrap;
    }
    .snav-subtitle {
      font-size: 0.58rem;
      font-weight: 600;
      color: #64748B;
      text-transform: uppercase;
      letter-spacing: 0.6px;
      white-space: nowrap;
    }

    /* Nav Links */
    .snav-links {
      display: flex;
      align-items: center;
      gap: 8px;
      flex: 1;
      justify-content: center;
      flex-wrap: nowrap;
      overflow-x: auto;
      scrollbar-width: none;
    }
    .snav-links::-webkit-scrollbar {
      display: none;
    }
    .snav-link {
      position: relative;
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 7px 14px;
      border-radius: 8px;
      text-decoration: none;
      font-size: 0.82rem;
      font-weight: 500;
      color: #334155;
      transition: all 0.15s ease;
      white-space: nowrap;
    }
    .snav-link:hover {
      color: #003366;
      background: rgba(0, 51, 102, 0.06);
    }
    .snav-link--active {
      color: #003366;
      background: rgba(0, 51, 102, 0.09);
      font-weight: 700;
    }
    .snav-link-icon { font-size: 0.95rem; }
    .snav-link-pip {
      position: absolute;
      bottom: -1px;
      left: 50%;
      transform: translateX(-50%);
      width: 22px;
      height: 2.5px;
      border-radius: 2px;
      background: #003366;
    }

    /* User Panel */
    .snav-user-panel {
      display: flex;
      align-items: center;
      gap: 14px;
      flex-shrink: 0;
    }
    .snav-status-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #059669;
      box-shadow: 0 0 0 2px rgba(5, 150, 105, 0.25);
      animation: snavPulse 2s ease-in-out infinite;
      flex-shrink: 0;
    }
    @keyframes snavPulse {
      0%, 100% { box-shadow: 0 0 0 2px rgba(5, 150, 105, 0.25); }
      50%       { box-shadow: 0 0 0 5px rgba(5, 150, 105, 0.1); }
    }
    .snav-role-badge {
      display: flex;
      align-items: center;
      gap: 9px;
      padding: 5px 12px;
      border-radius: 8px;
      background: rgba(0, 51, 102, 0.04);
      border: 1px solid rgba(0, 51, 102, 0.12);
    }
    .snav-avatar {
      width: 28px;
      height: 28px;
      border-radius: 7px;
      background: var(--role-color, #003366);
      color: #fff;
      font-size: 0.76rem;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .snav-role-info {
      display: flex;
      flex-direction: column;
      gap: 1px;
    }
    .snav-role-name {
      font-size: 0.80rem;
      font-weight: 700;
      color: #0F172A;
      line-height: 1.2;
      white-space: nowrap;
    }
    .snav-role-label {
      font-size: 0.60rem;
      font-weight: 600;
      color: #64748B;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      line-height: 1;
      white-space: nowrap;
    }
    .snav-logout-btn {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 6px 14px;
      border-radius: 7px;
      border: 1px solid rgba(220, 38, 38, 0.25);
      background: rgba(220, 38, 38, 0.04);
      color: #DC2626;
      font-size: 0.76rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.18s;
      font-family: inherit;
      white-space: nowrap;
    }
    .snav-logout-btn:hover {
      background: rgba(220, 38, 38, 0.1);
      border-color: rgba(220, 38, 38, 0.5);
    }

    /* Push page content below sticky nav */
    body { padding-top: 0 !important; }
  `;

  function inject() {
    // Inject styles
    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);

    // Find or create mount point
    let mount = document.getElementById('shared-nav');
    if (!mount) {
      mount = document.createElement('div');
      mount.id = 'shared-nav';
      document.body.insertBefore(mount, document.body.firstChild);
    }

    mount.innerHTML = buildNav();

    // Wire up logout
    const logoutBtn = document.getElementById('snav-logout-btn');
    if (logoutBtn && window.IR_AUTH) {
      logoutBtn.addEventListener('click', () => window.IR_AUTH.logout());
    }


    // Admin Master Overwrite & Persona Switcher Helpers
    window.switchAdminPersona = function(role) {
      const meta = window.IR_AUTH?.roleMeta?.[role];
      const session = {
        username: role === 'admin' ? 'admin' : (role + '_user'),
        role: role,
        name: role === 'admin' ? 'Chief Controller & Executive Admin' : (meta ? meta.label : role),
        designation: meta ? meta.label : role,
        department: 'Indian Railways Operations',
        division: 'HQ — Northern Railway'
      };
      sessionStorage.setItem('ir_auth_session', JSON.stringify(session));

      // Also sync to main-app ir_ai_session so backend immutable audit logs capture the admin identity
      const mainSession = {
        user: {
          staffId: role === 'admin' ? 'ADMIN-ROOT-01' : ('STAFF-' + role.toUpperCase().slice(0, 4)),
          name: session.name,
          designation: session.designation,
          role: role === 'admin' ? 'ADMIN' : (role === 'control-office' ? 'CONTROL_OFFICER' : (role === 'field-engineer' ? 'MAINTENANCE_ENGINEER' : 'SURVEILLANCE_INSPECTOR')),
          zone: 'NR',
          division: 'Delhi (DLI)',
          section: 'NDLS-CNB-UP'
        },
        token: 'ir-admin-jwt-' + Date.now(),
        expiresAt: Date.now() + 24 * 60 * 60 * 1000,
        isAuthenticated: true
      };
      localStorage.setItem('ir_ai_session', JSON.stringify(mainSession));
      window.location.reload();
    };

    window.grantAdminMasterAccess = function() {
      window.switchAdminPersona('admin');
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inject);
  } else {
    inject();
  }
})();
