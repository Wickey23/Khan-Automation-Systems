export interface Lead {
  id: string;
  name: string;
  initials: string;
  source: string;
  status: 'Urgent' | 'Pending' | 'New' | 'Follow-up' | 'Qualified' | 'Archived';
  waitingSince: string;
  urgency: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  email: string;
  role?: string;
  budget?: string;
  location?: string;
  lastActivity: string;
}

export interface Call {
  id: string;
  caller: string;
  initials: string;
  number: string;
  status: 'In Progress' | 'On Hold' | 'In Queue' | 'Completed';
  duration: string;
  time: string;
}

export interface Appointment {
  id: string;
  patientName: string;
  type: string;
  time: string;
  insurance: string;
  insuranceStatus: 'Verified' | 'Pending';
  status: 'Urgent' | 'Routine';
}
