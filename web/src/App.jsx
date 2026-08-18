import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import AppLayout from './components/AppLayout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import CaseList from './pages/CaseList';
import CaseEdit from './pages/CaseEdit';
import CaseDetail from './pages/CaseDetail';
import CaseUpload from './pages/CaseUpload';
import Stats from './pages/Stats';
import Dicts from './pages/Dicts';
import System from './pages/System';

function Protected({ children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <Protected>
            <AppLayout />
          </Protected>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="cases" element={<CaseList />} />
        <Route path="cases/new" element={<CaseEdit />} />
        <Route path="cases/:id" element={<CaseDetail />} />
        <Route path="cases/:id/edit" element={<CaseEdit />} />
        <Route path="upload" element={<CaseUpload />} />
        <Route path="stats" element={<Stats />} />
        <Route path="dicts" element={<Dicts />} />
        <Route path="system" element={<System />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
