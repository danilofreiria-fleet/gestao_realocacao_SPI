import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { GoogleOAuthProvider } from '@react-oauth/google';
import RotationTable from './components/charts/RotationTable.jsx'; 

import Login from './pages/Login.jsx';
import MainLayout from './layouts/MainLayout.jsx';
import DataTable from './components/DataTable.jsx';
import Dashboard from './components/Dashboard.jsx';
import Validacao from './components/Validacao.jsx'; 
import ReportsProntos from './pages/ReportsProntos.jsx'; 
import SelecionarRegional from './components/RegionalSelection.jsx'; 
import Premissas from './pages/Premissas.jsx';
import DeliverySuccess from './pages/DeliverySuccess.jsx';

import './index.css';

const GOOGLE_CLIENT_ID = "790138478897-0jk3ihltoadqe9o392n7cdnn1ck1li73.apps.googleusercontent.com";

const PrivateRoute = ({ children }) => {
  const isAuth = !!localStorage.getItem("spiToken");
  return isAuth ? children : <Navigate to="/" />;
};

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <BrowserRouter>
        <Routes>
          {/* Rota de Login */}
          <Route path="/" element={<Login />} />
          
          <Route path="/selecionar-regional" element={
            <PrivateRoute>
              <SelecionarRegional />
            </PrivateRoute>
          } />
          
          {/* Rotas Internas Protegidas (Com a Sidebar) */}
          <Route path="/app" element={<PrivateRoute><MainLayout /></PrivateRoute>}>
            {/* 🔥 FORÇA PREMISSAS COMO A PÁGINA INICIAL DO APP */}
            <Route index element={<Navigate to="premissas" replace />} /> 
            <Route path="tabela" element={<DataTable />} />
            <Route path="premissas" element={<Premissas />} />
            
            <Route path="rodizio" element={
              <div className="bg-white dark:bg-[#1f232d] rounded-2xl shadow-sm border border-slate-200 dark:border-gray-800 p-6 h-full flex flex-col">
                <h2 className="text-2xl font-black text-[#113366] dark:text-white uppercase tracking-tight mb-2">Painel de Rodízio</h2>
                <p className="text-sm text-slate-500 dark:text-gray-400 mb-4">Gestão de alocação de frota.</p>
                <RotationTable />
              </div>
            } />

            <Route path="ds" element={<DeliverySuccess />} /> 
            <Route path="reports" element={<ReportsProntos />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="validacao" element={<Validacao />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </GoogleOAuthProvider>
  </React.StrictMode>,
);