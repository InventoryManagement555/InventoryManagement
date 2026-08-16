import React from 'react';

export const CardSkeleton: React.FC = () => {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded p-6 animate-pulse">
      <div className="h-4 bg-zinc-800 rounded w-1/3 mb-4"></div>
      <div className="h-8 bg-zinc-800 rounded w-2/3 mb-2"></div>
      <div className="h-3 bg-zinc-800 rounded w-1/2"></div>
    </div>
  );
};

export const TableSkeleton: React.FC<{ rows?: number; cols?: number }> = ({ rows = 5, cols = 4 }) => {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded overflow-hidden animate-pulse">
      <div className="h-12 bg-zinc-800/80 border-b border-zinc-800 flex items-center px-6">
        <div className="h-4 bg-zinc-700 rounded w-1/4"></div>
      </div>
      <div className="divide-y divide-zinc-800/55">
        {Array.from({ length: rows }).map((_, rIdx) => (
          <div key={rIdx} className="h-16 px-6 flex items-center justify-between space-x-4">
            {Array.from({ length: cols }).map((_, cIdx) => (
              <div 
                key={cIdx} 
                className="h-4 bg-zinc-800 rounded" 
                style={{ width: `${Math.max(15, Math.floor(Math.random() * 40) + 15)}%` }}
              ></div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

export const ChartSkeleton: React.FC = () => {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded p-6 animate-pulse flex flex-col justify-between h-[300px]">
      <div className="h-4 bg-zinc-800 rounded w-1/4 mb-4"></div>
      <div className="flex-1 flex items-end justify-between space-x-4 px-4 pb-2">
        <div className="bg-zinc-800 rounded-t w-full h-[60%]"></div>
        <div className="bg-zinc-800 rounded-t w-full h-[40%]"></div>
        <div className="bg-zinc-800 rounded-t w-full h-[85%]"></div>
        <div className="bg-zinc-800 rounded-t w-full h-[50%]"></div>
        <div className="bg-zinc-800 rounded-t w-full h-[70%]"></div>
      </div>
      <div className="h-3 bg-zinc-800 rounded w-full mt-4"></div>
    </div>
  );
};
