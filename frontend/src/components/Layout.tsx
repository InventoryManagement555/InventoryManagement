import React from 'react';
import { Link, useLocation, useNavigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  LayoutDashboard, 
  Package, 
  TrendingUp, 
  MessageSquare, 
  LogOut, 
  User,
  Activity,
  ClipboardList,
  History
} from 'lucide-react';

export const Layout: React.FC = () => {
  const { user, logout, hasRole } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = [
    {
      name: 'Dashboard',
      path: '/dashboard',
      icon: <LayoutDashboard className="w-5 h-5" />,
      allowedRoles: ['admin'] as ('admin' | 'staff')[]
    },
    {
      name: 'Operations',
      path: '/operations',
      icon: <ClipboardList className="w-5 h-5" />,
      allowedRoles: ['staff'] as ('admin' | 'staff')[]
    },
    {
      name: 'Inventory Items',
      path: '/items',
      icon: <Package className="w-5 h-5" />,
      allowedRoles: ['admin', 'staff'] as ('admin' | 'staff')[]
    },
    {
      name: 'Reorder Forecasts',
      path: '/reorders',
      icon: <TrendingUp className="w-5 h-5" />,
      allowedRoles: ['admin'] as ('admin' | 'staff')[]
    },
    {
      name: 'AI Report Assistant',
      path: '/assistant',
      icon: <MessageSquare className="w-5 h-5" />,
      allowedRoles: ['admin'] as ('admin' | 'staff')[]
    },
    {
      name: 'Activity Log',
      path: '/audit-log',
      icon: <History className="w-5 h-5" />,
      allowedRoles: ['admin'] as ('admin' | 'staff')[]
    }
  ];

  const visibleNavItems = navItems.filter(item => hasRole(item.allowedRoles));

  return (
    <div className="flex min-h-screen bg-zinc-950 text-zinc-100">
      {/* Sidebar */}
      <aside className="w-64 bg-zinc-900 border-r border-zinc-800 flex flex-col h-screen sticky top-0 shrink-0">
        {/* Brand Header */}
        <div className="h-16 flex items-center px-6 border-b border-zinc-800 space-x-2.5 shrink-0">
          <div className="bg-teal-500/10 p-1.5 rounded border border-teal-500/30">
            <Activity className="w-5 h-5 text-teal-400" />
          </div>
          <div>
            <span className="font-mono font-bold text-sm tracking-wider text-teal-400">D-MART</span>
            <span className="text-zinc-500 text-xs font-mono ml-1.5 block leading-none">OPS CENTER</span>
          </div>
        </div>

        {/* Navigation Links (Scrollable Nav Area) */}
        <nav className="flex-1 overflow-y-auto p-4 space-y-1">
          {visibleNavItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center space-x-3 px-4 py-2.5 rounded font-mono text-sm transition-all duration-150 ${
                  isActive
                    ? 'bg-teal-950/40 text-teal-300 border-l-2 border-teal-500 pl-3.5'
                    : 'text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200'
                }`}
              >
                {item.icon}
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>

        {/* User Profile & Logout (Fixed Card Area) */}
        <div className="p-4 border-t border-zinc-800 shrink-0">
          <div className="flex items-center space-x-3 mb-4 px-2">
            <div className="bg-zinc-800 p-2 rounded-full border border-zinc-700">
              <User className="w-4 h-4 text-zinc-400" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-mono font-bold text-zinc-300 truncate leading-none mb-1">
                {user?.name}
              </p>
              <div className="flex items-center space-x-1">
                <span className={`inline-block px-1.5 py-0.5 text-[9px] font-mono font-bold rounded uppercase tracking-wider ${
                  user?.role === 'admin' 
                    ? 'bg-teal-950 text-teal-400 border border-teal-500/30' 
                    : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
                }`}>
                  {user?.role}
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center space-x-2 py-2 px-4 rounded border border-zinc-800 bg-zinc-900 hover:bg-zinc-800 hover:text-red-400 hover:border-red-950/50 font-mono text-xs text-zinc-400 transition-colors duration-150"
          >
            <LogOut className="w-4 h-4" />
            <span>TERMINATE SESSION</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <header className="h-16 border-b border-zinc-800 flex items-center justify-between px-8 bg-zinc-900/40 backdrop-blur-md sticky top-0 z-10">
          <h1 className="text-sm font-mono tracking-widest text-zinc-400 uppercase">
            {location.pathname.replace('/', '').replace('-', ' ') || 'Overview'}
          </h1>
          <div className="flex items-center space-x-4">
            <span className="text-[10px] font-mono text-zinc-500">SYSTEM STATUS: ONLINE</span>
            <span className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-pulse"></span>
          </div>
        </header>

        <div className="p-8 max-w-7xl w-full mx-auto flex-1">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default Layout;
