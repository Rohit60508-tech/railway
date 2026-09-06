/**
 * user-store.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Client-side user store for Indian Railways AI Command.
 * Persists a list of users in localStorage with basic password-based auth.
 * Admin users can view and edit all accounts via the admin panel.
 *
 * IMPORTANT: This is a demo/prototype implementation. In production, use
 *            proper server-side auth (bcrypt, JWT, HTTPS, etc.).
 * ─────────────────────────────────────────────────────────────────────────────
 */

(function (global) {
  'use strict';

  const STORE_KEY   = 'ir_user_store';
  const VERSION_KEY = 'ir_user_store_v';
  const STORE_VERSION = '1';

  /** Default seeded users — only written once on first load */
  const DEFAULT_USERS = [
    {
      id: 'usr-001',
      username: 'admin',
      password: 'Admin@123',
      name: 'Rajesh Kumar',
      role: 'admin',
      email: 'rajesh.kumar@indianrailways.gov.in',
      phone: '+91-98100-11001',
      division: 'HQ — New Delhi',
      active: true,
      createdAt: Date.now(),
    },
    {
      id: 'usr-002',
      username: 'engineer1',
      password: 'Eng@456',
      name: 'Priya Sharma',
      role: 'field-engineer',
      email: 'priya.sharma@indianrailways.gov.in',
      phone: '+91-98200-22002',
      division: 'Northern Railway — Delhi Division',
      active: true,
      createdAt: Date.now(),
    },
    {
      id: 'usr-003',
      username: 'controller1',
      password: 'Ctrl@789',
      name: 'Suresh Patel',
      role: 'control-office',
      email: 'suresh.patel@indianrailways.gov.in',
      phone: '+91-98300-33003',
      division: 'Western Railway — Mumbai Division',
      active: true,
      createdAt: Date.now(),
    },
    {
      id: 'usr-004',
      username: 'inspector1',
      password: 'Insp@321',
      name: 'Meena Iyer',
      role: 'surveillance',
      email: 'meena.iyer@indianrailways.gov.in',
      phone: '+91-98400-44004',
      division: 'Southern Railway — Chennai Division',
      active: true,
      createdAt: Date.now(),
    },
    {
      id: 'usr-005',
      username: 'platform1',
      password: 'Plat@654',
      name: 'Arjun Singh',
      role: 'platform-portal',
      email: 'arjun.singh@indianrailways.gov.in',
      phone: '+91-98500-55005',
      division: 'Eastern Railway — Kolkata Division',
      active: true,
      createdAt: Date.now(),
    },
  ];

  /** Role meta (shared with auth-guard) */
  const ROLE_META = {
    'admin':           { label: 'Executive / Admin',              icon: '🛡️', color: '#003366' },
    'field-engineer':  { label: 'Field Engineer',                 icon: '🔧', color: '#D97706' },
    'control-office':  { label: 'Control Office Controller',      icon: '🎛️', color: '#0056B3' },
    'surveillance':    { label: 'Surveillance Inspector',         icon: '📡', color: '#059669' },
    'platform-portal': { label: 'Platform Portal User',           icon: '🚉', color: '#7C3AED' },
  };

  /** ── Internal helpers ─────────────────────────────────────────── */

  function load() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (_) { return null; }
  }

  function save(users) {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(users));
      return true;
    } catch (_) { return false; }
  }

  /** Seed defaults if first run */
  function init() {
    const version = localStorage.getItem(VERSION_KEY);
    if (!version || version !== STORE_VERSION || !load()) {
      save(DEFAULT_USERS.map(u => ({ ...u, createdAt: Date.now() })));
      localStorage.setItem(VERSION_KEY, STORE_VERSION);
    }
  }

  /** ── Public API ────────────────────────────────────────────────── */

  const UserStore = {

    /** Get all users (admin only) */
    getAll() {
      return (load() || []).slice();
    },

    /** Find by username (case-insensitive) */
    findByUsername(username) {
      const users = load() || [];
      return users.find(u => u.username.toLowerCase() === username.toLowerCase()) || null;
    },

    /** Authenticate — returns user object (without password) or null */
    authenticate(username, password) {
      const user = this.findByUsername(username);
      if (!user) return null;
      if (!user.active) return null;
      if (user.password !== password) return null;  // demo: plaintext compare
      // Return safe copy (no password)
      const { password: _, ...safeUser } = user;
      return safeUser;
    },

    /** Update a user by id (admin action) */
    update(id, fields) {
      const users = load() || [];
      const idx = users.findIndex(u => u.id === id);
      if (idx === -1) return { ok: false, error: 'User not found' };

      // Prevent duplicate username
      if (fields.username) {
        const clash = users.find(u => u.username.toLowerCase() === fields.username.toLowerCase() && u.id !== id);
        if (clash) return { ok: false, error: 'Username already taken' };
      }

      users[idx] = { ...users[idx], ...fields, id }; // id cannot be changed
      save(users);
      return { ok: true };
    },

    /** Add new user (admin action) */
    add(fields) {
      const users = load() || [];
      if (!fields.username || !fields.password || !fields.role) {
        return { ok: false, error: 'Username, password, and role are required' };
      }
      if (this.findByUsername(fields.username)) {
        return { ok: false, error: 'Username already exists' };
      }
      const newUser = {
        id: 'usr-' + Date.now(),
        username: fields.username,
        password: fields.password,
        name: fields.name || fields.username,
        role: fields.role,
        email: fields.email || '',
        phone: fields.phone || '',
        division: fields.division || '',
        active: true,
        createdAt: Date.now(),
        ...fields,
      };
      users.push(newUser);
      save(users);
      return { ok: true, user: newUser };
    },

    /** Delete a user by id (admin action) */
    delete(id) {
      const users = load() || [];
      const idx = users.findIndex(u => u.id === id);
      if (idx === -1) return { ok: false, error: 'User not found' };
      if (users[idx].role === 'admin' && users.filter(u => u.role === 'admin').length === 1) {
        return { ok: false, error: 'Cannot delete the last admin account' };
      }
      users.splice(idx, 1);
      save(users);
      return { ok: true };
    },

    /** Toggle active/inactive */
    toggleActive(id) {
      const users = load() || [];
      const user = users.find(u => u.id === id);
      if (!user) return { ok: false, error: 'User not found' };
      user.active = !user.active;
      save(users);
      return { ok: true, active: user.active };
    },

    getRoleMeta() { return ROLE_META; },
  };

  // Initialise on load
  init();

  // Expose globally
  global.IR_UserStore = UserStore;

})(typeof window !== 'undefined' ? window : this);
