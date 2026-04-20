import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { getConsolidadoData, getBaseReferenceData } from '../api/googleSheets';
import { AlertCircle, CheckCircle2, Search, Filter, ShieldCheck, AlertTriangle, ArrowRightCircle, CalendarDays, MapPin, Clock, Download, ChevronDown, X } from 'lucide-react';

const MAPA_REGIONAL = {
  "LM Hub_SP_Campinas_São Martinho": "SPI1", "LM Hub_SP_Leme": "SPI1", "LM Hub_SP_Limeira_Campo Belo": "SPI1",
  "LM Hub_SP_Mogi Mirim": "SPI1", "LM Hub_SP_Piracicaba": "SPI1", "LM Hub_SP_Sumaré_Nova Veneza": "SPI1",
  "LM Hub_SP_Campinas_PqCidade": "SPI1", "LM Hub_SP_Araraquara": "SPI2", "LM Hub_SP_Bauru_Centro": "SPI2",
  "LM Hub_SP_Jaú": "SPI2", "LM Hub_SP_Ribeirão Preto_02": "SPI2", "LM Hub_SP_São Carlos": "SPI2",
  "LM Hub_SP_RibeirãoPretoEstaça": "SPI2", "LM Hub_SP_Barretos": "SPI3", "LM Hub_SP_Franca_Distrito_Indust": "SPI3",
  "LM Hub_SP_São José do Rio P": "SPI3", "LM Hub_SP_Votuporanga": "SPI3", "LM Hub_SP_Botucatu": "SPI4",
  "LM Hub_SP_Atibaia_Ponte_Alta": "SPI4", "LM Hub_SP_Itapetininga": "SPI4", "LM Hub_SP_Itapeva": "SPI4",
  "LM Hub_SP_Jundiaí": "SPI4", "LM Hub_SP_Sorocaba_Região Norte": "SPI4", "LM Hub_SP_Tatuí": "SPI4",
  "LM Hub_SP_Várzea Paulista": "SPI4", "LM Hub_SP_Araçatuba": "SPI5", "LM Hub_SP_Assis": "SPI5",
  "LM Hub_SP_Marília": "SPI5", "LM Hub_SP_Presidente Prudente": "SPI5"
};

const STATIONS_ESPERADAS = Object.keys(MAPA_REGIONAL).sort();
const TURNOS_ESPERADOS = ['AM', 'PM1', 'PM2']; 

const CAMPOS_AUDITADOS = [
  { idx: 6, nome: 'Início' }, { idx: 7, nome: 'Fim' },
  { idx: 11, nome: 'AT Rot.' }, { idx: 12, nome: 'Vol. Rot.' },
  { idx: 13, nome: 'Vol. Proc.' }, { idx: 14, nome: 'Vol. Exp.' },
  { idx: 19, nome: 'AT Piso' }, { idx: 20, nome: 'Of. Util.' },
  { idx: 21, nome: 'Of. Pass.' }, { idx: 22, nome: 'Of. Moto' },
  { idx: 23, nome: 'Of. Van' }, { idx: 25, nome: 'Cg. Util.' },
  { idx: 26, nome: 'Cg. Pass.' }, { idx: 27, nome: 'Cg. Moto' },
  { idx: 28, nome: 'Cg. Van' }, { idx: 35, nome: 'Recusas' },
  { idx: 37, nome: 'Pac. Rot. Moto' }, { idx: 38, nome: 'Pac. Exp. Moto' },
  { idx: 50, nome: 'Realoc. Pré' }, { idx: 51, nome: 'Realoc. Dur.' },
  { idx: 53, nome: 'Não Coube' }, { idx: 54, nome: 'Não Exp. Outros' }
];

// Funções Helpers para calcular Semana ISO Atual
const getISOWeek = (d) => {
  const date = new Date(d.getTime());
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + 3 - (date.getDay() + 6) % 7);
  const week1 = new Date(date.getFullYear(), 0, 4);
  return 1 + Math.round(((date.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
};
const hj = new Date();
const currentYear = hj.getFullYear();
const currentWeekStr = `${currentYear}-W${String(getISOWeek(hj)).padStart(2, '0')}`;
const currentMonthStr = `${currentYear}-${String(hj.getMonth() + 1).padStart(2, '0')}`;

export default function Validacao() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [rawData, setRawData] = useState([]);
  const [baseData, setBaseData] = useState([]); 
  
  // 🔥 NOVOS ESTADOS DE FILTRO DE PERÍODO (Semana, Mês, Manual)
  const [tipoPeriodo, setTipoPeriodo] = useState('semana'); 
  const [semanaSelecionada, setSemanaSelecionada] = useState(currentWeekStr);
  const [mesSelecionado, setMesSelecionado] = useState(currentMonthStr);
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  
  const [filtroStatus, setFiltroStatus] = useState('todos'); 
  const [filtroRegional, setFiltroRegional] = useState('');
  const [filtroTurno, setFiltroTurno] = useState(''); 

  const [hubsSelecionados, setHubsSelecionados] = useState([]);
  const [buscaHub, setBuscaHub] = useState('');
  const [isDropdownHubOpen, setIsDropdownHubOpen] = useState(false);

  useEffect(() => { carregarDados(); }, []);

  const carregarDados = async () => {
    setLoading(true);
    try {
      const [data, base] = await Promise.all([
        getConsolidadoData(),
        getBaseReferenceData()
      ]);
      
      if (data && data.length > 0) setRawData(data.slice(1));
      if (base && base.length > 0) setBaseData(base);
    } catch (error) { console.error("Erro", error); } 
    finally { setLoading(false); }
  };

  // =========================================================
  // MÓDULO DE DATAS INTELIGENTE (Semana ISO, Mês, Manual)
  // =========================================================
  const getDatesFromISOWeek = (weekStr) => {
    if(!weekStr) return [];
    const [yearStr, weekNumStr] = weekStr.split('-W');
    const year = parseInt(yearStr, 10);
    const week = parseInt(weekNumStr, 10);
    
    const simple = new Date(year, 0, 1 + (week - 1) * 7);
    const dow = simple.getDay();
    const ISOweekStart = simple;
    if (dow <= 4) ISOweekStart.setDate(simple.getDate() - simple.getDay() + 1);
    else ISOweekStart.setDate(simple.getDate() + 8 - simple.getDay());
    
    const dates = [];
    for(let i=0; i<7; i++) {
       const d = new Date(ISOweekStart);
       d.setDate(d.getDate() + i);
       d.setHours(0,0,0,0);
       dates.push(d);
    }
    return dates;
  };

  const getDatesFromMonth = (monthStr) => {
    if(!monthStr) return [];
    const [year, month] = monthStr.split('-');
    const start = new Date(parseInt(year), parseInt(month)-1, 1);
    const end = new Date(parseInt(year), parseInt(month), 0);
    const dates = [];
    for(let d = start; d <= end; d.setDate(d.getDate()+1)) {
       dates.push(new Date(d));
    }
    return dates;
  };

  const diasAnalisados = useMemo(() => {
    let diasCalc = [];
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    if (tipoPeriodo === 'semana' && semanaSelecionada) {
      diasCalc = getDatesFromISOWeek(semanaSelecionada);
    } else if (tipoPeriodo === 'mes' && mesSelecionado) {
      diasCalc = getDatesFromMonth(mesSelecionado);
    } else if (tipoPeriodo === 'manual' && dataInicio && dataFim) {
      const start = new Date(dataInicio + 'T00:00:00');
      const end = new Date(dataFim + 'T00:00:00');
      let current = new Date(start);
      while (current <= end) {
        diasCalc.push(new Date(current));
        current.setDate(current.getDate() + 1);
      }
    }

    // Trava para não cobrar auditoria de dias no futuro
    diasCalc = diasCalc.filter(d => d <= hoje);

    return diasCalc.map(d => {
      const diaStr = String(d.getDate()).padStart(2, '0');
      const mesStr = String(d.getMonth() + 1).padStart(2, '0');
      const anoStr = d.getFullYear();
      return {
        dataObj: d,
        dataFormatadaBR: `${diaStr}/${mesStr}/${anoStr}`,
        dataFomartadaISO: `${anoStr}-${mesStr}-${diaStr}` 
      };
    }).sort((a, b) => b.dataObj - a.dataObj); 
  }, [tipoPeriodo, semanaSelecionada, mesSelecionado, dataInicio, dataFim]);

  const turnosPorStation = useMemo(() => {
    const map = {};
    if (!baseData || baseData.length === 0) return map;
    baseData.forEach(row => {
      const station = String(row[0] || "").trim();
      const turno = String(row[1] || "").trim();
      if (station && turno && station !== "Station Name") { 
        if (!map[station]) map[station] = new Set();
        map[station].add(turno);
      }
    });
    Object.keys(map).forEach(k => map[k] = Array.from(map[k]));
    return map;
  }, [baseData]);

const relatorioValidacao = useMemo(() => {
    if (rawData.length === 0 || diasAnalisados.length === 0) return [];

    const mapaRegistros = new Map();
    rawData.forEach((row, idx) => {
      const dataRow = String(row[3] || "").trim();
      const station = String(row[4] || "").trim();
      const turno = String(row[5] || "").trim();
      
      let dataNormalizada = dataRow;
      if (dataRow.includes('-')) {
        const partes = dataRow.split(' ')[0].split('-');
        if (partes.length === 3) dataNormalizada = `${partes[2]}/${partes[1]}/${partes[0]}`;
      }
      
      row._rowIndex = idx + 2; 
      mapaRegistros.set(`${dataNormalizada}|${station}|${turno}`, row);
    });

    const relatorio = [];

    STATIONS_ESPERADAS.forEach(station => {
      if (filtroRegional && MAPA_REGIONAL[station] !== filtroRegional) return;
      if (hubsSelecionados.length > 0 && !hubsSelecionados.includes(station)) return;

      const turnosDestaStation = turnosPorStation[station] || TURNOS_ESPERADOS;

      diasAnalisados.forEach(dia => {
        turnosDestaStation.forEach(turno => {
          if (filtroTurno && turno !== filtroTurno) return; 

          const keyBR = `${dia.dataFormatadaBR}|${station}|${turno}`;
          const keyISO = `${dia.dataFomartadaISO}|${station}|${turno}`;
          const registro = mapaRegistros.get(keyBR) || mapaRegistros.get(keyISO);

          if (!registro) {
            if (filtroStatus === 'todos' || filtroStatus === 'pendente') {
              relatorio.push({ 
                id: keyBR, dataBR: dia.dataFormatadaBR, station, turno, status: 'pendente', faltantes: ['Nenhum formulário enviado'],
                action: { 
                  mode: 'new', 
                  prefill: { 
                    data: dia.dataFomartadaISO, 
                    station: station, 
                    turno: turno,
                    regional: MAPA_REGIONAL[station],
                    semana: `W-${String(getISOWeek(dia.dataObj)).padStart(2, '0')}`
                  } 
                }
              });
            }
          } else {
            const camposVazios = [];
            CAMPOS_AUDITADOS.forEach(campo => {
              const valor = registro[campo.idx];
              if (valor === undefined || valor === null || String(valor).trim() === "") {
                camposVazios.push(campo.nome);
              }
            });

            if (camposVazios.length > 0 && (filtroStatus === 'todos' || filtroStatus === 'incompleto')) {
              relatorio.push({ 
                id: keyBR, dataBR: dia.dataFormatadaBR, station, turno, status: 'incompleto', faltantes: camposVazios,
                action: { mode: 'edit', row: registro } 
              });
            }
          }
        });
      });
    });

    return relatorio;
  }, [rawData, diasAnalisados, filtroStatus, filtroRegional, hubsSelecionados, filtroTurno, turnosPorStation]);

  const relatorioAgrupado = useMemo(() => {
    const agrupado = {};
    relatorioValidacao.forEach(item => {
      if (!agrupado[item.station]) agrupado[item.station] = [];
      agrupado[item.station].push(item);
    });
    return agrupado;
  }, [relatorioValidacao]);

  const irParaPreenchimento = (item) => {
    navigate('/app/tabela', { state: { resolveAction: item.action } });
  };

  const exportarCSV = () => {
    if (relatorioValidacao.length === 0) {
      alert("Não há pendências para exportar com os filtros atuais.");
      return;
    }
    const headersCSV = ["Data", "Regional", "Hub (Station)", "Turno", "Status", "Campos Afetados"];
    const linhasCSV = relatorioValidacao.map(item => {
      const data = item.dataBR;
      const regional = MAPA_REGIONAL[item.station] || "";
      const station = item.station;
      const turno = item.turno;
      const status = item.status === 'pendente' ? 'Não Iniciado' : 'Incompleto';
      const faltantes = `"${item.faltantes.join(', ')}"`; 
      return [data, regional, station, turno, status, faltantes].join(",");
    });
    const csvContent = "\uFEFF" + [headersCSV.join(","), ...linhasCSV].join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    const hoje = new Date().toISOString().split('T')[0];
    link.setAttribute("download", `Auditoria_SPI_SOP_${hoje}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const hubsDisponiveis = useMemo(() => {
    return STATIONS_ESPERADAS.filter(s => {
      if (filtroRegional && MAPA_REGIONAL[s] !== filtroRegional) return false;
      if (buscaHub && !s.toLowerCase().includes(buscaHub.toLowerCase())) return false;
      return true;
    });
  }, [filtroRegional, buscaHub]);

  const toggleHub = (hub) => {
    setHubsSelecionados(prev => 
      prev.includes(hub) ? prev.filter(h => h !== hub) : [...prev, hub]
    );
  };

  const limparHubs = (e) => {
    e.stopPropagation();
    setHubsSelecionados([]);
  };

  if (loading) return (<div className="flex h-full items-center justify-center"><div className="w-12 h-12 border-4 border-[#EE4D2D] border-t-transparent rounded-full animate-spin"></div></div>);

  return (
    <div className="flex flex-col h-full space-y-6 pb-20">
      
      <div className="bg-white dark:bg-[#1f232d] rounded-2xl shadow-sm border border-slate-200 dark:border-gray-800 p-6 shrink-0 z-10">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
          <div>
            <h2 className="text-2xl font-black text-slate-800 dark:text-white uppercase tracking-tight flex items-center gap-2">
              <ShieldCheck className="text-[#EE4D2D]" size={28} /> Validação de Preenchimento
            </h2>
            <p className="text-sm text-slate-500 dark:text-gray-400 mt-1">Auditoria de campos obrigatórios SPI e Realocação SOP.</p>
          </div>
          
          <div className="flex gap-2">
            <button 
              onClick={exportarCSV} 
              className="flex items-center gap-2 bg-slate-100 dark:bg-gray-800 text-slate-700 dark:text-gray-200 border border-slate-200 dark:border-gray-700 px-4 py-2 rounded-xl font-bold text-sm hover:bg-slate-200 dark:hover:bg-gray-700 transition-colors shadow-sm"
            >
              <Download size={16} /> Exportar CSV
            </button>
            <button 
              onClick={carregarDados} 
              className="bg-blue-50 dark:bg-[#0055A5]/20 text-[#0055A5] dark:text-blue-400 border border-blue-200 dark:border-[#0055A5] px-4 py-2 rounded-xl font-bold text-sm hover:bg-blue-100 transition-colors shadow-sm"
            >
              Re-auditar Base
            </button>
          </div>
        </div>

        {/* CONTROLES DE FILTRO FLUIDOS */}
        <div className="flex flex-wrap items-end gap-4 bg-slate-50 dark:bg-[#15171e] p-4 rounded-xl border border-slate-100 dark:border-gray-800">
          
          <div className="flex flex-col flex-1 min-w-[150px]">
            <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 flex items-center gap-1"><CalendarDays size={12}/> Tipo Período</label>
            <select value={tipoPeriodo} onChange={(e) => setTipoPeriodo(e.target.value)} className="bg-white dark:bg-[#1f232d] dark:text-white border border-slate-200 dark:border-gray-700 rounded-lg p-2.5 text-sm h-[42px] cursor-pointer">
              <option value="semana">Por Semana (ISO)</option>
              <option value="mes">Por Mês</option>
              <option value="manual">Personalizado (Manual)</option>
            </select>
          </div>

          {/* RENDEREIZAÇÃO CONDICIONAL DE DATAS */}
          {tipoPeriodo === 'semana' && (
            <div className="flex flex-col flex-1 min-w-[150px] animate-in fade-in slide-in-from-left-4">
              <label className="text-[10px] font-bold text-slate-400 uppercase mb-1">Selecione a Semana</label>
              <input type="week" value={semanaSelecionada} onChange={(e) => setSemanaSelecionada(e.target.value)} className="bg-white dark:bg-[#1f232d] dark:text-white border border-slate-200 dark:border-gray-700 rounded-lg p-2.5 text-sm h-[42px] cursor-pointer"/>
            </div>
          )}

          {tipoPeriodo === 'mes' && (
            <div className="flex flex-col flex-1 min-w-[150px] animate-in fade-in slide-in-from-left-4">
              <label className="text-[10px] font-bold text-slate-400 uppercase mb-1">Selecione o Mês</label>
              <input type="month" value={mesSelecionado} onChange={(e) => setMesSelecionado(e.target.value)} className="bg-white dark:bg-[#1f232d] dark:text-white border border-slate-200 dark:border-gray-700 rounded-lg p-2.5 text-sm h-[42px] cursor-pointer"/>
            </div>
          )}

          {tipoPeriodo === 'manual' && (
            <div className="flex gap-2 flex-[2] min-w-[240px] animate-in fade-in slide-in-from-left-4">
              <div className="flex flex-col flex-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase mb-1">Início</label>
                <input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} className="bg-white dark:bg-[#1f232d] dark:text-white border border-slate-200 dark:border-gray-700 rounded-lg p-2.5 text-sm h-[42px]"/>
              </div>
              <div className="flex flex-col flex-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase mb-1">Fim</label>
                <input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} className="bg-white dark:bg-[#1f232d] dark:text-white border border-slate-200 dark:border-gray-700 rounded-lg p-2.5 text-sm h-[42px]"/>
              </div>
            </div>
          )}

          <div className="flex flex-col flex-1 min-w-[150px]">
            <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 flex items-center gap-1"><MapPin size={12}/> Regional</label>
            <select value={filtroRegional} onChange={(e) => {setFiltroRegional(e.target.value); setHubsSelecionados([]);}} className="bg-white dark:bg-[#1f232d] dark:text-white border border-slate-200 dark:border-gray-700 rounded-lg p-2.5 text-sm h-[42px] cursor-pointer">
              <option value="">Todas</option>
              {['SPI1','SPI2','SPI3','SPI4','SPI5'].map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>

          {/* DROPDOWN MULTI-SELECT DE HUBS */}
          <div className="flex flex-col flex-[2] min-w-[250px] relative">
            <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 flex items-center gap-1"><Search size={12}/> Hubs (Múltiplos)</label>
            <div 
              onClick={() => setIsDropdownHubOpen(!isDropdownHubOpen)}
              className="bg-white dark:bg-[#1f232d] dark:text-white border border-slate-200 dark:border-gray-700 rounded-lg p-2.5 text-sm h-[42px] flex items-center justify-between cursor-pointer hover:border-blue-500"
            >
              <span className="truncate pr-2">
                {hubsSelecionados.length === 0 
                  ? "Todos os Hubs" 
                  : hubsSelecionados.length === 1 
                    ? hubsSelecionados[0] 
                    : `${hubsSelecionados.length} Hubs Selecionados`}
              </span>
              <div className="flex items-center gap-2 text-slate-400">
                {hubsSelecionados.length > 0 && (
                  <button onClick={limparHubs} className="hover:text-red-500 p-0.5 rounded-full hover:bg-slate-100 dark:hover:bg-gray-700">
                    <X size={14} />
                  </button>
                )}
                <ChevronDown size={16} />
              </div>
            </div>

            {isDropdownHubOpen && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setIsDropdownHubOpen(false)}></div>
                <div className="absolute top-[60px] left-0 w-full bg-white dark:bg-[#1f232d] border border-slate-200 dark:border-gray-700 rounded-xl shadow-xl z-40 overflow-hidden flex flex-col">
                  <div className="p-2 border-b border-slate-100 dark:border-gray-800">
                    <input 
                      type="text" 
                      placeholder="Pesquisar hub..." 
                      value={buscaHub}
                      onChange={(e) => setBuscaHub(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-[#15171e] dark:text-white border-none rounded-lg p-2 text-sm focus:ring-2 focus:ring-[#EE4D2D] outline-none"
                    />
                  </div>
                  <div className="max-h-60 overflow-y-auto p-1">
                    {hubsDisponiveis.length === 0 ? (
                      <p className="p-3 text-center text-sm text-slate-500">Nenhum hub encontrado.</p>
                    ) : (
                      hubsDisponiveis.map(hub => (
                        <label key={hub} className="flex items-center gap-3 p-2.5 hover:bg-slate-50 dark:hover:bg-gray-800 rounded-lg cursor-pointer transition-colors">
                          <input 
                            type="checkbox" 
                            checked={hubsSelecionados.includes(hub)} 
                            onChange={() => toggleHub(hub)}
                            className="w-4 h-4 text-[#EE4D2D] border-gray-300 rounded focus:ring-[#EE4D2D] cursor-pointer"
                          />
                          <span className="text-sm text-slate-700 dark:text-gray-200">{hub}</span>
                        </label>
                      ))
                    )}
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="flex flex-col flex-1 min-w-[150px]">
            <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 flex items-center gap-1"><Clock size={12}/> Turno</label>
            <select value={filtroTurno} onChange={(e) => setFiltroTurno(e.target.value)} className="bg-white dark:bg-[#1f232d] dark:text-white border border-slate-200 dark:border-gray-700 rounded-lg p-2.5 text-sm h-[42px] cursor-pointer">
              <option value="">Todos os Turnos</option>
              {TURNOS_ESPERADOS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          
          <div className="flex flex-col flex-1 min-w-[150px]">
            <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 flex items-center gap-1"><Filter size={12}/> Status</label>
            <select value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)} className="bg-white dark:bg-[#1f232d] dark:text-white border border-slate-200 dark:border-gray-700 rounded-lg p-2.5 text-sm h-[42px] cursor-pointer">
              <option value="todos">Todos os Alertas</option>
              <option value="pendente">Não Iniciados (Pendente)</option>
              <option value="incompleto">Campos Vazios (Incompleto)</option>
            </select>
          </div>

        </div>
      </div>

      {/* RENDERIZAÇÃO DA LISTA DE ALERTAS */}
      <div className="flex-1 overflow-y-auto pr-2 space-y-6">
        {Object.keys(relatorioAgrupado).length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center space-y-3 opacity-60 mt-10">
            <CheckCircle2 size={64} className="text-green-500" />
            <div>
              <p className="font-bold text-2xl text-slate-800 dark:text-white">Auditoria Limpa!</p>
              <p className="text-slate-500 dark:text-gray-400">Nenhuma pendência encontrada para os filtros selecionados.</p>
            </div>
          </div>
        ) : (
          Object.entries(relatorioAgrupado).map(([station, alertas]) => (
            <div key={station} className="bg-white dark:bg-[#1f232d] rounded-2xl shadow-sm border border-slate-200 dark:border-gray-800 overflow-hidden">
              <div className="bg-slate-100 dark:bg-[#15171e] p-4 border-b border-slate-200 dark:border-gray-800 flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="bg-[#0055A5] text-white p-2 rounded-lg"><MapPin size={20}/></div>
                  <div>
                    <h3 className="font-black text-slate-800 dark:text-white text-lg">{station}</h3>
                    <p className="text-xs text-slate-500 dark:text-gray-400 font-bold uppercase">{MAPA_REGIONAL[station]} • {alertas.length} ocorrência(s)</p>
                  </div>
                </div>
              </div>
              
              <div className="divide-y divide-slate-100 dark:divide-gray-800">
                {alertas.map((item, idx) => (
                  <div key={idx} className={`p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-colors hover:bg-slate-50 dark:hover:bg-gray-800/50 ${item.status === 'pendente' ? 'bg-red-50/20' : 'bg-amber-50/20'}`}>
                    
                    <div className="flex items-start gap-4 md:w-1/3">
                      <div className={`mt-1 p-2 rounded-full ${item.status === 'pendente' ? 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400' : 'bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400'}`}>
                        {item.status === 'pendente' ? <AlertCircle size={18} /> : <AlertTriangle size={18} />}
                      </div>
                      <div>
                        <p className="font-bold text-slate-800 dark:text-gray-200 text-base">{item.dataBR}</p>
                        <p className="text-sm text-slate-500 font-bold">Turno: <span className="text-[#0055A5] dark:text-blue-400">{item.turno}</span></p>
                      </div>
                    </div>

                    <div className="md:w-1/2">
                      <p className="text-xs font-bold text-slate-400 uppercase mb-1">Campos Afetados:</p>
                      <div className="flex flex-wrap gap-1.5">
                        {item.faltantes.map((campo, i) => (
                          <span key={i} className="bg-white dark:bg-[#15171e] border border-slate-200 dark:border-gray-700 text-slate-600 dark:text-gray-300 text-[11px] font-bold px-2 py-1 rounded-md shadow-sm">
                            {campo}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="md:w-auto flex justify-end">
                      <button 
                        onClick={() => irParaPreenchimento(item)}
                        className="flex items-center gap-2 bg-[#EE4D2D] hover:bg-[#d64528] text-white px-4 py-2 rounded-xl text-sm font-bold shadow-sm transition-colors"
                      >
                        Resolver <ArrowRightCircle size={16} />
                      </button>
                    </div>

                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}