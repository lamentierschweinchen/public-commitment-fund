import Link from 'next/link';
import { Commitment, CommitmentStatus } from '@/types';
import { Countdown } from '@/components/Countdown';
import { StatusBadge } from '@/components/StatusBadge';
import { shortAddress, weiToEgld, formatDateTime } from '@/lib/format';

export function CommitmentCard({ commitment }: { commitment: Commitment }) {
  const isActive = commitment.status === CommitmentStatus.Active;

  return (
    <article className="commitment-card">
      <div className="commitment-card__header">
        <h3>{commitment.title || `Commitment #${commitment.id}`}</h3>
        <StatusBadge status={commitment.status} />
      </div>

      <p className="commitment-card__amount">{weiToEgld(commitment.amount, 6)} EGLD</p>

      <div className="commitment-card__meta">
        <div>
          <span className="meta-label">Deadline</span>
          <strong>{formatDateTime(commitment.deadline)}</strong>
        </div>
        <div>
          <span className="meta-label">Recipient</span>
          <strong>{shortAddress(commitment.recipient)}</strong>
        </div>
      </div>

      <div className="commitment-card__footer">
        <div>
          <span className="meta-label">Timer</span>
          <strong>{isActive ? <Countdown deadline={commitment.deadline} /> : 'Closed'}</strong>
        </div>

        <Link className="btn btn-secondary" href={`/commitments/${commitment.id}`}>
          View
        </Link>
      </div>
    </article>
  );
}
