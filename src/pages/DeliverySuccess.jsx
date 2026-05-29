import React, { useState, useEffect, useMemo, useRef, useDeferredValue } from 'react';
import { getDeliverySuccessData } from '../api/googleSheets';
import { getHubsPermitidos, MAPA_REGIONAL_COMPLETO } from '../constants/regionais'; // 🔥 IMPORTAMOS O MAPA AQUI
import { Award, ChevronDown, ChevronRight, Download, Search, MapPin, Truck, User, AlertCircle, Check, Filter } from 'lucide-react';

export default function DeliverySuccess() {
  const [loading, setLoading] = useState(true);
  const [rawData, setRawData] = useState([]);
  const [expandedHubs, setExpandedHubs] = useState({});
  const [searchTerm, setSearchTerm] = useState('');
  const [hubDownload, setHubDownload] = useState('');

  // Estados dos Filtros (Subregional e Hub)
  const [selectedRegs, setSelectedRegs] = useState([]);
  const [dropdownRegOpen, setDropdownRegOpen] = useState(false);
  const [regSearchTerm, setRegSearchTerm] = useState('');

  const [selectedHubs, setSelectedHubs] = useState([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [hubSearchTerm, setHubSearchTerm] = useState('');
  
  const dropdownRegRef = useRef(null);
  const dropdownRef = useRef(null);
  
  const currentRegional = localStorage.getItem("selectedRegional");
  const deferredSearchTerm = useDeferredValue(searchTerm);

  // Fecha os dropdowns ao clicar fora
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
        setHubSearchTerm(''); 
      }
      if (dropdownRegRef.current && !dropdownRegRef.current.contains(event.target)) {
        setDropdownRegOpen(false);
        setRegSearchTerm(''); 
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const data = await getDeliverySuccessData();
        if (data && data.length > 1) {
          setRawData(data); 
        }
      } catch (e) {
        console.error("Erro ao carregar notas de DS:", e);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const formatarSemana = (str) => {
    const s = String(str || "").trim().toUpperCase();
    if (s.startsWith('W') && !s.includes('-')) return `W-${s.substring(1)}`;
    return s;
  };

  const renderSemaforo = (val) => {
    if (val === null || val === undefined) return '-';
    let icon = '🟢';
    if (val < 95) icon = '🔴';
    else if (val < 98) icon = '🟡';
    return (
      <span className="flex items-center justify-center gap-1.5 font-black">
        <span className="text-[10px]">{icon}</span> {val}%
      </span>
    );
  };

  const toggleRegSelection = (reg) => {
    setSelectedRegs(prev => prev.includes(reg) ? prev.filter(r => r !== reg) : [...prev, reg]);
    setSelectedHubs([]); 
  };

  const toggleHubSelection = (hub) => {
    setSelectedHubs(prev => prev.includes(hub) ? prev.filter(h => h !== hub) : [...prev, hub]);
  };

  // =========================================================
  // 1. EXTRAIR HUBS E SUBREGIONAIS (USANDO O SEU MAPA OFICIAL)
  // =========================================================
  const { listRegs, listHubs } = useMemo(() => {
    if (rawData.length < 2) return { listRegs: [], listHubs: [] };
    const hubsPermitidos = new Set(getHubsPermitidos(currentRegional));
    const setR = new Set();
    const setH = new Set();
    const len = rawData.length;
    
    for (let i = 1; i < len; i++) {
      const hub = String(rawData[i][3] || "").trim();
      
      if (hub && hubsPermitidos.has(hub)) {
        // 🔥 MAGIA AQUI: Pega a subregional direto do seu arquivo hubsSPI/hubsSPM
        const subRegional = MAPA_REGIONAL_COMPLETO[hub]; 
        
        if (subRegional) setR.add(subRegional);
        
        if (selectedRegs.length === 0 || selectedRegs.includes(subRegional)) {
          setH.add(hub);
        }
      }
    }
    return { 
      listRegs: Array.from(setR).sort(), 
      listHubs: Array.from(setH).sort() 
    };
  }, [rawData, currentRegional, selectedRegs]);

  // =========================================================
  // 2. MOTOR DE PROCESSAMENTO (SÓ RODA SE TIVER FILTRO)
  // =========================================================
  const processed = useMemo(() => {
    if (rawData.length < 2 || (selectedRegs.length === 0 && selectedHubs.length === 0 && !deferredSearchTerm)) {
        return { colSemanas: [], hubsData: [], listaHubsUnicos: [] };
    }

    const headers = rawData[0];
    const colSemanas = headers.slice(4).map(h => ({ original: h, formatado: formatarSemana(h) }));
    const weeksCount = colSemanas.length;
    const aggs = {};
    
    const selectedRegsSet = new Set(selectedRegs);
    const selectedHubsSet = new Set(selectedHubs);
    const hubsPermitidos = new Set(getHubsPermitidos(currentRegional));
    const termLower = deferredSearchTerm.toLowerCase().trim();

    const parseNumFast = (val) => {
      if (!val) return null;
      let s = String(val);
      if (s.charCodeAt(s.length - 1) === 37) s = s.slice(0, -1);
      if (s.indexOf(',') !== -1) s = s.replace(/\./g, '').replace(',', '.');
      const n = Number(s);
      return isNaN(n) ? 0 : n;
    };

    const rowsLen = rawData.length;
    for (let i = 1; i < rowsLen; i++) {
      const row = rawData[i];
      const hub = String(row[3] || "").trim();
      
      if (!hub || !hubsPermitidos.has(hub)) continue;

      // 🔥 Valida a Subregional cruzando com o MAPA
      const subRegional = MAPA_REGIONAL_COMPLETO[hub];
      if (selectedRegsSet.size > 0 && !selectedRegsSet.has(subRegional)) continue;
      
      if (selectedHubsSet.size > 0 && !selectedHubsSet.has(hub)) continue;

      const driverId = String(row[0] || "").trim();
      if (!driverId) continue;
      if (termLower && !driverId.toLowerCase().includes(termLower)) continue;

      const veiculo = String(row[1] || "").trim() || "NÃO INFORMADO";

      let hubAgg = aggs[hub];
      if (!hubAgg) {
        hubAgg = { name: hub, semanasSoma: {}, semanasContador: {}, driversMap: {} };
        for (let w = 0; w < weeksCount; w++) {
          const orig = colSemanas[w].original;
          hubAgg.semanasSoma[orig] = 0;
          hubAgg.semanasContador[orig] = 0;
        }
        aggs[hub] = hubAgg;
      }

      let driverAgg = hubAgg.driversMap[driverId];
      if (!driverAgg) {
        // Agora armazenamos a Subregional no nível do motorista, fica mais bonito na exportação!
        driverAgg = { id: driverId, veiculo, regional: subRegional || "S/ MAPA", notasPorSemana: {} };
        for (let w = 0; w < weeksCount; w++) {
          driverAgg.notasPorSemana[colSemanas[w].original] = { soma: 0, qtd: 0 };
        }
        hubAgg.driversMap[driverId] = driverAgg;
      }

      for (let j = 0; j < weeksCount; j++) {
        const nota = parseNumFast(row[4 + j]);
        if (nota !== null) {
          const orig = colSemanas[j].original;
          hubAgg.semanasSoma[orig] += nota;
          hubAgg.semanasContador[orig] += 1;
          driverAgg.notasPorSemana[orig].soma += nota;
          driverAgg.notasPorSemana[orig].qtd += 1;
        }
      }
    }

    const hubsData = Object.values(aggs).map(h => {
      const mediasHub = {};
      for (let w = 0; w < weeksCount; w++) {
        const orig = colSemanas[w].original;
        const soma = h.semanasSoma[orig];
        const qtd = h.semanasContador[orig];
        mediasHub[orig] = qtd > 0 ? Number((soma / qtd).toFixed(2)) : null;
      }

      const driversFinal = Object.values(h.driversMap).map(d => {
        const scores = {};
        for (let w = 0; w < weeksCount; w++) {
          const orig = colSemanas[w].original;
          const stats = d.notasPorSemana[orig];
          scores[orig] = stats.qtd > 0 ? Number((stats.soma / stats.qtd).toFixed(2)) : null;
        }
        return { id: d.id, veiculo: d.veiculo, regional: d.regional, scores };
      }).sort((a, b) => a.id.localeCompare(b.id));

      return { name: h.name, mediasHub, drivers: driversFinal };
    }).sort((a, b) => a.name.localeCompare(b.name));

    return { colSemanas, hubsData, listaHubsUnicos: hubsData.map(h => h.name) };
  }, [rawData, currentRegional, selectedRegs, selectedHubs, deferredSearchTerm]);

  const metrics = useMemo(() => {
    if (!processed.hubsData || processed.hubsData.length === 0) {
      return { mediaGeral: 0, totalDrivers: 0, totalHubs: 0, criticos: 0 };
    }
    
    let somaNotas = 0, qtdNotas = 0, totalCondutores = 0, condutoresCriticos = 0;

    processed.hubsData.forEach(hub => {
      totalCondutores += hub.drivers.length;
      Object.values(hub.mediasHub).forEach(val => {
        if (val !== null) { somaNotas += val; qtdNotas++; }
      });
      hub.drivers.forEach(d => {
        let isCritico = false;
        Object.values(d.scores).forEach(score => { if (score !== null && score < 95) isCritico = true; });
        if (isCritico) condutoresCriticos++;
      });
    });

    return {
      mediaGeral: qtdNotas > 0 ? (somaNotas / qtdNotas).toFixed(2) : "0.00",
      totalDrivers: totalCondutores,
      totalHubs: processed.hubsData.length,
      criticos: condutoresCriticos
    };
  }, [processed]);

  const allPermittedHubs = useMemo(() => {
    if (rawData.length < 2) return [];
    const hPermitidos = new Set(getHubsPermitidos(currentRegional));
    const sH = new Set();
    for (let i = 1; i < rawData.length; i++) {
        const h = String(rawData[i][3] || "").trim();
        if (h && hPermitidos.has(h)) sH.add(h);
    }
    return Array.from(sH).sort();
  }, [rawData, currentRegional]);

  const handleSelectAllRegs = () => { setSelectedRegs([...listRegs]); setSelectedHubs([]); };
  const handleClearRegs = () => { setSelectedRegs([]); setSelectedHubs([]); };
  const handleSelectAllHubs = () => setSelectedHubs([...listHubs]);
  const handleClearHubs = () => setSelectedHubs([]);

  const toggleHub = (hubName) => setExpandedHubs(prev => ({ ...prev, [hubName]: !prev[hubName] }));

  const exportarHubCSV = () => {
    if (!hubDownload) return alert("Por favor, selecione uma Station antes de baixar.");
    
    const headers = rawData[0];
    const colSemanas = headers.slice(4).map(h => formatarSemana(h));
    const driversToExport = {};
    
    const parseNumFast = (val) => {
        if (!val) return null;
        let s = String(val);
        if (s.charCodeAt(s.length - 1) === 37) s = s.slice(0, -1);
        if (s.indexOf(',') !== -1) s = s.replace(/\./g, '').replace(',', '.');
        const n = Number(s);
        return isNaN(n) ? 0 : n;
    };

    rawData.slice(1).forEach(row => {
        if (String(row[3] || "").trim() === hubDownload) {
            const driverId = String(row[0] || "").trim();
            if (!driverId) return;
            if (!driversToExport[driverId]) {
                const subRegBase = MAPA_REGIONAL_COMPLETO[hubDownload] || String(row[2]||"").trim();
                driversToExport[driverId] = { id: driverId, veiculo: String(row[1]||"").trim(), regional: subRegBase, notasSoma: {}, notasQtd: {} };
                headers.slice(4).forEach(h => { driversToExport[driverId].notasSoma[h] = 0; driversToExport[driverId].notasQtd[h] = 0; });
            }
            headers.slice(4).forEach((h, idx) => {
                const nota = parseNumFast(row[4 + idx]);
                if (nota !== null) {
                    driversToExport[driverId].notasSoma[h] += nota;
                    driversToExport[driverId].notasQtd[h] += 1;
                }
            });
        }
    });

    if (Object.keys(driversToExport).length === 0) return alert("Nenhum dado encontrado para este Hub.");

    const headersCSV = ["Driver ID", "Veículo", "Subregional", "HUB", ...colSemanas];
    const linhasCSV = Object.values(driversToExport).map(d => {
      const notas = headers.slice(4).map(h => d.notasQtd[h] > 0 ? `${Number((d.notasSoma[h] / d.notasQtd[h]).toFixed(2))}%` : "-");
      return [d.id, d.veiculo, d.regional, hubDownload, ...notas].join(",");
    });

    const csvContent = "\uFEFF" + [headersCSV.join(","), ...linhasCSV].join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `DS_${hubDownload.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) return <div className="p-10 text-center animate-pulse font-black text-[#113366] text-xl tracking-widest mt-20">CONSOLIDANDO DADOS DE DS...</div>;

  const filteredRegsOptions = listRegs.filter(reg => reg.toLowerCase().includes(regSearchTerm.toLowerCase()));
  const filteredHubsOptions = listHubs.filter(hub => hub.toLowerCase().includes(hubSearchTerm.toLowerCase()));
  
  const showsEmptyState = selectedRegs.length === 0 && selectedHubs.length === 0 && !searchTerm;

  return (
    <div className="flex flex-col h-full gap-6">
      
      {/* 1. PAINEL DE CONTROLE / FILTROS E DOWNLOADS */}
      <div className="bg-white dark:bg-[#1f232d] p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-gray-800 shrink-0 flex flex-col gap-6">
        
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 border-b border-slate-100 dark:border-gray-800 pb-4">
          <div>
            <h2 className="text-2xl font-black text-[#113366] dark:text-white uppercase tracking-tight flex items-center gap-2">
              <Award className="text-[#EE4D2D]" size={26} /> Delivery Success (DS)
            </h2>
            <p className="text-xs font-bold text-slate-400 uppercase mt-1">Acompanhamento de performance de entrega por condutor</p>
          </div>

          <div className="flex items-center gap-2 bg-slate-50 dark:bg-[#15171e] p-2 rounded-xl border border-slate-200 dark:border-gray-700 w-full lg:w-auto">
            <select 
              value={hubDownload} 
              onChange={(e) => setHubDownload(e.target.value)}
              className="bg-white dark:bg-[#1f232d] dark:text-white text-xs font-bold p-2.5 rounded-lg border border-slate-200 dark:border-gray-700 outline-none cursor-pointer flex-1 max-w-[200px]"
            >
              <option value="">Baixar Base Station...</option>
              {allPermittedHubs.map(h => <option key={`dl-${h}`} value={h}>{h}</option>)}
            </select>
            <button 
              onClick={exportarHubCSV}
              className="flex items-center gap-1.5 bg-[#EE4D2D] hover:bg-[#D0011B] text-white px-4 py-2.5 rounded-lg text-xs font-black uppercase transition-all shadow-sm shrink-0"
            >
              <Download size={16}/> Baixar CSV
            </button>
          </div>
        </div>

        {/* FILTROS AVANÇADOS */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            
            {/* DROPDOWN SUBREGIONAL */}
            <div className="md:col-span-4 flex flex-col gap-2 relative" ref={dropdownRegRef}>
                <label className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-1">
                    <Filter size={12}/> 1. Subregional
                </label>
                
                <div 
                  onClick={() => setDropdownRegOpen(!dropdownRegOpen)}
                  className="w-full bg-slate-50 dark:bg-[#15171e] dark:text-white border border-slate-200 dark:border-gray-700 rounded-xl py-3 px-3 text-sm font-bold flex justify-between items-center cursor-pointer hover:border-slate-300 dark:hover:border-gray-600 transition-all select-none"
                >
                  <span className="truncate pr-4 text-slate-700 dark:text-gray-200">
                    {selectedRegs.length === 0 
                      ? "Todas as Subregionais" 
                      : `${selectedRegs.length} reg(s): ${selectedRegs.join(', ')}`}
                  </span>
                  <ChevronDown size={16} className={`text-slate-400 transition-transform ${dropdownRegOpen ? 'rotate-180' : ''}`} />
                </div>

                {dropdownRegOpen && (
                  <div className="absolute top-[100%] left-0 w-full bg-white dark:bg-[#1f232d] border border-slate-200 dark:border-gray-700 rounded-xl mt-1 shadow-xl z-50 max-h-64 overflow-y-auto custom-scrollbar p-1 flex flex-col gap-0.5">
                    <div className="p-1 sticky top-0 bg-white dark:bg-[#1f232d] z-10 flex flex-col gap-1 border-b border-slate-100 dark:border-gray-800">
                      <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                        <input
                          type="text"
                          placeholder="Buscar subregional..."
                          value={regSearchTerm}
                          onChange={(e) => setRegSearchTerm(e.target.value)}
                          className="w-full bg-slate-50 dark:bg-[#15171e] dark:text-white text-xs font-bold pl-8 pr-2.5 py-2 rounded-lg border border-slate-200 dark:border-gray-700 outline-none focus:border-[#EE4D2D] transition-all"
                        />
                      </div>
                      <div className="flex justify-between items-center px-1 py-1">
                        <button 
                          type="button" 
                          onClick={handleSelectAllRegs} 
                          className="text-[10px] font-black uppercase text-[#113366] dark:text-blue-400 hover:opacity-70 transition-colors"
                        >
                          Selecionar Todas
                        </button>
                        <button 
                          type="button" 
                          onClick={handleClearRegs} 
                          className="text-[10px] font-black uppercase text-slate-400 hover:text-slate-600 dark:hover:text-gray-200 transition-colors"
                        >
                          Limpar Filtro
                        </button>
                      </div>
                    </div>
                    
                    {filteredRegsOptions.length === 0 ? (
                      <div className="text-center p-4 text-xs font-bold text-slate-400">Nenhuma subregional.</div>
                    ) : (
                      filteredRegsOptions.map(reg => {
                        const isChecked = selectedRegs.includes(reg);
                        return (
                          <div
                            key={`filter-reg-${reg}`}
                            onClick={() => toggleRegSelection(reg)}
                            className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                              isChecked 
                                ? 'bg-blue-50 dark:bg-blue-900/20 text-[#113366] dark:text-blue-400' 
                                : 'text-slate-700 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-gray-800'
                            }`}
                          >
                            <span className="truncate">{reg}</span>
                            {isChecked && <Check size={14} className="text-[#113366] dark:text-blue-400 shrink-0" />}
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
            </div>

            {/* DROPDOWN HUB */}
            <div className="md:col-span-4 flex flex-col gap-2 relative" ref={dropdownRef}>
                <label className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-1">
                    <MapPin size={12}/> 2. Station (HUB)
                </label>
                
                <div 
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className="w-full bg-slate-50 dark:bg-[#15171e] dark:text-white border border-slate-200 dark:border-gray-700 rounded-xl py-3 px-3 text-sm font-bold flex justify-between items-center cursor-pointer hover:border-slate-300 dark:hover:border-gray-600 transition-all select-none"
                >
                  <span className="truncate pr-4 text-slate-700 dark:text-gray-200">
                    {selectedHubs.length === 0 
                      ? "Todos os HUBs" 
                      : `${selectedHubs.length} HUB(s): ${selectedHubs.join(', ')}`}
                  </span>
                  <ChevronDown size={16} className={`text-slate-400 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
                </div>

                {dropdownOpen && (
                  <div className="absolute top-[100%] left-0 w-full bg-white dark:bg-[#1f232d] border border-slate-200 dark:border-gray-700 rounded-xl mt-1 shadow-xl z-50 max-h-64 overflow-y-auto custom-scrollbar p-1 flex flex-col gap-0.5">
                    <div className="p-1 sticky top-0 bg-white dark:bg-[#1f232d] z-10 flex flex-col gap-1 border-b border-slate-100 dark:border-gray-800">
                      <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                        <input
                          type="text"
                          placeholder="Buscar hub..."
                          value={hubSearchTerm}
                          onChange={(e) => setHubSearchTerm(e.target.value)}
                          className="w-full bg-slate-50 dark:bg-[#15171e] dark:text-white text-xs font-bold pl-8 pr-2.5 py-2 rounded-lg border border-slate-200 dark:border-gray-700 outline-none focus:border-[#EE4D2D] transition-all"
                        />
                      </div>
                      <div className="flex justify-between items-center px-1 py-1">
                        <button 
                          type="button" 
                          onClick={handleSelectAllHubs} 
                          className="text-[10px] font-black uppercase text-[#EE4D2D] hover:text-[#D0011B] transition-colors"
                        >
                          Selecionar Todos
                        </button>
                        <button 
                          type="button" 
                          onClick={handleClearHubs} 
                          className="text-[10px] font-black uppercase text-slate-400 hover:text-slate-600 dark:hover:text-gray-200 transition-colors"
                        >
                          Limpar Filtro
                        </button>
                      </div>
                    </div>
                    
                    {filteredHubsOptions.length === 0 ? (
                      <div className="text-center p-4 text-xs font-bold text-slate-400">Nenhum HUB correspondente.</div>
                    ) : (
                      filteredHubsOptions.map(hub => {
                        const isChecked = selectedHubs.includes(hub);
                        return (
                          <div
                            key={`filter-${hub}`}
                            onClick={() => toggleHubSelection(hub)}
                            className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                              isChecked 
                                ? 'bg-orange-50 dark:bg-orange-950/20 text-[#EE4D2D]' 
                                : 'text-slate-700 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-gray-800'
                            }`}
                          >
                            <span className="truncate">{hub}</span>
                            {isChecked && <Check size={14} className="text-[#EE4D2D] shrink-0" />}
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
            </div>

            {/* BUSCA DRIVER ID */}
            <div className="md:col-span-4 flex flex-col gap-2">
                <label className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-1">
                    <Search size={12}/> Ou busque direto
                </label>
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input 
                        type="text"
                        placeholder="ID do Motorista..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-[#15171e] dark:text-white border border-slate-200 dark:border-gray-700 rounded-xl py-3 pl-10 pr-3 text-sm font-bold outline-none focus:ring-2 focus:ring-[#113366] transition-all"
                    />
                </div>
            </div>
        </div>
      </div>

      {/* 2. SÉRIE DE CARDS EXECUTIVOS (KPIs) */}
      <div className={`grid grid-cols-2 lg:grid-cols-4 gap-4 shrink-0 transition-opacity duration-300 ${showsEmptyState ? 'opacity-30 pointer-events-none' : 'opacity-100'}`}>
        <div className="bg-white dark:bg-[#1f232d] p-4 rounded-2xl shadow-sm border border-slate-200 dark:border-gray-800 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Média Geral DS</span>
            <span className="text-xl font-black text-[#113366] dark:text-white tracking-tight">{metrics.mediaGeral}%</span>
          </div>
          <Award className="text-[#EE4D2D]" size={24} />
        </div>

        <div className="bg-white dark:bg-[#1f232d] p-4 rounded-2xl shadow-sm border border-slate-200 dark:border-gray-800 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Condutores Ativos</span>
            <span className="text-xl font-black text-[#113366] dark:text-white tracking-tight">{metrics.totalDrivers}</span>
          </div>
          <User className="text-blue-500" size={24} />
        </div>

        <div className="bg-white dark:bg-[#1f232d] p-4 rounded-2xl shadow-sm border border-slate-200 dark:border-gray-800 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">HUBs Consolidados</span>
            <span className="text-xl font-black text-[#113366] dark:text-white tracking-tight">{metrics.totalHubs}</span>
          </div>
          <MapPin className="text-emerald-500" size={24} />
        </div>

        <div className="bg-white dark:bg-[#1f232d] p-4 rounded-2xl shadow-sm border border-slate-200 dark:border-gray-800 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Abaixo da Meta (&lt;95%)</span>
            <span className="text-xl font-black text-[#D0011B] tracking-tight">{metrics.criticos} Drivers</span>
          </div>
          <AlertCircle className="text-[#D0011B]" size={24} />
        </div>
      </div>

      {/* 3. ÁREA DE DADOS / MATRIZ */}
      <div className="bg-white dark:bg-[#1f232d] rounded-2xl shadow-sm border border-[#113366] overflow-hidden flex flex-col flex-1 relative min-h-[400px]">
        {showsEmptyState ? (
             <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-50/80 dark:bg-gray-900/80 backdrop-blur-sm z-10 p-6">
                <div className="bg-white dark:bg-[#1f232d] p-8 rounded-2xl shadow-xl flex flex-col items-center text-center max-w-md border border-slate-200 dark:border-gray-700">
                    <AlertCircle size={48} className="text-[#EE4D2D] mb-4" />
                    <h3 className="text-xl font-black text-[#113366] dark:text-white uppercase mb-2">Aguardando Filtro</h3>
                    <p className="text-sm font-bold text-slate-500 dark:text-gray-400 leading-relaxed">
                        A matriz completa de DS possui milhares de dados. Selecione uma Subregional, Station ou digite o ID do condutor para visualizar as métricas.
                    </p>
                </div>
            </div>
        ) : (
            <div className="overflow-x-auto w-full h-full custom-scrollbar">
            <table className="w-full border-collapse text-center">
                <thead className="bg-[#113366] text-white tracking-widest text-[10px] uppercase font-black sticky top-0 z-20">
                <tr>
                    <th className="p-4 text-left min-w-[250px] shadow-sm">SUBREGIONAL / STATION / DRIVER</th>
                    <th className="p-4 shadow-sm">VEÍCULO</th>
                    {processed.colSemanas.map(sem => (
                    <th key={sem.original} className="p-4 min-w-[85px] bg-white/5 border-l border-[#1f4a94] shadow-sm">{sem.formatado}</th>
                    ))}
                </tr>
                </thead>

                <tbody className="divide-y divide-slate-100 dark:divide-gray-800 font-black text-sm relative z-0">
                {processed.hubsData.length === 0 ? (
                    <tr><td colSpan={processed.colSemanas.length + 2} className="p-10 text-center font-bold text-slate-400">Nenhum dado encontrado para os filtros selecionados.</td></tr>
                ) : (
                    processed.hubsData.map(hub => {
                    const isOpen = !!expandedHubs[hub.name];
                    return (
                        <React.Fragment key={hub.name}>
                        
                        <tr onClick={() => toggleHub(hub.name)} className="cursor-pointer bg-slate-100/80 dark:bg-gray-800 hover:bg-orange-50 dark:hover:bg-gray-700 transition-colors">
                            <td className="p-4 text-left flex items-center gap-2 text-[#113366] dark:text-blue-400 font-black text-base border-r border-slate-200 dark:border-gray-700">
                            {isOpen ? <ChevronDown size={18} className="text-[#EE4D2D]"/> : <ChevronRight size={18} className="text-slate-400"/>}
                            <MapPin size={16} className="text-[#EE4D2D] shrink-0" />
                            {hub.name}
                            </td>
                            <td className="p-4 text-xs font-black text-[#113366] dark:text-white uppercase border-r border-slate-200 dark:border-gray-700">
                                STATION
                            </td>
                            {processed.colSemanas.map(sem => {
                            const val = hub.mediasHub[sem.original];
                            return (
                                <td key={sem.original} className={`p-4 border-r border-slate-200 dark:border-gray-700 ${val !== null && val < 95 ? 'bg-red-50/50 dark:bg-red-900/10 text-[#D0011B]' : 'bg-slate-50/30 dark:bg-gray-800/10 text-slate-800 dark:text-gray-200'}`}>
                                {renderSemaforo(val)}
                                </td>
                            );
                            })}
                        </tr>

                        {isOpen && hub.drivers.map(driver => (
                            <tr key={`${hub.name}-${driver.id}`} className="bg-white dark:bg-[#15171e] text-xs text-slate-600 dark:text-gray-400 transition-colors hover:bg-slate-50">
                            <td className="p-3 text-left pl-12 font-black flex items-center gap-2 text-slate-800 dark:text-gray-200 border-r border-slate-100 dark:border-gray-800">
                                <User size={13} className="text-slate-400 shrink-0" />
                                {driver.id}
                            </td>
                            <td className="p-3 font-bold uppercase text-[10px] text-slate-400 tracking-wider border-r border-slate-100 dark:border-gray-800">
                                <span className="flex items-center justify-center gap-1"><Truck size={12}/> {driver.veiculo}</span>
                            </td>
                            {processed.colSemanas.map(sem => {
                                const val = driver.scores[sem.original];
                                return (
                                <td key={sem.original} className={`p-3 font-bold border-r border-slate-100 dark:border-gray-800 ${val !== null && val < 95 ? 'text-[#D0011B] font-black bg-red-50/20 dark:bg-red-900/5' : ''}`}>
                                    {renderSemaforo(val)}
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
        )}
      </div>

    </div>
  );
}