import React, { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, TableProperties, ShieldCheck, LogOut, Sun, Moon, Database, ChevronLeft, ChevronRight } from 'lucide-react';

export default function MainLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false); // NOVO ESTADO DA SIDEBAR

  // Verifica o tema inicial
  useEffect(() => {
    if (localStorage.theme === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      document.documentElement.classList.add('dark');
      setIsDarkMode(true);
    } else {
      document.documentElement.classList.remove('dark');
      setIsDarkMode(false);
    }
  }, []);

  const toggleDarkMode = () => {
    if (isDarkMode) {
      document.documentElement.classList.remove('dark');
      localStorage.theme = 'light';
      setIsDarkMode(false);
    } else {
      document.documentElement.classList.add('dark');
      localStorage.theme = 'dark';
      setIsDarkMode(true);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('spiToken');
    localStorage.removeItem('userEmail');
    navigate('/');
  };

  const menuItems = [
    { path: '/app/tabela', name: 'Gestão de Dados', icon: <TableProperties size={20} /> },
    { path: '/app/dashboard', name: 'Dashboard KPIs', icon: <LayoutDashboard size={20} /> },
    { path: '/app/validacao', name: 'Validação', icon: <ShieldCheck size={20} /> },
  ];

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-[#15171e] text-slate-800 dark:text-gray-200 transition-colors duration-300 overflow-hidden">
      
      {/* SIDEBAR COM LARGURA DINÂMICA */}
<aside 
        className={`relative bg-white dark:bg-[#1f232d] border-r border-gray-200 dark:border-gray-800 flex flex-col justify-between shadow-lg z-20 transition-all duration-300 ease-in-out print:hidden ${
          isCollapsed ? 'w-20' : 'w-64'
        }`}
      >
        {/* BOTÃO DE RECOLHER FLUTUANTE */}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="absolute -right-3 top-8 bg-white dark:bg-[#1f232d] border border-gray-200 dark:border-gray-800 rounded-full p-1 shadow-md hover:bg-slate-50 dark:hover:bg-gray-800 z-50 text-[#113366] dark:text-gray-300 transition-transform"
        >
          {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>

        <div>
          {/* Logo e Título */}
          <div className={`p-6 flex flex-col items-center border-b border-gray-100 dark:border-gray-800 transition-all ${isCollapsed ? 'px-2' : ''}`}>
            <div className="bg-[#EE4D2D] p-3 rounded-2xl mb-3 shadow-md shrink-0">
              <Database className="text-white" size={isCollapsed ? 20 : 28} />
            </div>
            
            {!isCollapsed && (
              <div className="flex flex-col items-center animate-in fade-in zoom-in duration-300">
                <h1 className="text-xl font-black uppercase tracking-tight text-gray-800 dark:text-white">SPI Control</h1>
                <p className="text-[10px] text-gray-400 font-bold tracking-widest uppercase">Nexus Fleet</p>
              </div>
            )}
          </div>

          {/* Menu de Navegação */}
          <nav className={`p-4 space-y-2 ${isCollapsed ? 'px-2' : ''}`}>
            {menuItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <button
                  key={item.name}
                  onClick={() => navigate(item.path)}
                  title={isCollapsed ? item.name : ""} // Exibe o nome ao passar o mouse se estiver fechado
                  className={`w-full flex items-center ${isCollapsed ? 'justify-center' : 'gap-3 px-4'} py-3 rounded-xl font-bold transition-all ${
                    isActive 
                      ? 'bg-[#EE4D2D] text-white shadow-md' 
                      : 'text-gray-500 dark:text-gray-400 hover:bg-orange-50 dark:hover:bg-[#EE4D2D]/10 hover:text-[#EE4D2D] dark:hover:text-[#EE4D2D]'
                  }`}
                >
                  <div className="shrink-0">{item.icon}</div>
                  {!isCollapsed && <span className="truncate">{item.name}</span>}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Rodapé da Sidebar (Tema e Logout) */}
        <div className={`p-4 border-t border-gray-100 dark:border-gray-800 space-y-2 ${isCollapsed ? 'px-2' : ''}`}>
          <button 
            onClick={toggleDarkMode}
            title={isCollapsed ? "Mudar Tema" : ""}
            className={`w-full flex items-center ${isCollapsed ? 'justify-center' : 'gap-3 px-4'} py-3 rounded-xl font-bold text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all`}
          >
            <div className="shrink-0">
              {isDarkMode ? <Sun size={20} className="text-[#EE4D2D]" /> : <Moon size={20} className="text-[#113366]" />}
            </div>
            {!isCollapsed && <span className="truncate">Modo {isDarkMode ? 'Claro' : 'Escuro'}</span>}
          </button>
          
          <button 
            onClick={handleLogout}
            title={isCollapsed ? "Sair do Sistema" : ""}
            className={`w-full flex items-center ${isCollapsed ? 'justify-center' : 'gap-3 px-4'} py-3 rounded-xl font-bold text-[#D0011B] hover:bg-[#D0011B]/10 transition-all`}
          >
            <div className="shrink-0"><LogOut size={20} /></div>
            {!isCollapsed && <span className="truncate">Sair do Sistema</span>}
          </button>
        </div>
      </aside>

{/* ÁREA DE CONTEÚDO (Onde as telas aparecem) */}
      <main className="flex-1 overflow-hidden flex flex-col print:overflow-visible">
        {/* Adicionamos print:p-0 para tirar as margens no papel */}
        <div className="flex-1 overflow-y-auto p-8 print:p-0 print:overflow-visible">
           <Outlet /> 
        </div>
      </main>

    </div>
  );
}