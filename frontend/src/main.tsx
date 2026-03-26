import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import AuthGate from './components/AuthGate.tsx';
import {ToastProvider} from './components/ToastProvider.tsx';
import {DownloadProvider} from './context/DownloadContext.tsx';
import {FavoritesProvider} from './context/FavoritesContext.tsx';
import {LibraryProvider} from './context/LibraryContext.tsx';
import {UnsavedChangesProvider} from './context/UnsavedChangesContext.tsx';
import {I18nProvider} from './i18n/I18nProvider.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nProvider>
      <ToastProvider>
        <UnsavedChangesProvider>
          <AuthGate>
            {({user, logout, login, register}) => (
              <LibraryProvider>
                <FavoritesProvider>
                  <DownloadProvider>
                    <App authUser={user} onLogout={logout} onLogin={login} onRegister={register} />
                  </DownloadProvider>
                </FavoritesProvider>
              </LibraryProvider>
            )}
          </AuthGate>
        </UnsavedChangesProvider>
      </ToastProvider>
    </I18nProvider>
  </StrictMode>,
);
