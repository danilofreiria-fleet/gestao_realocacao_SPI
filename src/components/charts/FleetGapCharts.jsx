import React, { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Legend, LabelList } from 'recharts';
import { Maximize2, Minimize2, X, Info, Filter } from 'lucide-react';

export default function FleetGapCharts({ baseData }) {
  const [fullscreenChart, setFullscreenChart] = useState(null);
  const [activeFilter, setActiveFilter] = useState('ALL'); 
  
  const parseNum = (val) => {
    let s = String(val || '0').trim();
    if (s.includes(',')) return Number(s.replace(/\./g, '').replace(',', '.'));
    return Number(s) || 0;
  };

  const chartData = React.useMemo(() => {
    if (!baseData || baseData.length === 0) return [];

    const finalMap = {};
    
    baseData.slice(1).forEach(row => {
      const stationFullName = String(row[0] || "").trim(); 
      const turno = String(row[1] || "").trim().toUpperCase(); 
      
      if (stationFullName && turno) {
        const cap = parseNum(row[2]);           
        const sprRef = parseNum(row[6]);        
        const ativos = parseNum(row[9]);        
        const disponiveis = parseNum(row[12]);  
        
        if (sprRef > 0) {
          const idealDia = cap / sprRef;
          const necessarios = Math.round(idealDia * 1.20); 
          
          const gapAtivos = ativos - necessarios;
          const gapDisponiveis = disponiveis - necessarios;

          if (ativos !== 0 || necessarios !== 0 || disponiveis !== 0) {
            const cleanStationName = stationFullName.replace('LM Hub_SP_', '');
            const uniqueKey = `${cleanStationName} [${turno}]`;

            finalMap[uniqueKey] = {
              name: uniqueKey,          
              baseName: cleanStationName, 
              turno: turno,             
              ativos: ativos,
              disponiveis: disponiveis,
              necessarios: necessarios,
              gapAtivos: gapAtivos,
              gapDisponiveis: gapDisponiveis
            };
          }
        }
      }
    });

    return Object.values(finalMap).sort((a, b) => a.gapDisponiveis - b.gapDisponiveis); 
  }, [baseData]);

  const filteredChartData = React.useMemo(() => {
    let filtered = chartData;
    if (activeFilter !== 'ALL') {
      filtered = chartData.filter(item => item.turno === activeFilter);
    }
    
    return filtered.map(item => ({
      ...item,
      displayName: activeFilter === 'ALL' ? item.name : item.baseName
    }));
  }, [chartData, activeFilter]);

  // 🔥 LÓGICA VISUAL: Transforma o número negativo em "Quantidade de Faltas" para a barra crescer para a direita
  const gapOnlyData = React.useMemo(() => {
    return filteredChartData
      .filter(hub => hub.gapDisponiveis < 0 || hub.gapAtivos < 0)
      .map(hub => ({
        ...hub,
        gapAtivosVisual: hub.gapAtivos < 0 ? Math.abs(hub.gapAtivos) : 0,
        gapDisponiveisVisual: hub.gapDisponiveis < 0 ? Math.abs(hub.gapDisponiveis) : 0
      }))
      // Ordena da maior quantidade de faltas para a menor
      .sort((a, b) => b.gapDisponiveisVisual - a.gapDisponiveisVisual);
  }, [filteredChartData]);

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white dark:bg-[#1f232d] border border-slate-200 dark:border-gray-800 p-3 rounded-lg shadow-xl z-50">
          <p className="font-black text-slate-800 dark:text-white mb-2 pb-2 border-b border-slate-100 dark:border-gray-700">{label}</p>
          {payload.map((entry, index) => (
            <p key={index} style={{ color: entry.color }} className="font-bold text-sm py-0.5">
              {entry.name}: {entry.value}
            </p>
          ))}
          <p className="text-[10px] text-slate-400 mt-3 pt-2 border-t border-slate-100 dark:border-gray-800 italic font-medium">
            * Necessários: CAP / SPR + 20% Margem<br/>
            * Disponíveis: Média móvel de 30 dias
          </p>
        </div>
      );
    }
    return null;
  };

  const renderChartCard = (id, title, subtitle, data, content, color) => {
    const isFullscreen = fullscreenChart === id;
    const dynamicHeight = Math.max(450, data.length * 35);

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
        
        <div className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar pr-2">
          {data.length === 0 ? (
            <div className="h-full flex items-center justify-center text-slate-400 font-bold text-center p-4">
              🎉 Nenhum déficit encontrado para este filtro!
            </div>
          ) : (
            <div style={{ height: `${dynamicHeight}px` }} className="w-full">
              {content}
            </div>
          )}
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
    <div className="mt-8">
      <div className="flex flex-col md:flex-row justify-between items-center bg-white dark:bg-[#1f232d] p-4 rounded-2xl shadow-sm border border-slate-200 dark:border-gray-800 mb-6">
        <div className="flex items-center gap-2 mb-4 md:mb-0 text-[#113366] dark:text-blue-400 font-black uppercase tracking-tight">
          <Filter size={20} />
          Visão por Turno:
        </div>
        <div className="flex bg-slate-100 dark:bg-[#15171e] p-1 rounded-xl">
          {['ALL', 'AM', 'PM1', 'PM2'].map(shift => (
            <button
              key={shift}
              onClick={() => setActiveFilter(shift)}
              className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${
                activeFilter === shift 
                  ? 'bg-[#EE4D2D] text-white shadow-md' 
                  : 'text-slate-500 dark:text-gray-400 hover:text-slate-800 hover:bg-white/50 dark:hover:bg-gray-800'
              }`}
            >
              {shift === 'ALL' ? 'TODOS' : shift}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 print:grid print:grid-cols-2 print:gap-4">
        {/* GRÁFICO 1: GAPS VISUAIS ALINHADOS À ESQUERDA */}
        {renderChartCard('gapChart', `Fleet Gap [Cenário Atual]`, "Quantidade de Drivers Faltantes para atingir a Meta (CAP/SPR + 20%)", gapOnlyData, (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart layout="vertical" data={gapOnlyData} margin={{ top: 10, right: 30, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#e2e8f0" />
                <XAxis type="number" tick={{fontSize: 11}} />
                {/* YAxis alinhado na esquerda padrão */}
                <YAxis dataKey="displayName" type="category" width={140} tick={{fontSize: 10, fontWeight: 'bold'}} interval={0} />
                <Tooltip content={<CustomTooltip />} cursor={{fill: 'rgba(0,0,0,0.05)'}} />
                <Legend wrapperStyle={{ paddingTop: '10px' }} />
                
                {/* Barras apontando pra direita usando os dados absolutos (Visuais) */}
                <Bar dataKey="gapAtivosVisual" name="Faltam (Ativos)" fill="#F59E0B" radius={[0, 4, 4, 0]} barSize={12} />
                <Bar dataKey="gapDisponiveisVisual" name="Faltam (Disponíveis)" fill="#D0011B" radius={[0, 4, 4, 0]} barSize={12} />
              </BarChart>
            </ResponsiveContainer>
        ), "#D0011B")}

        {renderChartCard('ativosMetaChart', `Panorama da Frota`, "Comparativo de Cadastro, Disponibilidade e Meta Diária", filteredChartData, (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart layout="vertical" data={filteredChartData} margin={{ top: 10, right: 40, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#e2e8f0" />
              <XAxis type="number" tick={{fontSize: 11}} />
              <YAxis dataKey="displayName" type="category" width={140} tick={{fontSize: 10, fontWeight: 'bold'}} interval={0} />
              <Tooltip content={<CustomTooltip />} cursor={{fill: 'rgba(0,0,0,0.05)'}} />
              <Legend wrapperStyle={{ paddingTop: '10px' }} />
              
              <Bar dataKey="ativos" name="Ativos Cadastrados" fill="#113366" radius={[0, 4, 4, 0]} barSize={10}>
                 <LabelList dataKey="ativos" position="right" style={{ fill: '#113366', fontSize: 10, fontWeight: 'bold' }} />
              </Bar>
              <Bar dataKey="disponiveis" name="Média Disponíveis (30d)" fill="#0284C7" radius={[0, 4, 4, 0]} barSize={10}>
                 <LabelList dataKey="disponiveis" position="right" style={{ fill: '#0284C7', fontSize: 10, fontWeight: 'bold' }} />
              </Bar>
              <Bar dataKey="necessarios" name="Meta Necessária (+20%)" fill="#EE4D2D" radius={[0, 4, 4, 0]} barSize={10}>
                 <LabelList dataKey="necessarios" position="right" style={{ fill: '#EE4D2D', fontSize: 10, fontWeight: 'bold' }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ), "#113366")}
        
      </div>
    </div>
  );
}