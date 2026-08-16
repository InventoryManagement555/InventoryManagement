import React, { useState, useEffect } from 'react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import StockBadge from '../components/StockBadge';
import {
  Search,
  ArrowUpRight,
  ArrowDownRight,
  Sofa,
  ShoppingBag,
  X,
  ShieldCheck,
  AlertCircle,
  ClipboardList,
  Clock,
  Package
} from 'lucide-react';

interface Item {
  id: string;
  sku: string;
  name: string;
  category: 'furniture' | 'grocery';
  unit: string;
  unit_price: number;
  reorder_point: number;
  reorder_qty: number;
  available_stock: number;
}

interface ActivityEntry {
  id: string;
  item_id: string;
  item_name: string;
  item_sku: string;
  change_qty: number;
  type: 'IN' | 'OUT';
  reference_note: string;
  created_at: string;
}

export const Operations: React.FC = () => {
  const { user } = useAuth();
  const [items, setItems] = useState<Item[]>([]);
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [activityLoading, setActivityLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'furniture' | 'grocery'>('all');

  // Stock action modal state
  const [stockModal, setStockModal] = useState<{ item: Item; action: 'IN' | 'OUT' } | null>(null);
  const [stockQty, setStockQty] = useState('');
  const [stockNote, setStockNote] = useState('');
  const [stockSubmitting, setStockSubmitting] = useState(false);
  const [stockError, setStockError] = useState<string | null>(null);
  const [stockSuccess, setStockSuccess] = useState<string | null>(null);

  const fetchItems = async () => {
    try {
      const data = await api.get<Item[]>('/items');
      setItems(data);
    } catch (err) {
      console.error('Failed to load items:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchActivity = async () => {
    try {
      const data = await api.get<ActivityEntry[]>('/stock/my-activity');
      setActivity(data);
    } catch (err) {
      console.error('Failed to load activity:', err);
    } finally {
      setActivityLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
    fetchActivity();
  }, []);

  const filteredItems = items.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.sku.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || item.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const handleStockAction = async () => {
    if (!stockModal || !stockQty) return;
    const qty = parseInt(stockQty);
    if (isNaN(qty) || qty <= 0) {
      setStockError('Enter a valid positive quantity.');
      return;
    }

    setStockSubmitting(true);
    setStockError(null);
    setStockSuccess(null);

    try {
      const endpoint = stockModal.action === 'IN' ? '/stock/in' : '/stock/out';
      await api.post(endpoint, {
        item_id: stockModal.item.id,
        qty,
        note: stockNote || undefined,
      });
      setStockSuccess(`${stockModal.action === 'IN' ? 'Stock In' : 'Stock Out'} of ${qty} ${stockModal.item.unit} recorded.`);
      setStockQty('');
      setStockNote('');
      // Refresh data
      fetchItems();
      fetchActivity();
      setTimeout(() => setStockModal(null), 1200);
    } catch (err: any) {
      setStockError(err.message || 'Transaction failed.');
    } finally {
      setStockSubmitting(false);
    }
  };

  const formatTimestamp = (iso: string) => {
    if (!iso) return 'N/A';
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="bg-teal-500/10 p-2 rounded-lg border border-teal-500/20">
            <ClipboardList className="w-5 h-5 text-teal-400" />
          </div>
          <div>
            <h2 className="text-lg font-mono font-bold text-zinc-100 tracking-wide">INVENTORY OPERATIONS</h2>
            <p className="text-xs font-mono text-zinc-500">Stock management & transaction logging</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs font-mono text-zinc-500">Operator</p>
          <p className="text-sm font-mono text-teal-400">{user?.name}</p>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex items-center space-x-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input
            type="text"
            placeholder="Search by name or SKU..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-zinc-900 border border-zinc-800 rounded text-sm font-mono text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-teal-500 focus:border-teal-500"
          />
        </div>
        <div className="flex space-x-1">
          {(['all', 'furniture', 'grocery'] as const).map(cat => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`px-3 py-2 text-xs font-mono rounded border transition-colors duration-150 ${
                categoryFilter === cat
                  ? 'bg-teal-950/40 text-teal-300 border-teal-500/30'
                  : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:bg-zinc-800'
              }`}
            >
              {cat === 'all' ? 'ALL' : cat.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Item List — 2 columns */}
        <div className="lg:col-span-2">
          <div className="bg-zinc-900 border border-zinc-800 rounded overflow-hidden">
            <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Package className="w-4 h-4 text-zinc-400" />
                <span className="text-xs font-mono text-zinc-400 uppercase tracking-wider">Inventory Items</span>
              </div>
              <span className="text-xs font-mono text-zinc-500">{filteredItems.length} items</span>
            </div>

            {loading ? (
              <div className="p-8 text-center">
                <div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
                <p className="text-xs font-mono text-zinc-500">Loading inventory...</p>
              </div>
            ) : (
              <div className="divide-y divide-zinc-800/50 max-h-[600px] overflow-y-auto">
                {filteredItems.map(item => (
                  <div key={item.id} className="px-4 py-3 flex items-center justify-between hover:bg-zinc-800/30 transition-colors duration-100">
                    <div className="flex items-center space-x-3 min-w-0 flex-1">
                      <div className={`p-1.5 rounded ${item.category === 'furniture' ? 'bg-amber-950/30' : 'bg-emerald-950/30'}`}>
                        {item.category === 'furniture'
                          ? <Sofa className="w-3.5 h-3.5 text-amber-400" />
                          : <ShoppingBag className="w-3.5 h-3.5 text-emerald-400" />}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-mono text-zinc-200 truncate">{item.name}</p>
                        <p className="text-[10px] font-mono text-zinc-500">{item.sku}</p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-3">
                      <StockBadge available={item.available_stock} reorderPoint={item.reorder_point} unit={item.unit} />
                      <div className="flex space-x-1">
                        <button
                          onClick={() => { setStockModal({ item, action: 'IN' }); setStockQty(''); setStockNote(''); setStockError(null); setStockSuccess(null); }}
                          className="p-1.5 rounded border border-zinc-700 hover:border-emerald-500/30 hover:bg-emerald-950/20 text-zinc-400 hover:text-emerald-400 transition-colors duration-150"
                          title="Stock In"
                        >
                          <ArrowDownRight className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => { setStockModal({ item, action: 'OUT' }); setStockQty(''); setStockNote(''); setStockError(null); setStockSuccess(null); }}
                          className="p-1.5 rounded border border-zinc-700 hover:border-red-500/30 hover:bg-red-950/20 text-zinc-400 hover:text-red-400 transition-colors duration-150"
                          title="Stock Out"
                        >
                          <ArrowUpRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
                {filteredItems.length === 0 && (
                  <div className="p-8 text-center">
                    <p className="text-xs font-mono text-zinc-500">No items match your search.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* My Recent Activity — 1 column */}
        <div>
          <div className="bg-zinc-900 border border-zinc-800 rounded overflow-hidden">
            <div className="px-4 py-3 border-b border-zinc-800 flex items-center space-x-2">
              <Clock className="w-4 h-4 text-zinc-400" />
              <span className="text-xs font-mono text-zinc-400 uppercase tracking-wider">My Recent Activity</span>
            </div>

            {activityLoading ? (
              <div className="p-8 text-center">
                <div className="w-6 h-6 border-2 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                <p className="text-xs font-mono text-zinc-500">Loading...</p>
              </div>
            ) : activity.length === 0 ? (
              <div className="p-8 text-center">
                <Clock className="w-8 h-8 text-zinc-700 mx-auto mb-2" />
                <p className="text-xs font-mono text-zinc-500">No activity recorded yet.</p>
              </div>
            ) : (
              <div className="divide-y divide-zinc-800/50 max-h-[600px] overflow-y-auto">
                {activity.map(entry => (
                  <div key={entry.id} className="px-4 py-2.5">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-mono text-zinc-300 truncate flex-1">{entry.item_name}</span>
                      <span className={`text-[10px] font-mono font-bold ml-2 px-1.5 py-0.5 rounded ${
                        entry.type === 'IN'
                          ? 'bg-emerald-950/30 text-emerald-400 border border-emerald-500/20'
                          : 'bg-red-950/30 text-red-400 border border-red-500/20'
                      }`}>
                        {entry.type === 'IN' ? '+' : ''}{entry.change_qty}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono text-zinc-600">{entry.item_sku}</span>
                      <span className="text-[10px] font-mono text-zinc-600">{formatTimestamp(entry.created_at)}</span>
                    </div>
                    {entry.reference_note && (
                      <p className="text-[10px] font-mono text-zinc-600 mt-0.5 truncate">{entry.reference_note}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Stock Action Modal */}
      {stockModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setStockModal(null)}>
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg w-full max-w-md p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center space-x-2">
                {stockModal.action === 'IN'
                  ? <ArrowDownRight className="w-5 h-5 text-emerald-400" />
                  : <ArrowUpRight className="w-5 h-5 text-red-400" />}
                <h3 className="text-sm font-mono font-bold text-zinc-100">
                  {stockModal.action === 'IN' ? 'STOCK IN' : 'STOCK OUT'}
                </h3>
              </div>
              <button onClick={() => setStockModal(null)} className="text-zinc-500 hover:text-zinc-300">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mb-4 p-3 bg-zinc-950 rounded border border-zinc-800">
              <p className="text-xs font-mono text-zinc-400">{stockModal.item.sku}</p>
              <p className="text-sm font-mono text-zinc-200">{stockModal.item.name}</p>
              <p className="text-xs font-mono text-zinc-500 mt-1">Available: {stockModal.item.available_stock} {stockModal.item.unit}</p>
            </div>

            {stockError && (
              <div className="mb-3 bg-red-950/20 border border-red-500/30 rounded p-2.5 flex items-start space-x-2">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <span className="text-xs text-red-300 font-mono">{stockError}</span>
              </div>
            )}
            {stockSuccess && (
              <div className="mb-3 bg-emerald-950/20 border border-emerald-500/30 rounded p-2.5 flex items-start space-x-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span className="text-xs text-emerald-300 font-mono">{stockSuccess}</span>
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-mono text-zinc-400 uppercase tracking-wider mb-1">Quantity</label>
                <input
                  type="number"
                  min="1"
                  value={stockQty}
                  onChange={e => setStockQty(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded text-sm font-mono text-zinc-100 focus:outline-none focus:ring-1 focus:ring-teal-500 focus:border-teal-500"
                  placeholder="Enter quantity"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-xs font-mono text-zinc-400 uppercase tracking-wider mb-1">Note (Optional)</label>
                <input
                  type="text"
                  value={stockNote}
                  onChange={e => setStockNote(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded text-sm font-mono text-zinc-100 focus:outline-none focus:ring-1 focus:ring-teal-500 focus:border-teal-500"
                  placeholder="Transaction note"
                />
              </div>
              <button
                onClick={handleStockAction}
                disabled={stockSubmitting || !stockQty}
                className={`w-full py-2 px-4 rounded text-sm font-mono font-medium transition-colors duration-150 disabled:opacity-50 ${
                  stockModal.action === 'IN'
                    ? 'bg-emerald-950/30 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-950/50'
                    : 'bg-red-950/30 text-red-300 border border-red-500/30 hover:bg-red-950/50'
                }`}
              >
                {stockSubmitting ? 'PROCESSING...' : 'LOG TRANSACTION'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Operations;
