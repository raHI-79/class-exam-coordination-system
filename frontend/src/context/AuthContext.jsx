import { createContext, useContext, useEffect, useState } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [auth, setAuth] = useState(() => {
    const raw = localStorage.getItem('sust_auth');
    return raw ? JSON.parse(raw) : null;
  });

  useEffect(() => {
    if (auth) localStorage.setItem('sust_auth', JSON.stringify(auth));
    else localStorage.removeItem('sust_auth');
  }, [auth]);

  const login = (token, role, profile) => setAuth({ token, role, profile });
  const logout = () => setAuth(null);

  return (
    <AuthContext.Provider value={{ auth, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
