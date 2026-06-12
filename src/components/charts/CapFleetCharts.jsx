import React, { useMemo, useState } from 'react';
import { ComposedChart, BarChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, LabelList, ReferenceLine } from 'recharts';
import { Database, Calculator, Lightbulb, AlertOctagon, Maximize2, Minimize2, X, CalendarDays, Calendar } from 'lucide-react';

const TIMELINE_COLORS = ['#113366', '#EE4D2D', '#D0011B'];
const NAMES_MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

export default function CapFleetCharts({ data }) {
  const [fullscreenChart, setFullscreenChart] = useState(null);

  const parseUniversalDate = (dateStr) => {
    if (!dateStr) return null;
    let s = String(dateStr).trim().split('T')[0].split(' ')[0];
    if (s.includes('/')) {
      const [dia, mes, ano] = s.split('/');
      if (ano && mes && dia) return new Date(ano, mes - 1, dia, 12, 0, 0);
    }
    if (s.includes('-')) {
      const [ano, mes, dia] = s.split('-');
      if (ano && mes && dia) return new Date(ano, mes - 1, dia, 12, 0, 0);
    }
    return null;
  };

  const extractWeekNumber = (str) => {
    const match = String(str || "").match(/\d+/);
    return match ? parseInt(match[0], 10) : 999;
  };

  const parsePct = (val) => {
    if (!val) return 0;
    let s = String(val).trim();
    const hasPercent = s.includes('%');
    s = s.replace('%', '').trim();
    let n = s.includes(',') ? Number(s.replace(/\./g, '').replace(',', '.')) : Number(s);
    if (isNaN(n)) return 0;
    return hasPercent ? n : n * 100;
  };

  const cleanName = (name) => String(name).replace('LM Hub_SP_', '');

  const processedData = useMemo(() => {
    if (!data || data.length === 0) return {};

    const aggTimeWeek = {}; const aggTimeMonth = {};
    const aggReg = {}; const aggHub = {};
    const aggPctReg = {}; const aggPctHub = {};
    const tData = {}; const datesMap = new Map();

    let maxDateMs = 0;
    data.forEach(row => {
      const d = parseUniversalDate(row[3]);
      if (d && d.getTime() > maxDateMs) maxDateMs = d.getTime();
    });
    const fifteenDaysAgo = maxDateMs > 0 ? maxDateMs - (15 * 24 * 60 * 60 * 1000) : 0;

    data.forEach(row => {
      const regional = row[1] || 'N/A';
      const semana = row[2] || 'N/A';
      const dateStr = row[3] || '';
      const station = cleanName(row[4] || 'N/A');
      const dateObj = parseUniversalDate(dateStr);
      
      const pctValue = parsePct(row[45]); 
      const status = String(row[46] || '').toUpperCase();
      const isLimit = status.includes('LIMITE') || status.includes('NÃO ATENDE') || status.includes('NAO ATENDE');

      let monthKey = 'N/A';
      if (dateObj) {
        monthKey = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}`;
      }

      if (!aggTimeWeek[semana]) aggTimeWeek[semana] = { limitCount: 0, pctSum: 0, pctCount: 0 };
      if (!aggTimeMonth[monthKey]) aggTimeMonth[monthKey] = { limitCount: 0, pctSum: 0, pctCount: 0 };

      if (isLimit) {
        aggTimeWeek[semana].limitCount += 1;
        aggTimeMonth[monthKey].limitCount += 1;
        aggReg[regional] = (aggReg[regional] || 0) + 1;
        aggHub[station] = (aggHub[station] || 0) + 1;
      }

      if (pctValue > 100) {
        const excess = pctValue - 100; 
        aggTimeWeek[semana].pctSum += excess;
        aggTimeWeek[semana].pctCount += 1;
        aggTimeMonth[monthKey].pctSum += excess;
        aggTimeMonth[monthKey].pctCount += 1;

        if (!aggPctReg[regional]) aggPctReg[regional] = { sum: 0, count: 0 };
        aggPctReg[regional].sum += excess;
        aggPctReg[regional].count += 1;

        if (!aggPctHub[station]) aggPctHub[station] = { sum: 0, count: 0 };
        aggPctHub[station].sum += excess;
        aggPctHub[station].count += 1;

        if (dateObj && dateObj.getTime() >= fifteenDaysAgo) {
          const dateFormatted = dateObj.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
          datesMap.set(dateObj.getTime(), dateFormatted);
          
          if (!tData[station]) tData[station] = {};
          if (!tData[station][dateFormatted]) {
            tData[station][dateFormatted] = excess;
          } else {
            tData[station][dateFormatted] = Math.max(tData[station][dateFormatted], excess);
          }
        }
      }
    });

    const calculateVar = (curr, prev) => {
      if (!prev || prev === 0) return 0;
      return Number((((curr - prev) / prev) * 100).toFixed(1));
    };

    const formatTimeDataWithVar = (rawObj, isMonth = false) => {
      return Object.keys(rawObj)
        .filter(k => k !== 'N/A')
        .sort((a, b) => isMonth ? a.localeCompare(b) : extractWeekNumber(a) - extractWeekNumber(b))
        .map((key, index, arr) => {
          let name = key;
          if (isMonth) {
            const [year, month] = key.split('-');
            name = `${NAMES_MESES[parseInt(month, 10) - 1]}/${year.substring(2)}`;
          }
          const d = rawObj[key];
          const prev = index > 0 ? rawObj[arr[index - 1]] : null;

          const avgExcess = d.pctCount > 0 ? Number((d.pctSum / d.pctCount).toFixed(2)) : 0;
          const prevAvgExcess = prev && prev.pctCount > 0 ? Number((prev.pctSum / prev.pctCount).toFixed(2)) : 0;

          return {
            name,
            limitCount: d.limitCount,
            varLimitPct: calculateVar(d.limitCount, prev?.limitCount),
            avgExcess,
            varAvgExcessPct: calculateVar(avgExcess, prevAvgExcess)
          };
        });
    };

    const formatCount = (obj) => Object.keys(obj).map(k => ({ name: k, count: obj[k] })).sort((a,b) => b.count - a.count);
    const formatAvg = (obj) => Object.keys(obj).map(k => ({ name: k, avg: Number((obj[k].sum / obj[k].count).toFixed(2)) })).sort((a,b) => b.avg - a.avg);

    const sortedRawDates = Array.from(datesMap.keys()).sort((a,b) => a - b);
    const tKeys = sortedRawDates.map(ms => datesMap.get(ms));
    
    const tArray = Object.keys(tData).map(station => {
      const res = { name: station };
      tKeys.forEach(date => {
        if (tData[station][date]) res[date] = tData[station][date];
      });
      return res;
    }).sort((a, b) => {
      const sumA = tKeys.reduce((acc, key) => acc + (a[key] || 0), 0);
      const sumB = tKeys.reduce((acc, key) => acc + (b[key] || 0), 0);
      return sumB - sumA;
    });

    return {
      timeWeek: formatTimeDataWithVar(aggTimeWeek, false),
      timeMonth: formatTimeDataWithVar(aggTimeMonth, true),
      regData: formatCount(aggReg),
      hubData: formatCount(aggHub),
      pctRegData: formatAvg(aggPctReg),
      pctHubData: formatAvg(aggPctHub),
      timelineData: tArray,
      timelineKeys: tKeys
    };
  }, [data]);

  const CustomVarTooltip = ({ active, payload, label, suffix = '', valueName, lineKey }) => {
    if (active && payload && payload.length) {
      const valData = payload.find(p => p.dataKey !== lineKey);
      const varData = payload.find(p => p.dataKey === lineKey);

      return (
        <div className="bg-white dark:bg-[#1f232d] p-3 rounded-lg shadow-xl border border-slate-200 dark:border-gray-700">
          <p className="font-black text-slate-800 dark:text-white border-b border-slate-100 dark:border-gray-800 pb-2 mb-2 text-base">{label}</p>
          {valData && (
            <p className="font-bold text-[#113366]">
              {valueName}: <span className="text-xl">{valData.value.toLocaleString('pt-BR')}</span>{suffix}
            </p>
          )}
          {varData && (
            <p className="font-bold mt-1 text-[#D0011B]">
              Variação: <span className="text-xl">{varData.value > 0 ? '+' : ''}{varData.value}%</span> vs Anterior
            </p>
          )}
        </div>
      );
    }
    return null;
  };

  const CountTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) return (
      <div className="bg-white dark:bg-[#1f232d] p-3 rounded-lg shadow-xl border border-slate-200 dark:border-gray-700">
        <p className="font-bold border-b border-slate-100 dark:border-gray-800 pb-2 mb-2 text-slate-800 dark:text-white">{label}</p>
        <p className="text-[#113366] font-bold">Estouros de Limite: {payload[0].value}</p>
      </div>
    );
    return null;
  };

  const PctTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) return (
      <div className="bg-white dark:bg-[#1f232d] p-3 rounded-lg shadow-xl border border-slate-200 dark:border-gray-700">
        <p className="font-bold border-b border-slate-100 dark:border-gray-800 pb-2 mb-2 text-slate-800 dark:text-white">{label}</p>
        <p className="text-[#EE4D2D] font-bold">Média Excedente: +{payload[0].value}%</p>
      </div>
    );
    return null;
  };

  const TimelineTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) return (
      <div className="bg-white dark:bg-[#1f232d] p-3 rounded-lg shadow-xl border border-slate-200 dark:border-gray-700">
        <p className="font-bold border-b border-slate-100 dark:border-gray-800 pb-2 mb-2 text-[#113366]">{label}</p>
        <div className="max-h-48 overflow-y-auto custom-scrollbar pr-2">
          {payload.filter(p => p.value > 0).slice().reverse().map((entry, index) => (
            <p key={index} style={{ color: entry.color }} className="text-[11px] font-bold mb-1 flex justify-between gap-4">
              <span>{entry.name}:</span> <span>+{entry.value.toFixed(2)}%</span>
            </p>
          ))}
        </div>
      </div>
    );
    return null;
  };

  const BarLineVariationChart = ({ data, barKey, lineKey, valueName, color, suffix = '' }) => (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={data} margin={{ top: 20, right: 20, left: -10, bottom: 20 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 'bold' }} angle={-45} textAnchor="end" interval={0} />
        <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fontSize: 11 }} />
        <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#D0011B' }} tickFormatter={(val) => `${val}%`} domain={['auto', 'auto']} />
        
        <Tooltip content={<CustomVarTooltip suffix={suffix} valueName={valueName} lineKey={lineKey} />} cursor={{ fill: 'rgba(0,0,0,0.03)' }} />
        <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: '11px', fontWeight: 'bold' }} />
        <ReferenceLine yAxisId="right" y={0} stroke="#D0011B" strokeDasharray="3 3" />

        <Bar yAxisId="left" dataKey={barKey} name={valueName} fill={color} radius={[4, 4, 0, 0]} barSize={40}>
          <LabelList dataKey={barKey} position="top" formatter={(val) => suffix === '%' && val > 0 ? `+${val}%` : val} style={{ fill: color, fontSize: 10, fontWeight: 'bold' }} />
        </Bar>

        <Line yAxisId="right" type="monotone" dataKey={lineKey} name="Variação % vs Anterior" stroke="#D0011B" strokeWidth={3} dot={{ r: 5, strokeWidth: 3, fill: 'white', stroke: '#D0011B' }} activeDot={{ r: 6 }} >
          <LabelList dataKey={lineKey} position="top" formatter={(val) => `${val > 0 ? '+' : ''}${val}%`} style={{ fill: '#D0011B', fontSize: 10, fontWeight: 'bold', textShadow: '1px 1px 2px rgba(255,255,255,0.8)' }} />
        </Line>
      </ComposedChart>
    </ResponsiveContainer>
  );

  const ToggleableTimeCard = ({ id, titleBase, dataKey, lineKey, valueName, color, suffix = '', colSpan = "col-span-1" }) => {
    const [timeframe, setTimeframe] = useState('week'); 
    const isFullscreen = fullscreenChart === id;
    
    const chartData = timeframe === 'week' ? processedData.timeWeek : processedData.timeMonth;
    const title = `${titleBase} [% VAR. PER ${timeframe === 'week' ? 'WEEK' : 'MONTH'}]`;

    const cardContent = (
      <div className={`bg-white dark:bg-[#1f232d] rounded-2xl shadow-sm border border-slate-200 dark:border-gray-800 flex flex-col relative transition-all ${isFullscreen ? 'w-full h-full p-8' : `h-[450px] p-6 ${colSpan}`}`}>
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 border-b border-slate-100 dark:border-gray-800 pb-4 shrink-0 gap-3">
          <h3 className={`font-black text-[#113366] uppercase ${isFullscreen ? 'text-2xl' : 'text-sm xl:text-base'}`}>{title}</h3>
          <div className="flex items-center gap-3">
            <div className="flex items-center bg-slate-100 dark:bg-gray-800 p-1 rounded-lg">
              <button onClick={() => setTimeframe('week')} className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all flex items-center gap-1 ${timeframe === 'week' ? 'bg-[#113366] shadow text-white' : 'text-slate-400 hover:text-slate-600'}`}><CalendarDays size={14}/> Sem</button>
              <button onClick={() => setTimeframe('month')} className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all flex items-center gap-1 ${timeframe === 'month' ? 'bg-[#113366] shadow text-white' : 'text-slate-400 hover:text-slate-600'}`}><Calendar size={14}/> Mês</button>
            </div>
            <button onClick={() => setFullscreenChart(isFullscreen ? null : id)} className="text-slate-400 hover:text-[#EE4D2D] bg-slate-50 hover:bg-orange-50 p-2 rounded-lg transition-colors">
              {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-auto custom-scrollbar">
          <div className={`${isFullscreen ? 'w-full h-full' : 'min-w-[600px] min-h-[350px] w-full h-full'}`}>
            <BarLineVariationChart data={chartData} barKey={dataKey} lineKey={lineKey} valueName={valueName} color={color} suffix={suffix} />
          </div>
        </div>
      </div>
    );

    if (isFullscreen) {
      return (
        <div className="fixed inset-4 z-[99999] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="w-full h-full relative">
             {cardContent}
             <button onClick={() => setFullscreenChart(null)} className="absolute top-4 right-4 bg-[#113366] text-white p-2 rounded-full hover:bg-blue-800 shadow-lg"><X size={24}/></button>
          </div>
        </div>
      );
    }
    return cardContent;
  };

  const renderStaticCard = (id, title, content, colSpan = "col-span-1", minW = "min-w-[400px]", minH = "min-h-[350px]") => {
    const isFullscreen = fullscreenChart === id;
    const cardContent = (
      <div className={`bg-white dark:bg-[#1f232d] rounded-2xl shadow-sm border border-slate-200 dark:border-gray-800 flex flex-col relative transition-all ${isFullscreen ? 'w-full h-full p-8' : `h-[450px] p-6 ${colSpan}`}`}>
        <div className="flex justify-between items-start mb-4 border-b border-slate-100 dark:border-gray-800 pb-4 shrink-0">
          <h3 className={`font-black text-[#113366] uppercase flex items-center gap-2 ${isFullscreen ? 'text-2xl' : 'text-sm xl:text-base'}`}>{title}</h3>
          <button onClick={() => setFullscreenChart(isFullscreen ? null : id)} className="text-slate-400 hover:text-[#EE4D2D] bg-slate-50 hover:bg-orange-50 p-2 rounded-lg transition-colors">
            {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
          </button>
        </div>
        <div className="flex-1 overflow-auto custom-scrollbar">
          <div className={`${isFullscreen ? 'w-full h-full' : `${minW} ${minH} w-full h-full`}`}>
            {content}
          </div>
        </div>
      </div>
    );

    if (isFullscreen) {
      return (
        <div className="fixed inset-4 z-[99999] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="w-full h-full relative">
             {cardContent}
             <button onClick={() => setFullscreenChart(null)} className="absolute top-4 right-4 bg-[#113366] text-white p-2 rounded-full shadow-lg"><X size={24}/></button>
          </div>
        </div>
      );
    }
    return cardContent;
  };

  if (!data || data.length === 0) return null;

 return (
    <div className="space-y-6 pt-6">
      
      {/* HEADER PRINCIPAL */}
      <div className="bg-[#113366] rounded-2xl shadow-sm overflow-hidden border border-[#113366]">
        <div className="text-white text-center py-4 px-6 flex flex-col items-center justify-center gap-1">
          <h2 className="text-xl md:text-2xl font-black uppercase tracking-widest flex items-center gap-2">
            <AlertOctagon className="text-[#EE4D2D]" size={28}/> Análise de Cap Fleet e Gargalos
          </h2>
          <p className="text-xs md:text-sm font-bold text-white/80 uppercase tracking-wider">Monitoramento de limites atingidos e média do volume excedido</p>
        </div>
      </div>

      {/* 🔥 BANNER DE STORYTELLING PARA A GESTÃO */}
      <div className="bg-white dark:bg-[#1f232d] p-5 md:p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-gray-800 shrink-0">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 bg-slate-50 dark:bg-[#15171e] p-5 rounded-xl border border-slate-200 dark:border-gray-700">
          
          {/* Pilar 1: Origem e Definição */}
          <div className="flex gap-3 items-start">
            <div className="p-2 bg-blue-50 dark:bg-blue-950/30 text-[#113366] dark:text-blue-400 rounded-lg shrink-0">
              <Database size={16} />
            </div>
            <div className="flex flex-col gap-1">
              <h4 className="text-[11px] font-black text-slate-800 dark:text-white uppercase tracking-wider">Origem & Definição</h4>
              <p className="text-[11px] text-slate-500 dark:text-gray-400 font-medium leading-relaxed">
                Este consolidado cruza o <strong>Volume Roteirizado</strong> com a Capacidade Nominal cadastrada na aba <em>BASE</em>. É considerado um <strong>ESTOURO</strong> toda e qualquer operação em que o volume roteirizado supera 100% da capacidade do Hub ou Fleet.
              </p>
            </div>
          </div>

          {/* Pilar 2: Métricas e Timeline */}
          <div className="flex gap-3 items-start border-t lg:border-t-0 lg:border-l border-slate-200 dark:border-gray-700 pt-4 lg:pt-0 lg:pl-6">
            <div className="p-2 bg-red-50 dark:bg-red-950/30 text-[#D0011B] rounded-lg shrink-0">
              <Calculator size={16} />
            </div>
            <div className="flex flex-col gap-1">
              <h4 className="text-[11px] font-black text-slate-800 dark:text-white uppercase tracking-wider">Métricas & Timeline</h4>
              <p className="text-[11px] text-slate-500 dark:text-gray-400 font-medium leading-relaxed">
                A <strong>Média de Excesso</strong> calcula percentualmente <em>apenas o volume que passou</em> do limite nominal. Os dados são apresentados no nível macro (Total/Regional) e micro (Hubs). O gráfico de <strong>Timeline</strong> considera estritamente o histórico dos <strong>últimos 15 dias</strong>.
              </p>
            </div>
          </div>

          {/* Pilar 3: Dica Prática de Análise */}
          <div className="flex gap-3 items-start border-t lg:border-t-0 lg:border-l border-slate-200 dark:border-gray-700 pt-4 lg:pt-0 lg:pl-6">
            <div className="p-2 bg-orange-50 dark:bg-orange-950/20 text-[#EE4D2D] rounded-lg shrink-0">
              <Lightbulb size={16} />
            </div>
            <div className="flex flex-col gap-1">
              <h4 className="text-[11px] font-black text-slate-800 dark:text-white uppercase tracking-wider">Dica Prática de Análise</h4>
              <p className="text-[11px] text-slate-500 dark:text-gray-400 font-medium leading-relaxed">
                Se um Hub apresentar altos indícios de estouro de CAP, cruze essa visão com as abas de <strong>AT no Piso</strong>, <strong>SPR Expedido</strong>, <strong>Evolução de Frota</strong> e a <strong>Tabela de Rodízio</strong> para obter um diagnóstico e panorama completo do período.
              </p>
            </div>
          </div>

        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Barras em Azul para os "Totalizadores Gerais" e Laranja para as "Médias" */}
        <ToggleableTimeCard id="timeLimits" titleBase="TOTAL DE ESTOUROS" dataKey="limitCount" lineKey="varLimitPct" valueName="Qtd de Estouros" color="#113366" />
        <ToggleableTimeCard id="timeExcess" titleBase="MÉDIA DE EXCESSO" dataKey="avgExcess" lineKey="varAvgExcessPct" valueName="Média de Excesso (%)" suffix="%" color="#EE4D2D" />

        {renderStaticCard('capReg', 'ESTOUROS DE CAP [PER REGIONAL]', (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart layout="vertical" data={processedData.regData} margin={{ top: 10, right: 30, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#e2e8f0" />
              <XAxis type="number" tick={{fontSize: 11}} />
              <YAxis dataKey="name" type="category" width={50} tick={{fontSize: 10, fontWeight: 'bold'}} />
              <Tooltip content={<CountTooltip />} cursor={{fill: 'rgba(0,0,0,0.05)'}} />
              <Bar dataKey="count" fill="#113366" radius={[0, 4, 4, 0]}>
                <LabelList dataKey="count" position="right" style={{fill: '#113366', fontSize: 11, fontWeight: 'bold'}} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ))}

        {renderStaticCard('pctReg', 'MÉDIA EXCESSO [% PER REGIONAL]', (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={processedData.pctRegData} margin={{ top: 20, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 11}} />
              <YAxis axisLine={false} tickLine={false} tick={{fontSize: 11}} tickFormatter={(val) => `${val}%`} />
              <Tooltip content={<PctTooltip />} cursor={{fill: 'rgba(0,0,0,0.05)'}} />
              <Bar dataKey="avg" fill="#EE4D2D" radius={[4, 4, 0, 0]} barSize={50}>
                <LabelList dataKey="avg" position="top" formatter={(val) => `+${val}%`} style={{fill: '#EE4D2D', fontSize: 10, fontWeight: 'bold'}} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ))}

        {renderStaticCard('capHub', 'ESTOUROS [HUB OFFENDERS]', (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={processedData.hubData} margin={{ top: 20, right: 10, left: -20, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 9}} angle={-45} textAnchor="end" interval={0} />
              <YAxis axisLine={false} tickLine={false} tick={{fontSize: 11}} />
              <Tooltip content={<CountTooltip />} cursor={{fill: 'rgba(0,0,0,0.05)'}} />
              <Bar dataKey="count" fill="#113366" radius={[4, 4, 0, 0]}>
                <LabelList dataKey="count" position="top" style={{fill: '#113366', fontSize: 10, fontWeight: 'bold'}} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ), "lg:col-span-2", "min-w-[900px]", "min-h-[350px]")}

        {renderStaticCard('pctHub', 'MÉDIA EXCESSO [% PER HUB]', (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={processedData.pctHubData} margin={{ top: 20, right: 10, left: -20, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 9}} angle={-45} textAnchor="end" interval={0} />
              <YAxis axisLine={false} tickLine={false} tick={{fontSize: 11}} tickFormatter={(val) => `${val}%`} />
              <Tooltip content={<PctTooltip />} cursor={{fill: 'rgba(0,0,0,0.05)'}} />
              <Bar dataKey="avg" fill="#EE4D2D" radius={[4, 4, 0, 0]}>
                <LabelList dataKey="avg" position="top" formatter={(val) => `+${val}%`} style={{fill: '#EE4D2D', fontSize: 10, fontWeight: 'bold'}} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ), "lg:col-span-2", "min-w-[900px]", "min-h-[350px]")}

        {renderStaticCard('capTimeline', 'TIMELINE DE EXCESSO [% ÚLTIMOS 15 DIAS]', (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={processedData.timelineData} margin={{ top: 20, right: 10, left: -10, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 9}} angle={-45} textAnchor="end" interval={0} />
              <YAxis axisLine={false} tickLine={false} tick={{fontSize: 11}} tickFormatter={(val) => `${val}%`} />
              <Tooltip content={<TimelineTooltip />} cursor={{fill: 'rgba(0,0,0,0.05)'}} />
              <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: '10px' }} />
              {processedData.timelineKeys.map((date, index) => (
                <Bar key={date} dataKey={date} fill={TIMELINE_COLORS[index % TIMELINE_COLORS.length]}>
                   <LabelList dataKey={date} position="top" formatter={(val) => val > 0 ? `+${Number(val).toFixed(0)}%` : ''} style={{ fontSize: 9, fontWeight: 'bold', fill: TIMELINE_COLORS[index % TIMELINE_COLORS.length] }} />
                </Bar>
              ))}
            </BarChart>
          </ResponsiveContainer>
        ), "lg:col-span-2", "min-w-[1200px]", "min-h-[400px]")}

      </div>
    </div>
  );
}