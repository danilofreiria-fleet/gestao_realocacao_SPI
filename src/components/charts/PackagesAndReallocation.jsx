import React, { useState, useMemo } from 'react';
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, LabelList, Area, AreaChart } from 'recharts';
import { Package, RefreshCw, Percent, TrendingUp, Maximize2, Minimize2, AlertCircle, MessageSquare, MapPin, Calendar, Clock,Database, BookOpen, Calculator } from 'lucide-react';

const TRADUZ_MES = { '01':'JAN', '02':'FEV', '03':'MAR', '04':'ABR', '05':'MAI', '06':'JUN', '07':'JUL', '08':'AGO', '09':'SET', '10':'OUT', '11':'NOV', '12':'DEZ' };

export default function PackagesAndReallocation({ rawData, filtrosGlobais = {} }) {
  const [periodo, setPeriodo] = useState('semana');
  const [fullscreenChart, setFullscreenChart] = useState(null);

  const { regional = [], station = [], turno = [], semana = "", mes = "", dataInicio = "", dataFim = "" } = filtrosGlobais;

  const parseNum = (val) => {
    if (val === undefined || val === null || val === '') return 0;
    let s = String(val).trim().replace(/%/g, '');
    if (s.includes(',')) return Number(s.replace(/\./g, '').replace(',', '.'));
    return Number(s) || 0;
  };

  const fInt = (val) => new Intl.NumberFormat('pt-BR').format(Math.round(val));
  const fPct = (val) => `${Number(val).toFixed(1).replace('.', ',')}%`;

  const chartData = useMemo(() => {
    const aggs = {};

    (rawData || []).forEach(row => {
      if (regional.length > 0 && !regional.includes(row[1])) return;
      if (station.length > 0 && !station.includes(row[4])) return;
      if (turno.length > 0 && !turno.includes(row[5])) return;

      const semRow = String(row[2] || "");
      const dataStr = String(row[3] || "");
      
      let dataPeso = "";
      if (dataStr.includes('-')) {
        dataPeso = dataStr.split('T')[0]; 
      } else if (dataStr.includes('/')) {
        const parts = dataStr.split(' ')[0].split('/');
        dataPeso = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
      }

      let mesRow = dataPeso ? dataPeso.split('-')[1] : "";

      if (semana && semRow !== semana) return;
      if (mes && mesRow !== mes) return;
      if (dataInicio && dataPeso < dataInicio) return;
      if (dataFim && dataPeso > dataFim) return;

      let chave = semRow;
      let sortWeight = semRow;

      if (periodo === 'mes') {
        chave = TRADUZ_MES[mesRow] || mesRow;
        sortWeight = dataPeso ? dataPeso.substring(0, 7) : mesRow; 
      }
      if (periodo === 'dia') {
        const parts = dataPeso.split('-');
        chave = parts.length === 3 ? `${parts[2]}/${parts[1]}` : dataPeso;
        sortWeight = dataPeso; 
      }

      if (!chave) return;

      if (!aggs[chave]) {
        aggs[chave] = { 
          name: chave, sortDate: dataPeso || sortWeight, 
          realocPre: 0, realocDur: 0, realocTotal: 0,
          naoExpCoube: 0, naoExpOutros: 0, naoExpTotal: 0,
          ofertaCap: 0, carregadoCap: 0,
          taxaCorrecao: 0, desvioFleet: 0, desvioHub: 0,
          eficiencia: 0, count: 0
        };
      } else {
        if (dataPeso && dataPeso < aggs[chave].sortDate) aggs[chave].sortDate = dataPeso;
      }

      const d = aggs[chave];
      d.realocPre += parseNum(row[51]); 
      d.realocDur += parseNum(row[52]); 
      d.realocTotal += parseNum(row[53]); 
      d.naoExpCoube += parseNum(row[54]); 
      d.naoExpOutros += parseNum(row[55]); 
      d.naoExpTotal += (parseNum(row[54]) + parseNum(row[55]));
      
      d.ofertaCap += (parseNum(row[20]) + parseNum(row[23])); 
      d.carregadoCap += (parseNum(row[25]) + parseNum(row[28]));

      d.taxaCorrecao += parseNum(row[56]); 
      d.desvioFleet += parseNum(row[57]); 
      d.desvioHub += parseNum(row[58]); 
      d.eficiencia += parseNum(row[59]); 
      d.count++;
    });

    const result = Object.values(aggs).sort((a, b) => a.sortDate.localeCompare(b.sortDate));

    let prevRealoc = null;
    let prevNaoExp = null;

    return result.map(d => {
      d.taxaCorrecao = d.count > 0 ? d.taxaCorrecao / d.count : 0;
      d.desvioFleet = d.count > 0 ? d.desvioFleet / d.count : 0;
      d.desvioHub = d.count > 0 ? d.desvioHub / d.count : 0;
      d.eficiencia = d.count > 0 ? d.eficiencia / d.count : 0;
      
      d.varRealoc = (prevRealoc !== null && prevRealoc > 0) ? Number((((d.realocTotal - prevRealoc) / prevRealoc) * 100).toFixed(1)) : 0;
      prevRealoc = d.realocTotal;

      d.varNaoExp = (prevNaoExp !== null && prevNaoExp > 0) ? Number((((d.naoExpTotal - prevNaoExp) / prevNaoExp) * 100).toFixed(1)) : 0;
      prevNaoExp = d.naoExpTotal;

      d.vagasOciosas = Math.max(0, d.ofertaCap - d.carregadoCap);
      return d;
    });
  }, [rawData, periodo, regional, station, turno, semana, mes, dataInicio, dataFim]);

  const feedJustificativas = useMemo(() => {
    if (!rawData) return [];

    let filtrados = rawData.filter(row => {
      const texto = String(row[42] || "").trim(); 
      if (texto.length < 5 || texto.toLowerCase() === "ok" || texto.toLowerCase() === "na" || texto.toLowerCase().includes("sem justificativa")) return false;

      if (regional.length > 0 && !regional.includes(row[1])) return false;
      if (station.length > 0 && !station.includes(row[4])) return false;
      if (turno.length > 0 && !turno.includes(row[5])) return false;
      if (semana && row[2] !== semana) return false;
      
      const dataStr = String(row[3] || "");
      let dataPeso = "";
      if (dataStr.includes('-')) dataPeso = dataStr.split('T')[0];
      else if (dataStr.includes('/')) {
        const parts = dataStr.split(' ')[0].split('/');
        dataPeso = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
      }

      let mesRow = dataPeso ? dataPeso.split('-')[1] : "";

      if (mes && mesRow !== mes) return false;
      if (dataInicio && dataPeso < dataInicio) return false;
      if (dataFim && dataPeso > dataFim) return false;

      return true;
    });

    return filtrados.map((row, idx) => ({
      id: idx,
      dataStr: String(row[3]).split('T')[0].split(' ')[0],
      semana: row[2],
      station: String(row[4]).replace('LM Hub_SP_', ''),
      turno: row[5],
      texto: String(row[42]).trim()
    })).reverse().slice(0, 50); 
  }, [rawData, regional, station, turno, semana, mes, dataInicio, dataFim]);

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white dark:bg-[#1f232d] border border-slate-200 dark:border-gray-800 p-3 rounded-lg shadow-xl z-50">
          <p className="font-black text-[#113366] dark:text-white mb-2 pb-2 border-b border-slate-100 dark:border-gray-800">{label}</p>
          {payload.map((entry, index) => {
            const isPct = entry.name.includes('%') || entry.name.includes('Taxa') || entry.name.includes('Eficiência');
            return (
              <p key={index} style={{ color: entry.color }} className="font-bold text-[11px] py-0.5 flex justify-between gap-4">
                <span>{entry.name}:</span>
                <span>{isPct ? fPct(entry.value) : fInt(entry.value)}</span>
              </p>
            );
          })}
        </div>
      );
    }
    return null;
  };

  const renderChartCard = (id, title, subtitle, icon, content) => {
    const isFullscreen = fullscreenChart === id;
    const minChartWidth = chartData.length > 12 ? `${chartData.length * 60}px` : '100%';

    return (
      <div className={`bg-white dark:bg-[#1f232d] rounded-2xl border border-slate-200 dark:border-gray-800 shadow-sm flex flex-col transition-all ${isFullscreen ? 'fixed inset-4 z-[9999] p-8' : 'p-6 h-[420px]'}`}>
        <div className="flex justify-between items-start mb-6 border-b border-slate-100 dark:border-gray-800 pb-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-slate-50 dark:bg-gray-800 rounded-lg text-[#EE4D2D]">{icon}</div>
            <div>
              <h3 className="font-black text-[#113366] dark:text-white uppercase text-lg leading-tight">{title}</h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">{subtitle}</p>
            </div>
          </div>
          <button onClick={() => setFullscreenChart(isFullscreen ? null : id)} className="text-slate-400 hover:text-[#EE4D2D] p-1 bg-slate-50 dark:bg-gray-800 rounded">
            {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
          </button>
        </div>
        <div className="flex-1 w-full overflow-hidden">
          <div className="w-full h-full overflow-x-auto overflow-y-hidden custom-scrollbar pb-2">
            <div style={{ minWidth: minChartWidth, height: '100%' }}>
              {content}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const showLabels = chartData.length <= 15;
return (
    <div className="space-y-6 mt-6 pb-12">
      
      {/* HEADER DE COMANDOS */}
      <div className="flex justify-end">
        <div className="flex bg-slate-100 dark:bg-[#15171e] p-1 rounded-xl border border-slate-200 dark:border-gray-700">
          {['dia', 'semana', 'mes'].map((p) => (
            <button key={p} onClick={() => setPeriodo(p)} className={`px-6 py-1.5 rounded-lg text-xs font-black uppercase transition-all ${periodo === p ? 'bg-[#113366] text-white shadow-lg' : 'text-slate-500 hover:text-[#113366]'}`}>
              {p === 'dia' ? 'Dia' : p === 'semana' ? 'Sem' : 'Mês'}
            </button>
          ))}
        </div>
      </div>

      {/* 🔥 BANNER DE STORYTELLING PARA A GESTÃO */}
      <div className="bg-white dark:bg-[#1f232d] p-5 md:p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-gray-800 shrink-0">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 bg-slate-50 dark:bg-[#15171e] p-5 rounded-xl border border-slate-200 dark:border-gray-700">
          
          {/* Pilar 1: Origem e Orientação */}
          <div className="flex gap-3 items-start">
            <div className="p-2 bg-blue-50 dark:bg-blue-950/30 text-[#113366] dark:text-blue-400 rounded-lg shrink-0">
              <Database size={16} />
            </div>
            <div className="flex flex-col gap-1">
              <h4 className="text-[11px] font-black text-slate-800 dark:text-white uppercase tracking-wider">Origem dos Dados</h4>
              <p className="text-[11px] text-slate-500 dark:text-gray-400 font-medium leading-relaxed">
                Dados preenchidos <strong>totalmente pelos analistas (D-0)</strong>. O Logbook reflete o que foi digitado no campo "Justificativa".
              </p>
            </div>
          </div>

          {/* Pilar 2: Dica Prática de Gestão */}
          <div className="flex gap-3 items-start border-t lg:border-t-0 lg:border-l border-slate-200 dark:border-gray-700 pt-4 lg:pt-0 lg:pl-6">
            <div className="p-2 bg-orange-50 dark:bg-orange-950/20 text-[#EE4D2D] rounded-lg shrink-0">
              <BookOpen size={16} />
            </div>
            <div className="flex flex-col gap-1">
              <h4 className="text-[11px] font-black text-slate-800 dark:text-white uppercase tracking-wider">Boas Práticas</h4>
              <p className="text-[11px] text-slate-500 dark:text-gray-400 font-medium leading-relaxed">
                É recomendável manter uma planilha interna de controle para separar, por exemplo, o que foi <em>"Volumoso retido por falta de espaço"</em> do que foi <em>"Retido por erro operacional"</em>, não dependendo exclusivamente do Inventário. O gráfico <strong>Divergência de Capacidade</strong> já ajuda nisso cruzando pacotes retidos vs Vans/Utilitários dispensados sem carga.
              </p>
            </div>
          </div>

          {/* Pilar 3: Fórmulas de Qualidade */}
          <div className="flex gap-3 items-start border-t lg:border-t-0 lg:border-l border-slate-200 dark:border-gray-700 pt-4 lg:pt-0 lg:pl-6">
            <div className="p-2 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 rounded-lg shrink-0">
              <Calculator size={16} />
            </div>
            <div className="flex flex-col gap-1">
              <h4 className="text-[11px] font-black text-slate-800 dark:text-white uppercase tracking-wider">Fórmulas (KPIs)</h4>
              <div className="flex flex-col gap-1 mt-1 text-[11px] font-medium text-slate-500 dark:text-gray-400 leading-relaxed">
                <p><strong className="text-slate-700 dark:text-gray-300">Desv. Fleet:</strong> Volumosos Não Exp. ÷ Vol. Processado</p>
                <p><strong className="text-slate-700 dark:text-gray-300">Desv. Hub:</strong> Pacotes Não Exp. ÷ Vol. Processado</p>
                <p><strong className="text-slate-700 dark:text-gray-300">Taxa Corr:</strong> Total de Realocações ÷ Vol. Processado</p>
                <p><strong className="text-slate-700 dark:text-gray-300">Eficiência:</strong> (Vol. Expedido ÷ Vol. Proc.) × 100</p>
              </div>
            </div>
          </div>

        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        
        {renderChartCard('realoc', 'Análise de Realocação', 'Volume Pré vs Durante Expedição', <RefreshCw />, (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 20 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="name" tick={{fontSize: 10, fontWeight: 'bold'}} axisLine={false} />
              <YAxis yAxisId="left" tick={{fontSize: 10}} axisLine={false} />
              <YAxis yAxisId="right" orientation="right" tick={{fontSize: 10, fill: '#D0011B'}} axisLine={false} tickFormatter={(v) => `${v}%`} />
              <Tooltip content={<CustomTooltip />} cursor={{fill: 'rgba(0,0,0,0.05)'}} />
              <Legend wrapperStyle={{ fontSize: '11px', fontWeight: 'bold' }} />
              
              <Bar yAxisId="left" dataKey="realocPre" name="Realoc. Pré" fill="#113366" stackId="a" barSize={35} isAnimationActive={true}>
                 {showLabels && <LabelList dataKey="realocPre" position="center" fill="#fff" fontSize={10} fontWeight="bold" formatter={fInt} />}
              </Bar>
              <Bar yAxisId="left" dataKey="realocDur" name="Realoc. Durante" fill="#EE4D2D" stackId="a" barSize={35} radius={[4, 4, 0, 0]} isAnimationActive={true}>
                 {showLabels && <LabelList dataKey="realocDur" position="center" fill="#fff" fontSize={10} fontWeight="bold" formatter={fInt} />}
              </Bar>
              <Line yAxisId="right" type="monotone" dataKey="varRealoc" name="% Variação (vs Ant.)" stroke="#D0011B" strokeWidth={3} dot={{ r: 4, fill: '#fff', stroke: '#D0011B', strokeWidth: 2 }} isAnimationActive={true} />
            </ComposedChart>
          </ResponsiveContainer>
        ))}

        {renderChartCard('naoexp', 'Pacotes Não Expedidos', 'Não Coube vs Outros Motivos', <Package />, (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 20 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="name" tick={{fontSize: 10, fontWeight: 'bold'}} axisLine={false} />
              <YAxis yAxisId="left" tick={{fontSize: 10}} axisLine={false} />
              <YAxis yAxisId="right" orientation="right" tick={{fontSize: 10, fill: '#D0011B'}} axisLine={false} tickFormatter={(v) => `${v}%`} />
              <Tooltip content={<CustomTooltip />} cursor={{fill: 'rgba(0,0,0,0.05)'}} />
              <Legend wrapperStyle={{ fontSize: '11px', fontWeight: 'bold' }} />
              
              <Bar yAxisId="left" dataKey="naoExpCoube" name="Não Coube" fill="#D0011B" barSize={35} stackId="a" isAnimationActive={true}>
                {showLabels && <LabelList dataKey="naoExpCoube" position="center" fill="#fff" fontSize={10} fontWeight="bold" formatter={fInt} />}
              </Bar>
              <Bar yAxisId="left" dataKey="naoExpOutros" name="Outros Motivos" fill="#113366" barSize={35} stackId="a" radius={[4, 4, 0, 0]} isAnimationActive={true}>
                {showLabels && <LabelList dataKey="naoExpOutros" position="center" fill="#fff" fontSize={10} fontWeight="bold" formatter={fInt} />}
              </Bar>
              <Line yAxisId="right" type="monotone" dataKey="varNaoExp" name="% Variação (vs Ant.)" stroke="#EE4D2D" strokeWidth={3} dot={{ r: 4, fill: '#fff', stroke: '#EE4D2D', strokeWidth: 2 }} isAnimationActive={true} />
            </ComposedChart>
          </ResponsiveContainer>
        ))}

        {renderChartCard('gap', 'Divergência de Capacidade', 'Não Coube vs Veículos Ociosos (Util/Van)', <AlertCircle />, (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 20 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="name" tick={{fontSize: 10, fontWeight: 'bold'}} />
              <YAxis tick={{fontSize: 10}} />
              <Tooltip content={<CustomTooltip />} cursor={{fill: 'rgba(0,0,0,0.05)'}} />
              <Legend wrapperStyle={{ fontSize: '11px', fontWeight: 'bold' }} />
              
              <Area type="monotone" dataKey="vagasOciosas" name="Veículos Ociosos (Sobrou Carro)" fill="#113366" stroke="#113366" fillOpacity={0.1} strokeWidth={2} isAnimationActive={true}>
                 {showLabels && <LabelList dataKey="vagasOciosas" position="top" fill="#113366" fontSize={10} fontWeight="bold" formatter={fInt} />}
              </Area>
              <Bar dataKey="naoExpCoube" name="Pacotes que Não Couberam" fill="#D0011B" barSize={40} radius={[4, 4, 0, 0]} isAnimationActive={true}>
                {showLabels && <LabelList dataKey="naoExpCoube" position="top" fill="#D0011B" fontSize={10} fontWeight="bold" formatter={fInt} />}
              </Bar>
            </ComposedChart>
          </ResponsiveContainer>
        ))}

        {renderChartCard('desvios', 'Qualidade Operacional', 'Taxa de Correção vs Desvios de Piso', <Percent />, (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 20 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="name" tick={{fontSize: 10, fontWeight: 'bold'}} />
              <YAxis yAxisId="left" tick={{fontSize: 10}} tickFormatter={(v) => `${v}%`} />
              <YAxis yAxisId="right" orientation="right" tick={{fontSize: 10, fill: '#113366'}} tickFormatter={(v) => `${v}%`} />
              <Tooltip content={<CustomTooltip />} cursor={{fill: 'rgba(0,0,0,0.05)'}} />
              <Legend wrapperStyle={{ fontSize: '11px', fontWeight: 'bold' }} />
              
              <Bar yAxisId="right" dataKey="desvioFleet" name="Desvio Piso Fleet" fill="#113366" barSize={25} radius={[2, 2, 0, 0]} isAnimationActive={true}>
                {showLabels && <LabelList dataKey="desvioFleet" position="top" fill="#113366" fontSize={10} fontWeight="bold" formatter={fPct} />}
              </Bar>
              <Bar yAxisId="right" dataKey="desvioHub" name="Desvio Piso HUB" fill="#EE4D2D" barSize={25} radius={[2, 2, 0, 0]} isAnimationActive={true}>
                {showLabels && <LabelList dataKey="desvioHub" position="top" fill="#EE4D2D" fontSize={10} fontWeight="bold" formatter={fPct} />}
              </Bar>
              <Line yAxisId="left" type="monotone" dataKey="taxaCorrecao" name="Taxa Correção Fleet" stroke="#D0011B" strokeWidth={4} dot={{ r: 4, fill: '#fff', stroke: '#D0011B', strokeWidth: 2 }} isAnimationActive={true}>
                {showLabels && <LabelList dataKey="taxaCorrecao" position="top" fill="#D0011B" fontSize={10} fontWeight="bold" formatter={fPct} />}
              </Line>
            </ComposedChart>
          </ResponsiveContainer>
        ))}

        <div className="xl:col-span-2">
          {renderChartCard('eficiencia', 'Eficiência de Expedição', 'Performance Geral do Fluxo de Saída', <TrendingUp />, (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 20, right: 20, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorEficiencia" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#113366" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#113366" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{fontSize: 10, fontWeight: 'bold'}} />
                <YAxis domain={['auto', 'auto']} tick={{fontSize: 10}} tickFormatter={(v) => `${v}%`} />
                <Tooltip content={<CustomTooltip />} cursor={{fill: 'rgba(0,0,0,0.05)'}} />
                <Area type="monotone" dataKey="eficiencia" name="Eficiência de Expedição" stroke="#113366" strokeWidth={4} fill="url(#colorEficiencia)" connectNulls isAnimationActive={true}>
                  {showLabels && <LabelList dataKey="eficiencia" position="top" fill="#113366" fontSize={11} fontWeight="900" formatter={fPct} />}
                </Area>
              </AreaChart>
            </ResponsiveContainer>
          ))}
        </div>

        <div className="xl:col-span-2 bg-white dark:bg-[#1f232d] rounded-2xl border border-slate-200 dark:border-gray-800 shadow-sm flex flex-col h-[500px]">
          <div className="flex items-center gap-3 p-6 border-b border-slate-100 dark:border-gray-800 shrink-0 bg-slate-50 dark:bg-gray-800 rounded-t-2xl">
            <div className="p-2 bg-[#113366] rounded-lg text-white"><MessageSquare size={24} /></div>
            <div>
              <h3 className="font-black text-[#113366] dark:text-white uppercase text-lg leading-tight">Logbook de Desvios (Pacotes)</h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Últimas justificativas operacionais de pacotes não expedidos</p>
            </div>
            <div className="ml-auto bg-[#EE4D2D] text-white text-xs font-black px-3 py-1 rounded-full">
              Exibindo max 50
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto custom-scrollbar p-6 bg-slate-50/30 dark:bg-[#15171e]">
            {feedJustificativas.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-400 opacity-70">
                <MessageSquare size={48} className="mb-4 text-slate-300" />
                <p className="font-black text-lg text-slate-500">Nenhuma justificativa registrada.</p>
                <p className="text-xs font-bold mt-1">Filtros atuais não possuem desvios com comentários detalhados.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {feedJustificativas.map(item => (
                  <div key={item.id} className="bg-white dark:bg-[#1f232d] border border-slate-200 dark:border-gray-700 p-4 rounded-xl shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
                    <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-[#D0011B]"></div>
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center gap-1.5 pl-2">
                        <MapPin size={14} className="text-[#113366]" />
                        <h4 className="font-black text-[#113366] dark:text-white text-sm uppercase">{item.station}</h4>
                      </div>
                      <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">{item.turno}</span>
                    </div>
                    <div className="flex items-center gap-3 text-[10px] font-bold text-slate-500 mb-3 pb-2 border-b border-slate-100 dark:border-gray-800 pl-2">
                      <span className="flex items-center gap-1"><Calendar size={12} /> {item.dataStr}</span>
                      <span className="flex items-center gap-1"><Clock size={12} /> {item.semana}</span>
                    </div>
                    <div className="text-xs text-slate-700 dark:text-gray-300 font-medium whitespace-pre-wrap pl-2 leading-relaxed">
                      {item.texto}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );}