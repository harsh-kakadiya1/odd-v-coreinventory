import { createContext, useContext, useMemo, useState } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(localStorage.getItem('coreinventory_token'));
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem('coreinventory_user');
    return raw ? JSON.parse(raw) : null;
  });

  const login = (authToken, authUser) => {
    localStorage.setItem('coreinventory_token', authToken);
    localStorage.setItem('coreinventory_user', JSON.stringify(authUser));
    setToken(authToken);
    setUser(authUser);
  };

  const logout = () => {
    localStorage.removeItem('coreinventory_token');
    localStorage.removeItem('coreinventory_user');
    setToken(null);
    setUser(null);
  };

  const value = useMemo(() => ({ token, user, login, logout, setUser }), [token, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return context;
}
