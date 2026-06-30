import React, { useState, useMemo, useEffect } from 'react';
import { Search, MapPin, AlertTriangle, TrendingDown, TrendingUp, ChevronLeft, ChevronRight, Activity, Car, PackageCheck, BarChart2 } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, LabelList } from 'recharts';
import { MAPA_REGIONAL_COMPLETO } from '../../constants/regionais';

export default function EstresseClusterTable({ 
  data = [], 
  dispoData = [], 
  atPisoClusterData = [], 
  recusasData = [], 
  atExpedidaData = [], 
  filtrosGlobais = {} 
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedModal, setSelectedModal] = useState(''); 
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(15);
  const [sortConfig, setSortConfig] = useState({ key: 'estresse', direction: 'desc' });

  const MODAIS = ['PASSEIO', 'FIORINO', 'MOTO', 'VAN'];

  const parseNum = (val) => {
    if (!val) return 0;
    if (typeof val === 'number') return val;
    const s = String(val).trim();
    if (s.indexOf(',') === -1) return Number(s) || 0;
    return Number(s.replace(/\./g, '').replace(',', '.')) || 0;
  };

  const parseUniversalDate = (dateStr) => {
    if (!dateStr) return null;
    let s = String(dateStr).trim().split('T')[0].split(' ')[0];
    if (s.includes('/')) {
      const parts = s.split('/');
      const dia = parts[0].padStart(2, '0');
      const m = parts[1].padStart(2, '0');
      const a = parts.length === 3 ? (parts[2].length === 2 ? '20'+parts[2] : parts[2]) : new Date().getFullYear();
      return `${a}-${m}-${dia}T12:00:00`;
    }
    return `${s}T12:00:00`;
  };

  const getISOWeek = (isoDate) => {
    if (!isoDate) return "";
    const d = new Date(isoDate);
    const dCopy = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const dayNum = dCopy.getUTCDay() || 7;
    dCopy.setUTCDate(dCopy.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(dCopy.getUTCFullYear(), 0, 1));
    return `W-${String(Math.ceil((((dCopy - yearStart) / 86400000) + 1) / 7)).padStart(2, '0')}`;
  };

  const matrizEstresse = useMemo(() => {
    const { regional = [], station = [], turno = [], dataInicio = '', dataFim = '', semana = '', mes = '' } = filtrosGlobais;
    const aggs = {};

    const dataInicioObj = dataInicio ? new Date(dataInicio + 'T00:00:00') : null;
    const dataFimObj = dataFim ? new Date(dataFim + 'T23:59:59') : null;

    const isValidDate = (dateStr) => {
      const iso = parseUniversalDate(dateStr);
      if (!iso) return false;
      const dObj = new Date(iso);
      if (isNaN(dObj.getTime())) return false; 
      if (dataInicioObj && dObj < dataInicioObj) return false;
      if (dataFimObj && dObj > dataFimObj) return false;
      if (mes && String(dObj.getMonth() + 1).padStart(2, '0') !== mes) return false;
      if (semana && getISOWeek(iso) !== semana) return false;
      return true;
    };

    // 🔥 HIGIENIZADOR ABSOLUTO (Mata espaços duplos, acentos e alinha vírgulas)
    const sanitizeForKey = (str) => {
      if (!str) return "";
      return String(str)
        .toUpperCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "") 
        .replace(/\s+/g, ' ')            
        .replace(/\s*,\s*/g, ', ')       
        .trim();
    };

    const registerCluster = (hubRaw, clusterRaw) => {
      const hubClean = hubRaw ? String(hubRaw).trim() : "";
      let clusterClean = clusterRaw ? String(clusterRaw).trim() : "";
      
      if (!clusterClean || clusterClean.toUpperCase() === "NÃO PREENCHIDO" || clusterClean.toUpperCase() === "NAO PREENCHIDO" || clusterClean === "-") {
        clusterClean = "SEM CLUSTER";
      }
      
      const key = `${sanitizeForKey(hubClean)}|${sanitizeForKey(clusterClean)}`;
      
      if (!aggs[key]) {
        aggs[key] = { 
          hub: hubClean, 
          cluster: clusterClean.toUpperCase(), 
          dispo: 0, 
          atPiso: 0, 
          recusas: 0, 
          expedidas: 0 
        };
      }
      return key;
    };

    let totalDispoGlobal = 0;
    if (data && data.length > 0) {
      data.forEach(row => {
        if (!selectedModal) {
          totalDispoGlobal += parseNum(row[24]);
        } else {
          if (selectedModal === 'PASSEIO') totalDispoGlobal += parseNum(row[21]);
          else if (selectedModal === 'FIORINO') totalDispoGlobal += parseNum(row[20]);
          else if (selectedModal === 'MOTO') totalDispoGlobal += parseNum(row[22]);
          else if (selectedModal === 'VAN') totalDispoGlobal += parseNum(row[23]);
        }
      });
    }

    if (dispoData && dispoData.length > 1) {
      dispoData.slice(1).forEach(row => {
        const hub = String(row[0] || "").trim();
        const cluster = String(row[1] || "").trim();
        const dataRaw = row[4];
        const qtd = parseNum(row[5]);
        const subreg = MAPA_REGIONAL_COMPLETO[hub] || ""; 
        const modalRaw = String(row[3] || "").trim().toUpperCase();
        
        let tConf = String(row[2] || "").trim().toUpperCase();
        if (tConf === 'SD') tConf = 'PM1';
        if (tConf === 'PM') tConf = 'PM2';

        if (!hub || !dataRaw || qtd === 0) return;
        if (regional.length > 0 && !regional.includes(subreg)) return;
        if (station.length > 0 && !station.includes(hub)) return;
        if (turno.length > 0 && !turno.includes(tConf)) return;
        if (!isValidDate(dataRaw)) return;
        
        if (selectedModal && !modalRaw.includes(selectedModal)) return;

        const key = registerCluster(hub, cluster);
        aggs[key].dispo += qtd;
      });
    }

    if (atPisoClusterData && atPisoClusterData.length > 1) {
      atPisoClusterData.slice(1).forEach(row => {
        if (selectedModal) return; 

        const hub = String(row[3] || "").trim();
        const cluster = String(row[4] || "").trim();
        const dataRaw = row[0];
        const qtd = parseNum(row[5]);
        const subreg = MAPA_REGIONAL_COMPLETO[hub] || ""; 

        if (!hub || !dataRaw || qtd === 0) return;
        if (regional.length > 0 && !regional.includes(subreg)) return;
        if (station.length > 0 && !station.includes(hub)) return;
        if (!isValidDate(dataRaw)) return;

        const key = registerCluster(hub, cluster);
        aggs[key].atPiso += qtd;
      });
    }

    if (recusasData && recusasData.length > 1) {
      recusasData.slice(1).forEach(row => {
        const hub = String(row[4] || "").trim();
        const clusterRaw = String(row[6] || "").trim();
        
        // 🔥 REGRA: Ignora as recusas que caíram em 'SEM CLUSTER'
        if (!clusterRaw || clusterRaw.toUpperCase() === "NÃO PREENCHIDO" || clusterRaw.toUpperCase() === "NAO PREENCHIDO" || clusterRaw === "-") {
          return;
        }

        const dataRaw = row[8];
        const tConf = String(row[7] || "").trim().toUpperCase();
        const modalRaw = String(row[10] || "").trim().toUpperCase();
        const subreg = MAPA_REGIONAL_COMPLETO[hub] || ""; 

        if (!hub || !dataRaw) return;
        if (regional.length > 0 && !regional.includes(subreg)) return;
        if (station.length > 0 && !station.includes(hub)) return;
        if (turno.length > 0 && !turno.includes(tConf)) return;
        if (!isValidDate(dataRaw)) return;

        if (selectedModal) {
          if (selectedModal === 'FIORINO' && !modalRaw.includes('FIORINO') && !modalRaw.includes('UTIL')) return;
          else if (selectedModal !== 'FIORINO' && !modalRaw.includes(selectedModal)) return;
        }

        const key = registerCluster(hub, clusterRaw);
        aggs[key].recusas += 1;
      });
    }

    if (atExpedidaData && atExpedidaData.length > 1) {
      atExpedidaData.slice(1).forEach(row => {
        const hub = String(row[1] || "").trim();
        const cluster = String(row[4] || "").trim();
        const dataRaw = row[5];
        const tConf = String(row[2] || "").trim().toUpperCase();
        const modalRaw = String(row[3] || "").trim().toUpperCase();
        const subreg = MAPA_REGIONAL_COMPLETO[hub] || ""; 

        if (!hub || !dataRaw) return;
        if (regional.length > 0 && !regional.includes(subreg)) return;
        if (station.length > 0 && !station.includes(hub)) return;
        if (turno.length > 0 && !turno.includes(tConf)) return;
        if (!isValidDate(dataRaw)) return;

        if (selectedModal) {
          if (selectedModal === 'FIORINO' && !modalRaw.includes('FIORINO') && !modalRaw.includes('UTIL')) return;
          else if (selectedModal !== 'FIORINO' && !modalRaw.includes(selectedModal)) return;
        }

        const key = registerCluster(hub, cluster);
        aggs[key].expedidas += 1;
      });
    }

    let resumo = { totalDispo: totalDispoGlobal, demandaTotal: 0, deficitGeral: 0 };

    const linhas = Object.values(aggs)
      .filter(item => item.cluster !== "SEM CLUSTER") 
      .map(item => {
        const demandaDoCluster = item.expedidas + item.atPiso + item.recusas;
        const estresse = item.dispo > 0 ? (demandaDoCluster / item.dispo) : (demandaDoCluster > 0 ? 9.9 : 0);
        const deficit = demandaDoCluster - item.dispo;
        
        // Calcula Frota Real (Pode ficar negativa se as recusas superarem a dispo)
        const frotaReal = item.dispo - item.recusas;

        resumo.demandaTotal += demandaDoCluster;

        return { ...item, demandaTotal: demandaDoCluster, estresse, deficit, frotaReal };
      });

    resumo.deficitGeral = resumo.demandaTotal - resumo.totalDispo;

    return { linhas, resumo };
  }, [data, dispoData, atPisoClusterData, recusasData, atExpedidaData, filtrosGlobais, selectedModal]);

  const filteredAndSortedRows = useMemo(() => {
    let result = matrizEstresse.linhas;

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(r => r.hub.toLowerCase().includes(term) || r.cluster.toLowerCase().includes(term));
    }

    result.sort((a, b) => {
      if (a[sortConfig.key] < b[sortConfig.key]) return sortConfig.direction === 'asc' ? -1 : 1;
      if (a[sortConfig.key] > b[sortConfig.key]) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [matrizEstresse.linhas, searchTerm, sortConfig]);

  useEffect(() => { setCurrentPage(1); }, [filteredAndSortedRows.length, itemsPerPage]);
  const totalPages = Math.max(1, Math.ceil(filteredAndSortedRows.length / itemsPerPage));
  const paginatedRows = filteredAndSortedRows.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  // Prepara os dados para os gráficos (Pega o Top 15 da ordenação atual para não poluir)
  const chartData = useMemo(() => {
    return filteredAndSortedRows.slice(0, 15).map(item => ({
      ...item,
      chartName: `${item.hub.split('_').pop()} - ${item.cluster}`
    }));
  }, [filteredAndSortedRows]);

  const requestSort = (key) => {
    let direction = 'desc';
    if (sortConfig.key === key && sortConfig.direction === 'desc') direction = 'asc';
    setSortConfig({ key, direction });
  };

  // 🔥 REGRA NOVA DE CORES E BADGES
  const getStatusBadge = (estresse) => {
    if (estresse === 0) return <span className="bg-slate-100 text-slate-500 px-2 py-0.5 rounded text-[10px] font-black uppercase">Sem Demanda</span>;
    if (estresse < 0.50) return <span className="bg-emerald-100 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded text-[10px] font-black uppercase">Folga Segura</span>;
    if (estresse <= 0.99) return <span className="bg-yellow-100 text-yellow-700 border border-yellow-200 px-2 py-0.5 rounded text-[10px] font-black uppercase">Atenção (Margem Curta)</span>;
    if (estresse <= 1.25) return <span className="bg-orange-100 text-orange-700 border border-orange-200 px-2 py-0.5 rounded text-[10px] font-black uppercase">Risco (Gargalo)</span>;
    return <span className="bg-red-100 text-red-700 border border-red-200 px-2 py-0.5 rounded text-[10px] font-black uppercase shadow-sm">Ruptura Crítica</span>;
  };

  const getEstresseColor = (estresse) => {
    if (estresse === 0) return 'text-slate-400';
    if (estresse < 0.50) return 'text-emerald-600';
    if (estresse <= 0.99) return 'text-yellow-600';
    if (estresse <= 1.25) return 'text-orange-500';
    return 'text-[#D0011B]';
  };

  return (
    <div className="flex flex-col gap-6">
      
      {/* HEADER DE RESUMO GERAL */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-[#1f232d] p-5 rounded-2xl border border-slate-200 dark:border-gray-800 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-blue-50 dark:bg-blue-900/30 rounded-xl text-[#113366] dark:text-blue-400"><Car size={24} /></div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Frota Disponível (Globais)</p>
            <h4 className="text-2xl font-black text-[#113366] dark:text-white">{matrizEstresse.resumo.totalDispo.toLocaleString('pt-BR')}</h4>
          </div>
        </div>

        <div className="bg-white dark:bg-[#1f232d] p-5 rounded-2xl border border-slate-200 dark:border-gray-800 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-orange-50 dark:bg-orange-900/30 rounded-xl text-orange-500"><PackageCheck size={24} /></div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Demanda Real (Clusters)</p>
            <h4 className="text-2xl font-black text-slate-800 dark:text-white">{matrizEstresse.resumo.demandaTotal.toLocaleString('pt-BR')}</h4>
          </div>
        </div>

        <div className={`p-5 rounded-2xl border shadow-sm flex items-center gap-4 ${matrizEstresse.resumo.deficitGeral > 0 ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800/50' : 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800/50'}`}>
          <div className={`p-3 rounded-xl ${matrizEstresse.resumo.deficitGeral > 0 ? 'bg-red-100 dark:bg-red-900/50 text-red-600' : 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600'}`}>
            <Activity size={24} />
          </div>
          <div>
            <p className={`text-[10px] font-black uppercase tracking-widest ${matrizEstresse.resumo.deficitGeral > 0 ? 'text-red-500' : 'text-emerald-600'}`}>
              {matrizEstresse.resumo.deficitGeral > 0 ? 'Déficit de Frota' : 'Sobra de Frota'}
            </p>
            <h4 className={`text-2xl font-black ${matrizEstresse.resumo.deficitGeral > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
              {Math.abs(matrizEstresse.resumo.deficitGeral).toLocaleString('pt-BR')} rotas de gap
            </h4>
          </div>
        </div>
      </div>

      {/* CONTROLES E TABELA */}
      <div className="bg-white dark:bg-[#1f232d] rounded-2xl shadow-sm border border-[#113366] overflow-hidden flex flex-col">
        
        <div className="p-5 border-b border-slate-100 dark:border-gray-800 flex flex-col md:flex-row justify-between items-center gap-4 bg-slate-50 dark:bg-[#15171e]">
          <div className="flex items-center gap-2">
            <Activity className="text-[#EE4D2D]" size={20} />
            <h3 className="text-sm font-black text-[#113366] dark:text-white uppercase tracking-wide">Mapeamento de Pressão Operacional</h3>
          </div>
          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="relative w-full md:w-56">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
              <input 
                type="text" placeholder="Buscar Station ou Cluster..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-lg py-1.5 pl-9 pr-3 text-xs font-bold outline-none text-slate-700 dark:text-white"
              />
            </div>
            
            <select
              value={selectedModal}
              onChange={(e) => setSelectedModal(e.target.value)}
              className="w-full md:w-48 bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-lg py-1.5 px-3 text-xs font-bold outline-none cursor-pointer uppercase text-slate-700 dark:text-white"
            >
              <option value="">🚙 Todos os Modais</option>
              {MODAIS.map(modal => <option key={modal} value={modal}>{modal}</option>)}
            </select>
          </div>
        </div>

        {selectedModal && (
          <div className="bg-yellow-50 dark:bg-yellow-900/20 px-5 py-2 text-[10px] font-bold text-yellow-700 dark:text-yellow-400 border-b border-yellow-100 dark:border-yellow-900/50 flex items-center gap-1.5">
            <AlertTriangle size={12} />
            Como a base de AT no Piso não possui quebra por modal, ela foi isolada do cálculo para não distorcer o Estresse da {selectedModal}.
          </div>
        )}

        <div className="overflow-x-auto w-full custom-scrollbar">
          <table className="w-full border-collapse text-center">
            <thead className="bg-[#113366] text-white tracking-widest text-[10px] uppercase font-black">
              <tr>
                <th className="p-3 text-left w-[200px] cursor-pointer hover:bg-white/10 transition-colors" onClick={() => requestSort('hub')}>
                  Station {sortConfig.key === 'hub' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </th>
                <th className="p-3 text-left w-[150px] cursor-pointer hover:bg-white/10 transition-colors" onClick={() => requestSort('cluster')}>
                  Cluster {sortConfig.key === 'cluster' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </th>
                <th className="p-3 border-l border-white/20 cursor-pointer hover:bg-white/10 transition-colors" onClick={() => requestSort('dispo')} title="Frota Alocada">
                  Frota Dispo {sortConfig.key === 'dispo' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </th>
                <th className="p-3 cursor-pointer hover:bg-white/10 transition-colors" onClick={() => requestSort('expedidas')} title="Demanda Absorvida">
                  Expedidas {sortConfig.key === 'expedidas' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </th>
                <th className={`p-3 cursor-pointer hover:bg-white/10 transition-colors ${selectedModal ? 'opacity-30' : ''}`} onClick={() => requestSort('atPiso')} title="Acúmulo no Hub">
                  AT Piso {sortConfig.key === 'atPiso' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </th>
                <th className="p-3 cursor-pointer hover:bg-white/10 transition-colors" onClick={() => requestSort('recusas')} title="Demanda Rejeitada">
                  Recusas {sortConfig.key === 'recusas' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </th>
                <th className="p-3 border-l border-white/20 cursor-pointer hover:bg-white/10 transition-colors text-[#EE4D2D]" onClick={() => requestSort('frotaReal')} title="Dispo - Recusas">
                  Frota Real {sortConfig.key === 'frotaReal' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </th>
                <th className="p-3 border-l border-white/20 cursor-pointer hover:bg-white/10 transition-colors bg-[#EE4D2D]" onClick={() => requestSort('estresse')} title="(Expedidas + Piso + Recusas) / Dispo">
                  Índice de Estresse {sortConfig.key === 'estresse' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </th>
                <th className="p-3 bg-[#EE4D2D]">Status do Cluster</th>
              </tr>
            </thead>
            
            <tbody className="divide-y divide-slate-100 dark:divide-gray-800 font-bold text-xs bg-white dark:bg-[#1f232d]">
              {paginatedRows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-12 text-center text-slate-400 font-bold">Nenhum dado cruzado encontrado para a seleção.</td>
                </tr>
              ) : (
                paginatedRows.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-gray-800/50 transition-colors">
                    <td className="p-3 text-left text-[#113366] dark:text-blue-400 flex items-center gap-2 border-r border-slate-100 dark:border-gray-800"><MapPin size={12} className="text-[#EE4D2D] shrink-0" /> <span className="truncate">{row.hub}</span></td>
                    <td className="p-3 text-left text-slate-600 dark:text-gray-300 border-r border-slate-100 dark:border-gray-800 truncate">{row.cluster}</td>
                    
                    <td className="p-3 text-[#113366] dark:text-blue-300 font-black bg-blue-50/50 dark:bg-blue-900/10">{row.dispo > 0 ? row.dispo : '-'}</td>
                    <td className="p-3 text-slate-600 dark:text-gray-300">{row.expedidas > 0 ? row.expedidas : '-'}</td>
                    <td className={`p-3 text-orange-500 ${selectedModal ? 'opacity-30' : ''}`}>{row.atPiso > 0 ? row.atPiso : '-'}</td>
                    <td className="p-3 text-[#D0011B]">{row.recusas > 0 ? row.recusas : '-'}</td>
                    
                    <td className={`p-3 font-black border-l border-slate-100 dark:border-gray-800 ${row.frotaReal < 0 ? 'text-[#D0011B]' : 'text-emerald-600'}`}>
                      {row.frotaReal}
                    </td>

                    <td className={`p-3 font-black text-sm border-l border-slate-100 dark:border-gray-800 bg-slate-50 dark:bg-[#15171e] ${getEstresseColor(row.estresse)}`}>
                      {row.estresse === 9.9 ? 'CRÍTICO' : row.estresse === 0 ? '0.0x' : `${row.estresse.toFixed(2)}x`}
                    </td>
                    <td className="p-3 bg-slate-50 dark:bg-[#15171e]">
                      {getStatusBadge(row.estresse)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* PAGINAÇÃO */}
        <div className="px-4 py-3 border-t border-[#113366] flex justify-between items-center bg-slate-50 dark:bg-[#15171e] shrink-0">
          <div className="flex items-center gap-3">
            <div className="text-[9px] font-black text-[#113366] dark:text-slate-400 uppercase tracking-widest bg-white dark:bg-gray-800 px-2 py-1 rounded border border-slate-200 dark:border-gray-700 shadow-sm">
              Clusters Mapeados: {filteredAndSortedRows.length}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} className="p-1 rounded bg-white dark:bg-gray-800 text-[#113366] hover:bg-slate-200 disabled:opacity-30 shadow-sm border border-slate-200"><ChevronLeft size={14}/></button>
            <span className="text-[10px] font-black text-[#113366] dark:text-white uppercase tracking-wider">Pág {currentPage}/{totalPages}</span>
            <button disabled={currentPage === totalPages || totalPages === 0} onClick={() => setCurrentPage(p => p + 1)} className="p-1 rounded bg-white dark:bg-gray-800 text-[#113366] hover:bg-slate-200 disabled:opacity-30 shadow-sm border border-slate-200"><ChevronRight size={14}/></button>
          </div>
        </div>
      </div>

      {/* 🔥 NOVOS GRÁFICOS ANALÍTICOS (Renderizados com base no Top 15 da tabela) */}
      {chartData.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-2">
          
          {/* GRÁFICO 1 - FROTA REAL (Dispo - Recusas) */}
          <div className="bg-white dark:bg-[#1f232d] p-5 rounded-2xl border border-slate-200 dark:border-gray-800 shadow-sm flex flex-col">
            <div className="flex items-center gap-2 mb-4 border-b border-slate-100 dark:border-gray-800 pb-3">
              <BarChart2 size={20} className="text-[#113366] dark:text-blue-400" />
              <div>
                <h4 className="text-sm font-black text-[#113366] dark:text-white uppercase tracking-wider">Saldo de Frota Real</h4>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Disponibilidade - Recusas (Top 15 da lista)</p>
              </div>
            </div>
            <div className="flex-1 w-full min-h-[350px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 30, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#e2e8f0" />
                  <XAxis type="number" tick={{ fontSize: 10 }} />
                  <YAxis dataKey="chartName" type="category" width={180} tick={{ fontSize: 10, fill: '#64748b', fontWeight: 'bold' }} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontWeight: 'bold' }}
                    formatter={(value) => [value, 'Frota Real']}
                  />
                  <Bar dataKey="frotaReal" name="Frota Real" fill="#113366" radius={[0, 4, 4, 0]} barSize={20}>
                    <LabelList dataKey="frotaReal" position="right" style={{ fill: '#113366', fontSize: 10, fontWeight: 'bold' }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* GRÁFICO 2 - COMPOSIÇÃO 100% STACKED */}
          <div className="bg-white dark:bg-[#1f232d] p-5 rounded-2xl border border-slate-200 dark:border-gray-800 shadow-sm flex flex-col">
            <div className="flex items-center gap-2 mb-4 border-b border-slate-100 dark:border-gray-800 pb-3">
              <Activity size={20} className="text-[#EE4D2D]" />
              <div>
                <h4 className="text-sm font-black text-[#113366] dark:text-white uppercase tracking-wider">Composição do Cluster (100%)</h4>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Proporção entre Oferta e Demanda Absorvida/Rejeitada</p>
              </div>
            </div>
            <div className="flex-1 w-full min-h-[350px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} stackOffset="expand" layout="vertical" margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#e2e8f0" />
                  <XAxis type="number" tickFormatter={(tick) => `${(tick * 100).toFixed(0)}%`} tick={{ fontSize: 10 }} />
                  <YAxis dataKey="chartName" type="category" width={180} tick={{ fontSize: 10, fill: '#64748b', fontWeight: 'bold' }} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontWeight: 'bold' }}
                    formatter={(value, name) => [value, name]}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', fontWeight: 'bold', paddingTop: '10px' }} />
                  
                  <Bar dataKey="dispo" name="Frota Disponível" stackId="a" fill="#113366" barSize={20} />
                  <Bar dataKey="expedidas" name="Expedidas" stackId="a" fill="#10b981" />
                  <Bar dataKey="atPiso" name="AT Piso" stackId="a" fill="#f59e0b" />
                  <Bar dataKey="recusas" name="Recusas" stackId="a" fill="#ef4444" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

        </div>
      )}

    </div>
  );
}