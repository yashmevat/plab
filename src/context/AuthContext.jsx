// context/AuthContext.jsx
'use client';
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const checkAuth = useCallback(async (inMemoryToken) => {
    try {
      // Include x-book-token: prefer in-memory token (incognito safe), fallback to localStorage
      let saved = {};
      try { saved = JSON.parse(localStorage.getItem('bookTokenData') || '{}'); } catch(e) {}
      const headers = {};
      const tokenToUse = inMemoryToken || saved?.token;
      if (tokenToUse) headers['x-book-token'] = tokenToUse;

      const res = await fetch('/api/auth/me', {
        credentials: 'include',
        cache: 'no-store',
        headers,
      });
      const data = await res.json();
      
      if (data.success && data.user) {
        setUser(data.user);
        return true;
      } else {
        setUser(null);
        return false;
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      setUser(null);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // In a cross-origin iframe with no saved token, skip the initial API call
    // to avoid a guaranteed 401. Auth will be triggered by the 'auth-updated' event
    // once the postMessage flow completes.
    const isIframe = typeof window !== 'undefined' && window.self !== window.top;
    let saved = {};
    try { saved = JSON.parse(localStorage.getItem('bookTokenData') || '{}'); } catch(e) {}

    if (isIframe && !saved?.token) {
      setLoading(false);
      return;
    }

    checkAuth();
  }, [checkAuth]);

  // Listen for postMessage auth completion so AuthContext re-checks with the new token
  useEffect(() => {
    const handleAuthUpdated = (e) => {
      // e.detail.token is set when localStorage is blocked (incognito)
      const inMemoryToken = e?.detail?.token;
      checkAuth(inMemoryToken);
    };
    window.addEventListener('auth-updated', handleAuthUpdated);
    return () => window.removeEventListener('auth-updated', handleAuthUpdated);
  }, [checkAuth]);

  const login = useCallback(async (credentials) => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(credentials),
      });

      const data = await res.json();

      if (data.success && data.user) {
        setUser(data.user); // Update state immediately
        return { success: true, user: data.user,token: data.token };
      } else {
        return { success: false, error: data.error || 'Login failed' };
      }
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, error: 'Login failed' };
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', { 
        method: 'POST',
        credentials: 'include',
      });
    } catch (error) {
      console.error('Logout failed:', error);
    } finally {
      setUser(null);
      router.push('/login');
      router.refresh();
    }
  }, [router]);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, checkAuth, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
