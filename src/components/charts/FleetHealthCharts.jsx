import React, { useState, useMemo, useRef, useEffect } from 'react';
import { BarChart, Bar, Line, ComposedChart, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, LabelList } from 'recharts';
import { Activity, UserMinus, UserCheck, AlertTriangle, Truck, TrendingUp, Maximize2, Minimize2, X, Info, Filter, ChevronDown, CalendarDays, Calendar, UserPlus, TrendingDown, XOctagon } from 'lucide-react';

const TRADUZ_MES = { '01':'JAN', '02':'FEV', '03':'MAR', '04':'ABR', '05':'MAI', '06':'JUN', '07':'JUL', '08':'AGO', '09':'SET', '10':'OUT', '11':'NOV', '12':'DEZ' };
const MODAL_OPTIONS = ['Passeio', 'Utilitário', 'Moto', 'Van'];

export default function FleetHealthCharts({ rawData, historicoFrotaData, firstTripsData, filtrosGlobais = {} }) {
  const [periodo, setPeriodo] = useState('semana');
  const [fullscreenChart, setFullscreenChart] = useState(null); 

  const [modaisEvol, setModaisEvol] = useState(MODAL_OPTIONS);
  const [modaisConv, setModaisConv] = useState(MODAL_OPTIONS);
  
  const [isEvolMenuOpen, setIsEvolMenuOpen] = useState(false);
  const [isConvMenuOpen, setIsConvMenuOpen] = useState(false);
  
  const evolMenuRef = useRef(null);
  const convMenuRef = useRef(null);

  const { regional = [], station = [], turno = [], semana = "", mes = "", dataInicio = "", dataFim = "" } = filtrosGlobais;

  useEffect(() => {
    function handleClickOutside(event) {
      if (evolMenuRef.current && !evolMenuRef.current.contains(event.target)) setIsEvolMenuOpen(false);
      if (convMenuRef.current && !convMenuRef.current.contains(event.target)) setIsConvMenuOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const toggleModal = (modal, stateSetter) => {
    stateSetter(prev => prev.includes(modal) ? prev.filter(m => m !== modal) : [...prev, modal]);
  };

  const parseNum = (val) => {
    let s = String(val || '0').trim();
    if (s.includes(',')) return Number(s.replace(/\./g, '').replace(',', '.'));
    return Number(s) || 0;
  };

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
    if (!dateStr) return "";
    const isoDate = parseUniversalDate(dateStr);
    if (!isoDate) return "";
    const d = new Date(isoDate + 'T12:00:00');
    const dCopy = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const dayNum = dCopy.getUTCDay() || 7;
    dCopy.setUTCDate(dCopy.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(dCopy.getUTCFullYear(),0,1));
    const weekNo = Math.ceil((((dCopy - yearStart) / 86400000) + 1)/7);
    return `W-${String(weekNo).padStart(2, '0')}`;
  };

  const formatName = (isoKey, p) => {
    if (!isoKey) return "N/A";
    if (p === 'dia') return `${isoKey.split('-')[2]}/${isoKey.split('-')[1]}`;
    if (p === 'mes') return `${TRADUZ_MES[isoKey.split('-')[1]] || isoKey}/${isoKey.split('-')[0].substring(2)}`;
    return isoKey; 
  };

  // =========================================================
  // 1. MOTOR DE KPIs (Com Snapshot Lógico)
  // =========================================================
  const kpis = useMemo(() => {
    const frotaAggs = {};
    const recusasAggs = {};
    let hasAnyValidFrota = false;
    let hasAnyValidRecusa = false;

    // A. LENDO HISTÓRICO DE FROTA (Snapshot)
    if (historicoFrotaData && historicoFrotaData.length > 1) {
      const tempAggs = {};

      historicoFrotaData.slice(1).forEach(row => {
        const rawDate = String(row[2] || "").trim(); 
        const hubRow = String(row[3] || "").trim();

        if (station.length > 0 && !station.includes(hubRow)) return;

        const isoDate = parseUniversalDate(rawDate);
        if (!isoDate) return;

        const semRow = getISOWeek(isoDate);
        const mesRow = isoDate.substring(0, 7);

        let chavePeriodo = isoDate;
        if (periodo === 'semana') chavePeriodo = semRow;
        if (periodo === 'mes') chavePeriodo = mesRow;

        let isValid = true;
        if (dataInicio && isoDate < dataInicio) isValid = false;
        if (dataFim && isoDate > dataFim) isValid = false;
        if (semana && semRow !== semana) isValid = false;
        if (mes && mesRow.split('-')[1] !== mes && TRADUZ_MES[mesRow.split('-')[1]] !== mes) isValid = false;

        if (!tempAggs[chavePeriodo]) {
          tempAggs[chavePeriodo] = { hubs: {}, isValid: false };
        }
        
        if (isValid) {
          tempAggs[chavePeriodo].isValid = true;
          hasAnyValidFrota = true;
        }

        if (!tempAggs[chavePeriodo].hubs[hubRow] || isoDate >= tempAggs[chavePeriodo].hubs[hubRow].dataRef) {
            tempAggs[chavePeriodo].hubs[hubRow] = {
                dataRef: isoDate,
                ativos: parseNum(row[4]),
                dormentes: parseNum(row[5]),
                risco: parseNum(row[6]),
                churn: parseNum(row[7])
            };
        }
      });

      Object.keys(tempAggs).forEach(periodoKey => {
         let sumAtivos = 0, sumDormentes = 0, sumRisco = 0, sumChurn = 0;
         Object.values(tempAggs[periodoKey].hubs).forEach(h => {
             sumAtivos += h.ativos;
             sumDormentes += h.dormentes;
             sumRisco += h.risco;
             sumChurn += h.churn;
         });
         frotaAggs[periodoKey] = { ativos: sumAtivos, dormentes: sumDormentes, risco: sumRisco, churn: sumChurn, isValid: tempAggs[periodoKey].isValid };
      });
    }

    // B. LENDO RECUSAS (Consolidado)
    (rawData || []).forEach(row => {
      if (regional.length > 0 && !regional.includes(row[1])) return;
      if (station.length > 0 && !station.includes(row[4])) return;
      if (turno.length > 0 && !turno.includes(row[5])) return;

      const isoDate = parseUniversalDate(row[3]);
      if (!isoDate) return;

      const semRow = getISOWeek(isoDate);
      const mesRow = isoDate.substring(0, 7);

      let chavePeriodo = isoDate;
      if (periodo === 'semana') chavePeriodo = semRow;
      if (periodo === 'mes') chavePeriodo = mesRow;

      let isValid = true;
      if (dataInicio && isoDate < dataInicio) isValid = false;
      if (dataFim && isoDate > dataFim) isValid = false;
      if (semana && semRow !== semana) isValid = false;
      if (mes && mesRow.split('-')[1] !== mes && TRADUZ_MES[mesRow.split('-')[1]] !== mes) isValid = false;

      if (!recusasAggs[chavePeriodo]) {
        recusasAggs[chavePeriodo] = { ofertas: 0, recusas: 0, isValid: false };
      }

      recusasAggs[chavePeriodo].ofertas += parseNum(row[24]);
      recusasAggs[chavePeriodo].recusas += parseNum(row[35]);
      
      if (isValid) {
        recusasAggs[chavePeriodo].isValid = true;
        hasAnyValidRecusa = true;
      }
    });

    if (!hasAnyValidFrota && !hasAnyValidRecusa) {
      return { hasData: false };
    }

    // Processamento do Atual vs Anterior para Variação
    const allFrotaKeys = Object.keys(frotaAggs).sort();
    const validFrotaKeys = allFrotaKeys.filter(k => frotaAggs[k].isValid);
    const currFrotaKey = validFrotaKeys[validFrotaKeys.length - 1];
    const currFrotaIdx = allFrotaKeys.indexOf(currFrotaKey);
    
    const currFrota = currFrotaKey ? frotaAggs[currFrotaKey] : { ativos: 0, dormentes: 0, risco: 0, churn: 0 };
    const prevFrota = currFrotaIdx > 0 ? frotaAggs[allFrotaKeys[currFrotaIdx - 1]] : { ativos: 0, dormentes: 0, risco: 0, churn: 0 };

    const allRecKeys = Object.keys(recusasAggs).sort();
    const validRecKeys = allRecKeys.filter(k => recusasAggs[k].isValid);
    const currRecKey = validRecKeys[validRecKeys.length - 1];
    const currRecIdx = allRecKeys.indexOf(currRecKey);

    const currRec = currRecKey ? recusasAggs[currRecKey] : { ofertas: 0, recusas: 0 };
    const prevRec = currRecIdx > 0 ? recusasAggs[allRecKeys[currRecIdx - 1]] : { ofertas: 0, recusas: 0 };

    const calcPct = (num, den) => den > 0 ? (num / den) * 100 : 0;
    const calcVarRate = (curr, prev) => curr - prev; 
    const calcVarAbs = (curr, prev) => prev !== 0 ? ((curr - prev) / prev) * 100 : (curr > 0 ? 100 : 0);

    const refLabel = formatName(currRecKey || currFrotaKey, periodo);

    return {
      hasData: true,
      recusaPct: calcPct(currRec.recusas, currRec.ofertas),
      varRecusa: calcVarRate(calcPct(currRec.recusas, currRec.ofertas), calcPct(prevRec.recusas, prevRec.ofertas)),
      recusas: currRec.recusas,
      
      churnPct: calcPct(currFrota.churn, currFrota.ativos),
      varChurn: calcVarRate(calcPct(currFrota.churn, currFrota.ativos), calcPct(prevFrota.churn, prevFrota.ativos)),
      churn: currFrota.churn,

      dormPct: calcPct(currFrota.dormentes, currFrota.ativos),
      varDorm: calcVarRate(calcPct(currFrota.dormentes, currFrota.ativos), calcPct(prevFrota.dormentes, prevFrota.ativos)),
      dormentes: currFrota.dormentes,

      ativos: currFrota.ativos,
      varAtivos: calcVarAbs(currFrota.ativos, prevFrota.ativos),
      
      refLabel: refLabel
    };
  }, [rawData, historicoFrotaData, periodo, regional, station, turno, semana, mes, dataInicio, dataFim]);

  // =========================================================
  // 2. MOTOR TEMPORAL DOS GRÁFICOS (Evolução + Conversão + Recusas Absolutas)
  // =========================================================
  const temporalData = useMemo(() => {
    const aggs = {};

    (rawData || []).forEach(row => {
      if (regional.length > 0 && !regional.includes(row[1])) return;
      if (station.length > 0 && !station.includes(row[4])) return;
      if (turno.length > 0 && !turno.includes(row[5])) return;

      const isoDate = parseUniversalDate(row[3]);
      if (!isoDate) return;

      const semRow = getISOWeek(isoDate);
      const mesRow = isoDate.split('-')[1];

      if (dataInicio && isoDate < dataInicio) return;
      if (dataFim && isoDate > dataFim) return;
      if (semana && semRow !== semana) return;
      if (mes && mesRow !== mes && TRADUZ_MES[mesRow] !== mes) return;

      let chavePeriodo = isoDate;
      if (periodo === 'semana') chavePeriodo = semRow;
      if (periodo === 'mes') chavePeriodo = isoDate.substring(0, 7);

      if (!aggs[chavePeriodo]) {
        aggs[chavePeriodo] = { 
          name: formatName(chavePeriodo, periodo), sortKey: chavePeriodo,
          totalOfertasGlobais: 0, totalRecusasGlobais: 0,
          p_off: 0, u_off: 0, m_off: 0, v_off: 0,
          p_acc: 0, u_acc: 0, m_acc: 0, v_acc: 0,
          p_rec: 0, u_rec: 0, m_rec: 0, v_rec: 0 // 🔥 Nova linha para capturar Recusas Absolutas
        };
      }

      aggs[chavePeriodo].totalOfertasGlobais += parseNum(row[24]); 
      aggs[chavePeriodo].totalRecusasGlobais += parseNum(row[35]); 
      
      aggs[chavePeriodo].u_off += parseNum(row[20]); 
      aggs[chavePeriodo].p_off += parseNum(row[21]); 
      aggs[chavePeriodo].m_off += parseNum(row[22]); 
      aggs[chavePeriodo].v_off += parseNum(row[23]); 
      
      aggs[chavePeriodo].u_acc += parseNum(row[25]); 
      aggs[chavePeriodo].p_acc += parseNum(row[26]); 
      aggs[chavePeriodo].m_acc += parseNum(row[27]); 
      aggs[chavePeriodo].v_acc += parseNum(row[28]); 

      // 🔥 Extração de Recusas (Considerando: Ofertas Realizadas - Aceites = Recusas/Abandonos na plataforma)
      // Nota: Estamos calculando as recusas baseadas no funil por modal, já que o rawData não costuma quebrar a coluna principal de recusa (row[35]) por modal.
      aggs[chavePeriodo].u_rec += Math.max(0, parseNum(row[20]) - parseNum(row[25])); 
      aggs[chavePeriodo].p_rec += Math.max(0, parseNum(row[21]) - parseNum(row[26])); 
      aggs[chavePeriodo].m_rec += Math.max(0, parseNum(row[22]) - parseNum(row[27])); 
      aggs[chavePeriodo].v_rec += Math.max(0, parseNum(row[23]) - parseNum(row[28])); 
    });

    return Object.values(aggs)
      .map(d => ({ ...d, recusaPctGeral: d.totalOfertasGlobais > 0 ? (d.totalRecusasGlobais / d.totalOfertasGlobais) * 100 : 0 }))
      .sort((a, b) => a.sortKey.localeCompare(b.sortKey));
  }, [rawData, periodo, regional, station, turno, semana, mes, dataInicio, dataFim]);

  const chartConversaoData = useMemo(() => {
    return temporalData.map(d => {
      const ofertasSel = (modaisConv.includes('Passeio') ? d.p_off : 0) + (modaisConv.includes('Utilitário') ? d.u_off : 0) + (modaisConv.includes('Moto') ? d.m_off : 0) + (modaisConv.includes('Van') ? d.v_off : 0);
      const accSel = (modaisConv.includes('Passeio') ? d.p_acc : 0) + (modaisConv.includes('Utilitário') ? d.u_acc : 0) + (modaisConv.includes('Moto') ? d.m_acc : 0) + (modaisConv.includes('Van') ? d.v_acc : 0);
      return { ...d, ofertasSel, accSel, convPct: ofertasSel > 0 ? (accSel / ofertasSel) * 100 : 0 };
    });
  }, [temporalData, modaisConv]);

  // =========================================================
  // 4. MOTOR DE FIRST TRIPS (Pivotada)
  // =========================================================
  const firstTripsProcessed = useMemo(() => {
    if (!firstTripsData || firstTripsData.length < 2) return [];
    const headers = firstTripsData[0];
    const dateCols = headers.map((h, i) => ({ label: String(h).trim(), idx: i })).filter(col => col.label.match(/^\d{4}-\d{2}-\d{2}/));
    const aggs = {};

    firstTripsData.slice(1).forEach(row => {
      if (regional.length > 0 && !regional.includes(row[0])) return; 
      if (station.length > 0 && !station.includes(row[2])) return; 

      dateCols.forEach(col => {
        const val = parseNum(row[col.idx]);
        if (val === 0) return;

        const isoDate = parseUniversalDate(col.label);
        if (!isoDate) return;

        const semRow = getISOWeek(isoDate);
        const mesRow = isoDate.split('-')[1];

        if (dataInicio && isoDate < dataInicio) return;
        if (dataFim && isoDate > dataFim) return;
        if (semana && semRow !== semana) return;
        if (mes && mesRow !== mes && TRADUZ_MES[mesRow] !== mes) return;

        let chavePeriodo = isoDate; 
        if (periodo === 'mes') chavePeriodo = isoDate.substring(0, 7);
        if (periodo === 'semana') chavePeriodo = semRow;

        if (!aggs[chavePeriodo]) {
          aggs[chavePeriodo] = { name: formatName(chavePeriodo, periodo), sortKey: chavePeriodo, totalFirstTrips: 0 };
        }
        aggs[chavePeriodo].totalFirstTrips += val;
      });
    });

    return Object.values(aggs).sort((a, b) => a.sortKey.localeCompare(b.sortKey));
  }, [firstTripsData, periodo, regional, station, semana, mes, dataInicio, dataFim]);


  const fInt = (val) => val > 0 ? new Intl.NumberFormat('pt-BR').format(Math.round(val)) : '';
  const fIntTooltip = (val) => new Intl.NumberFormat('pt-BR').format(Math.round(val));

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white dark:bg-[#1f232d] border border-slate-200 dark:border-gray-800 p-3 rounded-lg shadow-xl z-50">
          <p className="font-black text-slate-800 dark:text-white mb-2">{label}</p>
          {payload.map((entry, index) => (
            <p key={index} style={{ color: entry.color }} className="font-bold text-sm py-0.5">
              {entry.name}: {entry.name.includes('%') ? `${entry.value.toFixed(1)}%` : fIntTooltip(entry.value)}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  const renderChartCard = (id, title, subtitle, icon, extraControls, content, dataLength) => {
    const isFullscreen = fullscreenChart === id;
    const minW = dataLength > 15 ? `${dataLength * 60}px` : '100%';

    const cardContent = (
      <div className={`bg-white dark:bg-[#1f232d] rounded-2xl shadow-sm border border-slate-200 dark:border-gray-800 flex flex-col relative transition-all ${isFullscreen ? 'w-full h-full p-8' : 'h-[450px] p-6'}`}>
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 border-b border-slate-100 dark:border-gray-800 pb-4 shrink-0 gap-4">
          <div>
            <h3 className={`font-black uppercase flex items-center gap-2 ${isFullscreen ? 'text-2xl' : 'text-lg'} text-[#113366] dark:text-white`}>
              {icon} {title}
            </h3>
            <p className="text-xs text-slate-500 font-bold uppercase mt-1 flex items-center gap-1">
              <Info size={12}/> {subtitle} [POR {periodo.toUpperCase()}]
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {extraControls}
            <button onClick={() => setFullscreenChart(isFullscreen ? null : id)} className="text-slate-400 hover:text-[#EE4D2D] bg-slate-50 hover:bg-orange-50 dark:bg-gray-800 p-2 rounded-lg transition-colors">
              {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
            </button>
          </div>
        </div>
        
        <div className="flex-1 w-full overflow-hidden">
          <div className="w-full h-full overflow-x-auto overflow-y-hidden custom-scrollbar pb-2">
            <div style={{ minWidth: minW, height: '100%' }}>{content}</div>
          </div>
        </div>
      </div>
    );

    if (isFullscreen) {
      return (
        <div className="fixed inset-4 z-[99999] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="w-full h-full relative">
             {cardContent}
             <button onClick={() => setFullscreenChart(null)} className="absolute top-4 right-4 bg-[#113366] text-white p-2 rounded-full hover:bg-[#EE4D2D] shadow-lg"><X size={24}/></button>
          </div>
        </div>
      );
    }
    return cardContent;
  };

  const topVisibleModal = [...MODAL_OPTIONS].reverse().find(s => modaisEvol.includes(s));

  const renderVarPill = (valor, invertColors = false) => {
    if (isNaN(valor) || valor === 0) return null;
    const isPositive = valor > 0;
    const isBad = invertColors ? isPositive : !isPositive; 
    const colorClass = isBad ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700';
    const Icon = isPositive ? TrendingUp : TrendingDown;
    
    return (
      <div className={`flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-md ${colorClass} shadow-sm mb-1`}>
        <Icon size={12}/> {isPositive ? '+' : ''}{Math.abs(valor).toFixed(1)}{invertColors ? ' pp' : '%'}
      </div>
    );
  };

  return (
    <div className="space-y-6 mt-6">
      
      {/* 4 CARDS DE KPI (COM ESTADO DE "SEM DADOS") */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        
        <div className="bg-white dark:bg-[#1f232d] p-6 rounded-2xl border border-slate-200 dark:border-gray-800 shadow-sm relative overflow-hidden group flex flex-col justify-between">
          <div className="absolute top-0 right-0 w-16 h-16 bg-orange-100 dark:bg-orange-900/20 rounded-bl-full -mr-8 -mt-8 transition-transform group-hover:scale-110"></div>
          <div>
            <div className="flex justify-between items-start mb-2 relative z-10">
              <span className="text-xs font-black uppercase text-slate-400">Taxa de Recusa</span>
              <AlertTriangle size={20} className="text-orange-500" />
            </div>
            {!kpis.hasData ? (
              <div className="py-2 text-[11px] font-black uppercase text-slate-300">Sem dados no período</div>
            ) : (
              <>
                <div className="flex items-end gap-3 relative z-10">
                  <span className="text-3xl font-black text-[#113366] dark:text-white leading-none">{kpis.recusaPct.toFixed(1)}%</span>
                  {renderVarPill(kpis.varRecusa, true)}
                </div>
                <div className="text-[10px] font-bold text-slate-500 uppercase mt-3 pt-3 border-t border-slate-100 dark:border-gray-800 relative z-10 flex justify-between">
                  <span>{fIntTooltip(kpis.recusas)} recusas brutas</span>
                  <span className="text-[#EE4D2D]">Ref: {kpis.refLabel}</span>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="bg-white dark:bg-[#1f232d] p-6 rounded-2xl border border-slate-200 dark:border-gray-800 shadow-sm relative overflow-hidden group flex flex-col justify-between">
          <div className="absolute top-0 right-0 w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-bl-full -mr-8 -mt-8 transition-transform group-hover:scale-110"></div>
          <div>
            <div className="flex justify-between items-start mb-2 relative z-10">
              <span className="text-xs font-black uppercase text-slate-400">Risco de Churn</span>
              <UserMinus size={20} className="text-red-500" />
            </div>
            {!kpis.hasData ? (
              <div className="py-2 text-[11px] font-black uppercase text-slate-300">Sem dados no período</div>
            ) : (
              <>
                <div className="flex items-end gap-3 relative z-10">
                  <span className="text-3xl font-black text-[#113366] dark:text-white leading-none">{kpis.churnPct.toFixed(1)}%</span>
                  {renderVarPill(kpis.varChurn, true)}
                </div>
                <div className="text-[10px] font-bold text-slate-500 uppercase mt-3 pt-3 border-t border-slate-100 dark:border-gray-800 relative z-10 flex justify-between">
                  <span>{fIntTooltip(kpis.churn)} motoristas saindo</span>
                  <span className="text-[#EE4D2D]">Ref: {kpis.refLabel}</span>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="bg-white dark:bg-[#1f232d] p-6 rounded-2xl border border-slate-200 dark:border-gray-800 shadow-sm relative overflow-hidden group flex flex-col justify-between">
          <div className="absolute top-0 right-0 w-16 h-16 bg-yellow-100 dark:bg-yellow-900/20 rounded-bl-full -mr-8 -mt-8 transition-transform group-hover:scale-110"></div>
          <div>
            <div className="flex justify-between items-start mb-2 relative z-10">
              <span className="text-xs font-black uppercase text-slate-400">Dormentes</span>
              <Activity size={20} className="text-yellow-500" />
            </div>
            {!kpis.hasData ? (
              <div className="py-2 text-[11px] font-black uppercase text-slate-300">Sem dados no período</div>
            ) : (
              <>
                <div className="flex items-end gap-3 relative z-10">
                  <span className="text-3xl font-black text-[#113366] dark:text-white leading-none">{kpis.dormPct.toFixed(1)}%</span>
                  {renderVarPill(kpis.varDorm, true)}
                </div>
                <div className="text-[10px] font-bold text-slate-500 uppercase mt-3 pt-3 border-t border-slate-100 dark:border-gray-800 relative z-10 flex justify-between">
                  <span>{fIntTooltip(kpis.dormentes)} Base Fria</span>
                  <span className="text-[#EE4D2D]">Ref: {kpis.refLabel}</span>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="bg-white dark:bg-[#1f232d] p-6 rounded-2xl border border-slate-200 dark:border-gray-800 shadow-sm relative overflow-hidden group flex flex-col justify-between">
          <div className="absolute top-0 right-0 w-16 h-16 bg-green-100 dark:bg-green-900/20 rounded-bl-full -mr-8 -mt-8 transition-transform group-hover:scale-110"></div>
          <div>
            <div className="flex justify-between items-start mb-2 relative z-10">
              <span className="text-xs font-black uppercase text-slate-400">Ativos Totais</span>
              <UserCheck size={20} className="text-green-500" />
            </div>
            {!kpis.hasData ? (
              <div className="py-2 text-[11px] font-black uppercase text-slate-300">Sem dados no período</div>
            ) : (
              <>
                <div className="flex items-end gap-3 relative z-10">
                  <span className="text-3xl font-black text-[#113366] dark:text-white leading-none">{fIntTooltip(kpis.ativos)}</span>
                  {renderVarPill(kpis.varAtivos, false)} 
                </div>
                <div className="text-[10px] font-bold text-slate-500 uppercase mt-3 pt-3 border-t border-slate-100 dark:border-gray-800 relative z-10 flex justify-between">
                  <span>Base Quente (RH)</span>
                  <span className="text-[#EE4D2D]">Ref: {kpis.refLabel}</span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* CONTROLE GLOBAL DE TEMPO DOS GRÁFICOS */}
      <div className="flex justify-end mb-2">
        <div className="flex bg-slate-100 dark:bg-[#15171e] p-1 rounded-lg shadow-sm border border-slate-200 dark:border-gray-700">
          <button onClick={() => setPeriodo('dia')} className={`flex items-center gap-1.5 px-6 py-2 rounded text-xs font-black uppercase transition-all ${periodo === 'dia' ? 'bg-[#113366] text-white shadow' : 'text-slate-500 hover:text-[#113366]'}`}><CalendarDays size={14} /> Dia</button>
          <button onClick={() => setPeriodo('semana')} className={`flex items-center gap-1.5 px-6 py-2 rounded text-xs font-black uppercase transition-all ${periodo === 'semana' ? 'bg-[#113366] text-white shadow' : 'text-slate-500 hover:text-[#113366]'}`}><Calendar size={14} /> Sem</button>
          <button onClick={() => setPeriodo('mes')} className={`flex items-center gap-1.5 px-6 py-2 rounded text-xs font-black uppercase transition-all ${periodo === 'mes' ? 'bg-[#113366] text-white shadow' : 'text-slate-500 hover:text-[#113366]'}`}><CalendarDays size={14} /> Mês</button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        
        {/* GRÁFICO 1: EVOLUÇÃO DE RECUSAS (%) */}
        {renderChartCard('evolucao', 'Taxa de Rejeição de Ofertas', 'Composição de Ofertas vs % de Rejeição no Tempo', <TrendingUp className="text-[#EE4D2D]"/>, 
          (
            <div className="relative" ref={evolMenuRef}>
              <div onClick={() => setIsEvolMenuOpen(!isEvolMenuOpen)} className="bg-white dark:bg-[#1f232d] border border-slate-200 dark:border-gray-700 text-slate-600 dark:text-gray-300 rounded-lg px-4 py-1.5 text-xs font-bold cursor-pointer flex items-center shadow-sm hover:bg-slate-50 transition-colors">
                <Filter size={14} className="text-[#EE4D2D] mr-1.5"/> 
                <span className="mr-2">{modaisEvol.length === 4 ? 'Todos os Modais' : `${modaisEvol.length} Selecionados`}</span>
                <ChevronDown size={14} className={`transition-transform ${isEvolMenuOpen ? 'rotate-180' : ''}`} />
              </div>
              {isEvolMenuOpen && (
                <div className="absolute top-[100%] right-0 mt-1 w-48 bg-white dark:bg-[#1f232d] border border-slate-200 dark:border-gray-700 rounded-lg shadow-xl z-50 py-1">
                  {MODAL_OPTIONS.map(modal => (
                    <label key={`ev-${modal}`} className="flex items-center gap-3 px-4 py-2 hover:bg-slate-50 dark:hover:bg-gray-800 cursor-pointer text-xs font-bold text-slate-700 dark:text-gray-200 transition-colors">
                      <input type="checkbox" checked={modaisEvol.includes(modal)} onChange={() => toggleModal(modal, setModaisEvol)} className="rounded border-slate-300 text-[#113366] focus:ring-[#113366] w-3 h-3 cursor-pointer" /> {modal}
                    </label>
                  ))}
                </div>
              )}
            </div>
          ),
          (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={temporalData} margin={{ top: 20, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fontWeight: 'bold' }} />
                <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="right" orientation="right" tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11, fill: '#D0011B' }} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ paddingTop: '10px', fontSize: '12px', fontWeight: 'bold' }} />

                {modaisEvol.includes('Passeio') && <Bar yAxisId="left" dataKey="p_off" stackId="a" name="Ofertas Passeio" fill="#113366" maxBarSize={50} radius={topVisibleModal === 'Passeio' ? [4,4,0,0] : [0,0,0,0]}><LabelList dataKey="p_off" position="center" fill="#ffffff" fontSize={10} fontWeight="bold" formatter={fInt} /></Bar>}
                {modaisEvol.includes('Utilitário') && <Bar yAxisId="left" dataKey="u_off" stackId="a" name="Ofertas Utilitário" fill="#3b82f6" maxBarSize={50} radius={topVisibleModal === 'Utilitário' ? [4,4,0,0] : [0,0,0,0]}><LabelList dataKey="u_off" position="center" fill="#ffffff" fontSize={10} fontWeight="bold" formatter={fInt} /></Bar>}
                {modaisEvol.includes('Moto') && <Bar yAxisId="left" dataKey="m_off" stackId="a" name="Ofertas Moto" fill="#F5A623" maxBarSize={50} radius={topVisibleModal === 'Moto' ? [4,4,0,0] : [0,0,0,0]}><LabelList dataKey="m_off" position="center" fill="#78350f" fontSize={10} fontWeight="bold" formatter={fInt} /></Bar>}
                {modaisEvol.includes('Van') && <Bar yAxisId="left" dataKey="v_off" stackId="a" name="Ofertas Van" fill="#8b5cf6" maxBarSize={50} radius={topVisibleModal === 'Van' ? [4,4,0,0] : [0,0,0,0]}><LabelList dataKey="v_off" position="center" fill="#ffffff" fontSize={10} fontWeight="bold" formatter={fInt} /></Bar>}
                
                <Line yAxisId="right" type="monotone" dataKey="recusaPctGeral" name="% Recusa Geral" stroke="#D0011B" strokeWidth={3} dot={{ r: 5, fill: '#fff', stroke: '#D0011B', strokeWidth: 2 }} activeDot={{ r: 7 }} />
              </ComposedChart>
            </ResponsiveContainer>
          ),
          temporalData.length
        )}

        {/* GRÁFICO 2: DESEMPENHO POR MODAL */}
        {renderChartCard('modais', 'Desempenho por Modal', 'Comparativo de Ofertas Realizadas vs Carregadas (Aceites) com % de Conversão', <Truck className="text-[#EE4D2D]"/>, 
          (
            <div className="relative" ref={convMenuRef}>
              <div onClick={() => setIsConvMenuOpen(!isConvMenuOpen)} className="bg-white dark:bg-[#1f232d] border border-slate-200 dark:border-gray-700 text-slate-600 dark:text-gray-300 rounded-lg px-4 py-1.5 text-xs font-bold cursor-pointer flex items-center shadow-sm hover:bg-slate-50 transition-colors">
                <Filter size={14} className="text-[#EE4D2D] mr-1.5"/> 
                <span className="mr-2">{modaisConv.length === 4 ? 'Todos os Modais' : `${modaisConv.length} Selecionados`}</span>
                <ChevronDown size={14} className={`transition-transform ${isConvMenuOpen ? 'rotate-180' : ''}`} />
              </div>
              {isConvMenuOpen && (
                <div className="absolute top-[100%] right-0 mt-1 w-48 bg-white dark:bg-[#1f232d] border border-slate-200 dark:border-gray-700 rounded-lg shadow-xl z-50 py-1">
                  {MODAL_OPTIONS.map(modal => (
                    <label key={`co-${modal}`} className="flex items-center gap-3 px-4 py-2 hover:bg-slate-50 dark:hover:bg-gray-800 cursor-pointer text-xs font-bold text-slate-700 dark:text-gray-200 transition-colors">
                      <input type="checkbox" checked={modaisConv.includes(modal)} onChange={() => toggleModal(modal, setModaisConv)} className="rounded border-slate-300 text-[#113366] focus:ring-[#113366] w-3 h-3 cursor-pointer" /> {modal}
                    </label>
                  ))}
                </div>
              )}
            </div>
          ), 
          (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartConversaoData} margin={{ top: 20, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{ fontSize: 12, fontWeight: 'bold' }} />
                <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="right" orientation="right" tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11, fill: '#D0011B' }} />
                
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ paddingTop: '10px', fontSize: '12px', fontWeight: 'bold' }} />

                <Bar yAxisId="left" dataKey="ofertasSel" name="Ofertas (Volume)" fill="#113366" radius={[4, 4, 0, 0]} maxBarSize={50}>
                  <LabelList dataKey="ofertasSel" position="top" fill="#113366" fontSize={11} fontWeight="bold" formatter={fInt} />
                </Bar>

                <Bar yAxisId="left" dataKey="accSel" name="Carregados (Aceites)" fill="#EE4D2D" radius={[4, 4, 0, 0]} maxBarSize={50}>
                  <LabelList dataKey="accSel" position="top" fill="#EE4D2D" fontSize={11} fontWeight="bold" formatter={fInt} />
                </Bar>
                
                <Line yAxisId="right" type="monotone" dataKey="convPct" name="% Conversão" stroke="#D0011B" strokeWidth={3} dot={{ r: 5, fill: '#fff', stroke: '#D0011B', strokeWidth: 2 }} activeDot={{ r: 7 }} />

              </ComposedChart>
            </ResponsiveContainer>
          ),
          chartConversaoData.length 
        )}

        {/* GRÁFICO 3: FIRST TRIPS */}
        {renderChartCard('firstTrips', 'First Trips (Primeiras Viagens)', 'Evolução de inserção de novos motoristas na operação', <UserPlus className="text-[#EE4D2D]"/>, null, 
          (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={firstTripsProcessed} margin={{ top: 20, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{ fontSize: 12, fontWeight: 'bold' }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ paddingTop: '10px', fontSize: '12px', fontWeight: 'bold' }} />

                <Bar dataKey="totalFirstTrips" name="Volume First Trips" fill="#113366" radius={[4, 4, 0, 0]} maxBarSize={60}>
                  <LabelList dataKey="totalFirstTrips" position="top" fill="#113366" fontSize={11} fontWeight="bold" formatter={fInt} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ),
          firstTripsProcessed.length 
        )}

        {/* 🔥 GRÁFICO 4: RECUSAS ABSOLUTAS */}
        {renderChartCard('recusasAbsolutas', 'Volume de Recusas por Modal', 'Quantidade absoluta de ofertas rejeitadas ou abandonadas', <XOctagon className="text-[#D0011B]"/>, null, 
          (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={temporalData} margin={{ top: 20, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{ fontSize: 12, fontWeight: 'bold' }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ paddingTop: '10px', fontSize: '12px', fontWeight: 'bold' }} />

                <Bar dataKey="p_rec" stackId="a" name="Recusas Passeio" fill="#113366" maxBarSize={60}><LabelList dataKey="p_rec" position="center" fill="#ffffff" fontSize={10} fontWeight="bold" formatter={fInt} /></Bar>
                <Bar dataKey="u_rec" stackId="a" name="Recusas Utilitário" fill="#3b82f6" maxBarSize={60}><LabelList dataKey="u_rec" position="center" fill="#ffffff" fontSize={10} fontWeight="bold" formatter={fInt} /></Bar>
                <Bar dataKey="m_rec" stackId="a" name="Recusas Moto" fill="#F5A623" maxBarSize={60}><LabelList dataKey="m_rec" position="center" fill="#78350f" fontSize={10} fontWeight="bold" formatter={fInt} /></Bar>
                <Bar dataKey="v_rec" stackId="a" name="Recusas Van" fill="#8b5cf6" maxBarSize={60} radius={[4, 4, 0, 0]}><LabelList dataKey="v_rec" position="top" fill="#8b5cf6" fontSize={11} fontWeight="bold" formatter={fInt} /></Bar>
              </BarChart>
            </ResponsiveContainer>
          ),
          temporalData.length 
        )}

      </div>
    </div>
  );
}