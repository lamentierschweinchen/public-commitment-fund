const EGLD_DECIMALS = 18;
const EGLD_UNIT = 10n ** 18n;

export function shortAddress(address: string): string {
  if (!address) return '';
  if (address.length <= 14) return address;
  return `${address.slice(0, 8)}...${address.slice(-6)}`;
}

export function weiToEgld(wei: string, precision = 4): string {
  try {
    const amount = BigInt(wei);
    const whole = amount / EGLD_UNIT;
    const fractionRaw = (amount % EGLD_UNIT)
      .toString()
      .padStart(EGLD_DECIMALS, '0')
      .slice(0, precision)
      .replace(/0+$/, '');

    return fractionRaw ? `${whole}.${fractionRaw}` : whole.toString();
  } catch {
    return '0';
  }
}

export function egldToWei(amount: string): string {
  const trimmed = amount.trim();
  if (!trimmed) return '0';

  const negative = trimmed.startsWith('-');
  if (negative) throw new Error('Amount must be positive');

  const [wholePartRaw, fractionPartRaw = ''] = trimmed.split('.');
  const wholePart = wholePartRaw || '0';

  if (!/^\d+$/.test(wholePart) || (fractionPartRaw && !/^\d+$/.test(fractionPartRaw))) {
    throw new Error('Invalid EGLD amount format');
  }

  if (fractionPartRaw.length > EGLD_DECIMALS) {
    throw new Error('Too many decimal places (max 18)');
  }

  const fraction = fractionPartRaw.padEnd(EGLD_DECIMALS, '0');
  const wei = (BigInt(wholePart) * EGLD_UNIT) + BigInt(fraction || '0');

  return wei.toString();
}

export function formatDateTime(timestamp: number): string {
  if (!Number.isFinite(timestamp) || timestamp <= 0) return '--';
  return new Date(timestamp * 1000).toLocaleString();
}
