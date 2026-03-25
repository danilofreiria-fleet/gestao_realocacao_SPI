import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { GoogleOAuthProvider } from '@react-oauth/google';

import Login from './pages/Login.jsx';
import MainLayout from './layouts/MainLayout.jsx';
import DataTable from './components/DataTable.jsx';
import Dashboard from './components/Dashboard.jsx';

// 1. IMPORTAMOS A NOVA TELA DE VALIDAÇÃO AQUI 👇
import Validacao from './components/Validacao.jsx'; 

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
          
          {/* Rotas Internas Protegidas (Com a Sidebar) */}
          <Route path="/app" element={<PrivateRoute><MainLayout /></PrivateRoute>}>
            {/* Se entrar só em /app, manda pra tabela */}
            <Route index element={<Navigate to="tabela" />} /> 
            
            {/* Aqui vão as páginas que aparecem ao lado da Sidebar */}
            <Route path="tabela" element={<DataTable />} />
            
            {/* CORREÇÃO AQUI: <Dashboard /> ao invés de Dashboard */}
            <Route path="dashboard" element={<Dashboard />} />
            
            {/* 2. SUBSTITUÍMOS A DIV "EM CONSTRUÇÃO" PELO COMPONENTE AQUI 👇 */}
            <Route path="validacao" element={<Validacao />} />
            
          </Route>
        </Routes>
      </BrowserRouter>
    </GoogleOAuthProvider>
  </React.StrictMode>,
);