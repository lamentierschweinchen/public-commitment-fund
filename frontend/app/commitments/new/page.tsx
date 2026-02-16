'use client';

import Link from 'next/link';
import { FormEvent, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useGetAccountInfo } from '@multiversx/sdk-dapp/hooks/account/useGetAccountInfo';
import { useGetIsLoggedIn } from '@multiversx/sdk-dapp/hooks/account/useGetIsLoggedIn';
import { useGetNetworkConfig } from '@multiversx/sdk-dapp/hooks/useGetNetworkConfig';
import { sendTransactions } from '@multiversx/sdk-dapp/services';
import { refreshAccount } from '@multiversx/sdk-dapp/utils/account/refreshAccount';
import { WalletPanel } from '@/components/WalletPanel';
import { validateCreateCommitmentInput } from '@/lib/create-commitment-validation';
import { buildCreateCommitmentPayload } from '@/lib/tx';

const DEFAULT_COOLDOWN = 86_400;

function nowPlus10MinutesISO(): string {
  const next = new Date(Date.now() + 10 * 60 * 1000);
  const offset = next.getTimezoneOffset() * 60_000;
  const local = new Date(next.getTime() - offset);
  return local.toISOString().slice(0, 16);
}

export default function CreateCommitmentPage() {
  const router = useRouter();
  const isLoggedIn = useGetIsLoggedIn();
  const { address } = useGetAccountInfo();
  const { network } = useGetNetworkConfig();

  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('0.1');
  const [deadlineInput, setDeadlineInput] = useState(nowPlus10MinutesISO());
  const [recipient, setRecipient] = useState('');
  const [useCustomCooldown, setUseCustomCooldown] = useState(false);
  const [cooldown, setCooldown] = useState(String(DEFAULT_COOLDOWN));
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const warningText = useMemo(() => {
    const displayAmount = amount.trim() || '0';
    const displayRecipient = recipient.trim() || '[recipient]';
    return `If you fail, ${displayAmount} EGLD goes to ${displayRecipient}.`;
  }, [amount, recipient]);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!isLoggedIn || !address) {
      setError('Connect wallet first.');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      const validated = validateCreateCommitmentInput({
        title,
        amount,
        deadlineInput,
        recipient,
        useCustomCooldown,
        cooldownInput: cooldown,
      });

      await refreshAccount();

      const payload = buildCreateCommitmentPayload({
        sender: address,
        chainId: network.chainId,
        title: validated.title,
        recipient: validated.recipient,
        deadline: validated.deadline,
        amountWei: validated.amountWei,
        cooldownSeconds: validated.cooldownSeconds,
      });

      const { error: txError, sessionId } = await sendTransactions({
        transactions: [payload],
        transactionsDisplayInfo: {
          processingMessage: 'Creating commitment...',
          errorMessage: 'Failed to create commitment.',
          successMessage: 'Commitment created successfully.',
        },
        redirectAfterSign: false,
      });

      if (txError) {
        setError(txError);
        return;
      }

      if (sessionId) {
        // Redirect to home — the toast will show progress.
        // Don't guess the ID; let the user see it appear after confirmation.
        router.push('/');
        router.refresh();
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="main-shell">
      <nav className="nav-bar">
        <Link href="/" className="nav-back">&larr; Home</Link>
      </nav>

      <section className="hero">
        <h1>Create Commitment</h1>
        <p>Set a deadline, stake EGLD, and define exactly where funds go if you fail.</p>
      </section>

      <WalletPanel />

      {!isLoggedIn ? (
        <p className="inline-note">Connect wallet to create commitments.</p>
      ) : null}

      <section className="form-card">
        <form className="form-grid" onSubmit={onSubmit}>
          <label>
            Title (max 64 chars)
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={64}
              placeholder="Ship API docs by Friday"
              required
            />
          </label>

          <label>
            Amount (EGLD)
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              inputMode="decimal"
              placeholder="0.1"
              required
            />
          </label>

          <label>
            Deadline
            <input
              type="datetime-local"
              value={deadlineInput}
              onChange={(e) => setDeadlineInput(e.target.value)}
              required
            />
          </label>

          <label>
            Recipient address
            <input
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              placeholder="erd1..."
              required
            />
          </label>

          <label>
            <input
              type="checkbox"
              checked={useCustomCooldown}
              onChange={(e) => setUseCustomCooldown(e.target.checked)}
            />{' '}
            Use custom cooldown (advanced)
          </label>

          {useCustomCooldown ? (
            <label>
              Cooldown seconds
              <input
                value={cooldown}
                onChange={(e) => setCooldown(e.target.value)}
                inputMode="numeric"
                placeholder="86400"
                required
              />
            </label>
          ) : null}

          <p className="inline-note">{warningText}</p>

          {error ? <p className="text-error">{error}</p> : null}

          <div className="actions-row">
            <button className="btn" type="submit" disabled={!isLoggedIn || submitting}>
              {submitting ? 'Submitting...' : 'Create Commitment'}
            </button>
            <Link href="/" className="btn btn-secondary">
              Back
            </Link>
          </div>
        </form>
      </section>
    </main>
  );
}
