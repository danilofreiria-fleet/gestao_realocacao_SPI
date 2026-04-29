import React, { useMemo, useState } from 'react';
import { LayoutDashboard, CalendarDays, Calendar, Filter, Clock, ArrowUpDown, Search } from 'lucide-react';

export default function OverviewTable({ data, rawData, baseData, firstTripsData, historicoFrotaData, filtrosGlobais = {} }) {
  const [viewMode, setViewMode] = useState('semana'); 
  const hojeStr = new Date().toLocaleDateString('en-CA'); 
  
  const [customStartDate, setCustomStartDate] = useState(hojeStr);
  const [customEndDate, setCustomEndDate] = useState(hojeStr);
  
  const [localTurno, setLocalTurno] = useState('ALL');
  const [stationFilter, setStationFilter] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: 'station', direction: 'asc' });

  const parseNum = (val) => {
    let s = String(val || '0').trim().replace(/%/g, ''); 
    if (s.includes(',')) return Number(s.replace(/\./g, '').replace(',', '.'));
    return Number(s) || 0;
  };

  const formatInt = (val) => new Intl.NumberFormat('pt-BR').format(Math.round(val || 0));
  const formatPct = (val) => `${(val || 0).toFixed(2).replace('.', ',')}%`;

  const handleSort = (key) => {
    let direction = 'desc';
    if (sortConfig.key === key && sortConfig.direction === 'desc') direction = 'asc';
    setSortConfig({ key, direction });
  };

  const extractWeekNumber = (str) => {
    const match = String(str || "").trim().match(/^W[- ]?0*(\d+)$/i);
    return match ? parseInt(match[1], 10) : -1;
  };

  const extrairDataLocal = (val) => {
    if (!val) return "";
    let s = String(val).trim().split('T')[0].split(' ')[0];
    if (s.includes('/')) {
      const parts = s.split('/');
      return `${parts[2]}-${parts[1]}-${parts[0]}`; 
    }
    return s;
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
    (rawData || []).forEach(r => {
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

  const actualWeekNum = useMemo(() => {
    if (filtrosGlobais?.semana) return extractWeekNumber(filtrosGlobais.semana);
    return currentWeekNum;
  }, [filtrosGlobais, currentWeekNum]);

  const actualMonthData = useMemo(() => {
    if (filtrosGlobais?.mes) {
      const a = new Date().getFullYear();
      return { label: `${filtrosGlobais.mes}/${a}`, monthNum: filtrosGlobais.mes };
    }
    return mesAnoAlvo;
  }, [filtrosGlobais, mesAnoAlvo]);

  const overviewData = useMemo(() => {
    const aggs = {};
    
    // 1. FILTRAGEM DO CONSOLIDADO PRINCIPAL (Operacional)
    let opSet = [];
    if (viewMode === 'semana') {
      opSet = (rawData || []).filter(r => extractWeekNumber(r[2]) === actualWeekNum);
    } else if (viewMode === 'mes') {
      opSet = (rawData || []).filter(r => extrairMesAno(r[3]) === actualMonthData.label);
    } else if (viewMode === 'customizado') {
      opSet = (rawData || []).filter(r => {
        const rowDateStr = extrairDataLocal(r[3]);
        return rowDateStr >= customStartDate && rowDateStr <= customEndDate;
      });
    }

    if (filtrosGlobais?.regional && filtrosGlobais.regional.length > 0) {
      opSet = opSet.filter(r => filtrosGlobais.regional.includes(r[1]));
    }
    if (filtrosGlobais?.station && filtrosGlobais.station.length > 0) {
      opSet = opSet.filter(r => filtrosGlobais.station.includes(r[4]));
    }
    if (filtrosGlobais?.turno && filtrosGlobais.turno.length > 0) {
      opSet = opSet.filter(r => filtrosGlobais.turno.includes(String(r[5] || "").trim().toUpperCase()));
    }
    if (localTurno !== 'ALL') {
      opSet = opSet.filter(r => String(r[5] || "").trim().toUpperCase() === localTurno);
    }

    opSet.forEach(row => {
      const station = String(row[4] || "").trim();
      if (!station) return;
      
      if (!aggs[station]) {
        aggs[station] = { full: station, volRot: 0, volProc: 0, volExp: 0, atRot: 0, atCarr: 0, noShowAbs: 0, capFleetUtil: 0, count: 0, ofertaTotal: 0 };
      }
      aggs[station].volRot += parseNum(row[12]);
      aggs[station].volProc += parseNum(row[13]);
      aggs[station].volExp += parseNum(row[14]);
      aggs[station].atRot += parseNum(row[11]);
      aggs[station].atCarr += parseNum(row[29]); 
      aggs[station].noShowAbs += Math.abs(parseNum(row[19])); 
      aggs[station].ofertaTotal += parseNum(row[24]); 
      aggs[station].capFleetUtil += parseNum(row[45]); 
      aggs[station].count++; 
    });

    // 2. FILTRAGEM DO HISTÓRICO DE FROTA (Snapshot Mais Recente) 🔥
    const historicoMap = {};
    let histFiltrado = (historicoFrotaData || []).slice(1).filter(r => {
      if (viewMode === 'semana') return extractWeekNumber(r[0]) === actualWeekNum;
      if (viewMode === 'mes') return extrairMesAno(r[2]) === actualMonthData.label;
      if (viewMode === 'customizado') {
        const rowDateStr = extrairDataLocal(r[2]);
        return rowDateStr >= customStartDate && rowDateStr <= customEndDate;
      }
      return true;
    });

    histFiltrado.forEach(r => {
      const stFull = String(r[3] || "").trim();
      if (!stFull) return;
      
      const rowDateStr = extrairDataLocal(r[2]);
      
      // Se não existir essa station ainda ou se a data atual for mais recente que a salva, atualiza os dados
      if (!historicoMap[stFull] || rowDateStr > historicoMap[stFull].lastDate) {
        historicoMap[stFull] = {
          lastDate: rowDateStr,
          dorm: parseNum(r[5]),
          risco: parseNum(r[6]),
          churn: parseNum(r[7]),
          novos: parseNum(r[8])
        };
      }
    });

    // 3. FIRST TRIPS
    const firstTripsMap = {};
    if (firstTripsData && firstTripsData.length > 1 && viewMode !== 'customizado') {
      const headers = firstTripsData[0];
      let targetStr = viewMode === 'semana' ? `W-${String(actualWeekNum).padStart(2, '0')}` : `M-${actualMonthData.monthNum}`;
      const targetCol = headers.findIndex(h => h === targetStr);
      if (targetCol !== -1) {
        firstTripsData.slice(1).forEach(r => { firstTripsMap[String(r[0]).trim()] = parseNum(r[targetCol]); });
      }
    }

    // 4. CAP DA BASE
    const baseMap = {};
    (baseData || []).slice(1).forEach(r => {
      const stFull = String(r[0]).trim();
      const turnoLinha = String(r[1] || "").trim().toUpperCase();
      if (!baseMap[stFull]) baseMap[stFull] = { capHub: 0 };
      
      if (localTurno === 'ALL' || localTurno === turnoLinha) {
        baseMap[stFull].capHub += parseNum(r[2]);   
      }
    });

    // 5. CONSOLIDANDO TUDO
    let finalArray = Object.keys(aggs).map(fullName => {
      const d = aggs[fullName];
      const b = baseMap[fullName] || { capHub: 0 };
      const h = historicoMap[fullName] || { dorm: 0, risco: 0, churn: 0, novos: 0 };
      
      return {
        station: fullName,
        volRot: d.volRot, volProc: d.volProc, volExp: d.volExp,
        atRot: d.atRot, atCarr: d.atCarr,
        noShowAbs: d.noShowAbs,
        noShowPct: d.atRot > 0 ? (d.noShowAbs / d.atRot) * 100 : 0,
        
        sprRot: d.atRot > 0 ? Math.round(d.volRot / d.atRot) : 0,
        sprExp: d.atCarr > 0 ? Math.round(d.volExp / d.atCarr) : 0,
        
        ofertas: d.count > 0 ? Math.round(d.ofertaTotal / d.count) : 0,
        
        firstTrips: viewMode === 'customizado' ? 0 : (firstTripsMap[fullName] || 0),
        
        // Dados puxados da última data disponível no período
        dorm: h.dorm, 
        risco: h.risco, 
        churn: h.churn, 
        novos: h.novos, 
        capHub: b.capHub,
        
        util: d.count > 0 ? (d.capFleetUtil / d.count) : 0
      };
    }).filter(row => row.station.toLowerCase().includes(stationFilter.toLowerCase()));

    if (sortConfig.key) {
      finalArray.sort((a, b) => {
        const valA = a[sortConfig.key];
        const valB = b[sortConfig.key];
        if (typeof valA === 'string') {
          return sortConfig.direction === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
        }
        return sortConfig.direction === 'asc' ? valA - valB : valB - valA;
      });
    }

    return finalArray;
  }, [rawData, data, baseData, firstTripsData, historicoFrotaData, viewMode, actualWeekNum, actualMonthData, customStartDate, customEndDate, localTurno, filtrosGlobais, stationFilter, sortConfig]);

  const totals = useMemo(() => {
    return overviewData.reduce((acc, row) => {
      acc.volRot += row.volRot; acc.volProc += row.volProc; acc.volExp += row.volExp;
      acc.atRot += row.atRot; acc.atCarr += row.atCarr; acc.noShowAbs += row.noShowAbs; 
      acc.ofertas += row.ofertas; if (typeof row.firstTrips === 'number') acc.firstTrips += row.firstTrips;
      
      // Na soma da Regional, esses dados fazem sentido (é a soma do retrato atual de todas as stations)
      acc.dorm += row.dorm; acc.risco += row.risco; acc.churn += row.churn;
      acc.novos += row.novos; acc.capHub += row.capHub;
      
      acc.utilTotal += (row.util || 0);
      acc.rowCount += 1;
      
      return acc;
    }, { volRot: 0, volProc: 0, volExp: 0, atRot: 0, atCarr: 0, noShowAbs: 0, ofertas: 0, firstTrips: 0, dorm: 0, risco: 0, churn: 0, novos: 0, capHub: 0, utilTotal: 0, rowCount: 0 });
  }, [overviewData]);

  const showTotals = viewMode === 'semana' || viewMode === 'mes';

  const SortHeader = ({ label, sortKey, className = "" }) => (
    <th className={`px-3 py-3 cursor-pointer select-none bg-[#EE4D2D] hover:bg-[#D0011B] active:bg-[#a81c12] transition-colors group ${className}`} onClick={() => handleSort(sortKey)}>
      <div className="flex items-center justify-center gap-1 text-white">
        {label} <ArrowUpDown size={12} className={`opacity-30 group-hover:opacity-100 ${sortConfig.key === sortKey ? 'text-yellow-300 opacity-100' : ''}`} />
      </div>
    </th>
  );

  return (
    <div className="bg-white dark:bg-[#1f232d] rounded-2xl shadow-sm border border-[#113366] overflow-hidden mt-8">
      <div className="bg-[#113366] py-4 px-6 flex flex-col xl:flex-row justify-between items-center gap-4">
        <h2 className="text-white text-xl font-black flex items-center gap-2 uppercase tracking-tight"><LayoutDashboard className="text-[#EE4D2D]" /> Overview Consolidado</h2>
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
            <div className="flex items-center gap-2 bg-white/10 p-1 rounded-lg">
              <input type="date" value={customStartDate} onChange={(e) => setCustomStartDate(e.target.value)} className="bg-white text-[#113366] border-none rounded p-1 text-xs font-bold shadow-sm outline-none cursor-pointer" />
              <span className="text-white text-xs font-bold">até</span>
              <input type="date" value={customEndDate} onChange={(e) => setCustomEndDate(e.target.value)} className="bg-white text-[#113366] border-none rounded p-1 text-xs font-bold shadow-sm outline-none cursor-pointer" />
            </div>
          )}
        </div>
      </div>

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
                <td className="px-3 py-3 text-green-600 border-l border-slate-100 dark:border-gray-800">{row.firstTrips === 0 && viewMode === 'customizado' ? '-' : row.firstTrips}</td>
                
                <td className="px-3 py-3 border-l border-slate-100 dark:border-gray-800">{formatInt(row.sprRot)}</td>
                <td className="px-3 py-3">{formatInt(row.sprExp)}</td>
                
                <td className="px-3 py-3 border-l border-slate-100 dark:border-gray-800">{formatInt(row.ofertas)}</td>
                <td className="px-3 py-3 text-orange-400 border-l border-slate-100 dark:border-gray-800">{row.dorm}</td>
                <td className="px-3 py-3 text-orange-600">{row.risco}</td>
                <td className="px-3 py-3 text-[#D0011B]">{row.churn}</td>
                <td className="px-3 py-3 text-blue-500">{row.novos}</td>
                <td className="px-3 py-3 border-l border-slate-100 dark:border-gray-800">{formatInt(row.capHub)}</td>
                <td className={`px-3 py-3 font-black ${row.util > 90 ? 'text-[#D0011B]' : 'text-slate-700 dark:text-gray-300'}`}>{formatPct(row.util)}</td>
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
                <td className="px-3 py-4 text-red-300">{totals.atRot > 0 ? formatPct((totals.noShowAbs / totals.atRot) * 100) : '0,00%'}</td>
                <td className="px-3 py-4 text-green-300 border-l border-white/20">{totals.firstTrips}</td>
                
                <td className="px-3 py-4 border-l border-white/20">{totals.atRot > 0 ? formatInt(totals.volRot / totals.atRot) : '-'}</td>
                <td className="px-3 py-4">{totals.atCarr > 0 ? formatInt(totals.volExp / totals.atCarr) : '-'}</td>
                
                <td className="px-3 py-4 border-l border-white/20">{formatInt(totals.ofertas)}</td>
                <td className="px-3 py-4 text-orange-200 border-l border-white/20">{totals.dorm}</td>
                <td className="px-3 py-4 text-orange-300">{totals.risco}</td>
                <td className="px-3 py-4 text-red-300">{totals.churn}</td>
                <td className="px-3 py-4 text-blue-300">{totals.novos}</td>
                <td className="px-3 py-4 border-l border-white/20">{formatInt(totals.capHub)}</td>
                
                <td className="px-3 py-4">{totals.rowCount > 0 ? formatPct(totals.utilTotal / totals.rowCount) : '-'}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}