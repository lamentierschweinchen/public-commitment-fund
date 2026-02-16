import 'server-only';

import { ApiNetworkProvider } from '@multiversx/sdk-network-providers';
import { getContract, getResultsParser } from '@/lib/contract';
import { apiBaseUrl } from '@/config';
import { Commitment, CommitmentStatus } from '@/types';

function toNumber(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'bigint') return Number(value);
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  if (value && typeof value === 'object') {
    const candidate = value as { toFixed?: (dp?: number) => string; toString?: () => string };
    if (candidate.toFixed) {
      const parsed = Number(candidate.toFixed(0));
      return Number.isFinite(parsed) ? parsed : 0;
    }
    if (candidate.toString) {
      const parsed = Number(candidate.toString());
      return Number.isFinite(parsed) ? parsed : 0;
    }
  }

  return 0;
}

function toIntegerString(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return Math.trunc(value).toString();
  if (typeof value === 'bigint') return value.toString();

  if (value && typeof value === 'object') {
    const candidate = value as { toFixed?: (dp?: number) => string; toString?: () => string };
    if (candidate.toFixed) return candidate.toFixed(0);
    if (candidate.toString) return candidate.toString();
  }

  return '0';
}

function toAddress(value: unknown): string {
  if (value && typeof value === 'object') {
    const candidate = value as { bech32?: () => string; toString?: () => string };
    if (candidate.bech32) return candidate.bech32();
    if (candidate.toString) return candidate.toString();
  }
  if (typeof value === 'string') return value;
  return '';
}

function toUtf8(value: unknown): string {
  if (Buffer.isBuffer(value)) return value.toString('utf8');
  if (value instanceof Uint8Array) return Buffer.from(value).toString('utf8');
  if (typeof value === 'string') return value;
  return '';
}

function toHex(value: unknown): string {
  if (Buffer.isBuffer(value)) return value.toString('hex');
  if (value instanceof Uint8Array) return Buffer.from(value).toString('hex');
  if (typeof value === 'string') return value;
  return '';
}

interface ValueContainer {
  valueOf(): unknown;
}

interface QueryInteractionLike {
  buildQuery(): unknown;
}

type ContractMethods = Record<string, (args: unknown[]) => QueryInteractionLike>;

function parseCommitmentRaw(raw: Record<string, unknown>): Commitment {
  return {
    id: toNumber(raw.id),
    creator: toAddress(raw.creator),
    recipient: toAddress(raw.recipient),
    amount: toIntegerString(raw.amount),
    deadline: toNumber(raw.deadline),
    cooldownSeconds: toNumber(raw.cooldown_seconds),
    createdAt: toNumber(raw.created_at),
    status: toNumber(raw.status) as CommitmentStatus,
    title: toUtf8(raw.title),
    proofUrl: toUtf8(raw.proof_url),
    proofHash: toHex(raw.proof_hash),
    proofSubmittedAt: toNumber(raw.proof_submitted_at),
    finalizedAt: toNumber(raw.finalized_at),
  };
}

function parseCommitment(value: unknown): Commitment {
  const typedValue = value as ValueContainer;
  const raw = typedValue.valueOf() as Record<string, unknown>;
  return parseCommitmentRaw(raw);
}

async function queryValues(endpoint: string, args: unknown[]): Promise<unknown[]> {
  const provider = new ApiNetworkProvider(apiBaseUrl);
  const contract = getContract();
  const parser = getResultsParser();

  const interactionFactory = (contract.methods as unknown as ContractMethods)[endpoint];
  if (!interactionFactory) {
    throw new Error(`Unknown endpoint: ${endpoint}`);
  }

  const interaction = interactionFactory(args);
  const query = interaction.buildQuery();
  const queryResponse = await provider.queryContract(query as never);
  const parsed = parser.parseQueryResponse(queryResponse, contract.getEndpoint(endpoint));

  if (!parsed.returnCode.isSuccess()) {
    throw new Error(parsed.returnMessage || parsed.returnCode.toString());
  }

  return parsed.values;
}

async function getTotalIds(): Promise<number> {
  const values = await queryValues('get_total_ids', []);
  if (values.length === 0) return 0;
  const first = values[0] as ValueContainer;
  return toNumber(first.valueOf());
}

export async function getCommitmentById(id: number): Promise<Commitment> {
  const values = await queryValues('get_commitment', [id]);
  if (values.length === 0) {
    throw new Error('Commitment not found');
  }
  return parseCommitment(values[0]);
}

export async function getCommitmentIds(start: number, limit: number): Promise<number[]> {
  const values = await queryValues('get_ids_page', [start, limit]);
  if (values.length === 0) return [];

  // Variadic multi_result is wrapped in a single value whose valueOf() is the array
  const first = values[0] as ValueContainer;
  const inner = first.valueOf();

  if (Array.isArray(inner)) {
    return inner.map((item: unknown) => toNumber(item));
  }

  return [toNumber(inner)];
}

export async function getCommitmentsBatch(ids: number[]): Promise<Commitment[]> {
  if (ids.length === 0) return [];

  const values = await queryValues('get_commitments_batch', ids);
  if (values.length === 0) return [];

  // Variadic multi_result wraps the array in a single value
  const first = values[0] as ValueContainer;
  const inner = first.valueOf();

  if (Array.isArray(inner)) {
    return inner.map((item: unknown) => parseCommitmentRaw(item as Record<string, unknown>));
  }

  // Single item returned directly
  return [parseCommitment(values[0])];
}

export async function fetchAllCommitments(): Promise<Commitment[]> {
  const total = await getTotalIds();
  if (total <= 0) return [];

  const cappedTotal = Math.min(total, 5_000);
  const ids = await getCommitmentIds(0, cappedTotal);

  const result: Commitment[] = [];
  for (let i = 0; i < ids.length; i += 40) {
    const chunk = ids.slice(i, i + 40);
    const chunkItems = await getCommitmentsBatch(chunk);
    result.push(...chunkItems);
  }

  return result;
}
