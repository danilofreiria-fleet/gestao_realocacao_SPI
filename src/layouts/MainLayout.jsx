import React, { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, TableProperties, ShieldCheck, LogOut, Sun, Moon, ChevronLeft, ChevronRight, Timer, MapPin, CalendarDays, ClipboardList } from 'lucide-react';
import logoImg from '../assets/logo.png';

export default function MainLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false); 
  
  const [tempoRestante, setTempoRestante] = useState(null);

  const isGestor = localStorage.getItem("isGestor") === "true";
  const userRegional = localStorage.getItem("userRegional"); 
  const currentRegional = localStorage.getItem("selectedRegional"); 

  useEffect(() => {
    if (localStorage.theme === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      document.documentElement.classList.add('dark');
      setIsDarkMode(true);
    } else {
      document.documentElement.classList.remove('dark');
      setIsDarkMode(false);
    }
  }, []);

  useEffect(() => {
    const TEMPO_LIMITE = 60 * 60 * 1000; 

    const atualizarCronometro = () => {
      const loginTime = localStorage.getItem("spiTokenTime");
      
      if (loginTime) {
        const tempoLogado = Date.now() - parseInt(loginTime, 10);
        const restante = TEMPO_LIMITE - tempoLogado;

        if (restante <= 0) {
          localStorage.removeItem("spiToken");
          localStorage.removeItem("userEmail");
          localStorage.removeItem("spiTokenTime");
          localStorage.removeItem("isGestor");
          localStorage.removeItem("userRegional");
          localStorage.removeItem("userRole");
          localStorage.removeItem("selectedRegional");
          
          alert("Sua sessão expirou por segurança (60 minutos). Por favor, faça login novamente.");
          navigate("/"); 
        } else {
          setTempoRestante(restante);
        }
      }
    };

    atualizarCronometro(); 
    const intervalo = setInterval(atualizarCronometro, 1000);
    return () => clearInterval(intervalo);
  }, [navigate]);

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
    localStorage.removeItem('isGestor');
    localStorage.removeItem('userEmail');
    localStorage.removeItem('spiTokenTime');
    localStorage.removeItem('userRegional');
    localStorage.removeItem('userRole');
    localStorage.removeItem('selectedRegional');
    navigate('/');
  };

  const handleSwitchRegional = (novaRegional) => {
    if (novaRegional === currentRegional) return;
    localStorage.setItem('selectedRegional', novaRegional);
    window.location.reload(); 
  };

  const menuItems = [
    { path: '/app/tabela', name: 'Gestão de Dados', icon: <TableProperties size={20} /> },
    { path: '/app/rodizio', name: 'Rodízio', icon: <CalendarDays size={20} /> },
    { path: '/app/reports', name: 'Reports Prontos', icon: <ClipboardList size={20} /> },
    ...(isGestor ? [{ path: '/app/dashboard', name: 'Dashboard KPIs', icon: <LayoutDashboard size={20} /> }] : []),
    { path: '/app/validacao', name: 'Validação', icon: <ShieldCheck size={20} /> },
  ];

  const formatarTempo = (ms) => {
    if (ms === null) return "--:--";
    const minutos = Math.floor(ms / 60000);
    const segundos = Math.floor((ms % 60000) / 1000);
    return `${String(minutos).padStart(2, '0')}:${String(segundos).padStart(2, '0')}`;
  };

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-[#15171e] text-slate-800 dark:text-gray-200 transition-colors duration-300 overflow-hidden">
      
      <aside 
        className={`relative bg-white dark:bg-[#1f232d] border-r border-gray-200 dark:border-gray-800 flex flex-col justify-between shadow-lg z-20 transition-all duration-300 ease-in-out print:hidden ${
          isCollapsed ? 'w-20' : 'w-64'
        }`}
      >
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="absolute -right-3 top-8 bg-white dark:bg-[#1f232d] border border-gray-200 dark:border-gray-800 rounded-full p-1 shadow-md hover:bg-slate-50 dark:hover:bg-gray-800 z-50 text-[#113366] dark:text-gray-300 transition-transform"
        >
          {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>

        <div className="flex-1 overflow-y-auto custom-scrollbar">
          <div className={`p-6 flex flex-col items-center border-b border-gray-100 dark:border-gray-800 transition-all ${isCollapsed ? 'px-2' : ''}`}>
            <div className="mb-3 shrink-0 flex items-center justify-center min-h-[3rem]">
              <img 
                src={logoImg} 
                alt="Logo Sistema" 
                className={`object-contain transition-all duration-300 ${isCollapsed ? 'w-10' : 'w-28'}`} 
              />
            </div>
            
            {!isCollapsed && (
              <div className="flex flex-col items-center animate-in fade-in zoom-in duration-300">
                <h1 className="text-xl font-black uppercase tracking-tight text-gray-800 dark:text-white">Control Nexus</h1>
                <p className="text-[10px] text-gray-400 font-bold tracking-widest uppercase">Operação Logística</p>
              </div>
            )}
          </div>

          <nav className={`p-4 space-y-2 ${isCollapsed ? 'px-2' : ''}`}>
            {menuItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <button
                  key={item.name}
                  onClick={() => navigate(item.path)}
                  title={isCollapsed ? item.name : ""} 
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

        {/* RODAPÉ DO MENU COM ASSINATURA */}
        <div className={`p-4 border-t border-gray-100 dark:border-gray-800 space-y-2 shrink-0 ${isCollapsed ? 'px-2' : ''}`}>
          <div 
            title={isCollapsed ? `Sessão expira em: ${formatarTempo(tempoRestante)}` : ""}
            className={`w-full flex items-center ${isCollapsed ? 'justify-center' : 'gap-3 px-4'} py-2 rounded-xl text-xs font-bold ${tempoRestante && tempoRestante < 300000 ? 'text-red-500 animate-pulse' : 'text-slate-400 dark:text-gray-500'}`}
          >
            <div className="shrink-0"><Timer size={16} /></div>
            {!isCollapsed && <span className="truncate">Sessão: {formatarTempo(tempoRestante)}</span>}
          </div>

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

          {/*ASSINATURA*/}
          {!isCollapsed && (
            <div className="pt-4 mt-2 border-t border-gray-100 dark:border-gray-800 text-center animate-in fade-in">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">
                Desenvolvido por
              </p>
              <p className="text-[11px] font-black text-[#113366] dark:text-blue-400 uppercase tracking-wide">
                Danilo Freiria - SPO3
              </p>
            </div>
          )}
        </div>
      </aside>

      <main className="flex-1 overflow-hidden flex flex-col print:overflow-visible relative">
        
        {userRegional === 'BOTH' && (
          <div className="w-full bg-white dark:bg-[#1f232d] border-b border-gray-200 dark:border-gray-800 p-4 flex justify-end shrink-0 print:hidden z-10 shadow-sm">
            <div className="flex items-center gap-2 bg-slate-50 dark:bg-[#15171e] p-1.5 rounded-lg border border-slate-200 dark:border-gray-700">
              <div className="text-[10px] font-black text-slate-400 uppercase ml-2 flex items-center gap-1">
                <MapPin size={12} /> Visão Ativa:
              </div>
              
              <button
                onClick={() => handleSwitchRegional('SPI')} 
                className={`px-4 py-1.5 text-xs font-black tracking-wide rounded-md transition-all ${
                  currentRegional === 'SPI' || currentRegional === 'SPI/SPO'
                    ? 'bg-[#EE4D2D] text-white shadow-sm'
                    : 'text-slate-500 hover:bg-white dark:hover:bg-gray-800'
                }`}
              >
                SPI / SPO
              </button>

              <button
                onClick={() => handleSwitchRegional('SPM')} 
                className={`px-4 py-1.5 text-xs font-black tracking-wide rounded-md transition-all ${
                  currentRegional === 'SPM' || currentRegional === 'SPM/SPC'
                    ? 'bg-[#113366] text-white shadow-sm'
                    : 'text-slate-500 hover:bg-white dark:hover:bg-gray-800'
                }`}
              >
                SPM / SPC
              </button>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-8 print:p-0 print:overflow-visible">
           <Outlet /> 
        </div>
      </main>

    </div>
  );
}