import React, { useMemo, useState, useEffect } from 'react';
import { Database, ShieldAlert, Settings, Target, Zap, ChevronDown, ChevronRight, CalendarDays, Calendar, Filter } from 'lucide-react';

// 🔥 IMPORTAÇÃO DINÂMICA DA FONTE ÚNICA DA VERDADE
import { MAPA_REGIONAL_COMPLETO, getHubsPermitidos } from '../../constants/regionais';

const TRADUZ_MES = { '01':'JAN', '02':'FEV', '03':'MAR', '04':'ABR', '05':'MAI', '06':'JUN', '07':'JUL', '08':'AGO', '09':'SET', '10':'OUT', '11':'NOV', '12':'DEZ' };

export default function OnePageSPI({ rawData, data, baseData, historicoFrotaData, firstTripsData, filtrosGlobais = {} }) {
  const [viewMode, setViewMode] = useState('semana'); 
  const [expandedReg, setExpandedReg] = useState({});

  // 🔥 DESCOBRE QUAIS REGIONAIS ESTÃO PERMITIDAS PARA ESTE USUÁRIO (ex: SPM01, SPM02...)
  const regionaisPermitidas = useMemo(() => {
    const regEscolhida = localStorage.getItem("selectedRegional");
    const hubs = getHubsPermitidos(regEscolhida);
    const reg = new Set();
    hubs.forEach(h => {
      if (MAPA_REGIONAL_COMPLETO[h]) reg.add(MAPA_REGIONAL_COMPLETO[h]);
    });
    return Array.from(reg).sort();
  }, []);

  const normalizar = (t) => String(t || "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/lmhub_sp_|hub_sp_|_1/g, "").replace(/\s+/g, '');
  
  const parseNum = (val) => {
    let s = String(val || '0').trim();
    if (s.includes(',')) return Number(s.replace(/\./g, '').replace(',', '.'));
    return Number(s) || 0;
  };

  const formatInt = (val) => new Intl.NumberFormat('pt-BR').format(Math.round(val || 0));
  const formatMil = (val) => (!val || val < 1000) ? formatInt(val) : `${(val / 1000).toFixed(2).replace('.', ',')} mil`;

  // Funções de Data
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
    const TR_REV = { 'JAN':'01', 'FEV':'02', 'MAR':'03', 'MARÇO':'03', 'ABR':'04', 'ABRIL':'04', 'MAI':'05', 'MAIO':'05', 'JUN':'06', 'JUL':'07', 'AGO':'08', 'SET':'09', 'OUT':'10', 'NOV':'11', 'DEZ':'12' };
    if (filtrosGlobais?.mes && !String(filtrosGlobais.mes).toLowerCase().includes('mês')) {
      const mesStr = String(filtrosGlobais.mes).trim().toUpperCase();
      return TR_REV[mesStr] || String(filtrosGlobais.mes).padStart(2, '0');
    }
    return String(new Date().getMonth() + 1).padStart(2, '0');
  }, [filtrosGlobais]);

  const isGlobalFiltroActive = (arr) => arr && arr.length > 0 && !arr.some(v => String(v).toLowerCase().includes('todas') || String(v).toLowerCase().includes('todos'));

  // 🔥 MOTOR DE PROCESSAMENTO UNIFICADO HÍBRIDO
  const onePageData = useMemo(() => {
    const aggs = {};
    
    // Inicializa APENAS as regionais permitidas
    regionaisPermitidas.forEach(r => {
      aggs[r] = { driversOferta: 0, rotasAtsRot: 0, noShowAtsPiso: 0, rhAtivos: 0, rhDormentes: 0, rhChurn: 0, mediaDisp: 0, firstTrips: 0, hubs: {} };
    });

    // 1. FILTRAGEM OPERACIONAL (Volumes)
    let opSet = (viewMode === 'manual' ? data : (rawData || []).filter(row => {
      if (viewMode === 'semana') return String(row[2]).trim().toUpperCase() === actualWeekStr;
      if (viewMode === 'mes') {
        const iso = parseUniversalDate(row[3]);
        return iso && iso.split('-')[1] === actualMonthStr;
      }
      return false;
    }));

    opSet.forEach(row => {
      const station = String(row[4] || "").trim();
      // 🔥 Usa o MAPA_REGIONAL_COMPLETO para achar a qual regional esse hub pertence
      const regional = MAPA_REGIONAL_COMPLETO[station];
      
      // Só processa se a regional existir no grupo de aggs (que já foi filtrado por SPI/SPM no começo)
      if (!regional || !aggs[regional]) return;

      if (!aggs[regional].hubs[station]) {
        aggs[regional].hubs[station] = { driversOferta: 0, rotasAtsRot: 0, noShowAtsPiso: 0, rhAtivos: 0, rhDormentes: 0, rhChurn: 0, mediaDisp: 0, firstTrips: 0 };
      }

      const noShowVal = Math.abs(parseNum(row[19])); 
      aggs[regional].driversOferta += parseNum(row[24]);
      aggs[regional].rotasAtsRot += parseNum(row[11]);
      aggs[regional].noShowAtsPiso += noShowVal;

      aggs[regional].hubs[station].driversOferta += parseNum(row[24]);
      aggs[regional].hubs[station].rotasAtsRot += parseNum(row[11]);
      aggs[regional].hubs[station].noShowAtsPiso += noShowVal;
    });

    // 2. RH HÍBRIDO (Mapeia Hoje e Sobrescreve com Histórico)
    const rhMap = {};
    (baseData || []).slice(1).forEach(r => {
      const st = String(r[0]).trim();
      if (!rhMap[st]) rhMap[st] = { ativos: parseNum(r[9]), churn: parseNum(r[10]), dorm: parseNum(r[11]), mediaDisp: parseNum(r[12]) };
    });

    if (historicoFrotaData && historicoFrotaData.length > 1) {
      historicoFrotaData.slice(1).forEach(row => {
        const rowSemana = String(row[0]).trim().toUpperCase();
        const isoDate = parseUniversalDate(row[2]);
        const st = String(row[3] || "").trim();

        let isPastMatch = false;
        if (viewMode === 'semana') isPastMatch = (rowSemana === actualWeekStr);
        else if (viewMode === 'mes') isPastMatch = (isoDate?.split('-')[1] === actualMonthStr);
        else if (viewMode === 'manual') isPastMatch = (!filtrosGlobais.dataInicio || isoDate >= filtrosGlobais.dataInicio) && (!filtrosGlobais.dataFim || isoDate <= filtrosGlobais.dataFim);

        if (isPastMatch && rhMap[st]) {
            rhMap[st].ativos = parseNum(row[4]);
            rhMap[st].dorm = parseNum(row[5]);
            rhMap[st].churn = parseNum(row[7]);
        }
      });
    }

    Object.entries(rhMap).forEach(([st, info]) => {
      const regional = MAPA_REGIONAL_COMPLETO[st];
      if (!regional || !aggs[regional]) return;
      const hubKey = Object.keys(aggs[regional].hubs).find(h => normalizar(h) === normalizar(st)) || st;
      
      if (!aggs[regional].hubs[hubKey]) {
          aggs[regional].hubs[hubKey] = { driversOferta: 0, rotasAtsRot: 0, noShowAtsPiso: 0, rhAtivos: 0, rhDormentes: 0, rhChurn: 0, mediaDisp: 0, firstTrips: 0 };
      }

      aggs[regional].rhAtivos += info.ativos;
      aggs[regional].rhDormentes += info.dorm;
      aggs[regional].rhChurn += info.churn;
      aggs[regional].mediaDisp += info.mediaDisp;

      aggs[regional].hubs[hubKey].rhAtivos = info.ativos;
      aggs[regional].hubs[hubKey].rhDormentes = info.dorm;
      aggs[regional].hubs[hubKey].rhChurn = info.churn;
      aggs[regional].hubs[hubKey].mediaDisp = info.mediaDisp;
    });

    // 3. FIRST TRIPS
    if (firstTripsData && firstTripsData.length > 1) {
      const headers = firstTripsData[0];
      const validCols = [];
      
      headers.forEach((h, i) => {
          const d = parseUniversalDate(h);
          if (!d) return;
          if (viewMode === 'semana' && getISOWeek(d) === actualWeekStr) validCols.push(i);
          else if (viewMode === 'mes' && d.split('-')[1] === actualMonthStr) validCols.push(i);
          else if (viewMode === 'manual' && (!filtrosGlobais.dataInicio || d >= filtrosGlobais.dataInicio) && (!filtrosGlobais.dataFim || d <= filtrosGlobais.dataFim)) validCols.push(i);
      });

      firstTripsData.slice(1).forEach(row => {
        const st = String(row[2] || "").trim(); // 🔥 Lembrar que aqui o Station está no índice 2
        const regional = MAPA_REGIONAL_COMPLETO[st];
        if (!regional || !aggs[regional]) return;

        const hubKey = Object.keys(aggs[regional].hubs).find(h => normalizar(h) === normalizar(st)) || st;
        if (!aggs[regional].hubs[hubKey]) return;

        let total = 0;
        validCols.forEach(idx => { total += parseNum(row[idx]); });
        
        aggs[regional].firstTrips += total;
        aggs[regional].hubs[hubKey].firstTrips += total;
      });
    }

    // 4. FORMATAÇÃO E FILTRO REGIONAL (Apenas os preenchidos da regional ativa)
    return regionaisPermitidas.filter(r => !isGlobalFiltroActive(filtrosGlobais.regional) || filtrosGlobais.regional.includes(r)).map(reg => {
      const r = aggs[reg];
      let hubsArr = Object.keys(r.hubs).sort().map(hName => {
        const h = r.hubs[hName];
        return { name: hName, driversOferta: h.driversOferta, mediaDisp: h.mediaDisp, rotasDisp: h.rotasAtsRot, noShowPct: h.rotasAtsRot > 0 ? (h.noShowAtsPiso / h.rotasAtsRot) * 100 : 0, ativos: h.rhAtivos, dormentes: h.rhDormentes, churn: h.rhChurn, firstTrips: h.firstTrips };
      });
      
      if (isGlobalFiltroActive(filtrosGlobais.station)) {
         hubsArr = hubsArr.filter(h => filtrosGlobais.station.includes(h.name));
      }

      return { id: reg, ofertaAtual: r.driversOferta, mediaDisp: r.mediaDisp, rotas: r.rotasAtsRot, noShowPct: r.rotasAtsRot > 0 ? (r.noShowAtsPiso / r.rotasAtsRot) * 100 : 0, ativos: r.rhAtivos, dormentes: r.rhDormentes, churn: r.rhChurn, firstTrips: r.firstTrips, hubs: hubsArr };
    }).filter(reg => reg.hubs.length > 0); 

  }, [rawData, data, baseData, historicoFrotaData, firstTripsData, viewMode, actualWeekStr, actualMonthStr, filtrosGlobais, regionaisPermitidas]);

  const toggleExpandReg = (id) => setExpandedReg(prev => ({ ...prev, [id]: !prev[id] }));

  // 🔥 VARIÁVEIS DINÂMICAS DE TÍTULO
  let bannerTitle = "";
  let colSuffix = "";
  if (viewMode === 'semana') {
    bannerTitle = `ONE PAGE SEMANAL [${actualWeekStr}]`;
    colSuffix = "(W)";
  } else if (viewMode === 'mes') {
    bannerTitle = `ONE PAGE MENSAL [M-${actualMonthStr}]`;
    colSuffix = "(M)";
  } else {
    bannerTitle = `ONE PAGE [VISÃO CUSTOMIZADA]`;
    colSuffix = "(F)";
  }

  return (
    <div className="bg-white dark:bg-[#1f232d] rounded-2xl shadow-sm border border-[#113366] overflow-hidden mt-8">
      
      {/* HEADER COM TOGGLE */}
      <div className="bg-[#113366] py-4 px-6 flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="text-white text-xl md:text-2xl font-black tracking-wider flex items-center gap-2 uppercase">
          <Zap className="text-[#EE4D2D]" size={28}/> {bannerTitle}
        </div>
        
        <div className="flex bg-white/10 p-1 rounded-lg">
          <button onClick={() => setViewMode('semana')} className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-xs font-bold transition-all ${viewMode === 'semana' ? 'bg-white text-[#113366] shadow' : 'text-white/70 hover:text-white'}`}>
            <CalendarDays size={14}/> Semana
          </button>
          <button onClick={() => setViewMode('mes')} className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-xs font-bold transition-all ${viewMode === 'mes' ? 'bg-white text-[#113366] shadow' : 'text-white/70 hover:text-white'}`}>
            <Calendar size={14}/> Mês
          </button>
          <button onClick={() => setViewMode('manual')} className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-xs font-bold transition-all ${viewMode === 'manual' ? 'bg-white text-[#113366] shadow' : 'text-white/70 hover:text-white'}`}>
            <Filter size={14}/> Manual (Filtros)
          </button>
        </div>
      </div>

      {/* 🔥 BANNER DE STORYTELLING PARA A GESTÃO: AT NO PISO */}
      <div className="p-5 md:p-6 bg-white dark:bg-[#1f232d] border-b border-slate-200 dark:border-gray-800">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50 dark:bg-[#15171e] p-5 rounded-xl border border-slate-200 dark:border-gray-700">
          
          {/* Pilar 1: Origem */}
          <div className="flex gap-3 items-start">
            <div className="p-2 bg-blue-50 dark:bg-blue-950/30 text-[#113366] dark:text-blue-400 rounded-lg shrink-0">
              <Database size={16} />
            </div>
            <div className="flex flex-col gap-1">
              <h4 className="text-[11px] font-black text-slate-800 dark:text-white uppercase tracking-wider">Origem dos Dados</h4>
              <p className="text-[11px] text-slate-500 dark:text-gray-400 font-medium leading-relaxed">
                As informações desta tabela (AT no Piso Diário) são extraídas e consolidadas diretamente do <strong>Banco de Dados</strong> da operação, refletindo o acúmulo real retido nas bases.
              </p>
            </div>
          </div>

          {/* Pilar 2: Regras e Metas */}
          <div className="flex gap-3 items-start border-t md:border-t-0 md:border-l border-slate-200 dark:border-gray-700 pt-4 md:pt-0 md:pl-6">
            <div className="p-2 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 rounded-lg shrink-0">
              <Target size={16} />
            </div>
            <div className="flex flex-col gap-1">
              <h4 className="text-[11px] font-black text-slate-800 dark:text-white uppercase tracking-wider">Regras de Ouro (Metas)</h4>
              <div className="flex flex-col gap-2 mt-1">
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 dark:text-gray-300">
                  <div className="w-2 h-2 rounded-full bg-emerald-500"></div> Target (Ideal): <strong className="text-slate-800 dark:text-white">Menos de 1% (&lt; 1%)</strong>
                </span>
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 dark:text-gray-300">
                  <div className="w-2 h-2 rounded-full bg-[#D0011B]"></div> Alerta Crítico: <strong className="text-slate-800 dark:text-white">Igual ou maior a 1% (&ge; 1%)</strong>
                </span>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* TABELA */}
      <div className="overflow-x-auto">
        <table className="w-full text-center text-sm whitespace-nowrap">
          <thead className="bg-[#EE4D2D] text-white text-[10px] uppercase font-bold tracking-widest">
            <tr>
              <th className="px-4 py-3 text-left">SUBREGIONAL</th>
              <th className="px-4 py-3">DISPO. TOTAL {colSuffix}</th>
              <th className="px-4 py-3 bg-white/10">DISPO. MÉDIA</th>
              <th className="px-4 py-3">TOTAL ROTAS {colSuffix}</th>
              <th className="px-4 py-3">NO SHOW</th>
              <th className="px-4 py-3 border-l border-white/20">ATIVOS</th>
              <th className="px-4 py-3 text-orange-200">DORMENTES</th>
              <th className="px-4 py-3 text-red-200">CHURN</th>
              <th className="px-4 py-3 bg-white/10 border-l border-white/20">1ST TRIPS {colSuffix}</th>
            </tr>
          </thead>
          <tbody className="font-bold divide-y divide-slate-100 dark:divide-gray-800">
            {onePageData.length === 0 ? (
               <tr>
                 <td colSpan="9" className="p-8 text-center text-slate-400 font-bold">Nenhum dado encontrado para a regional selecionada neste período.</td>
               </tr>
            ) : (
              onePageData.map(row => (
                <React.Fragment key={row.id}>
                  <tr onClick={() => toggleExpandReg(row.id)} className="cursor-pointer hover:bg-slate-50 dark:hover:bg-gray-800 transition-colors">
                    <td className="px-4 py-4 text-left flex items-center gap-2 text-[#EE4D2D] text-lg">
                      {expandedReg[row.id] ? <ChevronDown size={16}/> : <ChevronRight size={16}/>} {row.id}
                    </td>
                    <td className="px-4 py-4">{formatInt(row.ofertaAtual)}</td>
                    <td className="px-4 py-4 bg-slate-50/50 dark:bg-gray-800">{formatInt(row.mediaDisp)}</td>
                    <td className="px-4 py-4">{formatInt(row.rotas)}</td>
                    <td className={`px-4 py-4 ${row.noShowPct > 1 ? 'text-[#D0011B]' : 'text-green-600'}`}>{row.noShowPct.toFixed(2)}%</td>
                    <td className="px-4 py-4 border-l dark:border-gray-700">{formatMil(row.ativos)}</td>
                    <td className="px-4 py-4 text-orange-600">{formatMil(row.dormentes)}</td>
                    <td className="px-4 py-4 text-[#D0011B]">{formatMil(row.churn)}</td>
                    <td className="px-4 py-4 border-l dark:border-gray-700 bg-slate-50/50 dark:bg-gray-800 text-[#113366] dark:text-blue-400 text-base">{formatInt(row.firstTrips)}</td>
                  </tr>
                  {expandedReg[row.id] && row.hubs.map(hub => (
                    <tr key={hub.name} className="bg-slate-50/50 dark:bg-[#15171e] text-xs text-slate-500 dark:text-gray-400">
                      <td className="px-4 py-2 text-left pl-10">↳ {hub.name}</td>
                      <td className="px-4 py-2">{formatInt(hub.driversOferta)}</td>
                      <td className="px-4 py-2 font-bold bg-white/5">{formatInt(hub.mediaDisp)}</td>
                      <td className="px-4 py-2">{formatInt(hub.rotasDisp)}</td>
                      <td className={`px-4 py-2 font-bold ${hub.noShowPct > 1 ? 'text-[#D0011B]' : 'text-green-600'}`}>{hub.noShowPct.toFixed(2)}%</td>
                      <td className="px-4 py-2 border-l dark:border-gray-700">{formatInt(hub.ativos)}</td>
                      <td className="px-4 py-2">{formatInt(hub.dormentes)}</td>
                      <td className="px-4 py-2">{formatInt(hub.churn)}</td>
                      <td className="px-4 py-2 font-bold border-l dark:border-gray-700 bg-white/5 text-[#113366] dark:text-blue-400">{formatInt(hub.firstTrips)}</td>
                    </tr>
                  ))}
                </React.Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );}