import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SyncStatus } from '@/types/siftops';

interface TopBarProps {
  status: SyncStatus;
  isSyncing: boolean;
  onSync: () => void;
}

export function TopBar({ status, isSyncing, onSync }: TopBarProps) {
  const formatSyncTime = (dateStr: string | null) => {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const statusText = () => {
    if (status.status === 'syncing' || isSyncing) return 'Indexing...';
    if (status.status === 'error') return 'Sync failed';
    if (!status.syncedAt) return 'Not indexed';
    return `Indexed ${status.docs} sources`;
  };

  return (
    <header className="sticky top-0 z-50 bg-background border-b border-border">
      <div className="px-4 h-14 flex items-center justify-between">
        <h1 className="text-lg font-semibold tracking-tight">SiftOps</h1>
        
        <div className="flex items-center gap-3">
          <div className="status-pill">
            <span>{statusText()}</span>
            {status.syncedAt && (
              <>
                <span className="text-border">·</span>
                <span>{formatSyncTime(status.syncedAt)}</span>
              </>
            )}
          </div>
          
          <Button
            variant="outline"
            size="sm"
            onClick={onSync}
            disabled={isSyncing}
            className="gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            Sync TechCrunch
          </Button>
        </div>
      </div>
    </header>
  );
}
