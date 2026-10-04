# Pocket

An autonomous AI agent for Solana Mobile. You set a rule once ("buy $10 of
SOL every week"), fund it with a capped amount, and it acts on a real
Android background schedule — signing and sending transactions entirely on
its own, with no further approval. Built for the Solana Mobile CLOCK IN
hackathon.

**Note on swap direction:** the live demo swaps SOL → USDC (the agent already
holds SOL from funding, so this is the simplest real trade to show without
an extra funding step). Reversing it to SOL-purchases is a one-line change
in `executeAgentAction` once the agent also holds a starting USDC balance.

**What's real, not simulated:**

- Mobile Wallet Adapter for the one-time wallet connection
- A separate, delegated agent key (encrypted via Android Keystore) that
  signs autonomously after being funded once
- A real Android background task (`expo-background-task`) that checks in
  and acts without the app open
- A real SOL → USDC swap through live Jupiter liquidity on mainnet
- SKR-gated tiers, checked against the wallet's real on-chain SKR balance
  on every run — not a locally stored flag
- A kill switch that safely returns funds before revoking the agent's key
- An AI layer (Google Gemini, via a backend proxy) that turns a plain-English
  description into a structured rule, shown back for review before it's
  ever applied

## ⚠️ Important: this cannot run in Expo Go

This app uses native modules (Mobile Wallet Adapter, Secure Store,
background tasks) that **Expo Go does not support**. `npx expo start` will
boot Metro, but you need a custom development client or the prebuilt APK
to actually run the app on a device.

**The fastest way to see it working is the prebuilt APK** — see Releases /
the link provided with this submission. The steps below are for running
from source.

## Prerequisites

- Node.js 18+
- An Android device or emulator with a Mobile Wallet Adapter–compatible
  wallet installed (Phantom, Solflare, or Jupiter Mobile)
- An [Expo EAS](https://expo.dev) account (free) for building a dev client
- A free [Jupiter API key](https://portal.jup.ag/api-keys) (Basic plan, 1 req/sec)

## Setup

```bash
git clone <this-repo-url>
cd pocket
npm install
cp .env.example .env
# then edit .env and paste your real Jupiter API key
```

## Running from source

```bash
eas build --profile development --platform android
```

Install the resulting APK on your device, then:

```bash
npx expo start --dev-client
```

Scan the QR code or connect manually from the installed dev client.

## Building a standalone (no-dev-server) APK

```bash
eas build --profile preview --platform android
```

This produces a real, installable APK that doesn't depend on Metro or your
computer at all — this is what a judge should install to test the app.

## Network: devnet vs mainnet

`src/services/wallet.ts` exports a single `NETWORK` constant
(`"devnet" | "mainnet-beta"`). The submitted build is configured for
**mainnet** — every transaction described above (fund, autonomous swap,
return funds) is real. Set it to `"devnet"` for safe, free-money testing
while developing.

## The AI proxy

The AI rule-structuring feature calls a small serverless function (holding
the Gemini API key server-side, never shipped to the device) — source is
included at [`/pocket-ai-proxy`](./pocket-ai-proxy). It's already deployed
and live at the URL the app calls (`src/services/ai.ts`); the included
source is for transparency, not something you need to redeploy to see the
app work. If you do want to redeploy your own copy: `cd pocket-ai-proxy`,
set a `GEMINI_API_KEY` environment variable in Vercel, then `vercel --prod`.

## Tech stack

Expo Router · React Native · TypeScript · NativeWind · Solana Mobile Stack
(Mobile Wallet Adapter) · @solana/web3.js · Jupiter Swap API v2 · Google
Gemini · expo-secure-store · expo-background-task
