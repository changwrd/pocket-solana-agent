import { Tier } from "@/types";

// A reference price used to convert the rule's USD caps/amounts into SOL
// for execution — not live-fetched, but not a "fake balance" either. A
// real build would pull this from a price feed; this is a stand-in.
export const MOCK_SOL_PRICE = 148.32;

export const TIERS: { free: Tier; staked: Tier } = {
  free: {
    name: "Free",
    frequencyLabel: "Checks once a week",
    capUsd: 10,
    feeLabel: "Standard network fee",
  },
  staked: {
    name: "Staked",
    frequencyLabel: "Checks every day",
    capUsd: 50,
    feeLabel: "Fee rebate from staking pool",
  },
};
