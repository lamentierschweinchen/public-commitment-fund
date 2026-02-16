# Public Commitment Fund Frontend

Standalone Next.js dApp for interacting with the Public Commitment Fund smart contract on MultiversX.

## Environment Variables

- `NEXT_PUBLIC_ENVIRONMENT=devnet|testnet|mainnet`
- `NEXT_PUBLIC_CONTRACT_ADDRESS=<deployed contract address>`
- `NEXT_PUBLIC_DAPP_NAME=<optional display name>`
- `NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID=<optional, recommended for WalletConnect/xPortal>`

## Run

```bash
npm ci
npm run dev
```

## Quality Checks

```bash
npm run lint
npm test
npm run build
```
