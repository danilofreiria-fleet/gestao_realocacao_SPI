import React, { useState, useMemo, useEffect } from 'react';
import { Search, MapPin, Layers, TrendingUp, ChevronLeft, ChevronRight, ChevronDown, Loader2 } from 'lucide-react';
import { ResponsiveContainer, ComposedChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, LabelList } from 'recharts';
import { calcularMatrizPiso } from '../../utils/motorEstudosCluster'; 

const fastSanitizeString = (str) => {
  if (!str) return "";
  return String(str).toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Z0-9]/g, ' ').trim();
};

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
const currentRegional = localStorage.getItem("selectedRegional");

  const [viewMode, setViewMode] = useState('semana'); 
  const [searchTerm, setSearchTerm] = useState('');
  const [hubDownload, setHubDownload] = useState('');
  const [expandedHubs, setExpandedHubs] = useState({});
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);

  const [isCalculating, setIsCalculating] = useState(false);
  const [matrix, setMatrix] = useState({ headers: [], rows: [], stationsUnicas: [], ranking: [] });

  const stringFiltros = JSON.stringify(filtrosGlobais);
  const lenData = atPisoClusterData?.length || 0;

useEffect(() => {
    let isMounted = true;
    const rodarMotor = async () => {
      setIsCalculating(true);
      const resultado = await calcularMatrizPiso({ atPisoClusterData, filtrosGlobais, viewMode, currentRegional });
      if (isMounted) {
        setMatrix(resultado || { headers: [], rows: [], stationsUnicas: [], ranking: [] });
        setIsCalculating(false);
      }
    };
    rodarMotor();
    return () => { isMounted = false; };
  }, [lenData, stringFiltros, viewMode, currentRegional]);

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

  useEffect(() => { setCurrentPage(1); }, [filteredRows.length, itemsPerPage]);

  const toggleHub = (hubName) => setExpandedHubs(prev => ({ ...prev, [hubName]: !prev[hubName] }));
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / itemsPerPage));
  const paginatedRows = filteredRows.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

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
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([csvContent], { type: 'text/csv;charset=utf-8;' }));
    link.setAttribute("download", `Estudo_Cluster_AT_${hubDownload.replace(/\s+/g, '_')}.csv`);
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

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-300">
      
      {/* CARD DE SELEÇÃO DE MODOS E DOWNLOAD */}
      <div className="bg-white dark:bg-[#1f232d] p-6 rounded-2xl border border-slate-200 dark:border-gray-800 shadow-sm mt-6">
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
              value={hubDownload} onChange={(e) => setHubDownload(e.target.value)}
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
              type="text" placeholder="Buscar Hub ou Cluster..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-50 dark:bg-[#15171e] dark:text-white border border-slate-200 dark:border-gray-700 rounded-lg py-2 pl-9 pr-3 text-xs font-bold outline-none"
            />
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

      {/* GRADE DA MATRIZ */}
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
                      <tr onClick={() => toggleHub(rowHub.hub)} className="cursor-pointer bg-slate-100/80 dark:bg-gray-800 hover:bg-orange-50 dark:hover:bg-gray-700 transition-colors h-9">
                        <td className="p-3 text-left font-black text-[#113366] dark:text-blue-400 border-r border-slate-200 dark:border-gray-700 sticky left-0 z-[30] bg-slate-100/80 dark:bg-gray-800 flex items-center gap-2">
                          {isOpen ? <ChevronDown size={16} className="text-[#EE4D2D]"/> : <ChevronRight size={16} className="text-slate-400"/>}
                          <MapPin size={13} className="text-[#EE4D2D] shrink-0" />
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
                          <td className="p-3 font-bold text-slate-500 uppercase tracking-wider text-[10px] border-r border-slate-100 dark:border-gray-800 sticky left-[220px] z-[30] bg-white dark:bg-[#15171e] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">{c.cluster}</td>
                          {matrix.headers.map(h => {
                            const val = c.valores[h];
                            return <td key={`${rowHub.hub}-${c.cluster}-${h}`} className={`p-3 font-black border-r border-slate-100 dark:border-gray-800 ${getHeatmapColor(val)}`}>{val !== undefined ? val : '-'}</td>;
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
            <div className="text-[9px] font-black text-[#113366] dark:text-slate-400 uppercase tracking-widest bg-white dark:bg-gray-800 px-2 py-1 rounded border border-slate-200 dark:border-gray-700 shadow-sm">Total: {filteredRows.length} Hubs</div>
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] font-bold text-slate-400 uppercase">Exibir:</span>
              <select className="bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 text-[10px] font-bold text-[#113366] dark:text-white rounded px-1.5 py-0.5 outline-none cursor-pointer" value={itemsPerPage} onChange={(e) => setItemsPerPage(Number(e.target.value))}>
                <option value={20}>20 Hubs</option>
                <option value={50}>50 Hubs</option>
                <option value={100}>100 Hubs</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} className="p-1 rounded bg-white dark:bg-gray-800 text-[#113366] dark:text-white hover:bg-slate-200 disabled:opacity-30 shadow-sm border border-slate-200 dark:border-gray-700"><ChevronLeft size={14}/></button>
            <span className="text-[10px] font-black text-[#113366] dark:text-white uppercase tracking-wider">Pág {currentPage}/{totalPages}</span>
            <button disabled={currentPage === totalPages || totalPages === 0} onClick={() => setCurrentPage(p => p + 1)} className="p-1 rounded bg-white dark:bg-gray-800 text-[#113366] dark:text-white hover:bg-slate-200 disabled:opacity-30 shadow-sm border border-slate-200 dark:border-gray-700"><ChevronRight size={14}/></button>
          </div>
        </div>
      </div>

      {/* RANKING TOP 12 CLUSTERS */}
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
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 'bold', fill: '#113366' }} angle={-45} textAnchor="end" interval={0} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#113366' }} />
                <Tooltip content={<CustomTooltipRank />} cursor={{ fill: 'rgba(0,0,0,0.05)' }} />
                <Bar dataKey="total" name="Total ATs" fill="#EE4D2D" radius={[4, 4, 0, 0]} maxBarSize={50}>
                  <LabelList dataKey="total" position="top" style={{ fill: '#EE4D2D', fontSize: 11, fontWeight: '900' }} />
                </Bar>
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

    </div>
  );
}