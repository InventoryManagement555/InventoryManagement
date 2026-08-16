import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Dashboard from './pages/Dashboard';
import Items from './pages/Items';
import Reorders from './pages/Reorders';
import Assistant from './pages/Assistant';
import Operations from './pages/Operations';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import AuditLog from './pages/AuditLog';

// Prevents redirect loop: Admins go to Dashboard, Staff goes to Operations.
const HomeRedirect: React.FC = () => {
  const { user } = useAuth();
  if (user?.role === 'admin') {
    return <Navigate to="/dashboard" replace />;
  }
  return <Navigate to="/operations" replace />;
};

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Auth Screen Entry Points */}
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />

          {/* Secure Main Console Workspace */}
          <Route element={<ProtectedRoute />}>
            <Route element={<Layout />}>
              {/* Home Path Router */}
              <Route path="/" element={<HomeRedirect />} />

              {/* Admin Gate Operations */}
              <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/reorders" element={<Reorders />} />
                <Route path="/assistant" element={<Assistant />} />
                <Route path="/audit-log" element={<AuditLog />} />
              </Route>

              {/* Staff and Admin Common Operation Paths */}
              <Route path="/items" element={<Items />} />
              <Route path="/operations" element={<Operations />} />
            </Route>
          </Route>

          {/* Fallback to secure home */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
