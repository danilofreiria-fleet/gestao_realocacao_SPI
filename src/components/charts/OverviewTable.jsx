import React, { useMemo, useState } from 'react';
import { LayoutDashboard, CalendarDays, Calendar, Filter, Clock } from 'lucide-react';

const MAPA_REGIONAL = {
  "LM Hub_SP_Campinas_São Martinho": "SPI1", "LM Hub_SP_Leme": "SPI1", "LM Hub_SP_Limeira_Campo Belo": "SPI1",
  "LM Hub_SP_Mogi Mirim": "SPI1", "LM Hub_SP_Piracicaba": "SPI1", "LM Hub_SP_Sumaré_Nova Veneza": "SPI1",
  "LM Hub_SP_Campinas_PqCidade": "SPI1", "LM Hub_SP_Araraquara": "SPO1", "LM Hub_SP_Bauru_Centro": "SPO3",
  "LM Hub_SP_Jaú": "SPO1", "LM Hub_SP_Ribeirão Preto_02": "SPO1", "LM Hub_SP_São Carlos": "SPO1",
  "LM Hub_SP_RibeirãoPretoEstaça": "SPO1", "LM Hub_SP_Barretos": "SPO2", "LM Hub_SP_Franca_Distrito_Indust": "SPO2",
  "LM Hub_SP_São José do Rio P": "SPO2", "LM Hub_SP_Votuporanga": "SPO2", "LM Hub_SP_Botucatu": "SPI3",
  "LM Hub_SP_Atibaia_Ponte_Alta": "SPI2", "LM Hub_SP_Itapetininga": "SPI3", "LM Hub_SP_Itapeva": "SPI3",
  "LM Hub_SP_Jundiaí": "SPI2", "LM Hub_SP_Sorocaba_Região Norte": "SPI3", "LM Hub_SP_Tatuí": "SPI3",
  "LM Hub_SP_Várzea Paulista": "SPI2", "LM Hub_SP_Araçatuba": "SPO2", "LM Hub_SP_Assis": "SPO3",
  "LM Hub_SP_Marília": "SPO3", "LM Hub_SP_Presidente Prudente": "SPO3"
};

export default function OverviewTable({ data, rawData, baseData, firstTripsData, filtrosGlobais = {} }) {
  const [viewMode, setViewMode] = useState('semana'); 
  
  const hojeStr = new Date().toLocaleDateString('en-CA'); 
  const [customDate, setCustomDate] = useState(hojeStr);
  const [localTurno, setLocalTurno] = useState('ALL');

  const parseNum = (val) => {
    let s = String(val || '0').trim().replace(/%/g, ''); 
    if (s.includes(',')) return Number(s.replace(/\./g, '').replace(',', '.'));
    return Number(s) || 0;
  };

  const formatInt = (val) => new Intl.NumberFormat('pt-BR').format(Math.round(val || 0));
  const formatPct = (val) => `${(val || 0).toFixed(2).replace('.', ',')}%`;

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
    
    // 1. Chumba as Stations para manter o layout fixo
    let stationsToDisplay = Object.keys(MAPA_REGIONAL);
    if (filtrosGlobais?.regional) stationsToDisplay = stationsToDisplay.filter(st => MAPA_REGIONAL[st] === filtrosGlobais.regional);
    if (filtrosGlobais?.station) stationsToDisplay = stationsToDisplay.filter(st => st === filtrosGlobais.station);

    stationsToDisplay.forEach(fullName => {
      const shortName = fullName.replace('LM Hub_SP_', '');
      //noShowAbs para separar a quantidade absoluta
      aggs[shortName] = { full: fullName, volRot: 0, volProc: 0, volExp: 0, atRot: 0, atCarr: 0, noShowAbs: 0, capFleetUtil: 0, count: 0, ofertaTotal: 0 };
    });
    
    // 2. Dataset Operacional
    let opSet = [];
    if (viewMode === 'semana') opSet = (rawData || []).filter(r => extractWeekNumber(r[2]) === actualWeekNum);
    else if (viewMode === 'mes') opSet = (rawData || []).filter(r => extrairMesAno(r[3]) === actualMonthData.label);
    else if (viewMode === 'customizado') opSet = (rawData || []).filter(r => extrairDataLocal(r[3]) === customDate);

    if (localTurno !== 'ALL') {
      opSet = opSet.filter(r => String(r[5] || "").trim().toUpperCase() === localTurno);
    }

    opSet.forEach(row => {
      const station = String(row[4] || "").trim(); 
      if (!station) return;
      const shortName = station.replace('LM Hub_SP_', '');
      
      if (aggs[shortName]) {
        aggs[shortName].volRot += parseNum(row[12]);
        aggs[shortName].volProc += parseNum(row[13]);
        aggs[shortName].volExp += parseNum(row[14]);
        aggs[shortName].atRot += parseNum(row[11]);
        aggs[shortName].atCarr += parseNum(row[29]); 
        aggs[shortName].noShowAbs += Math.abs(parseNum(row[19])); // Número bruto de no-shows
        aggs[shortName].ofertaTotal += parseNum(row[24]); 
        aggs[shortName].capFleetUtil += parseNum(row[45]); 
        aggs[shortName].count++;
      }
    });

    // 3. Integração com FIRST_TRIPS
    const firstTripsMap = {};
    if (firstTripsData && firstTripsData.length > 1 && viewMode !== 'customizado') {
      const headers = firstTripsData[0];
      let targetStr = viewMode === 'semana' ? `W-${String(actualWeekNum).padStart(2, '0')}` : `M-${actualMonthData.monthNum}`;
      const targetCol = headers.findIndex(h => h === targetStr);
      if (targetCol !== -1) {
        firstTripsData.slice(1).forEach(r => { firstTripsMap[String(r[0]).trim()] = parseNum(r[targetCol]); });
      }
    }

    // 4. Integração com BASE (Status de Frota - CHUMBADA)
    const baseMap = {};
    const rhVistos = new Set();
    
    (baseData || []).slice(1).forEach(r => {
      const stFull = String(r[0]).trim();
      const turnoLinha = String(r[1] || "").trim().toUpperCase();

      if (!baseMap[stFull]) baseMap[stFull] = { capHub: 0, churn: 0, dorm: 0, risco: 0, novos: 0 };
      
      if (localTurno === 'ALL' || localTurno === turnoLinha) {
        baseMap[stFull].capHub += parseNum(r[2]);   
      }
      
      if (!rhVistos.has(stFull)) {
        rhVistos.add(stFull);
        baseMap[stFull].churn = parseNum(r[10]);   
        baseMap[stFull].dorm = parseNum(r[11]);    
        baseMap[stFull].risco = parseNum(r[14]);   
        baseMap[stFull].novos = parseNum(r[15]);   
      }
    });

    // 5. Calcula as porcentagens finais e formata
    return Object.keys(aggs).sort().map(shortName => {
      const d = aggs[shortName];
      const b = baseMap[d.full] || { capHub: 0, churn: 0, dorm: 0, risco: 0, novos: 0 };
      return {
        station: shortName,
        volRot: d.volRot, volProc: d.volProc, volExp: d.volExp,
        atRot: d.atRot, atCarr: d.atCarr,
        noShowAbs: d.noShowAbs, // Número absoluto
        noShowPct: d.atRot > 0 ? (d.noShowAbs / d.atRot) * 100 : 0, // Cálculo da % real (NoShow / ATs Roteirizadas)
        sprRot: d.atRot > 0 ? d.volRot / d.atRot : 0,
        sprExp: d.atCarr > 0 ? d.volExp / d.atCarr : 0,
        ofertas: d.ofertaTotal,
        firstTrips: viewMode === 'customizado' ? '-' : (firstTripsMap[d.full] || 0),
        dorm: b.dorm, risco: b.risco, churn: b.churn, novos: b.novos, capHub: b.capHub,
        util: d.count > 0 ? d.capFleetUtil / d.count : 0
      };
    });
  }, [rawData, data, baseData, firstTripsData, viewMode, actualWeekNum, actualMonthData, customDate, localTurno, filtrosGlobais]);

  const totals = useMemo(() => {
    return overviewData.reduce((acc, row) => {
      acc.volRot += row.volRot;
      acc.volProc += row.volProc;
      acc.volExp += row.volExp;
      acc.atRot += row.atRot;
      acc.atCarr += row.atCarr;
      acc.noShowAbs += row.noShowAbs; // Soma os no shows brutos
      acc.ofertas += row.ofertas;
      if (row.firstTrips !== '-') acc.firstTrips += row.firstTrips;
      acc.dorm += row.dorm;
      acc.risco += row.risco;
      acc.churn += row.churn;
      acc.novos += row.novos;
      acc.capHub += row.capHub;
      return acc;
    }, { volRot: 0, volProc: 0, volExp: 0, atRot: 0, atCarr: 0, noShowAbs: 0, ofertas: 0, firstTrips: 0, dorm: 0, risco: 0, churn: 0, novos: 0, capHub: 0 });
  }, [overviewData]);

  const showTotals = viewMode === 'semana' || viewMode === 'mes';

  let viewTitleLabel = "";
  if (viewMode === 'semana') viewTitleLabel = `[W-${actualWeekNum}]`;
  else if (viewMode === 'mes') viewTitleLabel = `[${actualMonthData.label}]`;
  else viewTitleLabel = `[${customDate.split('-').reverse().join('/')}]`;

  return (
    <div className="bg-white dark:bg-[#1f232d] rounded-2xl shadow-sm border border-[#113366] overflow-hidden mt-8">
      <div className="bg-[#113366] py-4 px-6 flex flex-col xl:flex-row justify-between items-center gap-4">
        <h2 className="text-white text-xl font-black flex items-center gap-2 uppercase tracking-tight">
          <LayoutDashboard className="text-[#EE4D2D]" /> Overview Consolidado <span className="text-blue-300 font-bold ml-2 text-base">{viewTitleLabel}</span>
        </h2>
        
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center bg-white/10 rounded-lg p-1 mr-2">
            <span className="text-white text-xs font-bold mx-2 flex items-center gap-1"><Clock size={12}/> Turno:</span>
            {['ALL', 'AM', 'PM1', 'PM2'].map(shift => (
              <button 
                key={shift} 
                onClick={() => setLocalTurno(shift)} 
                className={`px-3 py-1 rounded text-xs font-bold transition-all ${localTurno === shift ? 'bg-[#EE4D2D] text-white shadow' : 'text-white/70 hover:text-white'}`}
              >
                {shift === 'ALL' ? 'Todos' : shift}
              </button>
            ))}
          </div>

          <div className="flex bg-white/10 p-1 rounded-lg">
            <button onClick={() => setViewMode('semana')} className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-xs font-bold transition-all ${viewMode === 'semana' ? 'bg-white text-[#113366] shadow' : 'text-white/70 hover:text-white'}`}>
              <CalendarDays size={14}/> Semana
            </button>
            <button onClick={() => setViewMode('mes')} className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-xs font-bold transition-all ${viewMode === 'mes' ? 'bg-white text-[#113366] shadow' : 'text-white/70 hover:text-white'}`}>
              <Calendar size={14}/> Mês
            </button>
            <button onClick={() => setViewMode('customizado')} className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-xs font-bold transition-all ${viewMode === 'customizado' ? 'bg-white text-[#113366] shadow' : 'text-white/70 hover:text-white'}`}>
              <Filter size={14}/> Manual (Filtros)
            </button>
          </div>

          {viewMode === 'customizado' && (
            <input 
              type="date" 
              value={customDate} 
              onChange={(e) => setCustomDate(e.target.value)}
              className="bg-white text-[#113366] border-none rounded-lg p-1.5 text-xs font-bold shadow-sm outline-none cursor-pointer"
            />
          )}
        </div>
      </div>

      {overviewData.length === 0 ? (
        <div className="p-12 text-center font-bold text-slate-400 bg-slate-50 dark:bg-[#15171e]">
          Nenhum dado consolidado encontrado para o filtro selecionado.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-center text-[10px] xl:text-[11px] font-bold whitespace-nowrap">
            <thead className="bg-[#EE4D2D] text-white uppercase tracking-widest border-b-2 border-white/20">
              <tr>
                <th className="px-3 py-3 text-left sticky left-0 z-10 bg-[#EE4D2D]">Station</th>
                <th className="px-3 py-3 border-l border-white/20">Vol Rot</th>
                <th className="px-3 py-3">Vol Proc</th>
                <th className="px-3 py-3">Vol Exp</th>
                <th className="px-3 py-3 border-l border-white/20">ATs Rot</th>
                <th className="px-3 py-3">ATs Carr</th>
                
                {/*Colunas de NoShow (Absoluto e %) */}
                <th className="px-3 py-3 border-l border-white/20">NoShow (Abs)</th>
                <th className="px-3 py-3">NoShow (%)</th>
                
                <th className="px-3 py-3 border-l border-white/20">1st Trips</th>
                <th className="px-3 py-3 border-l border-white/20">SPR Rot</th>
                <th className="px-3 py-3">SPR Exp</th>
                <th className="px-3 py-3 border-l border-white/20">Ofertas</th>
                <th className="px-3 py-3 border-l border-white/20 text-orange-200">Dormentes</th>
                <th className="px-3 py-3 text-orange-300">Risco</th>
                <th className="px-3 py-3 text-red-200">Churn</th>
                <th className="px-3 py-3 text-blue-200">Novos</th>
                <th className="px-3 py-3 border-l border-white/20">Cap Hub</th>
                <th className="px-3 py-3">% Fleet Util</th>
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
                  
                  {/* NoShow Populados */}
                  <td className="px-3 py-3 text-[#D0011B] border-l border-slate-100 dark:border-gray-800">{formatInt(row.noShowAbs)}</td>
                  <td className="px-3 py-3 text-[#D0011B]">{formatPct(row.noShowPct)}</td>
                  
                  <td className="px-3 py-3 text-green-600 border-l border-slate-100 dark:border-gray-800">{row.firstTrips}</td>
                  <td className="px-3 py-3 border-l border-slate-100 dark:border-gray-800">{row.sprRot.toFixed(1)}</td>
                  <td className="px-3 py-3">{row.sprExp.toFixed(1)}</td>
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
              <tfoot className="bg-[#113366] text-white font-black text-xs uppercase tracking-wider">
                <tr>
                  <td className="px-3 py-4 text-left sticky left-0 z-10 bg-[#113366] border-r border-white/20">TOTAL ({viewMode})</td>
                  <td className="px-3 py-4 border-l border-white/20">{formatInt(totals.volRot)}</td>
                  <td className="px-3 py-4">{formatInt(totals.volProc)}</td>
                  <td className="px-3 py-4 text-yellow-300">{formatInt(totals.volExp)}</td>
                  <td className="px-3 py-4 border-l border-white/20">{formatInt(totals.atRot)}</td>
                  <td className="px-3 py-4 text-yellow-300">{formatInt(totals.atCarr)}</td>
                  
                  {/*Totais do NoShow! (Mostra o total absoluto e o % geral do Estado) */}
                  <td className="px-3 py-4 text-red-300 border-l border-white/20">{formatInt(totals.noShowAbs)}</td>
                  <td className="px-3 py-4 text-red-300">{totals.atRot > 0 ? formatPct((totals.noShowAbs / totals.atRot) * 100) : '0,00%'}</td>
                  
                  <td className="px-3 py-4 text-green-300 border-l border-white/20">{totals.firstTrips}</td>
                  <td className="px-3 py-4 border-l border-white/20">-</td>
                  <td className="px-3 py-4">-</td>
                  <td className="px-3 py-4 border-l border-white/20">{formatInt(totals.ofertas)}</td>
                  <td className="px-3 py-4 text-orange-200 border-l border-white/20">{totals.dorm}</td>
                  <td className="px-3 py-4 text-orange-300">{totals.risco}</td>
                  <td className="px-3 py-4 text-red-300">{totals.churn}</td>
                  <td className="px-3 py-4 text-blue-300">{totals.novos}</td>
                  <td className="px-3 py-4 border-l border-white/20">{formatInt(totals.capHub)}</td>
                  <td className="px-3 py-4">-</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </div>
  );
}