import { AttendanceRecord } from '../types';

// Service for attendance management
const mockAttendance: AttendanceRecord[] = [];

export const attendanceService = {
  getAttendanceByDate: (date: string): AttendanceRecord[] => {
    return mockAttendance.filter(record => record.date === date);
  },
  
  addAttendanceRecord: (record: AttendanceRecord): void => {
    mockAttendance.push(record);
  },

  getAllAttendanceRecords: (): AttendanceRecord[] => {
    return mockAttendance;
  },
  
  isCrewAvailable: (crewId: string, date: string): boolean => {
    const records = mockAttendance.filter(record => record.date === date);
    const record = records.find(r => r.crewId === crewId);
    return !record || record.status === 'present';
  },

  getAttendanceStatus: (crewId: string, date: string): AttendanceRecord | undefined => {
    return mockAttendance.find(record => record.crewId === crewId && record.date === date);
  }
};
