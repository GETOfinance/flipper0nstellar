/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useCallback } from "react";
import toast from "react-hot-toast";

declare global {
  interface Window {
    freighter?: {
      isConnected: () => Promise<boolean>;
      getPublicKey: () => Promise<string>;
      signTransaction: (xdr: string, opts: { network: string }) => Promise<string>;
      getNetwork: () => Promise<string>;
    };
  }
}

export function useWallet() {
  const [address, setAddress] = useState<string | null>(null);
  const [network, setNetwork] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  const disconnect = useCallback(() => {
    setAddress(null);
    setNetwork(null);
    toast.success("Wallet disconnected");
  }, []);

  const connect = useCallback(async () => {
    if (typeof window === "undefined" || !window.freighter) {
      toast.error("Please install Freighter wallet extension");
      return;
    }

    setIsConnecting(true);
    try {
      const isConnected = await window.freighter.isConnected();
      if (!isConnected) {
        toast.error("Please unlock Freighter and connect");
        setIsConnecting(false);
        return;
      }

      const pubKey = await window.freighter.getPublicKey();
      const net = await window.freighter.getNetwork();

      setAddress(pubKey);
      setNetwork(net);

      toast.success(`Connected: ${pubKey.slice(0, 6)}...${pubKey.slice(-4)}`);
    } catch (error: any) {
      toast.error(error.message || "Failed to connect wallet");
    } finally {
      setIsConnecting(false);
    }
  }, []);

  const signTransaction = useCallback(async (xdr: string) => {
    if (!window.freighter) throw new Error("Freighter not installed");
    return window.freighter.signTransaction(xdr, {
      network: network || "Test SDF Network ; September 2015",
    });
  }, [network]);

  return {
    address,
    network,
    isConnecting,
    connect,
    disconnect,
    signTransaction,
    isConnected: !!address,
  };
}
