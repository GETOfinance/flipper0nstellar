import {
  Keypair,
  rpc,
  TransactionBuilder,
  Operation,
  nativeToScVal,
} from "@stellar/stellar-sdk";

export interface X402GatewayConfig {
  stellarRpcUrl: string;
  networkPassphrase: string;
  secretKey: string;
  usdcContractId: string;
  paymentContractId: string;
  facilitatorUrl: string;
  payeeAddress: string;
  defaultPrice: string;
  maxPricePerRequest: string;
}

export interface PaymentReceipt {
  txHash: string;
  amount: string;
  recipient: string;
  timestamp: number;
  resource: string;
  network: string;
  scheme: string;
}

export interface X402PaymentResult {
  success: boolean;
  receipt?: PaymentReceipt;
  error?: string;
  settlementResponse?: Record<string, unknown>;
}

export interface PaymentRequirements {
  scheme: string;
  network: string;
  asset: string;
  amount: string;
  payTo: string;
  maxTimeoutSeconds: number;
  extra?: Record<string, unknown>;
}

const STELLAR_NETWORK = "stellar:testnet";
const X402_SCHEME = "exact";

export class X402Gateway {
  private config: X402GatewayConfig;
  private keypair: Keypair;
  private server: rpc.Server;
  private paymentHistory: PaymentReceipt[] = [];
  private totalSpent: bigint = 0n;

  constructor(config: X402GatewayConfig) {
    this.config = config;
    this.keypair = Keypair.fromSecret(config.secretKey);
    this.server = new rpc.Server(config.stellarRpcUrl);
  }

  async makePaidRequest(
    url: string,
    options?: RequestInit
  ): Promise<{ response: Response; paymentResult?: X402PaymentResult }> {
    try {
      const response = await fetch(url, options);

      if (response.status === 402) {
        const paymentRequiredHeader = response.headers.get("PAYMENT-REQUIRED");
        if (paymentRequiredHeader) {
          const paymentRequired = JSON.parse(
            Buffer.from(paymentRequiredHeader, "base64").toString()
          );

          const requirements: PaymentRequirements =
            paymentRequired.accepts?.[0] || paymentRequired;

          console.log(
            `[x402 Gateway] Payment required for ${url}: scheme=${requirements.scheme} network=${requirements.network} amount=${requirements.amount}`
          );

          const validation = this.verifyPaymentRequirements(requirements);
          if (!validation.valid) {
            return {
              response,
              paymentResult: {
                success: false,
                error: validation.error,
              },
            };
          }

          const paymentResult = await this.executeStellarPayment(
            requirements,
            url
          );

          if (paymentResult.success && paymentResult.receipt) {
            const paymentSignature = this.encodePaymentSignature(
              paymentResult,
              requirements
            );

            const retryResponse = await fetch(url, {
              ...options,
              headers: {
                ...(options?.headers as Record<string, string>),
                "PAYMENT-SIGNATURE": paymentSignature,
              },
            });

            return { response: retryResponse, paymentResult };
          }

          return { response, paymentResult };
        }
      }

      return { response };
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error(`[x402 Gateway] Paid request failed: ${msg}`);
      return {
        response: new Response(null, { status: 500, statusText: msg }),
        paymentResult: { success: false, error: msg },
      };
    }
  }

  async executeStellarPayment(
    requirements: PaymentRequirements,
    resource: string
  ): Promise<X402PaymentResult> {
    const amount = BigInt(requirements.amount);
    const maxPrice = BigInt(this.config.maxPricePerRequest);

    if (amount > maxPrice) {
      return {
        success: false,
        error: `Amount ${requirements.amount} exceeds max price ${this.config.maxPricePerRequest}`,
      };
    }

    console.log(
      `[x402 Gateway] Executing Stellar USDC payment: ${requirements.amount} units to ${requirements.payTo}`
    );

    try {
      const account = await this.server.getAccount(this.keypair.publicKey());

      const tx = new TransactionBuilder(account, {
        fee: "100",
        networkPassphrase: this.config.networkPassphrase,
      })
        .addOperation(
          Operation.invokeContractFunction({
            contract: this.config.usdcContractId,
            function: "transfer",
            args: [
              nativeToScVal(this.keypair.publicKey(), { type: "address" }),
              nativeToScVal(requirements.payTo, { type: "address" }),
              nativeToScVal(amount, { type: "i128" }),
            ],
          })
        )
        .setTimeout(requirements.maxTimeoutSeconds || 30)
        .build();

      const prepared = await this.server.prepareTransaction(tx);
      prepared.sign(this.keypair);

      const result = await this.server.sendTransaction(prepared);

      if (result.status === "PENDING" || result.status === "DUPLICATE") {
        const receipt: PaymentReceipt = {
          txHash: result.hash,
          amount: requirements.amount,
          recipient: requirements.payTo,
          timestamp: Date.now(),
          resource,
          network: requirements.network,
          scheme: requirements.scheme,
        };

        this.paymentHistory.push(receipt);
        this.totalSpent += amount;

        console.log(`[x402 Gateway] Payment settled: ${result.hash}`);

        return {
          success: true,
          receipt,
          settlementResponse: {
            txHash: result.hash,
            network: requirements.network,
            scheme: requirements.scheme,
          },
        };
      }

      return {
        success: false,
        error: `Transaction status: ${result.status}`,
      };
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error(`[x402 Gateway] Payment failed: ${msg}`);
      return { success: false, error: msg };
    }
  }

  async verifySettlement(
    txHash: string
  ): Promise<{ verified: boolean; details?: Record<string, unknown> }> {
    try {
      const txResponse = await this.server.getTransaction(txHash);

      if (txResponse.status === "NOT_FOUND") {
        return { verified: false };
      }

      return {
        verified: true,
        details: {
          status: txResponse.status,
          ledger: txResponse.ledger,
          createdAt: txResponse.createdAt,
          applicationOrder: txResponse.applicationOrder,
        },
      };
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error(`[x402 Gateway] Verification failed: ${msg}`);
      return { verified: false };
    }
  }

  private encodePaymentSignature(
    result: X402PaymentResult,
    requirements: PaymentRequirements
  ): string {
    const payload = {
      x402Version: 2,
      resource: result.receipt?.resource || "",
      accepted: {
        scheme: requirements.scheme,
        network: requirements.network,
        asset: requirements.asset,
        amount: requirements.amount,
        payTo: requirements.payTo,
        maxTimeoutSeconds: requirements.maxTimeoutSeconds,
        extra: requirements.extra || {},
      },
      payload: {
        signature: result.receipt?.txHash || "",
        operator: this.keypair.publicKey(),
        timestamp: result.receipt?.timestamp || Date.now(),
        txHash: result.receipt?.txHash,
      },
    };
    return Buffer.from(JSON.stringify(payload)).toString("base64");
  }

  getPaymentRequirements(
    resource: string,
    price?: string
  ): PaymentRequirements {
    return {
      scheme: X402_SCHEME,
      network: STELLAR_NETWORK,
      asset: "USDC",
      amount: price || this.config.defaultPrice,
      payTo: this.config.payeeAddress,
      maxTimeoutSeconds: 30,
      extra: {
        resource,
        usdcContractId: this.config.usdcContractId,
        stellarNetwork: "testnet",
      },
    };
  }

  verifyPaymentRequirements(requirements: PaymentRequirements): {
    valid: boolean;
    error?: string;
  } {
    const amount = BigInt(requirements.amount);
    const maxPrice = BigInt(this.config.maxPricePerRequest);

    if (amount > maxPrice) {
      return { valid: false, error: "Amount exceeds maximum allowed price" };
    }

    if (requirements.network !== STELLAR_NETWORK) {
      return {
        valid: false,
        error: `Unsupported network: ${requirements.network}`,
      };
    }

    if (requirements.scheme !== X402_SCHEME) {
      return {
        valid: false,
        error: `Unsupported scheme: ${requirements.scheme}`,
      };
    }

    return { valid: true };
  }

  getPaymentHistory(): PaymentReceipt[] {
    return [...this.paymentHistory];
  }

  getTotalSpent(): bigint {
    return this.totalSpent;
  }

  getOperatorAddress(): string {
    return this.keypair.publicKey();
  }

  getStats(): {
    totalPayments: number;
    totalSpent: string;
    lastPayment: PaymentReceipt | null;
  } {
    return {
      totalPayments: this.paymentHistory.length,
      totalSpent: this.totalSpent.toString(),
      lastPayment:
        this.paymentHistory.length > 0
          ? this.paymentHistory[this.paymentHistory.length - 1]
          : null,
    };
  }
}
