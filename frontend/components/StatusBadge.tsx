import { CommitmentStatus } from '@/types';

const STATUS_LABELS: Record<CommitmentStatus, string> = {
  [CommitmentStatus.Active]: 'Active',
  [CommitmentStatus.Completed]: 'Completed',
  [CommitmentStatus.Failed]: 'Failed',
  [CommitmentStatus.Refunded]: 'Refunded',
  [CommitmentStatus.Claimed]: 'Claimed',
};

const STATUS_CLASSES: Record<CommitmentStatus, string> = {
  [CommitmentStatus.Active]: 'badge badge-active',
  [CommitmentStatus.Completed]: 'badge badge-completed',
  [CommitmentStatus.Failed]: 'badge badge-failed',
  [CommitmentStatus.Refunded]: 'badge badge-refunded',
  [CommitmentStatus.Claimed]: 'badge badge-claimed',
};

export function StatusBadge({ status }: { status: CommitmentStatus }) {
  return <span className={STATUS_CLASSES[status]}>{STATUS_LABELS[status]}</span>;
}
