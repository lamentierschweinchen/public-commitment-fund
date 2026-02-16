import assert from 'node:assert/strict';
import test from 'node:test';

import {
  commitmentBucket,
  getCommitmentEligibility,
  sortCommitments,
} from '../lib/commitments';
import { queryCommitments } from '../lib/commitment-query';
import { validateCreateCommitmentInput } from '../lib/create-commitment-validation';
import { Commitment, CommitmentStatus } from '../types';

const base: Commitment = {
  id: 1,
  creator: 'erd1creator',
  recipient: 'erd1recipient',
  amount: '1000000000000000000',
  deadline: 1000,
  cooldownSeconds: 86400,
  createdAt: 100,
  status: CommitmentStatus.Active,
  title: 'Ship feature',
  proofUrl: '',
  proofHash: '',
  proofSubmittedAt: 0,
  finalizedAt: 0,
};

test('commitmentBucket maps statuses', () => {
  assert.equal(commitmentBucket(CommitmentStatus.Active), 'active');
  assert.equal(commitmentBucket(CommitmentStatus.Completed), 'completed');
  assert.equal(commitmentBucket(CommitmentStatus.Refunded), 'completed');
  assert.equal(commitmentBucket(CommitmentStatus.Failed), 'failed');
  assert.equal(commitmentBucket(CommitmentStatus.Claimed), 'failed');
});

test('eligibility respects deadline and cooldown boundaries', () => {
  const active = { ...base, status: CommitmentStatus.Active, deadline: 500 };
  const e1 = getCommitmentEligibility(active, 'erd1creator', 500);
  assert.equal(e1.canSubmitProof, true);
  assert.equal(e1.canFinalize, false);

  const e2 = getCommitmentEligibility(active, 'erd1creator', 501);
  assert.equal(e2.canSubmitProof, false);
  assert.equal(e2.canFinalize, true);

  const failed = {
    ...base,
    status: CommitmentStatus.Failed,
    finalizedAt: 1_000,
    cooldownSeconds: 20,
  };
  const earlyClaim = getCommitmentEligibility(failed, 'erd1recipient', 1_019);
  assert.equal(earlyClaim.canClaim, false);

  const onBoundaryClaim = getCommitmentEligibility(failed, 'erd1recipient', 1_020);
  assert.equal(onBoundaryClaim.canClaim, true);
});

test('sortCommitments sorts active by nearest deadline', () => {
  const a = { ...base, id: 1, deadline: 500 };
  const b = { ...base, id: 2, deadline: 200 };
  const c = { ...base, id: 3, deadline: 800 };

  const sorted = sortCommitments([a, b, c], 'active');
  assert.deepEqual(sorted.map((item) => item.id), [2, 1, 3]);
});

test('queryCommitments paginates active commitments and tracks next cursor', () => {
  const list: Commitment[] = [
    { ...base, id: 1, status: CommitmentStatus.Active, deadline: 200 },
    { ...base, id: 2, status: CommitmentStatus.Active, deadline: 300 },
    { ...base, id: 3, status: CommitmentStatus.Active, deadline: 400 },
    { ...base, id: 4, status: CommitmentStatus.Completed, deadline: 500 },
  ];

  const page1 = queryCommitments(list, {
    status: 'active',
    cursor: 0,
    limit: 2,
    mine: '',
  });
  assert.equal(page1.total, 3);
  assert.equal(page1.nextCursor, 2);
  assert.deepEqual(page1.items.map((item) => item.id), [1, 2]);

  const page2 = queryCommitments(list, {
    status: 'active',
    cursor: page1.nextCursor || 0,
    limit: 2,
    mine: '',
  });
  assert.equal(page2.total, 3);
  assert.equal(page2.nextCursor, null);
  assert.deepEqual(page2.items.map((item) => item.id), [3]);
});

test('validateCreateCommitmentInput enforces deadline and cooldown boundaries', () => {
  const valid = validateCreateCommitmentInput({
    title: 'Ship docs',
    amount: '0.1',
    deadlineInput: new Date((1_000 + 301) * 1000).toISOString(),
    recipient: 'erd1recipient',
    useCustomCooldown: true,
    cooldownInput: '86400',
    nowSeconds: 1_000,
  });

  assert.equal(valid.title, 'Ship docs');
  assert.equal(valid.recipient, 'erd1recipient');
  assert.equal(valid.cooldownSeconds, 86_400);

  assert.throws(
    () =>
      validateCreateCommitmentInput({
        title: 'Ship docs',
        amount: '0.1',
        deadlineInput: new Date((1_000 + 300) * 1000).toISOString(),
        recipient: 'erd1recipient',
        useCustomCooldown: false,
        cooldownInput: '',
        nowSeconds: 1_000,
      }),
    /at least 5 minutes/
  );

  assert.throws(
    () =>
      validateCreateCommitmentInput({
        title: 'Ship docs',
        amount: '0.1',
        deadlineInput: new Date((1_000 + 301) * 1000).toISOString(),
        recipient: 'erd1recipient',
        useCustomCooldown: true,
        cooldownInput: '0',
        nowSeconds: 1_000,
      }),
    /Cooldown must be a positive number/
  );
});
