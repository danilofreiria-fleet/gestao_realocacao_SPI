import React, { useState, useMemo, useRef, useEffect } from 'react';
import { BarChart, Bar, Line, ComposedChart, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, LabelList } from 'recharts';
import { Activity, UserMinus, UserCheck, AlertTriangle, Truck, TrendingUp, Maximize2, Minimize2, X, Info, Filter, ChevronDown, CalendarDays, Calendar, UserPlus, TrendingDown, XOctagon, Map, Database, Clock } from 'lucide-react';

const TRADUZ_MES = { '01':'JAN', '02':'FEV', '03':'MAR', '04':'ABR', '05':'MAI', '06':'JUN', '07':'JUL', '08':'AGO', '09':'SET', '10':'OUT', '11':'NOV', '12':'DEZ' };
const NAMES_MESES_FULL = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const MODAL_OPTIONS = ['Passeio', 'Fiorino', 'Moto', 'Van'];

// 🔥 VACINA CONTRA ERROS DE DIGITAÇÃO E SUFIXOS
const padronizarHubLocal = (nome) => {
  if (!nome) return "";
  let n = String(nome).trim();
  let nLimpo = n.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, '');
  
  if (nLimpo.includes("ribeiraopretoesta")) return "LM Hub_SP_RibeirãoPretoEstaça";
  if (nLimpo.includes("sumare") && nLimpo.includes("veneza")) return "LM Hub_SP_Sumaré_Nova Veneza";
  
  return n;
};

// CACHE GLOBAL DE DATAS 
const DATE_CACHE = {};
const getCachedParsedDate = (rawDate) => {
  if (!rawDate) return null;
  if (DATE_CACHE[rawDate]) return DATE_CACHE[rawDate];
  
  let isoDate = null;
  let s = String(rawDate).trim();
  if (s.includes('T')) s = s.split('T')[0];
  if (s.includes(' ')) s = s.split(' ')[0];
  
  if (s.includes('/')) {
    const [dia, m, a] = s.split('/');
    isoDate = `${a}-${m.padStart(2, '0')}-${dia.padStart(2, '0')}`;
  } else {
    isoDate = s;
  }

  if (!isoDate) {
    DATE_CACHE[rawDate] = null;
    return null;
  }

  const d = new Date(isoDate + 'T12:00:00');
  const dCopy = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = dCopy.getUTCDay() || 7;
  dCopy.setUTCDate(dCopy.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(dCopy.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((dCopy - yearStart) / 86400000) + 1) / 7);
  
  const semRow = `W-${String(weekNo).padStart(2, '0')}`;
  const mRow = isoDate.substring(0, 7);
  const monthOnly = isoDate.split('-')[1];

  const result = { isoDate, semRow, mRow, monthOnly };
  DATE_CACHE[rawDate] = result;
  return result;
};

// FAST-PATH DE NÚMEROS (Pula regex pesado se não houver vírgula)
const parseNum = (val) => {
  if (!val) return 0;
  if (typeof val === 'number') return val;
  const s = String(val).trim();
  if (s.indexOf(',') === -1) return Number(s) || 0;
  return Number(s.replace(/\./g, '').replace(',', '.')) || 0;
};

export default function FleetHealthCharts({ rawData, historicoFrotaData, firstTripsData, recusasData = [], filtrosGlobais = {} }) {
  const [periodo, setPeriodo] = useState('semana');
  const [fullscreenChart, setFullscreenChart] = useState(null); 

  const [modaisEvol, setModaisEvol] = useState(MODAL_OPTIONS);
  const [modaisConv, setModaisConv] = useState(MODAL_OPTIONS);
  const [modaisRec, setModaisRec] = useState(MODAL_OPTIONS); 
  
  const [isEvolMenuOpen, setIsEvolMenuOpen] = useState(false);
  const [isConvMenuOpen, setIsConvMenuOpen] = useState(false);
  const [isRecMenuOpen, setIsRecMenuOpen] = useState(false); 
  
  const evolMenuRef = useRef(null);
  const convMenuRef = useRef(null);
  const recMenuRef = useRef(null);

  const { regional = [], station = [], turno = [], semana = "", mes = "", dataInicio = "", dataFim = "" } = filtrosGlobais;

  // MAPEAMENTO DO BANCO DE DADOS DE RECUSAS (Coluna K = Índice 10)
  const COL_REC_REG = 2;    
  const COL_REC_HUB = 4;    
  const COL_REC_TURNO = 7;  
  const COL_REC_DATA = 8;   
  const COL_REC_MODAL = 10; 

  useEffect(() => {
    function handleClickOutside(event) {
      if (evolMenuRef.current && !evolMenuRef.current.contains(event.target)) setIsEvolMenuOpen(false);
      if (convMenuRef.current && !convMenuRef.current.contains(event.target)) setIsConvMenuOpen(false);
      if (recMenuRef.current && !recMenuRef.current.contains(event.target)) setIsRecMenuOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const toggleModal = (modal, stateSetter) => {
    stateSetter(prev => prev.includes(modal) ? prev.filter(m => m !== modal) : [...prev, modal]);
  };

  const formatName = (isoKey, p) => {
    if (!isoKey) return "N/A";
    if (p === 'dia') return `${isoKey.split('-')[2]}/${isoKey.split('-')[1]}`;
    if (p === 'mes') return `${TRADUZ_MES[isoKey.split('-')[1]] || isoKey}/${isoKey.split('-')[0].substring(2)}`;
    return isoKey; 
  };

  // =========================================================
  // 1. MOTOR DE KPIs (CONSOLIDAÇÃO E ACÚMULO SEGURO)
  // =========================================================
  const kpis = useMemo(() => {
    let isCurrent = (isoDate, semRow, mRow) => false;
    let isPrevious = (isoDate, semRow, mRow) => false;
    let refLabel = "Geral";

    if (semana) {
      isCurrent = (iso, sem, m) => sem === semana;
      const prevWNum = parseInt(semana.replace('W-', ''), 10) - 1;
      const prevSemana = `W-${String(prevWNum).padStart(2, '0')}`;
      isPrevious = (iso, sem, m) => sem === prevSemana;
      refLabel = semana;
    } else if (mes) {
      isCurrent = (iso, sem, m) => m === mes;
      const prevMNum = parseInt(mes, 10) - 1;
      const prevMes = String(prevMNum).padStart(2, '0');
      isPrevious = (iso, sem, m) => m === prevMes;
      refLabel = NAMES_MESES_FULL[parseInt(mes, 10) - 1] || mes;
    } else if (dataInicio || dataFim) {
      const start = dataInicio || dataFim;
      const end = dataFim || dataInicio;
      isCurrent = (iso, sem, m) => iso >= start && iso <= end;
      
      const dStart = new Date(start + 'T12:00:00');
      const dEnd = new Date(end + 'T12:00:00');
      const diffDays = Math.round((dEnd - dStart) / 86400000) + 1;
      
      const prevDStart = new Date(dStart); prevDStart.setDate(prevDStart.getDate() - diffDays);
      const prevDEnd = new Date(dEnd); prevDEnd.setDate(prevDEnd.getDate() - diffDays);
      
      const prevStartStr = prevDStart.toISOString().split('T')[0];
      const prevEndStr = prevDEnd.toISOString().split('T')[0];
      
      isPrevious = (iso, sem, m) => iso >= prevStartStr && iso <= prevEndStr;
      refLabel = dataInicio === dataFim ? formatName(dataInicio, 'dia') : `${formatName(dataInicio, 'dia')} - ${formatName(dataFim, 'dia')}`;
    } else {
      let maxW = "W-01";
      (rawData || []).slice(1).forEach(row => {
        if (row[2] && row[2].toUpperCase().includes('W-') && row[2].localeCompare(maxW) > 0) maxW = row[2];
      });
      isCurrent = (iso, sem, m) => sem === maxW;
      const prevWNum = parseInt(maxW.replace('W-', ''), 10) - 1;
      const prevSemana = `W-${String(prevWNum).padStart(2, '0')}`;
      isPrevious = (iso, sem, m) => sem === prevSemana;
      refLabel = maxW;
    }

    const hasReg = regional.length > 0;
    const hasSt = station.length > 0;
    const hasTurn = turno.length > 0;

    const currFrotaHubs = {};
    const prevFrotaHubs = {};

    if (historicoFrotaData && historicoFrotaData.length > 1) {
      historicoFrotaData.slice(1).forEach(row => {
        const hubRow = padronizarHubLocal(String(row[3] || "").trim());
        if (hasSt && !station.includes(hubRow)) return;

        const dInfo = getCachedParsedDate(row[2]);
        if (!dInfo) return;

        if (isCurrent(dInfo.isoDate, dInfo.semRow, dInfo.monthOnly)) {
          if (!currFrotaHubs[hubRow] || dInfo.isoDate >= currFrotaHubs[hubRow].date) {
            currFrotaHubs[hubRow] = {
              date: dInfo.isoDate, ativos: parseNum(row[4]), dormentes: parseNum(row[5]),
              risco: parseNum(row[6]), churn: parseNum(row[7])
            };
          }
        }
        if (isPrevious(dInfo.isoDate, dInfo.semRow, dInfo.monthOnly)) {
          if (!prevFrotaHubs[hubRow] || dInfo.isoDate >= prevFrotaHubs[hubRow].date) {
            prevFrotaHubs[hubRow] = {
              date: dInfo.isoDate, ativos: parseNum(row[4]), dormentes: parseNum(row[5]),
              risco: parseNum(row[6]), churn: parseNum(row[7])
            };
          }
        }
      });
    }

    let currAtivos = 0, currDormentes = 0, currRisco = 0, currChurn = 0;
    Object.values(currFrotaHubs).forEach(h => {
      currAtivos += h.ativos; currDormentes += h.dormentes; currRisco += h.risco; currChurn += h.churn;
    });

    let prevAtivos = 0, prevDormentes = 0, prevRisco = 0, prevChurn = 0;
    Object.values(prevFrotaHubs).forEach(h => {
      prevAtivos += h.ativos; prevDormentes += h.dormentes; prevRisco += h.risco; prevChurn += h.churn;
    });

    let currOfertas = 0, currRoteirizadas = 0;
    let prevOfertas = 0, prevRoteirizadas = 0;

    (rawData || []).slice(1).forEach(row => {
      const hubRaw = padronizarHubLocal(String(row[4] || "").trim());
      if (hasReg && !regional.includes(row[1])) return;
      if (hasSt && !station.includes(hubRaw)) return;
      if (hasTurn && !turno.includes(row[5])) return;

      const dInfo = getCachedParsedDate(row[3]);
      if (!dInfo) return;

      if (isCurrent(dInfo.isoDate, dInfo.semRow, dInfo.monthOnly)) {
        currOfertas += parseNum(row[24]);
        currRoteirizadas += parseNum(row[11]);
      }
      if (isPrevious(dInfo.isoDate, dInfo.semRow, dInfo.monthOnly)) {
        prevOfertas += parseNum(row[24]);
        prevRoteirizadas += parseNum(row[11]);
      }
    });

    let currRecusas = 0;
    let prevRecusas = 0;

    (recusasData || []).slice(1).forEach(row => {
      const hub = padronizarHubLocal(String(row[COL_REC_HUB] || "").trim());
      const reg = String(row[COL_REC_REG] || "").trim();
      const trn = String(row[COL_REC_TURNO] || "").trim();
      
      if (hasReg && !regional.includes(reg)) return;
      if (hasSt && !station.includes(hub)) return;
      if (hasTurn && !turno.includes(trn)) return;

      const dInfo = getCachedParsedDate(row[COL_REC_DATA]);
      if (!dInfo) return;

      if (isCurrent(dInfo.isoDate, dInfo.semRow, dInfo.monthOnly)) currRecusas += 1;
      if (isPrevious(dInfo.isoDate, dInfo.semRow, dInfo.monthOnly)) prevRecusas += 1;
    });

    const calcPct = (num, den) => den > 0 ? (num / den) * 100 : 0;
    const calcVarRate = (curr, prev) => curr - prev; 
    const calcVarAbs = (curr, prev) => prev !== 0 ? ((curr - prev) / prev) * 100 : (curr > 0 ? 100 : 0);

    return {
      hasData: (currOfertas > 0 || currRoteirizadas > 0 || currRecusas > 0 || currAtivos > 0),
      recusaDispoPct: calcPct(currRecusas, currOfertas),
      varRecusaDispo: calcVarRate(calcPct(currRecusas, currOfertas), calcPct(prevRecusas, prevOfertas)),
      recusasGlobais: currRecusas,
      ofertasGlobais: currOfertas,
      
      recusaRotPct: calcPct(currRecusas, currRoteirizadas),
      varRecusaRot: calcVarRate(calcPct(currRecusas, currRoteirizadas), calcPct(prevRecusas, prevRoteirizadas)),
      roteirizadasGlobais: currRoteirizadas,

      churnPct: calcPct(currChurn, currAtivos),
      varChurn: calcVarRate(calcPct(currChurn, currAtivos), calcPct(prevChurn, prevAtivos)),
      churn: currChurn,

      dormPct: calcPct(currDormentes, currAtivos),
      varDorm: calcVarRate(calcPct(currDormentes, currAtivos), calcPct(prevDormentes, prevAtivos)),
      dormentes: currDormentes,

      ativos: currAtivos,
      varAtivos: calcVarAbs(currAtivos, prevAtivos),
      
      refLabel: refLabel
    };
  }, [rawData, historicoFrotaData, recusasData, periodo, regional, station, turno, semana, mes, dataInicio, dataFim]);

  // =========================================================
  // 2. MOTOR TEMPORAL (GRÁFICOS) - PANORAMA GLOBAL
  // =========================================================
  const temporalData = useMemo(() => {
    const aggs = {};
    const hasReg = regional.length > 0;
    const hasSt = station.length > 0;
    const hasTurn = turno.length > 0;

    (rawData || []).slice(1).forEach(row => {
      const hubRaw = padronizarHubLocal(String(row[4] || "").trim());
      if (hasReg && !regional.includes(row[1])) return;
      if (hasSt && !station.includes(hubRaw)) return;
      if (hasTurn && !turno.includes(row[5])) return;

      const dInfo = getCachedParsedDate(row[3]);
      if (!dInfo) return;

      let chavePeriodo = dInfo.isoDate;
      if (periodo === 'semana') chavePeriodo = dInfo.semRow;
      if (periodo === 'mes') chavePeriodo = dInfo.mRow;

      if (!aggs[chavePeriodo]) {
        aggs[chavePeriodo] = { 
          name: formatName(chavePeriodo, periodo), sortKey: chavePeriodo,
          totalOfertasGlobais: 0, totalRoteirizadasGlobais: 0, totalRecusasGlobais: 0,
          p_off: 0, u_off: 0, m_off: 0, v_off: 0,
          p_acc: 0, u_acc: 0, m_acc: 0, v_acc: 0,
          p_rec: 0, u_rec: 0, m_rec: 0, v_rec: 0 
        };
      }

      aggs[chavePeriodo].totalOfertasGlobais += parseNum(row[24]); 
      aggs[chavePeriodo].totalRoteirizadasGlobais += parseNum(row[11]); 
      
      aggs[chavePeriodo].u_off += parseNum(row[20]); 
      aggs[chavePeriodo].p_off += parseNum(row[21]); 
      aggs[chavePeriodo].m_off += parseNum(row[22]); 
      aggs[chavePeriodo].v_off += parseNum(row[23]); 
      
      aggs[chavePeriodo].u_acc += parseNum(row[25]); 
      aggs[chavePeriodo].p_acc += parseNum(row[26]); 
      aggs[chavePeriodo].m_acc += parseNum(row[27]); 
      aggs[chavePeriodo].v_acc += parseNum(row[28]); 
    });

    (recusasData || []).slice(1).forEach(row => {
      const hub = padronizarHubLocal(String(row[COL_REC_HUB] || "").trim());
      const reg = String(row[COL_REC_REG] || "").trim();
      const trn = String(row[COL_REC_TURNO] || "").trim();
      const modal = String(row[COL_REC_MODAL] || "").trim().toUpperCase();

      if (hasReg && !regional.includes(reg)) return;
      if (hasSt && !station.includes(hub)) return;
      if (hasTurn && !turno.includes(trn)) return;

      const dInfo = getCachedParsedDate(row[COL_REC_DATA]);
      if (!dInfo) return;

      let chavePeriodo = dInfo.isoDate;
      if (periodo === 'semana') chavePeriodo = dInfo.semRow;
      if (periodo === 'mes') chavePeriodo = dInfo.mRow;

      if (!aggs[chavePeriodo]) {
        aggs[chavePeriodo] = { 
          name: formatName(chavePeriodo, periodo), sortKey: chavePeriodo,
          totalOfertasGlobais: 0, totalRoteirizadasGlobais: 0, totalRecusasGlobais: 0,
          p_off: 0, u_off: 0, m_off: 0, v_off: 0,
          p_acc: 0, u_acc: 0, m_acc: 0, v_acc: 0,
          p_rec: 0, u_rec: 0, m_rec: 0, v_rec: 0 
        };
      }

      aggs[chavePeriodo].totalRecusasGlobais += 1;

      // MAPEAMENTO E CONTAGEM DAS RECUSAS POR MODAL
      if (modal.includes('PASS')) aggs[chavePeriodo].p_rec += 1;
      else if (modal.includes('FIORINO')) aggs[chavePeriodo].u_rec += 1;
      else if (modal.includes('MOTO')) aggs[chavePeriodo].m_rec += 1;
      else if (modal.includes('VAN')) aggs[chavePeriodo].v_rec += 1;
    });

    return Object.values(aggs)
      .map(d => ({ 
        ...d, 
        recusaDispoPctGeral: d.totalOfertasGlobais > 0 ? (d.totalRecusasGlobais / d.totalOfertasGlobais) * 100 : 0 
      }))
      .sort((a, b) => a.sortKey.localeCompare(b.sortKey));
  }, [rawData, recusasData, periodo, regional, station, turno]); 

  // Dados Específicos do Gráfico 1 (Evolução) para recalcular a linha de % dinamicamente
  const chartEvolucaoData = useMemo(() => {
    return temporalData.map(d => {
      const ofertasEvolSel = (modaisEvol.includes('Passeio') ? d.p_off : 0) + 
                             (modaisEvol.includes('Fiorino') ? d.u_off : 0) + 
                             (modaisEvol.includes('Moto') ? d.m_off : 0) + 
                             (modaisEvol.includes('Van') ? d.v_off : 0);
                             
      const recusasEvolSel = (modaisEvol.includes('Passeio') ? d.p_rec : 0) + 
                             (modaisEvol.includes('Fiorino') ? d.u_rec : 0) + 
                             (modaisEvol.includes('Moto') ? d.m_rec : 0) + 
                             (modaisEvol.includes('Van') ? d.v_rec : 0);
                             
      return { 
        ...d, 
        ofertasEvolSel, 
        recusasEvolSel, 
        recusaPctEvol: ofertasEvolSel > 0 ? (recusasEvolSel / ofertasEvolSel) * 100 : 0 
      };
    });
  }, [temporalData, modaisEvol]);

  const chartConversaoData = useMemo(() => {
    return temporalData.map(d => {
      const ofertasSel = (modaisConv.includes('Passeio') ? d.p_off : 0) + (modaisConv.includes('Fiorino') ? d.u_off : 0) + (modaisConv.includes('Moto') ? d.m_off : 0) + (modaisConv.includes('Van') ? d.v_off : 0);
      const accSel = (modaisConv.includes('Passeio') ? d.p_acc : 0) + (modaisConv.includes('Fiorino') ? d.u_acc : 0) + (modaisConv.includes('Moto') ? d.m_acc : 0) + (modaisConv.includes('Van') ? d.v_acc : 0);
      return { ...d, ofertasSel, accSel, convPct: ofertasSel > 0 ? (accSel / ofertasSel) * 100 : 0 };
    });
  }, [temporalData, modaisConv]);

  const firstTripsProcessed = useMemo(() => {
    if (!firstTripsData || firstTripsData.length < 2) return [];
    const headers = firstTripsData[0];
    const dateCols = headers.map((h, i) => ({ label: String(h).trim(), idx: i })).filter(col => col.label.match(/^\d{4}-\d{2}-\d{2}/));
    const aggs = {};
    const hasReg = regional.length > 0;
    const hasSt = station.length > 0;

    firstTripsData.slice(1).forEach(row => {
      const hubRaw = padronizarHubLocal(String(row[2] || "").trim());
      if (hasReg && !regional.includes(row[0])) return; 
      if (hasSt && !station.includes(hubRaw)) return; 

      dateCols.forEach(col => {
        const val = parseNum(row[col.idx]);
        if (val === 0) return;

        const dInfo = getCachedParsedDate(col.label);
        if (!dInfo) return;

        let chavePeriodo = dInfo.isoDate; 
        if (periodo === 'mes') chavePeriodo = dInfo.mRow;
        if (periodo === 'semana') chavePeriodo = dInfo.semRow;

        if (!aggs[chavePeriodo]) {
          aggs[chavePeriodo] = { name: formatName(chavePeriodo, periodo), sortKey: chavePeriodo, totalFirstTrips: 0 };
        }
        aggs[chavePeriodo].totalFirstTrips += val;
      });
    });

    return Object.values(aggs).sort((a, b) => a.sortKey.localeCompare(b.sortKey));
  }, [firstTripsData, periodo, regional, station]); 

  const fInt = (val) => val > 0 ? new Intl.NumberFormat('pt-BR').format(Math.round(val)) : '';
  const fIntTooltip = (val) => new Intl.NumberFormat('pt-BR').format(Math.round(val));

const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      
      // 1. Cálculos de totais baseados no que está sendo exibido no gráfico
      const totalOfertas = payload.reduce((acc, entry) => (entry.name?.includes('Ofertas') ? acc + entry.value : acc), 0);
      const totalRecusas = payload.reduce((acc, entry) => (entry.name?.includes('Recusas') ? acc + entry.value : acc), 0);
      
      const hasOfertas = payload.some(e => e.name?.includes('Ofertas'));
      // Identifica se é o Gráfico 4 (apenas recusas, sem linhas de porcentagem)
      const isGraficoRecusasAbsolutas = payload.some(e => e.name?.includes('Recusas')) && !payload.some(e => e.name?.includes('%'));

      return (
        <div className="bg-white dark:bg-[#1f232d] border border-slate-200 dark:border-gray-800 p-3 rounded-lg shadow-xl z-50">
          <p className="font-black text-slate-800 dark:text-white mb-2">{label}</p>
          
          {payload.map((entry, index) => {
            const isLinhaPorcentagem = entry.name && entry.name.includes('% Recusa');
            
            return (
              <React.Fragment key={index}>
                {/* Lógica do Gráfico 1: Injeta o TOTAL DE OFERTAS antes da linha de % */}
                {isLinhaPorcentagem && hasOfertas && (
                  <p className="font-black text-slate-800 dark:text-white text-sm py-1 mt-1 border-t border-slate-100 dark:border-gray-700">
                    TOTAL DE OFERTAS: {fIntTooltip(totalOfertas)}
                  </p>
                )}
                
                <p style={{ color: entry.color }} className="font-bold text-sm py-0.5">
                  {entry.name}: {entry.name.includes('%') ? `${entry.value.toFixed(1)}%` : fIntTooltip(entry.value)}
                </p>
              </React.Fragment>
            );
          })}

          {/* Lógica do Gráfico 4: Injeta o TOTAL DE RECUSAS no final do tooltip */}
          {isGraficoRecusasAbsolutas && (
             <p className="font-black text-slate-800 dark:text-white text-sm py-1 mt-2 border-t border-slate-100 dark:border-gray-700">
               TOTAL DE RECUSAS: {fIntTooltip(totalRecusas)}
             </p>
          )}
        </div>
      );
    }
    return null;
  };

  // Função auxiliar protegida para desenhar o Total no topo das barras empilhadas
  const renderTopTotalLabel = (props, modaisAtivos, tipo) => {
    const { x, y, width, payload } = props;
    
    // VACINA: Se o Recharts chamar a função de conteúdo customizado antes de montar os dados
    if (!payload) return null;

    let total = 0;

    if (tipo === 'off') {
      if (modaisAtivos.includes('Passeio')) total += (payload.p_off || 0);
      if (modaisAtivos.includes('Fiorino')) total += (payload.u_off || 0);
      if (modaisAtivos.includes('Moto')) total += (payload.m_off || 0);
      if (modaisAtivos.includes('Van')) total += (payload.v_off || 0);
    } else {
      if (modaisAtivos.includes('Passeio')) total += (payload.p_rec || 0);
      if (modaisAtivos.includes('Fiorino')) total += (payload.u_rec || 0);
      if (modaisAtivos.includes('Moto')) total += (payload.m_rec || 0);
      if (modaisAtivos.includes('Van')) total += (payload.v_rec || 0);
    }

    if (total === 0) return null;

    const corTexto = tipo === 'rec' ? '#D0011B' : '#113366';

    return (
      <text x={x + width / 2} y={y - 8} fill={corTexto} fontSize={12} fontWeight="900" textAnchor="middle">
        {typeof fInt === 'function' ? fInt(total) : total}
      </text>
    );
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
  const topVisibleRecModal = [...MODAL_OPTIONS].reverse().find(s => modaisRec.includes(s)); 

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
      
      {/* BANNER DE DOCUMENTAÇÃO E ORIGEM DOS DADOS OPERACIONAIS */}
      <div className="bg-slate-50 dark:bg-[#15171e] rounded-2xl border border-slate-200 dark:border-gray-800 p-5 flex flex-col md:flex-row items-start gap-4 shadow-sm">
        <div className="bg-blue-100 dark:bg-blue-950/40 p-2.5 rounded-xl text-[#113366] dark:text-blue-400 shrink-0">
          <Database size={20} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full text-xs">
          <div className="space-y-1">
            <h4 className="font-black text-[#113366] dark:text-blue-400 uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-[#EE4D2D] rounded-full"></span> Métrica de Recusas
            </h4>
            <p className="text-slate-600 dark:text-gray-300 font-medium">
              Extraído diretamente do Banco de Dados consolidado. Atualização retroativa em <span className="font-bold text-[#EE4D2D]">D-1</span>.
            </p>
          </div>
          <div className="space-y-1 border-t md:border-t-0 md:border-x border-slate-200 dark:border-gray-700 pt-3 md:pt-0 md:px-6">
            <h4 className="font-black text-[#113366] dark:text-blue-400 uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span> Ofertas e Aceites
            </h4>
            <p className="text-slate-600 dark:text-gray-300 font-medium">
              Dados em tempo real (<span className="font-bold text-green-500">D-0</span>) inseridos e consolidados manualmente pelos analistas de controle na malha.
            </p>
          </div>
          <div className="space-y-1 border-t md:border-t-0 pt-3 md:pt-0">
            <h4 className="font-black text-[#113366] dark:text-blue-400 uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-blue-500 rounded-full"></span> Inserção de Drivers
            </h4>
            <p className="text-slate-600 dark:text-gray-300 font-medium">
              Métricas de First Trips geradas em <span className="font-bold text-blue-500">D-1</span>, com leitura direta da planilha oficial <span className="italic font-bold">"[SPC/SPM/SPI] Gestão Drivers"</span>.
            </p>
          </div>
        </div>
      </div>

      {/* 5 CARDS DE KPI */}
      <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-5 gap-4">
        
        <div className="bg-white dark:bg-[#1f232d] p-6 rounded-2xl border border-slate-200 dark:border-gray-800 shadow-sm relative overflow-hidden group flex flex-col justify-between">
          <div className="absolute top-0 right-0 w-16 h-16 bg-orange-100 dark:bg-orange-900/20 rounded-bl-full -mr-8 -mt-8 transition-transform group-hover:scale-110"></div>
          <div>
            <div className="flex justify-between items-start mb-2 relative z-10">
              <span className="text-xs font-black uppercase text-slate-400">Recusa vs Dispo</span>
              <AlertTriangle size={20} className="text-orange-500" />
            </div>
            {!kpis.hasData ? (
              <div className="py-2 text-[11px] font-black uppercase text-slate-300">Sem dados</div>
            ) : (
              <>
                <div className="flex items-end gap-3 relative z-10">
                  <span className="text-3xl font-black text-[#113366] dark:text-white leading-none">{kpis.recusaDispoPct.toFixed(1)}%</span>
                  {renderVarPill(kpis.varRecusaDispo, true)}
                </div>
                <div className="text-[10px] font-bold text-slate-500 uppercase mt-3 pt-3 border-t border-slate-100 dark:border-gray-800 relative z-10 flex justify-between">
                  <span>{fIntTooltip(kpis.recusasGlobais)} de {fIntTooltip(kpis.ofertasGlobais)} Off</span>
                  <span className="text-[#EE4D2D]">{kpis.refLabel}</span>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="bg-white dark:bg-[#1f232d] p-6 rounded-2xl border border-slate-200 dark:border-gray-800 shadow-sm relative overflow-hidden group flex flex-col justify-between">
          <div className="absolute top-0 right-0 w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-bl-full -mr-8 -mt-8 transition-transform group-hover:scale-110"></div>
          <div>
            <div className="flex justify-between items-start mb-2 relative z-10">
              <span className="text-[11px] font-black uppercase text-slate-400">Recusa vs Rotas</span>
              <Map size={20} className="text-red-500" />
            </div>
            {!kpis.hasData ? (
              <div className="py-2 text-[11px] font-black uppercase text-slate-300">Sem dados</div>
            ) : (
              <>
                <div className="flex items-end gap-3 relative z-10">
                  <span className="text-3xl font-black text-[#113366] dark:text-white leading-none">{kpis.recusaRotPct.toFixed(1)}%</span>
                  {renderVarPill(kpis.varRecusaRot, true)}
                </div>
                <div className="text-[10px] font-bold text-slate-500 uppercase mt-3 pt-3 border-t border-slate-100 dark:border-gray-800 relative z-10 flex justify-between">
                  <span>De {fIntTooltip(kpis.roteirizadasGlobais)} Roteirizadas</span>
                  <span className="text-[#EE4D2D]">{kpis.refLabel}</span>
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
                  <span>{fIntTooltip(kpis.churn)} motoristas</span>
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
        {renderChartCard('evolucao', 'Taxa de Rejeição vs Disponibilidade', 'Composição de Ofertas Globais e a curva percentual de Recusas', <TrendingUp className="text-[#EE4D2D]"/>, 
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
              <ComposedChart data={chartEvolucaoData} margin={{ top: 25, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fontWeight: 'bold' }} />
                <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="right" orientation="right" tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11, fill: '#D0011B' }} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ paddingTop: '10px', fontSize: '12px', fontWeight: 'bold' }} />

              {modaisEvol.includes('Passeio') && (
                  <Bar yAxisId="left" dataKey="p_off" stackId="a" name="Ofertas Passeio" fill="#113366" maxBarSize={50} radius={topVisibleModal === 'Passeio' ? [4,4,0,0] : [0,0,0,0]}>
                    <LabelList dataKey="p_off" position="center" fill="#ffffff" fontSize={10} fontWeight="bold" formatter={fInt} />
                    {topVisibleModal === 'Passeio' && <LabelList dataKey="p_off" content={(props) => renderTopTotalLabel(props, modaisEvol, 'off')} />}
                  </Bar>
                )}
                {modaisEvol.includes('Fiorino') && (
                  <Bar yAxisId="left" dataKey="u_off" stackId="a" name="Ofertas Fiorino" fill="#3b82f6" maxBarSize={50} radius={topVisibleModal === 'Fiorino' ? [4,4,0,0] : [0,0,0,0]}>
                    <LabelList dataKey="u_off" position="center" fill="#ffffff" fontSize={10} fontWeight="bold" formatter={fInt} />
                    {topVisibleModal === 'Fiorino' && <LabelList dataKey="u_off" content={(props) => renderTopTotalLabel(props, modaisEvol, 'off')} />}
                  </Bar>
                )}
                {modaisEvol.includes('Moto') && (
                  <Bar yAxisId="left" dataKey="m_off" stackId="a" name="Ofertas Moto" fill="#F5A623" maxBarSize={50} radius={topVisibleModal === 'Moto' ? [4,4,0,0] : [0,0,0,0]}>
                    <LabelList dataKey="m_off" position="center" fill="#78350f" fontSize={10} fontWeight="bold" formatter={fInt} />
                    {topVisibleModal === 'Moto' && <LabelList dataKey="m_off" content={(props) => renderTopTotalLabel(props, modaisEvol, 'off')} />}
                  </Bar>
                )}
                {modaisEvol.includes('Van') && (
                  <Bar yAxisId="left" dataKey="v_off" stackId="a" name="Ofertas Van" fill="#8b5cf6" maxBarSize={50} radius={topVisibleModal === 'Van' ? [4,4,0,0] : [0,0,0,0]}>
                    <LabelList dataKey="v_off" position="center" fill="#ffffff" fontSize={10} fontWeight="bold" formatter={fInt} />
                    {topVisibleModal === 'Van' && <LabelList dataKey="v_off" content={(props) => renderTopTotalLabel(props, modaisEvol, 'off')} />}
                  </Bar>
                )}
                
                <Line yAxisId="right" type="monotone" dataKey="recusaPctEvol" name="% Recusa (vs Dispo)" stroke="#D0011B" strokeWidth={3} dot={{ r: 5, fill: '#fff', stroke: '#D0011B', strokeWidth: 2 }} activeDot={{ r: 7 }} />
              </ComposedChart>
            </ResponsiveContainer>
          ),
          chartEvolucaoData.length
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

        {/* GRÁFICO 4: RECUSAS ABSOLUTAS POR MODAL */}
        {renderChartCard('recusasAbsolutas', 'Volume de Recusas por Modal', 'Quantidade absoluta de rotas rejeitadas ou abandonadas (Fonte: BD Recusas)', <XOctagon className="text-[#D0011B]"/>, 
          (
            <div className="relative" ref={recMenuRef}>
              <div onClick={() => setIsRecMenuOpen(!isRecMenuOpen)} className="bg-white dark:bg-[#1f232d] border border-slate-200 dark:border-gray-700 text-slate-600 dark:text-gray-300 rounded-lg px-4 py-1.5 text-xs font-bold cursor-pointer flex items-center shadow-sm hover:bg-slate-50 transition-colors">
                <Filter size={14} className="text-[#EE4D2D] mr-1.5"/> 
                <span className="mr-2">{modaisRec.length === 4 ? 'Todos os Modais' : `${modaisRec.length} Selecionados`}</span>
                <ChevronDown size={14} className={`transition-transform ${isRecMenuOpen ? 'rotate-180' : ''}`} />
              </div>
              {isRecMenuOpen && (
                <div className="absolute top-[100%] right-0 mt-1 w-48 bg-white dark:bg-[#1f232d] border border-slate-200 dark:border-gray-700 rounded-lg shadow-xl z-50 py-1">
                  {MODAL_OPTIONS.map(modal => (
                    <label key={`rec-${modal}`} className="flex items-center gap-3 px-4 py-2 hover:bg-slate-50 dark:hover:bg-gray-800 cursor-pointer text-xs font-bold text-slate-700 dark:text-gray-200 transition-colors">
                      <input type="checkbox" checked={modaisRec.includes(modal)} onChange={() => toggleModal(modal, setModaisRec)} className="rounded border-slate-300 text-[#113366] focus:ring-[#113366] w-3 h-3 cursor-pointer" /> {modal}
                    </label>
                  ))}
                </div>
              )}
            </div>
          ), 
          (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={temporalData} margin={{ top: 25, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{ fontSize: 12, fontWeight: 'bold' }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ paddingTop: '10px', fontSize: '12px', fontWeight: 'bold' }} />

                {modaisRec.includes('Passeio') && (
                  <Bar dataKey="p_rec" stackId="a" name="Recusas Passeio" fill="#113366" maxBarSize={60} radius={topVisibleRecModal === 'Passeio' ? [4,4,0,0] : [0,0,0,0]}>
                    <LabelList dataKey="p_rec" position="center" fill="#ffffff" fontSize={10} fontWeight="bold" formatter={fInt} />
                    {topVisibleRecModal === 'Passeio' && <LabelList dataKey="p_rec" content={(props) => renderTopTotalLabel(props, modaisRec, 'rec')} />}
                  </Bar>
                )}
                {modaisRec.includes('Fiorino') && (
                  <Bar dataKey="u_rec" stackId="a" name="Recusas Fiorino" fill="#3b82f6" maxBarSize={60} radius={topVisibleRecModal === 'Fiorino' ? [4,4,0,0] : [0,0,0,0]}>
                    <LabelList dataKey="u_rec" position="center" fill="#ffffff" fontSize={10} fontWeight="bold" formatter={fInt} />
                    {topVisibleRecModal === 'Fiorino' && <LabelList dataKey="u_rec" content={(props) => renderTopTotalLabel(props, modaisRec, 'rec')} />}
                  </Bar>
                )}
                {modaisRec.includes('Moto') && (
                  <Bar dataKey="m_rec" stackId="a" name="Recusas Moto" fill="#F5A623" maxBarSize={60} radius={topVisibleRecModal === 'Moto' ? [4,4,0,0] : [0,0,0,0]}>
                    <LabelList dataKey="m_rec" position="center" fill="#78350f" fontSize={10} fontWeight="bold" formatter={fInt} />
                    {topVisibleRecModal === 'Moto' && <LabelList dataKey="m_rec" content={(props) => renderTopTotalLabel(props, modaisRec, 'rec')} />}
                  </Bar>
                )}
                {modaisRec.includes('Van') && (
                  <Bar dataKey="v_rec" stackId="a" name="Recusas Van" fill="#8b5cf6" maxBarSize={60} radius={topVisibleRecModal === 'Van' ? [4,4,0,0] : [0,0,0,0]}>
                    <LabelList dataKey="v_rec" position="center" fill="#ffffff" fontSize={10} fontWeight="bold" formatter={fInt} />
                    {topVisibleRecModal === 'Van' && <LabelList dataKey="v_rec" content={(props) => renderTopTotalLabel(props, modaisRec, 'rec')} />}
                  </Bar>
                )}
              </BarChart>
            </ResponsiveContainer>
          ),
          temporalData.length 
        )}

      </div>
    </div>
  );
}