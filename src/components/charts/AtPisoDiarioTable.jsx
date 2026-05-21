import React, { useMemo, useState } from 'react';
import { CalendarDays, ChevronDown, ChevronRight, Calendar, Filter } from 'lucide-react';

export default function AtPisoDiarioTable({ data, rawData, atPisoData, filtrosGlobais = {} }) {
  const [viewMode, setViewMode] = useState('semana'); // 'semana' | 'mes' | 'manual'
  const [expandedReg, setExpandedReg] = useState({});

  const parseNum = (val) => {
    let s = String(val || '0').trim();
    if (s.includes(',')) return Number(s.replace(/\./g, '').replace(',', '.'));
    return Number(s) || 0;
  };

  const formatInt = (val) => new Intl.NumberFormat('pt-BR').format(Math.round(val || 0));

  // 🔥 EXTRATOR MATEMÁTICO BLINDADO
  const extractWeekNumber = (str) => {
    const match = String(str || "").trim().match(/^W[- ]?0*(\d+)$/i);
    return match ? parseInt(match[1], 10) : -1;
  };

  const extrairMesAno = (val) => {
    if (!val) return "";
    let s = String(val).trim().split('T')[0].split(' ')[0];
    if (s.includes('/')) {
      const parts = s.split('/');
      return `${parts[1]}/${parts[2]}`;
    }
    if (s.includes('-')) {
      const parts = s.split('-');
      return `${parts[1]}/${parts[0]}`; 
    }
    return "";
  };

  const currentWeekNum = useMemo(() => {
    let maxW = 0;
    const rawSeguro = rawData || [];
    rawSeguro.forEach(r => {
      const w = extractWeekNumber(r[2]);
      if (w > maxW) maxW = w;
    });
    return maxW || 17;
  }, [rawData]);

  const mesAnoAlvo = useMemo(() => {
    const agora = new Date();
    const m = String(agora.getMonth() + 1).padStart(2, '0');
    const a = agora.getFullYear();
    return { label: `${m}/${a}`, monthNum: m };
  }, []);

  const monthToWeeksMap = useMemo(() => {
    const mapStr = {}; 
    const mapNum = {}; 
    const rawSeguro = rawData || [];
    
    rawSeguro.forEach(r => {
      const mesAno = extrairMesAno(r[3]);
      const w = extractWeekNumber(r[2]);
      if (mesAno && w > 0) {
        if (!mapStr[mesAno]) mapStr[mesAno] = new Set();
        mapStr[mesAno].add(w);

        const mesNum = mesAno.split('/')[0];
        if (!mapNum[mesNum]) mapNum[mesNum] = new Set();
        mapNum[mesNum].add(w);
      }
    });
    return { str: mapStr, num: mapNum };
  }, [rawData]);

  const tableData = useMemo(() => {
    if (!atPisoData || atPisoData.length === 0) return [];

    let datasetToProcess = [];
    const rawSeguro = rawData || []; 
    const dataSeguro = data || [];

    let targetWeeks = [];

    if (viewMode === 'semana') {
      datasetToProcess = rawSeguro.filter(row => extractWeekNumber(row[2]) === currentWeekNum);
      targetWeeks = [currentWeekNum];
    } else if (viewMode === 'mes') {
      datasetToProcess = rawSeguro.filter(row => extrairMesAno(row[3]) === mesAnoAlvo.label);
      targetWeeks = Array.from(monthToWeeksMap.str[mesAnoAlvo.label] || []);
    } else if (viewMode === 'manual') {
      datasetToProcess = dataSeguro;
      
      const weeksInData = new Set();
      dataSeguro.forEach(r => {
        const w = extractWeekNumber(r[2]);
        if (w > 0) weeksInData.add(w);
      });

      if (filtrosGlobais?.semana) {
        targetWeeks = [extractWeekNumber(filtrosGlobais.semana)];
      } else if (filtrosGlobais?.mes) {
        targetWeeks = Array.from(monthToWeeksMap.num[filtrosGlobais.mes] || []);
      } else if (weeksInData.size === 1) {
        targetWeeks = [Array.from(weeksInData)[0]]; 
      } else {
        targetWeeks = [currentWeekNum]; 
      }
    }

    // 🔥 NOVO: O Cabeçalho na planilha nova é sempre a linha 0!
    const headerRowIdx = 0; 
    const headerRow = atPisoData[headerRowIdx];

    const availableWeeks = [];
    headerRow.forEach((h, idx) => {
      const w = extractWeekNumber(h);
      if (w > 0) availableWeeks.push({ week: w, colIdx: idx });
    });

    if (availableWeeks.length === 0) return [];
    const maxAvailableWeek = Math.max(...availableWeeks.map(x => x.week));

    const weekColIndices = [];
    targetWeeks.forEach(tw => {
      const match = availableWeeks.find(aw => aw.week === tw);
      if (match) weekColIndices.push(match.colIdx);
    });

    if (weekColIndices.length === 0) {
      const fallbackCol = availableWeeks.find(aw => aw.week === maxAvailableWeek);
      if (fallbackCol) {
        weekColIndices.push(fallbackCol.colIdx);
        targetWeeks = [fallbackCol.week]; 
      }
    }

    const validHubs = new Set();
    datasetToProcess.forEach(r => {
      const hub = String(r[4] || "").trim();
      if (hub) validHubs.add(hub);
    });

    const aggs = {};

    for (let i = headerRowIdx + 1; i < atPisoData.length; i++) {
      const row = atPisoData[i];
      // 🔥 A Planilha nova tem o Hub na Coluna C (Índice 2)
      const rawHubName = String(row[2] || "").trim(); 
      if (!rawHubName) continue;

      if (validHubs.size > 0 && !validHubs.has(rawHubName)) continue;

      // 🔥 A Planilha nova tem a Subregional na Coluna B (Índice 1)
      const subregional = String(row[1] || "Sem Subregional").trim();
      
      let total = 0, seg = 0, ter = 0, qua = 0, qui = 0, sex = 0, sab = 0, dom = 0;

      weekColIndices.forEach(colIdx => {
        total += parseNum(row[colIdx]);
        seg += parseNum(row[colIdx + 1]);
        ter += parseNum(row[colIdx + 2]);
        qua += parseNum(row[colIdx + 3]);
        qui += parseNum(row[colIdx + 4]);
        sex += parseNum(row[colIdx + 5]);
        sab += parseNum(row[colIdx + 6]);
        dom += parseNum(row[colIdx + 7]);
      });

      if (!aggs[subregional]) {
        aggs[subregional] = { regional: subregional, total: 0, seg: 0, ter: 0, qua: 0, qui: 0, sex: 0, sab: 0, dom: 0, hubs: [] };
      }

      aggs[subregional].total += total; aggs[subregional].seg += seg; aggs[subregional].ter += ter;
      aggs[subregional].qua += qua; aggs[subregional].qui += qui; aggs[subregional].sex += sex;
      aggs[subregional].sab += sab; aggs[subregional].dom += dom;

      aggs[subregional].hubs.push({
        name: rawHubName.replace('LM Hub_SP_', ''),
        total, seg, ter, qua, qui, sex, sab, dom
      });
    }

    return Object.values(aggs).sort((a, b) => a.regional.localeCompare(b.regional));
  }, [atPisoData, data, rawData, viewMode, currentWeekNum, mesAnoAlvo, filtrosGlobais, monthToWeeksMap]);

  const toggleExpandReg = (id) => setExpandedReg(prev => ({ ...prev, [id]: !prev[id] }));

  let bannerTitle = "";
  let colSuffix = "";
  if (viewMode === 'semana') {
    bannerTitle = `AT NO PISO DIÁRIO [W-${currentWeekNum}]`;
    colSuffix = "(W)";
  } else if (viewMode === 'mes') {
    bannerTitle = `AT NO PISO DIÁRIO [${mesAnoAlvo.label}]`;
    colSuffix = "(Mês Acum.)";
  } else {
    bannerTitle = `AT NO PISO DIÁRIO [CUSTOMIZADO]`;
    colSuffix = "(Filtros)";
  }

  return (
    <div className="bg-white dark:bg-[#1f232d] rounded-2xl shadow-sm border border-[#113366] overflow-hidden mt-6">
      
      {/* HEADER COM TOGGLE */}
      <div className="bg-[#113366] py-4 px-6 flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="text-white text-xl md:text-2xl font-black tracking-wider flex items-center gap-2 uppercase">
          <CalendarDays className="text-[#EE4D2D]" size={28}/> {bannerTitle}
        </div>
        
        <div className="flex bg-white/10 p-1 rounded-lg">
          <button 
            onClick={() => setViewMode('semana')} 
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-xs font-bold transition-all ${viewMode === 'semana' ? 'bg-white text-[#113366] shadow' : 'text-white/70 hover:text-white'}`}
          >
            <CalendarDays size={14}/> Semana
          </button>
          <button 
            onClick={() => setViewMode('mes')} 
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-xs font-bold transition-all ${viewMode === 'mes' ? 'bg-white text-[#113366] shadow' : 'text-white/70 hover:text-white'}`}
          >
            <Calendar size={14}/> Mês
          </button>
          <button 
            onClick={() => setViewMode('manual')} 
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-xs font-bold transition-all ${viewMode === 'manual' ? 'bg-white text-[#113366] shadow' : 'text-white/70 hover:text-white'}`}
          >
            <Filter size={14}/> Manual (Filtros)
          </button>
        </div>
      </div>

      {tableData.length === 0 ? (
        <div className="p-12 text-center font-bold text-slate-400 bg-slate-50 dark:bg-[#15171e]">
          Nenhum dado de AT Piso encontrado para a {viewMode === 'manual' ? 'seleção atual' : viewMode} no DataSuite. Verifique se as semanas estão preenchidas na aba "AT_PISO".
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-center text-sm whitespace-nowrap">
            <thead className="bg-[#EE4D2D] text-white text-[10px] uppercase font-bold tracking-widest">
              <tr>
                <th className="px-4 py-3 text-left">SUBREGIONAL / HUB</th>
                <th className="px-4 py-3">TOTAL {colSuffix}</th>
                <th className="px-4 py-3 text-slate-100">SEG</th>
                <th className="px-4 py-3 text-slate-100">TER</th>
                <th className="px-4 py-3 text-slate-100">QUA</th>
                <th className="px-4 py-3 text-slate-100">QUI</th>
                <th className="px-4 py-3 text-slate-100">SEX</th>
                <th className="px-4 py-3 text-slate-100">SÁB</th>
                <th className="px-4 py-3 text-slate-100">DOM</th>
              </tr>
            </thead>

            <tbody className="font-bold divide-y divide-slate-100 dark:divide-gray-800">
              {tableData.map(row => (
                <React.Fragment key={row.regional}>
                  <tr onClick={() => toggleExpandReg(row.regional)} className="cursor-pointer hover:bg-slate-50 dark:hover:bg-gray-800/30 transition-colors">
                    <td className="px-4 py-4 text-left flex items-center gap-2 text-[#113366] dark:text-blue-400 text-lg">
                      {expandedReg[row.regional] ? <ChevronDown size={16}/> : <ChevronRight size={16}/>} {row.regional}
                    </td>
                    <td className="px-4 py-4 text-[#EE4D2D] text-lg">{formatInt(row.total)}</td>
                    <td className="px-4 py-4 text-slate-600 dark:text-gray-300">{formatInt(row.seg)}</td>
                    <td className="px-4 py-4 text-slate-600 dark:text-gray-300">{formatInt(row.ter)}</td>
                    <td className="px-4 py-4 text-slate-600 dark:text-gray-300">{formatInt(row.qua)}</td>
                    <td className="px-4 py-4 text-slate-600 dark:text-gray-300">{formatInt(row.qui)}</td>
                    <td className="px-4 py-4 text-slate-600 dark:text-gray-300">{formatInt(row.sex)}</td>
                    <td className="px-4 py-4 text-slate-800 dark:text-gray-100">{formatInt(row.sab)}</td>
                    <td className="px-4 py-4 text-slate-800 dark:text-gray-100">{formatInt(row.dom)}</td>
                  </tr>
                  {expandedReg[row.regional] && row.hubs.map(hub => (
                    <tr key={hub.name} className="bg-slate-50/50 dark:bg-[#15171e] text-xs text-slate-500 dark:text-gray-400">
                      <td className="px-4 py-2 text-left pl-10 font-medium">↳ {hub.name}</td>
                      <td className="px-4 py-2 text-[#EE4D2D] font-bold">{formatInt(hub.total)}</td>
                      <td className="px-4 py-2">{formatInt(hub.seg)}</td>
                      <td className="px-4 py-2">{formatInt(hub.ter)}</td>
                      <td className="px-4 py-2">{formatInt(hub.qua)}</td>
                      <td className="px-4 py-2">{formatInt(hub.qui)}</td>
                      <td className="px-4 py-2">{formatInt(hub.sex)}</td>
                      <td className="px-4 py-2 font-bold">{formatInt(hub.sab)}</td>
                      <td className="px-4 py-2 font-bold">{formatInt(hub.dom)}</td>
                    </tr>
                  ))}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}