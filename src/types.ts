export type Frequency = "daily" | "weekly";

export interface Rule {
  enabled: boolean;
  amountUsd: number;
  frequency: Frequency;
  capUsd: number;
}

export interface Transaction {
  id: string;
  label: string;
  dateLabel: string;
  amountUsd: number;
  solAmount: number;
  auto: boolean;
  txHash: string;
}

export interface Tier {
  name: string;
  frequencyLabel: string;
  capUsd: number;
  feeLabel: string;
}
