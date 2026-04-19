import React, { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Legend, LabelList } from 'recharts';
import { Maximize2, Minimize2, X, Info } from 'lucide-react';

export default function FleetGapCharts({ baseData }) {
  const [fullscreenChart, setFullscreenChart] = useState(null);
  
  const parseNum = (val) => {
    let s = String(val || '0').trim();
    if (s.includes(',')) return Number(s.replace(/\./g, '').replace(',', '.'));
    return Number(s) || 0;
  };

  // ========================================================
  // NOVA LÓGICA ULTRA-RÁPIDA (DIRETO DA BASE)
  // ========================================================
  const chartData = React.useMemo(() => {
    if (!baseData || baseData.length === 0) return [];

    const finalMap = {};
    const hubsProcessados = new Set(); 
    
    baseData.slice(1).forEach(row => {
      const stationFullName = String(row[0] || "").trim(); // Coluna A
      
      // Lê apenas a primeira vez que o Hub aparece (ignora as outras linhas de turnos)
      if (stationFullName && !hubsProcessados.has(stationFullName)) {
        const cap = parseNum(row[2]);     // Coluna C (CAP)
        const sprRef = parseNum(row[6]);  // Coluna G (SPR)
        const ativos = parseNum(row[9]);  // Coluna J (Ativos - Inserido via Script)
        
        if (sprRef > 0) {
          const idealDia = cap / sprRef;
          const necessarios = Math.round(idealDia * 1.20); // +20% margem
          const gap = ativos - necessarios;

          if (ativos !== 0 || necessarios !== 0) {
            const cleanStationName = stationFullName.replace('LM Hub_SP_', '');
            finalMap[cleanStationName] = {
              name: cleanStationName,
              ativos: ativos,
              necessarios: necessarios,
              gap: gap
            };
          }
          hubsProcessados.add(stationFullName); 
        }
      }
    });

    return Object.values(finalMap).sort((a, b) => a.gap - b.gap); 
  }, [baseData]);

  const gapOnlyData = React.useMemo(() => chartData.filter(hub => hub.gap < 0), [chartData]);

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white dark:bg-[#1f232d] border border-slate-200 dark:border-gray-800 p-3 rounded-lg shadow-xl z-50">
          <p className="font-bold text-slate-800 dark:text-white mb-2 pb-2 border-b border-slate-100 dark:border-gray-700">{label}</p>
          {payload.map((entry, index) => (
            <p key={index} style={{ color: entry.color }} className="font-bold text-sm">
              {entry.name}: {entry.value}
            </p>
          ))}
          <p className="text-[10px] text-slate-400 mt-2 italic font-medium">* Necessário e Ativos puxados da aba BASE</p>
        </div>
      );
    }
    return null;
  };

  const renderChartCard = (id, title, subtitle, content, color) => {
    const isFullscreen = fullscreenChart === id;
    const cardContent = (
      <div className={`bg-white dark:bg-[#1f232d] rounded-2xl shadow-sm border border-slate-200 dark:border-gray-800 flex flex-col relative transition-all ${isFullscreen ? 'w-full h-full p-8' : 'h-[600px] p-6'} print:break-inside-avoid`}>
        <div className="flex justify-between items-start mb-4 border-b border-slate-100 dark:border-gray-800 pb-4 shrink-0">
          <div>
            <h3 className={`font-black uppercase flex items-center gap-2 ${isFullscreen ? 'text-2xl' : 'text-lg'}`} style={{ color: color }}>
              {title}
            </h3>
            <p className="text-xs text-slate-400 font-bold uppercase mt-1 flex items-center gap-1">
              <Info size={12}/> {subtitle}
            </p>
          </div>
          <button onClick={() => setFullscreenChart(isFullscreen ? null : id)} className="text-slate-400 hover:text-[#EE4D2D] bg-slate-50 hover:bg-orange-50 dark:bg-gray-800 p-2 rounded-lg transition-colors print:hidden">
            {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
          </button>
        </div>
        <div className="flex-1 overflow-auto custom-scrollbar">
          <div className="w-full h-full min-h-[500px] min-w-[600px]">
            {content}
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

  if (chartData.length === 0) return null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 print:grid print:grid-cols-2 print:gap-4">
      {renderChartCard('gapChart', `Fleet Gap [Cenário Atual]`, "Cálculo: Ativos - Meta Diária (CAP/SPR + 20%)", (
        gapOnlyData.length === 0 ? (
          <div className="h-full flex items-center justify-center text-slate-400 font-bold">
            🎉 Todos os Hubs estão com a frota equalizada ou acima da meta!
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart layout="vertical" data={gapOnlyData} margin={{ top: 20, right: 30, left: 40, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#e2e8f0" />
              <XAxis type="number" tick={{fontSize: 11}} reversed={true} />
              <YAxis dataKey="name" type="category" width={130} tick={{fontSize: 9, fontWeight: 'bold'}} interval={0} orientation="right" />
              <Tooltip content={<CustomTooltip />} cursor={{fill: 'rgba(0,0,0,0.05)'}} />
              <Legend />
              <ReferenceLine x={0} stroke="#333" strokeWidth={2} />
              <Bar dataKey="gap" name="Gap de Drivers" fill="#D0011B" radius={[4, 0, 0, 4]}>
                <LabelList dataKey="gap" position="left" style={{ fill: '#D0011B', fontSize: 10, fontWeight: 'bold' }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )
      ), "#D0011B")}

      {renderChartCard('ativosMetaChart', `Drivers: Ativos vs Meta [Cenário Atual]`, "Drivers Ativos vs Necessidade Diária Absoluta", (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart layout="vertical" data={chartData} margin={{ top: 20, right: 30, left: 40, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#e2e8f0" />
            <XAxis type="number" tick={{fontSize: 11}} />
            <YAxis dataKey="name" type="category" width={130} tick={{fontSize: 9, fontWeight: 'bold'}} interval={0} />
            <Tooltip content={<CustomTooltip />} cursor={{fill: 'rgba(0,0,0,0.05)'}} />
            <Legend />
            <Bar dataKey="ativos" name="Drivers Ativos" fill="#113366" radius={[0, 4, 4, 0]}>
              <LabelList dataKey="ativos" position="right" style={{ fill: '#113366', fontSize: 10, fontWeight: 'bold' }} />
            </Bar>
            <Bar dataKey="necessarios" name="Necessários (Meta Diária + 20%)" fill="#EE4D2D" radius={[0, 4, 4, 0]}>
              <LabelList dataKey="necessarios" position="right" style={{ fill: '#EE4D2D', fontSize: 10, fontWeight: 'bold' }} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      ), "#113366")}
    </div>
  );
}