import { Search, Menu, Home } from 'lucide-react';

const navItems = ['Latest', 'Startups', 'Security', 'AI', 'Apps', 'Events'];

interface TCTopBarProps {
  onGoHome?: () => void;
}

export function TCTopBar({ onGoHome }: TCTopBarProps) {
  return (
    <header className="bg-[#0f1a17] text-white">
      <div className="px-4 py-2.5 flex items-center gap-4">
        {/* Brand - clickable to go home */}
        <button
          onClick={onGoHome}
          className="font-extrabold tracking-tight text-sm flex items-center gap-2 hover:opacity-80 transition-opacity"
          style={{ letterSpacing: '-0.2px' }}
        >
          <Home className="w-4 h-4" />
          SiftOps
        </button>

        {/* Nav */}
        <nav className="flex gap-3.5 text-sm opacity-90 flex-wrap">
          {navItems.map((item) => (
            <span key={item} className="cursor-default hover:opacity-80">
              {item}
            </span>
          ))}
        </nav>

        {/* Right icons */}
        <div className="ml-auto flex items-center gap-3 opacity-90">
          <Search className="w-4 h-4" />
          <Menu className="w-4 h-4" />
        </div>
      </div>
    </header>
  );
}
