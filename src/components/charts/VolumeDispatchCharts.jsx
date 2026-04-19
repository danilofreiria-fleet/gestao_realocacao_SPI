import React, { useMemo, useState } from 'react';
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, LabelList, ReferenceLine } from 'recharts';
import { Truck, Maximize2, Minimize2, X, Calendar, CalendarDays } from 'lucide-react';

const NAMES_MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

export default function VolumeDispatchCharts({ data }) {
  const [fullscreenChart, setFullscreenChart] = useState(null);

  // ========================================================
  // PARSERS SEGUROS
  // ========================================================
  const parseNum = (val) => {
    let s = String(val || '0').trim();
    if (s.includes(',')) return Number(s.replace(/\./g, '').replace(',', '.'));
    return Number(s) || 0;
  };

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

  // ========================================================
  // MOTOR DE CÁLCULO DE DADOS E VARIAÇÕES (UNIFICADO)
  // ========================================================
  const processedData = useMemo(() => {
    if (!data || data.length === 0) return { monthlyAggregated: [], weeklyAggregated: [] };

    const rawMonthAgg = {};
    const rawWeekAgg = {};

    // 1. Agrupamento Bruto
    data.forEach(row => {
      const dateObj = parseUniversalDate(row[3]); // Coluna D (Data)
      const weekStr = row[2] || '';             // Coluna C (Semana)
      
      const volPlanned = parseNum(row[12]);     // Coluna M (Vol Roteirizado)
      const volProcessed = parseNum(row[13]);   // Coluna N (Vol Processado)
      const volExpedited = parseNum(row[14]);   // Coluna O (Vol Expedido)
      const sprDelivering = parseNum(row[16]);  // Coluna Q (SPR Delivering)

      const baseDataObj = { volPlanned: 0, volProcessed: 0, volExpedited: 0, sprSum: 0, sprCount: 0 };

      // Mensal
      if (dateObj) {
        const monthKey = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}`;
        if (!rawMonthAgg[monthKey]) rawMonthAgg[monthKey] = { ...baseDataObj };
        
        rawMonthAgg[monthKey].volPlanned += volPlanned;
        rawMonthAgg[monthKey].volProcessed += volProcessed;
        rawMonthAgg[monthKey].volExpedited += volExpedited;
        rawMonthAgg[monthKey].sprSum += sprDelivering;
        rawMonthAgg[monthKey].sprCount += 1;
      }

      // Semanal
      if (weekStr && weekStr.toUpperCase().includes('W-')) {
        if (!rawWeekAgg[weekStr]) rawWeekAgg[weekStr] = { ...baseDataObj };
        
        rawWeekAgg[weekStr].volPlanned += volPlanned;
        rawWeekAgg[weekStr].volProcessed += volProcessed;
        rawWeekAgg[weekStr].volExpedited += volExpedited;
        rawWeekAgg[weekStr].sprSum += sprDelivering;
        rawWeekAgg[weekStr].sprCount += 1;
      }
    });

    const calculateVar = (curr, prev) => {
      if (!prev || prev === 0) return 0;
      return Number((((curr - prev) / prev) * 100).toFixed(1));
    };

    // 2. Formatador Genérico
    const formatAggregatedData = (rawObj, isMonth = false) => {
      return Object.keys(rawObj)
        .sort((a, b) => isMonth ? a.localeCompare(b) : extractWeekNumber(a) - extractWeekNumber(b))
        .map((key, index, arr) => {
          const d = rawObj[key];
          const prev = index > 0 ? rawObj[arr[index - 1]] : null;
          
          const sprAvg = d.sprCount > 0 ? Number((d.sprSum / d.sprCount).toFixed(2)) : 0;
          const prevSprAvg = prev && prev.sprCount > 0 ? (prev.sprSum / prev.sprCount) : 0;

          // Nome do eixo X
          let name = key;
          if (isMonth) {
            const [year, month] = key.split('-');
            name = `${NAMES_MESES[parseInt(month, 10) - 1]}/${year.substring(2)}`;
          }

          return {
            name,
            volPlanned: d.volPlanned,
            varPlannedPct: calculateVar(d.volPlanned, prev?.volPlanned),
            
            volProcessed: d.volProcessed,
            varProcessedPct: calculateVar(d.volProcessed, prev?.volProcessed),
            
            volExpedited: d.volExpedited,
            varExpeditedPct: calculateVar(d.volExpedited, prev?.volExpedited),
            
            sprDeliveringAvg: sprAvg,
            varSprPct: calculateVar(sprAvg, prevSprAvg)
          };
        });
    };

    return { 
      monthlyAggregated: formatAggregatedData(rawMonthAgg, true), 
      weeklyAggregated: formatAggregatedData(rawWeekAgg, false) 
    };
  }, [data]);

  // ========================================================
  // COMPONENTES DE GRÁFICO GENÉRICOS
  // ========================================================
  
  const CustomTooltip = ({ active, payload, label, suffix = '', valueName = 'Valor', lineKey }) => {
    if (active && payload && payload.length) {
      const valData = payload.find(p => p.dataKey !== lineKey);
      const varData = payload.find(p => p.dataKey === lineKey);

      return (
        <div className="bg-white dark:bg-[#1f232d] p-3 rounded-lg shadow-xl border border-slate-200 dark:border-gray-700">
          <p className="font-black text-slate-800 dark:text-white border-b border-slate-100 dark:border-gray-800 pb-2 mb-2 text-base">{label}</p>
          {valData && (
            <p className="font-bold text-[#113366] dark:text-[#4da3ff]">
              {valueName}: <span className="text-xl">{valData.value.toLocaleString('pt-BR')}</span> {suffix}
            </p>
          )}
          {varData && (
            <p className="font-bold mt-1 text-[#EE4D2D] dark:text-[#ff7b63]">
              Variação: <span className="text-xl">{varData.value > 0 ? '+' : ''}{varData.value}%</span> vs Anterior
            </p>
          )}
        </div>
      );
    }
    return null;
  };

  const formatYAxis = (tickItem) => {
    if (tickItem === 0) return '0';
    if (tickItem >= 1000000) return `${(tickItem / 1000000).toFixed(1)}M`;
    if (tickItem >= 1000) return `${(tickItem / 1000).toFixed(0)}k`;
    return tickItem.toString();
  };

  const BarLineVariationChart = ({ data, barKey, lineKey, valueName, suffix = '', isAverage = false }) => (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={data} margin={{ top: 20, right: 20, left: -10, bottom: 40 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 'bold' }} angle={-45} textAnchor="end" interval={0} />
        <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fontSize: 11 }} tickFormatter={isAverage ? undefined : formatYAxis} />
        <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#EE4D2D' }} tickFormatter={(val) => `${val}%`} domain={['auto', 'auto']} />
        
        <Tooltip content={<CustomTooltip suffix={suffix} valueName={valueName} lineKey={lineKey} />} cursor={{ fill: 'rgba(0,0,0,0.03)' }} />
        <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: '11px', fontWeight: 'bold' }} />
        <ReferenceLine yAxisId="right" y={0} stroke="#EE4D2D" strokeDasharray="3 3" />

        <Bar yAxisId="left" dataKey={barKey} name={valueName} fill="#113366" radius={[4, 4, 0, 0]} barSize={isAverage ? 30 : undefined}>
          <LabelList dataKey={barKey} position="top" formatter={isAverage ? undefined : formatYAxis} style={{ fill: '#113366', fontSize: 10, fontWeight: 'bold' }} />
        </Bar>

        <Line yAxisId="right" type="monotone" dataKey={lineKey} name="Variação % vs Anterior" stroke="#EE4D2D" strokeWidth={3} dot={{ r: 5, strokeWidth: 3, fill: 'white' }} activeDot={{ r: 6 }} >
          <LabelList dataKey={lineKey} position="top" formatter={(val) => `${val > 0 ? '+' : ''}${val}%`} style={{ fill: '#EE4D2D', fontSize: 10, fontWeight: 'bold', textShadow: '1px 1px 2px rgba(255,255,255,0.8)' }} />
        </Line>
      </ComposedChart>
    </ResponsiveContainer>
  );

  // ========================================================
  // CARD INTELIGENTE (COM TOGGLE SEMANA/MÊS)
  // ========================================================
  const ToggleableChartCard = ({ id, titleBase, valueName, barKeyBase, varKeyBase, isAverage = false, colSpan = "col-span-1" }) => {
    const [timeframe, setTimeframe] = useState('week'); // 'week' | 'month'
    const isFullscreen = fullscreenChart === id;
    
    const chartData = timeframe === 'week' ? processedData.weeklyAggregated : processedData.monthlyAggregated;
    const title = `${titleBase} [% VAR. PER ${timeframe === 'week' ? 'WEEK' : 'MONTH'}]`;

    const cardContent = (
      <div className={`bg-white dark:bg-[#1f232d] rounded-2xl shadow-sm border border-slate-200 dark:border-gray-800 flex flex-col relative transition-all ${isFullscreen ? 'w-full h-full p-8' : `h-[450px] p-6 ${colSpan}`} print:break-inside-avoid print:h-[450px]`}>
        
        {/* CABEÇALHO DO CARD (Título e Botões) */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 border-b border-slate-100 dark:border-gray-800 pb-4 shrink-0 gap-3">
          <h3 className={`font-black text-[#113366] dark:text-white uppercase ${isFullscreen ? 'text-2xl' : 'text-sm xl:text-base'}`}>
            {title}
          </h3>
          
          <div className="flex items-center gap-3">
            {/* TOGGLE SEMANA/MÊS */}
            <div className="flex items-center bg-slate-100 dark:bg-gray-800 p-1 rounded-lg">
              <button 
                onClick={() => setTimeframe('week')} 
                className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all flex items-center gap-1 ${timeframe === 'week' ? 'bg-white dark:bg-[#15171e] shadow text-[#113366] dark:text-[#4da3ff]' : 'text-slate-400 hover:text-slate-600'}`}
              >
                <CalendarDays size={14}/> Sem
              </button>
              <button 
                onClick={() => setTimeframe('month')} 
                className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all flex items-center gap-1 ${timeframe === 'month' ? 'bg-white dark:bg-[#15171e] shadow text-[#113366] dark:text-[#4da3ff]' : 'text-slate-400 hover:text-slate-600'}`}
              >
                <Calendar size={14}/> Mês
              </button>
            </div>

            {/* BOTÃO EXPANDIR */}
            <button onClick={() => setFullscreenChart(isFullscreen ? null : id)} className="text-slate-400 hover:text-[#EE4D2D] bg-slate-50 hover:bg-orange-50 dark:bg-gray-800 p-2 rounded-lg transition-colors print:hidden">
              {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
            </button>
          </div>
        </div>

        {/* ÁREA DO GRÁFICO */}
        <div className="flex-1 overflow-y-auto custom-scrollbar print:overflow-hidden">
          <div className="w-full h-full min-h-[350px]">
            <BarLineVariationChart 
              data={chartData}
              barKey={barKeyBase}
              lineKey={varKeyBase}
              valueName={valueName}
              isAverage={isAverage}
            />
          </div>
        </div>
      </div>
    );

    if (isFullscreen) {
      return (
        <div className="fixed inset-4 z-[99999] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-6 print:hidden">
          <div className="w-full h-full relative">
             {cardContent}
             <button onClick={() => setFullscreenChart(null)} className="absolute top-4 right-4 bg-red-500 text-white p-2 rounded-full hover:bg-red-600 shadow-lg"><X size={24}/></button>
          </div>
        </div>
      );
    }
    return cardContent;
  };

  if (!data || data.length === 0) return null;

  return (
    <div className="space-y-6 pt-6 print:pt-0">
      
      {/* BANNER DE SEÇÃO */}
      <div className="bg-[#113366] rounded-2xl shadow-sm overflow-hidden border border-[#113366] print:break-inside-avoid">
        <div className="text-white text-center py-5 px-6 flex flex-col items-center justify-center gap-1">
          <h2 className="text-xl md:text-3xl font-black uppercase tracking-widest flex items-center gap-3">
            <Truck size={28} className="text-[#EE4D2D]"/> Volume Planned x Dispatched
          </h2>
          <p className="text-xs md:text-sm font-bold text-white/80 uppercase tracking-wider">
            Aderência do Plano vs Execução • Evolução de Volume e Produtividade (SPR)
          </p>
        </div>
      </div>

      {/* GRID DE GRÁFICOS (2x2) */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 print:block print:space-y-6">
        
        <ToggleableChartCard 
          id="planned" 
          titleBase="VOL PLANNED" 
          valueName="Total Vol Planned" 
          barKeyBase="volPlanned" 
          varKeyBase="varPlannedPct" 
        />
        
        <ToggleableChartCard 
          id="processed" 
          titleBase="VOL PROCESSADO" 
          valueName="Total Vol Processado" 
          barKeyBase="volProcessed" 
          varKeyBase="varProcessedPct" 
        />
        
        <ToggleableChartCard 
          id="expedited" 
          titleBase="VOL EXPEDIDO" 
          valueName="Total Vol Expedido" 
          barKeyBase="volExpedited" 
          varKeyBase="varExpeditedPct" 
        />

        <ToggleableChartCard 
          id="spr" 
          titleBase="SPR DISPATCHED" 
          valueName="Média SPR Delivering" 
          barKeyBase="sprDeliveringAvg" 
          varKeyBase="varSprPct" 
          isAverage={true} 
        />

      </div>
    </div>
  );
}