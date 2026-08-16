import React from 'react';
import { AlertCircle, ShieldAlert, CheckCircle2 } from 'lucide-react';

interface StockBadgeProps {
  available: number;
  reorderPoint: number;
  unit: string;
}

export const StockBadge: React.FC<StockBadgeProps> = ({ available, reorderPoint, unit }) => {
  // Low Stock Status Check
  const isLow = available <= reorderPoint;
  const isWarning = !isLow && available <= reorderPoint * 1.5;

  let bgClass = 'bg-emerald-950/30 text-emerald-400 border-emerald-500/20';
  let icon = <CheckCircle2 className="w-3.5 h-3.5 mr-1" />;
  let label = 'Healthy';

  if (isLow) {
    bgClass = 'bg-red-950/30 text-red-400 border-red-500/20';
    icon = <AlertCircle className="w-3.5 h-3.5 mr-1" />;
    label = 'Low Stock';
  } else if (isWarning) {
    bgClass = 'bg-amber-950/30 text-amber-400 border-amber-500/20';
    icon = <ShieldAlert className="w-3.5 h-3.5 mr-1" />;
    label = 'Reorder Alert';
  }

  return (
    <div className="flex items-center space-x-2">
      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-medium border ${bgClass}`}>
        {icon}
        {label}
      </span>
      <span className="text-sm font-mono text-zinc-300">
        {available} <span className="text-zinc-500 text-xs">{unit}</span>
      </span>
    </div>
  );
};

export default StockBadge;
