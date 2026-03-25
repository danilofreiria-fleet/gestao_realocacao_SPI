import React, { useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from 'recharts';
import { AlertTriangle, Maximize2, Minimize2, X, Package } from 'lucide-react';

export default function AtPisoCharts({ data }) {
  const [fullscreenChart, setFullscreenChart] = useState(null);

  const parseNum = (val) => {
    let s = String(val || '0').trim();
    if (s.includes(',')) return Number(s.replace(/\./g, '').replace(',', '.'));
    return Number(s) || 0;
  };

  const chartData = useMemo(() => {
    const aggRegional = {}; const aggSemana = {}; const aggStation = {}; const aggOfensores = {};

    data.forEach(row => {
      const regional = row[1] || 'N/A'; 
      const semana = row[2] || 'N/A';   
      const station = row[4] || 'N/A';  
      const atPiso = parseNum(row[19]); 
      const atRot = parseNum(row[11]);  

      aggRegional[regional] = (aggRegional[regional] || 0) + atPiso;
      aggSemana[semana] = (aggSemana[semana] || 0) + atPiso;
      aggStation[station] = (aggStation[station] || 0) + atPiso;

      if (!aggOfensores[station]) aggOfensores[station] = { piso: 0, rot: 0 };
      aggOfensores[station].piso += atPiso;
      aggOfensores[station].rot += atRot;
    });

    const chart1 = Object.keys(aggRegional).map(k => ({ name: k, valor: aggRegional[k] })).sort((a,b) => b.valor - a.valor);
    const chart2 = Object.keys(aggSemana).map(k => ({ name: k, valor: aggSemana[k] })).sort((a,b) => a.name.localeCompare(b.name));
    const chart3 = Object.keys(aggStation).map(k => ({ name: k, valor: aggStation[k] })).sort((a,b) => b.valor - a.valor);
    
    const chart4 = [];
    Object.keys(aggOfensores).forEach(station => {
      const { piso, rot } = aggOfensores[station];
      const pct = rot > 0 ? (piso / rot) : 0;
      if (pct >= 0.02) chart4.push({ name: station, valorPct: Number((pct * 100).toFixed(2)) });
    });
    chart4.sort((a,b) => b.valorPct - a.valorPct);

    return { chart1, chart2, chart3, chart4 };
  }, [data]);

  const PctTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white dark:bg-[#1f232d] border border-slate-200 dark:border-gray-800 p-3 rounded-lg shadow-xl z-50">
          <p className="font-bold text-slate-800 dark:text-white mb-1">{label}</p>
          <p className="text-[#D0011B] font-black">{`Taxa: ${payload[0].value}%`}</p>
        </div>
      );
    }
    return null;
  };

  const renderChartCard = (id, title, isAlert, content, dataLength) => {
    const isFullscreen = fullscreenChart === id;
    const minWidthCalc = isFullscreen ? '100%' : `${Math.max(100, dataLength * 6)}%`;

    const cardContent = (
      <div className={`bg-white dark:bg-[#1f232d] rounded-2xl shadow-sm border border-slate-200 dark:border-gray-800 flex flex-col relative transition-all ${isFullscreen ? 'w-full h-full p-8' : 'h-96 p-6'} print:break-inside-avoid print:h-80`}>
        {isAlert && !isFullscreen && (
          <div className="absolute top-0 right-0 bg-[#D0011B] text-white text-[10px] font-black px-4 py-1 rounded-bl-xl uppercase tracking-widest flex items-center gap-1 z-10 shadow-sm">
            <AlertTriangle size={12} /> Ofensores Acima (2%)
          </div>
        )}
        <div className="flex justify-between items-start mb-4">
          <h3 className={`font-black text-slate-700 dark:text-gray-200 uppercase ${isFullscreen ? 'text-2xl' : 'text-sm'}`}>{title}</h3>
          <button onClick={() => setFullscreenChart(isFullscreen ? null : id)} className="text-slate-400 hover:text-[#EE4D2D] bg-slate-50 hover:bg-orange-50 dark:bg-gray-800 p-2 rounded-lg transition-colors print:hidden" title={isFullscreen ? "Minimizar" : "Expandir Tela Cheia"}>
            {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
          </button>
        </div>
        <div className="flex-1 overflow-x-auto overflow-y-hidden custom-scrollbar print:overflow-hidden">
          <div className="print:!w-full" style={{ width: minWidthCalc, minWidth: '100%', height: '100%' }}>
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

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 print:grid print:grid-cols-2 print:gap-4 print:pb-0 pt-6">
      
      {/* 🔥 NOVO BANNER ESTILIZADO OCUPANDO TODO O GRID */}
      <div className="col-span-1 lg:col-span-2 bg-[#113366] rounded-2xl shadow-sm overflow-hidden border border-[#113366] print:break-inside-avoid mb-2">
        <div className="text-white text-center py-4 px-6 flex flex-col items-center justify-center gap-1">
          <h2 className="text-xl md:text-2xl font-black uppercase tracking-widest flex items-center gap-2">
            <Package className="text-[#EE4D2D]" size={28}/> Monitoramento de AT's no Piso e No Show
          </h2>
          <p className="text-xs md:text-sm font-bold text-white/80 uppercase tracking-wider">Volumetria de pacotes retidos e performance de roteirização</p>
        </div>
      </div>

      {renderChartCard('chart1', "AT's no Piso por Regional", false, (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData.chart1} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 11}} />
            <YAxis axisLine={false} tickLine={false} tick={{fontSize: 11}} />
            <Tooltip cursor={{fill: 'rgba(0,0,0,0.05)'}} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
            <Bar dataKey="valor" fill="#113366" name="Total AT Piso" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      ), chartData.chart1.length)}

      {renderChartCard('chart2', "AT's no Piso por Semana (ISO)", false, (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData.chart2} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 11}} />
            <YAxis axisLine={false} tickLine={false} tick={{fontSize: 11}} />
            <Tooltip cursor={{fill: 'rgba(0,0,0,0.05)'}} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
            <Bar dataKey="valor" fill="#EE4D2D" name="Total AT Piso" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      ), chartData.chart2.length)}

      {renderChartCard('chart3', "AT's no Piso por Station (Hub)", false, (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData.chart3} margin={{ top: 10, right: 10, left: -20, bottom: 60 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10}} angle={-45} textAnchor="end" interval={0} />
            <YAxis axisLine={false} tickLine={false} tick={{fontSize: 11}} />
            <Tooltip cursor={{fill: 'rgba(0,0,0,0.05)'}} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
            <Bar dataKey="valor" fill="#113366" name="Total AT Piso" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      ), chartData.chart3.length)}

      {renderChartCard('chart4', "% AT Piso x Total Roteirizado (Por Hub)", true, (
        chartData.chart4.length === 0 ? (
          <div className="h-full flex items-center justify-center text-slate-400 font-bold">
            🎉 Nenhum Hub estourou a meta de 2% nesse período!
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData.chart4} margin={{ top: 20, right: 10, left: -20, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10}} angle={-45} textAnchor="end" interval={0} />
              <YAxis axisLine={false} tickLine={false} tick={{fontSize: 11}} domain={[0, 'auto']} />
              <Tooltip content={<PctTooltip />} cursor={{fill: 'rgba(208,1,27,0.05)'}} />
              <ReferenceLine y={2} stroke="#D0011B" strokeDasharray="5 5" label={{ position: 'top', value: 'Meta (2%)', fill: '#D0011B', fontSize: 10, fontWeight: 'bold' }} />
              <Bar dataKey="valorPct" radius={[4, 4, 0, 0]}>
                {chartData.chart4.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.valorPct > 5 ? '#D0011B' : '#EE4D2D'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )
      ), chartData.chart4.length)}
    </div>
  );
}