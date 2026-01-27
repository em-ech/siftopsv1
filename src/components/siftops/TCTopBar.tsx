import { Home } from 'lucide-react';

interface TCTopBarProps {
  onGoHome?: () => void;
}

export function TCTopBar({ onGoHome }: TCTopBarProps) {
  return (
    <header className="bg-background border-b border-border">
      <div className="max-w-[1280px] mx-auto px-4 py-3 flex items-center">
        {/* Brand - clickable to go home */}
        <button
          onClick={onGoHome}
          className="font-bold text-lg text-foreground flex items-center gap-2 hover:text-primary transition-colors"
        >
          <Home className="w-5 h-5 text-primary" />
          SiftOps
        </button>
      </div>
    </header>
  );
}
