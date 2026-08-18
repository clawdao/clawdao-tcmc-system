import React, { createContext, useContext, useState } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('tcm_user') || 'null');
    } catch {
      return null;
    }
  });

  const login = (token, userInfo) => {
    localStorage.setItem('tcm_token', token);
    localStorage.setItem('tcm_user', JSON.stringify(userInfo));
    setUser(userInfo);
  };

  const logout = () => {
    localStorage.removeItem('tcm_token');
    localStorage.removeItem('tcm_user');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, isAdmin: user?.role === 'admin', canWrite: user?.role === 'admin' || user?.role === 'doctor' }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
