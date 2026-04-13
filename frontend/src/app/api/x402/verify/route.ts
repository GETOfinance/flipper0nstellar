import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { txHash } = body;

    if (!txHash) {
      return NextResponse.json(
        { error: "Missing txHash" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      isValid: true,
      txHash,
      status: "verified",
      timestamp: Date.now(),
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Verification failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
