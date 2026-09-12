import React, { createContext, useContext, useState, useEffect } from 'react';
import { ROLES_CATALOG, findByUsername, authenticate } from '../services/userStore';

const SESSION_KEY = 'ir_auth_session';
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(() => {
    try {
      const navEntries = performance.getEntriesByType ? performance.getEntriesByType('navigation') : [];
      const isReload = (navEntries.length > 0 && navEntries[0].type === 'reload') ||
                       (window.performance && window.performance.navigation && window.performance.navigation.type === 1);
      if (isReload) {
        sessionStorage.removeItem(SESSION_KEY);
        return null;
      }
      const raw = sessionStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (parsed && parsed.role && ROLES_CATALOG.some(r => r.key === parsed.role)) {
        return parsed;
      }
    } catch (_) {}
    return null;
  });

  const login = (username, password, selectedRoleKey) => {
    const roleMeta = ROLES_CATALOG.find(r => r.key === selectedRoleKey);
    if (!roleMeta) throw new Error('Invalid access role selected.');

    const found = findByUsername(username);
    if (!found) throw new Error('No account found with that username.');
    if (!found.active) throw new Error('Your account has been deactivated. Contact your divisional admin.');
    if (found.role !== selectedRoleKey && found.role !== 'admin') {
      throw new Error(`User '${found.username}' belongs to role '${found.role}', not '${roleMeta.label}'.`);
    }

    const user = authenticate(username, password);
    if (!user) throw new Error('Incorrect password. Please try again.');

    const newSession = {
      role: selectedRoleKey,
      name: user.name,
      username: user.username,
      userId: user.id,
      division: user.division,
      loginTime: Date.now()
    };

    sessionStorage.setItem(SESSION_KEY, JSON.stringify(newSession));
    setSession(newSession);
    return newSession;
  };

  const logout = () => {
    sessionStorage.removeItem(SESSION_KEY);
    setSession(null);
  };

  const currentRoleMeta = session ? ROLES_CATALOG.find(r => r.key === session.role) || ROLES_CATALOG[0] : null;

  return (
    <AuthContext.Provider value={{ session, roleMeta: currentRoleMeta, login, logout, isAuth: !!session }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
