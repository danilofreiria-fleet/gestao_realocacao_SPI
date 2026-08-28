import React, { useState, useEffect, useMemo, useRef, useDeferredValue } from 'react';
import { getDeliverySuccessData, getBaseDSHubData, getOfertasDriversData } from '../api/googleSheets';
import { getHubsPermitidos, MAPA_REGIONAL_COMPLETO } from '../constants/regionais';
import { Database, Lightbulb, Target, Award, ChevronDown, ChevronRight, Download, Search, MapPin, Truck, User, AlertCircle, Check, Filter, Zap, CalendarDays, CalendarCheck, Users, LayoutDashboard, Layers, Eraser } from 'lucide-react';

const MESES = [
  { value: '01', label: 'Janeiro' }, { value: '02', label: 'Fevereiro' }, { value: '03', label: 'Março' },
  { value: '04', label: 'Abril' }, { value: '05', label: 'Maio' }, { value: '06', label: 'Junho' },
  { value: '07', label: 'Julho' }, { value: '08', label: 'Agosto' }, { value: '09', label: 'Setembro' },
  { value: '10', label: 'Outubro' }, { value: '11', label: 'Novembro' }, { value: '12', label: 'Dezembro' }
];

// PADRONIZAR HUBS (RIBEIRÃO ESTAÇÃO E SUMARÉ NOVA VENEZA)
const padronizarHubLocal = (nome) => {
  if (!nome) return "";
  let n = String(nome).trim();
  let nLimpo = n.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, '');
  
  if (nLimpo.includes("ribeiraopretoesta")) return "LM Hub_SP_RibeirãoPretoEstaça";
  if (nLimpo.includes("sumare") && nLimpo.includes("veneza")) return "LM Hub_SP_Sumaré_Nova Veneza";
  
  return n;
};

// Funções de Tempo e Parsing
const parseUniversalDate = (dateStr) => {
  if (!dateStr) return null;
  let s = String(dateStr).trim().split('T')[0].split(' ')[0];
  if (s.includes('/')) {
    const parts = s.split('/');
    if (parts.length === 3) {
      return `${parts[2].length === 2 ? '20'+parts[2] : parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}T12:00:00`;
    }
  }
  return `${s}T12:00:00`;
};

const getISOWeek = (isoDate) => {
  if (!isoDate) return "";
  const d = new Date(isoDate);
  if (isNaN(d.getTime())) return "";
  const dCopy = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = dCopy.getUTCDay() || 7;
  dCopy.setUTCDate(dCopy.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(dCopy.getUTCFullYear(), 0, 1));
  return `W${String(Math.ceil((((dCopy - yearStart) / 86400000) + 1) / 7)).padStart(2, '0')}`;
};

export default function DeliverySuccess() {
  const [loading, setLoading] = useState(true);
  
  // BASES DE DADOS
  const [rawData, setRawData] = useState([]);
  const [baseData, setBaseData] = useState([]); 
  const [ofertasData, setOfertasData] = useState([]); 

  // ESTADOS DE UI E NAVEGAÇÃO
  const [activeTab, setActiveTab] = useState('drivers'); // 'drivers' ou 'hubs'
  const [filtrosAbertos, setFiltrosAbertos] = useState(true);
  
  const [expandedHubs, setExpandedHubs] = useState({});
  const [expandedOfertas, setExpandedOfertas] = useState({});
  const [searchTerm, setSearchTerm] = useState('');
  const [hubDownload, setHubDownload] = useState('');

  // CONTROLES DE TEMPO DE EXIBIÇÃO
  const [driverViewMode, setDriverViewMode] = useState('TOTAL'); 
  const [hubTimeView, setHubTimeView] = useState('dia'); // 'dia', 'semana', 'mes'

  // FILTROS GLOBAIS
  const [selectedRegs, setSelectedRegs] = useState([]);
  const [dropdownRegOpen, setDropdownRegOpen] = useState(false);
  const [regSearchTerm, setRegSearchTerm] = useState('');

  const [selectedHubs, setSelectedHubs] = useState([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [hubSearchTerm, setHubSearchTerm] = useState('');
  
  // FILTROS DE TEMPO E MODAL
  const [semanaFilter, setSemanaFilter] = useState('');
  const [mesFilter, setMesFilter] = useState('');
  const [veiculoFilter, setVeiculoFilter] = useState('');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');

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
        const [dataDS, dataBase, dataOfertas] = await Promise.all([
            getDeliverySuccessData(),
            getBaseDSHubData(),
            getOfertasDriversData()
        ]);
        if (dataDS && dataDS.length > 1) setRawData(dataDS); 
        if (dataBase && dataBase.length > 1) setBaseData(dataBase);
        if (dataOfertas && dataOfertas.length > 1) setOfertasData(dataOfertas);
      } catch (e) {
        console.error("Erro ao carregar dados do Dashboard:", e);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const obterMesDaSemana = (weekStr) => {
    const w = parseInt(String(weekStr).replace(/\D/g, ''), 10);
    if (!w) return "Outros";
    const ano = new Date().getFullYear();
    const dataBase = new Date(ano, 0, 1 + (w - 1) * 7 + 3);
    const mes = dataBase.toLocaleString('pt-BR', { month: 'long' });
    return mes.charAt(0).toUpperCase() + mes.slice(1);
  };

  const renderSemaforo = (val, isD0) => {
    if (val === null || val === undefined || val === '') return '-';
    const num = Number(val);

    if (isD0) {
      if (num >= 95) {
        return (
          <div className="flex items-center gap-1.5 justify-center text-emerald-600 dark:text-emerald-400 font-black">
            <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_5px_rgba(16,185,129,0.5)]"></div>
            {num}%
          </div>
        );
      } else {
        return (
           <div className="flex items-center gap-1.5 justify-center text-[#D0011B] font-black">
            <div className="w-2 h-2 rounded-full bg-[#D0011B] shadow-[0_0_5px_rgba(208,1,27,0.5)]"></div>
            {num}%
          </div>
        );
      }
    } else {
      if (num >= 98) {
        return (
          <div className="flex items-center gap-1.5 justify-center text-emerald-600 dark:text-emerald-400 font-black">
            <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_5px_rgba(16,185,129,0.5)]"></div>
            {num}%
          </div>
        );
      } else if (num >= 95) {
        return (
          <div className="flex items-center gap-1.5 justify-center text-yellow-600 dark:text-yellow-400 font-black">
            <div className="w-2 h-2 rounded-full bg-yellow-500 shadow-[0_0_5px_rgba(234,179,8,0.5)]"></div>
            {num}%
          </div>
        );
      } else {
        return (
          <div className="flex items-center gap-1.5 justify-center text-[#D0011B] font-black">
            <div className="w-2 h-2 rounded-full bg-[#D0011B] shadow-[0_0_5px_rgba(208,1,27,0.5)]"></div>
            {num}%
          </div>
        );
      }
    }
  };

  const toggleRegSelection = (reg) => {
    setSelectedRegs(prev => prev.includes(reg) ? prev.filter(r => r !== reg) : [...prev, reg]);
    setSelectedHubs([]); 
  };

  const toggleHubSelection = (hub) => {
    setSelectedHubs(prev => prev.includes(hub) ? prev.filter(h => h !== hub) : [...prev, hub]);
  };

  const toggleHub = (hubName) => setExpandedHubs(prev => ({ ...prev, [hubName]: !prev[hubName] }));
  const toggleOfertas = (hubName) => setExpandedOfertas(prev => ({ ...prev, [hubName]: !prev[hubName] }));

  const handleSelectAllRegs = () => { setSelectedRegs([...listRegs]); setSelectedHubs([]); };
  const handleClearRegs = () => { setSelectedRegs([]); setSelectedHubs([]); };
  const handleSelectAllHubs = () => setSelectedHubs([...listHubs]);
  const handleClearHubs = () => setSelectedHubs([]);

  const limparTodosFiltros = () => {
    setSelectedRegs([]);
    setSelectedHubs([]);
    setSearchTerm('');
    setSemanaFilter('');
    setMesFilter('');
    setVeiculoFilter('');
    setDataInicio('');
    setDataFim('');
  };

  const sanitizeHubName = (hubName) => {
    if (!hubName) return "";
    return String(hubName)
      .toUpperCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^A-Z0-9]/g, ""); 
  };

  const sanitizeForSearch = (str) => {
    if (!str) return '';
    return String(str).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  };

  const permittedHubsSet = useMemo(() => {
    const permitidosLista = getHubsPermitidos(currentRegional) || [];
    const extraPermitted = Object.keys(MAPA_REGIONAL_COMPLETO).filter(k => {
      const reg = MAPA_REGIONAL_COMPLETO[k];
      if (!reg) return false;
      if (currentRegional === 'BOTH') return true;
      return reg.toUpperCase().includes(String(currentRegional).toUpperCase());
    });
    return new Set([...permitidosLista, ...extraPermitted].map(sanitizeHubName));
  }, [currentRegional]);

  const SANITIZED_REGIONAL_MAP = useMemo(() => {
    const map = {};
    Object.keys(MAPA_REGIONAL_COMPLETO).forEach(k => {
      map[sanitizeHubName(k)] = MAPA_REGIONAL_COMPLETO[k];
    });
    return map;
  }, []);

  const { listRegs, listHubs, listVehicles, availableWeeks } = useMemo(() => {
    if (rawData.length < 2) return { listRegs: [], listHubs: [], listVehicles: [], availableWeeks: [] };
    
    const setR = new Set();
    const setH = new Set();
    const setV = new Set();
    const weeksSet = new Set();
    const len = rawData.length;
    
    const currentWeekStr = getISOWeek(new Date().toISOString());
    const currentWeekNum = parseInt(currentWeekStr.replace(/\D/g, ''), 10);

    rawData[0].forEach(h => {
        const match = String(h).trim().toUpperCase().match(/W\d+/);
        if (match) {
            const weekNum = parseInt(match[0].replace(/\D/g, ''), 10);
            if (weekNum <= currentWeekNum || currentWeekNum < 5) {
                weeksSet.add(match[0]);
            }
        }
    });

    for (let i = 1; i < len; i++) {
      const veiculoRaw = String(rawData[i][1] || "").trim();
      if (veiculoRaw) setV.add(veiculoRaw);

      const hubRaw = String(rawData[i][4] || "").trim(); 
      const hub = padronizarHubLocal(hubRaw); 
      const cleanHubName = sanitizeHubName(hub);
      
      if (hub && permittedHubsSet.has(cleanHubName)) {
        let subRegional = MAPA_REGIONAL_COMPLETO[hub] || SANITIZED_REGIONAL_MAP[cleanHubName] || String(rawData[i][2] || "").trim();

        if (subRegional) setR.add(subRegional);
        if (selectedRegs.length === 0 || selectedRegs.includes(subRegional)) {
          setH.add(hub); 
        }
      }
    }
    return { 
      listRegs: Array.from(setR).sort(), 
      listHubs: Array.from(setH).sort(),
      listVehicles: Array.from(setV).sort(),
      availableWeeks: Array.from(weeksSet).sort()
    };
  }, [rawData, permittedHubsSet, selectedRegs, SANITIZED_REGIONAL_MAP]);

  // =========================================================
  // MOTOR 1: VISÃO CONDUTORES
  // =========================================================
  const processedDrivers = useMemo(() => {
    if (rawData.length < 2 || (selectedRegs.length === 0 && selectedHubs.length === 0 && !searchTerm && !veiculoFilter)) {
        return { colSemanasFiltradas: [], colMeses: [], hubsData: [] };
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

    let colSemanasOriginais = Object.values(weekMap)
      .filter(w => w.idxTotal !== null || w.idxD0 !== null)
      .sort((a, b) => a.week.localeCompare(b.week));

    if (semanaFilter) {
      colSemanasOriginais = colSemanasOriginais.filter(w => w.week === semanaFilter);
    }
    if (mesFilter) {
      const mesObj = MESES.find(m => m.value === mesFilter);
      if (mesObj) {
        const mesNome = mesObj.label.toLowerCase();
        colSemanasOriginais = colSemanasOriginais.filter(w => obterMesDaSemana(w.week).toLowerCase() === mesNome);
      }
    }

    const weeksCount = colSemanasOriginais.length;
    const globalWeekDataTracker = {}; 
    const aggs = {};
    const selectedRegsSet = new Set(selectedRegs);
    const selectedHubsSet = new Set(selectedHubs);
    const termLower = deferredSearchTerm.toLowerCase().trim();

    const parseNumFast = (val) => {
      if (val === null || val === undefined || val === '') return null;
      if (typeof val === 'number') return val;
      let s = String(val).trim().replace(/%/g, '');
      if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
      else if (/\.\d{3}$/.test(s)) s = s.replace(/\./g, '');
      const n = Number(s);
      return isNaN(n) ? null : n;
    };

    for (let i = 1; i < rawData.length; i++) {
      const row = rawData[i];
      const driverId = String(row[0] || "").trim();
      const veiculo = String(row[1] || "").trim() || "NÃO INFORMADO"; 
      const regionalPlanilha = String(row[2] || "").trim(); 
      const hubRaw = String(row[4] || "").trim(); 
      const hub = padronizarHubLocal(hubRaw); 
      
      const cleanHubName = sanitizeHubName(hub);
      if (!hub || !permittedHubsSet.has(cleanHubName)) continue;

      let subRegional = MAPA_REGIONAL_COMPLETO[hub] || SANITIZED_REGIONAL_MAP[cleanHubName] || regionalPlanilha;

      if (selectedRegsSet.size > 0 && !selectedRegsSet.has(subRegional)) continue;
      if (selectedHubsSet.size > 0 && !selectedHubsSet.has(hub)) continue;
      if (veiculoFilter && veiculo.toUpperCase() !== veiculoFilter.toUpperCase()) continue;
      if (!driverId) continue;
      if (termLower && !driverId.toLowerCase().includes(termLower)) continue;

      let hubAgg = aggs[hub];
      if (!hubAgg) {
        hubAgg = { name: hub, subRegional, driversMap: {} };
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

        if (notaTotal !== null || notaD0 !== null) globalWeekDataTracker[wk] = true; 

        if (notaTotal !== null) {
          driverAgg.notasTotal[wk].soma += notaTotal; driverAgg.notasTotal[wk].qtd += 1;
        }
        if (notaD0 !== null) {
          driverAgg.notasD0[wk].soma += notaD0; driverAgg.notasD0[wk].qtd += 1;
        }
      }
    }

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

      const mediasTotal = {}; const mediasD0 = {}; const mediasMesTotal = {}; const mediasMesD0 = {};
      
      colSemanasFiltradas.forEach(sem => {
          let sT = 0, qT = 0, sD = 0, qD = 0;
          driversFinal.forEach(d => {
              if (d.scoresTotal[sem.id] !== null) { sT += d.scoresTotal[sem.id]; qT++; }
              if (d.scoresD0[sem.id] !== null) { sD += d.scoresD0[sem.id]; qD++; }
          });
          mediasTotal[sem.id] = qT > 0 ? Number((sT / qT).toFixed(2)) : null;
          mediasD0[sem.id] = qD > 0 ? Number((sD / qD).toFixed(2)) : null;
      });

      colMeses.forEach(m => {
        let sT = 0, qT = 0, sD = 0, qD = 0;
        driversFinal.forEach(d => {
            if (d.scoresMesTotal[m.id] !== null) { sT += d.scoresMesTotal[m.id]; qT++; }
            if (d.scoresMesD0[m.id] !== null) { sD += d.scoresMesD0[m.id]; qD++; }
        });
        mediasMesTotal[m.id] = qT > 0 ? Number((sT / qT).toFixed(2)) : null;
        mediasMesD0[m.id] = qD > 0 ? Number((sD / qD).toFixed(2)) : null;
      });

      return { name: h.name, subRegional: h.subRegional, mediasTotal, mediasD0, mediasMesTotal, mediasMesD0, drivers: driversFinal };
    }).sort((a, b) => a.name.localeCompare(b.name));

    return { colSemanasFiltradas, colMeses, hubsData };
  }, [rawData, permittedHubsSet, selectedRegs, selectedHubs, deferredSearchTerm, SANITIZED_REGIONAL_MAP, semanaFilter, mesFilter, veiculoFilter]);

  // =========================================================
  // MOTOR 2: VISÃO KPIs HUB + OFERTAS
  // =========================================================
  const processedHubKPIs = useMemo(() => {
    if ((!baseData || baseData.length < 2) && (!ofertasData || ofertasData.length < 2)) {
       return { timeColumns: [], hubsData: [] };
    }

    const aggs = {};
    const timeColsMap = new Map();
    const selectedRegsSet = new Set(selectedRegs);
    const selectedHubsSet = new Set(selectedHubs);

    const parseNumFast = (val) => {
      if (val === null || val === undefined || val === '') return null;
      if (typeof val === 'number') return val;
      let s = String(val).trim().replace(/%/g, '');
      if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
      else if (/\.\d{3}$/.test(s)) s = s.replace(/\./g, '');
      const n = Number(s);
      return isNaN(n) ? null : n;
    };

    const dataInicioObj = dataInicio ? new Date(dataInicio + 'T00:00:00') : null;
    const dataFimObj = dataFim ? new Date(dataFim + 'T23:59:59') : null;

    const initAgg = (hub, subRegional, timeKey, timeSort) => {
        if (!aggs[hub]) aggs[hub] = { hub, subRegional, timeData: {} };
        if (!aggs[hub].timeData[timeKey]) {
            aggs[hub].timeData[timeKey] = {
                sumE: 0, sumF: 0, sumV: 0, countV: 0, sumR: 0, countR: 0, sumM: 0, countM: 0, sumX: 0, countX: 0, sumG: 0, sumH: 0,
                ofertasTotais: 0, ofertasMoto: 0, ofertasPasseio: 0, ofertasUtil: 0, ofertasVan: 0
            };
            if (!timeColsMap.has(timeKey)) timeColsMap.set(timeKey, { id: timeKey, label: timeKey, sortValue: timeSort });
        }
        return aggs[hub].timeData[timeKey];
    };

    // 1. Processa a Base PCP (Total Carregado, DS, Reut, etc)
    if (baseData && baseData.length > 1) {
      for (let i = 1; i < baseData.length; i++) {
        const row = baseData[i];
        const hubRaw = String(row[0] || "").trim();
        const hub = padronizarHubLocal(hubRaw);
        const cleanHubName = sanitizeHubName(hub);

        if (!hub || !permittedHubsSet.has(cleanHubName)) continue;

        let subRegional = MAPA_REGIONAL_COMPLETO[hub] || SANITIZED_REGIONAL_MAP[cleanHubName];
        if (selectedRegsSet.size > 0 && !selectedRegsSet.has(subRegional)) continue;
        if (selectedHubsSet.size > 0 && !selectedHubsSet.has(hub)) continue;

        const dateStr = String(row[2] || "").trim();
        const isoDate = parseUniversalDate(dateStr);
        if (!isoDate) continue;

        const dObj = new Date(isoDate);
        if (isNaN(dObj.getTime())) continue;

        if (dataInicioObj && dObj < dataInicioObj) continue;
        if (dataFimObj && dObj > dataFimObj) continue;
        if (mesFilter && String(dObj.getMonth() + 1).padStart(2, '0') !== mesFilter) continue;
        if (semanaFilter && getISOWeek(isoDate) !== semanaFilter) continue;

        let timeKey = ""; let timeSort = 0;

        if (hubTimeView === 'dia') {
          timeKey = `${String(dObj.getDate()).padStart(2, '0')}/${String(dObj.getMonth() + 1).padStart(2, '0')}/${dObj.getFullYear()}`;
          timeSort = dObj.getTime();
        } else if (hubTimeView === 'semana') {
          timeKey = getISOWeek(isoDate);
          timeSort = dObj.getFullYear() * 100 + parseInt(timeKey.replace(/\D/g, ''));
        } else if (hubTimeView === 'mes') {
          const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
          timeKey = `${meses[dObj.getMonth()]} ${dObj.getFullYear()}`;
          timeSort = dObj.getFullYear() * 100 + dObj.getMonth();
        }

        const td = initAgg(hub, subRegional, timeKey, timeSort);
        
        const carregados = parseNumFast(row[4]); // E: Pacotes Carregados
        const entregues = parseNumFast(row[5]);  // F: Pacotes Entregues
        const dsD0 = parseNumFast(row[21]); // V
        const reut = parseNumFast(row[12]); // M
        const spr = parseNumFast(row[17]);  // R
        const totalCarregado = parseNumFast(row[6]); // G
        const driversUnicos = parseNumFast(row[7]); // H
        const atPiso = parseNumFast(row[23]); // X

        if (carregados !== null) { td.sumE += carregados; }
        if (entregues !== null) { td.sumF += entregues; }
        if (dsD0 !== null) { td.sumV += dsD0; td.countV++; }
        if (reut !== null) { td.sumM += reut; td.countM++; }
        if (spr !== null) { td.sumR += spr; td.countR++; }
        if (totalCarregado !== null) { td.sumG += totalCarregado; }
        if (driversUnicos !== null) { td.sumH += driversUnicos; }
        if (atPiso !== null) { td.sumX += atPiso; td.countX++; }
      }
    }

// 2. Processa a Base de Ofertas (Leitura Matricial a partir da Coluna G)
    if (ofertasData && ofertasData.length > 0) {
      let headersOfertas = []; //  O Gabarito de datas que vai mudar a cada mês lido

      for (let i = 0; i < ofertasData.length; i++) {
        const row = ofertasData[i];
        
        // DETECTA CABEÇALHO: Se a linha for o cabeçalho do mês, atualiza o gabarito e pula!
        if (String(row[0] || "").toUpperCase().includes("DRIVER ID")) {
            headersOfertas = row;
            continue; 
        }

        const hubRaw = String(row[4] || "").trim(); // Coluna E (Índice 4)
        const hub = padronizarHubLocal(hubRaw);
        const cleanHubName = sanitizeHubName(hub);

        if (!hub || !permittedHubsSet.has(cleanHubName)) continue;

        let subRegional = MAPA_REGIONAL_COMPLETO[hub] || SANITIZED_REGIONAL_MAP[cleanHubName];
        if (selectedRegsSet.size > 0 && !selectedRegsSet.has(subRegional)) continue;
        if (selectedHubsSet.size > 0 && !selectedHubsSet.has(hub)) continue;

        const modal = String(row[1] || "").toUpperCase(); // Coluna B (Índice 1)
        const VALID_STATUS = ["AM", "AM OU SD", "PM", "SD"];

        for (let k = 6; k < row.length; k++) {
          const val = String(row[k] || "").trim().toUpperCase();
          
          if (VALID_STATUS.includes(val)) {
            // Lê as datas usando o gabarito exato do mês que está sendo lido
            const dateStr = String(headersOfertas[k] || "").trim();
            const isoDate = parseUniversalDate(dateStr);
            
            if (!isoDate) continue;

            const dObj = new Date(isoDate);
            if (isNaN(dObj.getTime())) continue;

            // Filtros de Tempo Globais
            if (dataInicioObj && dObj < dataInicioObj) continue;
            if (dataFimObj && dObj > dataFimObj) continue;
            if (mesFilter && String(dObj.getMonth() + 1).padStart(2, '0') !== mesFilter) continue;
            if (semanaFilter && getISOWeek(isoDate) !== semanaFilter) continue;

            let timeKey = ""; let timeSort = 0;

            if (hubTimeView === 'dia') {
              timeKey = `${String(dObj.getDate()).padStart(2, '0')}/${String(dObj.getMonth() + 1).padStart(2, '0')}/${dObj.getFullYear()}`;
              timeSort = dObj.getTime();
            } else if (hubTimeView === 'semana') {
              timeKey = getISOWeek(isoDate);
              timeSort = dObj.getFullYear() * 100 + parseInt(timeKey.replace(/\D/g, ''));
            } else if (hubTimeView === 'mes') {
              const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
              timeKey = `${meses[dObj.getMonth()]} ${dObj.getFullYear()}`;
              timeSort = dObj.getFullYear() * 100 + dObj.getMonth();
            }

            const td = initAgg(hub, subRegional, timeKey, timeSort);
            td.ofertasTotais++;

            if (modal.includes('MOTO')) td.ofertasMoto++;
            else if (modal.includes('PASS') || modal.includes('CARRO')) td.ofertasPasseio++;
            else if (modal.includes('VAN')) td.ofertasVan++;
            else if (modal.includes('FIORINO') || modal.includes('UTIL')) td.ofertasUtil++;
          }
        }
      }
    }

    const timeColumns = Array.from(timeColsMap.values()).sort((a,b) => a.sortValue - b.sortValue);

    const hubsData = Object.values(aggs).map(item => {
      const kpis = {
        dsTotal: {}, dsD0: {}, spr: {}, reut: {}, atPiso: {}, totalCarregado: {}, driversUnicos: {},
        ofertasTotais: {}, ofertasMoto: {}, ofertasPasseio: {}, ofertasUtil: {}, ofertasVan: {}
      };
      timeColumns.forEach(tc => {
        const tk = tc.id;
        const td = item.timeData[tk];
        if (!td) {
           kpis.dsTotal[tk] = null; kpis.dsD0[tk] = null; kpis.spr[tk] = null;
           kpis.reut[tk] = null; kpis.atPiso[tk] = null; kpis.totalCarregado[tk] = null; kpis.driversUnicos[tk] = null;
           kpis.ofertasTotais[tk] = null; kpis.ofertasMoto[tk] = null; kpis.ofertasPasseio[tk] = null; kpis.ofertasUtil[tk] = null; kpis.ofertasVan[tk] = null;
           return;
        }
        kpis.dsTotal[tk] = td.sumE > 0 ? Number(((td.sumF / td.sumE) * 100).toFixed(2)) : null;
        kpis.dsD0[tk] = td.countV > 0 ? Number((td.sumV / td.countV).toFixed(2)) : null;
        kpis.spr[tk] = td.countR > 0 ? Number((td.sumR / td.countR).toFixed(2)) : null;
        kpis.reut[tk] = td.countM > 0 ? Number((td.sumM / td.countM).toFixed(2)) : null;
        kpis.atPiso[tk] = td.countX > 0 ? Number((td.sumX / td.countX).toFixed(2)) : null;
        kpis.totalCarregado[tk] = td.sumG > 0 ? td.sumG : null;
        kpis.driversUnicos[tk] = td.sumH > 0 ? td.sumH : null;
        
        kpis.ofertasTotais[tk] = td.ofertasTotais > 0 ? td.ofertasTotais : null;
        kpis.ofertasMoto[tk] = td.ofertasMoto > 0 ? td.ofertasMoto : null;
        kpis.ofertasPasseio[tk] = td.ofertasPasseio > 0 ? td.ofertasPasseio : null;
        kpis.ofertasUtil[tk] = td.ofertasUtil > 0 ? td.ofertasUtil : null;
        kpis.ofertasVan[tk] = td.ofertasVan > 0 ? td.ofertasVan : null;
      });
      return { hub: item.hub, subRegional: item.subRegional, kpis };
    }).sort((a, b) => a.hub.localeCompare(b.hub));

    return { timeColumns, hubsData };
  }, [baseData, ofertasData, hubTimeView, selectedRegs, selectedHubs, permittedHubsSet, SANITIZED_REGIONAL_MAP, semanaFilter, mesFilter, dataInicio, dataFim]);

  const exportarHubCSV = () => {
    if (!hubDownload) return alert("Por favor, selecione um Hub antes de baixar.");
    const activeColumns = driverViewMode.includes('MONTH') ? processedDrivers.colMeses : processedDrivers.colSemanasFiltradas;
    if (!activeColumns || activeColumns.length === 0) return alert("Matriz vazia.");
    
    const hubRef = processedDrivers.hubsData.find(h => h.name === hubDownload);
    if (!hubRef) return alert("Nenhum dado filtrado correspondente para este Hub.");

    const colHeaders = activeColumns.map(c => c.label);
    const headersCSV = ["Driver ID", "Veículo", "SubRegional", "HUB", "Visão Exportada", ...colHeaders];
    
    const linhasCSV = hubRef.drivers.map(d => {
      const notasArr = activeColumns.map(col => {
        let val = null;
        if (driverViewMode === 'TOTAL') val = d.scoresTotal[col.id];
        else if (driverViewMode === 'D0') val = d.scoresD0[col.id];
        else if (driverViewMode === 'MONTH_TOTAL') val = d.scoresMesTotal[col.id];
        else if (driverViewMode === 'MONTH_D0') val = d.scoresMesD0[col.id];
        return val !== null ? `${val}%` : "-";
      });
      return [d.id, d.veiculo, d.regional, hubDownload, driverViewMode, ...notasArr].join(",");
    });

    const csvContent = "\uFEFF" + [headersCSV.join(","), ...linhasCSV].join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `DS_Condutores_${driverViewMode}_${hubDownload.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) return <div className="p-10 text-center animate-pulse font-black text-[#113366] text-xl tracking-widest mt-20">CONSOLIDANDO DADOS DE DS E HUB...</div>;

  const filteredRegsOptions = listRegs.filter(reg => sanitizeForSearch(reg).includes(sanitizeForSearch(regSearchTerm)));
  const filteredHubsOptions = listHubs.filter(hub => sanitizeForSearch(hub).includes(sanitizeForSearch(hubSearchTerm)));
  
  const showsEmptyState = selectedRegs.length === 0 && selectedHubs.length === 0 && !searchTerm && !veiculoFilter;
  const activeColumns = driverViewMode.includes('MONTH') ? processedDrivers.colMeses : processedDrivers.colSemanasFiltradas;

  const getFiltrosResumo = () => {
    let tags = [];
    if (selectedRegs.length > 0) tags.push(`${selectedRegs.length} Subregionais`);
    if (selectedHubs.length > 0) tags.push(`${selectedHubs.length} Hubs`);
    if (veiculoFilter) tags.push(`Veículo: ${veiculoFilter}`);
    if (searchTerm) tags.push(`ID: ${searchTerm}`);
    if (semanaFilter) tags.push(`Semana ${semanaFilter}`);
    if (mesFilter) {
      const mesNome = MESES.find(m => m.value === mesFilter)?.label;
      if (mesNome) tags.push(`Mês: ${mesNome}`);
    }
    if (dataInicio || dataFim) tags.push('Filtro Diário');

    if (tags.length === 0) return "Nenhum filtro ativo";
    return `Filtrando por: ${tags.join(" | ")}`;
  };

  return (
    <div className="flex flex-col h-full gap-4 animate-in fade-in duration-300">
      
      {/* CABEÇALHO DO PAINEL DE FILTROS E BOTÃO DE RECOLHER */}
      <div className="bg-white dark:bg-[#1f232d] rounded-2xl shadow-sm border border-slate-200 dark:border-gray-800 shrink-0 mt-4">
        <div 
          onClick={() => setFiltrosAbertos(!filtrosAbertos)}
          className="p-5 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 cursor-pointer hover:bg-slate-50/50 dark:hover:bg-gray-800/50 transition-colors rounded-t-2xl select-none"
        >
          <div>
            <h2 className="text-2xl font-black text-[#113366] dark:text-white uppercase tracking-tight flex items-center gap-2">
              <Award className="text-[#EE4D2D]" size={26} /> Delivery Success (DS)
            </h2>
            <p className="text-xs font-bold text-slate-400 uppercase mt-1 flex items-center gap-2">
              <span>Acompanhamento de performance na Malha e Condutor</span>
              {!filtrosAbertos && (
                <>
                  <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                  <span className="text-[#EE4D2D]">{getFiltrosResumo()}</span>
                </>
              )}
            </p>
          </div>
          
          <div className="flex items-center gap-3">
             <button 
                onClick={(e) => { e.stopPropagation(); limparTodosFiltros(); }} 
                className="flex items-center justify-center gap-1.5 bg-slate-100 dark:bg-gray-800 hover:bg-slate-200 dark:hover:bg-gray-700 text-slate-600 dark:text-gray-300 px-4 py-2 rounded-xl text-[11px] font-black uppercase transition-colors shadow-sm"
             >
                <Eraser size={14} /> Limpar Filtros
             </button>
             <button className="flex items-center justify-center gap-1.5 bg-[#113366] hover:bg-blue-900 text-white px-4 py-2 rounded-xl text-[11px] font-black uppercase transition-colors shadow-sm">
                {filtrosAbertos ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                {filtrosAbertos ? 'Recolher Painel' : 'Expandir Painel'}
             </button>
          </div>
        </div>

        {/* PAINEL DE CONTROLE / FILTROS GLOBAIS (CONTEÚDO SANFONA) */}
        {filtrosAbertos && (
          <div className="p-6 pt-0 flex flex-col gap-6 animate-in slide-in-from-top-4 duration-300">
            <div className="h-px w-full bg-slate-100 dark:bg-gray-800 mb-2"></div>
            
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                <div className="md:col-span-3 flex flex-col gap-2 relative" ref={dropdownRegRef}>
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

                <div className="md:col-span-3 flex flex-col gap-2 relative" ref={dropdownRef}>
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

                <div className="md:col-span-3 flex flex-col gap-2">
                    <label className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-1"><Truck size={12}/> 3. Modal / Veículo</label>
                    <select
                      value={veiculoFilter}
                      onChange={(e) => setVeiculoFilter(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-[#15171e] dark:text-white border border-slate-200 dark:border-gray-700 rounded-xl py-3 px-3 text-sm font-bold outline-none cursor-pointer"
                    >
                      <option value="">Todos os Modais</option>
                      {listVehicles.map(v => <option key={v} value={v}>{v}</option>)}
                    </select>
                </div>

                <div className="md:col-span-3 flex flex-col gap-2">
                    <label className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-1"><Search size={12}/> Busca Condutor</label>
                    <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} /><input type="text" placeholder="ID do Motorista..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full bg-slate-50 dark:bg-[#15171e] dark:text-white border border-slate-200 dark:border-gray-700 rounded-xl py-3 pl-10 pr-3 text-sm font-bold outline-none focus:ring-2 focus:ring-[#113366] transition-all"/></div>
                </div>
            </div>

            {/* LINHA 2 DE FILTROS: TEMPO */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 mt-2">
                <div className="md:col-span-3 flex flex-col gap-2">
                    <label className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-1"><CalendarDays size={12}/> 4. Semana</label>
                    <select
                      value={semanaFilter}
                      onChange={(e) => setSemanaFilter(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-[#15171e] dark:text-white border border-slate-200 dark:border-gray-700 rounded-xl py-3 px-3 text-sm font-bold outline-none cursor-pointer"
                    >
                      <option value="">Todas as Semanas</option>
                      {availableWeeks.map(w => <option key={w} value={w}>{w.replace('W', 'W-')}</option>)}
                    </select>
                </div>
                <div className="md:col-span-3 flex flex-col gap-2">
                    <label className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-1"><CalendarDays size={12}/> 5. Mês</label>
                    <select
                      value={mesFilter}
                      onChange={(e) => setMesFilter(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-[#15171e] dark:text-white border border-slate-200 dark:border-gray-700 rounded-xl py-3 px-3 text-sm font-bold outline-none cursor-pointer"
                    >
                      <option value="">Todos os Meses</option>
                      {MESES.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                    </select>
                </div>
                <div className="md:col-span-3 flex flex-col gap-2">
                    <label className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-1"><CalendarCheck size={12}/> 6. Data Início</label>
                    <input
                      type="date"
                      value={dataInicio}
                      onChange={(e) => setDataInicio(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-[#15171e] dark:text-white border border-slate-200 dark:border-gray-700 rounded-xl py-3 px-3 text-sm font-bold outline-none cursor-pointer"
                    />
                </div>
                <div className="md:col-span-3 flex flex-col gap-2">
                    <label className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-1 flex-wrap">
                       <CalendarCheck size={12} className="shrink-0"/> 7. Data Fim <span className="text-[#EE4D2D] normal-case text-[9px] font-bold ml-auto">(Apenas p/ Aba 2)</span>
                    </label>
                    <input
                      type="date"
                      value={dataFim}
                      onChange={(e) => setDataFim(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-[#15171e] dark:text-white border border-slate-200 dark:border-gray-700 rounded-xl py-3 px-3 text-sm font-bold outline-none cursor-pointer"
                    />
                </div>
            </div>
            
            {/* BANNER DE STORYTELLING */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-slate-50 dark:bg-[#15171e] p-5 rounded-xl border border-slate-200 dark:border-gray-700 mt-2">
              <div className="flex gap-3 items-start">
                <div className="p-2 bg-blue-50 dark:bg-blue-950/30 text-[#113366] dark:text-blue-400 rounded-lg shrink-0">
                  <Users size={16} />
                </div>
                <div className="flex flex-col gap-0.5">
                  <h4 className="text-xs font-black text-[#113366] dark:text-blue-400 uppercase tracking-wider">Visão 1: Performance de Condutores</h4>
                  <p className="text-xs text-slate-500 dark:text-gray-400 font-medium leading-relaxed mt-1">
                    Focado no microgerenciamento. A nota do Hub exibida na primeira aba é a <strong>Média Simples</strong> de todos os motoristas. O algoritmo não avalia o tamanho da rota (se o condutor levou 10 ou 100 pacotes, o peso da nota dele na média será exatamente o mesmo).
                  </p>
                </div>
              </div>

              <div className="flex gap-3 items-start border-t md:border-t-0 md:border-l border-slate-200 dark:border-gray-700 pt-4 md:pt-0 md:pl-6">
                <div className="p-2 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 rounded-lg shrink-0">
                  <Database size={16} />
                </div>
                <div className="flex flex-col gap-1">
                  <h4 className="text-xs font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Visão 2: KPIs Globais do Station</h4>
                  <p className="text-xs text-slate-500 dark:text-gray-400 font-medium leading-relaxed">
                    Focado no resultado oficial. O DS Total aqui é a <strong>Média Ponderada</strong>, calculada somando a volumetria bruta de pacotes (<em className="text-slate-600 dark:text-gray-300">Entregues ÷ Carregados</em>) da própria base de controle de PCP da malha. Essa é a métrica real do Hub, livre de distorções.
                  </p>
                </div>
              </div>

              <div className="flex gap-3 items-start border-t md:border-t-0 md:border-l border-slate-200 dark:border-gray-700 pt-4 md:pt-0 md:pl-6">
                <div className="p-2 bg-orange-50 dark:bg-orange-950/20 text-[#EE4D2D] rounded-lg shrink-0">
                  <Target size={16} />
                </div>
                <div className="flex flex-col gap-1">
                  <h4 className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-wider">Metas & Farol</h4>
                  <div className="flex flex-col gap-2 mt-2">
                    <span className="inline-flex items-center gap-2 text-[11px] font-bold text-slate-600 dark:text-gray-300">
                      <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-sm"></div> Meta DS Total: <strong className="text-slate-800 dark:text-white text-sm">98%</strong>
                    </span>
                    <span className="inline-flex items-center gap-2 text-[11px] font-bold text-slate-600 dark:text-gray-300">
                      <div className="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-sm"></div> Meta DS D-0: <strong className="text-slate-800 dark:text-white text-sm">95%</strong>
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* TOGGLE DE ABAS PRINCIPAIS */}
      <div className="flex border-b border-slate-200 dark:border-gray-800 mt-2">
        <button 
          onClick={() => setActiveTab('drivers')}
          className={`flex items-center gap-2 px-6 py-4 text-sm font-black uppercase transition-colors border-b-2 ${activeTab === 'drivers' ? 'border-[#EE4D2D] text-[#EE4D2D] bg-orange-50/50 dark:bg-orange-900/10' : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-gray-300'}`}
        >
          <Users size={18} /> Performance de Condutores
        </button>
        <button 
          onClick={() => setActiveTab('hubs')}
          className={`flex items-center gap-2 px-6 py-4 text-sm font-black uppercase transition-colors border-b-2 ${activeTab === 'hubs' ? 'border-[#113366] text-[#113366] dark:text-blue-400 bg-blue-50/50 dark:bg-blue-900/10' : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-gray-300'}`}
        >
          <LayoutDashboard size={18} /> KPIs do Station (Global)
        </button>
      </div>

      {/* =========================================================
          ABA 1: TABELA DE MOTORISTAS (SANFONA)
          ========================================================= */}
      {activeTab === 'drivers' && (
        <div className="flex flex-col gap-3 flex-1 relative min-h-[400px] animate-in fade-in slide-in-from-left-4 duration-300">
          
          <div className="flex flex-col xl:flex-row justify-between items-start xl:items-end gap-4">
            <div className={`flex flex-wrap items-center bg-white dark:bg-[#1f232d] p-1.5 rounded-xl w-fit shadow-sm border border-slate-200 dark:border-gray-800 transition-opacity ${showsEmptyState ? 'opacity-30 pointer-events-none' : 'opacity-100'}`}>
              <button onClick={() => setDriverViewMode('TOTAL')} className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-[11px] font-black uppercase transition-all ${driverViewMode === 'TOTAL' ? 'bg-[#113366] text-white shadow-md' : 'text-slate-500 hover:text-slate-700 dark:text-gray-400 dark:hover:text-white'}`}>
                <Award size={14}/> Semanal Total
              </button>
              <button onClick={() => setDriverViewMode('D0')} className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-[11px] font-black uppercase transition-all ${driverViewMode === 'D0' ? 'bg-[#EE4D2D] text-white shadow-md' : 'text-slate-500 hover:text-slate-700 dark:text-gray-400 dark:hover:text-white'}`}>
                <Zap size={14}/> Semanal D-0
              </button>
              <div className="w-[1px] h-6 bg-slate-200 dark:bg-gray-700 mx-1"></div>
              <button onClick={() => setDriverViewMode('MONTH_TOTAL')} className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-[11px] font-black uppercase transition-all ${driverViewMode === 'MONTH_TOTAL' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-700 dark:text-gray-400 dark:hover:text-white'}`}>
                <CalendarDays size={14}/> Mensal Total
              </button>
              <button onClick={() => setDriverViewMode('MONTH_D0')} className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-[11px] font-black uppercase transition-all ${driverViewMode === 'MONTH_D0' ? 'bg-orange-500 text-white shadow-md' : 'text-slate-500 hover:text-slate-700 dark:text-gray-400 dark:hover:text-white'}`}>
                <CalendarCheck size={14}/> Mensal D-0
              </button>
            </div>

            <div className={`flex items-center gap-3 bg-white dark:bg-[#1f232d] p-1.5 rounded-xl shadow-sm border border-slate-200 dark:border-gray-800 transition-opacity ${showsEmptyState ? 'opacity-30 pointer-events-none' : 'opacity-100'}`}>
              <select
                value={hubDownload}
                onChange={(e) => setHubDownload(e.target.value)}
                className="bg-slate-50 dark:bg-[#15171e] dark:text-white border border-slate-200 dark:border-gray-700 rounded-lg py-2 px-3 text-[11px] font-bold outline-none cursor-pointer min-w-[200px]"
              >
                <option value="">Selecione o Hub para Download...</option>
                {processedDrivers.hubsData.map(h => <option key={`dl-${h.name}`} value={h.name}>{h.name}</option>)}
              </select>
              <button
                onClick={exportarHubCSV}
                className="flex items-center gap-1.5 bg-[#EE4D2D] hover:bg-[#D0011B] text-white px-4 py-2 rounded-lg text-[11px] font-black uppercase transition-colors shadow-sm shrink-0"
              >
                <Download size={14} /> Baixar CSV
              </button>
            </div>
          </div>

          <div className="bg-white dark:bg-[#1f232d] rounded-2xl shadow-sm border border-slate-200 dark:border-gray-700 overflow-hidden flex flex-col flex-1 relative">
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
                    <thead className={driverViewMode.includes('MONTH') ? (driverViewMode === 'MONTH_TOTAL' ? 'bg-indigo-600 text-white' : 'bg-orange-500 text-white') : (driverViewMode === 'TOTAL' ? 'bg-[#113366] text-white' : 'bg-[#EE4D2D] text-white')}>
                    <tr className="tracking-widest text-[10px] uppercase font-black sticky top-0 z-20">
                        <th className="p-4 text-left min-w-[250px] shadow-sm">SUBREGIONAL / STATION / DRIVER</th>
                        <th className="p-4 shadow-sm">VEÍCULO</th>
                        {activeColumns.map(col => (
                          <th key={col.id} className="p-4 min-w-[85px] bg-white/10 border-l border-white/20 shadow-sm">{col.label}</th>
                        ))}
                    </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-100 dark:divide-gray-800 font-black text-sm relative z-0">
                    {processedDrivers.hubsData.length === 0 ? (
                        <tr><td colSpan={activeColumns.length + 2} className="p-10 text-center font-bold text-slate-400">Nenhum dado encontrado.</td></tr>
                    ) : (
                        processedDrivers.hubsData.map(hub => {
                        const isOpen = !!expandedHubs[hub.name];
                        return (
                            <React.Fragment key={hub.name}>
                            <tr onClick={() => toggleHub(hub.name)} className="cursor-pointer bg-slate-100/80 dark:bg-gray-800 hover:bg-orange-50 dark:hover:bg-gray-700 transition-colors h-[50px]">
                                <td className="p-4 text-left flex items-center gap-2 text-[#113366] dark:text-blue-400 font-black text-base border-r border-slate-200 dark:border-gray-700 h-[50px]">
                                  {isOpen ? <ChevronDown size={18} className="text-[#EE4D2D]"/> : <ChevronRight size={18} className="text-slate-400"/>}
                                  <MapPin size={16} className="text-[#EE4D2D] shrink-0" />
                                  {hub.name}
                                </td>
                                <td className="p-4 text-xs font-black text-[#113366] dark:text-white uppercase border-r border-slate-200 dark:border-gray-700 h-[50px] whitespace-nowrap">MÉDIA CONDUTORES</td>
                                {activeColumns.map(col => {
                                  let val = null;
                                  if (driverViewMode === 'TOTAL') val = hub.mediasTotal[col.id];
                                  else if (driverViewMode === 'D0') val = hub.mediasD0[col.id];
                                  else if (driverViewMode === 'MONTH_TOTAL') val = hub.mediasMesTotal[col.id];
                                  else if (driverViewMode === 'MONTH_D0') val = hub.mediasMesD0[col.id];

                                  return (
                                      <td key={col.id} className={`p-4 border-r border-slate-200 dark:border-gray-700 h-[50px] bg-slate-50/50 dark:bg-gray-800/50 text-slate-800 dark:text-gray-200`}>
                                        {renderSemaforo(val, driverViewMode.includes('D0'))}
                                      </td>
                                  );
                                })}
                            </tr>

                            {isOpen && hub.drivers.map(driver => (
                                <tr key={`${hub.name}-${driver.id}`} className="bg-white dark:bg-[#15171e] text-xs text-slate-600 dark:text-gray-400 transition-colors hover:bg-slate-50">
                                  <td className="p-3 text-left pl-12 font-black flex items-center gap-2 text-slate-800 dark:text-gray-200 border-r border-slate-100 dark:border-gray-800">
                                      <User size={13} className="text-slate-400 shrink-0" /> {driver.id}
                                  </td>
                                  <td className="p-3 font-bold uppercase text-[10px] text-slate-400 tracking-wider border-r border-slate-100 dark:border-gray-800 whitespace-nowrap">
                                      <span className="flex items-center justify-center gap-1"><Truck size={12}/> {driver.veiculo}</span>
                                  </td>
                                  
                                  {activeColumns.map(col => {
                                      let val = null;
                                      if (driverViewMode === 'TOTAL') val = driver.scoresTotal[col.id];
                                      else if (driverViewMode === 'D0') val = driver.scoresD0[col.id];
                                      else if (driverViewMode === 'MONTH_TOTAL') val = driver.scoresMesTotal[col.id];
                                      else if (driverViewMode === 'MONTH_D0') val = driver.scoresMesD0[col.id];

                                      return (
                                      <td key={col.id} className={`p-3 font-bold border-r border-slate-100 dark:border-gray-800 ${val !== null && val < 95 ? 'text-[#D0011B] font-black bg-red-50/20 dark:bg-red-900/5' : ''}`}>
                                          {renderSemaforo(val, driverViewMode.includes('D0'))}
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
      )}

      {/* =========================================================
          ABA 2: TABELA DE KPIs DO STATION (BASE DATA)
          ========================================================= */}
      {activeTab === 'hubs' && (
        <div className="flex flex-col gap-3 flex-1 relative min-h-[400px] animate-in fade-in slide-in-from-right-4 duration-300">
          
          <div className="flex justify-between items-end">
            <div className={`flex flex-wrap items-center bg-white dark:bg-[#1f232d] p-1.5 rounded-xl w-fit shadow-sm border border-slate-200 dark:border-gray-800 transition-opacity ${showsEmptyState ? 'opacity-30 pointer-events-none' : 'opacity-100'}`}>
              <button onClick={() => setHubTimeView('dia')} className={`flex items-center gap-1.5 px-6 py-2 rounded-lg text-[11px] font-black uppercase transition-all ${hubTimeView === 'dia' ? 'bg-[#113366] text-white shadow-md' : 'text-slate-500 hover:text-slate-700 dark:text-gray-400 dark:hover:text-white'}`}>
                Dia
              </button>
              <button onClick={() => setHubTimeView('semana')} className={`flex items-center gap-1.5 px-6 py-2 rounded-lg text-[11px] font-black uppercase transition-all ${hubTimeView === 'semana' ? 'bg-[#113366] text-white shadow-md' : 'text-slate-500 hover:text-slate-700 dark:text-gray-400 dark:hover:text-white'}`}>
                Semana
              </button>
              <button onClick={() => setHubTimeView('mes')} className={`flex items-center gap-1.5 px-6 py-2 rounded-lg text-[11px] font-black uppercase transition-all ${hubTimeView === 'mes' ? 'bg-[#113366] text-white shadow-md' : 'text-slate-500 hover:text-slate-700 dark:text-gray-400 dark:hover:text-white'}`}>
                Mês
              </button>
            </div>
          </div>

          <div className="bg-white dark:bg-[#1f232d] rounded-2xl shadow-sm border border-[#113366] overflow-hidden flex flex-col flex-1 relative">
            {showsEmptyState ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-50/80 dark:bg-gray-900/80 backdrop-blur-sm z-10 p-6">
                    <div className="bg-white dark:bg-[#1f232d] p-8 rounded-2xl shadow-xl flex flex-col items-center text-center max-w-md border border-slate-200 dark:border-gray-700">
                        <AlertCircle size={48} className="text-[#EE4D2D] mb-4" />
                        <h3 className="text-xl font-black text-[#113366] dark:text-white uppercase mb-2">Aguardando Filtro</h3>
                        <p className="text-sm font-bold text-slate-500 dark:text-gray-400 leading-relaxed">
                            Selecione uma Subregional ou Station para visualizar os KPIs globais do Hub.
                        </p>
                    </div>
                </div>
            ) : (
                <div className="overflow-x-auto w-full h-full custom-scrollbar">
                  <table className="w-full border-collapse text-center">
                      <thead className="bg-[#113366] text-white">
                        <tr className="tracking-widest text-[10px] uppercase font-black">
                            {/* Canto superior esquerdo: Fixado no Topo E na Esquerda (Z-50) */}
                            <th className="p-4 text-left shadow-sm min-w-[250px] sticky left-0 top-0 bg-[#113366] z-50 border-r border-white/20">
                                STATION (HUB) / KPI
                            </th>
                            <th className="p-4 shadow-sm border-r border-white/20 sticky left-[250px] top-0 bg-[#113366] z-50">
                                VISÃO
                            </th>
                            
                            {/* Datas na horizontal: Fixadas apenas no Topo (Z-40) */}
                            {processedHubKPIs.timeColumns.map(col => (
                               <th key={col.id} className="p-4 shadow-sm border-r border-white/20 min-w-[85px] sticky top-0 bg-[#113366] z-40">
                                   {col.label}
                               </th>
                            ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-gray-800 font-black text-sm relative z-0">
                        {processedHubKPIs.hubsData.length === 0 ? (
                            <tr><td colSpan={processedHubKPIs.timeColumns.length + 2} className="p-10 text-center font-bold text-slate-400">Nenhum dado encontrado para o período.</td></tr>
                        ) : (
                            processedHubKPIs.hubsData.map((row) => {
                              const isOpen = !!expandedHubs[row.hub];
                              return (
                                <React.Fragment key={row.hub}>
                                  <tr onClick={() => toggleHub(row.hub)} className="cursor-pointer bg-slate-100 dark:bg-gray-800 hover:bg-orange-50 dark:hover:bg-gray-700 transition-colors h-[50px]">
                                     <td className="p-4 text-left text-[#113366] dark:text-blue-400 font-black border-r border-slate-200 dark:border-gray-700 flex items-center gap-2 sticky left-0 z-20 bg-slate-100 dark:bg-gray-800">
                                       {isOpen ? <ChevronDown size={18} className="text-[#EE4D2D]"/> : <ChevronRight size={18} className="text-slate-400"/>}
                                       <Layers size={16} className="text-[#EE4D2D] shrink-0" />
                                       <span className="truncate" title={row.hub}>{row.hub}</span>
                                     </td>
                                     <td className="p-4 text-xs font-black text-[#113366] dark:text-white uppercase border-r border-slate-200 dark:border-gray-700 sticky left-[250px] z-20 bg-slate-100 dark:bg-gray-800">TOTAL STATION</td>
                                     {processedHubKPIs.timeColumns.map(col => (
                                        <td key={col.id} className="p-4 border-r border-slate-200 dark:border-gray-700 bg-slate-50/50 dark:bg-gray-800/50">-</td>
                                     ))}
                                  </tr>

                                  {isOpen && [
                                     { key: 'dsTotal', label: 'Delivery Success (Total)', format: 'semaforo', isD0: false },
                                     { key: 'dsD0', label: 'Delivery Success (D-0)', format: 'semaforo', isD0: true },
                                     { key: 'spr', label: 'Aderência SPR', format: 'percent', color: 'text-[#113366] dark:text-blue-400' },
                                     { key: 'reut', label: 'Reutilização', format: 'percent', color: 'text-indigo-600 dark:text-indigo-400' },
                                     { key: 'atPiso', label: '% AT no Piso', format: 'percent', color: 'text-orange-500' },
                                     { key: 'totalCarregado', label: 'Total Carregado', format: 'number', color: 'text-slate-700 dark:text-slate-300' },
                                     { key: 'driversUnicos', label: 'Drivers Únicos', format: 'number', color: 'text-slate-700 dark:text-slate-300' },
                                     { key: 'ofertasTotais', label: 'Ofertas de Drivers', format: 'expandable', color: 'text-[#113366] dark:text-blue-400' }
                                  ].map(kpi => {
                                      if (kpi.format === 'expandable') {
                                          const isOfExpanded = !!expandedOfertas[row.hub];
                                          return (
                                              <React.Fragment key={`${row.hub}-${kpi.key}`}>
                                                  <tr onClick={(e) => { e.stopPropagation(); toggleOfertas(row.hub); }} className="bg-slate-50 dark:bg-[#1a1d24] hover:bg-slate-100 dark:hover:bg-gray-800/50 transition-colors cursor-pointer">
                                                      <td className="p-3 text-left pl-12 font-black text-slate-800 dark:text-gray-200 border-r border-slate-100 dark:border-gray-800 sticky left-0 z-20 bg-slate-50 dark:bg-[#1a1d24] flex items-center gap-1.5">
                                                          {isOfExpanded ? <ChevronDown size={14} className="text-[#EE4D2D]"/> : <ChevronRight size={14} className="text-slate-400"/>}
                                                          {kpi.label}
                                                      </td>
                                                      <td className="p-3 font-bold uppercase text-[10px] text-slate-400 tracking-wider border-r border-slate-100 dark:border-gray-800 sticky left-[250px] z-20 bg-slate-50 dark:bg-[#1a1d24]">KPI</td>
                                                      {processedHubKPIs.timeColumns.map(col => {
                                                          const val = row.kpis[kpi.key][col.id];
                                                          return <td key={col.id} className="p-3 border-r border-slate-100 dark:border-gray-800">{val ? <span className={`font-black ${kpi.color}`}>{val.toLocaleString('pt-BR')}</span> : '-'}</td>;
                                                      })}
                                                  </tr>
                                                  {isOfExpanded && [
                                                      { key: 'ofertasMoto', label: '↳ Moto' },
                                                      { key: 'ofertasPasseio', label: '↳ Passeio' },
                                                      { key: 'ofertasUtil', label: '↳ Utilitário' },
                                                      { key: 'ofertasVan', label: '↳ Van' }
                                                  ].map(subKpi => (
                                                      <tr key={`${row.hub}-${subKpi.key}`} className="bg-white dark:bg-[#15171e] hover:bg-slate-50 dark:hover:bg-gray-800/50 transition-colors">
                                                          <td className="p-3 text-left pl-20 font-bold text-slate-600 dark:text-gray-400 border-r border-slate-100 dark:border-gray-800 sticky left-0 z-20 bg-white dark:bg-[#15171e]">{subKpi.label}</td>
                                                          <td className="p-3 font-bold uppercase text-[10px] text-slate-400 tracking-wider border-r border-slate-100 dark:border-gray-800 sticky left-[250px] z-20 bg-white dark:bg-[#15171e]">MODAL</td>
                                                          {processedHubKPIs.timeColumns.map(col => {
                                                              const val = row.kpis[subKpi.key][col.id];
                                                              return <td key={col.id} className="p-3 border-r border-slate-100 dark:border-gray-800 font-bold text-slate-700 dark:text-gray-300">{val ? val.toLocaleString('pt-BR') : '-'}</td>;
                                                          })}
                                                      </tr>
                                                  ))}
                                              </React.Fragment>
                                          );
                                      }

                                      return (
                                        <tr key={`${row.hub}-${kpi.key}`} className="bg-white dark:bg-[#15171e] hover:bg-slate-50 dark:hover:bg-gray-800/50 transition-colors">
                                           <td className="p-3 text-left pl-12 font-black text-slate-800 dark:text-gray-200 border-r border-slate-100 dark:border-gray-800 sticky left-0 z-20 bg-white dark:bg-[#15171e]">{kpi.label}</td>
                                           <td className="p-3 font-bold uppercase text-[10px] text-slate-400 tracking-wider border-r border-slate-100 dark:border-gray-800 sticky left-[250px] z-20 bg-white dark:bg-[#15171e]">KPI</td>
                                           {processedHubKPIs.timeColumns.map(col => {
                                               const val = row.kpis[kpi.key][col.id];
                                               if (val === null || val === undefined) return <td key={col.id} className="p-3 border-r border-slate-100 dark:border-gray-800">-</td>;

                                               let content;
                                               if (kpi.format === 'semaforo') {
                                                   content = renderSemaforo(val, kpi.isD0 ? 'D0' : 'TOTAL'); 
                                               } else if (kpi.format === 'percent') {
                                                   content = <span className={`font-black ${kpi.color}`}>{val}%</span>;
                                               } else if (kpi.format === 'number') {
                                                   content = <span className={`font-black ${kpi.color}`}>{val.toLocaleString('pt-BR')}</span>;
                                               }
                                               return <td key={col.id} className={`p-3 border-r border-slate-100 dark:border-gray-800 ${kpi.format === 'semaforo' && val < 95 ? 'bg-red-50/20 dark:bg-red-900/5' : ''}`}>{content}</td>;
                                           })}
                                        </tr>
                                      );
                                  })}
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
      )}

    </div>
  );
}