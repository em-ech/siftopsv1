import { Search, Menu } from 'lucide-react';

const navItems = ['Latest', 'Startups', 'Security', 'AI', 'Apps', 'Events'];

export function TCTopBar() {
  return (
    <header className="bg-[#0f1a17] text-white">
      <div className="px-4 py-2.5 flex items-center gap-4">
        {/* Brand */}
        <div className="font-extrabold tracking-tight text-sm" style={{ letterSpacing: '-0.2px' }}>
          TC TechCrunch
        </div>

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
