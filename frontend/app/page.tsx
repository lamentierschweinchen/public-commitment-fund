'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useGetAccountInfo } from '@multiversx/sdk-dapp/hooks/account/useGetAccountInfo';
import { useGetIsLoggedIn } from '@multiversx/sdk-dapp/hooks/account/useGetIsLoggedIn';
import { WalletPanel } from '@/components/WalletPanel';
import { CommitmentCard } from '@/components/CommitmentCard';
import { Commitment, CommitmentListResponse } from '@/types';

interface BoardState {
  active: Commitment[];
  completed: Commitment[];
  failed: Commitment[];
}

const EMPTY_STATE: BoardState = {
  active: [],
  completed: [],
  failed: [],
};

export default function HomePage() {
  const isLoggedIn = useGetIsLoggedIn();
  const { address } = useGetAccountInfo();
  const [board, setBoard] = useState<BoardState>(EMPTY_STATE);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mineOnly, setMineOnly] = useState(false);

  const mineParam = useMemo(() => {
    if (!mineOnly || !address) return '';
    return `&mine=${encodeURIComponent(address)}`;
  }, [mineOnly, address]);

  const fetchBoard = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [activeRes, completedRes, failedRes] = await Promise.all([
        fetch(`/api/commitments?status=active&limit=30${mineParam}`, { cache: 'no-store' }),
        fetch(`/api/commitments?status=completed&limit=30${mineParam}`, { cache: 'no-store' }),
        fetch(`/api/commitments?status=failed&limit=30${mineParam}`, { cache: 'no-store' }),
      ]);

      if (!activeRes.ok || !completedRes.ok || !failedRes.ok) {
        throw new Error('Failed to fetch commitments from API');
      }

      const [activeJson, completedJson, failedJson] =
        (await Promise.all([
          activeRes.json(),
          completedRes.json(),
          failedRes.json(),
        ])) as CommitmentListResponse[];

      setBoard({
        active: activeJson.items,
        completed: completedJson.items,
        failed: failedJson.items,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [mineParam]);

  useEffect(() => {
    fetchBoard();
  }, [fetchBoard]);

  return (
    <main className="main-shell">
      <section className="hero">
        <h1>Public Commitment Fund</h1>
        <p>
          Lock EGLD behind a deadline. Succeed with proof and refund yourself, or fail and let the
          recipient claim after cooldown.
        </p>
      </section>

      <section className="toolbar">
        <WalletPanel />
        <div className="actions-row">
          <button
            className="btn btn-secondary"
            disabled={!isLoggedIn}
            onClick={() => setMineOnly((value) => !value)}
          >
            {mineOnly ? 'Showing: My Commitments' : 'Show My Commitments'}
          </button>
          <button className="btn btn-secondary" onClick={fetchBoard}>Refresh</button>
          <Link className="btn" href="/commitments/new">
            Create Commitment
          </Link>
        </div>
      </section>

      {!isLoggedIn ? (
        <p className="inline-note">Connect wallet to create or manage commitments.</p>
      ) : null}

      {error ? <p className="text-error">{error}</p> : null}

      {loading ? <p className="empty-state">Loading commitments...</p> : null}

      {!loading ? (
        <div className="sections">
          <section className="section">
            <h2>Active ({board.active.length})</h2>
            {board.active.length === 0 ? (
              <p className="empty-state">No active commitments yet.</p>
            ) : (
              <div className="section-grid">
                {board.active.map((commitment) => (
                  <CommitmentCard key={commitment.id} commitment={commitment} />
                ))}
              </div>
            )}
          </section>

          <section className="section">
            <h2>Completed / Refunded ({board.completed.length})</h2>
            {board.completed.length === 0 ? (
              <p className="empty-state">No completed commitments yet.</p>
            ) : (
              <div className="section-grid">
                {board.completed.map((commitment) => (
                  <CommitmentCard key={commitment.id} commitment={commitment} />
                ))}
              </div>
            )}
          </section>

          <section className="section">
            <h2>Failed / Claimed ({board.failed.length})</h2>
            {board.failed.length === 0 ? (
              <p className="empty-state">No failed commitments yet.</p>
            ) : (
              <div className="section-grid">
                {board.failed.map((commitment) => (
                  <CommitmentCard key={commitment.id} commitment={commitment} />
                ))}
              </div>
            )}
          </section>
        </div>
      ) : null}
    </main>
  );
}
