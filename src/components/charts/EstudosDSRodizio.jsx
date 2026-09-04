import React, { useState, useMemo } from 'react';
import { 
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, ComposedChart, LabelList 
} from 'recharts';
import { TrendingUp, TrendingDown, Users, Calendar, Activity } from 'lucide-react';
import { MAPA_REGIONAL_COMPLETO } from '../../constants/regionais';

// Funções de Padronização
const padronizarHubLocal = (nome) => {
  if (!nome) return "";
  let n = String(nome).trim();
  let nLimpo = n.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, '');
  
  if (nLimpo.includes("ribeiraopretoesta")) return "LM Hub_SP_RibeirãoPretoEstaça";
  if (nLimpo.includes("sumare") && nLimpo.includes("veneza")) return "LM Hub_SP_Sumaré_Nova Veneza";
  
  return n;
};

const COL = {
  HUB: 0,              // A = 0
  REGIONAL: 1,         // B = 1
  DATA: 2,             // C = 2
  TOTAL_CARREGADO: 6,  // G = 6
  DRIVERS_UNICOS: 7,   // H = 7
  REUTILIZACAO: 12,    // M = 12
  ADERENCIA_SPR: 17,   // R = 17
  DS_TOTAL: 20,        // U = 20
  DS_D0: 21,           // V = 21
  AT_NO_PISO: 23,      // X = 23
  SEMANA: 29           // AD = 29
};

const parseDS = (val) => {
  if (val === null || val === undefined || val === '') return 0;
  if (typeof val === 'number') return val > 1 ? val / 100 : val;
  let s = String(val).trim().replace(/%/g, '');
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  let n = Number(s);
  if (isNaN(n)) return 0;
  return n > 1 ? n / 100 : n; 
};

// Tooltip Customizado
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload || !payload.length) return null;

  return (
    <div className="bg-white dark:bg-[#1f232d] border border-slate-200 dark:border-gray-700 p-3 rounded-xl shadow-xl text-xs text-slate-800 dark:text-gray-100 min-w-[180px]">
      <p className="font-black mb-2 text-[#113366] dark:text-blue-400 border-b border-slate-100 dark:border-gray-700/60 pb-1">
        {label}
      </p>
      <div className="space-y-1.5">
        {payload.map((item, idx) => {
          let valStr = item.value;
          if (item.name && item.name.includes('Variação')) {
            valStr = `${item.value > 0 ? '+' : ''}${Number(item.value).toFixed(2)}%`;
          } else if (
            item.name && (
              item.name.startsWith('DS ') || 
              item.name.includes('Reutilização') || 
              item.name.includes('Aderência') || 
              item.name.includes('At no Piso')
            )
          ) {
            valStr = `${(Number(item.value) * 100).toFixed(2)}%`;
          } else if (typeof item.value === 'number') {
            valStr = item.value.toLocaleString('pt-BR');
          }

          return (
            <div key={idx} className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-1.5">
                <span 
                  className="w-2.5 h-2.5 rounded-full" 
                  style={{ backgroundColor: item.color || item.fill }} 
                />
                <span className="text-slate-600 dark:text-gray-300 font-medium">{item.name}:</span>
              </div>
              <span className="font-bold text-slate-900 dark:text-white">{valStr}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default function EstudosDSRodizio({ dsHubData = [], cadastroFrotaData = [], dsMotoristaData = [], filtrosGlobais }) {
  const [dsType, setDsType] = useState('total'); 
  const [timeView, setTimeView] = useState('semana'); 
  const [opMetric, setOpMetric] = useState('todas'); 

  // Mapeamento de cadastro de frota (Chave -> Nome / Placa)
  const mapaFrota = useMemo(() => {
    const mapa = {};
    if (!cadastroFrotaData || !cadastroFrotaData.length) return mapa;

    cadastroFrotaData.forEach(row => {
      if (!row || row.length === 0) return;
      const idOuCpf = String(row[0] || '').trim().toLowerCase(); // A = 0 (DRIVER ID)
      const nome = String(row[1] || 'Motorista').trim();         // B = 1 (DRIVER NAME)
      const placa = String(row[4] || '').trim();                // E = 4 (PLACA)

      if (idOuCpf) {
        mapa[idOuCpf] = { nome, placa };
      }
    });
    return mapa;
  }, [cadastroFrotaData]);

  // Processamento Principal de Dados
  const { 
    dsGlobalData, 
    diasSemanaData, 
    ultimas3SemanasStation, 
    resumoTrendStation 
  } = useMemo(() => {
    
    // ==========================================
    // 1. DADOS DE DS POR MOTORISTA (dsMotoristaData)
    // ==========================================
    let arrayDriversTop = [];
    if (dsMotoristaData && dsMotoristaData.length > 1) {
      const headers = dsMotoristaData[0];
      const weeksMap = {};
      
      headers.forEach((h, idx) => {
        const str = String(h).trim().toUpperCase();
        const match = str.match(/W\s*(\d+)/);
        if (match) {
          const semKey = `W${match[1]}`;
          if (!weeksMap[semKey]) weeksMap[semKey] = { totalIdx: -1, d0Idx: -1 };
          if (str.includes('TOTAL')) weeksMap[semKey].totalIdx = idx;
          if (str.includes('D-0') || str.includes('D0')) weeksMap[semKey].d0Idx = idx;
        }
      });

      const sortedWeeks = Object.keys(weeksMap).sort((a, b) => Number(a.replace('W', '')) - Number(b.replace('W', '')));
      
      let targetWeeks = [];
      if (filtrosGlobais?.semana) {
        let reqWeek = String(filtrosGlobais.semana).toUpperCase();
        if (!reqWeek.startsWith('W')) reqWeek = 'W' + reqWeek;
        if (weeksMap[reqWeek]) targetWeeks = [reqWeek];
      } else {
        targetWeeks = sortedWeeks.slice(-3);
      }

      const groupedDr = {};
      
      for (let i = 1; i < dsMotoristaData.length; i++) {
        const row = dsMotoristaData[i];
        const driverId = String(row[0] || '').trim();
        if (!driverId || driverId.toLowerCase() === 'driver id') continue;

        const regional = String(row[2] || '').trim();
        const hubBruto = String(row[4] || '').trim();
        const hub = padronizarHubLocal(hubBruto);

        if (filtrosGlobais?.regional?.length > 0 && !filtrosGlobais.regional.includes(regional)) continue;
        if (filtrosGlobais?.station?.length > 0 && !filtrosGlobais.station.includes(hub) && !filtrosGlobais.station.includes(hubBruto)) continue;

        let somaTotal = 0, qtdTotal = 0, somaD0 = 0, qtdD0 = 0;

        targetWeeks.forEach(w => {
          const wInfo = weeksMap[w];
          const valTotalRaw = wInfo.totalIdx > -1 ? row[wInfo.totalIdx] : null;
          const valD0Raw = wInfo.d0Idx > -1 ? row[wInfo.d0Idx] : null;

          if (valTotalRaw !== undefined && valTotalRaw !== null && valTotalRaw !== '') {
            somaTotal += parseDS(valTotalRaw);
            qtdTotal++;
          }
          if (valD0Raw !== undefined && valD0Raw !== null && valD0Raw !== '') {
            somaD0 += parseDS(valD0Raw);
            qtdD0++;
          }
        });

        if (qtdTotal > 0 || qtdD0 > 0) {
          const idLower = driverId.toLowerCase();
          const infoFrota = mapaFrota[idLower] || {};
          const nomeDriver = infoFrota.nome || driverId;
          const placaDriver = infoFrota.placa ? ` (${infoFrota.placa})` : '';
          const displayName = `${nomeDriver}${placaDriver}`;

          if (!groupedDr[driverId]) {
            groupedDr[driverId] = {
              name: displayName.length > 20 ? displayName.substring(0, 18) + '...' : displayName,
              fullName: displayName,
              somaTotal: 0, qtdTotal: 0,
              somaD0: 0, qtdD0: 0
            };
          }
          groupedDr[driverId].somaTotal += somaTotal;
          groupedDr[driverId].qtdTotal += qtdTotal;
          groupedDr[driverId].somaD0 += somaD0;
          groupedDr[driverId].qtdD0 += qtdD0;
        }
      }
    }

    // ==========================================
    // 2. DADOS GERAIS DE DS HUB (dsHubData)
    // ==========================================
    if (!dsHubData.length) {
      return { 
        dsGlobalData: [], 
        diasSemanaData: [], 
        ultimas3SemanasStation: [], 
        resumoTrendStation: null 
      };
    }
    
    const groupedTimeline = {};
    const groupedSemanasStation = {};
    const groupedDias = {
      1: { dayKey: 1, name: 'Segunda', somaTotal: 0, qtdTotal: 0, somaD0: 0, qtdD0: 0, somaSpr: 0, qtdSpr: 0, somaPiso: 0, qtdPiso: 0, somaReut: 0, qtdReut: 0 },
      2: { dayKey: 2, name: 'Terça',   somaTotal: 0, qtdTotal: 0, somaD0: 0, qtdD0: 0, somaSpr: 0, qtdSpr: 0, somaPiso: 0, qtdPiso: 0, somaReut: 0, qtdReut: 0 },
      3: { dayKey: 3, name: 'Quarta',  somaTotal: 0, qtdTotal: 0, somaD0: 0, qtdD0: 0, somaSpr: 0, qtdSpr: 0, somaPiso: 0, qtdPiso: 0, somaReut: 0, qtdReut: 0 },
      4: { dayKey: 4, name: 'Quinta',  somaTotal: 0, qtdTotal: 0, somaD0: 0, qtdD0: 0, somaSpr: 0, qtdSpr: 0, somaPiso: 0, qtdPiso: 0, somaReut: 0, qtdReut: 0 },
      5: { dayKey: 5, name: 'Sexta',   somaTotal: 0, qtdTotal: 0, somaD0: 0, qtdD0: 0, somaSpr: 0, qtdSpr: 0, somaPiso: 0, qtdPiso: 0, somaReut: 0, qtdReut: 0 },
      6: { dayKey: 6, name: 'Sábado',  somaTotal: 0, qtdTotal: 0, somaD0: 0, qtdD0: 0, somaSpr: 0, qtdSpr: 0, somaPiso: 0, qtdPiso: 0, somaReut: 0, qtdReut: 0 },
      0: { dayKey: 0, name: 'Domingo', somaTotal: 0, qtdTotal: 0, somaD0: 0, qtdD0: 0, somaSpr: 0, qtdSpr: 0, somaPiso: 0, qtdPiso: 0, somaReut: 0, qtdReut: 0 },
    };

    dsHubData.forEach(row => {
      const dataRaw = row[COL.DATA];
      if (!dataRaw) return;
      
      const hubBruto = String(row[COL.HUB] || '').trim();
      const hub = padronizarHubLocal(hubBruto);
      const reg = MAPA_REGIONAL_COMPLETO[hub] || String(row[COL.REGIONAL] || '').trim();
      const semanaRow = String(row[COL.SEMANA] || '').trim();

      if (filtrosGlobais?.regional?.length > 0 && !filtrosGlobais.regional.includes(reg)) return;
      if (filtrosGlobais?.station?.length > 0 && !filtrosGlobais.station.includes(hub) && !filtrosGlobais.station.includes(hubBruto)) return;
      if (filtrosGlobais?.semana && semanaRow !== filtrosGlobais.semana) return;

      let dObj = null;
      if (String(dataRaw).includes('/')) {
        const [dia, mes, ano] = String(dataRaw).split(' ')[0].split('/');
        dObj = new Date(`${ano.length === 2 ? '20'+ano : ano}-${mes}-${dia}T12:00:00`);
      } else {
        dObj = new Date(dataRaw);
      }

      if (isNaN(dObj.getTime())) return;

      if (filtrosGlobais?.mes && String(dObj.getMonth() + 1).padStart(2, '0') !== filtrosGlobais.mes) return;
      if (filtrosGlobais?.dataInicio && dObj < new Date(filtrosGlobais.dataInicio + 'T00:00:00')) return;
      if (filtrosGlobais?.dataFim && dObj > new Date(filtrosGlobais.dataFim + 'T23:59:59')) return;

      const valTotal = parseDS(row[COL.DS_TOTAL]);
      const valD0 = parseDS(row[COL.DS_D0]);
      const carregado = Number(row[COL.TOTAL_CARREGADO]) || 0;
      const drivers = Number(row[COL.DRIVERS_UNICOS]) || 0;
      const reutRaw = row[COL.REUTILIZACAO];
      const sprRaw = row[COL.ADERENCIA_SPR];
      const pisoRaw = row[COL.AT_NO_PISO];

      let semKey = semanaRow ? (semanaRow.toUpperCase().startsWith('W') ? semanaRow : `W-${semanaRow}`) : 'W-??';

      if (!groupedSemanasStation[semKey]) {
        groupedSemanasStation[semKey] = { name: semKey, somaTotal: 0, qtdTotal: 0, somaD0: 0, qtdD0: 0, maxDate: dObj.getTime() };
      }
      if (valTotal > 0) { groupedSemanasStation[semKey].somaTotal += valTotal; groupedSemanasStation[semKey].qtdTotal += 1; }
      if (valD0 > 0) { groupedSemanasStation[semKey].somaD0 += valD0; groupedSemanasStation[semKey].qtdD0 += 1; }
      if (dObj.getTime() > groupedSemanasStation[semKey].maxDate) groupedSemanasStation[semKey].maxDate = dObj.getTime();

      const dayOfWeek = dObj.getDay();
      if (groupedDias[dayOfWeek]) {
        if (valTotal > 0) { groupedDias[dayOfWeek].somaTotal += valTotal; groupedDias[dayOfWeek].qtdTotal += 1; }
        if (valD0 > 0) { groupedDias[dayOfWeek].somaD0 += valD0; groupedDias[dayOfWeek].qtdD0 += 1; }
        if (reutRaw !== undefined && reutRaw !== null && reutRaw !== '') { groupedDias[dayOfWeek].somaReut += parseDS(reutRaw); groupedDias[dayOfWeek].qtdReut += 1; }
        if (sprRaw !== undefined && sprRaw !== null && sprRaw !== '') { groupedDias[dayOfWeek].somaSpr += parseDS(sprRaw); groupedDias[dayOfWeek].qtdSpr += 1; }
        if (pisoRaw !== undefined && pisoRaw !== null && pisoRaw !== '') { groupedDias[dayOfWeek].somaPiso += parseDS(pisoRaw); groupedDias[dayOfWeek].qtdPiso += 1; }
      }

      let key = '';
      if (timeView === 'dia') key = `${String(dObj.getDate()).padStart(2, '0')}/${String(dObj.getMonth() + 1).padStart(2, '0')}`;
      else if (timeView === 'semana') key = semKey;
      else if (timeView === 'mes') {
        const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
        key = `${meses[dObj.getMonth()]} ${dObj.getFullYear()}`;
      }

      if (!groupedTimeline[key]) {
        groupedTimeline[key] = { 
          name: key, somaTotal: 0, qtdTotal: 0, somaD0: 0, qtdD0: 0, 
          somaCarregado: 0, somaDrivers: 0, somaReut: 0, qtdReut: 0, sortDate: dObj.getTime() 
        };
      }
      
      if (valTotal > 0) { groupedTimeline[key].somaTotal += valTotal; groupedTimeline[key].qtdTotal += 1; }
      if (valD0 > 0) { groupedTimeline[key].somaD0 += valD0; groupedTimeline[key].qtdD0 += 1; }
      groupedTimeline[key].somaCarregado += carregado;
      groupedTimeline[key].somaDrivers += drivers;
      if (reutRaw !== undefined && reutRaw !== null && reutRaw !== '') { groupedTimeline[key].somaReut += parseDS(reutRaw); groupedTimeline[key].qtdReut += 1; }
    });

    const arraySemanasOrd = Object.values(groupedSemanasStation)
      .sort((a, b) => a.maxDate - b.maxDate)
      .slice(-3)
      .map(item => ({
        ...item,
        dsTotalMedia: item.qtdTotal ? (item.somaTotal / item.qtdTotal) : 0,
        dsD0Media: item.qtdD0 ? (item.somaD0 / item.qtdD0) : 0
      }));

    const ultimas3SemanasStation = arraySemanasOrd.map((item, index, arr) => {
      const prev = index > 0 ? arr[index - 1] : null;
      const prevTotal = prev ? prev.dsTotalMedia : item.dsTotalMedia;
      const varDsTotal = prevTotal > 0 ? ((item.dsTotalMedia - prevTotal) / prevTotal) * 100 : 0;
      const prevD0 = prev ? prev.dsD0Media : item.dsD0Media;
      const varDsD0 = prevD0 > 0 ? ((item.dsD0Media - prevD0) / prevD0) * 100 : 0;

      return { ...item, varDsTotal, varDsD0, variacao: dsType === 'total' ? varDsTotal : varDsD0 };
    });

    let resumoTrendStation = null;
    if (ultimas3SemanasStation.length >= 2) {
      const ultima = ultimas3SemanasStation[ultimas3SemanasStation.length - 1];
      const penultima = ultimas3SemanasStation[ultimas3SemanasStation.length - 2];
      
      const diffTotal = (ultima.dsTotalMedia - penultima.dsTotalMedia) * 100;
      const diffD0 = (ultima.dsD0Media - penultima.dsD0Media) * 100;

      resumoTrendStation = {
        semanaAtual: ultima.name,
        semanaAnterior: penultima.name,
        dsTotalAtual: ultima.dsTotalMedia,
        dsD0Atual: ultima.dsD0Media,
        diffTotal,
        diffD0,
        statusTotal: diffTotal >= 0 ? 'melhora' : 'piora',
        statusD0: diffD0 >= 0 ? 'melhora' : 'piora'
      };
    }

    const dsGlobalData = Object.values(groupedTimeline)
      .sort((a, b) => a.sortDate - b.sortDate)
      .map(item => ({
        ...item,
        dsTotalMedia: item.qtdTotal ? (item.somaTotal / item.qtdTotal) : 0,
        dsD0Media: item.qtdD0 ? (item.somaD0 / item.qtdD0) : 0,
        totalCarregado: item.somaCarregado,
        driversUnicos: item.somaDrivers,
        reutilizacao: item.qtdReut ? (item.somaReut / item.qtdReut) : 0
      }))
      .map((item, index, arr) => {
        const currentDS = dsType === 'total' ? item.dsTotalMedia : item.dsD0Media;
        const prevDS = index > 0 ? (dsType === 'total' ? arr[index - 1].dsTotalMedia : arr[index - 1].dsD0Media) : currentDS;
        const variacao = prevDS > 0 ? ((currentDS - prevDS) / prevDS) * 100 : 0;
        return { ...item, variacao, currentDS };
      });

    const ordemDiasKeys = [1, 2, 3, 4, 5, 6, 0];
    const diasSemanaData = ordemDiasKeys
      .map(dayKey => {
        const d = groupedDias[dayKey];
        return {
          name: d.name,
          dsTotalMedia: d.qtdTotal ? (d.somaTotal / d.qtdTotal) : 0,
          dsD0Media: d.qtdD0 ? (d.somaD0 / d.qtdD0) : 0,
          reutilizacaoMedia: d.qtdReut ? (d.somaReut / d.qtdReut) : 0,
          sprMedia: d.qtdSpr ? (d.somaSpr / d.qtdSpr) : 0,
          pisoMedia: d.qtdPiso ? (d.somaPiso / d.qtdPiso) : 0,
          totalRegistros: d.qtdTotal
        };
      })
      .filter(item => item.totalRegistros > 0)
      .map((item, index, arr) => {
        const prev = index > 0 ? arr[index - 1] : null;
        const prevDsTotal = prev ? prev.dsTotalMedia : item.dsTotalMedia;
        const varDsTotal = prevDsTotal > 0 ? ((item.dsTotalMedia - prevDsTotal) / prevDsTotal) * 100 : 0;
        const prevDsD0 = prev ? prev.dsD0Media : item.dsD0Media;
        const varDsD0 = prevDsD0 > 0 ? ((item.dsD0Media - prevDsD0) / prevDsD0) * 100 : 0;

        const prevSpr = prev ? prev.sprMedia : item.sprMedia;
        const varSpr = prevSpr > 0 ? ((item.sprMedia - prevSpr) / prevSpr) * 100 : 0;
        const prevPiso = prev ? prev.pisoMedia : item.pisoMedia;
        const varPiso = prevPiso > 0 ? ((item.pisoMedia - prevPiso) / prevPiso) * 100 : 0;
        const prevReut = prev ? prev.reutilizacaoMedia : item.reutilizacaoMedia;
        const varReut = prevReut > 0 ? ((item.reutilizacaoMedia - prevReut) / prevReut) * 100 : 0;

        let varOpSelected = 0;
        if (opMetric === 'spr') varOpSelected = varSpr;
        else if (opMetric === 'piso') varOpSelected = varPiso;
        else if (opMetric === 'reutilizacao') varOpSelected = varReut;

        return {
          ...item,
          varDsDay: dsType === 'total' ? varDsTotal : varDsD0,
          varOpSelected
        };
      });

    return { 
      dsGlobalData, 
      diasSemanaData, 
      ultimas3SemanasStation, 
      resumoTrendStation 
    };
  }, [dsHubData, dsMotoristaData, timeView, dsType, opMetric, filtrosGlobais, mapaFrota]);

  return (
    <div className="space-y-6">

      {/* ==================================================================== */}
      {/* SEÇÃO PRINCIPAL (TOPO): COMPARATIVO ÚLTIMAS 3 SEMANAS + INDICADORES  */}
      {/* ==================================================================== */}
      
      {resumoTrendStation && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          
          <div className="bg-white dark:bg-[#1f232d] p-5 rounded-2xl shadow-sm border border-slate-200 dark:border-gray-800 flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">DS Total ({resumoTrendStation.semanaAtual})</span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-3xl font-black text-[#113366] dark:text-white">
                  {(resumoTrendStation.dsTotalAtual * 100).toFixed(2)}%
                </span>
                <span className={`text-xs font-bold flex items-center gap-0.5 px-2 py-0.5 rounded-full ${
                  resumoTrendStation.statusTotal === 'melhora' 
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400' 
                    : 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400'
                }`}>
                  {resumoTrendStation.statusTotal === 'melhora' ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                  {resumoTrendStation.diffTotal > 0 ? '+' : ''}{resumoTrendStation.diffTotal.toFixed(2)}% vs {resumoTrendStation.semanaAnterior}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Status: <strong className={resumoTrendStation.statusTotal === 'melhora' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}>
                  {resumoTrendStation.statusTotal === 'melhora' ? 'Melhora Operacional' : 'Queda no Desempenho'}
                </strong>
              </p>
            </div>
            <div className={`p-3 rounded-xl ${resumoTrendStation.statusTotal === 'melhora' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30' : 'bg-rose-50 text-rose-600 dark:bg-rose-900/30'}`}>
              {resumoTrendStation.statusTotal === 'melhora' ? <TrendingUp size={28} /> : <TrendingDown size={28} />}
            </div>
          </div>

          <div className="bg-white dark:bg-[#1f232d] p-5 rounded-2xl shadow-sm border border-slate-200 dark:border-gray-800 flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">DS D-0 ({resumoTrendStation.semanaAtual})</span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-3xl font-black text-[#113366] dark:text-white">
                  {(resumoTrendStation.dsD0Atual * 100).toFixed(2)}%
                </span>
                <span className={`text-xs font-bold flex items-center gap-0.5 px-2 py-0.5 rounded-full ${
                  resumoTrendStation.statusD0 === 'melhora' 
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400' 
                    : 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400'
                }`}>
                  {resumoTrendStation.statusD0 === 'melhora' ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                  {resumoTrendStation.diffD0 > 0 ? '+' : ''}{resumoTrendStation.diffD0.toFixed(2)}% vs {resumoTrendStation.semanaAnterior}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Status: <strong className={resumoTrendStation.statusD0 === 'melhora' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}>
                  {resumoTrendStation.statusD0 === 'melhora' ? 'Melhora Operacional' : 'Queda no Desempenho'}
                </strong>
              </p>
            </div>
            <div className={`p-3 rounded-xl ${resumoTrendStation.statusD0 === 'melhora' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30' : 'bg-rose-50 text-rose-600 dark:bg-rose-900/30'}`}>
              {resumoTrendStation.statusD0 === 'melhora' ? <TrendingUp size={28} /> : <TrendingDown size={28} />}
            </div>
          </div>

        </div>
      )}

      {/* Gráfico Único de DS Station - Últimas 3 Semanas (Agora em largura total) */}
      <div className="bg-white dark:bg-[#1f232d] p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-gray-800">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h3 className="text-base font-black text-[#113366] dark:text-white uppercase tracking-tight flex items-center gap-2">
              <Calendar size={18} className="text-[#EE4D2D]" />
              DS Station - Últimas 3 Semanas
            </h3>
            <p className="text-xs text-slate-500 mt-1">Comparativo direto de DS Total vs DS D-0 com variação %</p>
          </div>
        </div>

        {ultimas3SemanasStation.length === 0 ? (
          <div className="h-72 flex items-center justify-center border-2 border-dashed border-slate-200 dark:border-gray-700 rounded-xl text-slate-400 font-bold text-xs">
            Sem dados suficientes de semanas.
          </div>
        ) : (
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={ultimas3SemanasStation} margin={{ top: 25, right: 15, bottom: 15, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.2} />
                <XAxis dataKey="name" tick={{fontSize: 11, fill: '#64748b'}} tickMargin={8} />
                <YAxis yAxisId="left" domain={[0, 1]} tick={{fontSize: 11, fill: '#64748b'}} tickFormatter={(val) => `${(val * 100).toFixed(0)}%`} />
                <YAxis yAxisId="right" orientation="right" tick={{fontSize: 11, fill: '#64748b'}} tickFormatter={(val) => `${val > 0 ? '+' : ''}${val.toFixed(1)}%`} />
                
                <RechartsTooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: '11px', fontWeight: 'bold' }} />
                
                <Bar yAxisId="left" dataKey="dsTotalMedia" name="DS Total" fill="#113366" radius={[4, 4, 0, 0]}>
                  <LabelList dataKey="dsTotalMedia" position="top" formatter={(val) => `${(val * 100).toFixed(1)}%`} style={{ fontSize: '10px', fill: '#64748b', fontWeight: 'bold' }} />
                </Bar>
                <Bar yAxisId="left" dataKey="dsD0Media" name="DS D-0" fill="#3b82f6" radius={[4, 4, 0, 0]}>
                  <LabelList dataKey="dsD0Media" position="top" formatter={(val) => `${(val * 100).toFixed(1)}%`} style={{ fontSize: '10px', fill: '#64748b', fontWeight: 'bold' }} />
                </Bar>
                
                <Line yAxisId="right" type="monotone" dataKey="variacao" name="Variação %" stroke="#EE4D2D" strokeWidth={2.5} dot={{r: 4, fill: '#EE4D2D'}} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="bg-white dark:bg-[#1f232d] p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-gray-800">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
          <div>
            <h3 className="text-lg font-black text-[#113366] dark:text-white uppercase tracking-tight flex items-center gap-2">
              <TrendingUp size={20} className="text-[#EE4D2D]" />
              Variação de DS Global (Histórico Completo)
            </h3>
            <p className="text-xs text-slate-500 mt-1">Evolução do Delivery Success e variação percentual vs. período anterior</p>
          </div>
          
          <div className="flex gap-2 flex-wrap">
            <div className="flex bg-slate-100 dark:bg-gray-800 p-1 rounded-lg">
              {['total', 'd0'].map(type => (
                <button 
                  key={type} onClick={() => setDsType(type)}
                  className={`px-4 py-1.5 rounded-md text-xs font-bold uppercase transition-all ${dsType === type ? 'bg-white dark:bg-[#1f232d] shadow-sm text-[#EE4D2D]' : 'text-slate-500 hover:text-slate-700 dark:hover:text-gray-300'}`}
                >
                  DS {type.toUpperCase()}
                </button>
              ))}
            </div>
            <div className="flex bg-[#113366]/5 dark:bg-gray-800 p-1 rounded-lg">
              {['dia', 'semana', 'mes'].map(view => (
                <button 
                  key={view} onClick={() => setTimeView(view)}
                  className={`px-4 py-1.5 rounded-md text-xs font-bold uppercase transition-all ${timeView === view ? 'bg-[#113366] shadow-sm text-white' : 'text-slate-500 hover:text-slate-700 dark:hover:text-gray-300'}`}
                >
                  {view}
                </button>
              ))}
            </div>
          </div>
        </div>

        {dsGlobalData.length === 0 ? (
           <div className="h-80 flex items-center justify-center border-2 border-dashed border-slate-200 dark:border-gray-700 rounded-xl text-slate-400 font-bold">
             Nenhum dado de DS encontrado para os filtros selecionados.
           </div>
        ) : (
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={dsGlobalData} margin={{ top: 25, right: 20, bottom: 20, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.2} />
                <XAxis dataKey="name" tick={{fontSize: 12, fill: '#64748b'}} tickMargin={10} />
                <YAxis yAxisId="left" domain={[0, 1]} tick={{fontSize: 12, fill: '#64748b'}} tickFormatter={(val) => `${(val * 100).toFixed(0)}%`} />
                <YAxis yAxisId="right" orientation="right" tick={{fontSize: 12, fill: '#64748b'}} tickFormatter={(val) => `${val > 0 ? '+' : ''}${val.toFixed(1)}%`} />
                
                <RechartsTooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: '12px', fontWeight: 'bold' }} />
                
                <Bar yAxisId="left" dataKey="currentDS" name={`DS ${dsType.toUpperCase()}`} fill="#113366" radius={[4, 4, 0, 0]}>
                  <LabelList dataKey="currentDS" position="top" formatter={(val) => `${(val * 100).toFixed(1)}%`} style={{ fontSize: '10px', fill: '#64748b', fontWeight: 'bold' }} />
                </Bar>
                <Line yAxisId="right" type="monotone" dataKey="variacao" name="Variação (%)" stroke="#EE4D2D" strokeWidth={3} dot={{r: 4, fill: '#EE4D2D', strokeWidth: 2}} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="bg-white dark:bg-[#1f232d] p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-gray-800">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
          <div>
            <h3 className="text-lg font-black text-[#113366] dark:text-white uppercase tracking-tight flex items-center gap-2">
              <Users size={20} className="text-[#EE4D2D]" />
              Capacidade vs. Reutilização de Frota
            </h3>
            <p className="text-xs text-slate-500 mt-1">Comparativo direto entre Total de Rotas Carregadas, Drivers Únicos e o Percentual de Reutilização.</p>
          </div>
        </div>

        {dsGlobalData.length === 0 ? (
           <div className="h-80 flex items-center justify-center border-2 border-dashed border-slate-200 dark:border-gray-700 rounded-xl text-slate-400 font-bold">
             Nenhum dado encontrado para os filtros selecionados.
           </div>
        ) : (
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={dsGlobalData} margin={{ top: 25, right: 20, bottom: 20, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.2} />
                <XAxis dataKey="name" tick={{fontSize: 12, fill: '#64748b'}} tickMargin={10} />
                
                <YAxis yAxisId="left" tick={{fontSize: 12, fill: '#64748b'}} />
                <YAxis yAxisId="right" orientation="right" tick={{fontSize: 12, fill: '#64748b'}} tickFormatter={(val) => `${(val * 100).toFixed(0)}%`} />
                
                <RechartsTooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: '12px', fontWeight: 'bold' }} />
                
                <Bar yAxisId="left" dataKey="totalCarregado" name="Total Carregado" fill="#113366" radius={[4, 4, 0, 0]}>
                  <LabelList dataKey="totalCarregado" position="top" formatter={(val) => val > 0 ? val.toLocaleString('pt-BR') : ''} style={{ fontSize: '10px', fill: '#64748b', fontWeight: 'bold' }} />
                </Bar>
                <Bar yAxisId="left" dataKey="driversUnicos" name="Drivers Únicos" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Line yAxisId="right" type="monotone" dataKey="reutilizacao" name="Reutilização (%)" stroke="#F59E0B" strokeWidth={3} dot={{r: 4, fill: '#F59E0B', strokeWidth: 2}} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        <div className="bg-white dark:bg-[#1f232d] p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-gray-800">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-3">
            <div>
              <h3 className="text-base font-black text-[#113366] dark:text-white uppercase tracking-tight flex items-center gap-2">
                <Calendar size={18} className="text-[#EE4D2D]" />
                DS por Dia da Semana
              </h3>
              <p className="text-xs text-slate-500 mt-1">Médias de DS Total e DS D-0 acumuladas por dia (Seg a Dom)</p>
            </div>
          </div>

          {diasSemanaData.length === 0 ? (
            <div className="h-72 flex items-center justify-center border-2 border-dashed border-slate-200 dark:border-gray-700 rounded-xl text-slate-400 font-bold text-xs">
              Sem dados disponíveis.
            </div>
          ) : (
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={diasSemanaData} margin={{ top: 25, right: 15, bottom: 15, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.2} />
                  <XAxis dataKey="name" tick={{fontSize: 11, fill: '#64748b'}} tickMargin={8} />
                  <YAxis yAxisId="left" domain={[0, 1]} tick={{fontSize: 11, fill: '#64748b'}} tickFormatter={(val) => `${(val * 100).toFixed(0)}%`} />
                  <YAxis yAxisId="right" orientation="right" tick={{fontSize: 11, fill: '#64748b'}} tickFormatter={(val) => `${val > 0 ? '+' : ''}${val.toFixed(1)}%`} />
                  
                  <RechartsTooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: '11px', fontWeight: 'bold' }} />
                  
                  <Bar yAxisId="left" dataKey="dsTotalMedia" name="DS Total" fill="#113366" radius={[4, 4, 0, 0]}>
                    <LabelList dataKey="dsTotalMedia" position="top" formatter={(val) => `${(val * 100).toFixed(1)}%`} style={{ fontSize: '9px', fill: '#64748b', fontWeight: 'bold' }} />
                  </Bar>
                  <Bar yAxisId="left" dataKey="dsD0Media" name="DS D-0" fill="#3b82f6" radius={[4, 4, 0, 0]}>
                    <LabelList dataKey="dsD0Media" position="top" formatter={(val) => `${(val * 100).toFixed(1)}%`} style={{ fontSize: '9px', fill: '#64748b', fontWeight: 'bold' }} />
                  </Bar>
                  
                  <Line yAxisId="right" type="monotone" dataKey="varDsDay" name={`Variação DS ${dsType.toUpperCase()} (%)`} stroke="#EE4D2D" strokeWidth={2.5} dot={{r: 4, fill: '#EE4D2D'}} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-[#1f232d] p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-gray-800">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-3">
            <div>
              <h3 className="text-base font-black text-[#113366] dark:text-white uppercase tracking-tight flex items-center gap-2">
                <Activity size={18} className="text-[#EE4D2D]" />
                Métricas Operacionais por Dia
              </h3>
              <p className="text-xs text-slate-500 mt-1">Aderência SPR, At no Piso e Reutilização de Frota</p>
            </div>

            <div className="flex bg-slate-100 dark:bg-gray-800 p-1 rounded-lg flex-wrap gap-1">
              {[
                { id: 'todas', label: 'Todas' },
                { id: 'spr', label: 'SPR' },
                { id: 'piso', label: 'At Piso' },
                { id: 'reutilizacao', label: 'Reut.' }
              ].map(item => (
                <button
                  key={item.id}
                  onClick={() => setOpMetric(item.id)}
                  className={`px-2.5 py-1 rounded text-[10px] font-bold uppercase transition-all ${
                    opMetric === item.id 
                      ? 'bg-white dark:bg-[#1f232d] shadow-sm text-[#EE4D2D]' 
                      : 'text-slate-500 hover:text-slate-700 dark:hover:text-gray-300'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {diasSemanaData.length === 0 ? (
            <div className="h-72 flex items-center justify-center border-2 border-dashed border-slate-200 dark:border-gray-700 rounded-xl text-slate-400 font-bold text-xs">
              Sem dados disponíveis.
            </div>
          ) : (
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={diasSemanaData} margin={{ top: 25, right: 15, bottom: 15, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.2} />
                  <XAxis dataKey="name" tick={{fontSize: 11, fill: '#64748b'}} tickMargin={8} />
                  <YAxis yAxisId="left" domain={[0, 1]} tick={{fontSize: 11, fill: '#64748b'}} tickFormatter={(val) => `${(val * 100).toFixed(0)}%`} />
                  <YAxis yAxisId="right" orientation="right" tick={{fontSize: 11, fill: '#64748b'}} tickFormatter={(val) => `${val > 0 ? '+' : ''}${val.toFixed(1)}%`} />
                  
                  <RechartsTooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: '11px', fontWeight: 'bold' }} />
                  
                  {(opMetric === 'todas' || opMetric === 'spr') && (
                    <Bar yAxisId="left" dataKey="sprMedia" name="Aderência SPR" fill="#10B981" radius={[4, 4, 0, 0]}>
                      <LabelList dataKey="sprMedia" position="top" formatter={(val) => val > 0 ? `${(val * 100).toFixed(1)}%` : ''} style={{ fontSize: '9px', fill: '#64748b', fontWeight: 'bold' }} />
                    </Bar>
                  )}

                  {(opMetric === 'todas' || opMetric === 'piso') && (
                    <Bar yAxisId="left" dataKey="pisoMedia" name="At no Piso" fill="#8B5CF6" radius={[4, 4, 0, 0]}>
                      <LabelList dataKey="pisoMedia" position="top" formatter={(val) => val > 0 ? `${(val * 100).toFixed(1)}%` : ''} style={{ fontSize: '9px', fill: '#64748b', fontWeight: 'bold' }} />
                    </Bar>
                  )}

                  {(opMetric === 'todas' || opMetric === 'reutilizacao') && (
                    <Bar yAxisId="left" dataKey="reutilizacaoMedia" name="Reutilização de Frota" fill="#F59E0B" radius={[4, 4, 0, 0]}>
                      <LabelList dataKey="reutilizacaoMedia" position="top" formatter={(val) => val > 0 ? `${(val * 100).toFixed(1)}%` : ''} style={{ fontSize: '9px', fill: '#64748b', fontWeight: 'bold' }} />
                    </Bar>
                  )}

                  {opMetric !== 'todas' && (
                    <Line yAxisId="right" type="monotone" dataKey="varOpSelected" name="Variação % vs Dia Anterior" stroke="#EE4D2D" strokeWidth={2.5} dot={{r: 4, fill: '#EE4D2D'}} />
                  )}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

      </div>

    </div>
  );
}