export type Resource = {
  line: string;
  layout_name: string;
  resource_uid?: string;
  name: string;
  type: string;
  color?: string;
  state: string;
  status?: string;
  oee?: number;
  producing?: number;
  stopped?: number;
  inactive?: number;
  errors?: number;
  downtime?: string;
  jobsToday?: number;
  material?: string;
  ink_expiration?: boolean;
  inks?: Record<string, { amount: number; expires: string }>;
  materials?: { name: string; quantity: number }[];
};

export type StateLogEntry = {
  resource_state_log_id: number;
  resource_uid: string;
  state: string;
  nest_name: string | null;
  job_name: string | null;
  start_at: string;
  resource_state_json: string | null;
  page_number: number;
};
