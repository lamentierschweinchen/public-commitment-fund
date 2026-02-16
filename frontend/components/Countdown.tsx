'use client';

import { useEffect, useState } from 'react';

function formatRemaining(seconds: number): string {
  if (seconds <= 0) return 'Expired';

  const days = Math.floor(seconds / 86_400);
  const hours = Math.floor((seconds % 86_400) / 3_600);
  const minutes = Math.floor((seconds % 3_600) / 60);
  const secs = seconds % 60;

  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  return `${hours}h ${minutes}m ${secs}s`;
}

export function Countdown({ deadline }: { deadline: number }) {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));

  useEffect(() => {
    const id = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(id);
  }, []);

  const remaining = Math.max(0, deadline - now);

  return <span className="countdown">{formatRemaining(remaining)}</span>;
}
