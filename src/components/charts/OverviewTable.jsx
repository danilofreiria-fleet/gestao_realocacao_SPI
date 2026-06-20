import React, { useMemo, useState, useEffect } from 'react';
import { Database, ShieldAlert, Settings, LayoutDashboard, CalendarDays, Calendar, Filter, Clock, ArrowUpDown, Search, FileText, Target, AlertTriangle } from 'lucide-react';
import { MAPA_REGIONAL_COMPLETO } from '../../constants/regionais';

export default function OverviewTable({ data, rawData, baseData, historicoFrotaData, firstTripsData, filtrosGlobais = {} }) {
  const [viewMode, setViewMode] = useState('semana'); 
  const hojeStr = new Date().toLocaleDateString('en-CA'); 
  
  const [customStartDate, setCustomStartDate] = useState(hojeStr);
  const [customEndDate, setCustomEndDate] = useState(hojeStr);
  
  const [localTurno, setLocalTurno] = useState('ALL');
  const [stationFilter, setStationFilter] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: 'station', direction: 'asc' });

  useEffect(() => {
    if (filtrosGlobais.dataInicio || filtrosGlobais.dataFim) {
       if (filtrosGlobais.dataInicio) setCustomStartDate(filtrosGlobais.dataInicio);
       if (filtrosGlobais.dataFim) setCustomEndDate(filtrosGlobais.dataFim);
       setViewMode('customizado'); 
    } else if (filtrosGlobais.semana) {
       setViewMode('semana'); 
    } else if (filtrosGlobais.mes) {
       setViewMode('mes'); 
    }
  }, [filtrosGlobais.dataInicio, filtrosGlobais.dataFim, filtrosGlobais.semana, filtrosGlobais.mes]);

  const parseNum = (val) => {
    if (val === undefined || val === null || val === '') return 0;
    let s = String(val).trim().replace(/%/g, ''); 
    if (s.includes(',')) return Number(s.replace(/\./g, '').replace(',', '.'));
    return Number(s) || 0;
  };

  const formatInt = (val) => new Intl.NumberFormat('pt-BR').format(Math.round(val || 0));
  const formatPct = (val) => `${(val || 0).toFixed(1).replace('.', ',')}%`;

  const handleSort = (key) => {
    let direction = 'desc';
    if (sortConfig.key === key && sortConfig.direction === 'desc') direction = 'asc';
    setSortConfig({ key, direction });
  };

  const parseUniversalDate = (val) => {
    if (val === null || val === undefined || val === '') return null;
    let s = String(val).trim().split('T')[0].split(' ')[0];
    if (s.includes('/')) {
      const parts = s.split('/');
      if (parts.length === 3) {
        const [dia, m, a] = parts;
        return `${a.length === 2 ? '20'+a : a}-${m.padStart(2, '0')}-${dia.padStart(2, '0')}`;
      }
      return null; 
    }
    return s;
  };

  const getISOWeek = (dateStr) => {
    const isoDate = parseUniversalDate(dateStr);
    if (!isoDate) return "";
    const d = new Date(isoDate + 'T12:00:00');
    if (isNaN(d.getTime())) return ""; 
    
    const dCopy = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const dayNum = dCopy.getUTCDay() || 7;
    dCopy.setUTCDate(dCopy.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(dCopy.getUTCFullYear(),0,1));
    return `W-${String(Math.ceil((((dCopy - yearStart) / 86400000) + 1)/7)).padStart(2, '0')}`;
  };

  const currentWeekStr = useMemo(() => {
    let maxW = 0;
    (rawData || []).forEach(r => {
      const match = String(r[2] || "").match(/\d+/);
      const w = match ? parseInt(match[0], 10) : 0;
      if (w > maxW) maxW = w;
    });
    return `W-${String(maxW || 17).padStart(2, '0')}`;
  }, [rawData]);

  const actualWeekStr = useMemo(() => {
    if (filtrosGlobais?.semana && !String(filtrosGlobais.semana).toLowerCase().includes('semana')) {
      return String(filtrosGlobais.semana).trim().toUpperCase();
    }
    return currentWeekStr;
  }, [filtrosGlobais, currentWeekStr]);

  const actualMonthStr = useMemo(() => {
    // 🔥 DICIONÁRIO DE MESES TURBINADO (Lida com o nome inteiro também)
    const TR_REV = { 'JAN':'01', 'JANEIRO':'01', 'FEV':'02', 'FEVEREIRO':'02', 'MAR':'03', 'MARÇO':'03', 'ABR':'04', 'ABRIL':'04', 'MAI':'05', 'MAIO':'05', 'JUN':'06', 'JUNHO':'06', 'JUL':'07', 'JULHO':'07', 'AGO':'08', 'AGOSTO':'08', 'SET':'09', 'SETEMBRO':'09', 'OUT':'10', 'OUTUBRO':'10', 'NOV':'11', 'NOVEMBRO':'11', 'DEZ':'12', 'DEZEMBRO':'12' };
    if (filtrosGlobais?.mes && !String(filtrosGlobais.mes).toLowerCase().includes('mês')) {
      const mesStr = String(filtrosGlobais.mes).trim().toUpperCase();
      return TR_REV[mesStr] || String(filtrosGlobais.mes).padStart(2, '0');
    }
    return String(new Date().getMonth() + 1).padStart(2, '0');
  }, [filtrosGlobais]);

  const isGlobalFiltroActive = (arr) => arr && arr.length > 0 && !arr.some(v => String(v).toLowerCase().includes('todas') || String(v).toLowerCase().includes('todos'));

  const { overviewData, totals, summaryNarrative } = useMemo(() => {
    const aggs = {};
    
    let prevVolRot = 0, prevVolProc = 0, prevVolExp = 0, prevAtPiso = 0, prevRotasExp = 0;
    let sumRealocPre = 0, sumRealocDur = 0, sumAtPiso = 0, sumNaoExpCoube = 0, sumNaoExpOutros = 0;
    let sumDevFS = 0, sumDevHS = 0, totalRowsCount = 0, totalEstouros = 0;
    let sumU = 0, sumP = 0, sumM = 0, sumV = 0;
    
    const dailyDispo = {};
    const dailyAtivos = {};
    const hubTurnoDays = {}; 
    const hubDaysMap = {}; 

    let prevWeekStr = ""; let prevMonthStr = ""; let pStartIso = ""; let pEndIso = "";
    if (viewMode === 'semana') {
        const wNum = parseInt(actualWeekStr.replace('W-', ''), 10);
        prevWeekStr = `W-${String(wNum - 1).padStart(2, '0')}`;
    } else if (viewMode === 'mes') {
        const mNum = parseInt(actualMonthStr, 10);
        prevMonthStr = String(mNum - 1 === 0 ? 12 : mNum - 1).padStart(2, '0');
    } else if (viewMode === 'customizado') {
        const dStart = new Date(customStartDate + 'T12:00:00');
        const dEnd = new Date(customEndDate + 'T12:00:00');
        const diffDays = Math.round((dEnd - dStart) / 86400000) + 1;
        const pStart = new Date(dStart); pStart.setDate(pStart.getDate() - diffDays);
        const pEnd = new Date(dEnd); pEnd.setDate(pEnd.getDate() - diffDays);
        pStartIso = pStart.toISOString().split('T')[0];
        pEndIso = pEnd.toISOString().split('T')[0];
    }

    const baseMap = {};
    const baseCapMap = {}; 
    (baseData || []).slice(1).forEach(r => {
      const stFull = String(r[0]).trim();
      const turnoLinha = String(r[1] || "").trim().toUpperCase();
      
      const key = `${stFull}|${turnoLinha}`;
      baseCapMap[key] = { capHub: parseNum(r[2]), capFleet: parseNum(r[3]) };

      if (!baseMap[stFull]) baseMap[stFull] = { capHub: 0, capFleet: 0 };
      if (localTurno === 'ALL' || localTurno === turnoLinha) {
        baseMap[stFull].capHub += parseNum(r[2]);
        baseMap[stFull].capFleet += parseNum(r[3]);
      }
    });

    (rawData || []).slice(1).forEach(row => {
      const stationName = String(row[4] || "").trim();
      const regDoHub = MAPA_REGIONAL_COMPLETO[stationName] || String(row[1]).trim();
      const turnoLinha = String(row[5] || "").trim().toUpperCase();
      
      if (!stationName) return;
      if (isGlobalFiltroActive(filtrosGlobais?.regional) && !filtrosGlobais.regional.includes(regDoHub)) return;
      if (isGlobalFiltroActive(filtrosGlobais?.station) && !filtrosGlobais.station.includes(stationName)) return;
      if (isGlobalFiltroActive(filtrosGlobais?.turno) && !filtrosGlobais.turno.includes(turnoLinha)) return;
      if (localTurno !== 'ALL' && turnoLinha !== localTurno) return;

      const rowSemana = String(row[2]).trim().toUpperCase();
      const isoDate = parseUniversalDate(row[3]);
      const rowMes = isoDate?.includes('-') ? isoDate.split('-')[1] : "";

      let isCurr = false; let isPrev = false;
      if (viewMode === 'semana') {
          if (rowSemana === actualWeekStr) isCurr = true;
          if (rowSemana === prevWeekStr) isPrev = true;
      } else if (viewMode === 'mes') {
          if (rowMes === actualMonthStr) isCurr = true;
          if (rowMes === prevMonthStr) isPrev = true;
      } else if (viewMode === 'customizado') {
          if (isoDate && isoDate >= customStartDate && isoDate <= customEndDate) isCurr = true;
          if (isoDate && isoDate >= pStartIso && isoDate <= pEndIso) isPrev = true;
      }

      if (isCurr) {
        if (!aggs[stationName]) aggs[stationName] = { full: stationName, volRot: 0, volProc: 0, volExp: 0, atRot: 0, atCarr: 0, noShowAbs: 0, ofertaTotal: 0 };
        aggs[stationName].volRot += parseNum(row[12]);
        aggs[stationName].volProc += parseNum(row[13]);
        aggs[stationName].volExp += parseNum(row[14]);
        aggs[stationName].atRot += parseNum(row[11]);
        aggs[stationName].atCarr += parseNum(row[29]); 
        aggs[stationName].noShowAbs += Math.abs(parseNum(row[19])); 
        aggs[stationName].ofertaTotal += parseNum(row[24]); 

        sumRealocPre += parseNum(row[51]);
        sumRealocDur += parseNum(row[52]);
        sumAtPiso += parseNum(row[19]);
        sumNaoExpCoube += parseNum(row[54]);
        sumNaoExpOutros += parseNum(row[55]);
        
        sumU += parseNum(row[25]);
        sumP += parseNum(row[26]);
        sumM += parseNum(row[27]);
        sumV += parseNum(row[28]);

        if (isoDate) {
          if (!dailyDispo[isoDate]) dailyDispo[isoDate] = 0;
          dailyDispo[isoDate] += parseNum(row[24]);

          const htKey = `${stationName}|${turnoLinha}`;
          if (!hubTurnoDays[htKey]) hubTurnoDays[htKey] = new Set();
          hubTurnoDays[htKey].add(isoDate);

          if (!hubDaysMap[stationName]) hubDaysMap[stationName] = new Set();
          hubDaysMap[stationName].add(isoDate);
        }
      }

      if (isPrev) {
        prevVolRot += parseNum(row[12]);
        prevVolProc += parseNum(row[13]);
        prevVolExp += parseNum(row[14]);
        prevAtPiso += parseNum(row[19]);
        prevRotasExp += parseNum(row[29]);
      }
    });

    

    const rhMap = {}; 
    (historicoFrotaData || []).slice(1).forEach(row => {
      const rowSemana = String(row[0]).trim().toUpperCase();
      const rowMesBruto = String(row[1]).trim().toUpperCase();
      const isoDate = parseUniversalDate(row[2]);
      const st = String(row[3] || "").trim();

      if (!isoDate || !st) return;

      const regDoHub = MAPA_REGIONAL_COMPLETO[st] || "";
      if (isGlobalFiltroActive(filtrosGlobais?.regional) && !filtrosGlobais.regional.includes(regDoHub)) return;
      if (isGlobalFiltroActive(filtrosGlobais?.station) && !filtrosGlobais.station.includes(st)) return;

      let isCurr = false;
      if (viewMode === 'semana') {
          isCurr = (rowSemana === actualWeekStr);
      } else if (viewMode === 'mes') {
          // Se o mês na aba vier escrito "JUN", a gente checa contra a conversão
          const mesNumNaPlanilha = TRADUZ_MES[rowMesBruto] || isoDate.split('-')[1];
          isCurr = (mesNumNaPlanilha === actualMonthStr);
      } else if (viewMode === 'customizado') {
          // No customizado, aceita TUDO até o final da data, para tirar o snapshot final
          isCurr = (isoDate <= customEndDate);
      }

      if (isCurr) {
        if (!rhMap[st] || isoDate >= rhMap[st].maxDate) {
          rhMap[st] = {
            maxDate: isoDate,
            ativos: parseNum(row[4]),
            dormentes: parseNum(row[5]),
            risco: parseNum(row[6]),
            churn: parseNum(row[7]),
            novos: parseNum(row[8])
          };
        }
      }
    });

   

    const ftMap = {};
    if (firstTripsData && firstTripsData.length > 1) {
      const headers = firstTripsData[0];
      const validCols = headers.map((h, i) => {
          let label = parseUniversalDate(h);
          if (label && !/^\d{4}-\d{2}-\d{2}$/.test(label)) label = null;
          return { label, idx: i };
      }).filter(c => {
          if (!c.label) return false;
          if (viewMode === 'semana') return getISOWeek(c.label) === actualWeekStr;
          if (viewMode === 'mes') return c.label.split('-')[1] === actualMonthStr;
          if (viewMode === 'customizado') return c.label >= customStartDate && c.label <= customEndDate;
          return false;
      });

      firstTripsData.slice(1).forEach(r => {
          const hubName = String(r[2] || "").trim(); 
          let total = 0;
          validCols.forEach(col => { total += parseNum(r[col.idx]); });
          ftMap[hubName] = total;
      });
    }

    let finalArray = Object.keys(aggs).map(fullName => {
      const d = aggs[fullName];
      const rh = rhMap[fullName] || { ativos: 0, dormentes: 0, risco: 0, churn: 0, novos: 0 };
      const diasOperadosHub = hubDaysMap[fullName] ? hubDaysMap[fullName].size : 1;
      
      const bCap = baseMap[fullName] || { capHub: 0, capFleet: 0 };
      const capHubReal = bCap.capHub * diasOperadosHub;
      const capFleetReal = bCap.capFleet * diasOperadosHub;

      if (capFleetReal > 0 && d.volProc > capFleetReal) totalEstouros++;

      return {
        station: fullName,
        volRot: d.volRot, volProc: d.volProc, volExp: d.volExp,
        atRot: d.atRot, atCarr: d.atCarr, noShowAbs: d.noShowAbs,
        noShowPct: d.atRot > 0 ? (d.noShowAbs / d.atRot) * 100 : 0,
        sprRot: d.atRot > 0 ? Math.round(d.volRot / d.atRot) : 0,
        sprExp: d.atCarr > 0 ? Math.round(d.volExp / d.atCarr) : 0,
        ofertas: d.ofertaTotal,
        firstTrips: ftMap[fullName] || 0,
        ativos: rh.ativos,
        dorm: rh.dormentes, 
        risco: rh.risco, 
        churn: rh.churn, 
        novos: rh.novos, 
        capHub: capHubReal,
        capFleet: capFleetReal,
        util: capFleetReal > 0 ? (d.volProc / capFleetReal) * 100 : 0
      };
    }).filter(row => row.station.toLowerCase().includes(stationFilter.toLowerCase()));

    if (sortConfig.key) {
      finalArray.sort((a, b) => {
        const valA = a[sortConfig.key];
        const valB = b[sortConfig.key];
        if (typeof valA === 'string') return sortConfig.direction === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
        return sortConfig.direction === 'asc' ? valA - valB : valB - valA;
      });
    }

    const finalTotals = finalArray.reduce((acc, row) => {
      acc.volRot += row.volRot; acc.volProc += row.volProc; acc.volExp += row.volExp;
      acc.atRot += row.atRot; acc.atCarr += row.atCarr; acc.noShowAbs += row.noShowAbs; 
      acc.ofertas += row.ofertas; acc.firstTrips += row.firstTrips;
      acc.ativos += row.ativos; acc.dorm += row.dorm; acc.risco += row.risco; 
      acc.churn += row.churn; acc.novos += row.novos; acc.capHub += row.capHub; acc.capFleet += row.capFleet;
      return acc;
    }, { volRot: 0, volProc: 0, volExp: 0, atRot: 0, atCarr: 0, noShowAbs: 0, ofertas: 0, firstTrips: 0, ativos: 0, dorm: 0, risco: 0, churn: 0, novos: 0, capHub: 0, capFleet: 0 });

    finalTotals.utilTotal = finalTotals.capFleet > 0 ? (finalTotals.volProc / finalTotals.capFleet) * 100 : 0;

    // =========================================================
    // NARRATIVA DO SUMMARY
    // =========================================================
    let hubNome = "Malha Consolidada";
    if (isGlobalFiltroActive(filtrosGlobais?.station)) {
      hubNome = filtrosGlobais.station.length === 1 ? filtrosGlobais.station[0] : `${filtrosGlobais.station.length} Hubs Selecionados`;
    }
    
    let periodoTexto = "no período selecionado";
    if (viewMode === 'semana') periodoTexto = `na semana ${actualWeekStr}`;
    else if (viewMode === 'mes') periodoTexto = `no mês ${actualMonthStr}`;
    else if (viewMode === 'customizado') periodoTexto = `entre ${customStartDate.split('-').reverse().join('/')} e ${customEndDate.split('-').reverse().join('/')}`;

    const calcVar = (curr, prev) => prev && prev !== 0 ? ((curr - prev) / prev) * 100 : (curr > 0 ? 100 : 0);
    const varRot = calcVar(finalTotals.volRot, prevVolRot);
    const varProc = calcVar(finalTotals.volProc, prevVolProc);
    const varExp = calcVar(finalTotals.volExp, prevVolExp);
    const varAtPiso = calcVar(sumAtPiso, prevAtPiso);
    const varRotasExp = calcVar(finalTotals.atCarr, prevRotasExp);

    const sprAtual = finalTotals.atCarr > 0 ? Math.round(finalTotals.volExp / finalTotals.atCarr) : 0;
    const sprPrev = prevRotasExp > 0 ? Math.round(prevVolExp / prevRotasExp) : 0;
    
    const efiGlobal = finalTotals.volProc > 0 ? (finalTotals.volExp / finalTotals.volProc) * 100 : 0;
    const devFleetGlobal = finalTotals.volProc > 0 ? (sumNaoExpCoube / finalTotals.volProc) * 100 : 0;
    const devHubGlobal = finalTotals.volProc > 0 ? (sumNaoExpOutros / finalTotals.volProc) * 100 : 0;

    const arrDispo = Object.values(dailyDispo);
    const mediaDispo = arrDispo.length > 0 ? arrDispo.reduce((a,b)=>a+b,0) / arrDispo.length : 0;

    let capFleetPeriodo = 0; let capHubPeriodo = 0;
    Object.keys(hubTurnoDays).forEach(htKey => {
      if (baseCapMap[htKey]) {
        const diasOperados = hubTurnoDays[htKey].size;
        capHubPeriodo += baseCapMap[htKey].capHub * diasOperados;
        capFleetPeriodo += baseCapMap[htKey].capFleet * diasOperados;
      }
    });
    const satFleet = capFleetPeriodo > 0 ? (finalTotals.volProc / capFleetPeriodo) * 100 : 0;
    const satHub = capHubPeriodo > 0 ? (finalTotals.volProc / capHubPeriodo) * 100 : 0;

    const adjetivo = (val) => val > 0 ? "um crescimento" : (val < 0 ? "uma redução" : "uma estabilidade");
    const sinal = (val) => val > 0 ? "+" : "";
    const cssCor = (val, invert = false) => {
      if (val === 0) return "text-slate-600 dark:text-gray-300 font-bold";
      const isPos = val > 0;
      const isGood = invert ? !isPos : isPos;
      return isGood ? "text-emerald-600 dark:text-emerald-400 font-bold" : "text-[#D0011B] font-bold";
    };
    
    const formataInt = (val) => new Intl.NumberFormat('pt-BR').format(Math.round(val || 0));

    const narrativa = {
      bloco1: <>
        O <strong>{hubNome}</strong> {periodoTexto} apresentou um total de <strong>{formataInt(finalTotals.atCarr)} rotas expedidas</strong>, com SPR médio de <strong>{formataInt(sprAtual)}</strong>. A frota engajada foi dividida em: <strong>{formataInt(sumM)} motos</strong>, <strong>{formataInt(sumP)} passeios</strong>, <strong>{formataInt(sumU)} utilitários</strong> e <strong>{formataInt(sumV)} vans</strong>.
      </>,
      bloco2: <>
        No acumulado do período, o <strong>Volume Roteirizado</strong> obteve {adjetivo(varRot)} de <span className={cssCor(varRot)}>{sinal(varRot)}{formatPct(Math.abs(varRot))}</span> em relação ao período anterior <span className="text-[10px] text-slate-400">({formataInt(prevVolRot)} anterior X {formataInt(finalTotals.volRot)} atual)</span>.<br/><br/>
        O <strong>Volume Processado</strong> variou <span className={cssCor(varProc)}>{sinal(varProc)}{formatPct(Math.abs(varProc))}</span> <span className="text-[10px] text-slate-400">({formataInt(prevVolProc)} anterior X {formataInt(finalTotals.volProc)} atual)</span>, e o <strong>Volume Expedido</strong> acompanhou com {adjetivo(varExp)} de <span className={cssCor(varExp)}>{sinal(varExp)}{formatPct(Math.abs(varExp))}</span> <span className="text-[10px] text-slate-400">({formataInt(prevVolExp)} anterior X {formataInt(finalTotals.volExp)} atual)</span>.
      </>,
      bloco3: <>
        O SPR médio expedido variou de <strong>{formataInt(sprPrev)}</strong> para <strong>{formataInt(sprAtual)}</strong> pacotes por rota. O total de rotas expedidas saltou de <strong>{formataInt(prevRotasExp)}</strong> para <strong>{formataInt(finalTotals.atCarr)}</strong> <span className="text-slate-500 font-bold">(representando variação de {formatPct(varRotasExp)})</span>.<br/><br/>
        O Hub apresentou <strong>{formataInt(sumAtPiso)} ATs no piso</strong> no período selecionado, variando em <span className={cssCor(varAtPiso, true)}>{sinal(varAtPiso)}{formatPct(Math.abs(varAtPiso))}</span> em relação ao período anterior. Adicionalmente, houve um total de <strong>{formataInt(sumRealocPre + sumRealocDur)} pacotes realocados</strong> ({formataInt(sumRealocPre)} na fase pré e {formataInt(sumRealocDur)} durante a expedição).
      </>,
      bloco4: <>
        A eficiência global de expedição foi de <span className={cssCor(efiGlobal - 95)}>{formatPct(efiGlobal)}</span>. As perdas operacionais refletem <strong>{formatPct(devFleetGlobal)} de Desvio Fleet</strong> e <strong>{formatPct(devHubGlobal)} de Desvio Hub</strong>. A operação contou ainda com <strong>{formataInt(sumNaoExpCoube)} pacotes volumosos não expedidos</strong>.
      </>,
      bloco5: <>
        O painel de controle (RH) consolidou o último registro do período com <strong>{formataInt(finalTotals.ativos)} motoristas ativos</strong>, além de <strong>{formataInt(finalTotals.novos)} novos</strong>, <strong>{formataInt(finalTotals.dorm)} dormentes</strong>, <strong>{formataInt(finalTotals.risco)} em risco</strong> e <strong>{formataInt(finalTotals.churn)} churns</strong>. A disponibilidade na malha obteve uma média diária de <strong>{formataInt(mediaDispo)}</strong> veículos.<br/> 
        O S&OP indica que a operação atingiu a média de <strong>{formatPct(satFleet)} da capacidade de Fleet</strong> e <strong>{formatPct(satHub)} da capacidade do Hub</strong>, resultando em um total de <strong>{totalEstouros} estouros</strong>. No quesito pontualidade, os registros indicam conformidade conforme aba de Tempos.
      </>
    };

    return { overviewData: finalArray, totals: finalTotals, summaryNarrative: narrativa };
  }, [rawData, baseData, historicoFrotaData, firstTripsData, viewMode, actualWeekStr, actualMonthStr, customStartDate, customEndDate, localTurno, filtrosGlobais, stationFilter, sortConfig]);

  const showTotals = viewMode === 'semana' || viewMode === 'mes' || viewMode === 'customizado';

  const SortHeader = ({ label, sortKey, className = "" }) => (
    <th className={`px-3 py-3 cursor-pointer select-none bg-[#EE4D2D] hover:bg-[#D0011B] active:bg-[#a81c12] transition-colors group ${className}`} onClick={() => handleSort(sortKey)}>
      <div className="flex items-center justify-center gap-1 text-white">
        {label} <ArrowUpDown size={12} className={`opacity-30 group-hover:opacity-100 ${sortConfig.key === sortKey ? 'text-yellow-300 opacity-100' : ''}`} />
      </div>
    </th>
  );

  return (
    <div className="flex flex-col gap-6 mt-6">
      
      {/* 1. 🔥 BANNERS INFORMATIVOS (Movidos para o topo, sozinhos) 🔥 */}
      <div className="bg-white dark:bg-[#1f232d] rounded-2xl shadow-sm border border-slate-200 dark:border-gray-800 p-5 md:p-6 print:hidden animate-in fade-in duration-500">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 bg-slate-50 dark:bg-[#15171e] p-5 rounded-xl border border-slate-200 dark:border-gray-700">
          <div className="flex gap-3 items-start">
            <div className="p-2 bg-blue-50 dark:bg-blue-950/30 text-[#113366] dark:text-blue-400 rounded-lg shrink-0"><Database size={16} /></div>
            <div className="flex flex-col gap-1">
              <h4 className="text-[11px] font-black text-slate-800 dark:text-white uppercase tracking-wider">Origem dos Dados</h4>
              <p className="text-[11px] text-slate-500 dark:text-gray-400 font-medium leading-relaxed">Métricas de <strong>1st Trip, Dormentes, Risco e Churn</strong> vêm das planilhas <em>[HUB D&A]</em> e <em>[Gestão Drivers]</em>. O restante das informações operacionais é imputado diretamente pelos analistas de campo.</p>
            </div>
          </div>
          <div className="flex gap-3 items-start border-t lg:border-t-0 lg:border-l border-slate-200 dark:border-gray-700 pt-4 lg:pt-0 lg:pl-6">
            <div className="p-2 bg-red-50 dark:bg-red-950/30 text-[#D0011B] rounded-lg shrink-0"><ShieldAlert size={16} /></div>
            <div className="flex flex-col gap-1">
              <h4 className="text-[11px] font-black text-slate-800 dark:text-white uppercase tracking-wider">Travas de Segurança Operacional</h4>
              <p className="text-[11px] text-slate-500 dark:text-gray-400 font-medium leading-relaxed"><strong className="text-slate-700 dark:text-gray-300">Vol Expedido:</strong> Alerta caso seja maior que o processado. <br/><strong className="text-slate-700 dark:text-gray-300">AT no Piso:</strong> Obrigatório registrar expedição prioritária &gt;D+1&lt;.</p>
            </div>
          </div>
          <div className="flex gap-3 items-start border-t lg:border-t-0 lg:border-l border-slate-200 dark:border-gray-700 pt-4 lg:pt-0 lg:pl-6">
            <div className="p-2 bg-orange-50 dark:bg-orange-950/20 text-[#EE4D2D] rounded-lg shrink-0"><Settings size={16} /></div>
            <div className="flex flex-col gap-1">
              <h4 className="text-[11px] font-black text-slate-800 dark:text-white uppercase tracking-wider">Premissas de CAP</h4>
              <p className="text-[11px] text-slate-500 dark:text-gray-400 font-medium leading-relaxed">A capacidade do Hub na tabela reflete os limites da aba BASE multiplicados pelos dias operados, trazendo a saturação real e exata do período.</p>
            </div>
          </div>
        </div>
      </div>

      {/* 2. EXECUTIVE SUMMARY */}
      {summaryNarrative && (
        <div className="bg-white dark:bg-[#1f232d] rounded-2xl shadow-sm border border-slate-200 dark:border-gray-800 flex flex-col print:break-inside-avoid overflow-hidden animate-in fade-in duration-500">
          <div className="bg-[#113366] px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FileText className="text-white" size={24} />
              <div>
                <h3 className="text-lg font-black text-white uppercase tracking-wider">Resumo Geral</h3>
                <p className="text-blue-200 text-[10px] font-bold uppercase tracking-widest">Leitura Dinâmica do consolidado</p>
              </div>
            </div>
            <Target className="text-blue-300 opacity-50" size={32} />
          </div>
          
          <div className="p-6 md:p-8 flex flex-col gap-5">
            <p className="text-sm text-slate-700 dark:text-gray-300 leading-relaxed font-medium">{summaryNarrative.bloco1}</p>
            <div className="bg-slate-50 dark:bg-[#15171e] border-l-4 border-[#EE4D2D] p-4 rounded-r-xl">
              <p className="text-sm text-slate-700 dark:text-gray-300 leading-relaxed font-medium">{summaryNarrative.bloco2}</p>
            </div>
            <p className="text-sm text-slate-700 dark:text-gray-300 leading-relaxed font-medium">{summaryNarrative.bloco3}</p>
            <p className="text-sm text-slate-700 dark:text-gray-300 leading-relaxed font-medium">{summaryNarrative.bloco4}</p>
            <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 p-4 rounded-xl flex gap-4 items-start mt-2">
              <AlertTriangle className="text-[#113366] dark:text-blue-400 shrink-0 mt-0.5" size={20} />
              <p className="text-sm text-[#113366] dark:text-blue-200 leading-relaxed font-medium">{summaryNarrative.bloco5}</p>
            </div>
          </div>
        </div>
      )}

      {/* 3. OVERVIEW CONSOLIDADO (CONTROLES + TABELA) */}
      <div className="bg-white dark:bg-[#1f232d] rounded-2xl shadow-sm border border-[#113366] overflow-hidden mb-8 animate-in fade-in duration-500">
        
        {/* HEADER DE COMANDOS DA TABELA */}
        <div className="bg-[#113366] py-4 px-6 flex flex-col xl:flex-row justify-between items-center gap-4">
          <h2 className="text-white text-xl font-black flex items-center gap-2 uppercase tracking-tight"><LayoutDashboard className="text-[#EE4D2D]" /> Overview</h2>
          <div className="flex flex-wrap items-center gap-3">
            
            <div className="flex items-center bg-white/10 rounded-lg p-1 mr-2">
              <span className="text-white text-xs font-bold mx-2 flex items-center gap-1"><Clock size={12}/> Turno:</span>
              {['ALL', 'AM', 'PM1', 'PM2'].map(shift => (
                <button key={shift} onClick={() => setLocalTurno(shift)} className={`px-3 py-1 rounded text-xs font-bold transition-all ${localTurno === shift ? 'bg-[#EE4D2D] text-white shadow' : 'text-white/70 hover:text-white'}`}>{shift === 'ALL' ? 'Todos' : shift}</button>
              ))}
            </div>

            <div className="flex bg-white/10 p-1 rounded-lg">
              <button onClick={() => setViewMode('semana')} className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-xs font-bold transition-all ${viewMode === 'semana' ? 'bg-white text-[#113366]' : 'text-white/70 hover:text-white'}`}><CalendarDays size={14}/> Semana</button>
              <button onClick={() => setViewMode('mes')} className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-xs font-bold transition-all ${viewMode === 'mes' ? 'bg-white text-[#113366]' : 'text-white/70 hover:text-white'}`}><Calendar size={14}/> Mês</button>
              <button onClick={() => setViewMode('customizado')} className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-xs font-bold transition-all ${viewMode === 'customizado' ? 'bg-white text-[#113366]' : 'text-white/70 hover:text-white'}`}><Filter size={14}/> Manual (Filtros)</button>
            </div>
            
            {viewMode === 'customizado' && (
              <div className="flex items-center gap-2 bg-white/10 p-1 rounded-lg animate-in fade-in duration-300">
                <input type="date" value={customStartDate} onChange={(e) => setCustomStartDate(e.target.value)} className="bg-white text-[#113366] border-none rounded p-1 text-xs font-bold shadow-sm outline-none cursor-pointer" />
                <span className="text-white text-xs font-bold">até</span>
                <input type="date" value={customEndDate} onChange={(e) => setCustomEndDate(e.target.value)} className="bg-white text-[#113366] border-none rounded p-1 text-xs font-bold shadow-sm outline-none cursor-pointer" />
              </div>
            )}

          </div>
        </div>

        {/* TABELA DE OVERVIEW */}
        <div className="overflow-x-auto overflow-y-auto max-h-[700px] custom-scrollbar">
          <table className="w-full text-center text-[10px] xl:text-[11px] font-bold whitespace-nowrap">
            <thead className="text-white uppercase tracking-widest sticky top-0 z-50 shadow-md">
              <tr>
                <th className="px-3 py-3 text-left sticky left-0 z-[60] bg-[#EE4D2D] hover:bg-[#D0011B] active:bg-[#a81c12] transition-colors min-w-[220px] select-none">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center justify-between cursor-pointer" onClick={() => handleSort('station')}>Station <ArrowUpDown size={12} className={sortConfig.key === 'station' ? 'text-yellow-300' : 'opacity-30'} /></div>
                    <div className="relative mt-1">
                      <Search size={10} className="absolute left-2 top-1/2 -translate-y-1/2 text-[#EE4D2D]" />
                      <input type="text" placeholder="Filtrar Station..." value={stationFilter} onChange={(e) => setStationFilter(e.target.value)} onClick={(e) => e.stopPropagation()} className="w-full bg-white/90 text-[#113366] text-[9px] py-1 pl-6 pr-2 rounded border-none outline-none" />
                    </div>
                  </div>
                </th>
                <SortHeader label="Vol Rot" sortKey="volRot" />
                <SortHeader label="Vol Proc" sortKey="volProc" />
                <SortHeader label="Vol Exp" sortKey="volExp" />
                <SortHeader label="ATs Rot" sortKey="atRot" />
                <SortHeader label="ATs Carr" sortKey="atCarr" />
                <SortHeader label="NoShow (Abs)" sortKey="noShowAbs" className="text-orange-100" />
                <SortHeader label="NoShow (%)" sortKey="noShowPct" className="text-orange-100" />
                <SortHeader label="1st Trips" sortKey="firstTrips" className="text-green-100" />
                <SortHeader label="SPR Rot" sortKey="sprRot" />
                <SortHeader label="SPR Exp" sortKey="sprExp" />
                <SortHeader label="Ofertas" sortKey="ofertas" />
                <SortHeader label="Dormentes" sortKey="dorm" className="text-orange-200" />
                <SortHeader label="Risco" sortKey="risco" className="text-orange-200" />
                <SortHeader label="Churn" sortKey="churn" className="text-red-100" />
                <SortHeader label="Novos" sortKey="novos" className="text-blue-100" />
                <SortHeader label="Cap Hub" sortKey="capHub" />
                <SortHeader label="% Fleet Util" sortKey="util" />
              </tr>
            </thead>
            
            <tbody className="divide-y divide-slate-100 dark:divide-gray-800">
              {overviewData.map((row, idx) => (
                <tr key={idx} className="even:bg-slate-50 odd:bg-white dark:even:bg-gray-800/40 dark:odd:bg-[#15171e] hover:bg-orange-50 dark:hover:bg-gray-700 transition-colors">
                  <td className="px-3 py-3 text-left font-black text-[#113366] dark:text-blue-400 sticky left-0 z-10 even:bg-slate-50 odd:bg-white dark:even:bg-gray-800 dark:odd:bg-[#15171e] border-r border-slate-100 dark:border-gray-800">{row.station}</td>
                  <td className="px-3 py-3 border-l border-slate-100 dark:border-gray-800">{formatInt(row.volRot)}</td>
                  <td className="px-3 py-3">{formatInt(row.volProc)}</td>
                  <td className="px-3 py-3 text-[#113366] dark:text-white">{formatInt(row.volExp)}</td>
                  <td className="px-3 py-3 border-l border-slate-100 dark:border-gray-800">{formatInt(row.atRot)}</td>
                  <td className="px-3 py-3 text-[#113366] dark:text-white">{formatInt(row.atCarr)}</td>
                  <td className="px-3 py-3 text-[#D0011B] border-l border-slate-100 dark:border-gray-800">{formatInt(row.noShowAbs)}</td>
                  <td className="px-3 py-3 text-[#D0011B]">{formatPct(row.noShowPct)}</td>
                  <td className="px-3 py-3 text-green-600 border-l border-slate-100 dark:border-gray-800">{row.firstTrips}</td>
                  <td className="px-3 py-3 border-l border-slate-100 dark:border-gray-800">{formatInt(row.sprRot)}</td>
                  <td className="px-3 py-3">{formatInt(row.sprExp)}</td>
                  <td className="px-3 py-3 border-l border-slate-100 dark:border-gray-800">{formatInt(row.ofertas)}</td>
                  <td className="px-3 py-3 text-orange-400 border-l border-slate-100 dark:border-gray-800">{row.dorm}</td>
                  <td className="px-3 py-3 text-orange-600">{row.risco}</td>
                  <td className="px-3 py-3 text-[#D0011B]">{row.churn}</td>
                  <td className="px-3 py-3 text-blue-500">{row.novos}</td>
                  <td className="px-3 py-3 border-l border-slate-100 dark:border-gray-800">{formatInt(row.capHub)}</td>
                  <td className={`px-3 py-3 font-black ${row.util > 100 ? 'text-[#D0011B]' : 'text-slate-700 dark:text-gray-300'}`}>{formatPct(row.util)}</td>
                </tr>
              ))}
            </tbody>

            {showTotals && (
              <tfoot className="bg-[#113366] text-white font-black text-xs uppercase tracking-wider sticky bottom-0 z-40">
                <tr>
                  <td className="px-3 py-4 text-left sticky left-0 z-50 bg-[#113366] border-r border-white/20">TOTAL (Filtrado)</td>
                  <td className="px-3 py-4 border-l border-white/20">{formatInt(totals.volRot)}</td>
                  <td className="px-3 py-4">{formatInt(totals.volProc)}</td>
                  <td className="px-3 py-4 text-yellow-300">{formatInt(totals.volExp)}</td>
                  <td className="px-3 py-4 border-l border-white/20">{formatInt(totals.atRot)}</td>
                  <td className="px-3 py-4 text-yellow-300">{formatInt(totals.atCarr)}</td>
                  <td className="px-3 py-4 text-red-300 border-l border-white/20">{formatInt(totals.noShowAbs)}</td>
                  <td className="px-3 py-4 text-red-300">{totals.atRot > 0 ? formatPct((totals.noShowAbs / totals.atRot) * 100) : '0,0%'}</td>
                  <td className="px-3 py-4 text-green-300 border-l border-white/20">{totals.firstTrips}</td>
                  <td className="px-3 py-4 border-l border-white/20">{totals.atRot > 0 ? formatInt(totals.volRot / totals.atRot) : '-'}</td>
                  <td className="px-3 py-4">{totals.atCarr > 0 ? formatInt(totals.volExp / totals.atCarr) : '-'}</td>
                  <td className="px-3 py-4 border-l border-white/20">{formatInt(totals.ofertas)}</td>
                  <td className="px-3 py-4 text-orange-200 border-l border-white/20">{totals.dorm}</td>
                  <td className="px-3 py-4 text-orange-300">{totals.risco}</td>
                  <td className="px-3 py-4 text-red-300">{totals.churn}</td>
                  <td className="px-3 py-4 text-blue-300">{totals.novos}</td>
                  <td className="px-3 py-4 border-l border-white/20">{formatInt(totals.capHub)}</td>
                  <td className="px-3 py-4">{formatPct(totals.utilTotal)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}