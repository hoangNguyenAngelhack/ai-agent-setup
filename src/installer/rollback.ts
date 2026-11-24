import { listJournals, restoreJournal, saveJournal } from './transaction';

export interface RollbackResult {
  transactionId: string;
  restored: string[];
  removed: string[];
}

/**
 * Rolls back the most recent transaction that is not yet rolled back (docs/v2/05 §11.4). Call
 * again to step further back. Refuses, unless `force`, when files changed after the transaction.
 */
export function rollback(root: string, { force = false }: { force?: boolean } = {}): RollbackResult {
  const journal = listJournals(root).find((candidate) => candidate.status !== 'rolled-back');
  if (!journal) throw new Error('Nothing to roll back: no committed ai-agent-setup transaction found');
  const { restored, removed } = restoreJournal(root, journal, force);
  saveJournal(root, { ...journal, status: 'rolled-back' });
  return { transactionId: journal.id, restored, removed };
}
