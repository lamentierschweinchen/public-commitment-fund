'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useGetIsLoggedIn } from '@multiversx/sdk-dapp/hooks/account/useGetIsLoggedIn';
import { useGetAccountInfo } from '@multiversx/sdk-dapp/hooks/account/useGetAccountInfo';
import { logout } from '@multiversx/sdk-dapp/utils';
import { useExtensionLogin } from '@multiversx/sdk-dapp/hooks/login/useExtensionLogin';
import { useWebWalletLogin } from '@multiversx/sdk-dapp/hooks/login/useWebWalletLogin';
import { shortAddress } from '@/lib/format';

export function WalletPanel() {
  const router = useRouter();
  const isLoggedIn = useGetIsLoggedIn();
  const { address } = useGetAccountInfo();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [initiateExtensionLogin] = useExtensionLogin({
    callbackRoute: '/',
    nativeAuth: false,
  });

  const [initiateWebWalletLogin] = useWebWalletLogin({
    callbackRoute: '/',
    nativeAuth: false,
  });

  const handleDisconnect = async () => {
    try {
      setBusy(true);
      setError(null);
      await logout('/');
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    } finally {
      setBusy(false);
    }
  };

  const handleExtensionLogin = async () => {
    try {
      setError(null);
      setBusy(true);
      await initiateExtensionLogin();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const isNotInstalled =
        message.toLowerCase().includes('not installed') ||
        message.toLowerCase().includes('not found') ||
        message.toLowerCase().includes('redirect');
      setError(
        isNotInstalled
          ? 'MultiversX DeFi Wallet extension not found. Install it or use Web Wallet instead.'
          : message
      );
    } finally {
      setBusy(false);
    }
  };

  const handleWebWalletLogin = async () => {
    try {
      setError(null);
      setBusy(true);
      await initiateWebWalletLogin();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    } finally {
      setBusy(false);
    }
  };

  if (isLoggedIn && address) {
    return (
      <div className="wallet-panel wallet-panel--connected">
        <div className="wallet-panel__status">
          <span className="wallet-panel__dot" />
          <span className="wallet-panel__label">Connected</span>
        </div>
        <p className="wallet-panel__address">{shortAddress(address)}</p>
        <button
          className="btn btn-sm btn-ghost"
          onClick={handleDisconnect}
          disabled={busy}
        >
          {busy ? 'Disconnecting...' : 'Disconnect'}
        </button>
        {error ? <p className="text-error">{error}</p> : null}
      </div>
    );
  }

  return (
    <div className="wallet-panel">
      <div className="wallet-panel__info">
        <p className="wallet-panel__label">Connect Wallet</p>
        <p className="wallet-panel__hint">Browse freely. Connect to write onchain.</p>
      </div>
      <div className="wallet-panel__buttons">
        <button
          className="btn btn-sm btn-outline"
          onClick={handleExtensionLogin}
          disabled={busy}
        >
          DeFi Wallet
        </button>
        <button
          className="btn btn-sm btn-outline"
          onClick={handleWebWalletLogin}
          disabled={busy}
        >
          Web Wallet
        </button>
      </div>
      {error ? <p className="text-error">{error}</p> : null}
    </div>
  );
}
