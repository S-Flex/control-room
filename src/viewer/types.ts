export type OeeGroup = {
  state: string;
  oee?: number;
  producing?: number;
  stopped?: number;
  inactive?: number;
  errors?: number;
  downtime?: string;
  jobsToday?: number;
  material?: string;
};

export type ResourceDetail = OeeGroup & {
  layout_name: string;
  materials?: { name: string; quantity: number }[];
};

export type Resource = {
  line: string;
  layout_name: string;
  name: string;
  type: string;
  color?: string;
  status?: string;
  oee?: number;
  oee_group?: OeeGroup;
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
