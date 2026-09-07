import api from './api';
import { User } from '../types';

export const authService = {
  login: async (credentials: { email: string; password: string }): Promise<{ token: string; user: User }> => {
    const response = await api.post('/auth/login', credentials);
    return response.data;
  },
  register: async (userData: any): Promise<{ token: string; user: User }> => {
    const response = await api.post('/auth/register', userData);
    return response.data;
  },
  logout: () => {
    localStorage.removeItem('hearth_token');
  },
};
