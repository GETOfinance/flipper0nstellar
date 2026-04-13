import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "react-hot-toast";

export const metadata: Metadata = {
  metadataBase: new URL("https://aegis-protocol-1.vercel.app"),
  title: "Flipper Protocol — AI-Powered DeFi Guardian on Stellar",
  description:
    "Autonomous AI agent that monitors your DeFi positions on Stellar 24/7, detects risks in real-time using multi-LLM reasoning + Stellar DEX verification, and executes protective on-chain transactions.",
  keywords: ["DeFi", "AI Agent", "Stellar", "Soroban", "USDC", "DeFi Guardian", "Autonomous Agent", "Smart Contract", "Risk Management"],
  authors: [{ name: "Flipper Protocol Team" }],
  openGraph: {
    title: "Flipper Protocol — AI-Powered DeFi Guardian",
    description: "Autonomous AI agent protecting your DeFi positions on Stellar 24/7. Multi-LLM reasoning + Stellar DEX verification + on-chain execution.",
    url: "https://aegis-protocol-1.vercel.app",
    siteName: "Flipper Protocol",
    type: "website",
    locale: "en_US",
    images: [{ url: "/og-image.svg", width: 1200, height: 630, alt: "Flipper Protocol — AI-Powered DeFi Guardian" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Flipper Protocol — AI-Powered DeFi Guardian",
    description: "Autonomous AI agent protecting your DeFi positions on Stellar 24/7. Multi-LLM reasoning + Stellar DEX verification.",
    images: ["/og-image.svg"],
  },
  icons: {
    icon: "/favicon.svg",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <head>
        <meta name="theme-color" content="#0a0e17" />
      </head>
      <body className="bg-[#0a0e17] text-white antialiased min-h-screen">
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: "#1a1f2e",
              color: "#e2e8f0",
              border: "1px solid rgba(0, 224, 255, 0.2)",
            },
          }}
        />
        {children}
      </body>
    </html>
  );
}
