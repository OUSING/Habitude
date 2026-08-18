import { useEffect, useState } from "react";
import { getAutoSyncState, onAutoSyncStateChange, type AutoSyncState } from "../services/driveBackup";

/** Live view of the auto-sync engine's status (idle/pending/syncing/synced/
 *  error) — updates whenever a debounced sync starts, finishes, or fails. */
export function useAutoSyncState(): AutoSyncState {
  const [state, setState] = useState<AutoSyncState>(getAutoSyncState());

  useEffect(() => {
    return onAutoSyncStateChange(setState);
  }, []);

  return state;
}
