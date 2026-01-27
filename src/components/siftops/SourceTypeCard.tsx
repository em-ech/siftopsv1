import { LucideIcon } from 'lucide-react';

interface SourceTypeCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  enabled: boolean;
  onClick: () => void;
}

export function SourceTypeCard({
  icon: Icon,
  title,
  description,
  enabled,
  onClick,
}: SourceTypeCardProps) {
  return (
    <button
      onClick={onClick}
      disabled={!enabled}
      className={`group relative flex flex-col items-center gap-3 p-6 rounded-xl border transition-all text-center ${
        enabled
          ? 'border-border bg-card hover:border-primary hover:shadow-md cursor-pointer'
          : 'border-border/50 bg-muted/30 cursor-not-allowed opacity-60'
      }`}
    >
      <div
        className={`w-14 h-14 rounded-xl flex items-center justify-center transition-colors ${
          enabled
            ? 'bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground'
            : 'bg-muted text-muted-foreground'
        }`}
      >
        <Icon className="w-7 h-7" />
      </div>
      <div>
        <h3 className="font-semibold text-foreground">{title}</h3>
        <p className="text-sm text-muted-foreground mt-1">{description}</p>
      </div>
      {!enabled && (
        <span className="absolute top-3 right-3 text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
          Coming soon
        </span>
      )}
    </button>
  );
}
