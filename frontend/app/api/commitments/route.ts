import { NextResponse } from 'next/server';
import { fetchAllCommitments } from '@/lib/server-contract';
import { queryCommitments } from '@/lib/commitment-query';
import { CommitmentBucket } from '@/types';

function parsePositiveInt(value: string | null, fallbackValue: number, maxValue: number): number {
  const parsed = Number(value || fallbackValue);
  if (!Number.isFinite(parsed)) return fallbackValue;
  return Math.min(Math.max(Math.trunc(parsed), 0), maxValue);
}

function parseStatus(status: string | null): CommitmentBucket | 'all' {
  if (status === 'active' || status === 'completed' || status === 'failed') {
    return status;
  }
  return 'all';
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const status = parseStatus(url.searchParams.get('status'));
  const limit = parsePositiveInt(url.searchParams.get('limit'), 20, 200);
  const cursor = parsePositiveInt(url.searchParams.get('cursor'), 0, 100_000);
  const mine = (url.searchParams.get('mine') || '').trim();

  try {
    const all = await fetchAllCommitments();
    const page = queryCommitments(all, {
      status,
      mine,
      cursor,
      limit,
    });

    return NextResponse.json(
      {
        items: page.items,
        total: page.total,
        nextCursor: page.nextCursor,
        now: Math.floor(Date.now() / 1000),
      },
      {
        headers: {
          'Cache-Control': 's-maxage=4, stale-while-revalidate=20',
        },
      }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    return NextResponse.json(
      {
        error: 'Failed to query on-chain commitments.',
        details: message,
      },
      {
        status: 502,
        headers: {
          'Cache-Control': 'no-store',
        },
      }
    );
  }
}
