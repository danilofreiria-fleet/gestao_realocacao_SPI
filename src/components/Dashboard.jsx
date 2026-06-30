import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getConsolidadoData, getBaseReferenceData, getDadosAtPiso, getFirstTripsData, getHistoricoFrotaData, getAtPisoClusterData } from '../api/googleSheets';
import Visualizations from './Visualizations';
import { Layers, CalendarDays, MapPin, Search, Clock, Hash, Eraser, Download, Printer, ChevronDown, LayoutDashboard, Users, BarChart3, AlertCircle, Package, Zap, Activity, MessageSquareWarning, PieChart } from 'lucide-react';
import { MAPA_REGIONAL_COMPLETO, getHubsPermitidos } from '../constants/regionais';

const MESES = [
  { value: '01', label: 'Janeiro' }, { value: '02', label: 'Fevereiro' }, { value: '03', label: 'Março' },
  { value: '04', label: 'Abril' }, { value: '05', label: 'Maio' }, { value: '06', label: 'Junho' },
  { value: '07', label: 'Julho' }, { value: '08', label: 'Agosto' }, { value: '09', label: 'Setembro' },
  { value: '10', label: 'Outubro' }, { value: '11', label: 'Novembro' }, { value: '12', label: 'Dezembro' }
];

export default function Dashboard() {
  const navigate = useNavigate();

  useEffect(() => {
    if (localStorage.getItem("isGestor") !== "true") {
      alert("Acesso restrito. Somente gestores podem visualizar o Dashboard de KPIs.");
      navigate("/app/tabela");
    }
  }, [navigate]);

  const [loading, setLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState("Iniciando...");
  
  // ESTADOS GLOBAIS DE DADOS (Removi os pesados daqui!)
  const [rawData, setRawData] = useState([]);
  const [dashData, setDashData] = useState([]);
  const [baseData, setBaseData] = useState([]);
  const [atPisoData, setAtPisoData] = useState([]);
  const [firstTripsData, setFirstTripsData] = useState([]);
  const [historicoFrotaData, setHistoricoFrotaData] = useState([]);
  const [ofertasModalData, setOfertasModalData] = useState([]);
  const [atPisoClusterData, setAtPisoClusterData] = useState([]);
  
  // ESTADOS DE FILTROS GLOBAIS
  const [filtros, setFiltros] = useState({
    regional: [], station: [], turno: [], dataInicio: '', dataFim: '', semana: '', mes: ''
  });
  

  const [isTurnoMenuOpen, setIsTurnoMenuOpen] = useState(false);
  const [isStationMenuOpen, setIsStationMenuOpen] = useState(false);
  const [isRegionalMenuOpen, setIsRegionalMenuOpen] = useState(false);
  const [isFiltersCollapsed, setIsFiltersCollapsed] = useState(false);
  const [stationSearchText, setStationSearchText] = useState('');

  const turnoMenuRef = useRef(null);
  const stationMenuRef = useRef(null);
  const regionalMenuRef = useRef(null);
  const menuCategoriesRef = useRef(null);

  const [activeCategory, setActiveCategory] = useState('resumo');

  useEffect(() => {
    function handleClickOutside(event) {
      if (turnoMenuRef.current && !turnoMenuRef.current.contains(event.target)) setIsTurnoMenuOpen(false);
      if (stationMenuRef.current && !stationMenuRef.current.contains(event.target)) setIsStationMenuOpen(false);
      if (regionalMenuRef.current && !regionalMenuRef.current.contains(event.target)) setIsRegionalMenuOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const menuElement = menuCategoriesRef.current;
    if (!menuElement) return;
    const handleWheel = (e) => {
      if (e.deltaY !== 0) {
        e.preventDefault(); 
        menuElement.scrollLeft += e.deltaY * 1.5; 
      }
    };
    menuElement.addEventListener('wheel', handleWheel, { passive: false });
    return () => menuElement.removeEventListener('wheel', handleWheel);
  }, [loading]); 

  // 🔥 MOTOR DE CARREGAMENTO INTELIGENTE (OTIMIZADO)
  useEffect(() => {
    const carregarDadosEssenciais = async () => {
      setLoading(true);
      try {
        const regEscolhida = localStorage.getItem("selectedRegional");
        const hubsPermitidos = getHubsPermitidos(regEscolhida);

        setLoadingProgress("Buscando Base de Planejamento...");
        const [dataConsol, dataBase] = await Promise.all([
          getConsolidadoData(),
          getBaseReferenceData()
        ]);

        let dadosConsolBrutos = [];
        if (dataConsol && dataConsol.length > 1) {
          dadosConsolBrutos = dataConsol.slice(1).filter(r => hubsPermitidos.includes(String(r[4]).trim()));
          setRawData(dadosConsolBrutos);
        }
        
        if (dataBase && dataBase.length > 1) {
            setBaseData([dataBase[0]].concat(dataBase.slice(1).filter(r => hubsPermitidos.includes(String(r[0]).trim()))));
        }

        setLoadingProgress("Buscando KPI's Secundários...");
        // Carregamento Sequenciado (para evitar pico de chamadas)
        const dataPiso = await getDadosAtPiso();
        if (dataPiso && dataPiso.length > 1) setAtPisoData(dataPiso);

        const dataFirstTrips = await getFirstTripsData();
        if (dataFirstTrips && dataFirstTrips.length > 1) {
            setFirstTripsData([dataFirstTrips[0]].concat(dataFirstTrips.slice(1).filter(r => hubsPermitidos.includes(String(r[2]).trim()))));
        }

        const dataHistoricoFrota = await getHistoricoFrotaData();
        if (dataHistoricoFrota && dataHistoricoFrota.length > 1) {
            setHistoricoFrotaData([dataHistoricoFrota[0]].concat(dataHistoricoFrota.slice(1).filter(r => hubsPermitidos.includes(String(r[3]).trim()))));
        }

        const dataCluster = await getAtPisoClusterData();
        if (dataCluster && dataCluster.length > 1) {
            setAtPisoClusterData([dataCluster[0]].concat(dataCluster.slice(1).filter(r => hubsPermitidos.includes(String(r[3]).trim()))));
        }

        // 🔥 RETIRAMOS A LÓGICA DE DADOS PESADOS E ABA "POR MÊS" DAQUI!
        // O Componente Visualizations fará o Lazy Load deles quando precisar.

      } catch (error) {
        console.error("Erro Crítico no Start do Dashboard", error);
      } finally {
        setLoading(false);
      }
    };
    
    carregarDadosEssenciais();
  }, []); 

  const parseDate = (dateStr) => {
    if (!dateStr) return null;
    if (String(dateStr).includes('/')) {
      const [dia, mes, ano] = dateStr.split(' ')[0].split('/');
      return new Date(`${ano}-${mes}-${dia}T12:00:00`);
    }
    return new Date(dateStr);
  };

  const CATEGORIAS = [
    { id: 'resumo', label: 'Resumo (Overview)', icon: <LayoutDashboard size={16}/> },
    { id: 'onePage', label: 'One Page', icon: <Zap size={16}/> },
    { id: 'frota', label: 'Gestão de Frota', icon: <Users size={16}/> },
    { id: 'saude', label: 'Saúde de Frota', icon: <Activity size={16}/> },
    { id: 'estudosCluster', label: 'Estudos de Cluster', icon: <Layers size={16}/> },
    { id: 'capacidade', label: 'Estudos de Capacidade', icon: <PieChart size={16}/> },
    { id: 'volumes', label: 'Volumes & SPR', icon: <BarChart3 size={16}/> },
    { id: 'gargalos', label: 'Gargalos & CAP', icon: <AlertCircle size={16}/> },
    { id: 'pacotes', label: 'Pacotes e Realocação', icon: <Package size={16}/> },
    { id: 'tempo', label: 'Tempo de Expedição', icon: <Clock size={16}/> },
    { id: 'rodizio', label: 'Rodízio', icon: <CalendarDays size={16}/> },
    { id: 'ocorrencias', label: 'Logbook (Relatos)', icon: <MessageSquareWarning size={16}/> },
  ];

  const opcoes = useMemo(() => {
    const regionais = new Set(), stations = new Set(), semanas = new Set(), turnos = new Set();
    rawData.forEach(row => {
      const st = String(row[4]).trim();
      const regionalForcada = MAPA_REGIONAL_COMPLETO[st] || row[1];
      if (regionalForcada) regionais.add(regionalForcada);
      if (row[2]) semanas.add(row[2]);  
      if (st) stations.add(st);  
      if (row[5]) turnos.add(row[5]);    
    });
    return {
      regionais: Array.from(regionais).sort(),
      stations: Array.from(stations).sort(),
      semanas: Array.from(semanas).sort(),
      turnos: Array.from(turnos).sort()
    };
  }, [rawData]);

  const handleChange = (e) => setFiltros(prev => ({ ...prev, [e.target.name]: e.target.value }));
 
  const toggleArrayFilter = (filtroNome, valor) => {
    setFiltros(prev => {
      const itensAtuais = prev[filtroNome];
      if (itensAtuais.includes(valor)) return { ...prev, [filtroNome]: itensAtuais.filter(item => item !== valor) };
      return { ...prev, [filtroNome]: [...itensAtuais, valor] };
    });
  };

  const limparFiltros = () => setFiltros({ regional: [], station: [], turno: [], dataInicio: '', dataFim: '', semana: '', mes: '' });

  const dadosFiltrados = useMemo(() => {
    return rawData.filter(row => {
      const dataRow = row[3];
      const dObj = parseDate(dataRow);
      let pass = true;
      const st = String(row[4]).trim();
      const regionalForcada = MAPA_REGIONAL_COMPLETO[st] || row[1];
      if (filtros.regional.length > 0 && !filtros.regional.includes(regionalForcada)) pass = false;
      if (filtros.station.length > 0 && !filtros.station.includes(st)) pass = false;
      if (filtros.turno.length > 0 && !filtros.turno.includes(row[5])) pass = false;
      if (filtros.semana && row[2] !== filtros.semana) pass = false;
      if (dObj && !isNaN(dObj)) {
        if (filtros.mes && String(dObj.getMonth() + 1).padStart(2, '0') !== filtros.mes) pass = false;
        if (filtros.dataInicio || filtros.dataFim) {
          const start = filtros.dataInicio ? new Date(filtros.dataInicio + 'T00:00:00') : null;
          const end = filtros.dataFim ? new Date(filtros.dataFim + 'T23:59:59') : null;
          if (start && dObj < start) pass = false;
          if (end && dObj > end) pass = false;
        }
      }
      return pass;
    });
  }, [rawData, filtros]);

  const exportarCSV = () => { /* mantém sua função nativa */ };
  const exportarPDF = () => { window.print(); };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center flex-col gap-4">
        <div className="w-12 h-12 border-4 border-[#EE4D2D] border-t-transparent rounded-full animate-spin"></div>
        <p className="text-slate-500 font-bold animate-pulse">{loadingProgress}</p>
      </div>
    );
  }

  const getDropdownLabel = (arr, emptyLabel) => {
    if (arr.length === 0) return emptyLabel;
    if (arr.length === 1) return arr[0];
    return `${arr.length} selecionados`;
  };

  return (
    <div className="flex flex-col h-full space-y-6 print:space-y-0 print:block">
      {activeCategory !== 'capacidade' && 'estudosCluster' && (
        <div className="relative bg-white dark:bg-[#1f232d] rounded-2xl shadow-sm border border-slate-200 dark:border-gray-800 p-6 shrink-0 print:hidden">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
            <div>
              <h2 className="text-2xl font-black uppercase tracking-tight text-[#113366] dark:text-white">Dashboard de KPIs</h2>
              <p className="text-sm text-slate-500 dark:text-gray-400 mt-1">Visão Executiva: {dadosFiltrados.length} registros analisados.</p>
            </div>          
            <div className="flex items-center gap-2 flex-wrap">
              <button onClick={exportarCSV} className="flex items-center gap-2 bg-slate-100 dark:bg-gray-800 hover:bg-slate-200 dark:hover:bg-gray-700 text-slate-700 dark:text-gray-200 px-4 py-2 rounded-xl text-sm font-bold transition-colors">
                <Download size={16}/> Baixar CSV
              </button>
              <button onClick={exportarPDF} className="flex items-center gap-2 bg-slate-100 dark:bg-gray-800 hover:bg-slate-200 dark:hover:bg-gray-700 text-slate-700 dark:text-gray-200 px-4 py-2 rounded-xl text-sm font-bold transition-colors">
                <Printer size={16}/> Salvar PDF
              </button>
              <button onClick={limparFiltros} className="flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-[#EE4D2D] transition-colors ml-2">
                <Eraser size={16} /> Limpar Filtros
              </button>
              <button
                type="button"
                onClick={() => setIsFiltersCollapsed(prev => !prev)}
                className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-600 transition-colors hover:border-[#EE4D2D] hover:text-[#EE4D2D] dark:border-gray-700 dark:bg-[#1f232d] dark:text-gray-200"
              >
                <span>{isFiltersCollapsed ? 'Expandir filtros' : 'Recolher filtros'}</span>
                <ChevronDown size={16} className={`transition-transform ${isFiltersCollapsed ? 'rotate-180' : ''}`} />
              </button>
            </div>
          </div>

          {!isFiltersCollapsed && (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3 bg-slate-50 dark:bg-[#15171e] p-4 rounded-xl border border-slate-100 dark:border-gray-800">
             <div className="flex flex-col lg:col-span-1 relative" ref={regionalMenuRef}>
            <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 flex items-center gap-1"><MapPin size={12}/> Regional</label>
            <div
              className="bg-white dark:bg-[#1f232d] dark:text-white border border-slate-200 dark:border-gray-700 rounded-lg p-2 text-sm cursor-pointer flex justify-between items-center shadow-sm"
              onClick={() => setIsRegionalMenuOpen(!isRegionalMenuOpen)}
            >
              <span className="truncate mr-2 font-medium text-xs">{getDropdownLabel(filtros.regional, 'Todas')}</span>
              <ChevronDown size={14} className={`transition-transform text-slate-400 ${isRegionalMenuOpen ? 'rotate-180' : ''}`} />
            </div>
            {isRegionalMenuOpen && (
              <div className="absolute top-[100%] left-0 w-full mt-1 bg-white dark:bg-[#1f232d] border border-slate-200 dark:border-gray-700 rounded-lg shadow-xl z-50 max-h-48 overflow-y-auto py-1">
                {opcoes.regionais.map(r => (
                  <label key={r} className="flex items-center gap-3 px-3 py-2 hover:bg-slate-50 dark:hover:bg-gray-800 cursor-pointer text-xs font-medium text-slate-700 dark:text-gray-200 transition-colors">
                    <input
                      type="checkbox" checked={filtros.regional.includes(r)} onChange={() => toggleArrayFilter('regional', r)}
                      className="rounded border-slate-300 text-[#0055A5] focus:ring-[#0055A5] w-3 h-3 cursor-pointer"
                    /> {r}
                  </label>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-col lg:col-span-2 relative" ref={stationMenuRef}>
            <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 flex items-center gap-1"><Search size={12}/> Station</label>
            <div
              className="bg-white dark:bg-[#1f232d] dark:text-white border border-slate-200 dark:border-gray-700 rounded-lg p-2 text-sm cursor-pointer flex justify-between items-center shadow-sm"
              onClick={() => setIsStationMenuOpen(!isStationMenuOpen)}
            >
              <span className="truncate mr-2 font-medium text-xs">{getDropdownLabel(filtros.station, 'Todas as Stations')}</span>
              <ChevronDown size={14} className={`transition-transform text-slate-400 ${isStationMenuOpen ? 'rotate-180' : ''}`} />
            </div>
            {isStationMenuOpen && (
              <div className="absolute top-[100%] left-0 w-full mt-1 bg-white dark:bg-[#1f232d] border border-slate-200 dark:border-gray-700 rounded-lg shadow-xl z-50 overflow-hidden flex flex-col">
                <div className="p-2 border-b border-slate-100 dark:border-gray-800">
                  <input
                    type="text" placeholder="Buscar Station..." value={stationSearchText} onChange={(e) => setStationSearchText(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-gray-800 dark:text-white text-xs py-1.5 px-2 rounded border border-slate-200 dark:border-gray-700 outline-none"
                  />
                </div>
                <div className="max-h-48 overflow-y-auto py-1">
                  {opcoes.stations.filter(s => s.toLowerCase().includes(stationSearchText.toLowerCase())).map(s => (
                  <label key={s} className="flex items-center gap-3 px-3 py-2 hover:bg-slate-50 dark:hover:bg-gray-800 cursor-pointer text-xs font-medium text-slate-700 dark:text-gray-200 transition-colors">
                    <input
                      type="checkbox" checked={filtros.station.includes(s)} onChange={() => toggleArrayFilter('station', s)}
                      className="rounded border-slate-300 text-[#0055A5] focus:ring-[#0055A5] w-3 h-3 cursor-pointer"
                  /> {s}
                  </label>
                  ))}
                </div>
              </div>
            )}
          </div>
         
          <div className="flex flex-col lg:col-span-1 relative" ref={turnoMenuRef}>
            <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 flex items-center gap-1"><Clock size={12}/> Turnos</label>
            <div
              className="bg-white dark:bg-[#1f232d] dark:text-white border border-slate-200 dark:border-gray-700 rounded-lg p-2 text-sm cursor-pointer flex justify-between items-center shadow-sm"
              onClick={() => setIsTurnoMenuOpen(!isTurnoMenuOpen)}
            >
              <span className="truncate mr-2 font-medium text-xs">{getDropdownLabel(filtros.turno, 'Todos')}</span>
              <ChevronDown size={14} className={`transition-transform text-slate-400 ${isTurnoMenuOpen ? 'rotate-180' : ''}`} />
            </div>
            {isTurnoMenuOpen && (
              <div className="absolute top-[100%] left-0 w-full mt-1 bg-white dark:bg-[#1f232d] border border-slate-200 dark:border-gray-700 rounded-lg shadow-xl z-50 max-h-48 overflow-y-auto py-1">
                {opcoes.turnos.map(t => (
                  <label key={t} className="flex items-center gap-3 px-3 py-2 hover:bg-slate-50 dark:hover:bg-gray-800 cursor-pointer text-xs font-medium text-slate-700 dark:text-gray-200 transition-colors">
                    <input
                      type="checkbox" checked={filtros.turno.includes(t)} onChange={() => toggleArrayFilter('turno', t)}
                      className="rounded border-slate-300 text-[#0055A5] focus:ring-[#0055A5] w-3 h-3 cursor-pointer"
                    /> {t}
                  </label>
                ))}
              </div>
            )}
          </div>
         
          <div className="flex flex-col lg:col-span-2">
            <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 flex items-center gap-1"><Hash size={12}/> Semana / Mês</label>
            <div className="flex gap-2">
              <select name="semana" value={filtros.semana} onChange={handleChange} className="w-1/2 bg-white dark:bg-[#1f232d] dark:text-white border border-slate-200 dark:border-gray-700 rounded-lg p-2 text-xs font-medium"><option value="">Semana</option>{opcoes.semanas.map(o => <option key={o} value={o}>{o}</option>)}</select>
              <select name="mes" value={filtros.mes} onChange={handleChange} className="w-1/2 bg-white dark:bg-[#1f232d] dark:text-white border border-slate-200 dark:border-gray-700 rounded-lg p-2 text-xs font-medium"><option value="">Mês</option>{MESES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
            </div>
          </div>

          <div className="flex flex-col lg:col-span-1"><label className="text-[10px] font-bold text-slate-400 uppercase mb-1 flex items-center gap-1"><CalendarDays size={12}/> Início</label><input type="date" name="dataInicio" value={filtros.dataInicio} onChange={handleChange} className="bg-white dark:bg-[#1f232d] dark:text-white border border-slate-200 dark:border-gray-700 rounded-lg p-1.5 text-xs font-medium" /></div>
          <div className="flex flex-col lg:col-span-1"><label className="text-[10px] font-bold text-slate-400 uppercase mb-1 flex items-center gap-1"><CalendarDays size={12}/> Fim</label><input type="date" name="dataFim" value={filtros.dataFim} onChange={handleChange} className="bg-white dark:bg-[#1f232d] dark:text-white border border-slate-200 dark:border-gray-700 rounded-lg p-1.5 text-xs font-medium" /></div>
          </div>
          )}
        </div>
      )}

      {/* 💡 MENU DE CATEGORIAS */}
      <div ref={menuCategoriesRef} className="flex bg-white dark:bg-[#1f232d] p-1.5 rounded-2xl shadow-sm border border-slate-200 dark:border-gray-800 overflow-x-auto custom-scrollbar shrink-0 print:hidden">
        {CATEGORIAS.map((cat) => (
          <button key={cat.id} onClick={() => setActiveCategory(cat.id)} className={`flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-black uppercase transition-all whitespace-nowrap ${activeCategory === cat.id ? 'bg-[#113366] text-white shadow-md' : 'text-slate-500 dark:text-gray-400 hover:bg-slate-50 dark:hover:bg-gray-800 hover:text-[#EE4D2D]'}`}>
            {cat.icon} {cat.label}
          </button>
        ))}
      </div>

      {/* CONTEÚDO DOS DASHBOARDS */}
      <div className="flex-1 overflow-y-auto print:overflow-visible">
        <Visualizations activeCategory={activeCategory} data={dadosFiltrados} rawData={rawData} dashData={dashData} atPisoData={atPisoData} atPisoClusterData={atPisoClusterData} baseData={baseData} firstTripsData={firstTripsData} historicoFrotaData={historicoFrotaData} ofertasModalData={ofertasModalData} filtrosGlobais={filtros} />
      </div>
    </div>
  );
}