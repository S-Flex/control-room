export type InflowItem = {
  code: string;
  state: string;
  rushTime: string;
  width: number;
  height: number;
  trueshape: boolean;
};

export type QueueItem = {
  code: string;
  location: string;
  fastMover: boolean;
  category?: { code: string };
};

export type TickerData = {
  highlight: { code: string }[];
  alert: { code: string }[];
  content: { code: string; block: { title: string } }[];
};

export type DashboardData = {
  inflow: InflowItem[];
  queues: { queues: QueueItem[] };
  ticker: TickerData;
};
