import { NextRequest, NextResponse } from "next/server";

const STELLAR_NETWORK = "stellar:testnet";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { paymentPayload, paymentRequirements } = body;

    if (!paymentPayload || !paymentRequirements) {
      return NextResponse.json(
        { error: "Missing paymentPayload or paymentRequirements" },
        { status: 400 }
      );
    }

    if (paymentRequirements.network !== STELLAR_NETWORK) {
      return NextResponse.json(
        { error: `Unsupported network: ${paymentRequirements.network}` },
        { status: 400 }
      );
    }

    if (paymentRequirements.scheme !== "exact") {
      return NextResponse.json(
        { error: `Unsupported scheme: ${paymentRequirements.scheme}` },
        { status: 400 }
      );
    }

    const payload = paymentPayload.payload;
    if (!payload || !payload.operator) {
      return NextResponse.json(
        { error: "Invalid payment payload" },
        { status: 400 }
      );
    }

    const timestampDiff = Math.abs(Date.now() - (payload.timestamp || 0));
    const maxTimeoutMs = (paymentRequirements.maxTimeoutSeconds || 30) * 1000;
    if (timestampDiff > maxTimeoutMs) {
      return NextResponse.json(
        { error: "Payment expired" },
        { status: 400 }
      );
    }

    const mockTxHash = payload.txHash || `x402_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

    return NextResponse.json({
      success: true,
      txHash: mockTxHash,
      network: paymentRequirements.network,
      scheme: paymentRequirements.scheme,
      amount: paymentRequirements.amount,
      payTo: paymentRequirements.payTo,
      operator: payload.operator,
      timestamp: Date.now(),
      verified: true,
      settled: true,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Settlement failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
