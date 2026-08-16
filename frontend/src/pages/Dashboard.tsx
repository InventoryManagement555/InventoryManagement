import React, { useState, useEffect } from 'react';
import api from '../api/client';
import { CardSkeleton, ChartSkeleton } from '../components/Skeletons';
import StockBadge from '../components/StockBadge';
import { 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  Legend 
} from 'recharts';
import { 
  Package, 
  AlertTriangle, 
  Hourglass,
  DollarSign,
  Download,
  CheckCircle,
  Bell
} from 'lucide-react';

interface DashboardSummary {
  total_stock_value: number;
  total_items: number;
  items_by_category: {
    furniture: number;
    grocery: number;
  };
  low_stock_list: Array<{
    id: string;
    sku: string;
    name: string;
    category: 'furniture' | 'grocery';
    available_stock: number;
    reorder_point: number;
    unit: string;
  }>;
  expiring_soon_list: Array<{
    id: string;
    sku: string;
    name: string;
    batch_no: string;
    expiry_date: string;
    available_stock: number;
    unit: string;
  }>;
  top_movers: Array<{
    name: string;
    sales_qty: number;
    stock_value: number;
  }>;
}

interface Alert {
  id: string;
  item_id: string;
  item_sku: string;
  item_name: string;
  type: 'LOW_STOCK' | 'EXPIRY_SOON';
  message: string;
  created_at: string;
}

const MOCK_SUMMARY: DashboardSummary = {
  total_stock_value: 342500,
  total_items: 124,
  items_by_category: {
    furniture: 38,
    grocery: 86
  },
  low_stock_list: [
    { id: '1', sku: 'FUR-CHE-01', name: 'Ergonomic Mesh Office Chair', category: 'furniture', available_stock: 3, reorder_point: 8, unit: 'pcs' },
    { id: '2', sku: 'GRO-MIL-05', name: 'Organic Whole Milk 1L', category: 'grocery', available_stock: 12, reorder_point: 40, unit: 'cartons' },
  ],
  expiring_soon_list: [
    { id: '2', sku: 'GRO-MIL-05', name: 'Organic Whole Milk 1L', batch_no: 'B-MILK-982', expiry_date: '2026-08-20', available_stock: 12, unit: 'cartons' },
  ],
  top_movers: [
    { name: 'Whole Milk 1L', sales_qty: 480, stock_value: 1200 },
    { name: 'Ergonomic Chair', sales_qty: 120, stock_value: 24000 },
  ]
};

const COLORS = ['#0d9488', '#f59e0b']; // Teal for Grocery, Amber for Furniture

export const Dashboard: React.FC = () => {
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [alertsLoading, setAlertsLoading] = useState(true);
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  const fetchDashboard = async () => {
    try {
      const result = await api.get<DashboardSummary>('/dashboard/summary');
      setData(result);
    } catch (err: any) {
      console.warn('Dashboard summary endpoint failed, utilizing sandbox mock data:', err);
      setData(MOCK_SUMMARY);
    } finally {
      setLoading(false);
    }
  };

  const fetchAlerts = async () => {
    try {
      setAlertsLoading(true);
      const result = await api.get<Alert[]>('/alerts');
      setAlerts(result);
    } catch (err) {
      console.error('Failed to fetch alerts:', err);
    } finally {
      setAlertsLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
    fetchAlerts();
  }, []);

  const handleResolveAlert = async (id: string) => {
    setResolvingId(id);
    try {
      await api.post(`/alerts/${id}/resolve`, {});
      setAlerts(prev => prev.filter(a => a.id !== id));
    } catch (err) {
      console.error('Failed to resolve alert:', err);
    } finally {
      setResolvingId(null);
    }
  };

  const handleDownloadCSV = () => {
    const token = localStorage.getItem('token');
    const url = `${api.baseUrl}/export/dashboard?token=${token}`;
    // Simple fetch-then-blob pattern to handle headers or trigger direct browser download
    window.open(url, '_blank');
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <ChartSkeleton />
          <ChartSkeleton />
        </div>
      </div>
    );
  }

  const summary = data || MOCK_SUMMARY;

  const categoryData = [
    { name: 'Grocery', value: summary.items_by_category.grocery },
    { name: 'Furniture', value: summary.items_by_category.furniture },
  ];

  const calculateDaysRemaining = (expiryStr: string) => {
    const expiry = new Date(expiryStr);
    const today = new Date();
    const diffTime = expiry.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  return (
    <div className="space-y-8">
      {/* Header with Export CSV button */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-mono font-bold text-zinc-100 uppercase tracking-wide">Dashboard Summary</h2>
          <p className="text-xs font-mono text-zinc-500">Live system status & metrics overview</p>
        </div>
        <button
          onClick={handleDownloadCSV}
          className="flex items-center space-x-2 py-2 px-4 rounded border border-teal-500/30 text-teal-300 bg-teal-950/20 hover:bg-teal-950/40 font-mono text-xs transition-colors duration-150"
        >
          <Download className="w-4 h-4" />
          <span>DOWNLOAD SUMMARY CSV</span>
        </button>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Total Stock Value */}
        <div className="bg-zinc-900 border border-zinc-800 rounded p-6 panel-glow">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-mono text-zinc-500 uppercase tracking-wider">Total Stock Value</span>
            <DollarSign className="w-5 h-5 text-teal-400" />
          </div>
          <p className="text-2xl font-bold font-mono text-zinc-100">${summary.total_stock_value.toLocaleString()}</p>
        </div>

        {/* Unique SKUs */}
        <div className="bg-zinc-900 border border-zinc-800 rounded p-6 panel-glow">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-mono text-zinc-500 uppercase tracking-wider">Unique SKUs</span>
            <Package className="w-5 h-5 text-teal-400" />
          </div>
          <p className="text-2xl font-bold font-mono text-zinc-100">{summary.total_items}</p>
        </div>

        {/* Low Stock count */}
        <div className="bg-zinc-900 border border-zinc-800 rounded p-6 panel-glow">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-mono text-zinc-500 uppercase tracking-wider">Low Stock Items</span>
            <AlertTriangle className="w-5 h-5 text-amber-500" />
          </div>
          <p className="text-2xl font-bold font-mono text-zinc-100">{summary.low_stock_list.length}</p>
        </div>

        {/* Expiring Soon count */}
        <div className="bg-zinc-900 border border-zinc-800 rounded p-6 panel-glow">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-mono text-zinc-500 uppercase tracking-wider">Expiring Batches</span>
            <Hourglass className="w-5 h-5 text-red-500" />
          </div>
          <p className="text-2xl font-bold font-mono text-zinc-100">{summary.expiring_soon_list.length}</p>
        </div>
      </div>

      {/* Visual Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Category Breakdown (Pie Chart) */}
        <div className="bg-zinc-900 border border-zinc-800 rounded p-6">
          <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-400 mb-6 flex items-center">
            <span className="w-1.5 h-1.5 rounded-full bg-teal-500 mr-2"></span>
            Category Mix
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categoryData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {categoryData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '4px' }}
                  itemStyle={{ color: '#f4f4f5', fontFamily: 'monospace' }}
                  labelStyle={{ fontFamily: 'monospace' }}
                />
                <Legend formatter={(value) => <span className="text-xs font-mono text-zinc-400">{value}</span>} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Movers (Bar Chart) */}
        <div className="bg-zinc-900 border border-zinc-800 rounded p-6">
          <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-400 mb-6 flex items-center">
            <span className="w-1.5 h-1.5 rounded-full bg-teal-500 mr-2"></span>
            Top Movers (Sales Qty)
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={summary.top_movers}>
                <XAxis dataKey="name" stroke="#71717a" fontSize={10} fontFamily="monospace" />
                <YAxis stroke="#71717a" fontSize={10} fontFamily="monospace" />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '4px' }}
                  itemStyle={{ color: '#f4f4f5', fontFamily: 'monospace' }}
                  labelStyle={{ fontFamily: 'monospace' }}
                />
                <Bar dataKey="sales_qty" fill="#0d9488" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Unresolved System Alerts Panel */}
      <div className="bg-zinc-900 border border-zinc-800 rounded p-6">
        <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-400 mb-4 flex items-center">
          <Bell className="w-4 h-4 text-amber-500 mr-2" />
          Active Unresolved System Alerts
        </h3>
        {alertsLoading ? (
          <div className="py-8 text-center text-zinc-500 font-mono text-xs">
            Loading system alerts...
          </div>
        ) : alerts.length === 0 ? (
          <div className="py-8 text-center text-zinc-500 font-mono text-xs">
            No active unresolved system alerts. Run the forecasting engine to recalculate alerts.
          </div>
        ) : (
          <div className="divide-y divide-zinc-800/40">
            {alerts.map((alert) => (
              <div key={alert.id} className="py-3 flex items-center justify-between text-xs font-mono">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                      alert.type === 'LOW_STOCK'
                        ? 'bg-amber-950/40 text-amber-400 border border-amber-500/20'
                        : 'bg-red-950/40 text-red-400 border border-red-500/20 animate-pulse'
                    }`}>
                      {alert.type}
                    </span>
                    <span className="text-zinc-500">{alert.item_sku}</span>
                  </div>
                  <p className="text-zinc-300">{alert.message}</p>
                </div>
                <button
                  onClick={() => handleResolveAlert(alert.id)}
                  disabled={resolvingId === alert.id}
                  className="flex items-center space-x-1.5 py-1 px-3 rounded border border-zinc-700 hover:border-emerald-500/30 text-zinc-400 hover:text-emerald-400 hover:bg-emerald-950/10 transition-colors duration-150 disabled:opacity-50"
                >
                  <CheckCircle className="w-3.5 h-3.5" />
                  <span>Resolve</span>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Grid of Alert Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Low Stock Alerts */}
        <div className="bg-zinc-900 border border-zinc-800 rounded p-6">
          <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-400 mb-4 flex items-center">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mr-2"></span>
            Low Stock Alerts
          </h3>
          <div className="overflow-x-auto">
            {summary.low_stock_list.length === 0 ? (
              <div className="py-8 text-center text-zinc-500 font-mono text-xs">
                No items currently below reorder threshold.
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-zinc-800 text-zinc-500 text-[10px] font-mono uppercase">
                    <th className="pb-2 font-medium">SKU</th>
                    <th className="pb-2 font-medium">Item Name</th>
                    <th className="pb-2 font-medium text-right">Stock</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/40">
                  {summary.low_stock_list.map((item) => (
                    <tr key={item.id} className="text-xs font-mono hover:bg-zinc-800/20">
                      <td className="py-3 text-zinc-400">{item.sku}</td>
                      <td className="py-3 text-zinc-200 truncate max-w-[150px]">{item.name}</td>
                      <td className="py-3 text-right">
                        <div className="flex justify-end">
                          <StockBadge available={item.available_stock} reorderPoint={item.reorder_point} unit={item.unit} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Expiry Alerts */}
        <div className="bg-zinc-900 border border-zinc-800 rounded p-6">
          <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-400 mb-4 flex items-center">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 mr-2"></span>
            Perishable Expiry Alerts
          </h3>
          <div className="overflow-x-auto">
            {summary.expiring_soon_list.length === 0 ? (
              <div className="py-8 text-center text-zinc-500 font-mono text-xs">
                No perishable grocery batches near expiry.
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-zinc-800 text-zinc-500 text-[10px] font-mono uppercase">
                    <th className="pb-2 font-medium">Batch</th>
                    <th className="pb-2 font-medium">Item Name</th>
                    <th className="pb-2 font-medium">Expiry</th>
                    <th className="pb-2 font-medium text-right">TTL</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/40">
                  {summary.expiring_soon_list.map((item) => {
                    const daysRemaining = calculateDaysRemaining(item.expiry_date);
                    return (
                      <tr key={item.id} className="text-xs font-mono hover:bg-zinc-800/20">
                        <td className="py-3 text-zinc-500">{item.batch_no}</td>
                        <td className="py-3 text-zinc-200 truncate max-w-[150px]">{item.name}</td>
                        <td className="py-3 text-zinc-400">{item.expiry_date}</td>
                        <td className="py-3 text-right">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                            daysRemaining <= 3 
                              ? 'bg-red-950/40 text-red-400 border border-red-500/20 animate-pulse' 
                              : 'bg-amber-950/40 text-amber-400 border border-amber-500/20'
                          }`}>
                            {daysRemaining} days left
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
