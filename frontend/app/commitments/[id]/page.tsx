'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useGetAccountInfo } from '@multiversx/sdk-dapp/hooks/account/useGetAccountInfo';
import { useGetIsLoggedIn } from '@multiversx/sdk-dapp/hooks/account/useGetIsLoggedIn';
import { useGetNetworkConfig } from '@multiversx/sdk-dapp/hooks/useGetNetworkConfig';
import { sendTransactions } from '@multiversx/sdk-dapp/services';
import { refreshAccount } from '@multiversx/sdk-dapp/utils/account/refreshAccount';
import { WalletPanel } from '@/components/WalletPanel';
import { Countdown } from '@/components/Countdown';
import { StatusBadge } from '@/components/StatusBadge';
import { getCommitmentEligibility } from '@/lib/commitments';
import {
  buildCancelPayload,
  buildClaimPayload,
  DappTransactionPayload,
  buildFinalizePayload,
  buildSubmitProofPayload,
} from '@/lib/tx';
import { formatDateTime, shortAddress, weiToEgld } from '@/lib/format';
import { Commitment, CommitmentStatus } from '@/types';

interface DetailResponse {
  item: Commitment;
  now: number;
}

export default function CommitmentDetailPage() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);

  const isLoggedIn = useGetIsLoggedIn();
  const { address } = useGetAccountInfo();
  const { network } = useGetNetworkConfig();

  const [item, setItem] = useState<Commitment | null>(null);
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [proofUrl, setProofUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    if (!Number.isFinite(id) || id <= 0) {
      setError('Invalid commitment ID.');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/commitments/${id}`, { cache: 'no-store' });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || `Failed to fetch commitment (${response.status})`);
      }

      const data = (await response.json()) as DetailResponse;
      setItem(data.item);
      setNow(data.now || Math.floor(Date.now() / 1000));
      setProofUrl(data.item.proofUrl || '');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const eligibility = useMemo(() => {
    if (!item) {
      return {
        isCreator: false,
        isRecipient: false,
        canSubmitProof: false,
        canFinalize: false,
        canClaim: false,
        canCancel: false,
      };
    }

    return getCommitmentEligibility(item, address, now);
  }, [item, address, now]);

  const runAction = async (
    action: () => DappTransactionPayload,
    messages: { processing: string; success: string; error: string }
  ) => {
    if (!isLoggedIn || !address) {
      setError('Connect wallet first.');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      await refreshAccount();
      const payload = action();

      await sendTransactions({
        transactions: [payload],
        transactionsDisplayInfo: {
          processingMessage: messages.processing,
          successMessage: messages.success,
          errorMessage: messages.error,
        },
        redirectAfterSign: false,
      });

      setTimeout(() => {
        load();
      }, 8_000);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const onSubmitProof = async () => {
    if (!item) return;

    const trimmed = proofUrl.trim();
    if (trimmed.length === 0 || new TextEncoder().encode(trimmed).length > 512) {
      setError('Proof URL must be between 1 and 512 bytes.');
      return;
    }

    await runAction(
      () =>
        buildSubmitProofPayload({
          sender: address || '',
          chainId: network.chainId,
          id: item.id,
          proofUrl: trimmed,
        }),
      {
        processing: 'Submitting proof...',
        success: 'Proof submitted.',
        error: 'Proof submission failed.',
      }
    );
  };

  const onFinalize = async () => {
    if (!item) return;

    await runAction(
      () =>
        buildFinalizePayload({
          sender: address || '',
          chainId: network.chainId,
          id: item.id,
        }),
      {
        processing: 'Finalizing commitment...',
        success: 'Commitment finalized.',
        error: 'Finalize failed.',
      }
    );
  };

  const onClaim = async () => {
    if (!item) return;

    await runAction(
      () =>
        buildClaimPayload({
          sender: address || '',
          chainId: network.chainId,
          id: item.id,
        }),
      {
        processing: 'Claiming funds...',
        success: 'Funds claimed.',
        error: 'Claim failed.',
      }
    );
  };

  const onCancel = async () => {
    if (!item) return;

    await runAction(
      () =>
        buildCancelPayload({
          sender: address || '',
          chainId: network.chainId,
          id: item.id,
        }),
      {
        processing: 'Cancelling commitment...',
        success: 'Commitment cancelled.',
        error: 'Cancel failed.',
      }
    );
  };

  return (
    <main className="main-shell">
      <nav className="nav-bar">
        <Link href="/" className="nav-back">&larr; Home</Link>
      </nav>

      <section className="hero">
        <h1>Commitment Detail</h1>
        <p>Track progress, submit proof before deadline, and resolve after deadline.</p>
      </section>

      <WalletPanel />

      {loading ? <p className="empty-state">Loading commitment...</p> : null}
      {error ? <p className="text-error">{error}</p> : null}

      {item ? (
        <section className="detail-card">
          <div className="commitment-card__header">
            <h2>{item.title || `Commitment #${item.id}`}</h2>
            <StatusBadge status={item.status} />
          </div>

          <p className="commitment-card__amount">{weiToEgld(item.amount, 6)} EGLD</p>

          <div className="form-grid">
            <div>
              <span className="meta-label">Countdown</span>
              <strong>
                {item.status === CommitmentStatus.Active ? (
                  <Countdown deadline={item.deadline} />
                ) : (
                  'Closed'
                )}
              </strong>
            </div>
            <div>
              <span className="meta-label">Deadline</span>
              <strong>{formatDateTime(item.deadline)}</strong>
            </div>
            <div>
              <span className="meta-label">Recipient</span>
              <strong>{shortAddress(item.recipient)}</strong>
            </div>
            <div>
              <span className="meta-label">Cooldown</span>
              <strong>{item.cooldownSeconds}s</strong>
            </div>
            <div>
              <span className="meta-label">Created</span>
              <strong>{formatDateTime(item.createdAt)}</strong>
            </div>
            <div>
              <span className="meta-label">Finalized</span>
              <strong>{formatDateTime(item.finalizedAt)}</strong>
            </div>
          </div>

          <div>
            <span className="meta-label">Proof URL</span>
            {item.proofUrl ? (
              <p>
                <a href={item.proofUrl} target="_blank" rel="noreferrer">
                  {item.proofUrl}
                </a>
              </p>
            ) : (
              <p>Not submitted</p>
            )}
            {item.proofHash ? (
              <p>
                <span className="meta-label">Proof Hash</span>
                <code>{item.proofHash}</code>
              </p>
            ) : null}
          </div>

          <div className="actions-row">
            {eligibility.canFinalize ? (
              <button className="btn btn-secondary" disabled={submitting} onClick={onFinalize}>
                Finalize
              </button>
            ) : null}

            {eligibility.canClaim ? (
              <button className="btn" disabled={submitting} onClick={onClaim}>
                Claim Funds
              </button>
            ) : null}

            {eligibility.canCancel ? (
              <button className="btn btn-secondary" disabled={submitting} onClick={onCancel}>
                Cancel
              </button>
            ) : null}

            <button className="btn btn-secondary" onClick={load} disabled={submitting}>
              Refresh
            </button>
          </div>

          {eligibility.canSubmitProof ? (
            <div className="form-grid">
              <label>
                Submit proof URL
                <input
                  value={proofUrl}
                  onChange={(e) => setProofUrl(e.target.value)}
                  placeholder="https://..."
                />
              </label>
              <button className="btn" onClick={onSubmitProof} disabled={submitting}>
                Submit Proof
              </button>
            </div>
          ) : null}

          {!isLoggedIn ? (
            <p className="inline-note">Connect wallet to submit proof, finalize, claim, or cancel.</p>
          ) : null}

        </section>
      ) : null}
    </main>
  );
}
