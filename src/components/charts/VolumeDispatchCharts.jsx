import React, { useMemo, useState } from 'react';
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, LabelList, ReferenceLine } from 'recharts';
import { Truck, Maximize2, Minimize2, X } from 'lucide-react';

const NAMES_MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

export default function VolumeDispatchCharts({ data }) {
  const [fullscreenChart, setFullscreenChart] = useState(null);

  // Parsers Seguros
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
  // MOTOR DE CÁLCULO DE DADOS E VARIAÇÕES
  // ========================================================
  const processedData = useMemo(() => {
    if (!data || data.length === 0) return { plannedMonthly: [], weeklyAggregated: [] };

    const rawMonthAgg = {};
    const rawWeekAgg = {};

    data.forEach(row => {
      const dateObj = parseUniversalDate(row[3]); // Coluna D (Data)
      const weekStr = row[2] || '';             // Coluna C (Semana)
      
      const volPlanned = parseNum(row[12]);     // Coluna M (Vol Roteirizado)
      const sprDelivering = parseNum(row[16]);  // Coluna Q (SPR Delivering)

      // 1. Agregação Mensal (Planned)
      if (dateObj) {
        const monthKey = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}`;
        if (!rawMonthAgg[monthKey]) rawMonthAgg[monthKey] = 0;
        rawMonthAgg[monthKey] += volPlanned;
      }

      // 2. Agregação Semanal (Planned & SPR)
      if (weekStr && weekStr.toUpperCase().includes('W-')) {
        if (!rawWeekAgg[weekStr]) rawWeekAgg[weekStr] = { volPlanned: 0, sprSum: 0, sprCount: 0 };
        rawWeekAgg[weekStr].volPlanned += volPlanned;
        rawWeekAgg[weekStr].sprSum += sprDelivering;
        rawWeekAgg[weekStr].sprCount += 1;
      }
    });

    // Função Auxiliar para calcular variação % (MoM ou WoW)
    const calculateVar = (curr, prev) => {
      if (prev === 0 || !prev) return 0;
      return Number((((curr - prev) / prev) * 100).toFixed(1));
    };

    // Formatação e Cálculo Mensal (Chart 1)
    const plannedMonthly = Object.keys(rawMonthAgg)
      .sort() // Ordena cronologicamente AAAA-MM
      .map((key, index, arr) => {
        const value = rawMonthAgg[key];
        const [year, month] = key.split('-');
        const name = `${NAMES_MESES[parseInt(month, 10) - 1]}/${year.substring(2)}`;
        
        let varPct = 0;
        if (index > 0) {
          const prevValue = rawMonthAgg[arr[index - 1]];
          varPct = calculateVar(value, prevValue);
        }

        return { name, value, varPct };
      });

    // Formatação e Cálculo Semanal (Charts 2 & 3)
    const weeklyAggregated = Object.keys(rawWeekAgg)
      .sort((a, b) => extractWeekNumber(a) - extractWeekNumber(b)) // Ordena W-01, W-02...
      .map((key, index, arr) => {
        const { volPlanned, sprSum, sprCount } = rawWeekAgg[key];
        const sprDeliveringAvg = sprCount > 0 ? Number((sprSum / sprCount).toFixed(2)) : 0;
        
        let varPlannedPct = 0;
        let varSprPct = 0;

        if (index > 0) {
          const prevKey = arr[index - 1];
          const prevPlanned = rawWeekAgg[prevKey].volPlanned;
          const prevSprSum = rawWeekAgg[prevKey].sprSum;
          const prevSprCount = rawWeekAgg[prevKey].sprCount;
          const prevSprAvg = prevSprCount > 0 ? prevSprSum / prevSprCount : 0;

          varPlannedPct = calculateVar(volPlanned, prevPlanned);
          varSprPct = calculateVar(sprDeliveringAvg, prevSprAvg);
        }

        return { name: key, volPlanned, sprDeliveringAvg, varPlannedPct, varSprPct };
      });

    return { plannedMonthly, weeklyAggregated };
  }, [data]);


  // ========================================================
  // RENDERIZAÇÃO DE COMPONENTES VISUAIS
  // ========================================================
  
  const CustomTooltip = ({ active, payload, label, suffix = '', valueName = 'Valor', varName = 'Variação' }) => {
    if (active && payload && payload.length) {
      const valData = payload.find(p => p.dataKey !== 'varPct' && p.dataKey !== 'varPlannedPct' && p.dataKey !== 'varSprPct');
      const varData = payload.find(p => p.dataKey === 'varPct' || p.dataKey === 'varPlannedPct' || p.dataKey === 'varSprPct');

      return (
        <div className="bg-white dark:bg-[#1f232d] p-3 rounded-lg shadow-xl border border-slate-200">
          <p className="font-black text-slate-800 dark:text-white border-b pb-2 mb-2 text-base">{label}</p>
          {valData && (
            <p className="font-bold" style={{ color: '#113366' }}>
              {valueName}: <span className="text-xl">{valData.value.toLocaleString('pt-BR')}</span> {suffix}
            </p>
          )}
          {varData && (
            <p className="font-bold mt-1" style={{ color: '#EE4D2D' }}>
              {varName}: <span className="text-xl">{varData.value > 0 ? '+' : ''}{varData.value}%</span> vs Anterior
            </p>
          )}
        </div>
      );
    }
    return null;
  };

  const renderChartCard = (id, title, content, colSpan = "col-span-1") => {
    const isFullscreen = fullscreenChart === id;
    const cardContent = (
      <div className={`bg-white dark:bg-[#1f232d] rounded-2xl shadow-sm border border-slate-200 dark:border-gray-800 flex flex-col relative transition-all ${isFullscreen ? 'w-full h-full p-8' : `h-[450px] p-6 ${colSpan}`} print:break-inside-avoid print:h-[450px]`}>
        <div className="flex justify-between items-start mb-4 border-b border-slate-100 dark:border-gray-800 pb-4 shrink-0">
          <h3 className={`font-black text-[#113366] dark:text-white uppercase flex items-center gap-2 ${isFullscreen ? 'text-2xl' : 'text-base'}`}>
            {title}
          </h3>
          <button onClick={() => setFullscreenChart(isFullscreen ? null : id)} className="text-slate-400 hover:text-[#EE4D2D] bg-slate-50 hover:bg-orange-50 dark:bg-gray-800 p-2 rounded-lg transition-colors print:hidden">
            {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
          </button>
        </div>
        <div className="flex-1 overflow-y-auto custom-scrollbar print:overflow-hidden">
          <div className="w-full h-full min-h-[350px]">{content}</div>
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

  // Helper para formatar números grandes (milhões/milhares)
  const formatYAxis = (tickItem) => {
    if (tickItem === 0) return '0';
    if (tickItem >= 1000000) return `${(tickItem / 1000000).toFixed(1)}M`;
    if (tickItem >= 1000) return `${(tickItem / 1000).toFixed(0)}k`;
    return tickItem.toString();
  };

  // Estrutura Genérica para Gráfico Composto (Barra + Linha de Variação)
  const BarLineVariationChart = ({ data, barKey, lineKey, valueName, suffix = '', isAverage = false }) => (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={data} margin={{ top: 20, right: 20, left: -10, bottom: 40 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 'bold' }} angle={-45} textAnchor="end" interval={0} />
        
        {/* Eixo Esquerdo: Valores Absolutos */}
        <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fontSize: 11 }} tickFormatter={isAverage ? undefined : formatYAxis} />
        
        {/* Eixo Direito: Variação Percentual */}
        <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#EE4D2D' }} tickFormatter={(val) => `${val}%`} domain={['auto', 'auto']} />
        
        <Tooltip content={<CustomTooltip suffix={suffix} valueName={valueName} />} cursor={{ fill: 'rgba(0,0,0,0.03)' }} />
        <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: '11px', fontWeight: 'bold' }} />
        
        {/* Linha de Referência no Zero do eixo de variação */}
        <ReferenceLine yAxisId="right" y={0} stroke="#EE4D2D" strokeDasharray="3 3" />

        {/* Barra: Valor Absoluto (#113366) */}
        <Bar yAxisId="left" dataKey={barKey} name={valueName} fill="#113366" radius={[4, 4, 0, 0]} barSize={isAverage ? 30 : undefined}>
          <LabelList dataKey={barKey} position="top" formatter={isAverage ? undefined : formatYAxis} style={{ fill: '#113366', fontSize: 10, fontWeight: 'bold' }} />
        </Bar>

        {/* Linha: Variação Percentual (#EE4D2D) */}
        <Line yAxisId="right" type="monotone" dataKey={lineKey} name="Variação % vs Anterior" stroke="#EE4D2D" strokeWidth={3} dot={{ r: 5, strokeWidth: 3, fill: 'white' }} activeDot={{ r: 6 }} >
          <LabelList dataKey={lineKey} position="top" formatter={(val) => `${val > 0 ? '+' : ''}${val}%`} style={{ fill: '#EE4D2D', fontSize: 10, fontWeight: 'bold' }} />
        </Line>
      </ComposedChart>
    </ResponsiveContainer>
  );

  if (!data || data.length === 0) return null;

  return (
    <div className="space-y-6 pt-6 print:pt-0">
      
      {/* 🔥 BANNER DE SEÇÃO: VOLUME PLANNED X DISPATCHED (#113366) */}
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

      {/* GRID DE GRÁFICOS */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 print:block print:space-y-6">
        
        {/* 1. VOL PLANNED [% VAR PER MONTH] (Sum M por Mês) */}
        {renderChartCard('volPlannedMonth', 'VOL PLANNED [% VAR PER MONTH]', (
          <BarLineVariationChart 
            data={processedData.plannedMonthly}
            barKey="value"
            lineKey="varPct"
            valueName="Total Vol Planned"
          />
        ), "xl:col-span-2")}

        {/* 2. SPR Dispatched [% VAR. PER WEEK] (Avg Q por Semana) */}
        {renderChartCard('sprDispatchWeek', 'SPR Dispatched [% VAR. PER WEEK]', (
          <BarLineVariationChart 
            data={processedData.weeklyAggregated}
            barKey="sprDeliveringAvg"
            lineKey="varSprPct"
            valueName="Média SPR Delivering"
            isAverage={true}
          />
        ))}

        {/* 3. VOL PLANNED [% VAR PER WEEK] (Sum M por Semana) */}
        {renderChartCard('volPlannedWeek', 'VOL PLANNED [% VAR PER WEEK]', (
          <BarLineVariationChart 
            data={processedData.weeklyAggregated}
            barKey="volPlanned"
            lineKey="varPlannedPct"
            valueName="Total Vol Planned"
          />
        ))}

      </div>
    </div>
  );
}