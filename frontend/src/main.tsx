import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import AuthGate from './components/AuthGate.tsx';
import {LibraryProvider} from './context/LibraryContext.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthGate>
      {({user, logout}) => (
        <LibraryProvider>
          <App authUser={user} onLogout={logout} />
        </LibraryProvider>
      )}
    </AuthGate>
  </StrictMode>,
);
