"use client";

import { useState, useCallback } from "react";
import toast from "react-hot-toast";
import { USDC_CONTRACT_ID } from "./constants";

const STELLAR_NETWORK = "stellar:testnet";

export interface X402PaymentRequirement {
  scheme: string;
  network: string;
  asset: string;
  amount: string;
  payTo: string;
  maxTimeoutSeconds: number;
  extra?: Record<string, unknown>;
}

export interface X402PaymentReceipt {
  txHash: string;
  amount: string;
  recipient: string;
  timestamp: number;
  resource: string;
  network: string;
  scheme: string;
}

export interface X402PaymentState {
  isLoading: boolean;
  lastPayment: X402PaymentReceipt | null;
  paymentHistory: X402PaymentReceipt[];
  totalSpent: string;
  error: string | null;
}

export function useX402() {
  const [state, setState] = useState<X402PaymentState>({
    isLoading: false,
    lastPayment: null,
    paymentHistory: [],
    totalSpent: "0",
    error: null,
  });

  const makePayment = useCallback(
    async (
      requirement: X402PaymentRequirement,
      signTransaction: (xdr: string) => Promise<string>,
      userAddress: string
    ) => {
      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      try {
        if (Number(requirement.amount) <= 0) {
          throw new Error("Invalid payment amount");
        }

        toast.loading("Processing x402 payment...", { id: "x402-payment" });

        const usdcContractId = USDC_CONTRACT_ID;

        const response = await fetch("/api/x402/settle", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            paymentPayload: {
              x402Version: 2,
              resource: requirement.extra?.resource || "",
              accepted: requirement,
              payload: {
                operator: userAddress,
                timestamp: Date.now(),
                amount: requirement.amount,
                payTo: requirement.payTo,
                usdcContractId,
              },
            },
            paymentRequirements: requirement,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Payment settlement failed");
        }

        const result = await response.json();

        const receipt: X402PaymentReceipt = {
          txHash: result.txHash || "pending",
          amount: requirement.amount,
          recipient: requirement.payTo,
          timestamp: Date.now(),
          resource: (requirement.extra?.resource as string) || "",
          network: requirement.network,
          scheme: requirement.scheme,
        };

        setState((prev) => ({
          ...prev,
          isLoading: false,
          lastPayment: receipt,
          paymentHistory: [...prev.paymentHistory, receipt],
          totalSpent: (
            Number(prev.totalSpent) + Number(requirement.amount)
          ).toString(),
        }));

        toast.success("x402 payment successful!", { id: "x402-payment" });
        return receipt;
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : "Payment failed";
        setState((prev) => ({ ...prev, isLoading: false, error: msg }));
        toast.error(msg, { id: "x402-payment" });
        return null;
      }
    },
    []
  );

  const getPaymentRequirements = useCallback(
    (resource: string, price?: string): X402PaymentRequirement => {
      return {
        scheme: "exact",
        network: STELLAR_NETWORK,
        asset: "USDC",
        amount: price || "1000000",
        payTo: "",
        maxTimeoutSeconds: 30,
        extra: {
          resource,
          usdcContractId: USDC_CONTRACT_ID,
          stellarNetwork: "testnet",
        },
      };
    },
    []
  );

  const verifyPayment = useCallback(async (txHash: string) => {
    try {
      const response = await fetch("/api/x402/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ txHash }),
      });

      if (!response.ok) {
        throw new Error("Verification failed");
      }

      return await response.json();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Verification failed";
      toast.error(msg);
      return null;
    }
  }, []);

  const getStats = useCallback(async () => {
    try {
      const response = await fetch("/api/x402/stats");
      if (!response.ok) return null;
      return await response.json();
    } catch {
      return null;
    }
  }, []);

  return {
    ...state,
    makePayment,
    getPaymentRequirements,
    verifyPayment,
    getStats,
  };
}
