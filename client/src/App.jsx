import { useState } from 'react';
import './App.css';
import SignUp from './pages/SignUp';
import Profile from './pages/Profile';
import Login from './pages/SignIn';
function App() {
  const [page, setPage] = useState(() => {
    return localStorage.getItem('token') ? 'profile' : 'signup';
  });
  return (
    <>
      <div className="app">
        {page === 'signup' && (
          <SignUp
            onSuccess={() => setPage('profile')}
            onLogin={() => setPage('signin')}
          />
        )}
        {page === 'signin' && (
          <Login
            onSuccess={() => setPage('profile')}
            onSignUp={() => setPage('signup')}
          />
        )}
        {page === 'profile' && <Profile onBack={() => setPage('signup')} />}
      </div>
      alksdjflkadsjf;lsd
    </>
  );
}

export default App;
