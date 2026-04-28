import React, { useState, useMemo, useRef, useEffect } from 'react';
import { BarChart, Bar, Line, ComposedChart, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, LabelList } from 'recharts';
import { Activity, UserMinus, UserCheck, AlertTriangle, Truck, TrendingUp, Maximize2, Minimize2, X, Info, Filter, ChevronDown, CalendarDays, Calendar } from 'lucide-react';

const TRADUZ_MES = { '01':'JAN', '02':'FEV', '03':'MAR', '04':'ABR', '05':'MAI', '06':'JUN', '07':'JUL', '08':'AGO', '09':'SET', '10':'OUT', '11':'NOV', '12':'DEZ' };
const MODAL_OPTIONS = ['Passeio', 'Utilitário', 'Moto', 'Van'];

export default function FleetHealthCharts({ rawData, baseData, filtrosGlobais = {} }) {
  const [periodo, setPeriodo] = useState('semana');
  const [fullscreenChart, setFullscreenChart] = useState(null); 

  // 🔥 ESTADOS PARA OS NOVOS FILTROS DE MODAIS
  const [modaisEvol, setModaisEvol] = useState(MODAL_OPTIONS);
  const [modaisConv, setModaisConv] = useState(MODAL_OPTIONS);
  
  const [isEvolMenuOpen, setIsEvolMenuOpen] = useState(false);
  const [isConvMenuOpen, setIsConvMenuOpen] = useState(false);
  
  const evolMenuRef = useRef(null);
  const convMenuRef = useRef(null);

  const { regional = [], station = [], turno = [], semana = "", mes = "" } = filtrosGlobais;

  useEffect(() => {
    function handleClickOutside(event) {
      if (evolMenuRef.current && !evolMenuRef.current.contains(event.target)) setIsEvolMenuOpen(false);
      if (convMenuRef.current && !convMenuRef.current.contains(event.target)) setIsConvMenuOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const toggleModal = (modal, stateSetter) => {
    stateSetter(prev => prev.includes(modal) ? prev.filter(m => m !== modal) : [...prev, modal]);
  };

  const parseNum = (val) => {
    let s = String(val || '0').trim();
    if (s.includes(',')) return Number(s.replace(/\./g, '').replace(',', '.'));
    return Number(s) || 0;
  };

  // =========================================================
  // 1. KPIs GERAIS
  // =========================================================
  const kpis = useMemo(() => {
    let ativos = 0, churn = 0, dormentes = 0;
    let ofertasTotais = 0, recusasTotais = 0;

    (baseData || []).slice(1).forEach(row => {
      const hub = String(row[0] || "");
      if (station.length > 0 && !station.includes(hub)) return;
      ativos += parseNum(row[9]); churn += parseNum(row[10]); dormentes += parseNum(row[11]);
    });

    (rawData || []).forEach(row => {
      if (regional.length > 0 && !regional.includes(row[1])) return;
      if (station.length > 0 && !station.includes(row[4])) return;
      if (turno.length > 0 && !turno.includes(row[5])) return;
      if (semana && row[2] !== semana) return;
      if (mes) {
         const dataRow = String(row[3] || "");
         let mesRow = dataRow.includes('-') ? dataRow.split('T')[0].split('-')[1] : (dataRow.includes('/') ? dataRow.split(' ')[0].split('/')[1] : "");
         if (mesRow !== mes) return;
      }
      ofertasTotais += parseNum(row[24]); 
      recusasTotais += parseNum(row[35]); 
    });

    return {
      ativos, churn, dormentes,
      churnPct: ativos > 0 ? (churn / ativos) * 100 : 0,
      dormPct: ativos > 0 ? (dormentes / ativos) * 100 : 0,
      ofertas: ofertasTotais, recusas: recusasTotais,
      recusaPct: ofertasTotais > 0 ? (recusasTotais / ofertasTotais) * 100 : 0
    };
  }, [baseData, rawData, regional, station, turno, semana, mes]);

  // =========================================================
  // 2. MOTOR TEMPORAL ÚNICO (Evolução + Conversão)
  // =========================================================
  const temporalData = useMemo(() => {
    const aggs = {};

    (rawData || []).forEach(row => {
      if (regional.length > 0 && !regional.includes(row[1])) return;
      if (station.length > 0 && !station.includes(row[4])) return;
      if (turno.length > 0 && !turno.includes(row[5])) return;

      const semRow = String(row[2] || "");
      const dataStr = String(row[3] || "");
      let mesRow = "";
      if (dataStr.includes('-')) mesRow = dataStr.split('T')[0].split('-')[1]; 
      else if (dataStr.includes('/')) mesRow = dataStr.split(' ')[0].split('/')[1];

      let chavePeriodo = semRow;
      if (periodo === 'mes') chavePeriodo = TRADUZ_MES[mesRow] || mesRow;
      if (periodo === 'dia') {
        const parts = dataStr.split('T')[0].split('-'); 
        chavePeriodo = parts.length === 3 ? `${parts[2]}/${parts[1]}` : dataStr.split(' ')[0];
      }

      if (!chavePeriodo) return;
      if (periodo === 'semana' && semana && semRow !== semana) return;
      if (periodo === 'mes' && mes && mesRow !== mes) return;

      if (!aggs[chavePeriodo]) {
        aggs[chavePeriodo] = { 
          name: chavePeriodo, rawDate: dataStr, 
          totalOfertasGlobais: 0, totalRecusasGlobais: 0,
          p_off: 0, u_off: 0, m_off: 0, v_off: 0,
          p_acc: 0, u_acc: 0, m_acc: 0, v_acc: 0
        };
      }

      aggs[chavePeriodo].totalOfertasGlobais += parseNum(row[24]); 
      aggs[chavePeriodo].totalRecusasGlobais += parseNum(row[35]); 

      aggs[chavePeriodo].u_off += parseNum(row[20]); 
      aggs[chavePeriodo].p_off += parseNum(row[21]); 
      aggs[chavePeriodo].m_off += parseNum(row[22]); 
      aggs[chavePeriodo].v_off += parseNum(row[23]); 

      aggs[chavePeriodo].u_acc += parseNum(row[25]); 
      aggs[chavePeriodo].p_acc += parseNum(row[26]); 
      aggs[chavePeriodo].m_acc += parseNum(row[27]); 
      aggs[chavePeriodo].v_acc += parseNum(row[28]); 
    });

    return Object.values(aggs)
      .map(d => ({
        ...d,
        recusaPctGeral: d.totalOfertasGlobais > 0 ? (d.totalRecusasGlobais / d.totalOfertasGlobais) * 100 : 0
      }))
      .sort((a, b) => {
        if (periodo === 'dia') return a.rawDate.localeCompare(b.rawDate);
        return a.name.localeCompare(b.name);
      });
  }, [rawData, periodo, regional, station, turno, semana, mes]);

  // =========================================================
  // 3. DERIVAÇÃO: DADOS DE CONVERSÃO (OFERTAS vs ACEITES)
  // =========================================================
  const chartConversaoData = useMemo(() => {
    return temporalData.map(d => {
      const ofertasSel = 
        (modaisConv.includes('Passeio') ? d.p_off : 0) +
        (modaisConv.includes('Utilitário') ? d.u_off : 0) +
        (modaisConv.includes('Moto') ? d.m_off : 0) +
        (modaisConv.includes('Van') ? d.v_off : 0);
      
      const accSel = 
        (modaisConv.includes('Passeio') ? d.p_acc : 0) +
        (modaisConv.includes('Utilitário') ? d.u_acc : 0) +
        (modaisConv.includes('Moto') ? d.m_acc : 0) +
        (modaisConv.includes('Van') ? d.v_acc : 0);

      return {
        ...d,
        ofertasSel,
        accSel,
        convPct: ofertasSel > 0 ? (accSel / ofertasSel) * 100 : 0
      };
    });
  }, [temporalData, modaisConv]);


  const fInt = (val) => val > 0 ? new Intl.NumberFormat('pt-BR').format(Math.round(val)) : '';
  const fIntTooltip = (val) => new Intl.NumberFormat('pt-BR').format(Math.round(val));

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white dark:bg-[#1f232d] border border-slate-200 dark:border-gray-800 p-3 rounded-lg shadow-xl z-50">
          <p className="font-black text-slate-800 dark:text-white mb-2">{label}</p>
          {payload.map((entry, index) => (
            <p key={index} style={{ color: entry.color }} className="font-bold text-sm py-0.5">
              {entry.name}: {entry.name.includes('%') ? `${entry.value.toFixed(1)}%` : fIntTooltip(entry.value)}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  // 🔥 COMPONENTE WRAPPER COM SCROLL HORIZONTAL
  const renderChartCard = (id, title, subtitle, icon, extraControls, content, dataLength) => {
    const isFullscreen = fullscreenChart === id;
    
    // Calcula a largura mínima baseada na quantidade de pontos (Mínimo de 60px por barra/ponto)
    const minW = dataLength > 15 ? `${dataLength * 60}px` : '100%';

    const cardContent = (
      <div className={`bg-white dark:bg-[#1f232d] rounded-2xl shadow-sm border border-slate-200 dark:border-gray-800 flex flex-col relative transition-all ${isFullscreen ? 'w-full h-full p-8' : 'h-[500px] p-6'}`}>
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 border-b border-slate-100 dark:border-gray-800 pb-4 shrink-0 gap-4">
          <div>
            <h3 className={`font-black uppercase flex items-center gap-2 ${isFullscreen ? 'text-2xl' : 'text-xl'} text-[#113366] dark:text-white`}>
              {icon} {title}
            </h3>
            <p className="text-xs text-slate-500 font-bold uppercase mt-1 flex items-center gap-1">
              <Info size={12}/> {subtitle}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {extraControls}
            <button onClick={() => setFullscreenChart(isFullscreen ? null : id)} className="text-slate-400 hover:text-[#EE4D2D] bg-slate-50 hover:bg-orange-50 dark:bg-gray-800 p-2 rounded-lg transition-colors">
              {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
            </button>
          </div>
        </div>
        
        {/* 🔥 A MÁGICA DO SCROLL AQUI */}
        <div className="flex-1 w-full overflow-hidden">
          <div className="w-full h-full overflow-x-auto overflow-y-hidden custom-scrollbar pb-2">
            <div style={{ minWidth: minW, height: '100%' }}>
              {content}
            </div>
          </div>
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

  // Ajuda a arredondar os cantos do Gráfico de Recusas
  const topVisibleModal = [...MODAL_OPTIONS].reverse().find(s => modaisEvol.includes(s));

  return (
    <div className="space-y-6 mt-6">
      
      {/* 4 CARDS DE KPI (TOP) */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-[#1f232d] p-6 rounded-2xl border border-slate-200 dark:border-gray-800 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-16 h-16 bg-orange-100 dark:bg-orange-900/20 rounded-bl-full -mr-8 -mt-8 transition-transform group-hover:scale-110"></div>
          <div className="flex justify-between items-start mb-2 relative z-10">
            <span className="text-xs font-black uppercase text-slate-400">Taxa de Recusa</span>
            <AlertTriangle size={20} className="text-orange-500" />
          </div>
          <div className="text-3xl font-black text-[#113366] dark:text-white relative z-10">{kpis.recusaPct.toFixed(1)}%</div>
          <div className="text-[10px] font-bold text-slate-500 uppercase mt-1 relative z-10">{fIntTooltip(kpis.recusas)} recusas brutas</div>
        </div>

        <div className="bg-white dark:bg-[#1f232d] p-6 rounded-2xl border border-slate-200 dark:border-gray-800 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-bl-full -mr-8 -mt-8 transition-transform group-hover:scale-110"></div>
          <div className="flex justify-between items-start mb-2 relative z-10">
            <span className="text-xs font-black uppercase text-slate-400">Risco de Churn</span>
            <UserMinus size={20} className="text-red-500" />
          </div>
          <div className="text-3xl font-black text-[#113366] dark:text-white relative z-10">{kpis.churnPct.toFixed(1)}%</div>
          <div className="text-[10px] font-bold text-slate-500 uppercase mt-1 relative z-10">{fIntTooltip(kpis.churn)} motoristas saindo</div>
        </div>

        <div className="bg-white dark:bg-[#1f232d] p-6 rounded-2xl border border-slate-200 dark:border-gray-800 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-16 h-16 bg-yellow-100 dark:bg-yellow-900/20 rounded-bl-full -mr-8 -mt-8 transition-transform group-hover:scale-110"></div>
          <div className="flex justify-between items-start mb-2 relative z-10">
            <span className="text-xs font-black uppercase text-slate-400">Dormentes</span>
            <Activity size={20} className="text-yellow-500" />
          </div>
          <div className="text-3xl font-black text-[#113366] dark:text-white relative z-10">{kpis.dormPct.toFixed(1)}%</div>
          <div className="text-[10px] font-bold text-slate-500 uppercase mt-1 relative z-10">{fIntTooltip(kpis.dormentes)} Base Fria</div>
        </div>

        <div className="bg-white dark:bg-[#1f232d] p-6 rounded-2xl border border-slate-200 dark:border-gray-800 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-16 h-16 bg-green-100 dark:bg-green-900/20 rounded-bl-full -mr-8 -mt-8 transition-transform group-hover:scale-110"></div>
          <div className="flex justify-between items-start mb-2 relative z-10">
            <span className="text-xs font-black uppercase text-slate-400">Ativos Totais</span>
            <UserCheck size={20} className="text-green-500" />
          </div>
          <div className="text-3xl font-black text-[#113366] dark:text-white relative z-10">{fIntTooltip(kpis.ativos)}</div>
          <div className="text-[10px] font-bold text-slate-500 uppercase mt-1 relative z-10">Base Quente (RH)</div>
        </div>
      </div>

      {/* CONTROLE GLOBAL DE TEMPO */}
      <div className="flex justify-end mb-2">
        <div className="flex bg-slate-100 dark:bg-[#15171e] p-1 rounded-lg shadow-sm border border-slate-200 dark:border-gray-700">
          <button onClick={() => setPeriodo('dia')} className={`flex items-center gap-1.5 px-6 py-2 rounded text-xs font-black uppercase transition-all ${periodo === 'dia' ? 'bg-[#113366] text-white shadow' : 'text-slate-500 hover:text-[#113366]'}`}><CalendarDays size={14} /> Dia</button>
          <button onClick={() => setPeriodo('semana')} className={`flex items-center gap-1.5 px-6 py-2 rounded text-xs font-black uppercase transition-all ${periodo === 'semana' ? 'bg-[#113366] text-white shadow' : 'text-slate-500 hover:text-[#113366]'}`}><Calendar size={14} /> Sem</button>
          <button onClick={() => setPeriodo('mes')} className={`flex items-center gap-1.5 px-6 py-2 rounded text-xs font-black uppercase transition-all ${periodo === 'mes' ? 'bg-[#113366] text-white shadow' : 'text-slate-500 hover:text-[#113366]'}`}><CalendarDays size={14} /> Mês</button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        
        {/* GRÁFICO 1: EVOLUÇÃO DE RECUSAS (COM BARRAS EMPILHADAS DE MODAIS) */}
        {renderChartCard('evolucao', 'Evolução de Recusas', 'Composição de Ofertas vs Taxa de Rejeição no Tempo', <TrendingUp className="text-[#EE4D2D]"/>, 
          (
            <div className="relative" ref={evolMenuRef}>
              <div onClick={() => setIsEvolMenuOpen(!isEvolMenuOpen)} className="bg-white dark:bg-[#1f232d] border border-slate-200 dark:border-gray-700 text-slate-600 dark:text-gray-300 rounded-lg px-4 py-1.5 text-xs font-bold cursor-pointer flex items-center shadow-sm hover:bg-slate-50 transition-colors">
                <Filter size={14} className="text-[#EE4D2D] mr-1.5"/> 
                <span className="mr-2">{modaisEvol.length === 4 ? 'Todos os Modais' : `${modaisEvol.length} Selecionados`}</span>
                <ChevronDown size={14} className={`transition-transform ${isEvolMenuOpen ? 'rotate-180' : ''}`} />
              </div>
              {isEvolMenuOpen && (
                <div className="absolute top-[100%] right-0 mt-1 w-48 bg-white dark:bg-[#1f232d] border border-slate-200 dark:border-gray-700 rounded-lg shadow-xl z-50 py-1">
                  {MODAL_OPTIONS.map(modal => (
                    <label key={`ev-${modal}`} className="flex items-center gap-3 px-4 py-2 hover:bg-slate-50 dark:hover:bg-gray-800 cursor-pointer text-xs font-bold text-slate-700 dark:text-gray-200 transition-colors">
                      <input type="checkbox" checked={modaisEvol.includes(modal)} onChange={() => toggleModal(modal, setModaisEvol)} className="rounded border-slate-300 text-[#113366] focus:ring-[#113366] w-3 h-3 cursor-pointer" /> {modal}
                    </label>
                  ))}
                </div>
              )}
            </div>
          ),
          (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={temporalData} margin={{ top: 20, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fontWeight: 'bold' }} />
                <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="right" orientation="right" tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11, fill: '#D0011B' }} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ paddingTop: '10px', fontSize: '12px', fontWeight: 'bold' }} />

                {modaisEvol.includes('Passeio') && <Bar yAxisId="left" dataKey="p_off" stackId="a" name="Ofertas Passeio" fill="#113366" maxBarSize={50} radius={topVisibleModal === 'Passeio' ? [4,4,0,0] : [0,0,0,0]}><LabelList dataKey="p_off" position="center" fill="#ffffff" fontSize={10} fontWeight="bold" formatter={fInt} /></Bar>}
                {modaisEvol.includes('Utilitário') && <Bar yAxisId="left" dataKey="u_off" stackId="a" name="Ofertas Utilitário" fill="#3b82f6" maxBarSize={50} radius={topVisibleModal === 'Utilitário' ? [4,4,0,0] : [0,0,0,0]}><LabelList dataKey="u_off" position="center" fill="#ffffff" fontSize={10} fontWeight="bold" formatter={fInt} /></Bar>}
                {modaisEvol.includes('Moto') && <Bar yAxisId="left" dataKey="m_off" stackId="a" name="Ofertas Moto" fill="#F5A623" maxBarSize={50} radius={topVisibleModal === 'Moto' ? [4,4,0,0] : [0,0,0,0]}><LabelList dataKey="m_off" position="center" fill="#78350f" fontSize={10} fontWeight="bold" formatter={fInt} /></Bar>}
                {modaisEvol.includes('Van') && <Bar yAxisId="left" dataKey="v_off" stackId="a" name="Ofertas Van" fill="#8b5cf6" maxBarSize={50} radius={topVisibleModal === 'Van' ? [4,4,0,0] : [0,0,0,0]}><LabelList dataKey="v_off" position="center" fill="#ffffff" fontSize={10} fontWeight="bold" formatter={fInt} /></Bar>}
                
                <Line yAxisId="right" type="monotone" dataKey="recusaPctGeral" name="% Recusa Geral" stroke="#D0011B" strokeWidth={3} dot={{ r: 5, fill: '#fff', stroke: '#D0011B', strokeWidth: 2 }} activeDot={{ r: 7 }} />
              </ComposedChart>
            </ResponsiveContainer>
          ),
          temporalData.length // Passando tamanho do array para calcular o scroll
        )}

        {/* GRÁFICO 2: DESEMPENHO POR MODAL (OFERTAS VS CARREGADOS) */}
        {renderChartCard('modais', 'Desempenho por Modal', 'Comparativo de Ofertas Realizadas vs Carregadas (Aceites) com % de Conversão', <Truck className="text-[#EE4D2D]"/>, 
          (
            <div className="relative" ref={convMenuRef}>
              <div onClick={() => setIsConvMenuOpen(!isConvMenuOpen)} className="bg-white dark:bg-[#1f232d] border border-slate-200 dark:border-gray-700 text-slate-600 dark:text-gray-300 rounded-lg px-4 py-1.5 text-xs font-bold cursor-pointer flex items-center shadow-sm hover:bg-slate-50 transition-colors">
                <Filter size={14} className="text-[#EE4D2D] mr-1.5"/> 
                <span className="mr-2">{modaisConv.length === 4 ? 'Todos os Modais' : `${modaisConv.length} Selecionados`}</span>
                <ChevronDown size={14} className={`transition-transform ${isConvMenuOpen ? 'rotate-180' : ''}`} />
              </div>
              {isConvMenuOpen && (
                <div className="absolute top-[100%] right-0 mt-1 w-48 bg-white dark:bg-[#1f232d] border border-slate-200 dark:border-gray-700 rounded-lg shadow-xl z-50 py-1">
                  {MODAL_OPTIONS.map(modal => (
                    <label key={`co-${modal}`} className="flex items-center gap-3 px-4 py-2 hover:bg-slate-50 dark:hover:bg-gray-800 cursor-pointer text-xs font-bold text-slate-700 dark:text-gray-200 transition-colors">
                      <input type="checkbox" checked={modaisConv.includes(modal)} onChange={() => toggleModal(modal, setModaisConv)} className="rounded border-slate-300 text-[#113366] focus:ring-[#113366] w-3 h-3 cursor-pointer" /> {modal}
                    </label>
                  ))}
                </div>
              )}
            </div>
          ), 
          (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartConversaoData} margin={{ top: 20, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{ fontSize: 12, fontWeight: 'bold' }} />
                <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="right" orientation="right" tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11, fill: '#D0011B' }} />
                
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ paddingTop: '10px', fontSize: '12px', fontWeight: 'bold' }} />

                <Bar yAxisId="left" dataKey="ofertasSel" name="Ofertas (Volume)" fill="#113366" radius={[4, 4, 0, 0]} maxBarSize={50}>
                  <LabelList dataKey="ofertasSel" position="top" fill="#113366" fontSize={11} fontWeight="bold" formatter={fInt} />
                </Bar>

                <Bar yAxisId="left" dataKey="accSel" name="Carregados (Aceites)" fill="#EE4D2D" radius={[4, 4, 0, 0]} maxBarSize={50}>
                  <LabelList dataKey="accSel" position="top" fill="#EE4D2D" fontSize={11} fontWeight="bold" formatter={fInt} />
                </Bar>
                
                <Line yAxisId="right" type="monotone" dataKey="convPct" name="% Conversão" stroke="#D0011B" strokeWidth={3} dot={{ r: 5, fill: '#fff', stroke: '#D0011B', strokeWidth: 2 }} activeDot={{ r: 7 }} />

              </ComposedChart>
            </ResponsiveContainer>
          ),
          chartConversaoData.length // Passando tamanho do array para calcular o scroll
        )}

      </div>
    </div>
  );
}