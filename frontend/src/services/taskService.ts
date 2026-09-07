import api from './api';
import { Task } from '../types';

export const taskService = {
  getFamilyTasks: async (familyId: string): Promise<Task[]> => {
    const response = await api.get(`/tasks/family/${familyId}`);
    return response.data;
  },

  createTask: async (taskData: Partial<Task>): Promise<Task> => {
    const response = await api.post('/tasks', taskData);
    return response.data;
  },

  assignTask: async (taskId: string, memberId: string): Promise<Task> => {
    const response = await api.post(`/tasks/${taskId}/assign`, { memberId });
    return response.data;
  },

  reportUnavailability: async (taskId: string, reason: string): Promise<void> => {
    await api.post(`/tasks/${taskId}/unavailability`, { reason });
  },
};
