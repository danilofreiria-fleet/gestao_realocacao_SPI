import React, { useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Legend, LabelList } from 'recharts';
import { Zap, Maximize2, Minimize2, X } from 'lucide-react';

export default function FleetGapCharts({ dashData }) {
  const [fullscreenChart, setFullscreenChart] = useState(null);
  
  const parseNum = (val) => {
    let s = String(val || '0').trim();
    if (s.includes(',')) return Number(s.replace(/\./g, '').replace(',', '.'));
    return Number(s) || 0;
  };

  const extractWeekNumber = (str) => {
    const match = String(str || "").match(/\d+/);
    return match ? parseInt(match[0], 10) : -1;
  };

  const currentWeekNum = useMemo(() => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  }, []);

  const chartData = useMemo(() => {
    if (!dashData || dashData.length === 0) return [];

    const hubsMap = {};
    const rhProcessado = new Set();

    dashData.forEach(row => {
      if (extractWeekNumber(row[4]) !== currentWeekNum) return; // Coluna E (Semana)

      const stationFullName = String(row[3] || "").trim(); // Coluna D
      if (!stationFullName) return;

      const ativos = parseNum(row[14]);      // Coluna O
      const necessarios = parseNum(row[18]); // Coluna S
      const gap = parseNum(row[19]);         // Coluna T

      if (ativos === 0 && necessarios === 0 && gap === 0) return;

      if (rhProcessado.has(stationFullName)) return;
      rhProcessado.add(stationFullName);

      const cleanStationName = stationFullName.replace('LM Hub_SP_', '');

      hubsMap[cleanStationName] = {
        name: cleanStationName,
        ativos: ativos,
        necessarios: necessarios,
        gap: gap
      };
    });

    return Object.values(hubsMap).sort((a, b) => a.gap - b.gap); // Piores Gaps (mais negativos) no topo
  }, [dashData, currentWeekNum]);

  //array separado que esconde Hubs sem Gap negativo
  const gapOnlyData = useMemo(() => {
    return chartData.filter(hub => hub.gap < 0);
  }, [chartData]);


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
        </div>
      );
    }
    return null;
  };

  // Função Auxiliar de Renderização de Cards (Scroll + Tela Cheia)
  const renderChartCard = (id, title, subtitle, content, color) => {
    const isFullscreen = fullscreenChart === id;
    
    const cardContent = (
      <div className={`bg-white dark:bg-[#1f232d] rounded-2xl shadow-sm border border-slate-200 dark:border-gray-800 flex flex-col relative transition-all ${isFullscreen ? 'w-full h-full p-8' : 'h-[600px] p-6'} print:break-inside-avoid print:h-[600px]`}>
        <div className="flex justify-between items-start mb-4 border-b border-slate-100 dark:border-gray-800 pb-4 shrink-0">
          <div>
            <h3 className={`font-black uppercase flex items-center gap-2 ${isFullscreen ? 'text-2xl' : 'text-lg'}`} style={{ color: color }}>
              {title}
            </h3>
            <p className="text-xs text-slate-400 font-bold uppercase mt-1">{subtitle}</p>
          </div>
          <button onClick={() => setFullscreenChart(isFullscreen ? null : id)} className="text-slate-400 hover:text-[#EE4D2D] bg-slate-50 hover:bg-orange-50 dark:bg-gray-800 p-2 rounded-lg transition-colors print:hidden" title={isFullscreen ? "Minimizar" : "Expandir Tela Cheia"}>
            {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
          </button>
        </div>
        
        {/* Container com scroll vertical caso tenha muitas barras */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar print:overflow-hidden">
          <div className="w-full h-full min-h-[500px]">
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
      
      {/* GRÁFICO 1: FLEET GAP */}
      {renderChartCard('gapChart', `Fleet Gap [W-${currentWeekNum}]`, "(Drivers ativos - Necessários) • Oculta positivos • Ordenado pelo pior", (
        gapOnlyData.length === 0 ? (
          <div className="h-full flex items-center justify-center text-slate-400 font-bold">
             🎉 Não há Gaps negativos reportados nesta semana!
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart layout="vertical" data={gapOnlyData} margin={{ top: 20, right: 30, left: 40, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#e2e8f0" />
              
              {/* 🔴 MÁGICA 2: reversed={true} inverte o eixo para formato Tornado */}
              <XAxis type="number" tick={{fontSize: 11}} reversed={true} />
              
              <YAxis dataKey="name" type="category" width={130} tick={{fontSize: 9, fontWeight: 'bold'}} interval={0} orientation="right" />
              <Tooltip content={<CustomTooltip />} cursor={{fill: 'rgba(0,0,0,0.05)'}} />
              <Legend />
              
              {/* Linha do Zero colada no canto direito */}
              <ReferenceLine x={0} stroke="#333" strokeWidth={2} />
              
              <Bar dataKey="gap" name="Gap de Drivers" fill="#D0011B" radius={[4, 0, 0, 4]}>
                <LabelList dataKey="gap" position="left" style={{ fill: '#D0011B', fontSize: 10, fontWeight: 'bold' }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )
      ), "#D0011B")}


      {/* GRÁFICO 2: ATIVOS VS NECESSÁRIOS */}
      {renderChartCard('ativosMetaChart', `Drivers: Ativos vs Meta [W-${currentWeekNum}]`, "Comparação Absoluta por Hub", (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart layout="vertical" data={chartData} margin={{ top: 20, right: 30, left: 40, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#e2e8f0" />
            <XAxis type="number" tick={{fontSize: 11}} />
            <YAxis dataKey="name" type="category" width={130} tick={{fontSize: 9, fontWeight: 'bold'}} interval={0} />
            <Tooltip content={<CustomTooltip />} cursor={{fill: 'rgba(0,0,0,0.05)'}} />
            <Legend />
            <Bar dataKey="ativos" name="Drivers Ativos" fill="#113366" radius={[0, 4, 4, 0]} />
            <Bar dataKey="necessarios" name="Necessários (Meta)" fill="#EE4D2D" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      ), "#113366")}

    </div>
  );
}