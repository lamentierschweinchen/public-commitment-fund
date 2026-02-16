export enum CommitmentStatus {
  Active = 0,
  Completed = 1,
  Failed = 2,
  Refunded = 3,
  Claimed = 4,
}

export type CommitmentBucket = 'active' | 'completed' | 'failed';

export interface Commitment {
  id: number;
  creator: string;
  recipient: string;
  amount: string;
  deadline: number;
  cooldownSeconds: number;
  createdAt: number;
  status: CommitmentStatus;
  title: string;
  proofUrl: string;
  proofHash: string;
  proofSubmittedAt: number;
  finalizedAt: number;
}

export interface CommitmentListResponse {
  items: Commitment[];
  total: number;
  nextCursor: number | null;
  now: number;
}
