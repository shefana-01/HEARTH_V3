import api from './api';
import { Family, FamilyMember } from '../types';

export const familyService = {
  getFamilies: async (): Promise<Family[]> => {
    const response = await api.get('/families');
    return response.data;
  },

  getMembers: async (familyId: string): Promise<FamilyMember[]> => {
    const response = await api.get(`/families/${familyId}/members`);
    return response.data;
  },

  inviteMember: async (familyId: string, inviteData: { email: string; role: string }): Promise<void> => {
    await api.post(`/families/${familyId}/members/invite`, inviteData);
  },
};
