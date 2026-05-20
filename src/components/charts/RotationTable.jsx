import React, { useState, useMemo, useEffect } from 'react';
import { Search, CheckCircle, AlertTriangle, XCircle, Slash, Truck, ChevronLeft, ChevronRight, ArrowUpDown, Filter, CalendarDays, Calendar } from 'lucide-react';
import { getRodagemData } from '../../api/googleSheets';

const STATUS_MAP = {
  'RODOU': { icon: <CheckCircle size={12} />, color: 'bg-green-500 text-white', label: 'Trabalhou' },
  'RECUSOU': { icon: <XCircle size={12} />, color: 'bg-red-500 text-white', label: 'Recusou' },
  'DISPO': { icon: <AlertTriangle size={12} />, color: 'bg-yellow-400 text-yellow-900', label: 'Disponível' },
  'INDISP': { icon: <Slash size={10} />, color: 'bg-slate-100 text-slate-400 dark:bg-gray-700 dark:text-gray-500', label: 'Indisponível' }
};

// 🔥 VACINA CONTRA ERROS DE DIGITAÇÃO NA PLANILHA
const padronizarHubLocal = (nome) => {
  if (!nome) return "";
  let n = String(nome).trim();
  let nLimpo = n.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, '');
  
  if (nLimpo.includes("ribeiraopretoesta")) return "LM Hub_SP_RibeirãoPretoEstaça";
  if (nLimpo.includes("sumare") && nLimpo.includes("veneza")) return "LM Hub_SP_Sumaré_Nova Veneza";
  
  return n;
};

export default function RotationTable({ filtrosGlobais = {} }) {
  const [rawData, setRawData] = useState([]); 
  const [loading, setLoading] = useState(false);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedModal, setSelectedModal] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  
  const [targetMonth, setTargetMonth] = useState(new Date().getMonth() + 1); 
  const [targetYear] = useState(new Date().getFullYear());
  
  const [viewMode, setViewMode] = useState('semana'); 
  const [targetWeek, setTargetWeek] = useState('');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });

  const [sortConfig, setSortConfig] = useState({ direction: 'desc' });
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50); 

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const monthStr = ['JAN','FEV','MAR','ABR','MAI','JUN','JUL','AGO','SET','OUT','NOV','DEZ'][targetMonth - 1];
        const tabName = `${monthStr}-${targetYear}`;
        
        const data = await getRodagemData(tabName); 
        setRawData(data || []);
      } catch (error) {
        console.error("Erro ao carregar rodízio:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [targetMonth, targetYear]);

  const parseUniversalDate = (dateStr) => {
    if (!dateStr) return null;
    let s = String(dateStr).trim().split('T')[0].split(' ')[0];
    if (s.includes('/')) {
      const [dia, m, a] = s.split('/');
      return `${a}-${m.padStart(2, '0')}-${dia.padStart(2, '0')}`;
    }
    return s;
  };

  const getISOWeek = (dateStr) => {
    const isoDate = parseUniversalDate(dateStr);
    if (!isoDate) return "";
    const d = new Date(isoDate + 'T12:00:00');
    const dCopy = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const dayNum = dCopy.getUTCDay() || 7;
    dCopy.setUTCDate(dCopy.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(dCopy.getUTCFullYear(),0,1));
    return `W-${String(Math.ceil((((dCopy - yearStart) / 86400000) + 1)/7)).padStart(2, '0')}`;
  };

  const availableWeeks = useMemo(() => {
    if (!rawData || rawData.length < 1) return [];
    const headers = rawData[0];
    const dataColsStart = 5; 
    const weeks = new Set();
    
    for (let i = dataColsStart; i < headers.length; i++) {
        const w = getISOWeek(headers[i]);
        if (w) weeks.add(w);
    }
    return Array.from(weeks).sort();
  }, [rawData]);

  useEffect(() => {
    if (availableWeeks.length > 0) {
      if (filtrosGlobais?.semana && availableWeeks.includes(filtrosGlobais.semana)) {
        setTargetWeek(filtrosGlobais.semana);
      } else if (!targetWeek || !availableWeeks.includes(targetWeek)) {
        setTargetWeek(availableWeeks[availableWeeks.length - 1]);
      }
    }
  }, [availableWeeks, filtrosGlobais.semana]);


  const modaisDisponiveis = useMemo(() => {
    if (!rawData || rawData.length < 2) return [];
    const modais = new Set();
    
    rawData.slice(1).forEach(row => {
      const rowHub = padronizarHubLocal(row[4]); // 🔥 APLICANDO A VACINA AQUI
      const matchesHub = filtrosGlobais.station?.length > 0 ? filtrosGlobais.station.includes(rowHub) : true;
      if (matchesHub && row[1]) modais.add(String(row[1]).trim().toUpperCase());
    });
    return Array.from(modais).sort();
  }, [rawData, filtrosGlobais.station]);

  const matrix = useMemo(() => {
    if (!rawData || rawData.length < 1) return { headers: [], rows: [] };

    const headers = rawData[0];
    const dataColsStart = 5; 

    const activeDateCols = headers.map((h, i) => ({ label: String(h), idx: i })).filter((col, i) => {
      if (i < dataColsStart) return false;
      const dateStr = parseUniversalDate(col.label);
      if (!dateStr) return false;

      if (viewMode === 'month') return true; 
      if (viewMode === 'semana') return getISOWeek(dateStr) === targetWeek;
      if (viewMode === 'range' && dateRange.start && dateRange.end) {
        return dateStr >= dateRange.start && dateStr <= dateRange.end;
      }
      return true; 
    });

    let rows = rawData.slice(1).filter(row => {
      const rowHub = padronizarHubLocal(row[4]); // 🔥 APLICANDO A VACINA AQUI TAMBÉM
      const rowModal = String(row[1] || "").trim().toUpperCase(); 

      const matchesHub = filtrosGlobais.station?.length > 0 ? filtrosGlobais.station.includes(rowHub) : true;
      const matchesSearch = String(row[0] || "").toLowerCase().includes(searchTerm.toLowerCase());
      const matchesModal = selectedModal === 'ALL' ? true : rowModal === selectedModal;
      
      return matchesHub && matchesSearch && matchesModal;
    }).map(row => {
      let countRodou = 0;
      const days = {};
      
      activeDateCols.forEach(col => {
        const status = row[col.idx] ? String(row[col.idx]).toUpperCase() : 'INDISP';
        days[col.label] = status;
        if (status === 'RODOU') countRodou++;
      });

      return {
        id: row[0],
        modal: row[1] || "-",
        hub: padronizarHubLocal(row[4]), // 🔥 E AQUI PARA EXIBIR CERTO NA TABELA
        days,
        total: countRodou
      };
    }).filter(row => {
      if (selectedStatus === 'ALL') return true;
      return Object.values(row.days).includes(selectedStatus);
    });

    rows.sort((a, b) => {
      if (sortConfig.direction === 'desc') return b.total - a.total;
      return a.total - b.total;
    });

    return { headers: activeDateCols, rows };
  }, [rawData, viewMode, targetWeek, dateRange, searchTerm, selectedModal, selectedStatus, sortConfig, filtrosGlobais]);

  const totalPages = Math.max(1, Math.ceil(matrix.rows.length / itemsPerPage));
  const paginatedRows = matrix.rows.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  useEffect(() => { setCurrentPage(1); }, [searchTerm, selectedModal, selectedStatus, itemsPerPage, viewMode, targetWeek]);

  const formatDateHeader = (d) => {
    if (!d || !d.includes('-')) return d;
    return d.split('-')[2];
  };

  const toggleSort = () => {
    setSortConfig(prev => ({ direction: prev.direction === 'desc' ? 'asc' : 'desc' }));
  };

  return (
    <div className="flex flex-col space-y-4 mt-6">
      
      <div className="bg-white dark:bg-[#1f232d] rounded-xl shadow-sm border border-slate-200 dark:border-gray-800 p-4 shrink-0">
        <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
          
          <div className="flex flex-col flex-1 min-w-[150px] max-w-[250px]">
            <label className="text-[9px] font-black text-slate-400 uppercase mb-0.5 ml-1">Buscar ID</label>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#EE4D2D]" size={14} />
              <input 
                type="text" 
                className="w-full bg-slate-50 dark:bg-[#15171e] border border-slate-200 dark:border-gray-700 rounded-lg py-1.5 pl-8 pr-3 text-xs font-medium focus:ring-2 focus:ring-[#113366] outline-none transition-all dark:text-white"
                placeholder="Ex: 123456..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-col">
            <label className="text-[9px] font-black text-slate-400 uppercase mb-0.5 ml-1">Modal</label>
            <select 
              className="bg-slate-50 dark:bg-[#15171e] border border-slate-200 dark:border-gray-700 rounded-lg py-1.5 px-3 text-xs font-bold text-[#113366] dark:text-white outline-none cursor-pointer hover:border-[#113366] transition-colors"
              value={selectedModal}
              onChange={(e) => setSelectedModal(e.target.value)}
            >
              <option value="ALL">Todos os Modais</option>
              {modaisDisponiveis.map(modal => <option key={modal} value={modal}>{modal}</option>)}
            </select>
          </div>

          <div className="flex flex-col">
            <label className="text-[9px] font-black text-slate-400 uppercase mb-0.5 ml-1 flex items-center gap-1"><Filter size={10}/> Status</label>
            <select 
              className="bg-slate-50 dark:bg-[#15171e] border border-slate-200 dark:border-gray-700 rounded-lg py-1.5 px-3 text-xs font-bold text-[#113366] dark:text-white outline-none cursor-pointer hover:border-[#113366] transition-colors"
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
            >
              <option value="ALL">Qualquer Status</option>
              <option value="RODOU">Rodaram ao menos 1x</option>
              <option value="RECUSOU">Recusaram ao menos 1x</option>
              <option value="DISPO">Ficaram Disponíveis 1x</option>
            </select>
          </div>

          <div className="flex flex-col border-l border-slate-200 dark:border-gray-700 pl-4 ml-2">
            <label className="text-[9px] font-black text-slate-400 uppercase mb-0.5 ml-1">Mês Base</label>
            <div className="flex items-center bg-slate-50 dark:bg-[#15171e] border border-slate-200 dark:border-gray-700 rounded-lg p-0.5 h-[30px]">
              <button onClick={() => setTargetMonth(m => Math.max(1, m-1))} className="p-1 text-slate-400 hover:text-[#EE4D2D] transition-colors"><ChevronLeft size={14}/></button>
              <span className="px-2 text-xs font-black text-[#113366] dark:text-white min-w-[50px] text-center uppercase tracking-wider">
                {['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'][targetMonth-1]}
              </span>
              <button onClick={() => setTargetMonth(m => Math.min(12, m+1))} className="p-1 text-slate-400 hover:text-[#EE4D2D] transition-colors"><ChevronRight size={14}/></button>
            </div>
          </div>

          {viewMode === 'semana' && availableWeeks.length > 0 && (
            <div className="flex flex-col animate-in fade-in slide-in-from-left-2">
              <label className="text-[9px] font-black text-slate-400 uppercase mb-0.5 ml-1 text-center">Filtro Semana</label>
              <div className="flex items-center bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-lg p-0.5 h-[30px] shadow-sm">
                <button 
                  onClick={() => { const idx = availableWeeks.indexOf(targetWeek); if (idx > 0) setTargetWeek(availableWeeks[idx - 1]); }} 
                  className="p-1 text-slate-400 hover:text-[#EE4D2D] disabled:opacity-30 transition-colors"
                  disabled={availableWeeks.indexOf(targetWeek) <= 0}
                ><ChevronLeft size={14}/></button>
                <span className="px-2 text-xs font-black text-[#EE4D2D] min-w-[50px] text-center uppercase tracking-wider">{targetWeek}</span>
                <button 
                  onClick={() => { const idx = availableWeeks.indexOf(targetWeek); if (idx < availableWeeks.length - 1) setTargetWeek(availableWeeks[idx + 1]); }} 
                  className="p-1 text-slate-400 hover:text-[#EE4D2D] disabled:opacity-30 transition-colors"
                  disabled={availableWeeks.indexOf(targetWeek) >= availableWeeks.length - 1}
                ><ChevronRight size={14}/></button>
              </div>
            </div>
          )}

          <div className="flex bg-slate-100 dark:bg-gray-800 p-1 rounded-lg ml-auto border border-slate-200 dark:border-gray-700">
            <button onClick={() => setViewMode('semana')} className={`flex items-center gap-1.5 px-4 py-1 rounded text-[10px] font-black uppercase tracking-wider transition-all ${viewMode === 'semana' ? 'bg-[#113366] text-white shadow-sm' : 'text-slate-500 hover:text-[#113366]'}`}><CalendarDays size={12}/>Semana</button>
            <button onClick={() => setViewMode('month')} className={`flex items-center gap-1.5 px-4 py-1 rounded text-[10px] font-black uppercase tracking-wider transition-all ${viewMode === 'month' ? 'bg-[#113366] text-white shadow-sm' : 'text-slate-500 hover:text-[#113366]'}`}><Calendar size={12}/>Mês</button>
            <button onClick={() => setViewMode('range')} className={`flex items-center gap-1.5 px-4 py-1 rounded text-[10px] font-black uppercase tracking-wider transition-all ${viewMode === 'range' ? 'bg-[#113366] text-white shadow-sm' : 'text-slate-500 hover:text-[#113366]'}`}><Filter size={12}/>Manual</button>
          </div>
        </div>

        {viewMode === 'range' && (
          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-100 dark:border-gray-800 animate-in fade-in slide-in-from-top-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mr-2">Data Customizada:</span>
            <input type="date" className="bg-slate-50 dark:bg-[#15171e] text-xs py-1 px-2 rounded border border-slate-200 dark:border-gray-700 font-bold text-[#113366] dark:text-white outline-none" value={dateRange.start} onChange={e => setDateRange({...dateRange, start: e.target.value})} />
            <span className="text-slate-300 font-bold text-xs">até</span>
            <input type="date" className="bg-slate-50 dark:bg-[#15171e] text-xs py-1 px-2 rounded border border-slate-200 dark:border-gray-700 font-bold text-[#113366] dark:text-white outline-none" value={dateRange.end} onChange={e => setDateRange({...dateRange, end: e.target.value})} />
          </div>
        )}
      </div>

      <div className="bg-white dark:bg-[#1f232d] rounded-2xl shadow-sm border border-[#113366] overflow-hidden flex flex-col relative">
        <div className="overflow-auto custom-scrollbar w-full max-h-[55vh] min-h-[300px]">
          <table className="w-full border-collapse text-center">
            <thead>
              <tr className="bg-[#113366] text-white tracking-widest text-[9px] xl:text-[10px]">
                <th className="p-2.5 text-left sticky left-0 top-0 z-[40] bg-[#113366] border-r border-white/20 min-w-[130px] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.3)]">
                  CONDUTOR
                </th>
                <th className="p-2 border-r border-white/20 sticky top-0 z-[30] bg-[#113366]">
                  <Truck size={12} className="mx-auto text-yellow-300"/>
                </th>
                
                {matrix.headers.map(col => (
                  <th key={col.label} className="p-1.5 border-r border-white/10 min-w-[28px] opacity-90 sticky top-0 z-[30] bg-[#113366]">
                    {formatDateHeader(col.label)}
                  </th>
                ))}
                
                <th 
                  className="p-2 bg-[#EE4D2D] hover:bg-[#D0011B] cursor-pointer transition-colors group select-none min-w-[70px] sticky top-0 right-0 z-[40] shadow-[-2px_0_5px_-2px_rgba(0,0,0,0.3)]"
                  onClick={toggleSort}
                >
                  <div className="flex items-center justify-center gap-1 font-black">
                    TOTAL <ArrowUpDown size={10} className={`transition-opacity ${sortConfig.direction ? 'opacity-100 text-yellow-300' : 'opacity-40 group-hover:opacity-100'}`} />
                  </div>
                </th>
              </tr>
            </thead>
            
            <tbody className="divide-y divide-slate-100 dark:divide-gray-800">
              {loading ? (
                <tr><td colSpan={matrix.headers.length + 3} className="p-10 text-center animate-pulse font-black text-slate-400 text-xs">Processando matriz de calor...</td></tr>
              ) : matrix.rows.length === 0 ? (
                <tr><td colSpan={matrix.headers.length + 3} className="p-10 text-center font-black text-slate-400 text-xs">Nenhum motorista encontrado.</td></tr>
              ) : (
                paginatedRows.map((row) => (
                  <tr key={row.id} className="even:bg-slate-50 odd:bg-white dark:even:bg-gray-800/40 dark:odd:bg-[#15171e] hover:bg-orange-50 dark:hover:bg-gray-700 transition-colors h-8">
                    <td className="px-3 py-1.5 text-left sticky left-0 z-[20] even:bg-slate-50 odd:bg-white dark:even:bg-gray-800 dark:odd:bg-[#15171e] border-r border-slate-200 dark:border-gray-700 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                      <div className="font-black text-[#113366] dark:text-blue-400 text-[11px] truncate max-w-[130px] leading-tight">{row.id}</div>
                      <div className="text-[8px] text-slate-400 font-bold uppercase truncate max-w-[130px] leading-tight">{row.hub}</div>
                    </td>
                    <td className="p-1 border-r border-slate-100 dark:border-gray-800 text-[9px] font-black text-slate-500">{row.modal}</td>
                    
                    {matrix.headers.map(col => {
                      const status = row.days[col.label];
                      const config = STATUS_MAP[status] || STATUS_MAP['INDISP'];
                      return (
                        <td key={col.label} className="p-0 border-r border-slate-50 dark:border-gray-800">
                          <div className={`w-full h-8 flex items-center justify-center ${config.color} hover:opacity-80 transition-opacity cursor-default`} title={`${row.id} - ${col.label}: ${config.label}`}>
                            {config.icon}
                          </div>
                        </td>
                      );
                    })}
                    
                    <td className="p-1 font-black text-xs text-[#EE4D2D] bg-orange-50 dark:bg-orange-900/10 border-l border-orange-200 dark:border-orange-900/30 sticky right-0 z-[20] shadow-[-2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                      {row.total}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="px-4 py-2 border-t border-[#113366] flex justify-between items-center bg-slate-50 dark:bg-[#1f232d] shrink-0 z-50">
          <div className="flex items-center gap-3">
            <div className="text-[9px] font-black text-[#113366] dark:text-slate-400 uppercase tracking-widest bg-white dark:bg-gray-800 px-2 py-1 rounded border border-slate-200 dark:border-gray-700 shadow-sm">
              Total: {matrix.rows.length} motoristas
            </div>
            
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] font-bold text-slate-400 uppercase">Exibir:</span>
              <select 
                className="bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 text-[10px] font-bold text-[#113366] dark:text-white rounded px-1.5 py-0.5 outline-none cursor-pointer"
                value={itemsPerPage}
                onChange={(e) => setItemsPerPage(Number(e.target.value))}
              >
                <option value={20}>20 linhas</option>
                <option value={50}>50 linhas</option>
                <option value={100}>100 linhas</option>
                <option value={200}>200 linhas</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button 
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(p => p - 1)}
              className="p-1 rounded bg-white dark:bg-gray-800 text-[#113366] dark:text-white hover:bg-slate-200 dark:hover:bg-gray-700 disabled:opacity-30 transition-all shadow-sm border border-slate-200 dark:border-gray-700"
            >
              <ChevronLeft size={14}/>
            </button>
            <span className="text-[10px] font-black text-[#113366] dark:text-white uppercase tracking-wider">Pág {currentPage}/{totalPages}</span>
            <button 
              disabled={currentPage === totalPages || totalPages === 0}
              onClick={() => setCurrentPage(p => p + 1)}
              className="p-1 rounded bg-white dark:bg-gray-800 text-[#113366] dark:text-white hover:bg-slate-200 dark:hover:bg-gray-700 disabled:opacity-30 transition-all shadow-sm border border-slate-200 dark:border-gray-700"
            >
              <ChevronRight size={14}/>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}