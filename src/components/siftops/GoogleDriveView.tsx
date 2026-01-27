import { useEffect } from 'react';
import { ArrowLeft, Cloud, RefreshCw, Link2Off, Search, FileText, File, FileSpreadsheet, Presentation } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useGoogleDrive } from '@/hooks/useGoogleDrive';

interface GoogleDriveViewProps {
  onBack: () => void;
  onSearch: (query: string) => void;
}

function getMimeTypeIcon(mimeType: string) {
  if (mimeType?.includes('document')) return <FileText className="w-4 h-4" />;
  if (mimeType?.includes('spreadsheet')) return <FileSpreadsheet className="w-4 h-4" />;
  if (mimeType?.includes('presentation')) return <Presentation className="w-4 h-4" />;
  if (mimeType?.includes('pdf')) return <File className="w-4 h-4" />;
  return <File className="w-4 h-4" />;
}

export function GoogleDriveView({ onBack, onSearch }: GoogleDriveViewProps) {
  const {
    connection,
    isConnecting,
    checkConnection,
    connect,
    disconnect,
    syncStatus,
    isSyncing,
    syncDrive,
  } = useGoogleDrive();

  useEffect(() => {
    checkConnection();
  }, [checkConnection]);

  const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const query = formData.get('query') as string;
    if (query?.trim()) {
      onSearch(query);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-background border-b border-border">
        <div className="max-w-[1200px] mx-auto px-4 py-3 flex items-center gap-3 mr-[5%]">
          <button
            onClick={onBack}
            className="p-2 rounded-lg hover:bg-accent transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-muted-foreground" />
          </button>
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Cloud className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="font-semibold text-lg text-foreground">Google Drive</h1>
            <p className="text-sm text-muted-foreground">Select sources to search</p>
          </div>
        </div>
      </header>

      <main className="max-w-[1200px] mx-auto px-4 py-6 mr-[5%]">
        {/* Search bar */}
        <form onSubmit={handleSearch} className="flex gap-2 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              name="query"
              type="text"
              placeholder="Search across Google Drive sources..."
              disabled={!connection || syncStatus.chunksCount === 0}
              className="w-full pl-10 pr-4 py-3 border border-border rounded-xl text-sm bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>
          <Button
            type="submit"
            disabled={!connection || syncStatus.chunksCount === 0}
            className="px-6 rounded-xl"
          >
            Sift
          </Button>
        </form>

        {/* Connection status card */}
        <div className="border border-border rounded-xl p-6 bg-card mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <Cloud className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">
                  {connection ? 'Connected' : 'Not Connected'}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {connection ? connection.email : 'Connect to access your Google Drive files'}
                </p>
              </div>
            </div>

            {connection ? (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={disconnect}
                  className="gap-2"
                >
                  <Link2Off className="w-4 h-4" />
                  Disconnect
                </Button>
              </div>
            ) : (
              <Button
                onClick={connect}
                disabled={isConnecting}
                className="gap-2"
              >
                <Cloud className="w-4 h-4" />
                {isConnecting ? 'Connecting...' : 'Connect Google Drive'}
              </Button>
            )}
          </div>
        </div>

        {/* Indexing status */}
        {connection && (
          <div className="border border-border rounded-xl p-6 bg-card">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold text-foreground">Indexed Content</h3>
                <p className="text-sm text-muted-foreground">
                  {syncStatus.status === 'indexed' 
                    ? `${syncStatus.filesCount} files, ${syncStatus.chunksCount} chunks indexed`
                    : syncStatus.status === 'indexing'
                    ? 'Indexing in progress...'
                    : 'No content indexed yet'}
                </p>
              </div>
              <Button
                onClick={syncDrive}
                disabled={isSyncing}
                variant={syncStatus.status === 'indexed' ? 'outline' : 'default'}
                className="gap-2"
              >
                <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                {isSyncing ? 'Indexing...' : syncStatus.status === 'indexed' ? 'Re-index' : 'Index Drive'}
              </Button>
            </div>

            {/* Status indicator */}
            {syncStatus.status !== 'idle' && (
              <div className="flex items-center gap-2 mt-4 pt-4 border-t border-border">
                <div className={`w-2 h-2 rounded-full ${
                  syncStatus.status === 'indexed' ? 'bg-green-500' :
                  syncStatus.status === 'indexing' ? 'bg-yellow-500 animate-pulse' :
                  syncStatus.status === 'error' ? 'bg-red-500' : 'bg-muted'
                }`} />
                <span className="text-xs text-muted-foreground">
                  {syncStatus.status === 'indexed' && syncStatus.syncedAt
                    ? `Last indexed: ${new Date(syncStatus.syncedAt).toLocaleString()}`
                    : syncStatus.status === 'indexing'
                    ? 'Indexing files...'
                    : syncStatus.status === 'error'
                    ? syncStatus.error || 'Error occurred'
                    : 'Not indexed'}
                </span>
              </div>
            )}

            {/* Supported file types */}
            <div className="mt-4 pt-4 border-t border-border">
              <p className="text-xs text-muted-foreground mb-2">Supported file types:</p>
              <div className="flex flex-wrap gap-2">
                {[
                  { icon: <FileText className="w-3 h-3" />, label: 'Google Docs' },
                  { icon: <File className="w-3 h-3" />, label: 'PDFs' },
                  { icon: <FileSpreadsheet className="w-3 h-3" />, label: 'Text files' },
                ].map((type) => (
                  <span
                    key={type.label}
                    className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-secondary text-xs text-secondary-foreground"
                  >
                    {type.icon}
                    {type.label}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Empty state when not connected */}
        {!connection && (
          <div className="text-center py-12">
            <Cloud className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">
              Connect Your Google Drive
            </h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Connect your Google Drive to index and search across your documents, 
              PDFs, and text files with semantic search.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
