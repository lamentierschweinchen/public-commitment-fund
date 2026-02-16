import { NextResponse } from 'next/server';
import { getCommitmentById } from '@/lib/server-contract';

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params;
  const id = Number(params.id);

  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json(
      { error: 'Invalid commitment id' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  try {
    const item = await getCommitmentById(Math.trunc(id));

    return NextResponse.json(
      {
        item,
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
    const notFound = message.toLowerCase().includes('not found');

    return NextResponse.json(
      {
        error: notFound ? 'Commitment not found' : 'Failed to query commitment',
        details: message,
      },
      {
        status: notFound ? 404 : 502,
        headers: {
          'Cache-Control': 'no-store',
        },
      }
    );
  }
}
