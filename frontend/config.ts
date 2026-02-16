export const contractAddress =
  process.env.NEXT_PUBLIC_CONTRACT_ADDRESS ||
  'erd1qqqqqqqqqqqqqpgqr7g7mtfzzqdzmfgnh204ncudsvyg9fqtpkkqzw9k54';

export const dAppName =
  process.env.NEXT_PUBLIC_DAPP_NAME || 'Public Commitment Fund';

export const walletConnectProjectId =
  process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID || '';

const allowedEnvironments = ['devnet', 'testnet', 'mainnet'] as const;
export type MvxEnvironment = (typeof allowedEnvironments)[number];

const requestedEnvironment =
  (process.env.NEXT_PUBLIC_ENVIRONMENT || 'devnet').toLowerCase();

export const environment: MvxEnvironment = allowedEnvironments.includes(
  requestedEnvironment as MvxEnvironment
)
  ? (requestedEnvironment as MvxEnvironment)
  : 'devnet';

export function getApiBaseUrl(env: MvxEnvironment): string {
  if (env === 'testnet') return 'https://testnet-api.multiversx.com';
  if (env === 'mainnet') return 'https://api.multiversx.com';
  return 'https://devnet-api.multiversx.com';
}

export function getExplorerBaseUrl(env: MvxEnvironment): string {
  if (env === 'testnet') return 'https://testnet-explorer.multiversx.com';
  if (env === 'mainnet') return 'https://explorer.multiversx.com';
  return 'https://devnet-explorer.multiversx.com';
}

export const apiBaseUrl = getApiBaseUrl(environment);
export const explorerBaseUrl = getExplorerBaseUrl(environment);
