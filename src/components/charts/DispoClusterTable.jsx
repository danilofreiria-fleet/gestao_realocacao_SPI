import React, { useState, useMemo, useEffect } from 'react';
import { Search, MapPin, Layers, ChevronLeft, ChevronRight, ChevronDown, Users, Loader2, TrendingUp, TrendingDown } from 'lucide-react';
import { calcularMatrizDispo } from '../../utils/motorEstudosCluster'; 

const fastSanitizeString = (str) => {
  if (!str) return "";
  return String(str).toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Z0-9]/g, ' ').trim();
};

export default function DispoClusterTable({ dispoData, filtrosGlobais = {} }) {
  const currentRegional = localStorage.getItem("selectedRegional");
  const [viewMode, setViewMode] = useState('semana'); 
  const [searchTerm, setSearchTerm] = useState('');
  const [hubDownload, setHubDownload] = useState('');
  const [selectedModal, setSelectedModal] = useState(''); 
  const [expandedHubs, setExpandedHubs] = useState({});
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);

  // ESTADOS DO "BACKEND"
  const [isCalculating, setIsCalculating] = useState(false);
  const [matrix, setMatrix] = useState({ headers: [], rows: [], stationsUnicas: [], modaisUnicos: [] });

  const stringFiltros = JSON.stringify(filtrosGlobais);
  const lenData = dispoData?.length || 0;

  useEffect(() => {
    let isMounted = true;
    const rodarMotor = async () => {
      setIsCalculating(true);
      const resultado = await calcularMatrizDispo({
        dispoData, filtrosGlobais, selectedModal, currentRegional, viewMode
      });
      if (isMounted) {
        setMatrix(resultado || { headers: [], rows: [], stationsUnicas: [], modaisUnicos: [] });
        setIsCalculating(false);
      }
    };
    rodarMotor();
    return () => { isMounted = false; };
  }, [lenData, stringFiltros, selectedModal, currentRegional, viewMode]);

  const filteredRows = useMemo(() => {
    if (!matrix.rows) return [];
    if (!searchTerm) return matrix.rows;
    const term = fastSanitizeString(searchTerm);
    return matrix.rows.reduce((acc, hub) => {
      if (fastSanitizeString(hub.hub).includes(term)) {
        acc.push(hub);
      } else {
        const matched = hub.clusters.filter(c => fastSanitizeString(c.cluster).includes(term));
        if (matched.length > 0) acc.push({ ...hub, clusters: matched });
      }
      return acc;
    }, []);
  }, [matrix.rows, searchTerm]);

  // 🔥 Divide as pontuações dos gráficos pela quantidade de colunas visíveis usando Math.round
  const { topClusters, bottomClusters } = useMemo(() => {
    const list = [];
    const dCount = Math.max(1, matrix.headers.length); 

    filteredRows.forEach(r => {
      r.clusters.forEach(c => {
        const totalVolume = Object.values(c.valores).reduce((acc, curr) => acc + curr, 0);
        const mediaDiaria = totalVolume / dCount; 
        if (mediaDiaria > 0) {
            list.push({ 
                id: `${r.hub.split('_').pop()} - ${c.cluster}`, 
                hub: r.hub, 
                cluster: c.cluster, 
                total: Math.round(mediaDiaria) 
            });
        }
      });
    });
    return {
      topClusters: [...list].sort((a, b) => b.total - a.total).slice(0, 5),
      bottomClusters: [...list].sort((a, b) => a.total - b.total).slice(0, 5)
    };
  }, [filteredRows, matrix.headers.length]);

  useEffect(() => { setCurrentPage(1); }, [filteredRows.length, itemsPerPage]);

  const toggleHub = (hubName) => setExpandedHubs(prev => ({ ...prev, [hubName]: !prev[hubName] }));
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / itemsPerPage));
  const paginatedRows = filteredRows.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const getHeatmapColor = (val) => {
    if (!val || val === 0) return 'bg-[#ffebee] text-[#cc0000] dark:bg-red-950/50 dark:text-red-400'; 
    if (val <= 10) return 'bg-[#ffe0b2] text-[#e65100] dark:bg-orange-950/40 dark:text-orange-400';    
    if (val <= 15) return 'bg-[#fff2cc] text-[#7f6000] dark:bg-yellow-950/30 dark:text-yellow-400';    
    if (val <= 20) return 'bg-[#e2f0d9] text-[#385723] dark:bg-green-950/30 dark:text-green-400';     
    if (val <= 50) return 'bg-[#c8e6c9] text-[#1b5e20] dark:bg-green-900/40 dark:text-green-300';     
    return 'bg-[#2e7d32] text-white dark:bg-[#1b5e20] dark:text-white';                               
  };

  const exportarClusterCSV = () => {
    if (!hubDownload) return alert("Por favor, selecione uma Station antes de baixar.");
    const hubData = matrix.rows.find(r => r.hub === hubDownload);
    if (!hubData || hubData.clusters.length === 0) return alert("Nenhum registro encontrado para esta Station.");
    const colunasHeaders = ["Station", "Cluster", ...matrix.headers];
    const linhas = hubData.clusters.map(c => {
        const valoresTime = matrix.headers.map(h => c.valores[h] !== undefined ? c.valores[h] : "0");
        return `"${hubData.hub}","${c.cluster}",${valoresTime.join(",")}`;
    });
    const csvContent = "\uFEFF" + [colunasHeaders.join(","), ...linhas].join("\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([csvContent], { type: 'text/csv;charset=utf-8;' }));
    link.setAttribute("download", `Disponibilidade_Clusters_${hubDownload.replace(/\s+/g, '_')}.csv`);
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
  };

  if (isCalculating) {
    return (
      <div className="flex flex-col items-center justify-center p-20 border border-dashed border-slate-300 dark:border-gray-700 rounded-2xl bg-white dark:bg-[#1f232d] min-h-[400px]">
         <Loader2 className="w-10 h-10 animate-spin text-[#EE4D2D] mb-4" />
         <p className="font-black text-[#113366] dark:text-white uppercase tracking-widest text-sm">Processando Clusters...</p>
      </div>
    );
  }

  const maxTopVal = topClusters.length > 0 ? topClusters[0].total : 1;
  const maxBottomVal = bottomClusters.length > 0 ? Math.max(...bottomClusters.map(b => b.total)) : 1;

  return (
    <div className="flex flex-col gap-6 relative animate-in fade-in duration-300">
      
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
                type="text" placeholder="Buscar Hub ou Cluster..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-50 dark:bg-[#15171e] dark:text-white border border-slate-200 dark:border-gray-700 rounded-lg py-2 pl-9 pr-3 text-xs font-bold outline-none"
              />
            </div>

            <select
              value={selectedModal} onChange={(e) => setSelectedModal(e.target.value)}
              className="w-full sm:w-48 bg-slate-50 dark:bg-[#15171e] dark:text-white border border-slate-200 dark:border-gray-700 rounded-lg py-2 px-3 text-xs font-bold outline-none cursor-pointer uppercase"
            >
              <option value="">🚙 Todos os Modais</option>
              {matrix.modaisUnicos.map(modal => <option key={modal} value={modal}>{modal}</option>)}
            </select>
          </div>

          <div className="flex bg-slate-100 dark:bg-[#15171e] p-1 rounded-xl border border-slate-200 dark:border-gray-700">
            {['dia', 'semana', 'mes'].map((mode) => (
              <button
                key={mode} onClick={() => setViewMode(mode)}
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
                {matrix.headers.map(h => <th key={h} className="p-4 min-w-[70px] bg-[#113366] border-l border-white/10 sticky top-0 z-[20]">{h}</th>)}
              </tr>
            </thead>
            
            <tbody className="divide-y divide-slate-100 dark:divide-gray-800 font-black text-xs">
              {paginatedRows.length === 0 ? (
                <tr><td colSpan={matrix.headers.length + 2} className="p-12 text-center text-slate-400 font-bold">Nenhum dado encontrado para os filtros ativos.</td></tr>
              ) : (
                paginatedRows.map((rowHub) => {
                  const isOpen = !!expandedHubs[rowHub.hub];
                  return (
                    <React.Fragment key={rowHub.hub}>
                      <tr onClick={() => toggleHub(rowHub.hub)} className="cursor-pointer bg-slate-100/80 dark:bg-gray-800 hover:bg-blue-50 dark:hover:bg-gray-700 transition-colors h-9">
                        <td className="p-3 text-left font-black text-[#113366] dark:text-blue-400 border-r border-slate-200 dark:border-gray-700 sticky left-0 z-[30] bg-slate-100/80 dark:bg-gray-800 flex items-center gap-2">
                          {isOpen ? <ChevronDown size={16} className="text-[#113366] dark:text-blue-400"/> : <ChevronRight size={16} className="text-slate-400"/>}
                          <MapPin size={13} className="text-[#113366] dark:text-blue-400 shrink-0" />
                          {rowHub.hub}
                        </td>
                        <td className="p-3 font-black text-[#113366] dark:text-white uppercase tracking-wider text-[10px] border-r border-slate-200 dark:border-gray-700 sticky left-[220px] z-[30] bg-slate-100/80 dark:bg-gray-800 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">TOTAL STATION</td>
                        {matrix.headers.map(h => {
                          const val = rowHub.valoresHub[h];
                          return <td key={`${rowHub.hub}-${h}`} className={`p-3 font-black border-r border-slate-200 dark:border-gray-700 ${getHeatmapColor(val)}`}>{val !== undefined ? val : '-'}</td>;
                        })}
                      </tr>
                      {isOpen && rowHub.clusters.map((c) => (
                        <tr key={`${rowHub.hub}-${c.cluster}`} className="bg-white dark:bg-[#15171e] transition-colors hover:bg-slate-50/50 h-9">
                          <td className="p-3 text-left pl-12 font-black text-slate-800 dark:text-gray-200 border-r border-slate-100 dark:border-gray-800 sticky left-0 z-[30] bg-white dark:bg-[#15171e] flex items-center gap-1.5"><Layers size={11} className="text-slate-400" /> Cluster</td>
                          <td className={`p-3 font-bold uppercase tracking-wider text-[10px] border-r border-slate-100 dark:border-gray-800 sticky left-[220px] z-[30] bg-white dark:bg-[#15171e] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] ${c.cluster === 'OUTROS / NÃO MAPEADO' ? 'text-red-500' : 'text-slate-500'}`}>{c.cluster}</td>
                          {matrix.headers.map(h => {
                            const val = c.valores[h];
                            return <td key={`${rowHub.hub}-${c.cluster}-${h}`} className={`p-3 font-black border-r border-slate-100 dark:border-gray-800 ${getHeatmapColor(val)}`}>{val !== undefined && val > 0 ? val : '-'}</td>;
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

        <div className="px-4 py-2 border-t border-[#113366] flex justify-between items-center bg-slate-50 dark:bg-[#1f232d] shrink-0">
          <div className="flex items-center gap-3">
            <div className="text-[9px] font-black text-[#113366] dark:text-slate-400 uppercase tracking-widest bg-white dark:bg-gray-800 px-2 py-1 rounded border border-slate-200 dark:border-gray-700 shadow-sm">Total: {filteredRows.length} Hubs</div>
          </div>
          <div className="flex items-center gap-2">
            <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} className="p-1 rounded bg-white dark:bg-gray-800 text-[#113366] hover:bg-slate-200 disabled:opacity-30 transition-all shadow-sm border border-slate-200"><ChevronLeft size={14}/></button>
            <span className="text-[10px] font-black text-[#113366] dark:text-white uppercase tracking-wider">Pág {currentPage}/{totalPages}</span>
            <button disabled={currentPage === totalPages || totalPages === 0} onClick={() => setCurrentPage(p => p + 1)} className="p-1 rounded bg-white dark:bg-gray-800 text-[#113366] hover:bg-slate-200 disabled:opacity-30 transition-all shadow-sm border border-slate-200"><ChevronRight size={14}/></button>
          </div>
        </div>
      </div>

      {/* GRÁFICOS DE RANKING */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-2">
        <div className="bg-white dark:bg-[#1f232d] p-5 rounded-2xl border border-slate-200 dark:border-gray-800 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="p-1.5 bg-green-50 dark:bg-green-950/40 rounded-lg"><TrendingUp size={16} className="text-[#113366] dark:text-blue-400" /></div>
              <div>
                <h4 className="text-xs font-black text-[#113366] dark:text-white uppercase tracking-wider">Top 5 Clusters + Abastecidos</h4>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Maior MÉDIA diária no período filtrado</p>
              </div>
            </div>
            <div className="space-y-3.5 my-2">
              {topClusters.length === 0 ? <p className="text-xs font-bold text-slate-400 text-center py-6">Sem dados suficientes.</p> : topClusters.map((item, index) => {
                const pct = Math.max(8, (item.total / maxTopVal) * 100);
                return (
                  <div key={`top-${item.id}`} className="flex flex-col gap-1">
                    <div className="flex justify-between items-center text-[11px] font-black tracking-wide">
                      <span className="text-slate-700 dark:text-slate-300 truncate max-w-[80%] uppercase"><span className="text-slate-400 mr-1">#{index + 1}</span> {item.id}</span>
                      <span className="text-[#113366] dark:text-blue-400 font-black bg-slate-50 dark:bg-gray-800 px-2 py-0.5 rounded border border-slate-100 dark:border-gray-700">{item.total}</span>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-gray-800 h-2.5 rounded-full overflow-hidden"><div className="bg-[#113366] h-full rounded-full transition-all duration-500" style={{ width: `${pct}%` }} /></div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-[#1f232d] p-5 rounded-2xl border border-slate-200 dark:border-gray-800 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="p-1.5 bg-red-50 dark:bg-red-950/40 rounded-lg"><TrendingDown size={16} className="text-[#D0011B]" /></div>
              <div>
                <h4 className="text-xs font-black text-[#D0011B] uppercase tracking-wider">Top 5 Clusters Críticos (Vazios)</h4>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Menor MÉDIA diária no período filtrado</p>
              </div>
            </div>
            <div className="space-y-3.5 my-2">
              {bottomClusters.length === 0 ? <p className="text-xs font-bold text-slate-400 text-center py-6">Sem dados suficientes.</p> : bottomClusters.map((item, index) => {
                const pct = Math.max(8, (item.total / maxBottomVal) * 100);
                return (
                  <div key={`bot-${item.id}`} className="flex flex-col gap-1">
                    <div className="flex justify-between items-center text-[11px] font-black tracking-wide">
                      <span className="text-slate-700 dark:text-slate-300 truncate max-w-[80%] uppercase"><span className="text-slate-400 mr-1">#{index + 1}</span> {item.id}</span>
                      <span className="text-[#D0011B] font-black bg-red-50 dark:bg-red-950/30 px-2 py-0.5 rounded border border-red-100 dark:border-red-900/30">{item.total}</span>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-gray-800 h-2.5 rounded-full overflow-hidden"><div className="bg-[#D0011B] h-full rounded-full transition-all duration-500" style={{ width: `${pct}%` }} /></div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}