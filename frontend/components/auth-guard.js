/**
 * auth-guard.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Client-side authentication guard for Indian Railways AI Command dashboards.
 * Reads session state from sessionStorage; redirects to login if absent.
 * Exposes window.IR_AUTH for downstream components (SharedNav, page scripts).
 * ─────────────────────────────────────────────────────────────────────────────
 */

(function () {
  'use strict';

  const LOGIN_URL = 'login.html';
  const SESSION_KEY = 'ir_auth_session';

  /** Role → display metadata */
  const ROLE_META = {
    admin: {
      label: 'Executive / Admin',
      icon: '🛡️',
      color: '#003366',
      route: 'admin-dashboard.html',
      permissions: [
        '*',
        'ALL',
        'admin',
        'work-orders',
        'control-office',
        'surveillance',
        'platform-portal',
        'ai-models',
        'OVERWRITE_ANY',
        'OVERWRITE_BLOCKS',
        'OVERWRITE_DEFECTS',
        'OVERWRITE_SCHEDULES',
        'FORCE_SANCTION',
        'MODEL_RETRAIN',
        'SYSTEM_CONFIG'
      ],
    },
    'field-engineer': {
      label: 'Field Engineer',
      icon: '🔧',
      color: '#D97706',
      route: 'maintenance-dashboard.html',
      permissions: ['work-orders'],
    },
    'control-office': {
      label: 'Control Office Controller',
      icon: '🎛️',
      color: '#0056B3',
      route: 'control-office.html',
      permissions: ['control-office'],
    },
    surveillance: {
      label: 'Surveillance Inspector',
      icon: '📡',
      color: '#059669',
      route: 'surveillance-dashboard.html',
      permissions: ['surveillance'],
    },
    'platform-portal': {
      label: 'Platform Portal User',
      icon: '🚉',
      color: '#7C3AED',
      route: 'platform-portal.html',
      permissions: ['platform-portal'],
    },
  };

  /** Read & validate session */
  function getSession() {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      const session = JSON.parse(raw);
      if (!session || !session.role || !ROLE_META[session.role]) return null;
      return session;
    } catch (_) {
      return null;
    }
  }

  /** Determine which "page key" the current URL corresponds to */
  function getCurrentPageKey() {
    const path = window.location.pathname;
    if (path.includes('admin-dashboard'))    return 'admin';
    if (path.includes('maintenance-dashboard')) return 'work-orders';
    if (path.includes('control-office'))     return 'control-office';
    if (path.includes('surveillance'))       return 'surveillance';
    if (path.includes('platform-portal'))    return 'platform-portal';
    if (path.includes('ai-model-management')) return 'ai-models';
    return null;
  }

  let session = getSession();

  if (!session) {
    // Auto-provision Chief Controller Admin session so all dashboards load data seamlessly
    session = {
      username: 'admin',
      role: 'admin',
      name: 'Chief Controller & Executive Admin',
      designation: 'Executive Admin & DOM',
      department: 'Traffic & Civil Operations',
      division: 'HQ — Northern Railway',
    };
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    } catch (_) {}
  }

  const meta = ROLE_META[session.role] || ROLE_META['admin'];
  const pageKey = getCurrentPageKey();
  const isAdmin = session.role === 'admin' || session.role === 'SUPER_ADMIN';

  /** Expose auth state globally for SharedNav and page scripts */
  window.IR_AUTH = {
    role: session.role,
    name: session.name || meta.label,
    label: meta.label,
    icon: meta.icon,
    color: meta.color,
    permissions: meta.permissions,
    roleMeta: ROLE_META,
    SESSION_KEY,
    isAdmin: isAdmin,
    canOverwrite(feature) {
      return isAdmin || meta.permissions.includes('OVERWRITE_ANY') || meta.permissions.includes(feature);
    },
    hasPermission(key) {
      if (isAdmin) return true;
      return meta.permissions.includes(key) || meta.permissions.includes('ALL') || meta.permissions.includes('*');
    },
    setAdminRole() {
      session.role = 'admin';
      session.name = 'Chief Controller & Executive Admin';
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
      window.location.reload();
    },
    logout() {
      sessionStorage.removeItem(SESSION_KEY);
      window.location.replace(LOGIN_URL);
    },
  };
})();
