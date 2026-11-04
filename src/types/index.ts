// Common TypeScript definitions for the Smart PG/Hostel Management System

export type UserRole = 'student' | 'admin';

export interface User {
  user_id: number;
  name: string;
  email: string;
  role: UserRole;
  created_at?: string;
}

export interface Hostel {
  hostel_id: number;
  hostel_name: string;
  address: string;
  contact_number: string;
  created_at?: string;
}

export interface RoomType {
  room_type_id: number;
  type_name: string;
  capacity: number;
  monthly_rent: number;
}

export type RoomStatus = 'AVAILABLE' | 'OCCUPIED' | 'UNDER_MAINTENANCE';

export interface Room {
  room_id: number;
  hostel_id: number;
  room_type_id: number;
  room_number: string;
  floor: number;
  status: RoomStatus;
}

export type ApplicationStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'ALLOCATED';

export interface Application {
  application_id: number;
  student_id: number;
  preferred_hostel_id: number;
  preferred_room_type_id: number;
  application_date: string;
  status: ApplicationStatus;
  notes?: string;
}

export type AllocationStatus = 'ACTIVE' | 'TERMINATED';

export interface Allocation {
  allocation_id: number;
  application_id: number;
  student_id: number;
  room_id: number;
  allocation_date: string;
  start_date: string;
  end_date?: string | null;
  status: AllocationStatus;
}

export interface RoomOccupancySummary {
  room_id: number;
  hostel_id: number;
  hostel_name: string;
  room_number: string;
  floor: number;
  room_type_id: number;
  type_name: string;
  capacity: number;
  monthly_rent: number;
  occupied_beds: number;
  available_beds: number;
  status: RoomStatus;
  occupancy_status?: string;
  physical_status?: RoomStatus;
}

// MongoDB Activity Log & Aggregation Analytics Types
export interface ActivityLogSummaryItem {
  action: string;
  count: number;
  lastOccurred: string;
}

export interface ActivityDailyTrend {
  date: string;
  count: number;
}

export interface ActivityTargetSummary {
  targetType: string;
  count: number;
}

export interface SerializedActivityLog {
  _id: string;
  action: string;
  performedBy: number | { userId?: number; email?: string; role?: string; name?: string };
  targetType: string;
  targetId: number;
  studentId?: number;
  roomId?: number;
  timestamp: string;
  details: Record<string, any>;
}

export interface ActivityLogsApiResponse {
  success: boolean;
  totalLogs: number;
  summary: ActivityLogSummaryItem[];
  dailyTrends: ActivityDailyTrend[];
  targetSummary: ActivityTargetSummary[];
  recentLogs: SerializedActivityLog[];
  message?: string;
  error?: string;
}
