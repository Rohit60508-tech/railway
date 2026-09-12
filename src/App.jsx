import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import SharedHeader from './components/SharedHeader';
import RoleLoginView from './views/RoleLoginView';
import ExecutiveAdminView from './views/ExecutiveAdminView';
import ControlOfficeView from './views/ControlOfficeView';
import FieldEngineerView from './views/FieldEngineerView';
import SurveillanceView from './views/SurveillanceView';
import AiModelsView from './views/AiModelsView';
import ProjectSummaryView from './views/ProjectSummaryView';
import DataSourcesView from './views/DataSourcesView';
import Dashboard from './components/Dashboard';
import IntegratedHub from './components/IntegratedHub';
import FullOperationsDashboard from './components/FullOperationsDashboard';

function MainApp() {
  const { isAuth, session } = useAuth();

  const getRoleDefaultTab = (role) => {
    if (role === 'field-engineer') return 'maintenance';
    if (role === 'control-office') return 'control';
    if (role === 'surveillance') return 'surveillance';
    return 'admin';
  };

  const isTabAllowedForRole = (tabKey, role) => {
    if (!role || role === 'admin') return true;
    if (tabKey === 'summary') return true;
    if (role === 'field-engineer') return tabKey === 'maintenance' || tabKey === 'dashboard';
    if (role === 'control-office') return tabKey === 'control' || tabKey === 'dashboard';
    if (role === 'surveillance') return tabKey === 'surveillance' || tabKey === 'dashboard';
    return false;
  };

  const getInitialTab = () => {
    const hash = window.location.hash.replace('#', '').trim();
    return hash || 'admin';
  };

  const [currentTab, setCurrentTabState] = useState(getInitialTab);

  const setCurrentTab = (tabKey) => {
    if (session && !isTabAllowedForRole(tabKey, session.role)) {
      const defaultTab = getRoleDefaultTab(session.role);
      window.location.hash = `#${defaultTab}`;
      setCurrentTabState(defaultTab);
      return;
    }
    window.location.hash = `#${tabKey}`;
    setCurrentTabState(tabKey);
  };

  // Sync tab with URL hash and validate permissions
  useEffect(() => {
    if (!session) return;

    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '').trim();
      const targetTab = hash || getRoleDefaultTab(session.role);
      if (!isTabAllowedForRole(targetTab, session.role)) {
        const fallback = getRoleDefaultTab(session.role);
        window.location.hash = `#${fallback}`;
        setCurrentTabState(fallback);
      } else {
        setCurrentTabState(targetTab);
      }
    };

    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [session]);

  if (!isAuth) {
    return <RoleLoginView />;
  }

  const renderView = () => {
    switch (currentTab) {
      case 'admin':
        return <ExecutiveAdminView />;
      case 'control':
        return <ControlOfficeView />;
      case 'maintenance':
        return <FieldEngineerView />;
      case 'surveillance':
        return <SurveillanceView />;
      case 'dashboard':
        return (
          <div>
            <FullOperationsDashboard />
            <IntegratedHub />
            <Dashboard />
          </div>
        );
      case 'datasources':
        return <DataSourcesView />;
      case 'aimodels':
        return <AiModelsView />;
      case 'summary':
        return <ProjectSummaryView />;
      default:
        return <ExecutiveAdminView />;
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'radial-gradient(circle at 50% 0%, #FFFFFF 0%, #FAF6EE 100%)' }}>
      <SharedHeader currentTab={currentTab} setCurrentTab={setCurrentTab} />
      <main>
        {renderView()}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}
