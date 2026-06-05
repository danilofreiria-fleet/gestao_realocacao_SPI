import React, { useState, useEffect, useMemo, useRef, useDeferredValue } from 'react';
import { getDeliverySuccessData } from '../api/googleSheets';
import { getHubsPermitidos, MAPA_REGIONAL_COMPLETO } from '../constants/regionais';
import { Award, ChevronDown, ChevronRight, Download, Search, MapPin, Truck, User, AlertCircle, Check, Filter, Zap, CalendarDays, CalendarCheck } from 'lucide-react';

export default function DeliverySuccess() {
  const [loading, setLoading] = useState(true);
  const [rawData, setRawData] = useState([]);
  const [expandedHubs, setExpandedHubs] = useState({});
  const [searchTerm, setSearchTerm] = useState('');
  const [hubDownload, setHubDownload] = useState('');
  
  // Controle com 4 visões
  const [viewMode, setViewMode] = useState('TOTAL'); 

  // Estados dos Filtros
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
        if (data && data.length > 1) setRawData(data); 
      } catch (e) {
        console.error("Erro ao carregar notas de DS:", e);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  // Função auxiliar para descobrir qual é o mês de uma semana W-XX
  const obterMesDaSemana = (weekStr) => {
    const w = parseInt(String(weekStr).replace(/\D/g, ''), 10);
    if (!w) return "Outros";
    const ano = new Date().getFullYear();
    // Pega o dia 1 de jan, soma as semanas, +3 dias para cair bem no meio da semana (evita pular o mês)
    const dataBase = new Date(ano, 0, 1 + (w - 1) * 7 + 3);
    const mes = dataBase.toLocaleString('pt-BR', { month: 'long' });
    return mes.charAt(0).toUpperCase() + mes.slice(1);
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
  // 1. EXTRAIR HUBS E SUBREGIONAIS
  // =========================================================
  const { listRegs, listHubs } = useMemo(() => {
    if (rawData.length < 2) return { listRegs: [], listHubs: [] };
    const hubsPermitidos = new Set(getHubsPermitidos(currentRegional));
    const setR = new Set();
    const setH = new Set();
    const len = rawData.length;
    
    for (let i = 1; i < len; i++) {
      const hub = String(rawData[i][4] || "").trim(); // Coluna E
      if (hub && hubsPermitidos.has(hub)) {
        const subRegional = MAPA_REGIONAL_COMPLETO[hub] || String(rawData[i][2] || "").trim(); 
        if (subRegional) setR.add(subRegional);
        if (selectedRegs.length === 0 || selectedRegs.includes(subRegional)) {
          setH.add(hub);
        }
      }
    }
    return { listRegs: Array.from(setR).sort(), listHubs: Array.from(setH).sort() };
  }, [rawData, currentRegional, selectedRegs]);

  // =========================================================
  // 2. MOTOR DE PROCESSAMENTO (FILTRA VAZIOS E GERA MESES)
  // =========================================================
  const processed = useMemo(() => {
    if (rawData.length < 2 || (selectedRegs.length === 0 && selectedHubs.length === 0 && !deferredSearchTerm)) {
        return { colSemanasFiltradas: [], colMeses: [], hubsData: [], listaHubsUnicos: [] };
    }

    const headers = rawData[0];
    const weekMap = {};

    headers.forEach((h, idx) => {
      if (idx < 5 || !h) return; 
      const headerStr = String(h).trim().toUpperCase();
      if (!headerStr.startsWith('W')) return; 

      const match = headerStr.match(/W\d+/);
      if (!match) return;
      const weekStr = match[0];

      if (!weekMap[weekStr]) {
        weekMap[weekStr] = { week: weekStr, formatado: `W-${weekStr.replace('W', '')}`, idxTotal: null, idxD0: null };
      }

      if (headerStr.includes('TOTAL')) weekMap[weekStr].idxTotal = idx;
      else if (headerStr.includes('D-0') || headerStr.includes('D0')) weekMap[weekStr].idxD0 = idx;
    });

    const colSemanasOriginais = Object.values(weekMap)
      .filter(w => w.idxTotal !== null || w.idxD0 !== null)
      .sort((a, b) => a.week.localeCompare(b.week));

    const weeksCount = colSemanasOriginais.length;
    const aggs = {};
    const globalWeekDataTracker = {}; // 🔥 Rastreador de colunas vazias
    
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
      const driverId = String(row[0] || "").trim();
      const veiculo = String(row[1] || "").trim() || "NÃO INFORMADO"; 
      const regionalPlanilha = String(row[2] || "").trim(); 
      const hub = String(row[4] || "").trim(); 
      
      if (!hub || !hubsPermitidos.has(hub)) continue;

      const subRegional = MAPA_REGIONAL_COMPLETO[hub] || regionalPlanilha;
      if (selectedRegsSet.size > 0 && !selectedRegsSet.has(subRegional)) continue;
      if (selectedHubsSet.size > 0 && !selectedHubsSet.has(hub)) continue;
      if (!driverId) continue;
      if (termLower && !driverId.toLowerCase().includes(termLower)) continue;

      let hubAgg = aggs[hub];
      if (!hubAgg) {
        hubAgg = { name: hub, subRegional, somaTotal: {}, countTotal: {}, somaD0: {}, countD0: {}, driversMap: {} };
        for (let w = 0; w < weeksCount; w++) {
          const wk = colSemanasOriginais[w].week;
          hubAgg.somaTotal[wk] = 0; hubAgg.countTotal[wk] = 0;
          hubAgg.somaD0[wk] = 0; hubAgg.countD0[wk] = 0;
        }
        aggs[hub] = hubAgg;
      }

      let driverAgg = hubAgg.driversMap[driverId];
      if (!driverAgg) {
        driverAgg = { id: driverId, veiculo, regional: subRegional, notasTotal: {}, notasD0: {} };
        for (let w = 0; w < weeksCount; w++) {
          const wk = colSemanasOriginais[w].week;
          driverAgg.notasTotal[wk] = { soma: 0, qtd: 0 };
          driverAgg.notasD0[wk] = { soma: 0, qtd: 0 };
        }
        hubAgg.driversMap[driverId] = driverAgg;
      }

      for (let j = 0; j < weeksCount; j++) {
        const wkInfo = colSemanasOriginais[j];
        const wk = wkInfo.week;
        
        const notaTotal = wkInfo.idxTotal !== null ? parseNumFast(row[wkInfo.idxTotal]) : null;
        const notaD0 = wkInfo.idxD0 !== null ? parseNumFast(row[wkInfo.idxD0]) : null;

        // 🔥 Se tem qualquer dado, marcamos a semana como válida
        if (notaTotal !== null || notaD0 !== null) {
          globalWeekDataTracker[wk] = true; 
        }

        if (notaTotal !== null) {
          hubAgg.somaTotal[wk] += notaTotal; hubAgg.countTotal[wk] += 1;
          driverAgg.notasTotal[wk].soma += notaTotal; driverAgg.notasTotal[wk].qtd += 1;
        }
        if (notaD0 !== null) {
          hubAgg.somaD0[wk] += notaD0; hubAgg.countD0[wk] += 1;
          driverAgg.notasD0[wk].soma += notaD0; driverAgg.notasD0[wk].qtd += 1;
        }
      }
    }

    // 2.1 Mapear apenas semanas válidas (com dados) para colunas e meses
    const colSemanasFiltradas = colSemanasOriginais
      .filter(w => globalWeekDataTracker[w.week])
      .map(w => ({ id: w.week, label: w.formatado, mes: obterMesDaSemana(w.week) }));

    const monthMap = {};
    colSemanasFiltradas.forEach(w => {
        if (!monthMap[w.mes]) monthMap[w.mes] = { id: w.mes, label: w.mes.toUpperCase(), weeks: [] };
        monthMap[w.mes].weeks.push(w.id);
    });
    const colMeses = Object.values(monthMap);

    const hubsData = Object.values(aggs).map(h => {
      const mediasTotal = {}; const mediasD0 = {};
      
      colSemanasFiltradas.forEach(sem => {
        const wk = sem.id;
        mediasTotal[wk] = h.countTotal[wk] > 0 ? Number((h.somaTotal[wk] / h.countTotal[wk]).toFixed(2)) : null;
        mediasD0[wk] = h.countD0[wk] > 0 ? Number((h.somaD0[wk] / h.countD0[wk]).toFixed(2)) : null;
      });

      const mediasMesTotal = {}; const mediasMesD0 = {};
      colMeses.forEach(m => {
        let sT = 0, qT = 0, sD = 0, qD = 0;
        m.weeks.forEach(wk => {
           if (mediasTotal[wk] !== null) { sT += mediasTotal[wk]; qT++; }
           if (mediasD0[wk] !== null) { sD += mediasD0[wk]; qD++; }
        });
        mediasMesTotal[m.id] = qT > 0 ? Number((sT / qT).toFixed(2)) : null;
        mediasMesD0[m.id] = qD > 0 ? Number((sD / qD).toFixed(2)) : null;
      });

      const driversFinal = Object.values(h.driversMap).map(d => {
        const scoresTotal = {}; const scoresD0 = {};
        
        colSemanasFiltradas.forEach(sem => {
          const wk = sem.id;
          scoresTotal[wk] = d.notasTotal[wk].qtd > 0 ? Number((d.notasTotal[wk].soma / d.notasTotal[wk].qtd).toFixed(2)) : null;
          scoresD0[wk] = d.notasD0[wk].qtd > 0 ? Number((d.notasD0[wk].soma / d.notasD0[wk].qtd).toFixed(2)) : null;
        });

        const scoresMesTotal = {}; const scoresMesD0 = {};
        colMeses.forEach(m => {
            let sT = 0, qT = 0, sD = 0, qD = 0;
            m.weeks.forEach(wk => {
                if (scoresTotal[wk] !== null) { sT += scoresTotal[wk]; qT++; }
                if (scoresD0[wk] !== null) { sD += scoresD0[wk]; qD++; }
            });
            scoresMesTotal[m.id] = qT > 0 ? Number((sT / qT).toFixed(2)) : null;
            scoresMesD0[m.id] = qD > 0 ? Number((sD / qD).toFixed(2)) : null;
        });

        return { id: d.id, veiculo: d.veiculo, regional: d.regional, scoresTotal, scoresD0, scoresMesTotal, scoresMesD0 };
      }).sort((a, b) => a.id.localeCompare(b.id));

      return { name: h.name, mediasTotal, mediasD0, mediasMesTotal, mediasMesD0, drivers: driversFinal };
    }).sort((a, b) => a.name.localeCompare(b.name));

    return { colSemanasFiltradas, colMeses, hubsData, listaHubsUnicos: hubsData.map(h => h.name) };
  }, [rawData, currentRegional, selectedRegs, selectedHubs, deferredSearchTerm]);

  const metrics = useMemo(() => {
    if (!processed.hubsData || processed.hubsData.length === 0) {
      return { mediaGeral: 0, totalDrivers: 0, totalHubs: 0, criticos: 0 };
    }
    
    let somaNotas = 0, qtdNotas = 0, totalCondutores = 0, condutoresCriticos = 0;

    processed.hubsData.forEach(hub => {
      totalCondutores += hub.drivers.length;
      
      const hubMetrics = 
        viewMode === 'TOTAL' ? hub.mediasTotal : 
        viewMode === 'D0' ? hub.mediasD0 : 
        viewMode === 'MONTH_TOTAL' ? hub.mediasMesTotal : hub.mediasMesD0;
      
      Object.values(hubMetrics).forEach(val => {
        if (val !== null) { somaNotas += val; qtdNotas++; }
      });

      hub.drivers.forEach(d => {
        let isCritico = false;
        const driverScores = 
            viewMode === 'TOTAL' ? d.scoresTotal : 
            viewMode === 'D0' ? d.scoresD0 : 
            viewMode === 'MONTH_TOTAL' ? d.scoresMesTotal : d.scoresMesD0;
            
        Object.values(driverScores).forEach(score => { if (score !== null && score < 95) isCritico = true; });
        if (isCritico) condutoresCriticos++;
      });
    });

    return {
      mediaGeral: qtdNotas > 0 ? (somaNotas / qtdNotas).toFixed(2) : "0.00",
      totalDrivers: totalCondutores,
      totalHubs: processed.hubsData.length,
      criticos: condutoresCriticos
    };
  }, [processed, viewMode]);

  const allPermittedHubs = useMemo(() => {
    if (rawData.length < 2) return [];
    const hPermitidos = new Set(getHubsPermitidos(currentRegional));
    const sH = new Set();
    for (let i = 1; i < rawData.length; i++) {
        const h = String(rawData[i][4] || "").trim();
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
    if (!processed.colSemanasFiltradas || processed.colSemanasFiltradas.length === 0) return alert("Matriz vazia.");
    
    const hubRef = processed.hubsData.find(h => h.name === hubDownload);
    if (!hubRef) return alert("Nenhum dado filtrado correspondente para este Hub.");

    const isMonthly = viewMode.includes('MONTH');
    const colsToExport = isMonthly ? processed.colMeses : processed.colSemanasFiltradas;
    const colHeaders = colsToExport.map(c => c.label);
    
    const headersCSV = ["Driver ID", "Veículo", "Subregional", "HUB", "Visão Exportada", ...colHeaders];
    
    const linhasCSV = hubRef.drivers.map(d => {
      const notasArr = colsToExport.map(col => {
        let val = null;
        if (viewMode === 'TOTAL') val = d.scoresTotal[col.id];
        else if (viewMode === 'D0') val = d.scoresD0[col.id];
        else if (viewMode === 'MONTH_TOTAL') val = d.scoresMesTotal[col.id];
        else if (viewMode === 'MONTH_D0') val = d.scoresMesD0[col.id];
        return val !== null ? `${val}%` : "-";
      });
      return [d.id, d.veiculo, d.regional, hubDownload, viewMode, ...notasArr].join(",");
    });

    const csvContent = "\uFEFF" + [headersCSV.join(","), ...linhasCSV].join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `DS_${viewMode}_${hubDownload.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) return <div className="p-10 text-center animate-pulse font-black text-[#113366] text-xl tracking-widest mt-20">CONSOLIDANDO DADOS DE DS...</div>;

  const filteredRegsOptions = listRegs.filter(reg => reg.toLowerCase().includes(regSearchTerm.toLowerCase()));
  const filteredHubsOptions = listHubs.filter(hub => hub.toLowerCase().includes(hubSearchTerm.toLowerCase()));
  
  const showsEmptyState = selectedRegs.length === 0 && selectedHubs.length === 0 && !searchTerm;
  const activeColumns = viewMode.includes('MONTH') ? processed.colMeses : processed.colSemanasFiltradas;

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
            <div className="md:col-span-4 flex flex-col gap-2 relative" ref={dropdownRegRef}>
                <label className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-1"><Filter size={12}/> 1. Subregional</label>
                <div onClick={() => setDropdownRegOpen(!dropdownRegOpen)} className="w-full bg-slate-50 dark:bg-[#15171e] dark:text-white border border-slate-200 dark:border-gray-700 rounded-xl py-3 px-3 text-sm font-bold flex justify-between items-center cursor-pointer hover:border-slate-300 dark:hover:border-gray-600 transition-all select-none">
                  <span className="truncate pr-4 text-slate-700 dark:text-gray-200">{selectedRegs.length === 0 ? "Todas as Subregionais" : `${selectedRegs.length} reg(s): ${selectedRegs.join(', ')}`}</span>
                  <ChevronDown size={16} className={`text-slate-400 transition-transform ${dropdownRegOpen ? 'rotate-180' : ''}`} />
                </div>
                {dropdownRegOpen && (
                  <div className="absolute top-[100%] left-0 w-full bg-white dark:bg-[#1f232d] border border-slate-200 dark:border-gray-700 rounded-xl mt-1 shadow-xl z-50 max-h-64 overflow-y-auto custom-scrollbar p-1 flex flex-col gap-0.5">
                    <div className="p-1 sticky top-0 bg-white dark:bg-[#1f232d] z-10 flex flex-col gap-1 border-b border-slate-100 dark:border-gray-800">
                      <div className="relative"><Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={14} /><input type="text" placeholder="Buscar subregional..." value={regSearchTerm} onChange={(e) => setRegSearchTerm(e.target.value)} className="w-full bg-slate-50 dark:bg-[#15171e] dark:text-white text-xs font-bold pl-8 pr-2.5 py-2 rounded-lg border border-slate-200 dark:border-gray-700 outline-none focus:border-[#EE4D2D] transition-all"/></div>
                      <div className="flex justify-between items-center px-1 py-1"><button type="button" onClick={handleSelectAllRegs} className="text-[10px] font-black uppercase text-[#113366] dark:text-blue-400 hover:opacity-70 transition-colors">Selecionar Todas</button><button type="button" onClick={handleClearRegs} className="text-[10px] font-black uppercase text-slate-400 hover:text-slate-600 dark:hover:text-gray-200 transition-colors">Limpar Filtro</button></div>
                    </div>
                    {filteredRegsOptions.length === 0 ? (<div className="text-center p-4 text-xs font-bold text-slate-400">Nenhuma subregional.</div>) : (
                      filteredRegsOptions.map(reg => {
                        const isChecked = selectedRegs.includes(reg);
                        return (<div key={`filter-reg-${reg}`} onClick={() => toggleRegSelection(reg)} className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs font-bold cursor-pointer transition-colors ${isChecked ? 'bg-blue-50 dark:bg-blue-900/20 text-[#113366] dark:text-blue-400' : 'text-slate-700 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-gray-800'}`}><span className="truncate">{reg}</span>{isChecked && <Check size={14} className="text-[#113366] dark:text-blue-400 shrink-0" />}</div>);
                      })
                    )}
                  </div>
                )}
            </div>

            <div className="md:col-span-4 flex flex-col gap-2 relative" ref={dropdownRef}>
                <label className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-1"><MapPin size={12}/> 2. Station (HUB)</label>
                <div onClick={() => setDropdownOpen(!dropdownOpen)} className="w-full bg-slate-50 dark:bg-[#15171e] dark:text-white border border-slate-200 dark:border-gray-700 rounded-xl py-3 px-3 text-sm font-bold flex justify-between items-center cursor-pointer hover:border-slate-300 dark:hover:border-gray-600 transition-all select-none">
                  <span className="truncate pr-4 text-slate-700 dark:text-gray-200">{selectedHubs.length === 0 ? "Todos os HUBs" : `${selectedHubs.length} HUB(s): ${selectedHubs.join(', ')}`}</span>
                  <ChevronDown size={16} className={`text-slate-400 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
                </div>
                {dropdownOpen && (
                  <div className="absolute top-[100%] left-0 w-full bg-white dark:bg-[#1f232d] border border-slate-200 dark:border-gray-700 rounded-xl mt-1 shadow-xl z-50 max-h-64 overflow-y-auto custom-scrollbar p-1 flex flex-col gap-0.5">
                    <div className="p-1 sticky top-0 bg-white dark:bg-[#1f232d] z-10 flex flex-col gap-1 border-b border-slate-100 dark:border-gray-800">
                      <div className="relative"><Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={14} /><input type="text" placeholder="Buscar hub..." value={hubSearchTerm} onChange={(e) => setHubSearchTerm(e.target.value)} className="w-full bg-slate-50 dark:bg-[#15171e] dark:text-white text-xs font-bold pl-8 pr-2.5 py-2 rounded-lg border border-slate-200 dark:border-gray-700 outline-none focus:border-[#EE4D2D] transition-all"/></div>
                      <div className="flex justify-between items-center px-1 py-1"><button type="button" onClick={handleSelectAllHubs} className="text-[10px] font-black uppercase text-[#EE4D2D] hover:text-[#D0011B] transition-colors">Selecionar Todos</button><button type="button" onClick={handleClearHubs} className="text-[10px] font-black uppercase text-slate-400 hover:text-slate-600 dark:hover:text-gray-200 transition-colors">Limpar Filtro</button></div>
                    </div>
                    {filteredHubsOptions.length === 0 ? (<div className="text-center p-4 text-xs font-bold text-slate-400">Nenhum HUB correspondente.</div>) : (
                      filteredHubsOptions.map(hub => {
                        const isChecked = selectedHubs.includes(hub);
                        return (<div key={`filter-${hub}`} onClick={() => toggleHubSelection(hub)} className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs font-bold cursor-pointer transition-colors ${isChecked ? 'bg-orange-50 dark:bg-orange-950/20 text-[#EE4D2D]' : 'text-slate-700 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-gray-800'}`}><span className="truncate">{hub}</span>{isChecked && <Check size={14} className="text-[#EE4D2D] shrink-0" />}</div>);
                      })
                    )}
                  </div>
                )}
            </div>

            <div className="md:col-span-4 flex flex-col gap-2">
                <label className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-1"><Search size={12}/> Ou busque direto</label>
                <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} /><input type="text" placeholder="ID do Motorista..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full bg-slate-50 dark:bg-[#15171e] dark:text-white border border-slate-200 dark:border-gray-700 rounded-xl py-3 pl-10 pr-3 text-sm font-bold outline-none focus:ring-2 focus:ring-[#113366] transition-all"/></div>
            </div>
        </div>
      </div>

      {/* 2. SÉRIE DE CARDS EXECUTIVOS (KPIs) */}
      <div className={`grid grid-cols-2 lg:grid-cols-4 gap-4 shrink-0 transition-opacity duration-300 ${showsEmptyState ? 'opacity-30 pointer-events-none' : 'opacity-100'}`}>
        <div className="bg-white dark:bg-[#1f232d] p-4 rounded-2xl shadow-sm border border-slate-200 dark:border-gray-800 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Média Geral ({viewMode.includes('TOTAL') ? 'Total' : 'D-0'})</span>
            <span className="text-xl font-black text-[#113366] dark:text-white tracking-tight">{metrics.mediaGeral}%</span>
          </div>
          <Award className="text-[#EE4D2D]" size={24} />
        </div>
        <div className="bg-white dark:bg-[#1f232d] p-4 rounded-2xl shadow-sm border border-slate-200 dark:border-gray-800 flex items-center justify-between">
          <div><span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Condutores Ativos</span><span className="text-xl font-black text-[#113366] dark:text-white tracking-tight">{metrics.totalDrivers}</span></div><User className="text-blue-500" size={24} />
        </div>
        <div className="bg-white dark:bg-[#1f232d] p-4 rounded-2xl shadow-sm border border-slate-200 dark:border-gray-800 flex items-center justify-between">
          <div><span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">HUBs Consolidados</span><span className="text-xl font-black text-[#113366] dark:text-white tracking-tight">{metrics.totalHubs}</span></div><MapPin className="text-emerald-500" size={24} />
        </div>
        <div className="bg-white dark:bg-[#1f232d] p-4 rounded-2xl shadow-sm border border-slate-200 dark:border-gray-800 flex items-center justify-between">
          <div><span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Abaixo da Meta (&lt;95%)</span><span className="text-xl font-black text-[#D0011B] tracking-tight">{metrics.criticos} Drivers</span></div><AlertCircle className="text-[#D0011B]" size={24} />
        </div>
      </div>

      {/* 3. TOGGLE COM 4 OPÇÕES + ÁREA DE DADOS */}
      <div className="flex flex-col gap-3 flex-1 relative min-h-[400px]">
        
        {/* MENU DE VISÃO AMPLIADO */}
        <div className={`flex flex-wrap items-center bg-white dark:bg-[#1f232d] p-1.5 rounded-xl w-fit shadow-sm border border-slate-200 dark:border-gray-800 transition-opacity ${showsEmptyState ? 'opacity-30 pointer-events-none' : 'opacity-100'}`}>
          <button onClick={() => setViewMode('TOTAL')} className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-[11px] font-black uppercase transition-all ${viewMode === 'TOTAL' ? 'bg-[#113366] text-white shadow-md' : 'text-slate-500 hover:text-slate-700 dark:text-gray-400 dark:hover:text-white'}`}>
            <Award size={14}/> Semanal Total
          </button>
          <button onClick={() => setViewMode('D0')} className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-[11px] font-black uppercase transition-all ${viewMode === 'D0' ? 'bg-[#EE4D2D] text-white shadow-md' : 'text-slate-500 hover:text-slate-700 dark:text-gray-400 dark:hover:text-white'}`}>
            <Zap size={14}/> Semanal D-0
          </button>
          
          <div className="w-[1px] h-6 bg-slate-200 dark:bg-gray-700 mx-1"></div>
          
          <button onClick={() => setViewMode('MONTH_TOTAL')} className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-[11px] font-black uppercase transition-all ${viewMode === 'MONTH_TOTAL' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-700 dark:text-gray-400 dark:hover:text-white'}`}>
            <CalendarDays size={14}/> Mensal Total
          </button>
          <button onClick={() => setViewMode('MONTH_D0')} className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-[11px] font-black uppercase transition-all ${viewMode === 'MONTH_D0' ? 'bg-orange-500 text-white shadow-md' : 'text-slate-500 hover:text-slate-700 dark:text-gray-400 dark:hover:text-white'}`}>
            <CalendarCheck size={14}/> Mensal D-0
          </button>
        </div>

        <div className="bg-white dark:bg-[#1f232d] rounded-2xl shadow-sm border border-[#113366] overflow-hidden flex flex-col flex-1 relative">
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
                  <thead className={viewMode.includes('MONTH') ? (viewMode === 'MONTH_TOTAL' ? 'bg-indigo-600 text-white' : 'bg-orange-500 text-white') : (viewMode === 'TOTAL' ? 'bg-[#113366] text-white' : 'bg-[#EE4D2D] text-white')}>
                  <tr className="tracking-widest text-[10px] uppercase font-black sticky top-0 z-20">
                      <th className="p-4 text-left min-w-[250px] shadow-sm">SUBREGIONAL / STATION / DRIVER</th>
                      <th className="p-4 shadow-sm">VEÍCULO</th>
                      {activeColumns.map(col => (
                        <th key={col.id} className="p-4 min-w-[85px] bg-white/10 border-l border-white/20 shadow-sm">{col.label}</th>
                      ))}
                  </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100 dark:divide-gray-800 font-black text-sm relative z-0">
                  {processed.hubsData.length === 0 ? (
                      <tr><td colSpan={activeColumns.length + 2} className="p-10 text-center font-bold text-slate-400">Nenhum dado encontrado.</td></tr>
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
                              <td className="p-4 text-xs font-black text-[#113366] dark:text-white uppercase border-r border-slate-200 dark:border-gray-700">STATION</td>
                              
                              {activeColumns.map(col => {
                                let val = null;
                                if (viewMode === 'TOTAL') val = hub.mediasTotal[col.id];
                                else if (viewMode === 'D0') val = hub.mediasD0[col.id];
                                else if (viewMode === 'MONTH_TOTAL') val = hub.mediasMesTotal[col.id];
                                else if (viewMode === 'MONTH_D0') val = hub.mediasMesD0[col.id];

                                return (
                                    <td key={col.id} className={`p-4 border-r border-slate-200 dark:border-gray-700 ${val !== null && val < 95 ? 'bg-red-50/50 dark:bg-red-900/10 text-[#D0011B]' : 'bg-slate-50/30 dark:bg-gray-800/10 text-slate-800 dark:text-gray-200'}`}>
                                    {renderSemaforo(val)}
                                    </td>
                                );
                              })}
                          </tr>

                          {isOpen && hub.drivers.map(driver => (
                              <tr key={`${hub.name}-${driver.id}`} className="bg-white dark:bg-[#15171e] text-xs text-slate-600 dark:text-gray-400 transition-colors hover:bg-slate-50">
                              <td className="p-3 text-left pl-12 font-black flex items-center gap-2 text-slate-800 dark:text-gray-200 border-r border-slate-100 dark:border-gray-800">
                                  <User size={13} className="text-slate-400 shrink-0" /> {driver.id}
                              </td>
                              <td className="p-3 font-bold uppercase text-[10px] text-slate-400 tracking-wider border-r border-slate-100 dark:border-gray-800">
                                  <span className="flex items-center justify-center gap-1"><Truck size={12}/> {driver.veiculo}</span>
                              </td>
                              
                              {activeColumns.map(col => {
                                  let val = null;
                                  if (viewMode === 'TOTAL') val = driver.scoresTotal[col.id];
                                  else if (viewMode === 'D0') val = driver.scoresD0[col.id];
                                  else if (viewMode === 'MONTH_TOTAL') val = driver.scoresMesTotal[col.id];
                                  else if (viewMode === 'MONTH_D0') val = driver.scoresMesD0[col.id];

                                  return (
                                  <td key={col.id} className={`p-3 font-bold border-r border-slate-100 dark:border-gray-800 ${val !== null && val < 95 ? 'text-[#D0011B] font-black bg-red-50/20 dark:bg-red-900/5' : ''}`}>
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
    </div>
  );
}