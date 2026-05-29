import React, { useState, useMemo, useEffect } from 'react';
import { Search, MapPin, Download, Layers, TrendingUp, ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react';
import { ResponsiveContainer, ComposedChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, LabelList } from 'recharts';

// Tirado para fora para otimizar renderização do Recharts
const CustomTooltipRank = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white dark:bg-[#1f232d] p-3 rounded-lg shadow-xl border border-[#113366]">
        <p className="font-black text-[#113366] dark:text-[#EE4D2D] border-b border-slate-200 pb-2 mb-2">{label}</p>
        <p className="font-black text-[#113366] dark:text-white">
           Total AT Piso: <span className="text-lg text-[#EE4D2D]">{payload[0].value.toLocaleString('pt-BR')}</span>
        </p>
      </div>
    );
  }
  return null;
};

export default function AtPisoClusterTable({ atPisoClusterData, filtrosGlobais = {} }) {
  const [viewMode, setViewMode] = useState('semana'); 
  const [searchTerm, setSearchTerm] = useState('');
  const [hubDownload, setHubDownload] = useState('');
  
  const [expandedHubs, setExpandedHubs] = useState({});

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);

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
    const yearStart = new Date(Date.UTC(dCopy.getUTCFullYear(), 0, 1));
    return `W-${String(Math.ceil((((dCopy - yearStart) / 86400000) + 1) / 7)).padStart(2, '0')}`;
  };

  const getHeatmapColor = (val) => {
    if (val === null || val === undefined || val === '') return 'bg-[#e2f0d9] text-[#385723] dark:bg-[#e2f0d9]/10 dark:text-green-400';
    const num = Number(val);
    if (num === 0) return 'bg-[#e2f0d9] text-[#385723] dark:bg-[#e2f0d9]/10 dark:text-green-400';
    if (num <= 2) return 'bg-[#fff2cc] text-[#7f6000] dark:bg-[#fff2cc]/20 dark:text-yellow-200';
    if (num <= 4) return 'bg-[#ffe599] text-[#7f6000] dark:bg-[#ffe599]/20 dark:text-yellow-300';
    if (num <= 6) return 'bg-[#ffd966] text-[#7f6000] dark:bg-[#ffd966]/20 dark:text-yellow-400';
    if (num <= 8) return 'bg-[#f4b084] text-[#783f04] dark:bg-[#f4b084]/30 dark:text-orange-300';
    if (num <= 10) return 'bg-[#ed7d31] text-white dark:bg-[#ed7d31]/50 dark:text-orange-400';
    if (num <= 15) return 'bg-[#e06666] text-white dark:bg-[#e06666]/70 dark:text-red-300';
    if (num <= 25) return 'bg-[#cc0000] text-white dark:bg-[#cc0000]/80 dark:text-red-400';
    return 'bg-[#990000] text-white dark:bg-[#990000] dark:text-white';
  };

  function parseDateLocal(str) {
    if (!str) return null;
    let s = str.split(' ')[0];
    if (s.includes('/')) {
      const [d, m, y] = s.split('/');
      return new Date(`${y.length === 2 ? '20' + y : y}-${m}-${d}T12:00:00`);
    }
    return new Date(str);
  }

  // =========================================================
  // MOTOR DE PROCESSAMENTO
  // =========================================================
  const matrix = useMemo(() => {
    if (!atPisoClusterData || atPisoClusterData.length < 2) {
      return { headers: [], rows: [], stationsUnicas: [], ranking: [] };
    }

    const { regional = [], station = [], dataInicio = '', dataFim = '', semana = '', mes = '' } = filtrosGlobais;
    
    const aggs = {};
    const colTimeSet = new Set();
    const stationsSet = new Set();
    const clusterRankMap = {};

    const dataInicioObj = dataInicio ? new Date(dataInicio + 'T00:00:00') : null;
    const dataFimObj = dataFim ? new Date(dataFim + 'T23:59:59') : null;

    atPisoClusterData.slice(1).forEach(row => {
      const dataStr = String(row[0] || "").trim();
      const subreg = String(row[2] || "").trim(); 
      const hub = String(row[3] || "").trim();
      const cluster = String(row[4] || "").trim();
      const qtdAt = Number(row[5] || 0);

      if (!hub || !cluster) return;

      if (regional.length > 0 && !regional.includes(subreg)) return;
      if (station.length > 0 && !station.includes(hub)) return;

      const dObj = parseDateLocal(dataStr);
      if (dObj) {
        if (dataInicioObj && dObj < dataInicioObj) return;
        if (dataFimObj && dObj > dataFimObj) return;
        if (mes && String(dObj.getMonth() + 1).padStart(2, '0') !== mes) return;
      }
      if (semana && getISOWeek(dataStr) !== semana) return;

      if (searchTerm && !hub.toLowerCase().includes(searchTerm.toLowerCase()) && !cluster.toLowerCase().includes(searchTerm.toLowerCase())) return;

      let chaveTempo = "";

      if (viewMode === 'dia') {
        if (dObj) chaveTempo = `${String(dObj.getDate()).padStart(2, '0')}/${String(dObj.getMonth() + 1).padStart(2, '0')}`;
      } else if (viewMode === 'semana') {
        chaveTempo = getISOWeek(dataStr);
      } else if (viewMode === 'mes') {
        if (dObj) chaveTempo = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'][dObj.getMonth()];
      }

      if (!chaveTempo) return;

      colTimeSet.add(chaveTempo);
      stationsSet.add(hub);

      if (!aggs[hub]) aggs[hub] = { hub, valoresHub: {}, clustersMap: {} };
      if (aggs[hub].valoresHub[chaveTempo] === undefined) aggs[hub].valoresHub[chaveTempo] = 0;
      aggs[hub].valoresHub[chaveTempo] += qtdAt;

      if (!aggs[hub].clustersMap[cluster]) aggs[hub].clustersMap[cluster] = { cluster, valores: {} };
      if (aggs[hub].clustersMap[cluster].valores[chaveTempo] === undefined) aggs[hub].clustersMap[cluster].valores[chaveTempo] = 0;
      aggs[hub].clustersMap[cluster].valores[chaveTempo] += qtdAt;

      const nomeUnicoCluster = `${hub} - ${cluster}`;
      if (!clusterRankMap[nomeUnicoCluster]) clusterRankMap[nomeUnicoCluster] = 0;
      clusterRankMap[nomeUnicoCluster] += qtdAt;
    });

    const MESES_ORDEM = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];
    const headers = Array.from(colTimeSet).sort((a, b) => {
      if (viewMode === 'mes') {
        return MESES_ORDEM.indexOf(a) - MESES_ORDEM.indexOf(b);
      } else if (viewMode === 'dia') {
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

    const ranking = Object.entries(clusterRankMap)
       .map(([name, total]) => ({ name, total }))
       .sort((a, b) => b.total - a.total)
       .slice(0, 12);

    return { headers, rows, stationsUnicas: Array.from(stationsSet).sort(), ranking };
  }, [atPisoClusterData, viewMode, filtrosGlobais, searchTerm]);

  useEffect(() => { setCurrentPage(1); }, [matrix.rows.length, itemsPerPage]);

  const toggleHub = (hubName) => {
    setExpandedHubs(prev => ({ ...prev, [hubName]: !prev[hubName] }));
  };

  const totalPages = Math.max(1, Math.ceil(matrix.rows.length / itemsPerPage));
  const paginatedRows = matrix.rows.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const exportarClusterCSV = () => {
    if (!hubDownload) return alert("Por favor, selecione uma Station antes de baixar.");
    
    const hubData = matrix.rows.find(r => r.hub === hubDownload);
    if (!hubData || hubData.clusters.length === 0) return alert("Nenhum registro encontrado para esta Station.");

    const colunasHeaders = ["Station", "Cluster", ...matrix.headers];
    const linhas = hubData.clusters.map(c => {
        const valoresTime = matrix.headers.map(h => c.valores[h] !== undefined ? c.valores[h] : "-");
        return [hubData.hub, c.cluster, ...valoresTime].join(",");
    });

    const csvContent = "\uFEFF" + [colunasHeaders.join(","), ...linhas].join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `Estudo_Cluster_AT_${hubDownload.replace(/\s+/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex flex-col gap-6">
      
      {/* CARD DE SELEÇÃO DE MODOS E DOWNLOAD */}
      <div className="bg-white dark:bg-[#1f232d] p-6 rounded-2xl border border-slate-200 dark:border-gray-800 shadow-sm">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-2">
            <Layers className="text-[#EE4D2D]" size={22} />
            <div>
              <h3 className="text-lg font-black text-[#113366] dark:text-white uppercase">Volume de AT no Piso por Cluster</h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Visão analítica de acúmulo de carretas na malha</p>
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
              className="flex items-center gap-1.5 bg-[#EE4D2D] hover:bg-[#D0011B] text-white px-4 py-2 rounded-lg text-xs font-black uppercase transition-all shadow-sm"
            >
              Baixar CSV
            </button>
          </div>
        </div>

        <div className="flex flex-col md:flex-row justify-between items-center mt-6 gap-4 border-t border-slate-100 dark:border-gray-800 pt-4">
          <div className="relative w-full md:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
            <input 
              type="text"
              placeholder="Buscar Hub ou Cluster..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-50 dark:bg-[#15171e] dark:text-white border border-slate-200 dark:border-gray-700 rounded-lg py-2 pl-9 pr-3 text-xs font-bold outline-none"
            />
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

      {/* GRADE DA MATRIZ / HEATMAP EXPANSÍVEL */}
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
                      
                      {/* LINHA PAI (MÉDIA/TOTAL DO HUB) */}
                      <tr 
                        onClick={() => toggleHub(rowHub.hub)} 
                        className="cursor-pointer bg-slate-100/80 dark:bg-gray-800 hover:bg-orange-50 dark:hover:bg-gray-700 transition-colors h-9"
                      >
                        <td className="p-3 text-left font-black text-[#113366] dark:text-blue-400 border-r border-slate-200 dark:border-gray-700 sticky left-0 z-[30] bg-slate-100/80 dark:bg-gray-800 flex items-center gap-2">
                          {isOpen ? <ChevronDown size={16} className="text-[#EE4D2D]"/> : <ChevronRight size={16} className="text-slate-400"/>}
                          <MapPin size={13} className="text-[#EE4D2D] shrink-0" />
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

                      {/* LINHAS FILHAS (CLUSTERS) */}
                      {isOpen && rowHub.clusters.map((c) => (
                        <tr key={`cluster-${rowHub.hub}-${c.cluster}`} className="bg-white dark:bg-[#15171e] transition-colors hover:bg-slate-50/50 h-9">
                          <td className="p-3 text-left pl-12 font-black text-slate-800 dark:text-gray-200 border-r border-slate-100 dark:border-gray-800 sticky left-0 z-[30] bg-white dark:bg-[#15171e] flex items-center gap-1.5">
                            <Layers size={11} className="text-slate-400" />
                            Cluster
                          </td>
                          <td className="p-3 font-bold text-slate-500 uppercase tracking-wider text-[10px] border-r border-slate-100 dark:border-gray-800 sticky left-[220px] z-[30] bg-white dark:bg-[#15171e] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                            {c.cluster}
                          </td>
                          {matrix.headers.map(h => {
                            const val = c.valores[h];
                            return (
                              <td key={`cluster-${rowHub.hub}-${c.cluster}-${h}`} className={`p-3 font-black border-r border-slate-100 dark:border-gray-800 ${getHeatmapColor(val)}`}>
                                {val !== undefined ? val : '-'}
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

        {/* FOOTER / PAGINAÇÃO */}
        <div className="px-4 py-2 border-t border-[#113366] flex justify-between items-center bg-slate-50 dark:bg-[#1f232d] shrink-0">
          <div className="flex items-center gap-3">
            <div className="text-[9px] font-black text-[#113366] dark:text-slate-400 uppercase tracking-widest bg-white dark:bg-gray-800 px-2 py-1 rounded border border-slate-200 dark:border-gray-700 shadow-sm">
              Total: {matrix.rows.length} Hubs
            </div>
            
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] font-bold text-slate-400 uppercase">Exibir:</span>
              <select 
                className="bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 text-[10px] font-bold text-[#113366] dark:text-white rounded px-1.5 py-0.5 outline-none cursor-pointer"
                value={itemsPerPage}
                onChange={(e) => setItemsPerPage(Number(e.target.value))}
              >
                <option value={20}>20 Hubs</option>
                <option value={50}>50 Hubs</option>
                <option value={100}>100 Hubs</option>
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

      {/* RANKING TOP 12 CLUSTERS - GRÁFICO DE BARRAS VERTICAL */}
      {matrix.ranking.length > 0 && (
        <div className="bg-white dark:bg-[#1f232d] rounded-2xl shadow-sm border border-slate-200 dark:border-gray-800 p-6 shrink-0 h-[450px] flex flex-col">
          <div className="flex items-center gap-2 mb-4 border-b border-slate-100 dark:border-gray-800 pb-3 shrink-0">
            <TrendingUp className="text-[#EE4D2D]" size={20} />
            <h3 className="font-black text-[#113366] dark:text-white uppercase">Top 12: Clusters Ofensores de AT (Piso)</h3>
          </div>
          
          <div className="flex-1 w-full h-full min-h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={matrix.ranking} margin={{ top: 20, right: 20, left: -20, bottom: 60 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fontWeight: 'bold', fill: '#113366' }} 
                  angle={-45} 
                  textAnchor="end" 
                  interval={0} 
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 11, fill: '#113366' }} 
                />
                <Tooltip content={<CustomTooltipRank />} cursor={{ fill: 'rgba(0,0,0,0.05)' }} />
                
                <Bar dataKey="total" name="Total ATs" fill="#EE4D2D" radius={[4, 4, 0, 0]} maxBarSize={50}>
                  <LabelList 
                    dataKey="total" 
                    position="top" 
                    style={{ fill: '#EE4D2D', fontSize: 11, fontWeight: '900' }} 
                  />
                </Bar>
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

    </div>
  );
}