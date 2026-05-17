import { create } from 'zustand';
import { User } from '@workspace/api-client-react';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (user: User, token: string) => void;
  logout: () => void;
}

const getStoredToken = () => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('kips_token');
  }
  return null;
};

const getStoredUser = () => {
  if (typeof window !== 'undefined') {
    const userStr = localStorage.getItem('kips_user');
    if (userStr) {
      try {
        return JSON.parse(userStr) as User;
      } catch (e) {
        return null;
      }
    }
  }
  return null;
};

export const useAuthStore = create<AuthState>((set) => ({
  user: getStoredUser(),
  token: getStoredToken(),
  isAuthenticated: !!getStoredToken(),
  login: (user, token) => {
    localStorage.setItem('kips_token', token);
    localStorage.setItem('kips_user', JSON.stringify(user));
    set({ user, token, isAuthenticated: true });
  },
  logout: () => {
    localStorage.removeItem('kips_token');
    localStorage.removeItem('kips_user');
    set({ user: null, token: null, isAuthenticated: false });
  },
}));
