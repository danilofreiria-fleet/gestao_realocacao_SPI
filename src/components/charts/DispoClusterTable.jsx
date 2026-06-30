import React, { useState, useMemo, useEffect } from 'react';
import { Search, MapPin, Layers, ChevronLeft, ChevronRight, ChevronDown, Users, Info, Truck, TrendingUp, TrendingDown } from 'lucide-react';
import { MAPA_REGIONAL_COMPLETO } from '../../constants/regionais';

export default function DispoClusterTable({ dispoData, filtrosGlobais = {} }) {
  const [viewMode, setViewMode] = useState('dia'); 
  const [searchTerm, setSearchTerm] = useState('');
  const [hubDownload, setHubDownload] = useState('');
  const [selectedModal, setSelectedModal] = useState(''); 
  
  const [expandedHubs, setExpandedHubs] = useState({});
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);

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
      return `${a}-${m}-${dia}`;
    }
    return s;
  };

  const getISOWeek = (isoDate) => {
    if (!isoDate) return "";
    const d = new Date(isoDate + 'T12:00:00');
    const dCopy = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const dayNum = dCopy.getUTCDay() || 7;
    dCopy.setUTCDate(dCopy.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(dCopy.getUTCFullYear(), 0, 1));
    return `W-${String(Math.ceil((((dCopy - yearStart) / 86400000) + 1) / 7)).padStart(2, '0')}`;
  };

  const getHeatmapColor = (val) => {
    if (!val || val === 0) return 'bg-[#ffebee] text-[#cc0000] dark:bg-red-950/50 dark:text-red-400'; 
    if (val <= 10) return 'bg-[#ffe0b2] text-[#e65100] dark:bg-orange-950/40 dark:text-orange-400';    
    if (val <= 15) return 'bg-[#fff2cc] text-[#7f6000] dark:bg-yellow-950/30 dark:text-yellow-400';    
    if (val <= 20) return 'bg-[#e2f0d9] text-[#385723] dark:bg-green-950/30 dark:text-green-400';     
    if (val <= 50) return 'bg-[#c8e6c9] text-[#1b5e20] dark:bg-green-900/40 dark:text-green-300';     
    return 'bg-[#2e7d32] text-white dark:bg-[#1b5e20] dark:text-white';                                
  };

  const modaisUnicos = useMemo(() => {
    if (!dispoData || dispoData.length < 2) return [];
    const modalSet = new Set();
    dispoData.slice(1).forEach(row => {
      const modal = String(row[3] || "").trim().toUpperCase();
      if (modal) modalSet.add(modal);
    });
    return Array.from(modalSet).sort();
  }, [dispoData]);

  const matrix = useMemo(() => {
    if (!dispoData || dispoData.length < 2) {
      return { headers: [], rows: [], stationsUnicas: [] };
    }

    const { regional = [], station = [], turno = [], dataInicio = '', dataFim = '', semana = '', mes = '' } = filtrosGlobais;
    
    const aggs = {};
    const colTimeSet = new Set();
    const stationsSet = new Set();
    
    const dataInicioObj = dataInicio ? new Date(dataInicio + 'T00:00:00') : null;
    const dataFimObj = dataFim ? new Date(dataFim + 'T23:59:59') : null;

    // 🔥 HIGIENIZADOR
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

    dispoData.slice(1).forEach(row => {
      const hubRaw = String(row[0] || "").trim();
      let clusterRaw = String(row[1] || "").trim();

      if (!clusterRaw || clusterRaw.toUpperCase() === "NÃO PREENCHIDO" || clusterRaw.toUpperCase() === "NAO PREENCHIDO" || clusterRaw === "-") {
        clusterRaw = "SEM CLUSTER";
      }

      let turnoRaw = String(row[2] || "").trim().toUpperCase();
      let turnoConfirmado = turnoRaw;
      if (turnoRaw === 'SD') turnoConfirmado = 'PM1';
      else if (turnoRaw === 'PM') turnoConfirmado = 'PM2';

      const modalRow = String(row[3] || "").trim().toUpperCase();
      const dataRaw = row[4]; 
      const qtd = parseNum(row[5]); 

      const subreg = MAPA_REGIONAL_COMPLETO[hubRaw] || ""; 

      if (!hubRaw || !dataRaw || qtd === 0) return;

      if (regional.length > 0 && !regional.includes(subreg)) return;
      if (station.length > 0 && !station.includes(hubRaw)) return;
      if (turno.length > 0 && !turno.includes(turnoConfirmado)) return;
      if (selectedModal && modalRow !== selectedModal) return; 

      if (searchTerm && !hubRaw.toLowerCase().includes(searchTerm.toLowerCase()) && !clusterRaw.toLowerCase().includes(searchTerm.toLowerCase())) return;

      const isoDate = parseUniversalDate(dataRaw);
      if (!isoDate) return;

      const dObj = new Date(`${isoDate}T12:00:00`);
      
      if (dataInicioObj && dObj < dataInicioObj) return;
      if (dataFimObj && dObj > dataFimObj) return;
      if (mes && String(dObj.getMonth() + 1).padStart(2, '0') !== mes) return;
      if (semana && getISOWeek(isoDate) !== semana) return;

      let dynamicKey = "";
      if (viewMode === 'dia') {
        dynamicKey = `${String(dObj.getDate()).padStart(2, '0')}/${String(dObj.getMonth() + 1).padStart(2, '0')}`;
      } else if (viewMode === 'semana') {
        dynamicKey = getISOWeek(isoDate);
      } else if (viewMode === 'mes') {
        dynamicKey = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'][dObj.getMonth()];
      }

      if (!dynamicKey) return;

      colTimeSet.add(dynamicKey);
      
      const hubCleanKey = sanitizeForKey(hubRaw);
      const clusterCleanKey = sanitizeForKey(clusterRaw);
      
      stationsSet.add(hubRaw);

      if (!aggs[hubCleanKey]) aggs[hubCleanKey] = { hub: hubRaw, valoresHub: {}, clustersMap: {} };
      if (aggs[hubCleanKey].valoresHub[dynamicKey] === undefined) aggs[hubCleanKey].valoresHub[dynamicKey] = 0;
      aggs[hubCleanKey].valoresHub[dynamicKey] += qtd;

      if (!aggs[hubCleanKey].clustersMap[clusterCleanKey]) aggs[hubCleanKey].clustersMap[clusterCleanKey] = { cluster: clusterRaw.toUpperCase(), valores: {} };
      if (aggs[hubCleanKey].clustersMap[clusterCleanKey].valores[dynamicKey] === undefined) aggs[hubCleanKey].clustersMap[clusterCleanKey].valores[dynamicKey] = 0;
      aggs[hubCleanKey].clustersMap[clusterCleanKey].valores[dynamicKey] += qtd;
    });

    const MESES_ORDEM = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];
    const headers = Array.from(colTimeSet).sort((a, b) => {
      if (viewMode === 'mes') return MESES_ORDEM.indexOf(a) - MESES_ORDEM.indexOf(b);
      if (viewMode === 'dia') {
         const [d1, m1] = a.split('/');
         const [d2, m2] = b.split('/');
         if (m1 !== m2) return Number(m1) - Number(m2);
         return Number(d1) - Number(d2);
      }
      return a.localeCompare(b);
    });

    const rows = Object.values(aggs).map(h => {
      const clustersList = Object.values(h.clustersMap).sort((a, b) => a.cluster.localeCompare(b.cluster));
      return { hub: h.hub, valoresHub: h.valoresHub, clusters: clustersList };
    }).sort((a, b) => a.hub.localeCompare(b.hub));

    return { headers, rows, stationsUnicas: Array.from(stationsSet).sort() };
  }, [dispoData, viewMode, filtrosGlobais, searchTerm, selectedModal]);

  const { topClusters, bottomClusters } = useMemo(() => {
    const list = [];
    matrix.rows.forEach(r => {
      r.clusters.forEach(c => {
        const totalVolume = Object.values(c.valores).reduce((acc, curr) => acc + curr, 0);
        if (totalVolume > 0) {
          list.push({
            id: `${r.hub.split('_').pop()} - ${c.cluster}`,
            hub: r.hub,
            cluster: c.cluster,
            total: totalVolume
          });
        }
      });
    });

    const sortedAsc = [...list].sort((a, b) => a.total - b.total);
    const sortedDesc = [...list].sort((a, b) => b.total - a.total);

    return {
      topClusters: sortedDesc.slice(0, 5),
      bottomClusters: sortedAsc.slice(0, 5)
    };
  }, [matrix.rows]);

  useEffect(() => { setCurrentPage(1); }, [matrix.rows.length, itemsPerPage]);

  const toggleHub = (hubName) => setExpandedHubs(prev => ({ ...prev, [hubName]: !prev[hubName] }));

  const totalPages = Math.max(1, Math.ceil(matrix.rows.length / itemsPerPage));
  const paginatedRows = matrix.rows.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const exportarClusterCSV = () => {
    if (!hubDownload) return alert("Por favor, selecione uma Station antes de baixar.");
    const hubData = matrix.rows.find(r => r.hub === hubDownload);
    if (!hubData || hubData.clusters.length === 0) return alert("Nenhum registro encontrado para esta Station.");

    const colunasHeaders = ["Station", "Cluster", ...matrix.headers];
    const linhas = hubData.clusters.map(c => {
        const valoresTime = matrix.headers.map(h => c.valores[h] !== undefined ? c.valores[h] : "0");
        return [hubData.hub, c.cluster, ...valoresTime].join(",");
    });

    const csvContent = "\uFEFF" + [colunasHeaders.join(","), ...linhas].join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `Disponibilidade_Clusters_${hubDownload.replace(/\s+/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const maxTopVal = topClusters.length > 0 ? topClusters[0].total : 1;
  const maxBottomVal = bottomClusters.length > 0 ? Math.max(...bottomClusters.map(b => b.total)) : 1;

  return (
    <div className="flex flex-col gap-6 relative">
      
      {/* CARD DE SELEÇÃO E CONTROLES */}
      <div className="bg-white dark:bg-[#1f232d] p-6 rounded-2xl border border-slate-200 dark:border-gray-800 shadow-sm mt-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-2">
            <Users className="text-[#113366] dark:text-blue-400" size={22} />
            <div>
              <h3 className="text-lg font-black text-[#113366] dark:text-white uppercase">Disponibilidade por Cluster</h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Frota alocada na ponta</p>
            </div>
          </div>

          <div className="flex items-center gap-3 bg-slate-50 dark:bg-[#15171e] p-2 rounded-xl border border-slate-200 dark:border-gray-700 w-full md:w-auto">
            <select 
              value={hubDownload} 
              onChange={(e) => setHubDownload(e.target.value)}
              className="bg-white dark:bg-[#1f232d] dark:text-white text-xs font-bold p-2 rounded-lg border border-slate-200 dark:border-gray-700 outline-none cursor-pointer min-w-[180px]"
            >
              <option value="">Selecione a Station...</option>
              {matrix.stationsUnicas.map(h => <option key={`dl-cl-${h}`} value={h}>{h}</option>)}
            </select>
            <button 
              onClick={exportarClusterCSV}
              className="flex items-center gap-1.5 bg-[#113366] hover:bg-[#0d2a54] text-white px-4 py-2 rounded-lg text-xs font-black uppercase transition-all shadow-sm"
            >
              Baixar CSV
            </button>
          </div>
        </div>

        <div className="flex flex-col md:flex-row justify-between items-center mt-6 gap-4 border-t border-slate-100 dark:border-gray-800 pt-4">
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto flex-1">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
              <input 
                type="text"
                placeholder="Buscar Hub ou Cluster..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-50 dark:bg-[#15171e] dark:text-white border border-slate-200 dark:border-gray-700 rounded-lg py-2 pl-9 pr-3 text-xs font-bold outline-none"
              />
            </div>

            <select
              value={selectedModal}
              onChange={(e) => setSelectedModal(e.target.value)}
              className="w-full sm:w-48 bg-slate-50 dark:bg-[#15171e] dark:text-white border border-slate-200 dark:border-gray-700 rounded-lg py-2 px-3 text-xs font-bold outline-none cursor-pointer uppercase"
            >
              <option value="">🚙 Todos os Modais</option>
              {modaisUnicos.map(modal => (
                <option key={`modal-opt-${modal}`} value={modal}>{modal}</option>
              ))}
            </select>
          </div>

          <div className="flex bg-slate-100 dark:bg-[#15171e] p-1 rounded-xl border border-slate-200 dark:border-gray-700">
            {['dia', 'semana', 'mes'].map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`px-5 py-1.5 rounded-lg text-xs font-black uppercase transition-all ${viewMode === mode ? 'bg-[#113366] text-white shadow-md' : 'text-slate-500 hover:text-[#113366]'}`}
              >
                {mode === 'dia' ? 'Dia' : mode === 'semana' ? 'Semana' : 'Mês'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* MATRIZ / HEATMAP */}
      <div className="bg-white dark:bg-[#1f232d] rounded-2xl shadow-sm border border-[#113366] overflow-hidden flex flex-col flex-1">
        <div className="overflow-x-auto w-full custom-scrollbar max-h-[500px]">
          <table className="w-full border-collapse text-center">
            <thead className="bg-[#113366] text-white tracking-widest text-[10px] uppercase font-black">
              <tr>
                <th className="p-4 text-left w-[220px] min-w-[220px] sticky left-0 top-0 z-[40] bg-[#113366] border-r border-white/20">STATION (HUB)</th>
                <th className="p-4 w-[150px] min-w-[150px] sticky left-[220px] top-0 z-[40] bg-[#113366] border-r border-white/20 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.3)]">CLUSTER</th>
                {matrix.headers.map(h => (
                  <th key={`head-${h}`} className="p-4 min-w-[70px] bg-[#113366] border-l border-white/10 sticky top-0 z-[20]">{h}</th>
                ))}
              </tr>
            </thead>
            
            <tbody className="divide-y divide-slate-100 dark:divide-gray-800 font-black text-xs">
              {paginatedRows.length === 0 ? (
                <tr>
                  <td colSpan={matrix.headers.length + 2} className="p-12 text-center text-slate-400 font-bold">
                    Nenhum dado encontrado para os filtros ativos.
                  </td>
                </tr>
              ) : (
                paginatedRows.map((rowHub) => {
                  const isOpen = !!expandedHubs[rowHub.hub];
                  return (
                    <React.Fragment key={rowHub.hub}>
                      <tr 
                        onClick={() => toggleHub(rowHub.hub)} 
                        className="cursor-pointer bg-slate-100/80 dark:bg-gray-800 hover:bg-blue-50 dark:hover:bg-gray-700 transition-colors h-9"
                      >
                        <td className="p-3 text-left font-black text-[#113366] dark:text-blue-400 border-r border-slate-200 dark:border-gray-700 sticky left-0 z-[30] bg-slate-100/80 dark:bg-gray-800 flex items-center gap-2">
                          {isOpen ? <ChevronDown size={16} className="text-[#113366] dark:text-blue-400"/> : <ChevronRight size={16} className="text-slate-400"/>}
                          <MapPin size={13} className="text-[#113366] dark:text-blue-400 shrink-0" />
                          {rowHub.hub}
                        </td>
                        <td className="p-3 font-black text-[#113366] dark:text-white uppercase tracking-wider text-[10px] border-r border-slate-200 dark:border-gray-700 sticky left-[220px] z-[30] bg-slate-100/80 dark:bg-gray-800 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                          TOTAL STATION
                        </td>
                        {matrix.headers.map(h => {
                          const val = rowHub.valoresHub[h];
                          return (
                            <td key={`hub-${rowHub.hub}-${h}`} className={`p-3 font-black border-r border-slate-200 dark:border-gray-700 ${getHeatmapColor(val)}`}>
                              {val !== undefined ? val : '-'}
                            </td>
                          );
                        })}
                      </tr>

                      {isOpen && rowHub.clusters.map((c) => (
                        <tr key={`cluster-${rowHub.hub}-${c.cluster}`} className="bg-white dark:bg-[#15171e] transition-colors hover:bg-slate-50/50 h-9">
                          <td className="p-3 text-left pl-12 font-black text-slate-800 dark:text-gray-200 border-r border-slate-100 dark:border-gray-800 sticky left-0 z-[30] bg-white dark:bg-[#15171e] flex items-center gap-1.5">
                            <Layers size={11} className="text-slate-400" /> Cluster
                          </td>
                          <td className="p-3 font-bold text-slate-500 uppercase tracking-wider text-[10px] border-r border-slate-100 dark:border-gray-800 sticky left-[220px] z-[30] bg-white dark:bg-[#15171e] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                            {c.cluster}
                          </td>
                          {matrix.headers.map(h => {
                            const val = c.valores[h];
                            return (
                              <td key={`cluster-${rowHub.hub}-${c.cluster}-${h}`} className={`p-3 font-black border-r border-slate-100 dark:border-gray-800 ${getHeatmapColor(val)}`}>
                                {val !== undefined && val > 0 ? val : '-'}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* PAGINAÇÃO */}
        <div className="px-4 py-2 border-t border-[#113366] flex justify-between items-center bg-slate-50 dark:bg-[#1f232d] shrink-0">
          <div className="flex items-center gap-3">
            <div className="text-[9px] font-black text-[#113366] dark:text-slate-400 uppercase tracking-widest bg-white dark:bg-gray-800 px-2 py-1 rounded border border-slate-200 dark:border-gray-700 shadow-sm">
              Total: {matrix.rows.length} Hubs
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} className="p-1 rounded bg-white dark:bg-gray-800 text-[#113366] hover:bg-slate-200 disabled:opacity-30 transition-all shadow-sm border border-slate-200"><ChevronLeft size={14}/></button>
            <span className="text-[10px] font-black text-[#113366] dark:text-white uppercase tracking-wider">Pág {currentPage}/{totalPages}</span>
            <button disabled={currentPage === totalPages || totalPages === 0} onClick={() => setCurrentPage(p => p + 1)} className="p-1 rounded bg-white dark:bg-gray-800 text-[#113366] hover:bg-slate-200 disabled:opacity-30 transition-all shadow-sm border border-slate-200"><ChevronRight size={14}/></button>
          </div>
        </div>
      </div>

      {/* 🔥 NOVA DIV: GRÁFICOS DE RANKING (ABAIXO DO HEATMAP) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-2">
        
        {/* GRÁFICO 1 - MAIS DISPONIBILIDADES (AZUL #113366) */}
        <div className="bg-white dark:bg-[#1f232d] p-5 rounded-2xl border border-slate-200 dark:border-gray-800 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="p-1.5 bg-green-50 dark:bg-green-950/40 rounded-lg">
                <TrendingUp size={16} className="text-[#113366] dark:text-blue-400" />
              </div>
              <div>
                <h4 className="text-xs font-black text-[#113366] dark:text-white uppercase tracking-wider">Top 5 Clusters + Abastecidos</h4>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Maior volume total no período filtrado</p>
              </div>
            </div>

            <div className="space-y-3.5 my-2">
              {topClusters.length === 0 ? (
                <p className="text-xs font-bold text-slate-400 text-center py-6">Sem dados suficientes.</p>
              ) : (
                topClusters.map((item, index) => {
                  const pct = Math.max(8, (item.total / maxTopVal) * 100);
                  return (
                    <div key={`top-${item.id}`} className="flex flex-col gap-1">
                      <div className="flex justify-between items-center text-[11px] font-black tracking-wide">
                        <span className="text-slate-700 dark:text-slate-300 truncate max-w-[80%] uppercase">
                          <span className="text-slate-400 mr-1">#{index + 1}</span> {item.id}
                        </span>
                        <span className="text-[#113366] dark:text-blue-400 font-black bg-slate-50 dark:bg-gray-800 px-2 py-0.5 rounded border border-slate-100 dark:border-gray-700">
                          {item.total}
                        </span>
                      </div>
                      <div className="w-full bg-slate-100 dark:bg-gray-800 h-2.5 rounded-full overflow-hidden">
                        <div 
                          className="bg-[#113366] h-full rounded-full transition-all duration-500" 
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
          <div className="border-t border-slate-100 dark:border-gray-800 pt-2.5 mt-2 flex items-center justify-between text-[9px] font-bold uppercase tracking-wider text-slate-400">
            <span>Métrica: Volumetria de Escala</span>
            <span className="text-[#EE4D2D]">Indicador de Folga</span>
          </div>
        </div>

        {/* GRÁFICO 2 - MENOS DISPONIBILIDADES (VERMELHO #D0011B) */}
        <div className="bg-white dark:bg-[#1f232d] p-5 rounded-2xl border border-slate-200 dark:border-gray-800 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="p-1.5 bg-red-50 dark:bg-red-950/40 rounded-lg">
                <TrendingDown size={16} className="text-[#D0011B]" />
              </div>
              <div>
                <h4 className="text-xs font-black text-[#D0011B] uppercase tracking-wider">Top 5 Clusters Críticos (Vazios)</h4>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Menor volume total acumulado no período</p>
              </div>
            </div>

            <div className="space-y-3.5 my-2">
              {bottomClusters.length === 0 ? (
                <p className="text-xs font-bold text-slate-400 text-center py-6">Sem dados suficientes.</p>
              ) : (
                bottomClusters.map((item, index) => {
                  const pct = Math.max(8, (item.total / maxBottomVal) * 100);
                  return (
                    <div key={`bot-${item.id}`} className="flex flex-col gap-1">
                      <div className="flex justify-between items-center text-[11px] font-black tracking-wide">
                        <span className="text-slate-700 dark:text-slate-300 truncate max-w-[80%] uppercase">
                          <span className="text-slate-400 mr-1">#{index + 1}</span> {item.id}
                        </span>
                        <span className="text-[#D0011B] font-black bg-red-50 dark:bg-red-950/30 px-2 py-0.5 rounded border border-red-100 dark:border-red-900/30">
                          {item.total}
                        </span>
                      </div>
                      <div className="w-full bg-slate-100 dark:bg-gray-800 h-2.5 rounded-full overflow-hidden">
                        <div 
                          className="bg-[#D0011B] h-full rounded-full transition-all duration-500" 
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
          <div className="border-t border-slate-100 dark:border-gray-800 pt-2.5 mt-2 flex items-center justify-between text-[9px] font-bold uppercase tracking-wider text-slate-400">
            <span>Ação Requerida: Alocação urgente</span>
            <span className="text-[#EE4D2D]">Alerta Máximo</span>
          </div>
        </div>

      </div>

    </div>
  );
}