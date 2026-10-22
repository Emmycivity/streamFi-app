'use client';

import { useEffect, useState } from 'react';
import { useWallet } from '@/contexts/WalletContext';
import {
  OFFLINE_QUEUE_STORAGE_KEY,
  flushQueuedTransactions,
  queuedDraftsLabel,
  queuedTransactions,
  startOnlineSync,
  stopOnlineSync,
} from '@/lib/offline-transactions';

/**
 * #739, #809 — Queue failed transactions, retry on reconnect, and notify user.
 * #795 — Show how many drafts are queued offline, kept in sync across tabs.
 */
export function OfflineTransactionSync() {
  const { publicKey, signTx } = useWallet();
  const [queuedCount, setQueuedCount] = useState(0);
  const [showRetryPrompt, setShowRetryPrompt] = useState(false);

  useEffect(() => {
    if (!publicKey) return;

    startOnlineSync(signTx);
    void flushQueuedTransactions(signTx);

    const updateCount = () => {
      if (typeof queuedTransactions === 'function') {
        setQueuedCount(queuedTransactions()?.length ?? 0);
      }
    };

    const flush = async () => {
      const pending = typeof queuedTransactions === 'function' ? queuedTransactions()?.length ?? 0 : 0;
      if (pending > 0) {
        setShowRetryPrompt(true);
      }
      await flushQueuedTransactions(signTx);
      updateCount();
      setTimeout(() => setShowRetryPrompt(false), 3000);
    };

    // Another tab queuing or flushing a draft only reaches this tab as a
    // `storage` event on the queue key (#795); a null key means storage was
    // cleared.
    const onStorage = (event: StorageEvent) => {
      if (event.key === null || event.key === OFFLINE_QUEUE_STORAGE_KEY) updateCount();
    };

    window.addEventListener('online', flush);
    window.addEventListener('offline-transactions-changed', updateCount);
    window.addEventListener('storage', onStorage);
    updateCount();

    return () => {
      stopOnlineSync();
      window.removeEventListener('online', flush);
      window.removeEventListener('offline-transactions-changed', updateCount);
      window.removeEventListener('storage', onStorage);
    };
  }, [publicKey, signTx]);

  if (queuedCount === 0 && !showRetryPrompt) return null;

  const label = queuedDraftsLabel(queuedCount);
  const words = label.slice(label.indexOf(' ') + 1);

  return (
    <div
      className="fixed top-4 right-4 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-200 text-xs px-3 py-2 rounded shadow-lg z-50"
      role="status"
      aria-live="polite"
    >
      {showRetryPrompt ? (
        <span>Connection restored. Retrying {queuedCount} queued transaction{queuedCount === 1 ? '' : 's'}…</span>
      ) : (
        <>
          <span>{queuedCount}</span> <span>{words}</span>
        </>
      )}
    </div>
  );
}
