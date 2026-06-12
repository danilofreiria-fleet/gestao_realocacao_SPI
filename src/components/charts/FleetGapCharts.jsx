import React, { useState, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, LabelList } from 'recharts';
import { Database, Calculator, TrendingUp, Maximize2, Minimize2, X, Info, Filter } from 'lucide-react';

// 🔥 IMPORTAÇÃO DO MAPA UNIVERSAL
import { MAPA_REGIONAL_COMPLETO } from '../../constants/regionais';

export default function FleetGapCharts({ baseData, filtrosGlobais = {} }) {
  const [fullscreenChart, setFullscreenChart] = useState(null);
  const [localTurno, setLocalTurno] = useState('ALL'); 

  // 🔥 CORREÇÃO 1: Os filtros agora nascem como Arrays vazios
  const { regional = [], station = [], turno = [] } = filtrosGlobais;

  const parseNum = (val) => {
    let s = String(val || '0').trim();
    if (s.includes(',')) return Number(s.replace(/\./g, '').replace(',', '.'));
    return Number(s) || 0;
  };

  const chartData = useMemo(() => {
    if (!baseData || baseData.length === 0) return [];
    const finalMap = {};
    
    baseData.slice(1).forEach(row => {
      const stationFullName = String(row[0] || "").trim(); 
      const turnoLinha = String(row[1] || "").trim().toUpperCase(); 
      
      if (stationFullName && turnoLinha) {
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
            const uniqueKey = `${cleanStationName} [${turnoLinha}]`;

            finalMap[uniqueKey] = {
              name: uniqueKey,          
              baseName: cleanStationName, 
              fullName: stationFullName, 
              turno: turnoLinha,             
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

  const filteredChartData = useMemo(() => {
    return chartData.filter(item => {
      // 🔥 AGORA ELE LÊ DO MAPA COMPLETO
      const regDoItem = MAPA_REGIONAL_COMPLETO[item.fullName] || "";
      
      let matchTurno = true;
      if (localTurno !== 'ALL') {
        matchTurno = item.turno === localTurno;
      } else if (turno && turno.length > 0) {
        matchTurno = turno.includes(item.turno);
      }

      // 🔥 CORREÇÃO 2: Lendo os Arrays de Filtro Múltiplo
      const matchRegional = regional.length === 0 || regional.includes(regDoItem);
      const matchStation = station.length === 0 || station.includes(item.fullName); 
      
      return matchTurno && matchRegional && matchStation;
    }).map(item => ({
      ...item,
      displayName: station.length > 0 ? item.turno : item.name 
    }));
  }, [chartData, regional, station, turno, localTurno]);

  const gapOnlyData = useMemo(() => {
    return filteredChartData
      .filter(hub => hub.gapDisponiveis < 0 || hub.gapAtivos < 0)
      .map(hub => ({
        ...hub,
        gapAtivosVisual: hub.gapAtivos < 0 ? Math.abs(hub.gapAtivos) : 0,
        gapDisponiveisVisual: hub.gapDisponiveis < 0 ? Math.abs(hub.gapDisponiveis) : 0
      }))
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
        </div>
      );
    }
    return null;
  };

  const renderChartCard = (id, title, subtitle, data, content) => {
    const isFullscreen = fullscreenChart === id;
    
    // Altura dinâmica para acomodar as barras
    const dynamicHeight = Math.max(300, data.length * 60);

    const cardContent = (
      <div className={`bg-white dark:bg-[#1f232d] rounded-2xl shadow-sm border border-slate-200 dark:border-gray-800 flex flex-col relative transition-all ${isFullscreen ? 'w-full h-full p-8' : 'h-[500px] p-6'}`}>
        <div className="flex justify-between items-start mb-4 border-b border-slate-100 dark:border-gray-800 pb-4 shrink-0">
          <div>
            <h3 className={`font-black uppercase flex items-center gap-2 ${isFullscreen ? 'text-2xl' : 'text-lg'} text-[#113366]`}>
              {title}
            </h3>
            <p className="text-xs text-slate-400 font-bold uppercase mt-1 flex items-center gap-1">
              <Info size={12}/> {subtitle}
            </p>
          </div>
          <button onClick={() => setFullscreenChart(isFullscreen ? null : id)} className="text-slate-400 hover:text-[#EE4D2D] bg-slate-50 hover:bg-orange-50 dark:bg-gray-800 p-2 rounded-lg transition-colors">
            {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar pr-2">
          {data.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 font-bold text-center p-4">
              <span className="text-4xl mb-2">🎉</span>
              Nenhum déficit de frota para os filtros aplicados no momento!
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

  if (chartData.length === 0) return null;

  return (
    <div className="mt-6 flex flex-col gap-6">
      
      {/* 🔥 BANNER DE STORYTELLING: GESTÃO DE FROTA */}
      <div className="bg-white dark:bg-[#1f232d] p-5 md:p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-gray-800 shrink-0">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 bg-slate-50 dark:bg-[#15171e] p-5 rounded-xl border border-slate-200 dark:border-gray-700">
          
          {/* Pilar 1: Origem dos Dados */}
          <div className="flex gap-3 items-start">
            <div className="p-2 bg-blue-50 dark:bg-blue-950/30 text-[#113366] dark:text-blue-400 rounded-lg shrink-0">
              <Database size={16} />
            </div>
            <div className="flex flex-col gap-1">
              <h4 className="text-[11px] font-black text-slate-800 dark:text-white uppercase tracking-wider">Origem dos Dados</h4>
              <p className="text-[11px] text-slate-500 dark:text-gray-400 font-medium leading-relaxed">
                As premissas de Capacidade, SPR e Média de Disponibilidade (30d) vêm da aba <strong>BASE</strong> do painel de operações. Já o histórico da Evolução de Frota (Ativos, Novos, Dormentes, Risco e Churn) é puxado diariamente da planilha <em>[Gestão Drivers]</em>.
              </p>
            </div>
          </div>

          {/* Pilar 2: Cálculo de Gap / Dimensionamento */}
          <div className="flex gap-3 items-start border-t lg:border-t-0 lg:border-l border-slate-200 dark:border-gray-700 pt-4 lg:pt-0 lg:pl-6">
            <div className="p-2 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 rounded-lg shrink-0">
              <Calculator size={16} />
            </div>
            <div className="flex flex-col gap-1">
              <h4 className="text-[11px] font-black text-slate-800 dark:text-white uppercase tracking-wider">Cálculo de Necessidade (Gap)</h4>
              <p className="text-[11px] text-slate-500 dark:text-gray-400 font-medium leading-relaxed">
                O tamanho ideal da frota é definido por: <strong>(CAP do Hub ÷ SPR Ref) + 20%</strong> de margem de segurança. Os gráficos calculam a diferença (déficit) cruzando essa necessidade contra a base de Motoristas Ativos e Motoristas Disponíveis.
              </p>
            </div>
          </div>

          {/* Pilar 3: Status de Frota */}
          <div className="flex gap-3 items-start border-t lg:border-t-0 lg:border-l border-slate-200 dark:border-gray-700 pt-4 lg:pt-0 lg:pl-6">
            <div className="p-2 bg-orange-50 dark:bg-orange-950/20 text-[#EE4D2D] rounded-lg shrink-0">
              <TrendingUp size={16} />
            </div>
            <div className="flex flex-col gap-1">
              <h4 className="text-[11px] font-black text-slate-800 dark:text-white uppercase tracking-wider">Evolução & Snapshots</h4>
              <p className="text-[11px] text-slate-500 dark:text-gray-400 font-medium leading-relaxed">
                O sistema consolida a "fotografia" diária da frota. A variação percentual analisa sempre o crescimento ou decréscimo da <strong>Base Ativa</strong> (Ativos + Novos) em relação ao período anterior (Dia a Dia, Semanal ou Mensal).
              </p>
            </div>
          </div>

        </div>
      </div>

      <div className="flex justify-between items-center bg-white dark:bg-[#1f232d] p-4 rounded-2xl shadow-sm border border-slate-200 dark:border-gray-800">
        <div className="flex items-center gap-2 text-[#113366] dark:text-blue-400 font-black uppercase tracking-tight">
          <Filter size={20} /> Visão Rápida por Turno:
        </div>
        <div className="flex bg-slate-100 dark:bg-[#15171e] p-1 rounded-xl border border-slate-200 dark:border-gray-700">
          {['ALL', 'AM', 'PM1', 'PM2'].map(shift => (
            <button
              key={shift}
              onClick={() => setLocalTurno(shift)}
              className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${
                localTurno === shift 
                  ? 'bg-[#EE4D2D] text-white shadow-md' 
                  : 'text-slate-500 dark:text-gray-400 hover:text-slate-800 dark:hover:text-white hover:bg-white/50 dark:hover:bg-gray-800'
              }`}
            >
              {shift === 'ALL' ? 'TODOS' : shift}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {renderChartCard('gapChart', `Fleet Gap [Cenário Atual]`, "Quantidade de Drivers Faltantes para atingir a Meta", gapOnlyData, (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart layout="vertical" data={gapOnlyData} margin={{ top: 10, right: 40, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#e2e8f0" />
                <XAxis type="number" tick={{fontSize: 11, fill: '#113366'}} />
                <YAxis dataKey="displayName" type="category" width={140} tick={{fontSize: 10, fontWeight: 'bold', fill: '#113366'}} interval={0} />
                <Tooltip content={<CustomTooltip />} cursor={{fill: 'rgba(0,0,0,0.05)'}} />
                <Legend wrapperStyle={{ paddingTop: '10px' }} />
                
                <Bar dataKey="gapAtivosVisual" name="Faltam (Ativos)" fill="#EE4D2D" radius={[0, 4, 4, 0]} barSize={12}>
                  <LabelList dataKey="gapAtivosVisual" position="right" style={{ fill: '#EE4D2D', fontSize: 10, fontWeight: 'bold' }} />
                </Bar>
                <Bar dataKey="gapDisponiveisVisual" name="Faltam (Disponíveis)" fill="#D0011B" radius={[0, 4, 4, 0]} barSize={12}>
                  <LabelList dataKey="gapDisponiveisVisual" position="right" style={{ fill: '#D0011B', fontSize: 10, fontWeight: 'bold' }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
        ))}

        {renderChartCard('ativosMetaChart', `Panorama da Frota`, "Comparativo de Cadastro, Disponibilidade e Meta Diária", filteredChartData, (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart layout="vertical" data={filteredChartData} margin={{ top: 10, right: 40, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#e2e8f0" />
              <XAxis type="number" tick={{fontSize: 11, fill: '#113366'}} />
              <YAxis dataKey="displayName" type="category" width={140} tick={{fontSize: 10, fontWeight: 'bold', fill: '#113366'}} interval={0} />
              <Tooltip content={<CustomTooltip />} cursor={{fill: 'rgba(0,0,0,0.05)'}} />
              <Legend wrapperStyle={{ paddingTop: '10px' }} />
              
              <Bar dataKey="ativos" name="Ativos Cadastrados" fill="#113366" radius={[0, 4, 4, 0]} barSize={10}>
                 <LabelList dataKey="ativos" position="right" style={{ fill: '#113366', fontSize: 10, fontWeight: 'bold' }} />
              </Bar>
              <Bar dataKey="disponiveis" name="Média Disponíveis (30d)" fill="#EE4D2D" radius={[0, 4, 4, 0]} barSize={10}>
                 <LabelList dataKey="disponiveis" position="right" style={{ fill: '#EE4D2D', fontSize: 10, fontWeight: 'bold' }} />
              </Bar>
              <Bar dataKey="necessarios" name="Meta Necessária (+20%)" fill="#D0011B" radius={[0, 4, 4, 0]} barSize={10}>
                 <LabelList dataKey="necessarios" position="right" style={{ fill: '#D0011B', fontSize: 10, fontWeight: 'bold' }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ))}
      </div>
    </div>
  );}