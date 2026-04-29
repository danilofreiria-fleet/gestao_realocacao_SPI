import React, { useState, useMemo, useRef, useEffect } from 'react';
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, LabelList, Cell } from 'recharts';
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

const STATUS_OPTIONS = ['Ativos', 'Novos', 'Dormentes', 'Risco', 'Churn'];

export default function StatusEvolutionChart({ historicoFrotaData, filtrosGlobais = {} }) {
  const [periodo, setPeriodo] = useState('semana');
  const { regional = [], station = [], semana = "", mes = "" } = filtrosGlobais;

  const [selectedStatuses, setSelectedStatuses] = useState(STATUS_OPTIONS);
  const [isStatusMenuOpen, setIsStatusMenuOpen] = useState(false);
  const statusMenuRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (statusMenuRef.current && !statusMenuRef.current.contains(event.target)) setIsStatusMenuOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const toggleStatus = (status) => {
    setSelectedStatuses(prev => prev.includes(status) ? prev.filter(s => s !== status) : [...prev, status]);
  };

  const chartData = useMemo(() => {
    if (!historicoFrotaData || historicoFrotaData.length <= 1) return [];

    const TRADUZ_MES = { '01':'JAN', '02':'FEV', '03':'MAR', '04':'ABR', '05':'MAI', '06':'JUN', '07':'JUL', '08':'AGO', '09':'SET', '10':'OUT', '11':'NOV', '12':'DEZ' };

    // 1. Agrupamento pegando SEMPRE o valor mais recente (Snapshot)
    const snapshotMap = {};

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

      // Lógica de Snapshot: Se for uma nova data para o mesmo período/hub, sobrescreve. 
      // Como o forEach percorre a planilha, se o dia 29 vier depois do 28, o dado do dia 29 prevalece.
      const idUnico = `${chavePeriodo}_${hubRow}`;
      
      if (!snapshotMap[idUnico] || dataStr >= snapshotMap[idUnico].dataRef) {
        snapshotMap[idUnico] = {
          periodo: chavePeriodo,
          dataRef: dataStr,
          ativos: Number(row[4]) || 0,
          dormentes: Number(row[5]) || 0,
          risco: Number(row[6]) || 0,
          churn: Number(row[7]) || 0,
          novos: Number(row[8]) || 0
        };
      }
    });

    // 2. Consolidar as Stations por Período
    const finalAggs = {};
    Object.values(snapshotMap).forEach(item => {
      const p = item.periodo;
      if (!finalAggs[p]) {
        finalAggs[p] = { name: p, rawDate: item.dataRef, Ativos: 0, Dormentes: 0, Risco: 0, Churn: 0, Novos: 0 };
      }
      finalAggs[p].Ativos += item.ativos;
      finalAggs[p].Dormentes += item.dormentes;
      finalAggs[p].Risco += item.risco;
      finalAggs[p].Churn += item.churn;
      finalAggs[p].Novos += item.novos;
    });

    // 3. Ordenar e Calcular Variação %
    const dadosOrdenados = Object.values(finalAggs).sort((a, b) => {
      if (periodo === 'dia') return a.rawDate.localeCompare(b.rawDate);
      return a.name.localeCompare(b.name);
    });

    let baseAnterior = null;
    return dadosOrdenados.map(d => {
      const baseAtual = d.Ativos + d.Novos;
      let variacao = 0;
      if (baseAnterior !== null && baseAnterior !== 0) {
        variacao = ((baseAtual - baseAnterior) / baseAnterior) * 100;
      }
      baseAnterior = baseAtual;
      return { ...d, variacao: Number(variacao.toFixed(1)) };
    });

  }, [historicoFrotaData, periodo, station, regional, semana, mes]);

  const formatLabel = (val) => (val > 0 ? new Intl.NumberFormat('pt-BR').format(val) : '');
  const topVisibleStatus = [...STATUS_OPTIONS].reverse().find(s => selectedStatuses.includes(s));

  return (
    <div className="bg-white dark:bg-[#1f232d] rounded-2xl shadow-sm border border-slate-200 dark:border-gray-800 p-6 flex flex-col mt-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 border-b border-slate-100 dark:border-gray-800 pb-4 gap-4">
        <div>
          <h3 className="font-black uppercase flex items-center gap-2 text-xl text-[#113366]">
            Evolução de Status da Frota
          </h3>
          <p className="text-xs text-slate-400 font-bold uppercase mt-1 flex items-center gap-1">
            <TrendingUp size={12}/> {periodo === 'dia' ? 'Visão Diária' : periodo === 'semana' ? 'Snapshot da Semana (W)' : 'Snapshot do Mês (M)'}
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative" ref={statusMenuRef}>
            <div 
              className="bg-white dark:bg-[#1f232d] border border-slate-200 dark:border-gray-700 text-slate-600 dark:text-gray-300 rounded-lg px-4 py-1.5 text-xs font-bold cursor-pointer flex justify-between items-center shadow-sm hover:bg-slate-50"
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
                  <label key={status} className="flex items-center gap-3 px-4 py-2 hover:bg-slate-50 dark:hover:bg-gray-800 cursor-pointer text-xs font-bold text-slate-700 dark:text-gray-200">
                    <input type="checkbox" checked={selectedStatuses.includes(status)} onChange={() => toggleStatus(status)} className="rounded border-slate-300 text-[#0055A5] w-3 h-3" /> 
                    {status}
                  </label>
                ))}
              </div>
            )}
          </div>

          <div className="flex bg-slate-100 dark:bg-[#15171e] p-1 rounded-lg">
            {['dia', 'semana', 'mes'].map((p) => (
              <button key={p} onClick={() => setPeriodo(p)} className={`px-4 py-1.5 rounded text-xs font-bold transition-all ${periodo === p ? 'bg-[#113366] text-white' : 'text-slate-500'}`}>
                {p === 'dia' ? 'Dia' : p === 'semana' ? 'Sem' : 'Mês'}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="w-full h-[400px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
            <XAxis dataKey="name" tick={{ fontSize: 11, fontWeight: 'bold' }} />
            <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
            <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: '#D0011B' }} tickFormatter={(val) => `${val}%`} />
            
            <Tooltip 
              cursor={{ fill: 'rgba(0,0,0,0.04)' }}
              contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
            />
            <Legend wrapperStyle={{ paddingTop: '15px', fontSize: '12px', fontWeight: 'bold' }} />

            {selectedStatuses.includes('Ativos') && (
              <Bar yAxisId="left" dataKey="Ativos" stackId="a" fill="#10b981" maxBarSize={60} radius={topVisibleStatus === 'Ativos' ? [4, 4, 0, 0] : [0, 0, 0, 0]}>
                <LabelList dataKey="Ativos" position="center" fill="#ffffff" fontSize={11} fontWeight="bold" formatter={formatLabel} />
              </Bar>
            )}
            {selectedStatuses.includes('Novos') && (
              <Bar yAxisId="left" dataKey="Novos" stackId="a" fill="#3b82f6" maxBarSize={60} radius={topVisibleStatus === 'Novos' ? [4, 4, 0, 0] : [0, 0, 0, 0]}>
                <LabelList dataKey="Novos" position="center" fill="#ffffff" fontSize={11} fontWeight="bold" formatter={formatLabel} />
              </Bar>
            )}
            {selectedStatuses.includes('Dormentes') && (
              <Bar yAxisId="left" dataKey="Dormentes" stackId="a" fill="#fbbf24" maxBarSize={60} radius={topVisibleStatus === 'Dormentes' ? [4, 4, 0, 0] : [0, 0, 0, 0]}>
                <LabelList dataKey="Dormentes" position="center" fill="#78350f" fontSize={11} fontWeight="bold" formatter={formatLabel} />
              </Bar>
            )}
            {selectedStatuses.includes('Risco') && (
              <Bar yAxisId="left" dataKey="Risco" stackId="a" fill="#f97316" maxBarSize={60} radius={topVisibleStatus === 'Risco' ? [4, 4, 0, 0] : [0, 0, 0, 0]}>
                <LabelList dataKey="Risco" position="center" fill="#ffffff" fontSize={11} fontWeight="bold" formatter={formatLabel} />
              </Bar>
            )}
            {selectedStatuses.includes('Churn') && (
              <Bar yAxisId="left" dataKey="Churn" stackId="a" fill="#ef4444" maxBarSize={60} radius={topVisibleStatus === 'Churn' ? [4, 4, 0, 0] : [0, 0, 0, 0]}>
                <LabelList dataKey="Churn" position="center" fill="#ffffff" fontSize={11} fontWeight="bold" formatter={formatLabel} />
              </Bar>
            )}

            <Line 
              yAxisId="right"
              type="monotone" 
              dataKey="variacao" 
              name="Variação % Base Ativa" 
              stroke="#D0011B" 
              strokeWidth={3} 
              dot={{ r: 4, fill: "#fff", stroke: "#D0011B", strokeWidth: 2 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}