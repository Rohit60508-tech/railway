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
      label: 'Field Engineer (General / SSE)',
      icon: '🔧',
      color: '#D97706',
      route: 'maintenance-dashboard.html',
      permissions: ['work-orders'],
    },
    'field-tms': {
      label: 'TMS — Track Maintenance',
      icon: '🛤️',
      color: '#F59E0B',
      route: 'maintenance-dashboard.html',
      permissions: ['work-orders'],
    },
    'field-smms': {
      label: 'SMMS — Signal & Telecom',
      icon: '🚦',
      color: '#0284C7',
      route: 'maintenance-dashboard.html',
      permissions: ['work-orders'],
    },
    'field-trd': {
      label: 'TRD — Traction Distribution',
      icon: '⚡',
      color: '#EAB308',
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
    if (path.includes('admin-dashboard')) return 'admin';
    if (path.includes('maintenance-dashboard')) return 'work-orders';
    if (path.includes('control-office')) return 'control-office';
    if (path.includes('surveillance')) return 'surveillance';
    if (path.includes('ai-model-management')) return 'ai-models';
    return null;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // HIGH-SECURITY PROTOCOL: FORCE LOGOUT ON EVERY PAGE RELOAD / REFRESH
  // ═══════════════════════════════════════════════════════════════════════════
  let isReload = false;
  try {
    const navEntries = performance.getEntriesByType ? performance.getEntriesByType('navigation') : [];
    if (navEntries.length > 0 && navEntries[0].type === 'reload') {
      isReload = true;
    } else if (window.performance && window.performance.navigation && window.performance.navigation.type === 1) {
      isReload = true;
    }
  } catch (_) {}

  if (isReload) {
    try {
      sessionStorage.removeItem(SESSION_KEY);
      sessionStorage.removeItem('ir_auth_token');
    } catch (_) {}
    window.location.replace(LOGIN_URL + '?reason=reload_security');
    return;
  }

  let session = getSession();

  if (!session) {
    const currentPath = encodeURIComponent(window.location.pathname.split('/').pop() || 'admin-dashboard.html');
    window.location.replace(LOGIN_URL + '?redirect=' + currentPath);
    return;
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
