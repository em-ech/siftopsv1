import { Shield, Eye, Lock, Server, FileCheck } from 'lucide-react';

const badges = [
  { icon: Shield, label: 'Zero Trust', description: 'ACL verified before retrieval' },
  { icon: Eye, label: 'No Training', description: 'Content never trains models' },
  { icon: Lock, label: 'On-Premise', description: 'Single tenant deployment' },
  { icon: Server, label: 'Stateless', description: 'No persistent generation state' },
  { icon: FileCheck, label: 'Auditable', description: 'Full action trail logged' },
];

export function SecurityBadges() {
  return (
    <div className="flex flex-wrap justify-center gap-3">
      {badges.map(({ icon: Icon, label, description }) => (
        <div
          key={label}
          className="group flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary/50 border border-border hover:border-primary/30 transition-colors cursor-default"
        >
          <Icon className="w-4 h-4 text-primary" />
          <div>
            <span className="text-sm font-medium">{label}</span>
            <span className="hidden group-hover:inline text-xs text-muted-foreground ml-2">
              {description}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
