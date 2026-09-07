import api from './api';
import { PriorityScore, ReassignmentRecommendation } from '../types';

export const decisionService = {
  getPriorityScore: async (taskId: string): Promise<PriorityScore> => {
    const response = await api.post('/decisions/priority', { taskId });
    return response.data;
  },

  getReassignmentRecommendation: async (taskId: string, taskTitle: string): Promise<ReassignmentRecommendation> => {
    const response = await api.post('/decisions/reassign', { taskId, taskTitle });
    return response.data;
  },
};
