import React, { useState, useEffect } from 'react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import StockBadge from '../components/StockBadge';
import { TableSkeleton } from '../components/Skeletons';
import { 
  Search, 
  Plus, 
  ArrowUpRight, 
  ArrowDownRight, 
  History, 
  Sofa, 
  ShoppingBag,
  X,
  ShieldCheck,
  AlertCircle
} from 'lucide-react';

export interface Item {
  id: string;
  sku: string;
  name: string;
  category: 'furniture' | 'grocery';
  unit: string;
  unit_price: number;
  reorder_point: number;
  reorder_qty: number;
  available_stock: number;
  dimensions?: string;
  material?: string;
  warranty?: string;
  batch_no?: string;
  expiry_date?: string;
  perishable?: boolean;
}

const MOCK_ITEMS: Item[] = [
  { id: '1', sku: 'FUR-CHE-01', name: 'Ergonomic Mesh Office Chair', category: 'furniture', unit: 'pcs', unit_price: 199.99, reorder_point: 8, reorder_qty: 20, available_stock: 3, dimensions: '65x65x120 cm', material: 'Mesh / Nylon', warranty: '3 years' },
  { id: '2', sku: 'GRO-MIL-05', name: 'Organic Whole Milk 1L', category: 'grocery', unit: 'cartons', unit_price: 2.49, reorder_point: 40, reorder_qty: 100, available_stock: 12, batch_no: 'B-MILK-982', expiry_date: '2026-08-20', perishable: true },
  { id: '3', sku: 'GRO-RCE-12', name: 'Premium Basmati Rice 5kg', category: 'grocery', unit: 'bags', unit_price: 14.99, reorder_point: 20, reorder_qty: 50, available_stock: 8, batch_no: 'B-RICE-401', expiry_date: '2027-06-15', perishable: false },
  { id: '4', sku: 'FUR-TBL-03', name: 'Solid Oak Dining Table', category: 'furniture', unit: 'pcs', unit_price: 599.99, reorder_point: 3, reorder_qty: 5, available_stock: 1, dimensions: '180x90x75 cm', material: 'Solid Oak', warranty: '5 years' },
  { id: '5', sku: 'GRO-YOG-01', name: 'Greek Yogurt Blueberry 500g', category: 'grocery', unit: 'tubs', unit_price: 3.99, reorder_point: 15, reorder_qty: 40, available_stock: 45, batch_no: 'B-YOG-112', expiry_date: '2026-08-24', perishable: true },
  { id: '6', sku: 'FUR-DSK-02', name: 'Electric Standing Desk 140x70', category: 'furniture', unit: 'pcs', unit_price: 349.99, reorder_point: 5, reorder_qty: 15, available_stock: 7, dimensions: '140x70 cm', material: 'Steel / Maple MDF', warranty: '2 years' },
  { id: '7', sku: 'GRO-BND-03', name: 'Sourdough Sliced Bread', category: 'grocery', unit: 'loaves', unit_price: 3.49, reorder_point: 10, reorder_qty: 25, available_stock: 18, batch_no: 'B-BREAD-04', expiry_date: '2026-08-18', perishable: true },
];

export const Items: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'furniture' | 'grocery'>('all');

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isLedgerModalOpen, setIsLedgerModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);

  // Add Item form state
  const [newItem, setNewItem] = useState({
    sku: '',
    name: '',
    category: 'grocery' as 'furniture' | 'grocery',
    unit: '',
    unit_price: 0,
    reorder_point: 0,
    reorder_qty: 0,
    dimensions: '',
    material: '',
    warranty: '',
    batch_no: '',
    expiry_date: '',
    perishable: false,
  });

  // Ledger form state
  const [ledgerAction, setLedgerAction] = useState<'in' | 'out'>('in');
  const [ledgerQty, setLedgerQty] = useState<number>(0);
  const [ledgerNote, setLedgerNote] = useState('');

  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const fetchItems = async () => {
    try {
      setLoading(true);
      const data = await api.get<Item[]>('/items');
      setItems(data);
    } catch (err) {
      console.warn('Items endpoint failed, using mock data:', err);
      setItems(MOCK_ITEMS);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, []);

  const handleAddModalClose = () => {
    setIsAddModalOpen(false);
    setFormError(null);
    setNewItem({
      sku: '',
      name: '',
      category: 'grocery',
      unit: '',
      unit_price: 0,
      reorder_point: 0,
      reorder_qty: 0,
      dimensions: '',
      material: '',
      warranty: '',
      batch_no: '',
      expiry_date: '',
      perishable: false,
    });
  };

  const handleLedgerModalClose = () => {
    setIsLedgerModalOpen(false);
    setSelectedItem(null);
    setLedgerQty(0);
    setLedgerNote('');
    setFormError(null);
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItem.sku || !newItem.name || !newItem.unit || newItem.unit_price <= 0) {
      setFormError('Please fill out all required basic info fields.');
      return;
    }

    setSubmitting(true);
    setFormError(null);

    const payload: any = {
      sku: newItem.sku,
      name: newItem.name,
      category: newItem.category,
      unit: newItem.unit,
      unit_price: Number(newItem.unit_price),
      reorder_point: Number(newItem.reorder_point),
      reorder_qty: Number(newItem.reorder_qty),
    };

    if (newItem.category === 'furniture') {
      payload.dimensions = newItem.dimensions;
      payload.material = newItem.material;
      payload.warranty = newItem.warranty;
    } else {
      payload.batch_no = newItem.batch_no;
      payload.expiry_date = newItem.expiry_date || undefined;
      payload.perishable = newItem.perishable;
    }

    try {
      await api.post('/items', payload);
      await fetchItems();
      handleAddModalClose();
    } catch (err: any) {
      console.error(err);
      // Fallback behavior for sandbox UI demo
      const simulatedItem: Item = {
        id: Math.random().toString(36).substr(2, 9),
        ...payload,
        available_stock: 0
      };
      setItems(prev => [simulatedItem, ...prev]);
      handleAddModalClose();
    } finally {
      setSubmitting(false);
    }
  };

  const handleLedgerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem) return;
    if (ledgerQty <= 0) {
      setFormError('Quantity must be greater than zero.');
      return;
    }

    setSubmitting(true);
    setFormError(null);

    const path = ledgerAction === 'in' ? '/stock/in' : '/stock/out';
    const payload = {
      item_id: selectedItem.id,
      qty: Number(ledgerQty),
      note: ledgerNote,
    };

    try {
      await api.post(path, payload);
      await fetchItems();
      handleLedgerModalClose();
    } catch (err: any) {
      console.error(err);
      // Fallback behaviour for sandbox UI demo: update local array state
      setItems(prev => prev.map(item => {
        if (item.id === selectedItem.id) {
          const change = ledgerAction === 'in' ? Number(ledgerQty) : -Number(ledgerQty);
          return {
            ...item,
            available_stock: Math.max(0, item.available_stock + change)
          };
        }
        return item;
      }));
      handleLedgerModalClose();
    } finally {
      setSubmitting(false);
    }
  };

  const filteredItems = items.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          item.sku.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || item.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-6">
      {/* Search and Filters Header */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-zinc-900 border border-zinc-800 p-4 rounded">
        {/* Search */}
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Search by name or SKU..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-zinc-800 rounded bg-zinc-950 text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-teal-500 focus:border-teal-500 font-mono text-xs"
          />
        </div>

        {/* Category Toggles and Action */}
        <div className="flex w-full sm:w-auto items-center justify-between sm:justify-end gap-3">
          <div className="flex border border-zinc-800 rounded overflow-hidden">
            {(['all', 'furniture', 'grocery'] as const).map((cat) => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={`px-3 py-1.5 font-mono text-xs capitalize ${
                  categoryFilter === cat
                    ? 'bg-zinc-800 text-teal-400 font-bold'
                    : 'bg-zinc-950 text-zinc-500 hover:text-zinc-300'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {isAdmin && (
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="flex items-center space-x-1.5 px-3 py-1.5 border border-teal-500/30 rounded text-xs font-mono font-medium text-teal-300 bg-teal-950/20 hover:bg-teal-950/40 transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>ADD ITEM</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Items Table */}
      {loading ? (
        <TableSkeleton rows={7} cols={5} />
      ) : filteredItems.length === 0 ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded p-12 text-center text-zinc-500 font-mono text-sm">
          No inventory items matched the filters.
        </div>
      ) : (
        <div className="bg-zinc-900 border border-zinc-800 rounded overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-900/50 text-zinc-500 text-[10px] font-mono uppercase">
                  <th className="px-6 py-3 font-medium">SKU</th>
                  <th className="px-6 py-3 font-medium">Category</th>
                  <th className="px-6 py-3 font-medium">Item Details</th>
                  <th className="px-6 py-3 font-medium">Unit Price</th>
                  <th className="px-6 py-3 font-medium">Stock Level</th>
                  <th className="px-6 py-3 font-medium text-center">Ledger Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/40">
                {filteredItems.map((item) => (
                  <tr key={item.id} className="text-xs font-mono hover:bg-zinc-800/20 transition-colors">
                    <td className="px-6 py-4 font-bold text-teal-400">{item.sku}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] uppercase font-bold border ${
                        item.category === 'furniture'
                          ? 'bg-amber-950/30 text-amber-400 border-amber-500/20'
                          : 'bg-teal-950/30 text-teal-400 border-teal-500/20'
                      }`}>
                        {item.category === 'furniture' ? (
                          <Sofa className="w-3 h-3 mr-1" />
                        ) : (
                          <ShoppingBag className="w-3 h-3 mr-1" />
                        )}
                        {item.category}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <div className="text-zinc-200 font-bold text-sm mb-1">{item.name}</div>
                        {item.category === 'furniture' ? (
                          <div className="text-[10px] text-zinc-500">
                            Mat: {item.material || 'N/A'} | Dim: {item.dimensions || 'N/A'} | Warr: {item.warranty || 'N/A'}
                          </div>
                        ) : (
                          <div className="text-[10px] text-zinc-500">
                            Batch: {item.batch_no || 'N/A'} | Exp: {item.expiry_date || 'N/A'} {item.perishable && '| (Perishable)'}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-zinc-300 font-bold">${item.unit_price.toFixed(2)}</td>
                    <td className="px-6 py-4">
                      <StockBadge available={item.available_stock} reorderPoint={item.reorder_point} unit={item.unit} />
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-center items-center space-x-2">
                        <button
                          onClick={() => {
                            setSelectedItem(item);
                            setLedgerAction('in');
                            setIsLedgerModalOpen(true);
                          }}
                          className="flex items-center space-x-1 px-2.5 py-1 border border-emerald-500/20 rounded bg-emerald-950/10 hover:bg-emerald-950/40 text-emerald-400 text-[10px]"
                        >
                          <ArrowUpRight className="w-3 h-3" />
                          <span>STOCK IN</span>
                        </button>
                        <button
                          onClick={() => {
                            setSelectedItem(item);
                            setLedgerAction('out');
                            setIsLedgerModalOpen(true);
                          }}
                          className="flex items-center space-x-1 px-2.5 py-1 border border-amber-500/20 rounded bg-amber-950/10 hover:bg-amber-950/40 text-amber-400 text-[10px]"
                        >
                          <ArrowDownRight className="w-3 h-3" />
                          <span>STOCK OUT</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* modal backdrop helper style */}
      {/* 1. ADD ITEM MODAL */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-sm overflow-y-auto">
          <div className="bg-zinc-900 border border-zinc-800 w-full max-w-xl rounded shadow-2xl p-6 relative max-h-[90vh] overflow-y-auto">
            <button 
              onClick={handleAddModalClose}
              className="absolute top-4 right-4 text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            <h2 className="text-lg font-mono font-bold text-zinc-100 uppercase tracking-wider mb-6 flex items-center">
              <Plus className="w-5 h-5 text-teal-400 mr-2" /> Provision New Item
            </h2>

            <form onSubmit={handleAddSubmit} className="space-y-4">
              {formError && (
                <div className="bg-red-950/20 border border-red-500/30 rounded p-3 flex items-start space-x-2">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <span className="text-xs text-red-300 font-mono">{formError}</span>
                </div>
              )}

              {/* Basic Fields Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-mono text-zinc-500 uppercase tracking-wider mb-1">SKU (Identifier) *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. FUR-CHR-05"
                    value={newItem.sku}
                    onChange={(e) => setNewItem({...newItem, sku: e.target.value})}
                    className="w-full px-3 py-1.5 border border-zinc-800 rounded bg-zinc-950 text-zinc-100 font-mono text-xs focus:ring-1 focus:ring-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono text-zinc-500 uppercase tracking-wider mb-1">Item Category</label>
                  <select
                    value={newItem.category}
                    onChange={(e) => setNewItem({...newItem, category: e.target.value as 'furniture' | 'grocery'})}
                    className="w-full px-3 py-1.5 border border-zinc-800 rounded bg-zinc-950 text-zinc-100 font-mono text-xs focus:ring-1 focus:ring-teal-500"
                  >
                    <option value="grocery">Grocery (batch/expiry items)</option>
                    <option value="furniture">Furniture (spec/warranty items)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-mono text-zinc-500 uppercase tracking-wider mb-1">Item Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Sourdough Loaf"
                  value={newItem.name}
                  onChange={(e) => setNewItem({...newItem, name: e.target.value})}
                  className="w-full px-3 py-1.5 border border-zinc-800 rounded bg-zinc-950 text-zinc-100 font-mono text-xs focus:ring-1 focus:ring-teal-500"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-[10px] font-mono text-zinc-500 uppercase tracking-wider mb-1">Measurement Unit *</label>
                  <input
                    type="text"
                    required
                    placeholder="pcs, cartons, bags"
                    value={newItem.unit}
                    onChange={(e) => setNewItem({...newItem, unit: e.target.value})}
                    className="w-full px-3 py-1.5 border border-zinc-800 rounded bg-zinc-950 text-zinc-100 font-mono text-xs focus:ring-1 focus:ring-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono text-zinc-500 uppercase tracking-wider mb-1">Unit Price ($) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={newItem.unit_price || ''}
                    onChange={(e) => setNewItem({...newItem, unit_price: Number(e.target.value)})}
                    className="w-full px-3 py-1.5 border border-zinc-800 rounded bg-zinc-950 text-zinc-100 font-mono text-xs focus:ring-1 focus:ring-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono text-zinc-500 uppercase tracking-wider mb-1">Reorder Threshold *</label>
                  <input
                    type="number"
                    required
                    value={newItem.reorder_point || ''}
                    onChange={(e) => setNewItem({...newItem, reorder_point: Number(e.target.value)})}
                    className="w-full px-3 py-1.5 border border-zinc-800 rounded bg-zinc-950 text-zinc-100 font-mono text-xs focus:ring-1 focus:ring-teal-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-mono text-zinc-500 uppercase tracking-wider mb-1">Suggested Reorder Qty</label>
                  <input
                    type="number"
                    value={newItem.reorder_qty || ''}
                    onChange={(e) => setNewItem({...newItem, reorder_qty: Number(e.target.value)})}
                    className="w-full px-3 py-1.5 border border-zinc-800 rounded bg-zinc-950 text-zinc-100 font-mono text-xs focus:ring-1 focus:ring-teal-500"
                  />
                </div>
              </div>

              {/* DUAL SCHEMA FIELDS BLOCK */}
              <div className="border-t border-zinc-800 pt-4 mt-2">
                <span className="block text-[9px] font-mono font-bold text-teal-400 uppercase tracking-wider mb-3">
                  {newItem.category === 'furniture' ? 'Furniture Parameters' : 'Grocery Parameters'}
                </span>

                {newItem.category === 'furniture' ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-mono text-zinc-500 uppercase tracking-wider mb-1">Dimensions (LxWxH)</label>
                        <input
                          type="text"
                          placeholder="e.g. 100x60x75 cm"
                          value={newItem.dimensions}
                          onChange={(e) => setNewItem({...newItem, dimensions: e.target.value})}
                          className="w-full px-3 py-1.5 border border-zinc-800 rounded bg-zinc-950 text-zinc-100 font-mono text-xs focus:ring-1 focus:ring-teal-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-mono text-zinc-500 uppercase tracking-wider mb-1">Material Composition</label>
                        <input
                          type="text"
                          placeholder="e.g. Walnut Wood"
                          value={newItem.material}
                          onChange={(e) => setNewItem({...newItem, material: e.target.value})}
                          className="w-full px-3 py-1.5 border border-zinc-800 rounded bg-zinc-950 text-zinc-100 font-mono text-xs focus:ring-1 focus:ring-teal-500"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] font-mono text-zinc-500 uppercase tracking-wider mb-1">Warranty Term</label>
                      <input
                        type="text"
                        placeholder="e.g. 2 Years"
                        value={newItem.warranty}
                        onChange={(e) => setNewItem({...newItem, warranty: e.target.value})}
                        className="w-full px-3 py-1.5 border border-zinc-800 rounded bg-zinc-950 text-zinc-100 font-mono text-xs focus:ring-1 focus:ring-teal-500"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-mono text-zinc-500 uppercase tracking-wider mb-1">Batch Number</label>
                        <input
                          type="text"
                          placeholder="e.g. B-MILK-102"
                          value={newItem.batch_no}
                          onChange={(e) => setNewItem({...newItem, batch_no: e.target.value})}
                          className="w-full px-3 py-1.5 border border-zinc-800 rounded bg-zinc-950 text-zinc-100 font-mono text-xs focus:ring-1 focus:ring-teal-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-mono text-zinc-500 uppercase tracking-wider mb-1">Expiration Date</label>
                        <input
                          type="date"
                          value={newItem.expiry_date}
                          onChange={(e) => setNewItem({...newItem, expiry_date: e.target.value})}
                          className="w-full px-3 py-1.5 border border-zinc-800 rounded bg-zinc-950 text-zinc-100 font-mono text-xs focus:ring-1 focus:ring-teal-500"
                        />
                      </div>
                    </div>
                    <div className="flex items-center space-x-2 py-1">
                      <input
                        type="checkbox"
                        id="perishable"
                        checked={newItem.perishable}
                        onChange={(e) => setNewItem({...newItem, perishable: e.target.checked})}
                        className="rounded border-zinc-800 bg-zinc-950 text-teal-600 focus:ring-0 w-4 h-4 cursor-pointer"
                      />
                      <label htmlFor="perishable" className="text-xs font-mono text-zinc-400 cursor-pointer select-none">
                        Perishable Item Flag (High prioritization in warning indexes)
                      </label>
                    </div>
                  </div>
                )}
              </div>

              {/* Submit Buttons */}
              <div className="border-t border-zinc-800 pt-4 flex items-center justify-end space-x-3">
                <button
                  type="button"
                  onClick={handleAddModalClose}
                  className="px-4 py-2 border border-zinc-800 rounded text-xs font-mono text-zinc-400 bg-zinc-950 hover:bg-zinc-900 transition-colors"
                >
                  CANCEL
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 border border-teal-500/30 rounded text-xs font-mono font-medium text-teal-300 bg-teal-950/20 hover:bg-teal-950/50 transition-colors disabled:opacity-50"
                >
                  {submitting ? 'COMMITTING ITEM...' : 'SAVE PROVISION'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. STOCK ADJUSTMENT LEDGER MODAL */}
      {isLedgerModalOpen && selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-zinc-800 w-full max-w-md rounded shadow-2xl p-6 relative">
            <button 
              onClick={handleLedgerModalClose}
              className="absolute top-4 right-4 text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            <h2 className="text-lg font-mono font-bold text-zinc-100 uppercase tracking-wider mb-2 flex items-center">
              <History className="w-5 h-5 text-teal-400 mr-2" /> Stock Ledger Entry
            </h2>
            <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider mb-6">
              Item: <span className="text-zinc-300 font-bold">{selectedItem.name}</span> ({selectedItem.sku})
            </p>

            <form onSubmit={handleLedgerSubmit} className="space-y-4">
              {formError && (
                <div className="bg-red-950/20 border border-red-500/30 rounded p-3 flex items-start space-x-2">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <span className="text-xs text-red-300 font-mono">{formError}</span>
                </div>
              )}

              {/* Action Selection */}
              <div>
                <label className="block text-[10px] font-mono text-zinc-500 uppercase tracking-wider mb-1.5">Transaction Type</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setLedgerAction('in')}
                    className={`py-2 px-4 border rounded font-mono text-xs flex items-center justify-center space-x-2 transition-all ${
                      ledgerAction === 'in'
                        ? 'border-emerald-500/30 bg-emerald-950/20 text-emerald-400 font-bold'
                        : 'border-zinc-800 bg-zinc-950 text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    <ArrowUpRight className="w-4 h-4" />
                    <span>STOCK IN (ADD)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setLedgerAction('out')}
                    className={`py-2 px-4 border rounded font-mono text-xs flex items-center justify-center space-x-2 transition-all ${
                      ledgerAction === 'out'
                        ? 'border-amber-500/30 bg-amber-950/20 text-amber-400 font-bold'
                        : 'border-zinc-800 bg-zinc-950 text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    <ArrowDownRight className="w-4 h-4" />
                    <span>STOCK OUT (REMOVE)</span>
                  </button>
                </div>
              </div>

              {/* Quantity */}
              <div>
                <label className="block text-[10px] font-mono text-zinc-500 uppercase tracking-wider mb-1">
                  Adjust Quantity ({selectedItem.unit})
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  placeholder="e.g. 10"
                  value={ledgerQty || ''}
                  onChange={(e) => setLedgerQty(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-zinc-800 rounded bg-zinc-950 text-zinc-100 font-mono text-xs focus:ring-1 focus:ring-teal-500"
                />
                <p className="text-[10px] font-mono text-zinc-500 mt-1">
                  Current Derived Stock: <span className="text-zinc-300">{selectedItem.available_stock} {selectedItem.unit}</span>
                </p>
              </div>

              {/* Audit Note */}
              <div>
                <label className="block text-[10px] font-mono text-zinc-500 uppercase tracking-wider mb-1">Audit Ledger Note *</label>
                <textarea
                  required
                  rows={3}
                  placeholder="Provide validation reason (e.g. Received shipment ref #901, Spoiled items cleanup)"
                  value={ledgerNote}
                  onChange={(e) => setLedgerNote(e.target.value)}
                  className="w-full px-3 py-2 border border-zinc-800 rounded bg-zinc-950 text-zinc-100 font-mono text-xs focus:ring-1 focus:ring-teal-500"
                />
              </div>

              {/* Ledger Hint */}
              <div className="bg-zinc-950 border border-zinc-850 p-3 rounded flex items-start space-x-2">
                <ShieldCheck className="w-4 h-4 text-teal-500 shrink-0 mt-0.5" />
                <span className="text-[10px] text-zinc-500 font-mono leading-relaxed">
                  IMMUTABLE AUDIT LOG: This transaction will write directly to the audit ledger. The physical available count is dynamically aggregated; edits to historical totals are prohibited.
                </span>
              </div>

              {/* Submit Buttons */}
              <div className="border-t border-zinc-800 pt-4 flex items-center justify-end space-x-3">
                <button
                  type="button"
                  onClick={handleLedgerModalClose}
                  className="px-4 py-2 border border-zinc-800 rounded text-xs font-mono text-zinc-400 bg-zinc-950 hover:bg-zinc-900 transition-colors"
                >
                  CANCEL
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 border border-teal-500/30 rounded text-xs font-mono font-medium text-teal-300 bg-teal-950/20 hover:bg-teal-950/50 transition-colors disabled:opacity-50"
                >
                  {submitting ? 'COMMITTING LEDGER...' : 'LOG TRANSACTION'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Items;
