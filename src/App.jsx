import { useState, useEffect } from 'react';
import TitleBar from './components/TitleBar';
import Sidebar from './components/Sidebar';
import RequestTabs from './components/RequestTabs';
import RequestBuilder from './components/RequestBuilder';
import ResponseViewer from './components/ResponseViewer';
import EnvironmentManager from './components/EnvironmentManager';
import { PluginProvider, usePlugins } from './plugins';
import { useStore } from './store';

function WorkspacePanel({ activeTab }) {
  const { plugins, enabledPlugins } = usePlugins();

  const panelPlugin = plugins.find(
    (p) => p.panelComponent && activeTab?.type === (p.tabType ?? p.id)
  );
  const panelEnabled = panelPlugin ? enabledPlugins[panelPlugin.id] !== false : false;

  if (panelPlugin && panelEnabled) {
    const Panel = panelPlugin.panelComponent;
    return <Panel tab={activeTab} />;
  }

  if (panelPlugin && !panelEnabled) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-600 text-sm flex-col gap-3">
        <div className="text-4xl">{panelPlugin.icon}</div>
        <div className="font-medium text-gray-500">{panelPlugin.name} plugin is disabled</div>
        <div className="text-xs text-gray-600">Enable it in Plugins settings to use this tab</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <RequestBuilder />
      <ResponseViewer />
    </div>
  );
}

function AppShell() {
  const [showEnvManager, setShowEnvManager] = useState(false);
  const loadCollectionsFromDisk = useStore((s) => s.loadCollectionsFromDisk);
  const tabs = useStore((s) => s.tabs);
  const activeTabId = useStore((s) => s.activeTabId);

  const activeTab = tabs.find((t) => t.id === (activeTabId ?? tabs[0]?.id));

  useEffect(() => {
    loadCollectionsFromDisk();
  }, []);

  return (
    <div className="flex flex-col h-screen bg-pm-bg text-gray-100 overflow-hidden">
      <TitleBar onOpenEnvManager={() => setShowEnvManager(true)} />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar />

        <div className="flex flex-col flex-1 overflow-hidden">
          <RequestTabs />
          <WorkspacePanel activeTab={activeTab} />
        </div>
      </div>

      {showEnvManager && <EnvironmentManager onClose={() => setShowEnvManager(false)} />}
    </div>
  );
}

export default function App() {
  return (
    <PluginProvider>
      <AppShell />
    </PluginProvider>
  );
}
