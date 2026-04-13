"use client";

import { USDC_CONTRACT_ID } from "./constants";

export const SAC_INTERFACE = {
  name: "Stellar Asset Contract (USDC)",
  contractId: USDC_CONTRACT_ID,
  decimals: 7,
  symbol: "USDC",
};

export function parseUSDC(amount: string): bigint {
  return BigInt(Math.floor(parseFloat(amount || "0") * 1e7));
}

export function formatUSDC(amount: bigint): string {
  return (Number(amount) / 1e7).toFixed(7);
}

export function getUSDCContractId(): string {
  return USDC_CONTRACT_ID;
}
