import React, { useState, useEffect, useMemo } from 'react';
import { getConsolidadoData } from '../api/googleSheets';
import { getHubsPermitidos } from '../constants/regionais';
import { 
  Loader2, Truck, Package, Users, Calculator, 
  RotateCcw, Download, Printer, ShieldCheck,
  Layers, HelpCircle, TrendingUp, Sliders, ChevronDown, ChevronUp
} from 'lucide-react';

export default function PlanejamentoRotasPage() {
  const [loading, setLoading] = useState(true);
  const [rawData, setRawData] = useState([]);
  const [station, setStation] = useState('');

  // --------------------------------------------------------------------------
  // ESTADOS DO SIMULADOR (ACEITAM STRING VAZIA PARA EVITAR '087')
  // --------------------------------------------------------------------------
  const [modoPlanejamento, setModoPlanejamento] = useState('PACOTES');
  const [pacotesPrevistos, setPacotesPrevistos] = useState(''); 
  const [rotasPlanejadas, setRotasPlanejadas] = useState('');
  const [driversDisponiveis, setDriversDisponiveis] = useState('');
  const [sprPlanejado, setSprPlanejado] = useState(95); 
  const [margemSeguranca, setMargemSeguranca] = useState(20); 

  // DETALHAMENTO POR MODAL
  const [usarModais, setUsarModais] = useState(false);
  const [modaisData, setModaisData] = useState({
    MOTO: { disponivel: '', spr: 80 },
    PASSEIO: { disponivel: '', spr: 100 },
    FIORINO: { disponivel: '', spr: 120 },
    VAN: { disponivel: '', spr: 120 },
  });

  // Carregamento inicial otimizado
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const regEscolhida = localStorage.getItem("selectedRegional");
        const hubsPermitidos = getHubsPermitidos(regEscolhida) || [];

        const dataConsol = await getConsolidadoData();

        if (dataConsol && dataConsol.length > 1) {
          const filtrados = dataConsol.slice(1).filter(r => hubsPermitidos.length === 0 || hubsPermitidos.includes(String(r[4]).trim()));
          setRawData([dataConsol[0], ...filtrados]); 
        }
      } catch (error) {
        console.error("Erro ao carregar dados do Planejamento", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const hubsDisponiveis = useMemo(() => {
    if (rawData.length <= 1) return [];
    const hubs = new Set();
    const len = rawData.length;
    for (let i = 1; i < len; i++) {
      if (rawData[i][4]) hubs.add(String(rawData[i][4]).trim());
    }
    return Array.from(hubs).sort();
  }, [rawData]);

  useEffect(() => {
    if (hubsDisponiveis.length > 0 && !station) {
      setStation(hubsDisponiveis[0]);
    }
  }, [hubsDisponiveis, station]);

  // Histórico do Hub
  const sugestaoHistorica = useMemo(() => {
    if (!station || rawData.length <= 1) return { rotasMedias: 0, driversMedios: 0 };
    
    let totalRotas = 0;
    let totalDispo = 0;
    let diasCount = 0;
    const len = rawData.length;

    for (let i = 1; i < len; i++) {
      const r = rawData[i];
      if (String(r[4]).trim() === station) {
        const dispo = Number(r[24]) || 0;
        const expedidas = Number(r[25]) || Number(r[5]) || 0;
        if (dispo > 0 || expedidas > 0) {
          totalDispo += dispo;
          totalRotas += expedidas;
          diasCount++;
        }
      }
    }

    const dCount = Math.max(1, diasCount);
    return {
      rotasMedias: Math.round(totalRotas / dCount),
      driversMedios: Math.round(totalDispo / dCount),
    };
  }, [station, rawData]);

  // Carga inicial dos dados do Hub
  useEffect(() => {
    if (sugestaoHistorica.rotasMedias > 0) {
      const rotas = sugestaoHistorica.rotasMedias;
      const drivers = sugestaoHistorica.driversMedios;
      const spr = Number(sprPlanejado) || 95;
      const pacotes = rotas * spr;

      setRotasPlanejadas(rotas);
      setDriversDisponiveis(drivers);
      setPacotesPrevistos(pacotes);
    }
  }, [sugestaoHistorica]);

  // --------------------------------------------------------------------------
  // CÁLCULO DO SPR MÉDIO POR MODAL
  // --------------------------------------------------------------------------
  const calculosModais = useMemo(() => {
    let somaPonderada = 0;
    let totalDriversModais = 0;
    let somaSprValidos = 0;
    let countSprValidos = 0;

    Object.entries(modaisData).forEach(([key, modal]) => {
      const spr = Number(modal.spr) || 0;
      const disp = Number(modal.disponivel) || 0;

      if (spr > 0) {
        somaSprValidos += spr;
        countSprValidos += 1;

        if (disp > 0) {
          somaPonderada += disp * spr;
          totalDriversModais += disp;
        }
      }
    });

    let sprMedioResultante = 0;
    if (totalDriversModais > 0) {
      sprMedioResultante = Math.round(somaPonderada / totalDriversModais);
    } else if (countSprValidos > 0) {
      sprMedioResultante = Math.round(somaSprValidos / countSprValidos);
    }

    return {
      sprMedio: sprMedioResultante,
      totalDriversModais,
      hasDriversModais: totalDriversModais > 0,
      hasValidsSprs: countSprValidos > 0
    };
  }, [modaisData]);

  // SPR dinâmico ativo
  const sprAtivo = useMemo(() => {
    if (usarModais && calculosModais.sprMedio > 0) {
      return calculosModais.sprMedio;
    }
    return Math.max(1, Number(sprPlanejado) || 1);
  }, [usarModais, calculosModais.sprMedio, sprPlanejado]);

  // Drivers dinâmicos ativos
  const driversAtivos = useMemo(() => {
    if (usarModais && calculosModais.hasDriversModais) {
      return calculosModais.totalDriversModais;
    }
    return Number(driversDisponiveis) || 0;
  }, [usarModais, calculosModais, driversDisponiveis]);

  // --------------------------------------------------------------------------
  // HANDLERS TRATANDO APAGAMENTO (BACKSPACE) SEM GERAR '087'
  // --------------------------------------------------------------------------

  // 1. Alteração nos Pacotes
  const handlePacotesChange = (val) => {
    if (val === '') {
      setPacotesPrevistos('');
      return;
    }
    const p = Math.max(0, Number(val) || 0);
    setPacotesPrevistos(p);

    if (sprAtivo > 0) {
      const r = Math.ceil(p / sprAtivo);
      setRotasPlanejadas(r);
    }
  };

  // 2. Alteração no SPR
  const handleSprChange = (val) => {
    if (val === '') {
      setSprPlanejado('');
      return;
    }
    const spr = Math.max(1, Number(val) || 1);
    setSprPlanejado(spr);

    const pac = Number(pacotesPrevistos) || 0;
    if (pac > 0) {
      const r = Math.ceil(pac / spr);
      setRotasPlanejadas(r);
    }
  };

  // 3. Alteração nas Rotas
  const handleRotasChange = (val) => {
    if (val === '') {
      setRotasPlanejadas('');
      return;
    }
    const r = Math.max(0, Number(val) || 0);
    setRotasPlanejadas(r);

    const pac = Number(pacotesPrevistos) || 0;
    if (r > 0 && pac > 0) {
      const novoSpr = Math.round(pac / r);
      setSprPlanejado(novoSpr);
    }
  };

  // 4. Alteração nos Drivers
  const handleDriversChange = (val) => {
    if (val === '') {
      setDriversDisponiveis('');
      return;
    }
    const d = Math.max(0, Number(val) || 0);
    setDriversDisponiveis(d);

    const marg = Math.max(0, Number(margemSeguranca) || 0) / 100;
    const rotasPossiveis = Math.floor(d / (1 + marg));
    const r = Math.max(1, rotasPossiveis);
    setRotasPlanejadas(r);

    const pac = Number(pacotesPrevistos) || 0;
    if (r > 0 && pac > 0) {
      const novoSpr = Math.round(pac / r);
      setSprPlanejado(novoSpr);
    }
  };

  // 5. Alteração da Margem
  const handleMargemChange = (val) => {
    if (val === '') {
      setMargemSeguranca('');
      return;
    }
    const marg = Math.max(0, Number(val) || 0);
    setMargemSeguranca(marg);

    if (modoPlanejamento === 'DRIVERS') {
      handleDriversChange(driversAtivos);
    }
  };

  // 6. Seleção de Modos de Guia
  const handleModoSelect = (novoModo) => {
    setModoPlanejamento(novoModo);
    if (novoModo === 'DRIVERS') {
      handleDriversChange(driversAtivos);
    }
  };

  // 7. Edição de Modais
  const handleModalChange = (modalKey, field, value) => {
    const val = value === '' ? '' : Math.max(0, Number(value) || 0);
    setModaisData(prev => ({
      ...prev,
      [modalKey]: {
        ...prev[modalKey],
        [field]: val
      }
    }));
  };

  useEffect(() => {
    const pac = Number(pacotesPrevistos) || 0;
    if (usarModais && calculosModais.sprMedio > 0 && pac > 0) {
      const r = Math.ceil(pac / calculosModais.sprMedio);
      setRotasPlanejadas(r);
    }
  }, [usarModais, calculosModais.sprMedio]);

  // --------------------------------------------------------------------------
  // CÁLCULOS FINAIS DO SIMULADOR
  // --------------------------------------------------------------------------
  const calculos = useMemo(() => {
    const spr = sprAtivo;
    const marg = Math.max(0, Number(margemSeguranca) || 0) / 100; 

    const rotasEfetivas = Number(rotasPlanejadas) || 0;
    const pacotesTotais = Number(pacotesPrevistos) || 0;
    const driversInformados = Number(driversAtivos) || 0;

    const driversNecessarios = Math.ceil(rotasEfetivas * (1 + marg));
    const reservaMotoristasPresentes = Math.max(0, driversNecessarios - rotasEfetivas);

    const saldoFrota = driversInformados - driversNecessarios;
    const reforcoNecessario = Math.max(0, driversNecessarios - driversInformados);
    const percReforcoSobreBase = driversInformados > 0 ? ((reforcoNecessario / driversInformados) * 100).toFixed(1) : 0;
    const capacidadePacotesTotal = driversNecessarios * spr;

    return {
      rotasEfetivas, pacotesTotais, driversInformados,
      driversNecessarios, saldoFrota, reforcoNecessario, percReforcoSobreBase,
      reservaMotoristasPresentes, capacidadePacotesTotal, spr
    };
  }, [rotasPlanejadas, pacotesPrevistos, driversAtivos, sprAtivo, margemSeguranca]);

  const handleZerarCampos = () => {
    setRotasPlanejadas('');
    setPacotesPrevistos('');
    setDriversDisponiveis('');
    setSprPlanejado(95);
    setMargemSeguranca(20);
    setUsarModais(false);
    setModaisData({
      MOTO: { disponivel: '', spr: 80 },
      PASSEIO: { disponivel: '', spr: 100 },
      FIORINO: { disponivel: '', spr: 120 },
      VAN: { disponivel: '', spr: 120 },
    });
  };

  const handleExportCSV = () => {
    const csvContent = [
      ["Estacao", "Modo", "Usou Modais", "Rotas Planejadas", "Pacotes Previstos", "SPR Utilizado", "Drivers Disponiveis", "Margem Segurança %", "Drivers Necessarios", "Reforco Necessario"],
      [station, modoPlanejamento, usarModais ? "SIM" : "NAO", calculos.rotasEfetivas, calculos.pacotesTotais, calculos.spr, calculos.driversInformados, margemSeguranca, calculos.driversNecessarios, calculos.reforcoNecessario]
    ].map(e => e.join(",")).join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `Planejamento_Rotas_${station}_${new Date().toISOString().slice(0,10)}.csv`;
    link.click();
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center flex-col gap-4 min-h-[400px]">
        <Loader2 className="w-12 h-12 animate-spin text-[#EE4D2D]" />
        <p className="text-[#113366] dark:text-white font-bold uppercase tracking-widest text-sm">
          Preparando página de Planejamento
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full text-slate-800 dark:text-slate-100 min-h-screen p-6">
      
      {/* CABEÇALHO */}
      <div className="bg-white dark:bg-[#1f232d] rounded-2xl shadow-sm border border-slate-200 dark:border-gray-800 p-6 mb-6">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div>
            <div className="flex items-center gap-3">
              <Calculator className="text-[#B22222] shrink-0" size={28} />
              <h1 className="text-xl md:text-2xl font-black text-[#113366] dark:text-white uppercase tracking-tight">
                PLANEJAMENTO DE EXPEDIÇÃO
              </h1>
            </div>
            <p className="text-xs text-slate-500 font-bold mt-1 ml-[40px]">
              Simulando parâmetros e capacidade operacional para <span className="text-[#EE4D2D]">{station || 'nenhum hub selecionado'}</span>
            </p>
          </div>

          <div className="flex items-center gap-3 w-full lg:w-auto flex-wrap">
            <button
              onClick={handleZerarCampos}
              className="flex items-center justify-center gap-2 bg-slate-100 dark:bg-gray-800 text-[#113366] dark:text-slate-300 text-sm font-bold py-2 px-4 rounded border border-slate-200 dark:border-gray-700 hover:bg-slate-200 transition-colors"
            >
              <RotateCcw size={16} /> Zerar Campos
            </button>
            <button
              onClick={handleExportCSV}
              className="flex items-center justify-center gap-2 bg-[#B22222] text-white text-sm font-bold py-2 px-4 rounded hover:bg-red-800 transition-colors shadow-sm"
            >
              <Download size={16} /> Exportar Cenário
            </button>
            <button
              onClick={() => window.print()}
              className="flex items-center justify-center gap-2 bg-slate-800 dark:bg-gray-700 text-white text-sm font-bold py-2 px-4 rounded hover:bg-slate-700 transition-colors shadow-sm"
            >
              <Printer size={16} /> Imprimir PDF
            </button>
          </div>
        </div>

        {/* BARRA DE FILTROS */}
        <div className="mt-6 pt-4 border-t border-slate-100 dark:border-gray-800 flex items-center gap-4">
          <div className="flex flex-col gap-1 w-full max-w-[300px]">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">STATION / HUB</label>
            <select
              value={station}
              onChange={(e) => setStation(e.target.value)}
              className="w-full bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-lg p-2 text-xs font-bold text-slate-700 dark:text-white outline-none cursor-pointer uppercase shadow-sm"
            >
              {hubsDisponiveis.map(h => <option key={h} value={h}>{h}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1 w-full max-w-[200px]">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">SPR BASE</label>
            <div className="w-full bg-slate-50 dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-lg p-2 text-xs font-bold text-slate-500 cursor-not-allowed">
              {sugestaoHistorica.rotasMedias > 0 ? 'Carregado do Histórico' : 'Aguardando...'}
            </div>
          </div>
        </div>
      </div>

      {/* GUIA DE DIMENSIONAMENTO */}
      <div className="bg-white dark:bg-[#1f232d] p-4 rounded-2xl border border-slate-200 dark:border-gray-800 shadow-sm mb-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-xs font-black text-[#113366] dark:text-white uppercase tracking-wider flex items-center gap-2">
              <Layers size={16} className="text-[#EE4D2D]" /> Guia Principal de Dimensionamento:
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium mt-0.5">
              Escolha qual variável vai ancorar e guiar o cálculo matemático da operação.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2 w-full sm:w-auto">
            <button
              onClick={() => handleModoSelect('PACOTES')}
              className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black uppercase transition-all ${
                modoPlanejamento === 'PACOTES' ? 'bg-[#EE4D2D] text-white shadow-md' : 'bg-slate-100 dark:bg-gray-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              <Package size={14} /> 1. Pacotes
            </button>
            <button
              onClick={() => handleModoSelect('ROTAS')}
              className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black uppercase transition-all ${
                modoPlanejamento === 'ROTAS' ? 'bg-[#EE4D2D] text-white shadow-md' : 'bg-slate-100 dark:bg-gray-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              <Truck size={14} /> 2. Rotas
            </button>
            <button
              onClick={() => handleModoSelect('DRIVERS')}
              className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black uppercase transition-all ${
                modoPlanejamento === 'DRIVERS' ? 'bg-[#EE4D2D] text-white shadow-md' : 'bg-slate-100 dark:bg-gray-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              <Users size={14} /> 3. Drivers
            </button>
          </div>
        </div>
      </div>

      {/* GRID PRINCIPAL */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">

        {/* PARÂMETROS ATIVOS (lg:col-span-4) */}
        <div className="lg:col-span-4 bg-white dark:bg-[#1f232d] p-5 rounded-2xl border border-slate-200 dark:border-gray-800 shadow-sm flex flex-col gap-4">
          <div className="border-b border-slate-100 dark:border-gray-800 pb-3">
            <h2 className="text-sm font-black text-[#113366] dark:text-white uppercase tracking-wide">PARÂMETROS ATIVOS</h2>
          </div>

          {/* PACOTES (ÂNCORA IMUTÁVEL) */}
          <div className="p-3 rounded-xl border border-[#EE4D2D] bg-orange-50/60 dark:bg-orange-950/20 shadow-sm">
            <div className="flex justify-between items-center mb-1">
              <label className="block text-xs font-black text-slate-700 dark:text-slate-200 uppercase">
                Pacotes previstos (Carga Base)
              </label>
              <span className="text-[9px] font-black bg-[#EE4D2D] text-white px-1.5 py-0.5 rounded">
                Âncora
              </span>
            </div>
            <input 
              type="number" 
              min="0" 
              placeholder="0"
              value={pacotesPrevistos} 
              onChange={(e) => handlePacotesChange(e.target.value)} 
              className="w-full bg-white dark:bg-gray-800 border border-slate-300 dark:border-gray-600 rounded-lg p-2 text-sm font-bold text-slate-800 dark:text-white outline-none focus:border-[#EE4D2D]" 
            />
          </div>

          {/* ROTAS PLANEJADAS */}
          <div className={`p-3 rounded-xl border transition-all ${modoPlanejamento === 'ROTAS' ? 'bg-orange-50/30 border-[#EE4D2D]' : 'border-slate-200 dark:border-gray-700'}`}>
            <label className="block text-xs font-black text-slate-700 dark:text-slate-200 uppercase mb-1">
              Rotas planejadas
            </label>
            <input 
              type="number" 
              min="0" 
              placeholder="0"
              value={rotasPlanejadas} 
              onChange={(e) => handleRotasChange(e.target.value)} 
              className="w-full bg-white dark:bg-gray-800 border border-slate-300 dark:border-gray-600 rounded-lg p-2 text-sm font-bold text-slate-800 dark:text-white outline-none focus:border-[#EE4D2D]" 
            />
            <div className="flex justify-between items-center mt-1.5">
              <span className="text-[10px] text-slate-500 font-semibold">Média: {sugestaoHistorica.rotasMedias} rotas</span>
              <button onClick={() => { handleRotasChange(sugestaoHistorica.rotasMedias); handleModoSelect('ROTAS'); }} className="text-[10px] font-black text-[#EE4D2D] hover:underline">Restaurar base</button>
            </div>
          </div>

          {/* DRIVERS DISPONÍVEIS */}
          <div className={`p-3 rounded-xl border transition-all ${modoPlanejamento === 'DRIVERS' ? 'bg-orange-50/30 border-[#EE4D2D]' : 'border-slate-200 dark:border-gray-700'}`}>
            <label className="block text-xs font-black text-slate-700 dark:text-slate-200 uppercase mb-1">
              Drivers disponíveis {usarModais && calculosModais.hasDriversModais && <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400">(Soma Modais)</span>}
            </label>
            <input 
              type="number" 
              min="0" 
              placeholder="0"
              value={usarModais && calculosModais.hasDriversModais ? calculosModais.totalDriversModais : driversDisponiveis} 
              onChange={(e) => handleDriversChange(e.target.value)} 
              disabled={usarModais && calculosModais.hasDriversModais}
              className="w-full bg-white dark:bg-gray-800 border border-slate-300 dark:border-gray-600 rounded-lg p-2 text-sm font-bold text-slate-800 dark:text-white outline-none focus:border-[#EE4D2D] disabled:opacity-75" 
            />
            <div className="flex justify-between items-center mt-1.5">
              <span className="text-[10px] text-slate-500 font-semibold">Oferta média: {sugestaoHistorica.driversMedios} drivers</span>
            </div>
          </div>

          {/* DETALHAMENTO POR MODAL */}
          <div className="p-3 rounded-xl border border-indigo-200 dark:border-indigo-900/50 bg-indigo-50/30 dark:bg-indigo-950/20 transition-all">
            <div 
              className="flex justify-between items-center cursor-pointer select-none"
              onClick={() => setUsarModais(!usarModais)}
            >
              <div className="flex items-center gap-2">
                <Sliders size={16} className="text-indigo-600 dark:text-indigo-400" />
                <span className="text-xs font-black text-indigo-900 dark:text-indigo-300 uppercase">
                  Detalhamento por Modal
                </span>
              </div>
              <div className="flex items-center gap-2">
                {usarModais && calculosModais.sprMedio > 0 && (
                  <span className="text-[10px] font-black bg-indigo-200 dark:bg-indigo-800 text-indigo-900 dark:text-indigo-100 px-2 py-0.5 rounded shadow-sm">
                    SPR Médio: {calculosModais.sprMedio}
                  </span>
                )}
                <button className="text-xs font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1 hover:underline">
                  {usarModais ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>
              </div>
            </div>

            {usarModais && (
              <div className="mt-3 pt-3 border-t border-indigo-200/60 dark:border-indigo-900/40 space-y-2.5">
                <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                  Preencha os drivers e edite o SPR individual. Se o SPR for <strong>0</strong>, o modal é desconsiderado.
                </p>
                
                <div className="grid grid-cols-12 gap-1 text-[10px] font-black uppercase text-slate-400 px-1">
                  <span className="col-span-4">Modal</span>
                  <span className="col-span-4 text-center">Drivers</span>
                  <span className="col-span-4 text-center">SPR</span>
                </div>

                {Object.entries(modaisData).map(([modalKey, item]) => (
                  <div key={modalKey} className="grid grid-cols-12 gap-2 items-center bg-white dark:bg-gray-800 p-1.5 rounded-lg border border-slate-200 dark:border-gray-700 shadow-sm">
                    <span className="col-span-4 text-xs font-black text-slate-700 dark:text-slate-200 uppercase pl-1">
                      {modalKey}
                    </span>
                    <input
                      type="number"
                      min="0"
                      placeholder="0"
                      value={item.disponivel}
                      onChange={(e) => handleModalChange(modalKey, 'disponivel', e.target.value)}
                      className="col-span-4 bg-slate-50 dark:bg-gray-700 border border-slate-300 dark:border-gray-600 rounded p-1 text-xs font-bold text-center text-slate-800 dark:text-white outline-none focus:border-indigo-500"
                    />
                    <input
                      type="number"
                      min="0"
                      placeholder="0"
                      value={item.spr}
                      onChange={(e) => handleModalChange(modalKey, 'spr', e.target.value)}
                      className="col-span-4 bg-slate-50 dark:bg-gray-700 border border-slate-300 dark:border-gray-600 rounded p-1 text-xs font-bold text-center text-slate-800 dark:text-white outline-none focus:border-indigo-500"
                    />
                  </div>
                ))}

                <div className="p-2 bg-indigo-100/60 dark:bg-indigo-900/40 rounded-lg text-[10px] font-bold text-indigo-900 dark:text-indigo-200 flex justify-between items-center mt-2 border border-indigo-200/50">
                  <span>SPR Médio Ponderado:</span>
                  <span className="text-xs font-black text-indigo-700 dark:text-indigo-300">
                    {calculosModais.sprMedio > 0 ? `${calculosModais.sprMedio} pacotes/rota` : 'Sem SPR válido'}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* SPR PLANEJADO */}
          <div className={`p-3 rounded-xl border transition-all ${usarModais ? 'bg-indigo-50/20 border-indigo-300 dark:border-indigo-900/60' : 'border-slate-200 dark:border-gray-700'}`}>
            <div className="flex justify-between items-center mb-1">
              <label className="block text-xs font-black text-slate-700 dark:text-slate-200 uppercase">
                SPR Planejado
              </label>
              {usarModais && calculosModais.sprMedio > 0 && (
                <span className="text-[9px] font-black bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 px-1.5 py-0.5 rounded">
                  Modais Ativos
                </span>
              )}
            </div>
            <input 
              type="number" 
              min="1" 
              placeholder="0"
              value={sprAtivo} 
              onChange={(e) => handleSprChange(e.target.value)} 
              disabled={usarModais && calculosModais.sprMedio > 0}
              className="w-full bg-white dark:bg-gray-800 border border-slate-300 dark:border-gray-600 rounded-lg p-2 text-sm font-bold text-slate-800 dark:text-white outline-none focus:border-[#EE4D2D] disabled:opacity-75" 
            />
          </div>

          {/* MARGEM DE SEGURANÇA / RECUSA */}
          <div className="p-3 rounded-xl border border-emerald-200 dark:border-emerald-900/40 bg-emerald-50/40 dark:bg-emerald-950/10">
            <div className="flex justify-between items-center mb-1">
              <label className="text-xs font-black text-emerald-800 dark:text-emerald-300 uppercase flex items-center gap-1"><ShieldCheck size={14} /> Margem de Segurança (%)</label>
              <span className="text-[9px] font-black bg-emerald-200 dark:bg-emerald-800 text-emerald-900 dark:text-emerald-100 px-1.5 py-0.5 rounded">Padrão 20%</span>
            </div>
            <input 
              type="number" 
              min="0" 
              max="100" 
              placeholder="0"
              value={margemSeguranca} 
              onChange={(e) => handleMargemChange(e.target.value)} 
              className="w-full bg-white dark:bg-gray-800 border border-emerald-300 dark:border-emerald-700 rounded-lg p-2 text-sm font-bold text-slate-800 dark:text-white outline-none focus:border-emerald-500" 
            />
          </div>
        </div>

        {/* COLUNA DIREITA: RESULTADOS + BANNERS EXPLICATIVOS (lg:col-span-8) */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          
          {/* SAÍDA DO SIMULADOR */}
          <div className="bg-white dark:bg-[#1f232d] p-5 rounded-2xl border border-slate-200 dark:border-gray-800 shadow-sm">
            <div className="border-b border-slate-100 dark:border-gray-800 pb-3 mb-4">
              <h2 className="text-sm font-black text-[#113366] dark:text-white uppercase tracking-wide">RESULTADO</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-2xl bg-orange-50/80 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800/60 flex flex-col justify-between">
                <div>
                  <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">Disponibilidade Necessária</span>
                  <div className="text-3xl font-black text-[#EE4D2D] mt-1">{calculos.driversNecessarios}</div>
                </div>
                <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mt-3 pt-2 border-t border-orange-200/60 dark:border-orange-900/40">Para atender demanda + margem recusa.</p>
              </div>

              <div className={`p-4 rounded-2xl border flex flex-col justify-between ${calculos.reforcoNecessario > 0 ? 'bg-red-50/80 dark:bg-red-950/20 border-red-200 dark:border-red-900/60' : 'bg-emerald-50/80 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/60'}`}>
                <div>
                  <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">Motoristas Extras Necessários</span>
                  <div className={`text-3xl font-black mt-1 ${calculos.reforcoNecessario > 0 ? 'text-[#D0011B]' : 'text-emerald-600'}`}>{calculos.reforcoNecessario}</div>
                </div>
                <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mt-3 pt-2 border-t border-slate-200 dark:border-gray-800">{calculos.reforcoNecessario > 0 ? `Deficit detectado. Captar +${calculos.reforcoNecessario} drivers.` : `Saldo positivo na base (+${Math.abs(calculos.saldoFrota)}).`}</p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-gray-800/50 border border-slate-200 dark:border-gray-700 flex flex-col justify-between">
                <div>
                  <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">Reserva de Segurança (Piso)</span>
                  <div className="text-3xl font-black text-[#113366] dark:text-blue-400 mt-1">{calculos.reservaMotoristasPresentes}</div>
                </div>
                <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mt-3 pt-2 border-t border-slate-200 dark:border-gray-700">{calculos.rotasEfetivas} rotas + {calculos.reservaMotoristasPresentes} de folga ({margemSeguranca}%).</p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-gray-800/50 border border-slate-200 dark:border-gray-700 flex flex-col justify-between">
                <div>
                  <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">Volume Total (Escoado)</span>
                  <div className="text-2xl font-black text-slate-800 dark:text-white mt-1">{calculos.pacotesTotais.toLocaleString('pt-BR')}</div>
                </div>
                <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mt-2">{calculos.rotasEfetivas} rotas × SPR {calculos.spr}.</p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-gray-800/50 border border-slate-200 dark:border-gray-700 flex flex-col justify-between">
                <div>
                  <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">% Reforço (Oferta)</span>
                  <div className="text-2xl font-black text-slate-800 dark:text-white mt-1">{calculos.percReforcoSobreBase}%</div>
                </div>
                <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mt-2">Crescimento sobre a base de {calculos.driversInformados}.</p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-gray-800/50 border border-slate-200 dark:border-gray-700 flex flex-col justify-between">
                <div>
                  <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">Max Capacidade</span>
                  <div className="text-2xl font-black text-slate-800 dark:text-white mt-1">{calculos.capacidadePacotesTotal.toLocaleString('pt-BR')}</div>
                </div>
                <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mt-2">Volume teto com os {calculos.driversNecessarios} convocados.</p>
              </div>
            </div>

            <div className="mt-5 p-3 rounded-xl bg-slate-100 dark:bg-gray-800/80 border border-slate-200 dark:border-gray-700 text-xs font-medium text-slate-600 dark:text-slate-300">
              <strong>Resumo do cálculo:</strong> Para atender <strong>{calculos.rotasEfetivas} rotas</strong> com <strong>{margemSeguranca}% de margem de recusa</strong>, convoque <strong>{calculos.driversNecessarios} motoristas</strong> no total (sendo <strong>{calculos.reservaMotoristasPresentes} de reserva de segurança no piso</strong>).
            </div>
          </div>

          {/* BANNERS INFORMATIVOS */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white dark:bg-[#1f232d] p-5 rounded-2xl border border-slate-200 dark:border-gray-800 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 mb-3 text-[#113366] dark:text-blue-400 border-b border-slate-100 dark:border-gray-800 pb-3">
                  <HelpCircle size={20} className="text-[#EE4D2D]" />
                  <h3 className="text-sm font-black uppercase tracking-wide">Fórmulas Matemáticas</h3>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 mb-3">Dimensionamento direto sem tolerância a absenteísmo:</p>
                <div className="space-y-2 text-xs font-mono bg-slate-50 dark:bg-gray-800 p-3 rounded-xl border border-slate-200 dark:border-gray-700">
                  <p className="text-slate-800 dark:text-slate-200 font-bold">1. Disponibilidade = Rotas Planejadas × (1 + Margem Recusa)</p>
                  <p className="text-slate-800 dark:text-slate-200 font-bold">2. Reserva Piso = Disponibilidade - Rotas Planejadas</p>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-[#1f232d] p-5 rounded-2xl border border-slate-200 dark:border-gray-800 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 mb-3 text-[#113366] dark:text-blue-400 border-b border-slate-100 dark:border-gray-800 pb-3">
                  <TrendingUp size={20} className="text-[#EE4D2D]" />
                  <h3 className="text-sm font-black uppercase tracking-wide">Regras de Negócio</h3>
                </div>
                <div className="space-y-3 text-xs">
                  <div className="flex items-start gap-2">
                    <span className="bg-orange-100 dark:bg-orange-950 text-[#EE4D2D] font-black text-[10px] px-2 py-0.5 rounded shrink-0 mt-0.5">1. PACOTES</span>
                    <p className="text-slate-600 dark:text-slate-300"><strong>Por Carga:</strong> Carga fixa imutável. SPR e Rotas ajustam para escoar 100%.</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="bg-orange-100 dark:bg-orange-950 text-[#EE4D2D] font-black text-[10px] px-2 py-0.5 rounded shrink-0 mt-0.5">2. ROTAS</span>
                    <p className="text-slate-600 dark:text-slate-300"><strong>Por Grade:</strong> Ao alterar rotas, readequa o SPR exigido para a carga total.</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="bg-orange-100 dark:bg-orange-950 text-[#EE4D2D] font-black text-[10px] px-2 py-0.5 rounded shrink-0 mt-0.5">3. DRIVERS</span>
                    <p className="text-slate-600 dark:text-slate-300"><strong>Por Escassez:</strong> Com a frota atual, ajusta rotas e recalcula SPR necessário.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}