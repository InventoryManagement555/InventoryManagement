import React, { useState, useEffect } from 'react';
import api from '../api/client';
import { ClipboardList, ShieldAlert, ChevronLeft, ChevronRight } from 'lucide-react';

interface AuditEntry {
  id: string;
  operator_name: string;
  operator_email: string;
  action: string;
  entity_type: string;
  entity_id: string;
  detail: string;
  created_at: string;
}

interface AuditLogResponse {
  total: number;
  logs: AuditEntry[];
}

export const AuditLog: React.FC = () => {
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const limit = 20;

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const res = await api.get<AuditLogResponse>(`/audit-log?limit=${limit}&offset=${page * limit}`);
      setLogs(res.logs);
      setTotal(res.total);
    } catch (err) {
      console.error('Failed to fetch audit logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [page]);

  const getActionStyles = (action: string) => {
    switch (action) {
      case 'ITEM_CREATED':
        return 'bg-emerald-950/40 text-emerald-400 border border-emerald-500/20';
      case 'ITEM_UPDATED':
        return 'bg-blue-950/40 text-blue-400 border border-blue-500/20';
      case 'FORECAST_RUN':
        return 'bg-purple-950/40 text-purple-400 border border-purple-500/20';
      case 'ALERT_RESOLVED':
        return 'bg-amber-950/40 text-amber-400 border border-amber-500/20';
      default:
        return 'bg-zinc-800 text-zinc-400 border border-zinc-700';
    }
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center space-x-3">
        <div className="bg-teal-500/10 p-2 rounded-lg border border-teal-500/20">
          <ClipboardList className="w-5 h-5 text-teal-400" />
        </div>
        <div>
          <h2 className="text-lg font-mono font-bold text-zinc-100 tracking-wide">ADMINISTRATIVE AUDIT LOG</h2>
          <p className="text-xs font-mono text-zinc-500">Record of modifications, recalculations, and security actions</p>
        </div>
      </div>

      {/* Logs Table Card */}
      <div className="bg-zinc-900 border border-zinc-800 rounded overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between">
          <span className="text-xs font-mono text-zinc-400 uppercase tracking-wider">Audit Trail Records</span>
          <span className="text-[10px] font-mono text-zinc-500">Total entries recorded: {total}</span>
        </div>

        {loading ? (
          <div className="p-12 text-center">
            <div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
            <p className="text-xs font-mono text-zinc-500">Loading audit trail...</p>
          </div>
        ) : logs.length === 0 ? (
          <div className="p-12 text-center text-zinc-500 font-mono text-xs">
            <ShieldAlert className="w-8 h-8 text-zinc-700 mx-auto mb-2" />
            No audit records found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-zinc-800 text-zinc-500 text-xs font-mono uppercase bg-zinc-950/20">
                  <th className="py-3 px-6 font-medium">Timestamp</th>
                  <th className="py-3 px-6 font-medium">Operator</th>
                  <th className="py-3 px-6 font-medium">Action</th>
                  <th className="py-3 px-6 font-medium">Target</th>
                  <th className="py-3 px-6 font-medium">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/40">
                {logs.map((log) => (
                  <tr key={log.id} className="text-xs font-mono hover:bg-zinc-800/10">
                    <td className="py-3 px-6 text-zinc-500 whitespace-nowrap">
                      {new Date(log.created_at).toLocaleString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </td>
                    <td className="py-3 px-6">
                      <div className="min-w-[120px]">
                        <p className="text-zinc-300 font-bold leading-none mb-1">{log.operator_name}</p>
                        <p className="text-[10px] text-zinc-600 leading-none">{log.operator_email}</p>
                      </div>
                    </td>
                    <td className="py-3 px-6">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${getActionStyles(log.action)}`}>
                        {log.action.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-3 px-6 text-zinc-400 whitespace-nowrap">
                      {log.entity_type.toUpperCase()} #{log.entity_id}
                    </td>
                    <td className="py-3 px-6 text-zinc-300 max-w-sm truncate" title={log.detail}>
                      {log.detail}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-zinc-800 flex items-center justify-between font-mono text-xs bg-zinc-950/10">
            <span className="text-zinc-500">
              Page {page + 1} of {totalPages}
            </span>
            <div className="flex space-x-2">
              <button
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
                className="p-1.5 rounded border border-zinc-800 hover:border-zinc-700 bg-zinc-900 disabled:opacity-50 text-zinc-400"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={page === totalPages - 1}
                className="p-1.5 rounded border border-zinc-800 hover:border-zinc-700 bg-zinc-900 disabled:opacity-50 text-zinc-400"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AuditLog;
