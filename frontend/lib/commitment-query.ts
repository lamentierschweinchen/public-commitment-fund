import { Commitment, CommitmentBucket } from '../types';
import { commitmentBucket, sortCommitments } from './commitments';

export interface CommitmentQueryInput {
  status: CommitmentBucket | 'all';
  mine?: string;
  cursor: number;
  limit: number;
}

export interface CommitmentQueryOutput {
  items: Commitment[];
  total: number;
  nextCursor: number | null;
}

export function queryCommitments(
  commitments: Commitment[],
  input: CommitmentQueryInput
): CommitmentQueryOutput {
  const mine = (input.mine || '').trim();

  const filtered = commitments.filter((item) => {
    if (input.status !== 'all' && commitmentBucket(item.status) !== input.status) {
      return false;
    }

    if (mine.length > 0) {
      return item.creator === mine || item.recipient === mine;
    }

    return true;
  });

  const sorted = sortCommitments(filtered, input.status);
  const items = sorted.slice(input.cursor, input.cursor + input.limit);
  const nextCursor = input.cursor + input.limit < sorted.length ? input.cursor + input.limit : null;

  return {
    items,
    total: sorted.length,
    nextCursor,
  };
}
