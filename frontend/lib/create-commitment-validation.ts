import { egldToWei } from './format';

const MIN_DEADLINE_BUFFER_SECONDS = 300;
const MAX_TITLE_BYTES = 64;

export interface CreateCommitmentValidationInput {
  title: string;
  amount: string;
  deadlineInput: string;
  recipient: string;
  useCustomCooldown: boolean;
  cooldownInput: string;
  nowSeconds?: number;
}

export interface ValidatedCreateCommitment {
  title: string;
  amountWei: string;
  deadline: number;
  recipient: string;
  cooldownSeconds?: number;
}

export function validateCreateCommitmentInput(
  input: CreateCommitmentValidationInput
): ValidatedCreateCommitment {
  const title = input.title.trim();
  const titleBytes = new TextEncoder().encode(title);
  if (titleBytes.length === 0 || titleBytes.length > MAX_TITLE_BYTES) {
    throw new Error('Title must be between 1 and 64 bytes.');
  }

  const deadlineMs = new Date(input.deadlineInput).getTime();
  if (!Number.isFinite(deadlineMs)) {
    throw new Error('Invalid deadline.');
  }

  const now = input.nowSeconds ?? Math.floor(Date.now() / 1000);
  const deadline = Math.floor(deadlineMs / 1000);
  if (deadline <= now + MIN_DEADLINE_BUFFER_SECONDS) {
    throw new Error('Deadline must be at least 5 minutes in the future.');
  }

  const recipient = input.recipient.trim();
  if (!recipient.startsWith('erd1')) {
    throw new Error('Recipient must be a valid MultiversX bech32 address.');
  }

  const amountWei = egldToWei(input.amount);
  if (BigInt(amountWei) <= 0n) {
    throw new Error('Amount must be greater than 0 EGLD.');
  }

  let cooldownSeconds: number | undefined;
  if (input.useCustomCooldown) {
    const parsed = Number(input.cooldownInput);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      throw new Error('Cooldown must be a positive number of seconds.');
    }
    cooldownSeconds = Math.trunc(parsed);
  }

  return {
    title,
    amountWei,
    deadline,
    recipient,
    cooldownSeconds,
  };
}
