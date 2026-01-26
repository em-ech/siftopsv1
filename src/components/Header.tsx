import { Shield, Lock, Activity } from 'lucide-react';

export function Header() {
  return (
    <header className="border-b border-border/50 bg-card/50 backdrop-blur-xl sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/50 flex items-center justify-center glow-primary">
              <Shield className="w-5 h-5 text-primary-foreground" />
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-success border-2 border-background" />
          </div>
          <div>
            <h1 className="text-lg font-semibold tracking-tight">Sift Secure</h1>
            <p className="text-xs text-muted-foreground">Enterprise Search</p>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 text-sm">
            <Activity className="w-4 h-4 text-success animate-pulse-subtle" />
            <span className="text-muted-foreground">System Active</span>
          </div>
          
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-secondary border border-border">
            <Lock className="w-3.5 h-3.5 text-primary" />
            <span className="text-sm font-medium">tenant_001</span>
          </div>
        </div>
      </div>
    </header>
  );
}
