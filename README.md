# Public Commitment Fund (MultiversX)

A standalone, no interdependencies, no-database dApp + smart contract for deadline-based public commitments on MultiversX.

## Isolation Guarantee

This project is intentionally isolated from other workspace projects.

- No imports or references to Tamagotchi files
- No shared node/rust workspaces
- No shared env files, wallet files, or deploy artifacts
- No symlinks between projects

## Project Layout

- `contract/` - MultiversX Rust smart contract, ABI, wasm, whitebox tests
- `frontend/` - Next.js dApp using `@multiversx/sdk-dapp`
- `scripts/` - deployment helper scripts

## Smart Contract Endpoints

- `create_commitment(title, recipient, deadline, cooldown_seconds_opt)` payable EGLD
- `submit_proof(id, proof_url)`
- `finalize(id)`
- `claim(id)`
- `cancel(id)`

### Views

- `get_commitment(id)`
- `get_total_ids()`
- `get_ids_page(start, limit)`
- `get_commitments_batch(ids...)`

## Contract Build & Test

Build ABI + WASM:

```bash
cd /Users/ls/Documents/MultiversX/public-commitment-fund/contract/meta
CARGO_NET_OFFLINE=true cargo run -- build
```

Run tests:

```bash
cd /Users/ls/Documents/MultiversX/public-commitment-fund/contract
CARGO_NET_OFFLINE=true cargo test --tests
```

## Devnet Deployment

1. Ensure contract was built and `contract/output/public-commitment-fund.wasm` exists.
2. Provide a deploy wallet PEM at `wallet.pem` in project root, or set `PEM_FILE`.
3. Run:

```bash
python3 /Users/ls/Documents/MultiversX/public-commitment-fund/scripts/deploy.py
```

Deploy output is written to `deploy.json` with `emittedTransactionHash` and `contractAddress`.

Latest devnet deploy (February 16, 2026):

- Contract: `erd1qqqqqqqqqqqqqpgqr7g7mtfzzqdzmfgnh204ncudsvyg9fqtpkkqzw9k54`
- Tx hash: `178acf0af558fb1e0da48a1064c7b43ac4cb79df9e9981e2e5b6779437a9ba7f`
- Explorer tx: `https://devnet-explorer.multiversx.com/transactions/178acf0af558fb1e0da48a1064c7b43ac4cb79df9e9981e2e5b6779437a9ba7f`

Shared deployment records are stored under:

- `/Users/ls/Documents/MultiversX/deployment/public-commitment-fund/devnet/`

## Frontend Run

```bash
cd /Users/ls/Documents/MultiversX/public-commitment-fund/frontend
npm ci
npm run dev
```

## Product Limitations

- Proof is a user-submitted public URL; contract stores URL + SHA-256 hash, but does not verify semantic truth.
- Automatic post-deadline behavior is permissionless, not bot-operated; someone must call `finalize`.
- Reads are fully onchain-driven via contract views; no indexing database is used.

## Security Notes

- Funds are escrowed in the contract and released only through onchain state transitions.
- Write actions are wallet-signed; there is no backend key custody.
- `claim()` is pull-based and protected by cooldown.
- Recipients cannot be changed after creation in this MVP design.

## Recipient Risk Disclaimer

If the recipient wallet is compromised, failed commitments may still be claimed by that compromised wallet.
Use a multisig or operational treasury address as recipient whenever possible.
