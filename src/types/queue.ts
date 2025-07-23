export interface QueueStatus {
  status: 'active' | 'queued' | 'error';
  position?: number;
  sessionToken?: string;
  error?: string;
}

export interface VotingSession {
  id: string;
  student_registration_number: string;
  session_token: string;
  status: 'active' | 'voting' | 'completed';
  created_at: string;
  last_heartbeat: string;
  expires_at: string;
}

export interface QueueEntry {
  id: string;
  student_registration_number: string;
  queue_position: number;
  session_token: string;
  created_at: string;
  last_heartbeat: string;
  expires_at: string;
}