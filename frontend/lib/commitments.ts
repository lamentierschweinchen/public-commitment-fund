import {
  Commitment,
  CommitmentBucket,
  CommitmentStatus,
} from '../types';

export function commitmentBucket(status: CommitmentStatus): CommitmentBucket {
  if (status === CommitmentStatus.Active) return 'active';
  if (status === CommitmentStatus.Completed || status === CommitmentStatus.Refunded) {
    return 'completed';
  }
  return 'failed';
}

export function sortCommitments(
  commitments: Commitment[],
  scope: CommitmentBucket | 'all'
): Commitment[] {
  const sorted = [...commitments];

  if (scope === 'active') {
    sorted.sort((a, b) => {
      if (a.deadline !== b.deadline) return a.deadline - b.deadline;
      return b.createdAt - a.createdAt;
    });
    return sorted;
  }

  if (scope === 'completed' || scope === 'failed') {
    sorted.sort((a, b) => {
      const aTime = a.finalizedAt || a.createdAt;
      const bTime = b.finalizedAt || b.createdAt;
      if (aTime !== bTime) return bTime - aTime;
      return b.id - a.id;
    });
    return sorted;
  }

  sorted.sort((a, b) => {
    if (a.createdAt !== b.createdAt) return b.createdAt - a.createdAt;
    return b.id - a.id;
  });
  return sorted;
}

export interface CommitmentEligibility {
  isCreator: boolean;
  isRecipient: boolean;
  canSubmitProof: boolean;
  canFinalize: boolean;
  canClaim: boolean;
  canCancel: boolean;
}

export function getCommitmentEligibility(
  commitment: Commitment,
  viewerAddress: string | undefined,
  now: number
): CommitmentEligibility {
  const normalizedViewer = (viewerAddress || '').trim();
  const isCreator = normalizedViewer.length > 0 && normalizedViewer === commitment.creator;
  const isRecipient = normalizedViewer.length > 0 && normalizedViewer === commitment.recipient;

  const isActive = commitment.status === CommitmentStatus.Active;
  const isCompleted = commitment.status === CommitmentStatus.Completed;
  const isFailed = commitment.status === CommitmentStatus.Failed;

  const canSubmitProof = isCreator && isActive && now <= commitment.deadline;
  const canFinalize = (isActive || isCompleted) && now > commitment.deadline;
  const canClaim =
    isRecipient &&
    isFailed &&
    commitment.finalizedAt > 0 &&
    now >= (commitment.finalizedAt + commitment.cooldownSeconds);
  const canCancel = isCreator && isActive && now < commitment.deadline;

  return {
    isCreator,
    isRecipient,
    canSubmitProof,
    canFinalize,
    canClaim,
    canCancel,
  };
}
