import React, { useMemo, useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend, LabelList } from 'recharts';
import { Timer, CheckCircle, AlertTriangle, AlertCircle, Clock, CalendarDays, ChevronDown, ChevronRight, X, TrendingUp, TrendingDown, Users, Database, Calculator, LayoutDashboard, Lightbulb } from 'lucide-react';
import { MAPA_REGIONAL_COMPLETO } from '../../constants/regionais';

export default function TimeAnalysisCharts({ data }) {
  const [expandedReg, setExpandedReg] = useState({});
  const [activePizzaDetails, setActivePizzaDetails] = useState(null); 
  
  // 🔥 TRUQUE DE PERFORMANCE (Debounce Visual para evitar Lag)
  const [isRendering, setIsRendering] = useState(false);

  useEffect(() => {
    setIsRendering(false);
    const timeout = setTimeout(() => setIsRendering(true), 150);
    return () => clearTimeout(timeout);
  }, [data]);

  const toggleExpandReg = (reg) => {
    setExpandedReg(prev => ({ ...prev, [reg]: !prev[reg] }));
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
    const absMin = Math.abs(totalMinutes);
    const h = Math.floor(absMin / 60);
    const m = Math.floor(absMin % 60);
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

    let somaMinutosAtrasoInicio = 0;
    let registrosComInicioValido = 0;
    
    let somaMinutosAtrasoFim = 0;
    let registrosComFimValido = 0;

    let totalMinutosDelivering = 0;
    let qtdRegistrosDelivering = 0;

    const listaAtrasos = [];
    const detalhesAtrasoInicio = [];
    const detalhesAtrasoFim = [];

    const frotaOfertadaMap = {};

    data.forEach((row, index) => {
      const regBruta = row[1] || 'N/A';
      const hubRow = String(row[4] || "").trim();
      const reg = MAPA_REGIONAL_COMPLETO[hubRow] || regBruta;
      
      const dataStr = row[3] || 'N/A';
      
      const inicioReal = timeToMinutes(row[6]);   
      const fimReal = timeToMinutes(row[7]);      
      const inicioSetup = timeToMinutes(row[8]);  
      const fimSetup = timeToMinutes(row[9]);     
      const tempoTotalOp = timeToMinutes(row[10]); 
      
      const veiculosOfertados = parseNum(row[24]); 

      let isAtrasadoGeral = false;

      // CÁLCULO INÍCIO
      if (inicioReal !== null && inicioSetup !== null) {
        const difInicio = inicioReal - inicioSetup; 
        somaMinutosAtrasoInicio += difInicio;
        registrosComInicioValido++;

        if (difInicio > 15) {
          atrasoInicio++;
          isAtrasadoGeral = true;
          detalhesAtrasoInicio.push({ hub: hubRow, data: dataStr, difMin: difInicio, setup: row[8], real: row[6] });
        } else {
          pontualInicio++;
        }
      }

      // CÁLCULO FIM
      if (fimReal !== null && fimSetup !== null) {
        const difFim = fimReal - fimSetup;
        somaMinutosAtrasoFim += difFim;
        registrosComFimValido++;

        if (difFim > 15) {
          atrasoFim++;
          isAtrasadoGeral = true;
          detalhesAtrasoFim.push({ hub: hubRow, data: dataStr, difMin: difFim, setup: row[9], real: row[7] });
        } else {
          pontualFim++;
        }
      }

      if (isAtrasadoGeral) {
        listaAtrasos.push({
          originalIndex: index,
          hub: hubRow || 'N/A',
          data: dataStr,
          setupInicio: row[8] || '--:--', 
          inicio: row[6] || '--:--',      
          setupFim: row[9] || '--:--',    
          fim: row[7] || '--:--',         
          tempoOp: row[10] || '--:--'
        });
      }

      if (tempoTotalOp !== null && tempoTotalOp > 0) {
        totalMinutosDelivering += tempoTotalOp;
        qtdRegistrosDelivering++;
      }

      if (!frotaOfertadaMap[reg]) {
        frotaOfertadaMap[reg] = { regional: reg, totalVeiculos: 0, hubs: {} };
      }
      frotaOfertadaMap[reg].totalVeiculos += veiculosOfertados;

      if (!frotaOfertadaMap[reg].hubs[hubRow]) {
        frotaOfertadaMap[reg].hubs[hubRow] = 0;
      }
      frotaOfertadaMap[reg].hubs[hubRow] += veiculosOfertados;
    });

    const tempoMedioTotalStr = qtdRegistrosDelivering > 0 
      ? minutesToTime(totalMinutosDelivering / qtdRegistrosDelivering) 
      : '--:--';

    const mediaAtrasoInicioMin = registrosComInicioValido > 0 
      ? Math.round(somaMinutosAtrasoInicio / registrosComInicioValido) 
      : 0;

    const mediaAtrasoFimMin = registrosComFimValido > 0 
      ? Math.round(somaMinutosAtrasoFim / registrosComFimValido) 
      : 0;

    const chartInicio = [
      { name: 'Pontual', value: pontualInicio, fill: '#113366', details: [] },
      { name: 'Atrasado', value: atrasoInicio, fill: '#EE4D2D', details: detalhesAtrasoInicio }
    ];

    const chartFim = [
      { name: 'Pontual', value: pontualFim, fill: '#113366', details: [] },
      { name: 'Atrasado', value: atrasoFim, fill: '#D0011B', details: detalhesAtrasoFim }
    ];

    const chartFrotaOfertada = Object.values(frotaOfertadaMap).map(r => {
      const hubsList = Object.keys(r.hubs).map(hName => ({ name: hName, value: r.hubs[hName] })).sort((a,b) => b.value - a.value);
      return {
        id: r.regional,
        name: r.regional,
        total: r.totalVeiculos,
        hubs: hubsList
      };
    }).sort((a, b) => b.total - a.total);

    return {
      kpis: {
        tempoMedioTotalStr,
        mediaAtrasoInicioMin,
        mediaAtrasoFimMin,
        pctPontualInicio: (pontualInicio + atrasoInicio) > 0 ? Math.round((pontualInicio / (pontualInicio + atrasoInicio)) * 100) : 0,
        pctPontualFim: (pontualFim + atrasoFim) > 0 ? Math.round((pontualFim / (pontualFim + atrasoFim)) * 100) : 0,
      },
      chartInicio,
      chartFim,
      chartFrotaOfertada,
      listaAtrasos 
    };
  }, [data]);

  if (!processedData) {
    return <div className="p-10 text-center font-bold text-slate-400">Nenhum dado de horário encontrado.</div>;
  }

  const { kpis, chartInicio, chartFim, chartFrotaOfertada, listaAtrasos } = processedData;

  const DelayKPICard = ({ title, mediaMin, icon }) => {
    const isLate = mediaMin > 0;
    const colorClass = isLate ? 'text-[#EE4D2D]' : 'text-green-500';
    const signal = isLate ? '+' : '';

    return (
      <div className="bg-white dark:bg-[#1f232d] p-6 rounded-2xl border border-slate-200 dark:border-gray-800 shadow-sm flex flex-col justify-center print:border-gray-300 relative overflow-hidden group">
        <div className={`absolute top-0 right-0 w-16 h-16 ${isLate ? 'bg-red-50 dark:bg-red-900/10' : 'bg-green-50 dark:bg-green-900/10'} rounded-bl-full -mr-8 -mt-8 transition-transform group-hover:scale-110`}></div>
        <div className="flex items-center gap-2 mb-2 relative z-10">
          {icon} 
          <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest">{title}</h4>
        </div>
        <div className="flex items-end gap-1 relative z-10">
           <span className={`text-3xl font-black ${colorClass}`}>{signal}{mediaMin}</span>
           <span className="text-sm font-bold text-slate-400 mb-1">min</span>
        </div>
        <div className="flex items-center gap-1 mt-2 relative z-10">
          {isLate ? <TrendingDown size={14} className="text-[#EE4D2D]"/> : <TrendingUp size={14} className="text-green-500"/>}
          <p className="text-[10px] text-slate-400 font-bold uppercase">
             {isLate ? 'Atrasado em relação ao Plano' : 'Adiantado em relação ao Plano'}
          </p>
        </div>
      </div>
    );
  };

  const handlePizzaClick = (entry, tipo) => {
    if (entry.name === 'Atrasado' && entry.details.length > 0) {
      setActivePizzaDetails({ tipo: tipo, data: entry.details });
    }
  };

  return (
    <div className="space-y-6 relative">
      
      {/* 🔥 BANNER DE STORYTELLING PARA A GESTÃO */}
      <div className="bg-white dark:bg-[#1f232d] p-5 md:p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-gray-800 shrink-0">
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-6 bg-slate-50 dark:bg-[#15171e] p-5 rounded-xl border border-slate-200 dark:border-gray-700">
          
          {/* Pilar 1: Origem */}
          <div className="flex gap-3 items-start">
            <div className="p-2 bg-blue-50 dark:bg-blue-950/30 text-[#113366] dark:text-blue-400 rounded-lg shrink-0">
              <Database size={16} />
            </div>
            <div className="flex flex-col gap-1">
              <h4 className="text-[11px] font-black text-slate-800 dark:text-white uppercase tracking-wider">Origem dos Dados</h4>
              <p className="text-[11px] text-slate-500 dark:text-gray-400 font-medium leading-relaxed">
                Este consolidado cruza o <strong>Setup (aba BASE)</strong> com o <strong>Horário Sinalizado (Analista)</strong> de acordo com o turno. Alterações de setup devem ser feitas na aba BASE, pois não possuímos link em tempo real com o PCP. Vale ressaltar: não há registro histórico de alteração de setup (ele é fixo).
              </p>
            </div>
          </div>

          {/* Pilar 2: Desvios (Adiantado x Atrasado) */}
          <div className="flex gap-3 items-start border-t lg:border-t-0 lg:border-l border-slate-200 dark:border-gray-700 pt-4 lg:pt-0 lg:pl-6">
            <div className="p-2 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 rounded-lg shrink-0">
              <Calculator size={16} />
            </div>
            <div className="flex flex-col gap-1">
              <h4 className="text-[11px] font-black text-slate-800 dark:text-white uppercase tracking-wider">Desvios Médios (Minutos)</h4>
              <p className="text-[11px] text-slate-500 dark:text-gray-400 font-medium leading-relaxed">
                O cálculo avalia a variação em minutos. Quando os Desvios Iniciais/Finais estão <strong>VERDES</strong>, mostram que a operação terminou <strong>ADIANTADA</strong>. Quando <strong>VERMELHOS</strong>, mostram o tempo médio de <strong>ATRASO</strong> no período.
              </p>
            </div>
          </div>

          {/* Pilar 3: Gráficos de Pontualidade */}
          <div className="flex gap-3 items-start border-t xl:border-t-0 xl:border-l border-slate-200 dark:border-gray-700 pt-4 xl:pt-0 xl:pl-6">
            <div className="p-2 bg-orange-50 dark:bg-orange-950/20 text-[#EE4D2D] rounded-lg shrink-0">
              <LayoutDashboard size={16} />
            </div>
            <div className="flex flex-col gap-1">
              <h4 className="text-[11px] font-black text-slate-800 dark:text-white uppercase tracking-wider">Aderência & Gráficos</h4>
              <p className="text-[11px] text-slate-500 dark:text-gray-400 font-medium leading-relaxed">
                O card de <strong>Aderência Geral</strong> mostra a porcentagem (%) de pontualidade agregada. Nas Pizzas interativas, clique na fatia <strong>ATRASADO</strong> para abrir o detalhamento da ocorrência (Minutos estourados vs Setup Base).
              </p>
            </div>
          </div>

          {/* Pilar 4: Dica Prática */}
          <div className="flex gap-3 items-start border-t xl:border-t-0 xl:border-l border-slate-200 dark:border-gray-700 pt-4 xl:pt-0 xl:pl-6">
            <div className="p-2 bg-purple-50 dark:bg-purple-950/20 text-purple-600 rounded-lg shrink-0">
              <Lightbulb size={16} />
            </div>
            <div className="flex flex-col gap-1">
              <h4 className="text-[11px] font-black text-slate-800 dark:text-white uppercase tracking-wider">Dica Prática de Análise</h4>
              <p className="text-[11px] text-slate-500 dark:text-gray-400 font-medium leading-relaxed">
                Na tabela de Veículos Ofertados/Expedidos, cruze a alta volumetria do dia com a aba de <strong>Gargalos e CAP</strong> para identificar se o atraso ocorreu por estouro de capacidade. Além disso, confira sempre a aba de <strong>Logbook</strong> para entender a raiz do problema.
              </p>
            </div>
          </div>

        </div>
      </div>

      {/* 1. TOPO: KPIs Principais */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 print:grid-cols-4 print:gap-2">
        <div className="bg-white dark:bg-[#1f232d] p-6 rounded-2xl border border-slate-200 dark:border-gray-800 shadow-sm flex flex-col justify-center print:border-gray-300">
          <div className="flex items-center gap-2 mb-2"><Timer className="text-[#113366]" size={20}/><h4 className="text-xs font-black text-slate-500 uppercase tracking-widest">Tempo Médio Ops</h4></div>
          <span className="text-3xl font-black text-[#113366] dark:text-white">{kpis.tempoMedioTotalStr}</span>
          <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">Duração da Expedição</p>
        </div>

        <DelayKPICard title="Desvio Médio Inicial" mediaMin={kpis.mediaAtrasoInicioMin} icon={<Clock size={20} className="text-slate-400" />} />
        <DelayKPICard title="Desvio Médio Final" mediaMin={kpis.mediaAtrasoFimMin} icon={<Clock size={20} className="text-slate-400" />} />

        <div className="bg-white dark:bg-[#1f232d] p-6 rounded-2xl border border-slate-200 dark:border-gray-800 shadow-sm flex flex-col justify-center print:border-gray-300">
          <div className="flex justify-between items-start mb-2">
             <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest">Aderência Geral (Pontualidade)</h4>
          </div>
          <div className="flex flex-col gap-2 mt-2">
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-gray-700 pb-1">
              <span className="text-xs font-bold text-slate-400 flex items-center gap-1"><CheckCircle size={12}/> Início:</span>
              <span className="text-sm font-black text-[#113366] dark:text-white">{kpis.pctPontualInicio}%</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-slate-400 flex items-center gap-1"><AlertTriangle size={12}/> Final:</span>
              <span className="text-sm font-black text-[#EE4D2D] dark:text-white">{kpis.pctPontualFim}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. MEIO: Gráficos de Pontualidade (Pizza Interativa) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 print:grid-cols-2 print:gap-4">
        
        {/* Gráfico Pizza Início */}
        <div className="bg-white dark:bg-[#1f232d] p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-gray-800 flex flex-col print:break-inside-avoid print:border-gray-300">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-black text-sm text-slate-700 dark:text-gray-200 uppercase text-center w-full">Pontualidade (Início)</h3>
          </div>
          <p className="text-xs text-center text-slate-400 font-bold mb-2">💡 Clique na fatia de Atrasos para investigar</p>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie 
                  data={chartInicio} cx="50%" cy="50%" innerRadius={60} outerRadius={90} dataKey="value" stroke="none" 
                  label={{fontSize: 12, fontWeight: 'bold'}}
                  className="cursor-pointer"
                  onClick={(entry) => handlePizzaClick(entry, 'INÍCIO')}
                  isAnimationActive={isRendering} // 🔥 Trava do FPS
                >
                  {chartInicio.map((entry, index) => <Cell key={`cell-ini-${index}`} fill={entry.fill} className="hover:opacity-80 transition-opacity" />)}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', fontWeight: 'bold' }} />
                <Legend wrapperStyle={{fontSize: '12px', fontWeight: 'bold'}} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Gráfico Pizza Fim */}
        <div className="bg-white dark:bg-[#1f232d] p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-gray-800 flex flex-col print:break-inside-avoid print:border-gray-300">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-black text-sm text-slate-700 dark:text-gray-200 uppercase text-center w-full">Pontualidade (Término)</h3>
          </div>
          <p className="text-xs text-center text-slate-400 font-bold mb-2">💡 Clique na fatia de Atrasos para investigar</p>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie 
                  data={chartFim} cx="50%" cy="50%" innerRadius={60} outerRadius={90} dataKey="value" stroke="none" 
                  label={{fontSize: 12, fontWeight: 'bold'}}
                  className="cursor-pointer"
                  onClick={(entry) => handlePizzaClick(entry, 'FIM')}
                  isAnimationActive={isRendering} // 🔥 Trava do FPS
                >
                  {chartFim.map((entry, index) => <Cell key={`cell-fim-${index}`} fill={entry.fill} className="hover:opacity-80 transition-opacity" />)}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', fontWeight: 'bold' }} />
                <Legend wrapperStyle={{fontSize: '12px', fontWeight: 'bold'}} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>

      {/* 3. VEÍCULOS EXPEDIDOS (EXPANSÍVEL) */}
      <div className="bg-white dark:bg-[#1f232d] rounded-2xl shadow-sm border border-slate-200 dark:border-gray-800 flex flex-col print:break-inside-avoid overflow-hidden">
        <div className="p-6 border-b border-slate-100 dark:border-gray-800 bg-slate-50/50 dark:bg-[#15171e]">
          <h3 className="font-black text-lg text-[#113366] dark:text-white uppercase flex items-center gap-2">
            <Users size={20} className="text-[#EE4D2D]"/> Veículos Ofertados / Expedidos
          </h3>
          <p className="text-xs font-bold text-slate-400 mt-1">Volume bruto de operação no período filtrado (Agrupado por Regional / Hub)</p>
        </div>
        
        <div className="p-6">
          <table className="w-full text-sm whitespace-nowrap text-left">
             <thead className="bg-[#113366] text-white text-[10px] uppercase font-bold tracking-widest">
               <tr>
                 <th className="px-4 py-3 rounded-tl-lg">Regional / Station</th>
                 <th className="px-4 py-3 text-right rounded-tr-lg">Qtd. Veículos (Vol Bruto)</th>
               </tr>
             </thead>
             <tbody className="divide-y divide-slate-100 dark:divide-gray-800 font-bold">
               {chartFrotaOfertada.map(reg => (
                 <React.Fragment key={reg.id}>
                   <tr onClick={() => toggleExpandReg(reg.id)} className="cursor-pointer hover:bg-slate-50 dark:hover:bg-gray-800 transition-colors">
                     <td className="px-4 py-4 text-[#EE4D2D] flex items-center gap-2 text-base">
                       {expandedReg[reg.id] ? <ChevronDown size={16}/> : <ChevronRight size={16}/>} {reg.name}
                     </td>
                     <td className="px-4 py-4 text-right text-lg text-[#113366] dark:text-blue-400">
                       {new Intl.NumberFormat('pt-BR').format(reg.total)}
                     </td>
                   </tr>
                   {expandedReg[reg.id] && reg.hubs.map(hub => (
                     <tr key={hub.name} className="bg-slate-50/50 dark:bg-[#15171e] text-xs text-slate-600 dark:text-gray-400 hover:bg-slate-100 dark:hover:bg-gray-700 transition-colors">
                       <td className="px-4 py-2 pl-10 font-medium border-l-[3px] border-[#113366]">↳ {hub.name}</td>
                       <td className="px-4 py-2 text-right">{new Intl.NumberFormat('pt-BR').format(hub.value)}</td>
                     </tr>
                   ))}
                 </React.Fragment>
               ))}
             </tbody>
          </table>
        </div>
      </div>


      {/* 4. 🔥 TABELA DE ATRASOS CRÍTICOS 🔥 */}
      <div className="bg-white dark:bg-[#1f232d] rounded-2xl shadow-sm border border-slate-200 dark:border-gray-800 flex flex-col print:break-inside-avoid" style={{ maxHeight: '600px' }}>
        
        {/* BARRA VERMELHA */}
        <div className="bg-[#D0011B] p-4 flex items-center justify-between shrink-0 rounded-t-2xl z-20">
          <div className="flex items-center gap-2 text-white">
            <AlertCircle size={20} />
            <h3 className="font-black text-sm uppercase tracking-widest">Ocorrências de Atraso (&gt;15 min)</h3>
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
            <table className="w-full text-center text-sm whitespace-nowrap">
              
              {/* CABEÇALHO DAS COLUNAS FIXO */}
              <thead className="bg-slate-50 dark:bg-gray-800 text-slate-500 dark:text-gray-400 text-[10px] uppercase font-black tracking-widest border-b border-slate-200 dark:border-gray-700 sticky top-0 z-10 shadow-sm">
                <tr>
                  <th className="px-4 py-3 text-left">Hub (Station)</th>
                  <th className="px-4 py-3">Data</th>
                  <th className="px-4 py-3 bg-red-50/50 dark:bg-red-900/10">Setup Início</th>
                  <th className="px-4 py-3 bg-red-50/50 dark:bg-red-900/10">Real Início</th>
                  <th className="px-4 py-3 border-l border-slate-200 dark:border-gray-700">Setup Fim</th>
                  <th className="px-4 py-3">Real Fim</th>
                  <th className="px-4 py-3 text-[#113366] dark:text-blue-400">Tempo de Op.</th>
                </tr>
              </thead>

              {/* CORPO DA TABELA */}
              <tbody className="divide-y divide-slate-100 dark:divide-gray-800 font-bold">
                {listaAtrasos.map((item) => (
                  <tr key={item.originalIndex} className="hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors">
                    <td className="px-4 py-3 text-[#113366] dark:text-blue-400 text-left">{item.hub}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-gray-300 flex items-center justify-center gap-1.5"><CalendarDays size={14}/> {item.data}</td>
                    <td className="px-4 py-3 text-slate-400 bg-red-50/20 dark:bg-red-900/5">{item.setupInicio}</td>
                    <td className="px-4 py-3 text-[#EE4D2D] bg-red-50/20 dark:bg-red-900/5">{item.inicio}</td>
                    <td className="px-4 py-3 text-slate-400 border-l border-slate-100 dark:border-gray-800">{item.setupFim}</td>
                    <td className="px-4 py-3 text-[#EE4D2D]">{item.fim}</td>
                    <td className="px-4 py-3 text-[#113366] dark:text-white bg-slate-50/50 dark:bg-[#15171e]">{item.tempoOp}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ========================================================
          MODAL FLUTUANTE DA PIZZA (INVESTIGAÇÃO)
      ======================================================== */}
      {activePizzaDetails && (
        <div className="fixed inset-0 z-[99999] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#1f232d] w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col max-h-[80vh] overflow-hidden animate-in fade-in zoom-in duration-300">
            
            <div className="bg-[#D0011B] p-5 flex justify-between items-center shrink-0">
              <div className="text-white">
                <h2 className="text-xl font-black uppercase tracking-tight flex items-center gap-2">
                  <AlertCircle size={24} /> Investigação: Atrasos no {activePizzaDetails.tipo}
                </h2>
                <p className="text-xs font-bold opacity-80 mt-1">Detalhamento dos {activePizzaDetails.data.length} registros que estouraram o prazo.</p>
              </div>
              <button onClick={() => setActivePizzaDetails(null)} className="text-white hover:bg-white/20 p-2 rounded-full transition-colors"><X size={24}/></button>
            </div>

            <div className="overflow-auto custom-scrollbar flex-1 p-6">
               <table className="w-full text-center text-sm whitespace-nowrap">
                 <thead className="text-[10px] uppercase font-black text-slate-400 border-b border-slate-200 dark:border-gray-700">
                   <tr>
                     <th className="pb-3 text-left">Hub</th>
                     <th className="pb-3">Data</th>
                     <th className="pb-3 text-slate-300">Planejado</th>
                     <th className="pb-3 text-[#EE4D2D]">Realizado</th>
                     <th className="pb-3 text-[#D0011B]">Minutos Estourados</th>
                   </tr>
                 </thead>
                 <tbody className="divide-y divide-slate-100 dark:divide-gray-800 font-bold text-slate-600 dark:text-gray-300">
                   {activePizzaDetails.data.sort((a,b) => b.difMin - a.difMin).map((d, i) => (
                     <tr key={i} className="hover:bg-slate-50 dark:hover:bg-gray-800 transition-colors">
                       <td className="py-3 text-left text-[#113366] dark:text-blue-400">{d.hub}</td>
                       <td className="py-3">{d.data}</td>
                       <td className="py-3 text-slate-400">{d.setup}</td>
                       <td className="py-3 text-[#EE4D2D]">{d.real}</td>
                       <td className="py-3 text-[#D0011B]">+{d.difMin} min</td>
                     </tr>
                   ))}
                 </tbody>
               </table>
            </div>

          </div>
        </div>
      )}

    </div>
  );}