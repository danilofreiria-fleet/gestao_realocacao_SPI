import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  Filter, MapPin, Database, TrendingUp, Maximize2, Minimize2, 
  BarChart3, Truck, PieChart, Layers, Lightbulb, CalendarDays, Check, ChevronDown, Search, X
} from 'lucide-react';
import { 
  ResponsiveContainer, ComposedChart, BarChart, Bar, Line, AreaChart, Area, 
  PieChart as RechartsPie, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, LabelList 
} from 'recharts';

import { MAPA_REGIONAL_COMPLETO } from '../../constants/regionais';

// 🔥 VACINA INJETADA: HIGIENIZADOR INTELIGENTE DE HUBS
const padronizarHubLocal = (nome) => {
  if (!nome) return "";
  let n = String(nome).trim();
  let nLimpo = n.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, '');
  if (nLimpo.includes("ribeiraopretoesta")) return "LM Hub_SP_RibeirãoPretoEstaça";
  if (nLimpo.includes("sumare") && nLimpo.includes("veneza")) return "LM Hub_SP_Sumaré_Nova Veneza";
  return n;
};

// ============================================================================
// FORMATADORES NUMÉRICOS
// ============================================================================
const formatInt = (v) => new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 }).format(v);
const formatK = (v) => v >= 1000 ? (v / 1000).toFixed(1).replace('.0', '') + 'k' : formatInt(v);
const formatPct = (v) => v.toFixed(1) + '%';

// ============================================================================
// COMPONENTE WRAPPER PARA OS GRÁFICOS
// ============================================================================
const ChartCard = ({ title, subtitle, icon: Icon, children }) => {
  const [periodo, setPeriodo] = useState('semana');
  const [isFullScreen, setIsFullScreen] = useState(false);

  const cardContent = (
    <div className={`bg-white dark:bg-[#1f232d] rounded-2xl shadow-sm border border-slate-200 dark:border-gray-800 flex flex-col transition-all ${isFullScreen ? 'fixed inset-4 z-[9999] p-8' : 'h-[420px] p-6'}`}>
      <div className="flex justify-between items-start mb-4 border-b border-slate-100 dark:border-gray-800 pb-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-slate-50 dark:bg-gray-800 rounded-lg text-[#113366] dark:text-blue-400">
            <Icon size={20} />
          </div>
          <div>
            <h3 className="font-black text-[#113366] dark:text-white uppercase text-sm md:text-base leading-tight">{title}</h3>
            {subtitle && <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{subtitle}</p>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-slate-100 dark:bg-[#15171e] p-1 rounded-lg border border-slate-200 dark:border-gray-700">
            {['dia', 'semana', 'mes'].map((p) => (
              <button key={p} onClick={() => setPeriodo(p)} className={`px-3 py-1 rounded text-[10px] font-black uppercase transition-all ${periodo === p ? 'bg-[#113366] text-white shadow-sm' : 'text-slate-500 hover:text-[#113366]'}`}>
                {p === 'dia' ? 'Dia' : p === 'semana' ? 'Sem' : 'Mês'}
              </button>
            ))}
          </div>
          <button onClick={() => setIsFullScreen(!isFullScreen)} className="text-slate-400 hover:text-[#EE4D2D] p-1.5 bg-slate-50 dark:bg-gray-800 rounded-lg ml-2">
            {isFullScreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
        </div>
      </div>
      <div className="flex-1 w-full overflow-hidden relative">
        {typeof children === 'function' ? children({ periodo }) : children}
      </div>
    </div>
  );

  return isFullScreen ? (
    <div className="fixed inset-0 z-[9998] bg-slate-900/80 backdrop-blur-sm">{cardContent}</div>
  ) : cardContent;
};

// ============================================================================
// DROPDOWN MULTISSELEÇÃO ESTILIZADO
// ============================================================================
const MultiSelectFilter = ({ label, options, selectedValues, onToggle, onSelectAll, onClear, hasSearch = false }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) setIsOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredOptions = options.filter(opt => opt.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="flex flex-col relative w-full" ref={containerRef}>
      <label className="text-[10px] font-black text-slate-400 uppercase mb-1 flex items-center gap-1">
        {label} {selectedValues.length > 0 && <span className="text-[#EE4D2D]">({selectedValues.length})</span>}
      </label>
      <div onClick={() => setIsOpen(!isOpen)} className="bg-white dark:bg-[#15171e] border border-slate-200 dark:border-gray-700 rounded-lg p-2 text-xs font-bold text-[#113366] dark:text-white cursor-pointer flex justify-between items-center shadow-sm hover:border-[#113366] transition-all h-9">
        <span className="truncate pr-2">
          {selectedValues.length === 0 ? "Todos" : selectedValues.length === options.length ? "Todos" : selectedValues.join(", ")}
        </span>
        <ChevronDown size={14} className={`text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </div>

      {isOpen && (
        <div className="absolute top-[100%] left-0 w-full mt-1 bg-white dark:bg-[#1f232d] border border-slate-200 dark:border-gray-700 rounded-xl shadow-2xl z-[100] py-2 overflow-hidden flex flex-col">
          {hasSearch && (
            <div className="px-2 mb-2">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" size={12} />
                <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full bg-slate-50 dark:bg-gray-800 text-[11px] pl-7 pr-2 py-1.5 rounded-md border-none outline-none dark:text-white" placeholder="Pesquisar..." />
              </div>
            </div>
          )}
          <div className="flex justify-between px-3 py-1 border-b border-slate-100 dark:border-gray-800 mb-1">
            <button onClick={onSelectAll} className="text-[10px] font-black text-blue-600 uppercase hover:underline">Todos</button>
            <button onClick={onClear} className="text-[10px] font-black text-red-500 uppercase hover:underline">Limpar</button>
          </div>
          <div className="max-h-48 overflow-y-auto custom-scrollbar">
            {filteredOptions.map(opt => (
              <div key={opt} onClick={() => onToggle(opt)} className="flex items-center justify-between px-3 py-2 hover:bg-slate-50 dark:hover:bg-gray-800 cursor-pointer transition-colors">
                <span className={`text-xs ${selectedValues.includes(opt) ? 'font-black text-[#EE4D2D]' : 'font-medium text-slate-600 dark:text-gray-300'}`}>{opt}</span>
                {selectedValues.includes(opt) && <Check size={14} className="text-[#EE4D2D]" />}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// DATA PADRÃO (4 SEMANAS)
// ============================================================================
const getInitialDates = () => {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(endDate.getDate() - 28);
  const fmt = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return { dataInicio: fmt(startDate), dataFim: fmt(endDate) };
};

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================
export default function EstudosCapacidade({ consolidadoData, baseData }) {
  const [filtros, setFiltros] = useState({ regional: [], station: [], turno: [], modal: [], ...getInitialDates() });
  const [tipoVisao, setTipoVisao] = useState('absoluto');

  const COL = { DATA: 3, STATION: 4, TURNO: 5, REGIONAL: 1, AT_ROT: 11, VOL_ROT: 12, VOL_PROC: 13, VOL_EXP: 14, OFERTA_TOTAL: 24, ROTAS_EXP: 29, RECUSAS: 35 };

  const parseDate = (val) => {
    if (!val) return new Date(0);
    if (val instanceof Date) return val;
    let str = String(val).trim().split(' ')[0];
    if (str.includes('/')) {
      let [dia, mes, ano] = str.split('/');
      return new Date(`${ano.length === 2 ? '20'+ano : ano}-${mes.padStart(2,'0')}-${dia.padStart(2,'0')}T12:00:00`);
    }
    return new Date(str);
  };

  const getISOWeek = (dObj) => {
    const d = new Date(dObj.getTime());
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return `W-${String(Math.ceil((((d - yearStart) / 86400000) + 1) / 7)).padStart(2, '0')}`;
  };

  const toggleFiltro = (chave, valor) => {
    setFiltros(prev => ({
      ...prev, [chave]: prev[chave].includes(valor) ? prev[chave].filter(v => v !== valor) : [...prev[chave], valor]
    }));
  };

  // --- 🔥 GERAÇÃO DINÂMICA DE OPÇÕES (ISOLAMENTO DE REGIONAL GARANTIDO) ---
  const opcoes = useMemo(() => {
    const regionaisSet = new Set();
    const stationsSet = new Set();

    if (consolidadoData) {
      consolidadoData.forEach(row => {
        const st = padronizarHubLocal(row[COL.STATION]);
        const reg = MAPA_REGIONAL_COMPLETO[st] || String(row[COL.REGIONAL]).trim();
        if (reg && reg !== 'undefined' && reg !== 'Regional') regionaisSet.add(reg);
        if (st && st !== 'undefined' && st !== 'Station') stationsSet.add(st);
      });
    }

    let hubsFiltrados = Array.from(stationsSet);
    if (filtros.regional.length > 0) {
      hubsFiltrados = hubsFiltrados.filter(h => filtros.regional.includes(MAPA_REGIONAL_COMPLETO[h]));
    }

    return { 
      regionais: Array.from(regionaisSet).sort(), 
      stations: hubsFiltrados.sort(), 
      turnos: ['AM', 'PM1', 'PM2'], 
      modais: ['Utilitário', 'Passeio', 'Moto', 'Van'] 
    };
  }, [consolidadoData, filtros.regional]);

  // --- PROCESSAMENTO PRINCIPAL ---
  const processedData = useMemo(() => {
    if (!consolidadoData || consolidadoData.length === 0) return null;

    const dataStart = filtros.dataInicio ? new Date(filtros.dataInicio + 'T00:00:00') : null;
    const dataEnd = filtros.dataFim ? new Date(filtros.dataFim + 'T23:59:59') : null;

    const mapBaseCaps = {};
    if (baseData) {
      baseData.forEach(r => {
        const stClean = padronizarHubLocal(r[0]).toLowerCase();
        const key = `${stClean}|${String(r[1]).trim().toLowerCase()}`;
        mapBaseCaps[key] = { capHub: Number(r[2]) || 0, capFleet: Number(r[3]) || 0 };
      });
    }

    let kpiAtual = { volProc: 0, volExp: 0, capHub: 0, capFleet: 0, dias: new Set() };
    let kpiAnterior = { volProc: 0, volExp: 0, capHub: 0, capFleet: 0, dias: new Set() };
    const aggs = { dia: {}, semana: {}, mes: {} };

    consolidadoData.forEach(row => {
      const dObj = parseDate(row[COL.DATA]);
      if (isNaN(dObj.getTime()) || dObj.getTime() === 0) return;

      const st = padronizarHubLocal(row[COL.STATION]);
      const reg = MAPA_REGIONAL_COMPLETO[st] || String(row[COL.REGIONAL]).trim();
      const tur = String(row[COL.TURNO]).trim();

      if (filtros.regional.length > 0 && !filtros.regional.includes(reg)) return;
      if (filtros.station.length > 0 && !filtros.station.includes(st)) return;
      if (filtros.turno.length > 0 && !filtros.turno.includes(tur)) return;

      const isPeriodoAtual = (!dataStart || dObj >= dataStart) && (!dataEnd || dObj <= dataEnd);
      const isPeriodoAnterior = filtros.dataInicio 
        ? (dObj >= new Date(dataStart.getTime() - (dataEnd - dataStart)) && dObj < dataStart)
        : (dObj >= new Date(new Date().setDate(new Date().getDate() - 28)) && dObj < new Date(new Date().setDate(new Date().getDate() - 14)));

      const vProc = Number(row[COL.VOL_PROC]) || 0;
      const vExp = Number(row[COL.VOL_EXP]) || 0;
      const vRot = Number(row[COL.VOL_ROT]) || 0;
      const rRot = Number(row[COL.AT_ROT]) || 0;
      const rExp = Number(row[COL.ROTAS_EXP]) || 0;
      const recusas = Number(row[COL.RECUSAS]) || 0;
      const dispo = Number(row[COL.OFERTA_TOTAL]) || 0;

      const keyBase = `${st.toLowerCase()}|${tur.toLowerCase()}`;
      const caps = mapBaseCaps[keyBase] || { capHub: 0, capFleet: 0 };
      
      const kDia = `${String(dObj.getDate()).padStart(2,'0')}/${String(dObj.getMonth()+1).padStart(2,'0')}`;

      if (isPeriodoAtual) {
        kpiAtual.volProc += vProc; kpiAtual.volExp += vExp;
        kpiAtual.capHub += caps.capHub; kpiAtual.capFleet += caps.capFleet;
        kpiAtual.dias.add(kDia);
      }
      if (isPeriodoAnterior) {
        kpiAnterior.volProc += vProc; kpiAnterior.volExp += vExp;
        kpiAnterior.capHub += caps.capHub; kpiAnterior.capFleet += caps.capFleet;
        kpiAnterior.dias.add(kDia);
      }

      if (!isPeriodoAtual) return;

      const kSem = getISOWeek(dObj);
      const kMes = ['JAN','FEV','MAR','ABR','MAI','JUN','JUL','AGO','SET','OUT','NOV','DEZ'][dObj.getMonth()];

      [{k: kDia, obj: aggs.dia, s: dObj.getTime()}, {k: kSem, obj: aggs.semana, s: dObj.getFullYear()*100+parseInt(kSem.replace('W-',''))}, {k: kMes, obj: aggs.mes, s: dObj.getMonth()}].forEach(t => {
        if (!t.obj[t.k]) t.obj[t.k] = { name: t.k, sort: t.s, volProc: 0, volExp: 0, volRot: 0, capFleet: 0, capHub: 0, rotasRot: 0, rotasExp: 0, recusas: 0, disponiveis: 0, dias: new Set() };
        t.obj[t.k].volProc += vProc; t.obj[t.k].volExp += vExp; t.obj[t.k].volRot += vRot;
        t.obj[t.k].capFleet += caps.capFleet; t.obj[t.k].capHub += caps.capHub;
        t.obj[t.k].rotasRot += rRot; t.obj[t.k].rotasExp += rExp;
        t.obj[t.k].recusas += recusas; t.obj[t.k].disponiveis += dispo;
        t.obj[t.k].dias.add(kDia);
      });
    });

    const isMedia = tipoVisao === 'media';
    const divAtual = isMedia ? Math.max(1, kpiAtual.dias.size) : 1;
    const divAnt = isMedia ? Math.max(1, kpiAnterior.dias.size) : 1;
    
    const formattedKpiAtual = {
      volProc: Math.round(kpiAtual.volProc / divAtual),
      volExp: Math.round(kpiAtual.volExp / divAtual),
      capHub: Math.round(kpiAtual.capHub / divAtual),
      capFleet: Math.round(kpiAtual.capFleet / divAtual),
    };
    const formattedKpiAnterior = {
      volProc: Math.round(kpiAnterior.volProc / divAnt),
      volExp: Math.round(kpiAnterior.volExp / divAnt),
      capHub: Math.round(kpiAnterior.capHub / divAnt),
      capFleet: Math.round(kpiAnterior.capFleet / divAnt),
    };

    const format = (o) => Object.values(o).sort((a,b) => a.sort - b.sort).map(d => {
      const div = isMedia ? Math.max(1, d.dias.size) : 1;
      const vP = Math.round(d.volProc / div);
      const cF = Math.round(d.capFleet / div);
      return {
        ...d, 
        volProc: vP,
        volExp: Math.round(d.volExp / div),
        volRot: Math.round(d.volRot / div),
        capFleet: cF,
        capHub: Math.round(d.capHub / div),
        rotasRot: Math.round(d.rotasRot / div),
        rotasExp: Math.round(d.rotasExp / div),
        recusas: Math.round(d.recusas / div),
        disponiveis: Math.round(d.disponiveis / div),
        utilPct: cF > 0 ? (vP / cF) * 100 : 0
      };
    });

    const aggsFormatados = { dia: format(aggs.dia), semana: format(aggs.semana), mes: format(aggs.mes) };

    const wowData = aggsFormatados.semana.map((sem, idx, arr) => {
      const prev = arr[idx - 1];
      return {
        name: sem.name,
        varProc: prev && prev.volProc > 0 ? ((sem.volProc - prev.volProc) / prev.volProc) * 100 : 0,
        varExp: prev && prev.volExp > 0 ? ((sem.volExp - prev.volExp) / prev.volExp) * 100 : 0,
      };
    });

    let diasAbaixo = 0, diasAte110 = 0, diasEstouro = 0;
    aggsFormatados.dia.forEach(d => {
      if (d.capFleet === 0) return;
      if (d.utilPct <= 100) diasAbaixo++;
      else if (d.utilPct <= 110) diasAte110++;
      else diasEstouro++;
    });
    const distPie = [
      { name: '< 100%', value: diasAbaixo, fill: '#10b981' }, 
      { name: '100% - 110%', value: diasAte110, fill: '#f59e0b' },  
      { name: '> 110%', value: diasEstouro, fill: '#ef4444' }       
    ].filter(i => i.value > 0);

    return { kpiAtual: formattedKpiAtual, kpiAnterior: formattedKpiAnterior, aggs: aggsFormatados, wowData, distPie };
  }, [consolidadoData, baseData, filtros, tipoVisao]);

  if (!processedData) return <div className="p-10 text-center text-slate-400 font-bold">Nenhum dado encontrado para os filtros.</div>;

  const { kpiAtual, kpiAnterior, aggs, wowData, distPie } = processedData;

  const calcVar = (a, b) => (b > 0 ? ((a - b) / b) * 100 : 0);
  const excedente = kpiAtual.volProc > kpiAtual.capFleet ? kpiAtual.volProc - kpiAtual.capFleet : 0;
  
  const semanasEstouradas = aggs.semana.filter(s => s.utilPct > 110).length;
  let picoSemana = { name: '-', utilPct: 0 };
  aggs.semana.forEach(s => { if (s.utilPct > picoSemana.utilPct) picoSemana = s; });
  const crescUltimaSemana = wowData.length > 0 ? wowData[wowData.length - 1].varProc : 0;

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white dark:bg-[#1f232d] p-3 rounded-lg shadow-xl border border-slate-200 dark:border-gray-800 z-50">
          <p className="font-black text-[#113366] dark:text-white mb-2 pb-2 border-b border-slate-100 dark:border-gray-700">{label}</p>
          {payload.map((entry, index) => {
            const isPct = entry.name.includes('%') || entry.name.includes('Var');
            const val = isPct ? formatPct(entry.value) : formatInt(entry.value);
            return (
              <p key={index} style={{ color: entry.color }} className="font-bold text-xs py-0.5 flex justify-between gap-4">
                <span>{entry.name}:</span><span>{val}</span>
              </p>
            );
          })}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="flex flex-col gap-6 pb-10 mt-6 animate-in fade-in duration-700">
      
      {/* SEÇÃO DE FILTROS E BANNER DE STORYTELLING */}
      <div className="bg-white dark:bg-[#1f232d] rounded-2xl border border-slate-200 dark:border-gray-800 p-6 shadow-sm flex flex-col gap-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-50 dark:bg-orange-950/20 text-[#EE4D2D] rounded-xl"><Layers size={24}/></div>
            <h2 className="text-xl font-black text-[#113366] dark:text-white uppercase tracking-tight">Estudos de Capacidade & Saturação</h2>
          </div>
          
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex bg-slate-100 dark:bg-[#15171e] p-1 rounded-lg border border-slate-200 dark:border-gray-700">
              <button onClick={() => setTipoVisao('absoluto')} className={`px-4 py-1.5 rounded text-[10px] font-black uppercase transition-all ${tipoVisao === 'absoluto' ? 'bg-[#113366] text-white shadow-sm' : 'text-slate-500 hover:text-[#113366]'}`}>Valores Absolutos</button>
              <button onClick={() => setTipoVisao('media')} className={`px-4 py-1.5 rounded text-[10px] font-black uppercase transition-all ${tipoVisao === 'media' ? 'bg-[#113366] text-white shadow-sm' : 'text-slate-500 hover:text-[#113366]'}`}>Média Diária</button>
            </div>
            <button onClick={() => setFiltros({regional:[], station:[], turno:[], modal:[], ...getInitialDates()})} className="text-[10px] font-black text-slate-400 uppercase hover:text-[#EE4D2D] flex items-center gap-1 transition-colors">
              <X size={14}/> Limpar Filtros
            </button>
          </div>
        </div>

        {/* BANNER DE STORYTELLING PARA GESTÃO INTEGRADO NO TOPO */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 bg-slate-50 dark:bg-[#15171e] p-5 rounded-xl border border-slate-200 dark:border-gray-700">
          <div className="flex gap-3 items-start">
            <div className="p-2 bg-blue-50 dark:bg-blue-950/30 text-[#113366] dark:text-blue-400 rounded-lg shrink-0">
              <Database size={16} />
            </div>
            <div className="flex flex-col gap-1">
              <h4 className="text-[11px] font-black text-slate-800 dark:text-white uppercase tracking-wider">Origem dos Dados</h4>
              <p className="text-[11px] text-slate-500 dark:text-gray-400 font-medium leading-relaxed">
                Este painel cruza os volumes reais coletados na aba <strong>CONSOLIDADO-GESTÃO-SPI_REALOCAÇÃO</strong> com o planejamento matricial de dimensionamento cadastrado na aba <strong>BASE</strong>.
              </p>
            </div>
          </div>

          <div className="flex gap-3 items-start border-t lg:border-t-0 lg:border-l border-slate-200 dark:border-gray-700 pt-4 lg:pt-0 lg:pl-6">
            <div className="p-2 bg-orange-50 dark:bg-orange-950/20 text-[#EE4D2D] rounded-lg shrink-0">
              <BarChart3 size={16} />
            </div>
            <div className="flex flex-col gap-1">
              <h4 className="text-[11px] font-black text-slate-800 dark:text-white uppercase tracking-wider">Modos de Apresentação</h4>
              <p className="text-[11px] text-slate-500 dark:text-gray-400 font-medium leading-relaxed">
                Alterne entre <strong>Valores Absolutos</strong> para mensurar o volume bruto acumulado ou <strong>Média Diária</strong> para obter visões normalizadas por dia de operação, eliminando distorções de feriados.
              </p>
            </div>
          </div>

          <div className="flex gap-3 items-start border-t lg:border-t-0 lg:border-l border-slate-200 dark:border-gray-700 pt-4 lg:pt-0 lg:pl-6">
            <div className="p-2 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 rounded-lg shrink-0">
              <Lightbulb size={16} />
            </div>
            <div className="flex flex-col gap-1">
              <h4 className="text-[11px] font-black text-slate-800 dark:text-white uppercase tracking-wider">Dicas de Utilização</h4>
              <p className="text-[11px] text-slate-500 dark:text-gray-400 font-medium leading-relaxed">
                Por padrão, o painel foca nas <strong>últimas 4 semanas</strong> agrupadas por <strong>Semana</strong>. Use os toggles de tempo em cada gráfico para detalhar a evolução diária ou mensal e audite métricas exatas.
              </p>
            </div>
          </div>
        </div>

        {/* CONTROLES DOS FILTROS GRIDS */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4 border-t border-slate-100 dark:border-gray-800 pt-4">
          <MultiSelectFilter label="Subregional" options={opcoes.regionais} selectedValues={filtros.regional} onToggle={(v) => toggleFiltro('regional', v)} onSelectAll={() => setFiltros({...filtros, regional: opcoes.regionais})} onClear={() => setFiltros({...filtros, regional: []})} />
          <MultiSelectFilter label="Station / Hub" options={opcoes.stations} selectedValues={filtros.station} onToggle={(v) => toggleFiltro('station', v)} onSelectAll={() => setFiltros({...filtros, station: opcoes.stations})} onClear={() => setFiltros({...filtros, station: []})} hasSearch={true} />
          <MultiSelectFilter label="Turno" options={opcoes.turnos} selectedValues={filtros.turno} onToggle={(v) => toggleFiltro('turno', v)} onSelectAll={() => setFiltros({...filtros, turno: opcoes.turnos})} onClear={() => setFiltros({...filtros, turno: []})} />
          <MultiSelectFilter label="Modal" options={opcoes.modais} selectedValues={filtros.modal} onToggle={(v) => toggleFiltro('modal', v)} onSelectAll={() => setFiltros({...filtros, modal: opcoes.modais})} onClear={() => setFiltros({...filtros, modal: []})} />
          <div className="flex flex-col"><label className="text-[10px] font-black text-slate-400 uppercase mb-1">Início</label><input type="date" value={filtros.dataInicio} onChange={(e) => setFiltros({...filtros, dataInicio: e.target.value})} className="bg-white dark:bg-[#15171e] border border-slate-200 dark:border-gray-700 rounded-lg p-2 text-xs font-bold dark:text-white h-9 outline-none shadow-sm" /></div>
          <div className="flex flex-col"><label className="text-[10px] font-black text-slate-400 uppercase mb-1">Fim</label><input type="date" value={filtros.dataFim} onChange={(e) => setFiltros({...filtros, dataFim: e.target.value})} className="bg-white dark:bg-[#15171e] border border-slate-200 dark:border-gray-700 rounded-lg p-2 text-xs font-bold dark:text-white h-9 outline-none shadow-sm" /></div>
        </div>
      </div>

      {/* CARDS KPIS */}
      <div className="grid grid-cols-2 md:grid-cols-7 gap-4">
        <div className="bg-[#113366] p-5 rounded-2xl border border-blue-900 shadow-lg text-white flex flex-col justify-center">
          <p className="text-[10px] font-black text-blue-300 uppercase mb-1 tracking-widest">{tipoVisao === 'media' ? 'Cap Hub (Média/Dia)' : 'Cap Hub (Total)'}</p>
          <h4 className="text-2xl font-black">{formatInt(kpiAtual.capHub)}</h4>
        </div>
        <div className="bg-[#EE4D2D] p-5 rounded-2xl border border-red-900 shadow-lg text-white flex flex-col justify-center">
          <p className="text-[10px] font-black text-red-200 uppercase mb-1 tracking-widest">{tipoVisao === 'media' ? 'Cap Fleet (Média/Dia)' : 'Cap Fleet (Total)'}</p>
          <h4 className="text-2xl font-black">{formatInt(kpiAtual.capFleet)}</h4>
        </div>
        {[
          {l: tipoVisao === 'media' ? 'Média Processada' : 'Total Processado', v: kpiAtual.volProc, var: calcVar(kpiAtual.volProc, kpiAnterior.volProc)},
          {l: tipoVisao === 'media' ? 'Média Expedida' : 'Total Expedido', v: kpiAtual.volExp, var: calcVar(kpiAtual.volExp, kpiAnterior.volExp)},
          {l: 'Utilização Hub', v: kpiAtual.capHub > 0 ? (kpiAtual.volProc/kpiAtual.capHub)*100 : 0, var: 0, p: true},
          {l: 'Utilização Fleet', v: kpiAtual.capFleet > 0 ? (kpiAtual.volProc/kpiAtual.capFleet)*100 : 0, var: 0, p: true},
          {l: 'Excedente (Pcts)', v: excedente, var: 0, c: excedente > 0 ? 'text-red-500' : 'text-emerald-500'}
        ].map((k, i) => (
          <div key={i} className="bg-white dark:bg-[#1f232d] p-4 rounded-2xl border border-slate-200 dark:border-gray-800 shadow-sm flex flex-col justify-center">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{k.l}</p>
            <div className="flex items-end gap-2">
              <span className={`text-2xl font-black ${k.c || 'text-[#113366] dark:text-white'}`}>
                {k.p ? formatPct(k.v) : formatInt(k.v)}
              </span>
              {k.var !== 0 && (
                <span className={`text-[10px] font-black mb-1 ${k.var > 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                  {k.var > 0 ? '▲' : '▼'}{Math.abs(k.var).toFixed(1)}%
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* GRÁFICOS PARTE 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        <ChartCard title="Capacidade de Fleet vs Realizado" icon={Database}>
          {({ periodo }) => (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={aggs[periodo]} margin={{ top: 30, right: 30, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{fontSize: 10, fontWeight: 'bold'}} axisLine={false} />
                <YAxis yAxisId="left" tick={{fontSize: 10}} axisLine={false} tickFormatter={formatK} />
                <YAxis yAxisId="right" orientation="right" tick={{fontSize: 10, fill: '#EE4D2D'}} axisLine={false} tickFormatter={v => v+'%'} domain={[0, 150]}/>
                <Tooltip content={<CustomTooltip/>} />
                <Legend iconType="circle" wrapperStyle={{fontSize:'12px', fontWeight:'black', textTransform:'uppercase', paddingTop:'15px'}} />
                
                <Bar yAxisId="left" dataKey="volProc" name="Vol. Processado" fill="#113366" radius={[4, 4, 0, 0]} barSize={30}>
                  <LabelList dataKey="volProc" position="top" style={{fontSize: 10, fontWeight:'bold', fill:'#113366'}} formatter={formatK} />
                </Bar>
                <Bar yAxisId="left" dataKey="volExp" name="Vol. Expedido" fill="#94a3b8" radius={[4, 4, 0, 0]} barSize={30}>
                  <LabelList dataKey="volExp" position="top" style={{fontSize: 10, fontWeight:'bold', fill:'#94a3b8'}} formatter={formatK} />
                </Bar>
                <Line yAxisId="left" type="step" dataKey="capFleet" name="Capacidade" stroke="#D0011B" strokeWidth={3} strokeDasharray="5 5" dot={false} />
                <Line yAxisId="right" type="monotone" dataKey="utilPct" name="Utilização (%)" stroke="#EE4D2D" strokeWidth={3} dot={{r:4, fill:'#EE4D2D'}} />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Eficiência de Fleet (Rotas vs Volumes)" icon={Layers}>
          {({ periodo }) => (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={aggs[periodo]} margin={{ top: 30, right: 30, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{fontSize: 10, fontWeight: 'bold'}} axisLine={false} />
                <YAxis yAxisId="left" tick={{fontSize: 10}} axisLine={false} tickFormatter={formatK} />
                <YAxis yAxisId="right" orientation="right" tick={{fontSize: 10, fill: '#10b981'}} axisLine={false} />
                <Tooltip content={<CustomTooltip/>} />
                <Legend wrapperStyle={{fontSize:'11px', fontWeight:'black'}} />
                
                <Bar yAxisId="left" dataKey="volRot" name="Vol. Roteirizado" fill="#e2e8f0" radius={[4, 4, 0, 0]} barSize={25}>
                  <LabelList dataKey="volRot" position="top" style={{fontSize: 10, fontWeight:'bold', fill:'#94a3b8'}} formatter={formatK} />
                </Bar>
                <Bar yAxisId="left" dataKey="volExp" name="Vol. Expedido" fill="#113366" radius={[4, 4, 0, 0]} barSize={25}>
                  <LabelList dataKey="volExp" position="top" style={{fontSize: 10, fontWeight:'bold', fill:'#113366'}} formatter={formatK} />
                </Bar>
                <Line yAxisId="right" type="monotone" dataKey="rotasRot" name="Rotas Roteirizadas" stroke="#EE4D2D" strokeWidth={3} dot={{r:3}} />
                <Line yAxisId="right" type="monotone" dataKey="rotasExp" name="Rotas Expedidas" stroke="#10b981" strokeWidth={3} dot={{r:3}} />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Aderência de Motoristas (Oferta vs Recusa)" icon={Truck}>
          {({ periodo }) => (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={aggs[periodo]} margin={{ top: 30, right: 30, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{fontSize: 10, fontWeight: 'bold'}} axisLine={false} />
                <YAxis tick={{fontSize: 10}} axisLine={false} />
                <Tooltip content={<CustomTooltip/>} />
                <Legend wrapperStyle={{fontSize:'11px', fontWeight:'black'}} />
                
                <Bar dataKey="disponiveis" name="Drivers Oferta" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={25}>
                  <LabelList dataKey="disponiveis" position="top" style={{fontSize: 10, fontWeight:'bold', fill:'#3b82f6'}} formatter={formatK} />
                </Bar>
                <Bar dataKey="rotasRot" name="Drivers Necessários" fill="#f59e0b" radius={[4, 4, 0, 0]} barSize={25}>
                  <LabelList dataKey="rotasRot" position="top" style={{fontSize: 10, fontWeight:'bold', fill:'#f59e0b'}} formatter={formatK} />
                </Bar>
                <Line type="monotone" dataKey="recusas" name="Total Recusas" stroke="#ef4444" strokeWidth={3} dot={{r:4, fill:'#ef4444'}} />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Evolução da Saturação (%)" icon={TrendingUp}>
          {({ periodo }) => (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={aggs[periodo]} margin={{ top: 30, right: 30, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradSat" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#EE4D2D" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#EE4D2D" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{fontSize: 10, fontWeight: 'bold'}} axisLine={false} />
                <YAxis tick={{fontSize: 10}} axisLine={false} tickFormatter={v => v+'%'} />
                <Tooltip content={<CustomTooltip/>} />
                
                <Area type="monotone" dataKey="utilPct" name="Saturação Fleet (%)" stroke="#EE4D2D" strokeWidth={4} fill="url(#gradSat)" dot={{r:5, fill:'#EE4D2D'}}>
                   <LabelList dataKey="utilPct" position="top" style={{fontSize: 10, fontWeight:'black', fill:'#EE4D2D'}} formatter={formatPct} />
                </Area>
                <Line type="step" dataKey={() => 100} stroke="#113366" strokeWidth={2} strokeDasharray="5 5" name="Limite 100%" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      {/* GRÁFICOS PARTE 2: WOW & PIZZA */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-[#1f232d] rounded-2xl shadow-sm border border-slate-200 dark:border-gray-800 p-6 flex flex-col h-[420px]">
           <div className="flex items-center gap-3 mb-6 border-b border-slate-100 dark:border-gray-800 pb-4">
             <div className="p-2 bg-slate-50 dark:bg-gray-800 rounded-lg text-[#113366] dark:text-blue-400"><BarChart3 size={20} /></div>
             <div>
               <h3 className="font-black text-[#113366] dark:text-white uppercase text-base leading-tight">Variação Semanal (WoW)</h3>
               <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Crescimento ou Queda Percentual Volume</p>
             </div>
           </div>
           <div className="flex-1 w-full overflow-hidden">
             <ResponsiveContainer width="100%" height="100%">
               <BarChart data={wowData} margin={{ top: 30, right: 20, left: -20, bottom: 5 }}>
                 <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                 <XAxis dataKey="name" tick={{fontSize: 10, fontWeight: 'bold'}} axisLine={false} />
                 <YAxis tick={{fontSize: 10}} axisLine={false} tickFormatter={v => v+'%'} />
                 <Tooltip content={<CustomTooltip/>} />
                 <Legend wrapperStyle={{fontSize: '11px', fontWeight: 'bold', paddingTop: '10px'}} />
                 
                 <Bar dataKey="varProc" name="Var. Vol Processado (%)" radius={[4, 4, 0, 0]} barSize={25}>
                   {wowData.map((entry, index) => <Cell key={`proc-${index}`} fill={entry.varProc >= 0 ? '#10b981' : '#ef4444'} />)}
                   <LabelList dataKey="varProc" position="top" formatter={formatPct} style={{fontSize: 10, fontWeight:'bold', fill:'#64748b'}}/>
                 </Bar>
                 <Bar dataKey="varExp" name="Var. Vol Expedido (%)" radius={[4, 4, 0, 0]} barSize={25}>
                   {wowData.map((entry, index) => <Cell key={`exp-${index}`} fill={entry.varExp >= 0 ? '#113366' : '#f97316'} />)}
                   <LabelList dataKey="varExp" position="top" formatter={formatPct} style={{fontSize: 10, fontWeight:'bold', fill:'#64748b'}}/>
                 </Bar>
               </BarChart>
             </ResponsiveContainer>
           </div>
        </div>

        <div className="bg-white dark:bg-[#1f232d] rounded-2xl shadow-sm border border-slate-200 dark:border-gray-800 p-6 flex flex-col h-[420px]">
           <div className="flex items-center gap-3 mb-4 border-b border-slate-100 dark:border-gray-800 pb-4">
             <div className="p-2 bg-slate-50 dark:bg-gray-800 rounded-lg text-[#113366] dark:text-blue-400"><PieChart size={20} /></div>
             <div>
               <h3 className="font-black text-[#113366] dark:text-white uppercase text-base leading-tight">Distribuição da Utilização (No Período)</h3>
               <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Dias na régua de saturação</p>
             </div>
           </div>
           <div className="flex-1 w-full h-full relative">
             {distPie.length === 0 ? (
               <div className="absolute inset-0 flex items-center justify-center text-slate-400 font-bold text-sm">Sem dados de capacidade</div>
             ) : (
               <ResponsiveContainer width="100%" height="100%">
                 <RechartsPie>
                   <Pie data={distPie} cx="50%" cy="50%" innerRadius={70} outerRadius={110} dataKey="value" stroke="none" label={{fontSize: 12, fontWeight: 'bold'}}>
                     {distPie.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.fill} />)}
                   </Pie>
                   <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', fontWeight: 'bold' }} />
                   <Legend wrapperStyle={{fontSize: '12px', fontWeight: 'bold'}} />
                 </RechartsPie>
               </ResponsiveContainer>
             )}
           </div>
        </div>
      </div>

      {/* BANNER INSIGHTS ROBUSTECIDO */}
      <div className="bg-white dark:bg-[#1f232d] rounded-2xl shadow-sm border border-slate-200 dark:border-gray-800 flex items-stretch mt-4 overflow-hidden">
        <div className="bg-slate-50 dark:bg-[#15171e] px-8 py-5 flex items-center gap-3 border-r border-slate-200 dark:border-gray-700 shrink-0">
          <Lightbulb size={28} className="text-[#EE4D2D] animate-pulse" />
          <h3 className="font-black text-[#113366] dark:text-white uppercase tracking-widest text-xs">Insights Principais</h3>
        </div>
        <div className="flex-1 flex items-center px-8 gap-12 overflow-x-auto custom-scrollbar whitespace-nowrap">
           <p className="text-xs font-bold text-slate-500"><span className="text-[#EE4D2D] mr-2">●</span> {semanasEstouradas} semana(s) acima da capacidade planejada (&gt;110%).</p>
           <p className="text-xs font-bold text-slate-500"><span className="text-[#EE4D2D] mr-2">●</span> Pico de utilização com <span className="text-[#113366] dark:text-white">{picoSemana.utilPct.toFixed(1)}%</span> da capacidade.</p>
           <p className="text-xs font-bold text-slate-500"><span className="text-[#EE4D2D] mr-2">●</span> {crescUltimaSemana >= 0 ? 'Crescimento' : 'Queda'} de <span className={crescUltimaSemana >= 0 ? 'text-emerald-500' : 'text-[#EE4D2D]'}>{Math.abs(crescUltimaSemana).toFixed(1)}%</span> do volume processado na última semana.</p>
           <p className="text-xs font-bold text-slate-500"><span className="text-[#EE4D2D] mr-2">●</span> Excedente acumulado: <span className="text-red-500">{excedente > 0 ? '+' : ''}{formatInt(excedente)} volumes</span>.</p>
        </div>
      </div>

    </div>
  );
}