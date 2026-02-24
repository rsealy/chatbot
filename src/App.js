import { useState } from 'react';
import Auth from './components/Auth';
import Chat from './components/Chat';
import './App.css';

function App() {
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem('chatapp_user_profile');
      return stored ? JSON.parse(stored) : null;
    } catch {
      const legacyUsername = localStorage.getItem('chatapp_user');
      return legacyUsername ? { username: legacyUsername } : null;
    }
  });

  const handleLogin = (userProfile) => {
    const profile = {
      username: userProfile.username,
      firstName: userProfile.firstName || '',
      lastName: userProfile.lastName || '',
      email: userProfile.email || '',
    };
    localStorage.setItem('chatapp_user_profile', JSON.stringify(profile));
    localStorage.removeItem('chatapp_user');
    setUser(profile);
  };

  const handleLogout = () => {
    localStorage.removeItem('chatapp_user_profile');
    localStorage.removeItem('chatapp_user');
    setUser(null);
  };

  if (user) {
    return <Chat user={user} onLogout={handleLogout} />;
  }
  return <Auth onLogin={handleLogin} />;
}

export default App;
