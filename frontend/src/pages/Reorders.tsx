import React, { useState, useEffect } from 'react';
import api from '../api/client';
import { TableSkeleton } from '../components/Skeletons';
import { 
  RefreshCw, 
  Filter, 
  Calendar,
  Zap,
  Clock,
  Download
} from 'lucide-react';

interface Forecast {
  id: string;
  sku: string;
  item_name: string;
  category: 'furniture' | 'grocery';
  predicted_daily_demand: number;
  days_until_stockout: number;
  suggested_reorder_date: string;
  suggested_reorder_qty: number;
  mover_class: 'fast' | 'slow';
}

const MOCK_FORECASTS: Forecast[] = [
  { id: '2', sku: 'GRO-MIL-05', item_name: 'Organic Whole Milk 1L', category: 'grocery', predicted_daily_demand: 68.5, days_until_stockout: 0.17, suggested_reorder_date: '2026-08-15 (TODAY)', suggested_reorder_qty: 150, mover_class: 'fast' },
  { id: '1', sku: 'FUR-CHE-01', item_name: 'Ergonomic Mesh Office Chair', category: 'furniture', predicted_daily_demand: 0.8, days_until_stockout: 3.75, suggested_reorder_date: '2026-08-18', suggested_reorder_qty: 20, mover_class: 'slow' },
];

export const Reorders: React.FC = () => {
  const [forecasts, setForecasts] = useState<Forecast[]>([]);
  const [loading, setLoading] = useState(true);
  const [runningForecast, setRunningForecast] = useState(false);
  const [classFilter, setClassFilter] = useState<'all' | 'fast' | 'slow'>('all');

  const fetchForecasts = async () => {
    try {
      setLoading(true);
      const data = await api.get<Forecast[]>('/forecasts');
      setForecasts(data);
    } catch (err) {
      console.warn('Forecasts endpoint offline, using mock recommendations:', err);
      setForecasts(MOCK_FORECASTS);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchForecasts();
  }, []);

  const handleRunForecast = async () => {
    setRunningForecast(true);
    try {
      await api.post('/forecasts/run');
      await fetchForecasts();
    } catch (err) {
      console.warn('Run forecast POST failed, simulating engine trigger:');
      await new Promise(resolve => setTimeout(resolve, 2000));
      await fetchForecasts();
    } finally {
      setRunningForecast(false);
    }
  };

  const handleDownloadCSV = () => {
    const token = localStorage.getItem('token');
    const url = `${api.baseUrl}/export/forecasts?token=${token}`;
    window.open(url, '_blank');
  };

  const filteredForecasts = forecasts.filter(f => {
    if (classFilter === 'all') return true;
    return f.mover_class === classFilter;
  });

  return (
    <div className="space-y-6">
      {/* Top Header with CSV export button */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-mono font-bold text-zinc-100 uppercase tracking-wide">Reorder Forecasting</h2>
          <p className="text-xs font-mono text-zinc-500">Inventory demand prediction & stock replenishment planning</p>
        </div>
        <button
          onClick={handleDownloadCSV}
          className="flex items-center space-x-2 py-2 px-4 rounded border border-teal-500/30 text-teal-300 bg-teal-950/20 hover:bg-teal-950/40 font-mono text-xs transition-colors duration-150"
        >
          <Download className="w-4 h-4" />
          <span>DOWNLOAD REORDERS CSV</span>
        </button>
      </div>

      {/* Forecast Controls Panel */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-zinc-900 border border-zinc-800 p-6 rounded">
        <div>
          <h2 className="text-sm font-mono font-bold text-zinc-300 uppercase tracking-wider mb-1">
            DEMAND FORECASTING CORE
          </h2>
          <p className="text-[10px] font-mono text-zinc-500 max-w-lg">
            Calculated nightly via linear regression patterns. Click the trigger below to recalculate predictive velocity indices immediately.
          </p>
        </div>

        <button
          onClick={handleRunForecast}
          disabled={runningForecast}
          className={`flex items-center space-x-2 px-4 py-2 border rounded font-mono text-xs font-medium transition-all ${
            runningForecast
              ? 'border-teal-500/20 bg-teal-950/10 text-teal-400'
              : 'border-teal-500/30 bg-teal-950/20 text-teal-300 hover:bg-teal-950/40'
          } disabled:opacity-50`}
        >
          <RefreshCw className={`w-4 h-4 ${runningForecast ? 'animate-spin' : ''}`} />
          <span>{runningForecast ? 'RUNNING PROJECTIONS...' : 'RUN FORECAST ENGINE'}</span>
        </button>
      </div>

      {/* Velocity Filters */}
      <div className="flex items-center justify-between bg-zinc-900/40 border border-zinc-800/80 px-4 py-3 rounded">
        <div className="flex items-center space-x-2">
          <Filter className="w-4 h-4 text-zinc-500" />
          <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider">Mover Classification</span>
        </div>
        <div className="flex space-x-1">
          {(['all', 'fast', 'slow'] as const).map(c => (
            <button
              key={c}
              onClick={() => setClassFilter(c)}
              className={`px-3 py-1 text-xs font-mono rounded border transition-all duration-150 ${
                classFilter === c
                  ? 'bg-teal-950/40 text-teal-300 border-teal-500/30 font-bold'
                  : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:bg-zinc-850'
              }`}
            >
              {c.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Forecasts Table */}
      <div className="bg-zinc-900 border border-zinc-800 rounded overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between">
          <span className="text-xs font-mono text-zinc-400 uppercase tracking-wider">Replenishment Calculations</span>
          <span className="text-[10px] font-mono text-zinc-500">Velocity calculation window: 90 Days</span>
        </div>

        {loading ? (
          <TableSkeleton />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-zinc-800 text-zinc-500 text-xs font-mono uppercase bg-zinc-950/20">
                  <th className="py-3 px-6 font-medium">SKU</th>
                  <th className="py-3 px-6 font-medium">Item Name</th>
                  <th className="py-3 px-6 font-medium">Mover Index</th>
                  <th className="py-3 px-6 font-medium text-right">Daily Velocity</th>
                  <th className="py-3 px-6 font-medium text-right">Stockout Threshold</th>
                  <th className="py-3 px-6 font-medium">Suggested Date</th>
                  <th className="py-3 px-6 font-medium text-right">Suggested Qty</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/40">
                {filteredForecasts.map((item) => (
                  <tr key={item.id} className="text-xs font-mono hover:bg-zinc-800/10">
                    <td className="py-3 px-6 text-zinc-400">{item.sku}</td>
                    <td className="py-3 px-6 text-zinc-200 font-bold">{item.item_name}</td>
                    <td className="py-3 px-6">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase border ${
                        item.mover_class === 'fast'
                          ? 'bg-teal-950/40 text-teal-400 border-teal-500/20'
                          : 'bg-zinc-800 text-zinc-400 border-zinc-700'
                      }`}>
                        {item.mover_class}
                      </span>
                    </td>
                    <td className="py-3 px-6 text-right text-zinc-300">
                      <div className="flex items-center justify-end space-x-1">
                        <Zap className="w-3.5 h-3.5 text-zinc-600" />
                        <span>{item.predicted_daily_demand.toFixed(2)} / day</span>
                      </div>
                    </td>
                    <td className="py-3 px-6 text-right">
                      <div className="flex items-center justify-end space-x-1">
                        <Clock className="w-3.5 h-3.5 text-zinc-600" />
                        <span className={item.days_until_stockout <= 3 ? 'text-red-400 font-bold' : 'text-zinc-300'}>
                          {item.days_until_stockout.toFixed(1)} days
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-6 text-zinc-300">
                      <div className="flex items-center space-x-1.5">
                        <Calendar className="w-3.5 h-3.5 text-zinc-500" />
                        <span className={item.suggested_reorder_date.includes('TODAY') ? 'text-teal-400 font-bold' : ''}>
                          {item.suggested_reorder_date}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-6 text-right text-zinc-200 font-bold">
                      {item.suggested_reorder_qty.toLocaleString()}
                    </td>
                  </tr>
                ))}
                {filteredForecasts.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-zinc-500 font-mono text-xs">
                      No demand predictions recorded. Click "Run Forecast Engine" to recalculate.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default Reorders;
