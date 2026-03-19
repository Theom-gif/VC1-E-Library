import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import AuthGate from './components/AuthGate.tsx';
import {DownloadProvider} from './context/DownloadContext.tsx';
import {FavoritesProvider} from './context/FavoritesContext.tsx';
import {LibraryProvider} from './context/LibraryContext.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
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
  </StrictMode>,
);
