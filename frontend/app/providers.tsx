'use client';

import { ReactNode } from 'react';
import { DappProvider } from '@multiversx/sdk-dapp/wrappers';
import { SignTransactionsModals } from '@multiversx/sdk-dapp/UI/SignTransactionsModals';
import { TransactionsToastList } from '@multiversx/sdk-dapp/UI/TransactionsToastList';
import { environment, walletConnectProjectId } from '@/config';

export default function Providers({ children }: { children: ReactNode }) {
  const customNetworkConfig = walletConnectProjectId
    ? { walletConnectV2ProjectId: walletConnectProjectId }
    : undefined;

  return (
    <DappProvider
      environment={environment}
      dappConfig={{ logoutRoute: '/' }}
      customNetworkConfig={customNetworkConfig}
    >
      <>
        {children}
        <SignTransactionsModals />
        <TransactionsToastList />
      </>
    </DappProvider>
  );
}
