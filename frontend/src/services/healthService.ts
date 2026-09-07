import api from './api';
import { Appointment } from '../types';

export const healthService = {
  getAppointments: async (patientId: string): Promise<Appointment[]> => {
    const response = await api.get(`/care/patients/${patientId}/appointments`);
    return response.data;
  },
  createAppointment: async (appointmentData: Partial<Appointment>): Promise<Appointment> => {
    const response = await api.post('/care/appointments', appointmentData);
    return response.data;
  },
};
