import React, { useState, useMemo, useRef, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, LabelList } from 'recharts';
import { Calendar, TrendingUp, CalendarDays, Filter, ChevronDown } from 'lucide-react';

const MAPA_REGIONAL = {
  "LM Hub_SP_Campinas_São Martinho": "SPI1", "LM Hub_SP_Leme": "SPI1", "LM Hub_SP_Limeira_Campo Belo": "SPI1",
  "LM Hub_SP_Mogi Mirim": "SPI1", "LM Hub_SP_Piracicaba": "SPI1", "LM Hub_SP_Sumaré_Nova Veneza": "SPI1",
  "LM Hub_SP_Campinas_PqCidade": "SPI1", "LM Hub_SP_Araraquara": "SPO1", "LM Hub_SP_Bauru_Centro": "SPO3",
  "LM Hub_SP_Jaú": "SPO1", "LM Hub_SP_Ribeirão Preto_02": "SPO1", "LM Hub_SP_São Carlos": "SPO1",
  "LM Hub_SP_RibeirãoPretoEstaça": "SPO1", "LM Hub_SP_Barretos": "SPO2", "LM Hub_SP_Franca_Distrito_Indust": "SPO2",
  "LM Hub_SP_São José do Rio P": "SPO2", "LM Hub_SP_Votuporanga": "SPO2", "LM Hub_SP_Botucatu": "SPI3",
  "LM Hub_SP_Atibaia_Ponte_Alta": "SPI2", "LM Hub_SP_Itapetininga": "SPI3", "LM Hub_SP_Itapeva": "SPI3",
  "LM Hub_SP_Jundiaí": "SPI2", "LM Hub_SP_Sorocaba_Região Norte": "SPI3", "LM Hub_SP_Tatuí": "SPI3",
  "LM Hub_SP_Várzea Paulista": "SPI2", "LM Hub_SP_Araçatuba": "SPO2", "LM Hub_SP_Assis": "SPO3",
  "LM Hub_SP_Marília": "SPO3", "LM Hub_SP_Presidente Prudente": "SPO3"
};

// 🔥 ORDEM DE EMPILHAMENTO (De baixo para cima)
const STATUS_OPTIONS = ['Ativos', 'Novos', 'Dormentes', 'Risco', 'Churn'];

export default function StatusEvolutionChart({ historicoFrotaData, filtrosGlobais = {} }) {
  const [periodo, setPeriodo] = useState('semana'); // 'dia' | 'semana' | 'mes'
  const { regional = [], station = [], semana = "", mes = "" } = filtrosGlobais;

  // 🔥 NOVOS ESTADOS PARA O FILTRO DE STATUS
  const [selectedStatuses, setSelectedStatuses] = useState(STATUS_OPTIONS);
  const [isStatusMenuOpen, setIsStatusMenuOpen] = useState(false);
  const statusMenuRef = useRef(null);

  // Fecha o menu de status ao clicar fora
  useEffect(() => {
    function handleClickOutside(event) {
      if (statusMenuRef.current && !statusMenuRef.current.contains(event.target)) {
        setIsStatusMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const toggleStatus = (status) => {
    setSelectedStatuses(prev => {
      if (prev.includes(status)) {
        return prev.filter(s => s !== status);
      } else {
        return [...prev, status];
      }
    });
  };

  const chartData = useMemo(() => {
    if (!historicoFrotaData || historicoFrotaData.length <= 1) return [];

    const TRADUZ_MES = { '01':'JAN', '02':'FEV', '03':'MAR', '04':'ABR', '05':'MAI', '06':'JUN', '07':'JUL', '08':'AGO', '09':'SET', '10':'OUT', '11':'NOV', '12':'DEZ' };

    const aggs = {};

    historicoFrotaData.slice(1).forEach(row => {
      const semRow = String(row[0] || "");
      const mesRow = String(row[1] || "");
      const dataStr = String(row[2] || ""); 
      const hubRow = String(row[3] || "");
      const regDoHub = MAPA_REGIONAL[hubRow] || "";

      if (regional.length > 0 && !regional.includes(regDoHub)) return;
      if (station.length > 0 && !station.includes(hubRow)) return;

      let chavePeriodo = semRow;
      if (periodo === 'mes') chavePeriodo = mesRow;
      if (periodo === 'dia') {
        const parts = dataStr.split('-'); 
        chavePeriodo = parts.length === 3 ? `${parts[2]}/${parts[1]}` : dataStr;
      }

      if (!chavePeriodo) return;

      if (periodo === 'semana' && semana && semRow !== semana) return;
      if (periodo === 'mes' && mes && mesRow !== TRADUZ_MES[mes]) return;

      const chaveUnica = `${chavePeriodo}_${dataStr}`;

      if (!aggs[chaveUnica]) {
        aggs[chaveUnica] = {
          periodo: chavePeriodo,
          dataStrOriginal: dataStr, 
          ativos: 0, dormentes: 0, risco: 0, churn: 0, novos: 0
        };
      }

      aggs[chaveUnica].ativos += Number(row[4]) || 0;
      aggs[chaveUnica].dormentes += Number(row[5]) || 0;
      aggs[chaveUnica].risco += Number(row[6]) || 0;
      aggs[chaveUnica].churn += Number(row[7]) || 0;
      aggs[chaveUnica].novos += Number(row[8]) || 0;
    });

    const finalAggs = {};
    Object.values(aggs).forEach(dia => {
      const p = dia.periodo;
      if (!finalAggs[p]) {
        finalAggs[p] = { 
          name: p, 
          rawDate: dia.dataStrOriginal, 
          ativos: 0, dormentes: 0, risco: 0, churn: 0, novos: 0, diasContados: 0 
        };
      }
      finalAggs[p].ativos += dia.ativos;
      finalAggs[p].dormentes += dia.dormentes;
      finalAggs[p].risco += dia.risco;
      finalAggs[p].churn += dia.churn;
      finalAggs[p].novos += dia.novos;
      finalAggs[p].diasContados++;
    });

    return Object.values(finalAggs)
      .map(d => ({
        name: d.name,
        rawDate: d.rawDate,
        Ativos: Math.round(d.ativos / d.diasContados),
        Novos: Math.round(d.novos / d.diasContados),
        Dormentes: Math.round(d.dormentes / d.diasContados),
        Risco: Math.round(d.risco / d.diasContados),
        Churn: Math.round(d.churn / d.diasContados),
      }))
      .sort((a, b) => {
        if (periodo === 'dia') return a.rawDate.localeCompare(b.rawDate);
        return a.name.localeCompare(b.name);
      });

  }, [historicoFrotaData, periodo, station, regional, semana, mes]);

  if (chartData.length === 0) return null;

  let subtitleLabel = 'Visão Diária';
  if (periodo === 'semana') subtitleLabel = 'Média por Semana (W)';
  else if (periodo === 'mes') subtitleLabel = 'Média por Mês (M)';

  const formatLabel = (val) => {
    if (!val || val === 0) return '';
    return new Intl.NumberFormat('pt-BR').format(val);
  };

  // 🔥 IDENTIFICA QUAL É A BARRA DO TOPO PARA ARREDONDAR OS CANTOS
  const topVisibleStatus = [...STATUS_OPTIONS].reverse().find(s => selectedStatuses.includes(s));

  return (
    <div className="bg-white dark:bg-[#1f232d] rounded-2xl shadow-sm border border-slate-200 dark:border-gray-800 p-6 flex flex-col mt-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 border-b border-slate-100 dark:border-gray-800 pb-4 gap-4">
        <div>
          <h3 className="font-black uppercase flex items-center gap-2 text-xl text-[#113366]">
            Evolução de Status da Frota
          </h3>
          <p className="text-xs text-slate-400 font-bold uppercase mt-1 flex items-center gap-1">
            <TrendingUp size={12}/> {subtitleLabel}
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          
          {/* 🔥 NOVO: DROPDOWN DE MÚLTIPLA ESCOLHA DE STATUS */}
          <div className="relative" ref={statusMenuRef}>
            <div 
              className="bg-white dark:bg-[#1f232d] border border-slate-200 dark:border-gray-700 text-slate-600 dark:text-gray-300 rounded-lg px-4 py-1.5 text-xs font-bold cursor-pointer flex justify-between items-center shadow-sm hover:bg-slate-50 transition-colors"
              onClick={() => setIsStatusMenuOpen(!isStatusMenuOpen)}
            >
              <span className="flex items-center gap-1.5 mr-2">
                <Filter size={14} className="text-[#EE4D2D]"/> 
                {selectedStatuses.length === 5 ? 'Todos os Status' : `${selectedStatuses.length} Selecionados`}
              </span>
              <ChevronDown size={14} className={`transition-transform ${isStatusMenuOpen ? 'rotate-180' : ''}`} />
            </div>
            
            {isStatusMenuOpen && (
              <div className="absolute top-[100%] right-0 mt-1 w-48 bg-white dark:bg-[#1f232d] border border-slate-200 dark:border-gray-700 rounded-lg shadow-xl z-50 py-1">
                {STATUS_OPTIONS.map(status => (
                  <label key={status} className="flex items-center gap-3 px-4 py-2 hover:bg-slate-50 dark:hover:bg-gray-800 cursor-pointer text-xs font-bold text-slate-700 dark:text-gray-200 transition-colors">
                    <input 
                      type="checkbox" 
                      checked={selectedStatuses.includes(status)} 
                      onChange={() => toggleStatus(status)}
                      className="rounded border-slate-300 text-[#0055A5] focus:ring-[#0055A5] w-3 h-3 cursor-pointer"
                    /> 
                    {status}
                  </label>
                ))}
              </div>
            )}
          </div>

          <div className="flex bg-slate-100 dark:bg-[#15171e] p-1 rounded-lg">
            <button onClick={() => setPeriodo('dia')} className={`flex items-center gap-1.5 px-4 py-1.5 rounded text-xs font-bold transition-all ${periodo === 'dia' ? 'bg-[#113366] shadow text-white' : 'text-slate-500 hover:text-slate-700'}`}>
              <CalendarDays size={14} /> Dia
            </button>
            <button onClick={() => setPeriodo('semana')} className={`flex items-center gap-1.5 px-4 py-1.5 rounded text-xs font-bold transition-all ${periodo === 'semana' ? 'bg-[#113366] shadow text-white' : 'text-slate-500 hover:text-slate-700'}`}>
              <Calendar size={14} /> Sem
            </button>
            <button onClick={() => setPeriodo('mes')} className={`flex items-center gap-1.5 px-4 py-1.5 rounded text-xs font-bold transition-all ${periodo === 'mes' ? 'bg-[#113366] shadow text-white' : 'text-slate-500 hover:text-slate-700'}`}>
              <Calendar size={14} /> Mês
            </button>
          </div>

        </div>
      </div>

      <div className="w-full h-[400px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
            <XAxis dataKey="name" tick={{ fontSize: 11, fontWeight: 'bold' }} />
            <YAxis tick={{ fontSize: 11 }} />
            
            <Tooltip 
              cursor={{ fill: 'rgba(0,0,0,0.04)' }}
              contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
              labelStyle={{ fontWeight: 'black', color: '#113366', marginBottom: '8px' }}
            />
            <Legend wrapperStyle={{ paddingTop: '15px', fontSize: '12px', fontWeight: 'bold' }} />

            {/* 🔥 RENDERIZAÇÃO CONDICIONAL DAS BARRAS COM RAIO DINÂMICO */}
            {selectedStatuses.includes('Ativos') && (
              <Bar dataKey="Ativos" stackId="a" fill="#10b981" maxBarSize={60} radius={topVisibleStatus === 'Ativos' ? [4, 4, 0, 0] : [0, 0, 0, 0]}>
                <LabelList dataKey="Ativos" position="center" fill="#ffffff" fontSize={11} fontWeight="bold" formatter={formatLabel} />
              </Bar>
            )}
            
            {selectedStatuses.includes('Novos') && (
              <Bar dataKey="Novos" stackId="a" fill="#3b82f6" maxBarSize={60} radius={topVisibleStatus === 'Novos' ? [4, 4, 0, 0] : [0, 0, 0, 0]}>
                <LabelList dataKey="Novos" position="center" fill="#ffffff" fontSize={11} fontWeight="bold" formatter={formatLabel} />
              </Bar>
            )}
            
            {selectedStatuses.includes('Dormentes') && (
              <Bar dataKey="Dormentes" stackId="a" fill="#fbbf24" maxBarSize={60} radius={topVisibleStatus === 'Dormentes' ? [4, 4, 0, 0] : [0, 0, 0, 0]}>
                <LabelList dataKey="Dormentes" position="center" fill="#78350f" fontSize={11} fontWeight="bold" formatter={formatLabel} />
              </Bar>
            )}
            
            {selectedStatuses.includes('Risco') && (
              <Bar dataKey="Risco" stackId="a" fill="#f97316" maxBarSize={60} radius={topVisibleStatus === 'Risco' ? [4, 4, 0, 0] : [0, 0, 0, 0]}>
                <LabelList dataKey="Risco" position="center" fill="#ffffff" fontSize={11} fontWeight="bold" formatter={formatLabel} />
              </Bar>
            )}
            
            {selectedStatuses.includes('Churn') && (
              <Bar dataKey="Churn" stackId="a" fill="#ef4444" maxBarSize={60} radius={topVisibleStatus === 'Churn' ? [4, 4, 0, 0] : [0, 0, 0, 0]}>
                <LabelList dataKey="Churn" position="center" fill="#ffffff" fontSize={11} fontWeight="bold" formatter={formatLabel} />
              </Bar>
            )}
            
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}