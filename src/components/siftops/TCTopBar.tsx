import { Home } from 'lucide-react';

interface TCTopBarProps {
  onGoHome?: () => void;
}

export function TCTopBar({ onGoHome }: TCTopBarProps) {
  return (
    <header className="bg-background border-b border-border">
      <div className="pl-[180px] pr-6 py-3 flex items-center gap-3">
        {/* Brand - clickable to go home */}
        <button
          onClick={onGoHome}
          className="font-bold text-lg text-foreground flex items-center gap-2 hover:text-primary transition-colors"
        >
          <Home className="w-5 h-5 text-primary" />
          SiftOps
        </button>
        <span className="text-sm text-muted-foreground">
          Semantic search with evidence-based RAG
        </span>
      </div>
    </header>
  );
}
