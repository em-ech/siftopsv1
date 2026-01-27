export interface GDriveConnection {
  id: string;
  email: string;
  connected: boolean;
}

export interface GDriveFile {
  id: string;
  fileId: string;
  name: string;
  mimeType: string;
  webViewLink: string;
  folderPath: string | null;
  indexed: boolean;
  modifiedTime: string | null;
}

export interface GDriveSyncStatus {
  filesCount: number;
  chunksCount: number;
  status: 'idle' | 'indexing' | 'indexed' | 'error';
  syncedAt: string | null;
  error: string | null;
}

export interface GDriveSearchResult {
  docId: string;
  type: 'gdoc' | 'pdf' | 'text' | 'file';
  title: string;
  url: string;
  snippet: string;
  score: number;
  mimeType: string;
  folderPath: string | null;
}
