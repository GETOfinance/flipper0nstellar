import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    schemes: [{ scheme: "exact", network: "stellar:testnet" }],
    version: 2,
    facilitator: "flipper-x402",
    supportedAssets: ["USDC"],
    stellarTestnet: true,
    usdcContractId:
      process.env.NEXT_PUBLIC_USDC_CONTRACT_ID ||
      "CCW67TSZV3NSI4FS7FXTA6D3KQAJ5VW6UJRV3GSB7Q6Y2I3AIA7F6GCH",
  });
}
