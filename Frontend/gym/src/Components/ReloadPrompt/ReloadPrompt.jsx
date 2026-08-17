import React from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import './ReloadPrompt.css';

function ReloadPrompt() {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      console.log('SW Registered: ' + r);
    },
    onRegisterError(error) {
      console.log('SW registration error', error);
    },
  });

  const close = () => {
    setOfflineReady(false);
    setNeedRefresh(false);
  };

  if (!offlineReady && !needRefresh) return null;

  return (
    <div className="ReloadPrompt-container">
      <div className="ReloadPrompt-toast">
        <div className="ReloadPrompt-message">
          {offlineReady ? (
            <span>App ready to work offline</span>
          ) : (
            <span>New version available! Click refresh to update.</span>
          )}
        </div>
        <div className="ReloadPrompt-buttons">
          {needRefresh && (
            <button className="ReloadPrompt-toast-button reload" onClick={() => updateServiceWorker(true)}>
              Refresh
            </button>
          )}
          <button className="ReloadPrompt-toast-button close" onClick={() => close()}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default ReloadPrompt;
