import {
  Keypair,
  rpc,
} from "@stellar/stellar-sdk";

export interface X402FacilitatorConfig {
  stellarRpcUrl: string;
  networkPassphrase: string;
  usdcContractId: string;
  paymentContractId: string;
  operatorSecretKey: string;
}

export interface VerificationRequest {
  paymentPayload: {
    x402Version: number;
    resource: string;
    accepted: {
      scheme: string;
      network: string;
      asset: string;
      amount: string;
      payTo: string;
      maxTimeoutSeconds: number;
      extra?: Record<string, unknown>;
    };
    payload: {
      signature: string;
      operator: string;
      timestamp: number;
      txHash: string;
    };
  };
  paymentRequirements: {
    scheme: string;
    network: string;
    asset: string;
    amount: string;
    payTo: string;
    maxTimeoutSeconds: number;
  };
}

export interface VerificationResponse {
  isValid: boolean;
  error?: string;
  txDetails?: {
    txHash: string;
    status: string;
    ledger: number;
  };
}

export interface SettlementRequest {
  paymentPayload: VerificationRequest["paymentPayload"];
  paymentRequirements: VerificationRequest["paymentRequirements"];
}

export interface SettlementResponse {
  success: boolean;
  txHash?: string;
  error?: string;
  network: string;
  scheme: string;
}

const STELLAR_NETWORK = "stellar:testnet";

export class X402Facilitator {
  private config: X402FacilitatorConfig;
  private server: rpc.Server;
  private keypair: Keypair;
  private verifiedPayments: Map<string, VerificationResponse> = new Map();
  private settledPayments: Map<string, SettlementResponse> = new Map();

  constructor(config: X402FacilitatorConfig) {
    this.config = config;
    this.server = new rpc.Server(config.stellarRpcUrl);
    this.keypair = Keypair.fromSecret(config.operatorSecretKey);
    console.log("[x402 Facilitator] Initialized on Stellar");
    console.log(`  Operator: ${this.keypair.publicKey()}`);
    console.log(`  USDC Contract: ${config.usdcContractId}`);
  }

  async verify(request: VerificationRequest): Promise<VerificationResponse> {
    const { paymentPayload, paymentRequirements } = request;

    if (paymentPayload.x402Version !== 2) {
      return { isValid: false, error: "Unsupported x402 version" };
    }

    if (paymentRequirements.network !== STELLAR_NETWORK) {
      return {
        isValid: false,
        error: `Unsupported network: ${paymentRequirements.network}`,
      };
    }

    if (paymentRequirements.scheme !== "exact") {
      return {
        isValid: false,
        error: `Unsupported scheme: ${paymentRequirements.scheme}`,
      };
    }

    const { payload } = paymentPayload;
    if (!payload.txHash) {
      return { isValid: false, error: "Missing transaction hash" };
    }

    if (!payload.operator) {
      return { isValid: false, error: "Missing operator address" };
    }

    const txHash = payload.txHash;
    const cached = this.verifiedPayments.get(txHash);
    if (cached) {
      return cached;
    }

    try {
      const txResponse = await this.server.getTransaction(txHash);

      if (txResponse.status === "NOT_FOUND") {
        const result: VerificationResponse = {
          isValid: false,
          error: "Transaction not found on-chain",
        };
        this.verifiedPayments.set(txHash, result);
        return result;
      }

      if (txResponse.status !== "SUCCESS") {
        const result: VerificationResponse = {
          isValid: false,
          error: `Transaction failed with status: ${txResponse.status}`,
        };
        this.verifiedPayments.set(txHash, result);
        return result;
      }

      const timestampDiff = Math.abs(Date.now() - payload.timestamp);
      const maxTimeoutMs =
        (paymentRequirements.maxTimeoutSeconds || 30) * 1000;
      if (timestampDiff > maxTimeoutMs) {
        const result: VerificationResponse = {
          isValid: false,
          error: "Payment timestamp exceeded max timeout",
        };
        this.verifiedPayments.set(txHash, result);
        return result;
      }

      const result: VerificationResponse = {
        isValid: true,
        txDetails: {
          txHash,
          status: txResponse.status,
          ledger: txResponse.ledger || 0,
        },
      };

      this.verifiedPayments.set(txHash, result);
      console.log(`[x402 Facilitator] Payment verified: ${txHash}`);
      return result;
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error(`[x402 Facilitator] Verification error: ${msg}`);
      return { isValid: false, error: msg };
    }
  }

  async settle(request: SettlementRequest): Promise<SettlementResponse> {
    const { paymentPayload, paymentRequirements } = request;
    const txHash = paymentPayload.payload.txHash;

    const cached = this.settledPayments.get(txHash);
    if (cached) {
      return cached;
    }

    const verification = await this.verify({
      paymentPayload,
      paymentRequirements,
    });

    if (!verification.isValid) {
      return {
        success: false,
        error: verification.error || "Verification failed",
        network: paymentRequirements.network,
        scheme: paymentRequirements.scheme,
      };
    }

    const result: SettlementResponse = {
      success: true,
      txHash,
      network: paymentRequirements.network,
      scheme: paymentRequirements.scheme,
    };

    this.settledPayments.set(txHash, result);
    console.log(`[x402 Facilitator] Payment settled: ${txHash}`);
    return result;
  }

  getSupportedSchemes(): { scheme: string; network: string }[] {
    return [
      { scheme: "exact", network: STELLAR_NETWORK },
    ];
  }

  getStats(): {
    totalVerified: number;
    totalSettled: number;
    operatorAddress: string;
  } {
    return {
      totalVerified: this.verifiedPayments.size,
      totalSettled: this.settledPayments.size,
      operatorAddress: this.keypair.publicKey(),
    };
  }
}
