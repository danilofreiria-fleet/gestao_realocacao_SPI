import React, { useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend, LabelList, LineChart, Line, AreaChart, Area } from 'recharts';
import { Clock, TimerReset, CheckCircle, AlertTriangle, Timer, Activity, ChevronDown, ChevronRight, AlertCircle } from 'lucide-react';

export default function TimeAnalysisCharts({ data }) {
  // Estado para controlar quais linhas da tabela de atraso estão expandidas
  const [expandedRows, setExpandedRows] = useState({});

  const toggleRow = (index) => {
    setExpandedRows(prev => ({ ...prev, [index]: !prev[index] }));
  };

  // =======================================================================
  // FUNÇÕES DE TEMPO E MATEMÁTICA
  // =======================================================================
  const timeToMinutes = (timeStr) => {
    if (!timeStr || typeof timeStr !== 'string') return null;
    const parts = timeStr.split(':');
    if (parts.length < 2) return null;
    const h = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    if (isNaN(h) || isNaN(m)) return null;
    return (h * 60) + m;
  };

  const minutesToTime = (totalMinutes) => {
    if (totalMinutes === null || isNaN(totalMinutes)) return '--:--';
    const h = Math.floor(Math.abs(totalMinutes) / 60);
    const m = Math.floor(Math.abs(totalMinutes) % 60);
    const sign = totalMinutes < 0 ? '-' : '';
    return `${sign}${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  };

  const parseNum = (val) => {
    let s = String(val || '0').trim();
    if (s.includes(',')) return Number(s.replace(/\./g, '').replace(',', '.'));
    return Number(s) || 0;
  };

  // =======================================================================
  // PROCESSAMENTO DOS DADOS GERAIS
  // =======================================================================
  const processedData = useMemo(() => {
    if (!data || data.length === 0) return null;

    let pontualInicio = 0;
    let atrasoInicio = 0;
    let pontualFim = 0;
    let atrasoFim = 0;

    let totalMinutosDelivering = 0;
    let qtdRegistrosDelivering = 0;
    let totalCarregados = 0;

    const serieTemporal = {};
    const analiseRegional = {};
    
    const listaAtrasos = [];

    data.forEach((row, index) => {
      const reg = row[1] || 'N/A';
      const dataStr = row[3] || 'N/A';
      
      const inicioReal = timeToMinutes(row[6]);   
      const fimReal = timeToMinutes(row[7]);      
      const inicioSetup = timeToMinutes(row[8]);  
      const fimSetup = timeToMinutes(row[9]);     
      const tempoTotalOp = timeToMinutes(row[10]); 
      
      const carregados = parseNum(row[29]);       

      let isAtrasado = false;

      // CÁLCULO INÍCIO
      if (inicioReal !== null && inicioSetup !== null) {
        if (inicioReal > (inicioSetup + 15)) {
          atrasoInicio++;
          isAtrasado = true;
        } else {
          pontualInicio++;
        }
      }

      // CÁLCULO FIM
      if (fimReal !== null && fimSetup !== null) {
        if (fimReal > (fimSetup + 15)) {
          atrasoFim++;
          isAtrasado = true;
        } else {
          pontualFim++;
        }
      }

      if (isAtrasado) {
        listaAtrasos.push({
          originalIndex: index,
          hub: row[4] || 'N/A',
          data: row[3] || 'N/A',
          inicio: row[6] || '--:--',
          fim: row[7] || '--:--',
          tempoOp: row[10] || '--:--',
          justificativa: row[41] || 'Sem justificativa informada'
        });
      }

      // MÉDIAS GERAIS
      if (tempoTotalOp !== null && tempoTotalOp > 0) {
        totalMinutosDelivering += tempoTotalOp;
        qtdRegistrosDelivering++;
        
        if (carregados > 0) {
          totalCarregados += carregados;
        }

        if (!analiseRegional[reg]) {
          analiseRegional[reg] = { regional: reg, totalTempo: 0, count: 0, totalCarregado: 0 };
        }
        analiseRegional[reg].totalTempo += tempoTotalOp;
        analiseRegional[reg].count++;
        analiseRegional[reg].totalCarregado += carregados;
      }

      // SÉRIE TEMPORAL
      const shortDate = dataStr.includes('/') ? dataStr.split('/').slice(0,2).join('/') : dataStr;
      
      if (tempoTotalOp !== null && tempoTotalOp > 0) {
        if (!serieTemporal[shortDate]) {
          serieTemporal[shortDate] = { name: shortDate, somaTempo: 0, count: 0, somaCarregado: 0 };
        }
        serieTemporal[shortDate].somaTempo += tempoTotalOp;
        serieTemporal[shortDate].count++;
        serieTemporal[shortDate].somaCarregado += carregados;
      }
    });

const tempoMedioTotalStr = qtdRegistrosDelivering > 0 
      ? minutesToTime(totalMinutosDelivering / qtdRegistrosDelivering) 
      : '--:--';

    // 🔥 NOVO CÁLCULO: Convertendo decimal para Minutos e Segundos
    let mediaMinPorVeiculoStr = '0min 0seg';
    if (totalMinutosDelivering > 0 && totalCarregados > 0) {
      const totalSegundos = (totalMinutosDelivering * 60) / totalCarregados;
      const m = Math.floor(totalSegundos / 60);
      const s = Math.round(totalSegundos % 60);
      mediaMinPorVeiculoStr = `${m}min ${s.toString().padStart(2, '0')}seg`;
    }

    const chartInicio = [
      { name: 'Pontual', value: pontualInicio, fill: '#113366' },
      { name: 'Atrasado', value: atrasoInicio, fill: '#EE4D2D' }
    ];

    const chartFim = [
      { name: 'Pontual', value: pontualFim, fill: '#113366' },
      { name: 'Atrasado', value: atrasoFim, fill: '#D0011B' }
    ];

    const chartRegional = Object.values(analiseRegional).map(r => ({
      name: r.regional,
      tempoMedioMin: Math.round(r.totalTempo / r.count),
      tempoStr: minutesToTime(r.totalTempo / r.count)
    })).sort((a, b) => b.tempoMedioMin - a.tempoMedioMin);

    const chartVelocidadeData = Object.values(serieTemporal).map(d => ({
      name: d.name,
      velPorHora: d.somaTempo > 0 ? Math.round((d.somaCarregado / (d.somaTempo / 60))) : 0,
      tempoMedioMin: Math.round(d.somaTempo / d.count)
    })).sort((a,b) => {
        const [da, ma] = a.name.split('/');
        const [db, mb] = b.name.split('/');
        if(ma !== mb) return parseInt(ma) - parseInt(mb);
        return parseInt(da) - parseInt(db);
    });

    return {
      kpis: {
        tempoMedioTotalStr,
        mediaMinPorVeiculo: mediaMinPorVeiculoStr, 
        pctPontualInicio: (pontualInicio + atrasoInicio) > 0 ? Math.round((pontualInicio / (pontualInicio + atrasoInicio)) * 100) : 0,
        pctPontualFim: (pontualFim + atrasoFim) > 0 ? Math.round((pontualFim / (pontualFim + atrasoFim)) * 100) : 0,
      },
      chartInicio,
      chartFim,
      chartRegional,
      chartVelocidadeData,
      listaAtrasos 
    };
  }, [data]);

  if (!processedData) {
    return <div className="p-10 text-center font-bold text-slate-400">Nenhum dado de horário encontrado.</div>;
  }

  const { kpis, chartInicio, chartFim, chartRegional, chartVelocidadeData, listaAtrasos } = processedData;

  const CustomTooltipLine = ({ active, payload, label }) => {
    if (active && payload && payload.length > 0) {
      const vel = payload[0] ? payload[0].value : 0;
      const tempo = payload[1] ? payload[1].value : 0;
      
      return (
        <div className="bg-white dark:bg-[#1f232d] border border-slate-200 dark:border-gray-800 p-3 rounded-lg shadow-xl z-50">
          <p className="font-bold text-slate-800 dark:text-white mb-1">{label}</p>
          <p className="text-[#113366] text-xs font-black">Velocidade: {vel} Veículos/Hora</p>
          <p className="text-slate-500 text-xs font-bold mt-1">T. Médio: {minutesToTime(tempo)}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      
      {/* 1. TOPO: KPIs Principais */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 print:grid-cols-4 print:gap-2">
        <div className="bg-white dark:bg-[#1f232d] p-6 rounded-2xl border border-slate-200 dark:border-gray-800 shadow-sm flex flex-col justify-center print:border-gray-300">
          <div className="flex items-center gap-2 mb-2"><Timer className="text-[#EE4D2D]" size={20}/><h4 className="text-xs font-black text-slate-500 uppercase tracking-widest">Tempo Médio Ops</h4></div>
          <span className="text-3xl font-black text-[#113366] dark:text-white">{kpis.tempoMedioTotalStr}</span>
          <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">Duração da Expedição</p>
        </div>

        <div className="bg-white dark:bg-[#1f232d] p-6 rounded-2xl border border-slate-200 dark:border-gray-800 shadow-sm flex flex-col justify-center print:border-gray-300">
          <div className="flex items-center gap-2 mb-2"><Activity className="text-[#113366]" size={20}/><h4 className="text-xs font-black text-slate-500 uppercase tracking-widest">Ritmo Médio</h4></div>
          <div className="flex items-end gap-1">
             <span className="text-3xl font-black text-[#EE4D2D]">{kpis.mediaMinPorVeiculo}</span>
             <span className="text-sm font-bold text-slate-400 mb-1">min</span>
          </div>
          <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">Por Veículo Expedido</p>
        </div>

        <div className="bg-white dark:bg-[#1f232d] p-6 rounded-2xl border border-slate-200 dark:border-gray-800 shadow-sm flex flex-col justify-center print:border-gray-300">
          <div className="flex items-center gap-2 mb-2"><CheckCircle className="text-[#113366]" size={20}/><h4 className="text-xs font-black text-slate-500 uppercase tracking-widest">Aderência Inicial</h4></div>
          <span className="text-3xl font-black text-[#113366] dark:text-white">{kpis.pctPontualInicio}%</span>
          <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">Tolerância de 15 min </p>
        </div>

        <div className="bg-white dark:bg-[#1f232d] p-6 rounded-2xl border border-slate-200 dark:border-gray-800 shadow-sm flex flex-col justify-center print:border-gray-300">
          <div className="flex items-center gap-2 mb-2"><AlertTriangle className="text-[#EE4D2D]" size={20}/><h4 className="text-xs font-black text-slate-500 uppercase tracking-widest">Aderência Final</h4></div>
          <span className="text-3xl font-black text-[#EE4D2D] dark:text-white">{kpis.pctPontualFim}%</span>
          <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">Fechamento no Horário</p>
        </div>
      </div>

      {/* 2. MEIO: Gráficos de Pontualidade Pizza */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 print:grid-cols-3 print:gap-4">
        
        {/* Gráfico Pizza Início */}
        <div className="bg-white dark:bg-[#1f232d] p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-gray-800 flex flex-col print:break-inside-avoid print:border-gray-300">
          <h3 className="font-black text-sm text-slate-700 dark:text-gray-200 uppercase mb-4 text-center">Pontualidade (Início)</h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={chartInicio} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" stroke="none" label={{fontSize: 11, fontWeight: 'bold'}}>
                  {chartInicio.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.fill} />)}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: '12px', border: 'none' }} />
                <Legend wrapperStyle={{fontSize: '11px', fontWeight: 'bold'}} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Gráfico Pizza Fim */}
        <div className="bg-white dark:bg-[#1f232d] p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-gray-800 flex flex-col print:break-inside-avoid print:border-gray-300">
          <h3 className="font-black text-sm text-slate-700 dark:text-gray-200 uppercase mb-4 text-center">Pontualidade (Término)</h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={chartFim} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" stroke="none" label={{fontSize: 11, fontWeight: 'bold'}}>
                  {chartFim.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.fill} />)}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: '12px', border: 'none' }} />
                <Legend wrapperStyle={{fontSize: '11px', fontWeight: 'bold'}} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Gráfico Barra Horizontal: Tempo Médio Regional */}
        <div className="bg-white dark:bg-[#1f232d] p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-gray-800 flex flex-col print:break-inside-avoid print:border-gray-300">
          <h3 className="font-black text-sm text-slate-700 dark:text-gray-200 uppercase mb-4">Tempo Médio Ops (Regional)</h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartRegional} layout="vertical" margin={{top: 0, right: 30, left: -20, bottom: 0}}>
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#e2e8f0" />
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" width={80} tick={{fontSize: 10, fontWeight: 'bold'}} axisLine={false} tickLine={false} />
                <Tooltip cursor={{fill: 'rgba(0,0,0,0.05)'}} contentStyle={{ borderRadius: '12px', border: 'none' }} />
                <Bar dataKey="tempoMedioMin" fill="#113366" barSize={16} radius={[0, 4, 4, 0]}>
                  <LabelList dataKey="tempoStr" position="right" fontSize={10} fontWeight="bold" fill="#EE4D2D" />
                  {chartRegional.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={index === 0 ? '#D0011B' : '#113366'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>

      {/* 3. BASE: Gráfico de Evolução (Área + Linha) */}
      <div className="bg-white dark:bg-[#1f232d] p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-gray-800 print:break-inside-avoid print:border-gray-300">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h3 className="font-black text-lg text-[#113366] dark:text-white uppercase">Evolução do Ritmo Operacional</h3>
            <p className="text-xs font-bold text-slate-400">Veículos processados por hora vs Tempo médio de expedição.</p>
          </div>
        </div>

        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartVelocidadeData} margin={{ top: 20, right: 20, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorVelocidade" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#113366" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#113366" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="name" tick={{fontSize: 10, fontWeight: 'bold'}} axisLine={false} tickLine={false}/>
              <YAxis yAxisId="left" tick={{fontSize: 10}} axisLine={false} tickLine={false} />
              <YAxis yAxisId="right" orientation="right" hide />
              <Tooltip content={<CustomTooltipLine />} />
              <Legend wrapperStyle={{fontSize: '11px', fontWeight: 'bold'}} />
              
              <Area yAxisId="left" type="monotone" dataKey="velPorHora" name="Veículos / Hora" stroke="#113366" fillOpacity={1} fill="url(#colorVelocidade)" strokeWidth={3} />
              <Line yAxisId="right" type="monotone" dataKey="tempoMedioMin" name="Tempo Médio (Minutos)" stroke="#EE4D2D" strokeWidth={3} dot={{r: 4, strokeWidth: 2}} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 4. 🔥 TABELA DE ATRASOS CRÍTICOS (AGORA COM CABEÇALHO FIXO) 🔥 */}
      <div className="bg-white dark:bg-[#1f232d] rounded-2xl shadow-sm border border-slate-200 dark:border-gray-800 flex flex-col mt-6 print:break-inside-avoid" style={{ maxHeight: '600px' }}>
        
        {/* BARRA VERMELHA (FIXA NO TOPO DA TABELA) */}
        <div className="bg-[#D0011B] p-4 flex items-center justify-between shrink-0 rounded-t-2xl z-20">
          <div className="flex items-center gap-2 text-white">
            <AlertCircle size={20} />
            <h3 className="font-black text-sm uppercase tracking-widest">Ocorrências de Atraso (Tolerância 15 min)</h3>
          </div>
          <div className="bg-white text-[#D0011B] text-[10px] font-black uppercase px-3 py-1 rounded-full shadow-sm">
            {listaAtrasos.length} Registros
          </div>
        </div>

        {/* CONTEÚDO SCROLLÁVEL */}
        {listaAtrasos.length === 0 ? (
          <div className="p-10 text-center font-bold text-slate-400 bg-slate-50 dark:bg-[#15171e] rounded-b-2xl">
            Parabéns! Nenhuma operação estourou o limite de tolerância.
          </div>
        ) : (
          <div className="overflow-auto custom-scrollbar flex-1 relative rounded-b-2xl">
            <table className="w-full text-left text-sm whitespace-nowrap">
              
              {/* CABEÇALHO DAS COLUNAS (FIXO LOGO ABAIXO DA BARRA VERMELHA) */}
              <thead className="bg-slate-50 dark:bg-gray-800 text-slate-500 dark:text-gray-400 text-[10px] uppercase font-black tracking-widest border-b border-slate-200 dark:border-gray-700 sticky top-0 z-10 shadow-sm">
                <tr>
                  <th className="px-4 py-3">Hub (Station)</th>
                  <th className="px-4 py-3 text-center">Data</th>
                  <th className="px-4 py-3 text-center">Início</th>
                  <th className="px-4 py-3 text-center">Fim</th>
                  <th className="px-4 py-3 text-center">Tempo de Op.</th>
                  <th className="px-4 py-3 min-w-[250px]">Justificativa / Pontos de Atenção</th>
                </tr>
              </thead>

              {/* CORPO DA TABELA */}
              <tbody className="divide-y divide-slate-100 dark:divide-gray-800 font-bold">
                {listaAtrasos.map((item) => {
                  const isExpanded = expandedRows[item.originalIndex];
                  return (
                    <tr key={item.originalIndex} className="hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors">
                      <td className="px-4 py-3 text-[#113366] dark:text-blue-400">{item.hub}</td>
                      <td className="px-4 py-3 text-slate-600 dark:text-gray-300 text-center">{item.data}</td>
                      <td className="px-4 py-3 text-slate-600 dark:text-gray-300 text-center">{item.inicio}</td>
                      <td className="px-4 py-3 text-slate-600 dark:text-gray-300 text-center">{item.fim}</td>
                      <td className="px-4 py-3 text-[#EE4D2D] text-center">{item.tempoOp}</td>
                      
                      <td className="px-4 py-3 text-slate-600 dark:text-gray-400 max-w-xs relative group cursor-pointer" onClick={() => toggleRow(item.originalIndex)}>
                        <div className="flex items-start gap-2">
                          <button className="mt-0.5 text-slate-400 hover:text-[#EE4D2D] transition-colors shrink-0">
                            {isExpanded ? <ChevronDown size={14}/> : <ChevronRight size={14}/>}
                          </button>
                          <div className={`transition-all duration-300 ${isExpanded ? 'whitespace-normal' : 'truncate'}`}>
                            {item.justificativa}
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}