import React, { useState, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getConsolidadoData, updateRowData, insertRowData, deleteRowData, getBaseReferenceData, salvarNasOrigens } from '../api/googleSheets';
import { Search, ChevronLeft, ChevronRight, Plus, ChevronDown, ChevronUp, AlertTriangle, Eraser, LucideBarChartHorizontal } from 'lucide-react';
import FormSection from './FormSection';

const MAPA_REGIONAL = {
  "LM Hub_SP_Campinas_São Martinho": "SPI1", "LM Hub_SP_Leme": "SPI1", "LM Hub_SP_Limeira_Campo Belo": "SPI1",
  "LM Hub_SP_Mogi Mirim": "SPI1", "LM Hub_SP_Piracicaba": "SPI1", "LM Hub_SP_Sumaré_Nova Veneza": "SPI1",
  "LM Hub_SP_Campinas_PqCidade": "SPI1", "LM Hub_SP_Araraquara": "SPI2", "LM Hub_SP_Bauru_Centro": "SPI2",
  "LM Hub_SP_Jaú": "SPI2", "LM Hub_SP_Ribeirão Preto_02": "SPI2", "LM Hub_SP_São Carlos": "SPI2",
  "LM Hub_SP_RibeirãoPretoEstação": "SPI2", "LM Hub_SP_Barretos": "SPI3", "LM Hub_SP_Franca_Distrito_Indust": "SPI3",
  "LM Hub_SP_São José do Rio P": "SPI3", "LM Hub_SP_Votuporanga": "SPI3", "LM Hub_SP_Botucatu": "SPI4",
  "LM Hub_SP_Atibaia_Ponte_Alta": "SPI4", "LM Hub_SP_Itapetininga": "SPI4", "LM Hub_SP_Itapeva": "SPI4",
  "LM Hub_SP_Jundiaí": "SPI4", "LM Hub_SP_Sorocaba_Região Norte": "SPI4", "LM Hub_SP_Tatuí": "SPI4",
  "LM Hub_SP_Várzea Paulista": "SPI4", "LM Hub_SP_Araçatuba": "SPI5", "LM Hub_SP_Assis": "SPI5",
  "LM Hub_SP_Marília": "SPI5", "LM Hub_SP_Presidente Prudente": "SPI5"
};

const MESES = [
  { value: '01', label: 'Janeiro' }, { value: '02', label: 'Fevereiro' }, { value: '03', label: 'Março' },
  { value: '04', label: 'Abril' }, { value: '05', label: 'Maio' }, { value: '06', label: 'Junho' },
  { value: '07', label: 'Julho' }, { value: '08', label: 'Agosto' }, { value: '09', label: 'Setembro' },
  { value: '10', label: 'Outubro' }, { value: '11', label: 'Novembro' }, { value: '12', label: 'Dezembro' }
];

const DataTable = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const [headers, setHeaders] = useState([]);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [baseData, setBaseData] = useState([]); 

  const [expandedObs, setExpandedObs] = useState({}); 

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('new'); 
  const [editingRowIndex, setEditingRowIndex] = useState(null); 
  const [editFormData, setEditFormData] = useState([]);
  
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [duplicateAlert, setDuplicateAlert] = useState(null); // ESTADO DO NOVO ALERTA BONITÃO

  const [draftFilters, setDraftFilters] = useState({ regional: '', ano: '', mes: '', semana: '', station: '', dataInicio: '', dataFim: '' });
  const [appliedFilters, setAppliedFilters] = useState({ regional: '', ano: '', mes: '', semana: '', station: '', dataInicio: '', dataFim: '' });
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);

  useEffect(() => { 
    const init = async () => {
      await carregarDados();
      const reference = await getBaseReferenceData();
      setBaseData(reference);
    };
    init();
  }, []);

  // RECEPTOR DO DEEP LINK DA VALIDAÇÃO (Corrigido para não reabrir o modal infinitamente)
  useEffect(() => {
    if (location.state && location.state.resolveAction && !loading && baseData.length > 0) {
      const action = location.state.resolveAction;

      if (action.mode === 'edit') {
        abrirModalEdicao(action.row);
      } 
      else if (action.mode === 'new') {
        setModalMode('new');
        const emptyRow = Array(headers.length).fill("");
        emptyRow[3] = action.prefill.data;
        emptyRow[4] = action.prefill.station;
        emptyRow[5] = action.prefill.turno;
        emptyRow[1] = MAPA_REGIONAL[action.prefill.station] || "";

        const ref = baseData.find(r => String(r[0]).trim() === String(action.prefill.station).trim() && String(r[1]).trim() === String(action.prefill.turno).trim());
        if (ref) {
          emptyRow[8] = ref[4];
          emptyRow[9] = ref[5];
          emptyRow.capHubVirtual = ref[2];
          emptyRow.capFleetVirtual = ref[3];
        }

        setEditFormData(emptyRow);
        setIsModalOpen(true);
      }

      // Limpa a URL através do React Router para garantir que não vai reabrir no F5 ou ao salvar
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, loading, baseData, headers, navigate]);

  const carregarDados = async () => {
    setLoading(true);
    try {
      const data = await getConsolidadoData();
      if (data && data.length > 0) {
        setHeaders(data[0]);
        const processedRows = data.slice(1).map((row, idx) => {
          const fullRow = Array(data[0].length).fill("");
          row.forEach((cell, i) => { fullRow[i] = cell; });
          fullRow._rowIndex = idx + 2; 
          return fullRow;
        });
        setRows(processedRows);
      }
    } catch (error) { console.error("Erro ao carregar", error); } 
    finally { setLoading(false); }
  };

  const parseDate = (dateStr) => {
    if (!dateStr) return null;
    if (String(dateStr).includes('/')) {
      const [dia, mes, ano] = dateStr.split(' ')[0].split('/');
      return new Date(`${ano}-${mes}-${dia}T12:00:00`);
    }
    return new Date(dateStr);
  };

  const colIndex = useMemo(() => {
    const getIdx = (termos) => headers.findIndex(h => termos.some(t => String(h).toLowerCase().includes(t)));
    return { regional: getIdx(['regional']), semana: getIdx(['semana', 'week']), station: getIdx(['station', 'hub']), data: getIdx(['data', 'date']) };
  }, [headers]);

  const opcoesDropdown = useMemo(() => {
    const regionais = new Set(), anos = new Set(), semanas = new Set(), stations = new Set();
    rows.forEach(row => {
      if (colIndex.regional !== -1 && row[colIndex.regional]) regionais.add(row[colIndex.regional]);
      if (colIndex.semana !== -1 && row[colIndex.semana]) semanas.add(row[colIndex.semana]);
      if (colIndex.station !== -1 && row[colIndex.station]) stations.add(row[colIndex.station]);
      if (colIndex.data !== -1 && row[colIndex.data]) {
        const d = parseDate(row[colIndex.data]);
        if (d && !isNaN(d)) anos.add(d.getFullYear());
      }
    });
    return {
      regionais: Array.from(regionais).sort(), anos: Array.from(anos).sort((a, b) => b - a),
      semanas: Array.from(semanas).sort(), stations: Array.from(stations).sort()
    };
  }, [rows, colIndex]);

  const filteredRows = useMemo(() => {
    return rows.filter(row => {
      const matchRegional = !appliedFilters.regional || (colIndex.regional !== -1 && String(row[colIndex.regional]) === appliedFilters.regional);
      const matchSemana = !appliedFilters.semana || (colIndex.semana !== -1 && String(row[colIndex.semana]) === appliedFilters.semana);
      const matchStation = !appliedFilters.station || (colIndex.station !== -1 && String(row[colIndex.station]) === appliedFilters.station);
      let matchAno = true, matchMes = true, matchData = true;

      if (colIndex.data !== -1) {
        const rowDate = parseDate(row[colIndex.data]);
        if (rowDate && !isNaN(rowDate)) {
          if (appliedFilters.ano && String(rowDate.getFullYear()) !== String(appliedFilters.ano)) matchAno = false;
          if (appliedFilters.mes && String(rowDate.getMonth() + 1).padStart(2, '0') !== appliedFilters.mes) matchMes = false;
          if (appliedFilters.dataInicio || appliedFilters.dataFim) {
            const start = appliedFilters.dataInicio ? new Date(appliedFilters.dataInicio + 'T00:00:00') : null;
            const end = appliedFilters.dataFim ? new Date(appliedFilters.dataFim + 'T23:59:59') : null;
            if (start && rowDate < start) matchData = false;
            if (end && rowDate > end) matchData = false;
          }
        }
      }
      return matchRegional && matchAno && matchMes && matchSemana && matchStation && matchData;
    });
  }, [rows, appliedFilters, colIndex]);

  const totalPages = Math.ceil(filteredRows.length / itemsPerPage);
  const currentRows = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredRows.slice(start, start + itemsPerPage);
  }, [filteredRows, currentPage, itemsPerPage]);

  const handleFilterChange = (e) => setDraftFilters(prev => ({ ...prev, [e.target.name]: e.target.value }));
  const handleSearch = () => { setAppliedFilters(draftFilters); setCurrentPage(1); };
  
  // NOVA FUNÇÃO: LIMPAR FILTROS
  const limparFiltros = () => {
    const limpos = { regional: '', ano: '', mes: '', semana: '', station: '', dataInicio: '', dataFim: '' };
    setDraftFilters(limpos);
    setAppliedFilters(limpos);
    setCurrentPage(1);
  };

  const toggleExpand = (key) => setExpandedObs(prev => ({ ...prev, [key]: !prev[key] }));

  const calcularSemana = (dateString) => {
    if (!dateString) return "";
    const d = new Date(dateString);
    if (isNaN(d)) return "";
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    return `W-${weekNo}`;
  };

  const calcularHoras = (inicio, fim) => {
    if (!inicio || !fim) return "";
    try {
      const [h1, m1] = inicio.split(':').map(Number);
      const [h2, m2] = fim.split(':').map(Number);
      let diffMins = (h2 * 60 + m2) - (h1 * 60 + m1);
      if (diffMins < 0) diffMins += 24 * 60; 
      const rh = Math.floor(diffMins / 60).toString().padStart(2, '0');
      const rm = (diffMins % 60).toString().padStart(2, '0');
      return `${rh}:${rm}:00`;
    } catch(e) { return ""; }
  };

  const formatDataForInput = (val) => {
    if (!val) return "";
    if (val.includes('/')) {
      const [d, m, y] = val.split('/');
      return `${y}-${m}-${d}`;
    }
    return val;
  };

  const formatDataForGoogle = (val) => {
    if (!val) return "";
    if (val.includes('-')) {
      const [y, m, d] = val.split('-');
      return `${d}/${m}/${y}`;
    }
    return val;
  };

  const abrirModalNovo = () => {
    setModalMode('new');
    const emptyRow = Array(headers.length).fill("");
    emptyRow.capHubVirtual = "";
    emptyRow.capFleetVirtual = "";
    setEditFormData(emptyRow);
    setIsModalOpen(true);
  };

  const abrirModalEdicao = (row) => {
    setModalMode('edit');
    setEditingRowIndex(row._rowIndex); 
    const dataCopy = [...row];
    dataCopy[3] = formatDataForInput(dataCopy[3]);

    const stationAtual = dataCopy[4];
    const turnoAtual = dataCopy[5];
    const ref = baseData.find(r => String(r[0]).trim() === String(stationAtual).trim() && String(r[1]).trim() === String(turnoAtual).trim());
    if (ref) {
      dataCopy[8] = ref[4];
      dataCopy[9] = ref[5];
      dataCopy.capHubVirtual = ref[2];
      dataCopy.capFleetVirtual = ref[3];
    } else {
      dataCopy.capHubVirtual = "";
      dataCopy.capFleetVirtual = "";
    }

    setEditFormData(dataCopy); 
    setIsModalOpen(true);
  };

  const handleEditChange = (index, value) => {
    const newData = [...editFormData];
    newData.capHubVirtual = editFormData.capHubVirtual;
    newData.capFleetVirtual = editFormData.capFleetVirtual;
    newData[index] = value;
    
    if (index === 3) newData[2] = calcularSemana(value); 
    if (index === 4) newData[1] = MAPA_REGIONAL[value] || ""; 

    if (index === 4 || index === 5) {
      const stationAtual = index === 4 ? value : newData[4];
      const turnoAtual = index === 5 ? value : newData[5];

      const ref = baseData.find(r => String(r[0]).trim() === String(stationAtual).trim() && String(r[1]).trim() === String(turnoAtual).trim());

      if (ref) {
        newData[8] = ref[4]; 
        newData[9] = ref[5]; 
        newData.capHubVirtual = ref[2];   
        newData.capFleetVirtual = ref[3]; 
      } else {
        newData[8] = "";
        newData[9] = "";
        newData.capHubVirtual = "";
        newData.capFleetVirtual = "";
      }
    }

    setEditFormData(newData);
  };

  const parseBrNumber = (val) => {
    let s = String(val || '0').trim();
    if (s.includes(',')) return Number(s.replace(/\./g, '').replace(',', '.'));
    if (/\.\d{3}$/.test(s)) return Number(s.replace(/\./g, ''));
    return Number(s) || 0;
  };

  const calcularCampos = (data) => {
    const getNum = (idx) => parseBrNumber(data[idx]);
    const formatPercent = (val) => String((val * 100).toFixed(2)).replace('.', ',') + "%";

    data[10] = calcularHoras(data[6], data[7]);

    const atRot = getNum(11); 
    const volRot = getNum(12); 
    const volProc = getNum(13); 
    const volExp = getNum(14); 

    // 🔥 NOVIDADE: Repetindo os volumes no final da planilha (AW, AX, AY)
    data[48] = volRot;
    data[49] = volProc;
    data[50] = volExp;

    data[15] = atRot > 0 ? (volRot / atRot).toFixed(2).replace('.', ',') : "0";
    data[16] = atRot > 0 ? (volExp / atRot).toFixed(2).replace('.', ',') : "0";
    data[17] = volExp - volProc;
    data[18] = volRot - volProc;

    const ofUtil = getNum(20); const ofPass = getNum(21);
    const ofMoto = getNum(22); const ofVan = getNum(23);
    const ofTotal = ofUtil + ofPass + ofMoto + ofVan;
    data[24] = ofTotal; 

    const cgUtil = getNum(25); const cgPass = getNum(26);
    const cgMoto = getNum(27); const cgVan = getNum(28);
    const cgTotal = cgUtil + cgPass + cgMoto + cgVan;
    data[29] = cgTotal;

    const dispUtil = ofUtil - cgUtil;
    const dispPass = ofPass - cgPass;
    const dispMoto = ofMoto - cgMoto;
    const dispVan = ofVan - cgVan;
    const dispTotal = ofTotal - cgTotal;
    
    data[30] = dispUtil;
    data[31] = dispPass;
    data[32] = dispMoto;
    data[33] = dispVan;
    data[34] = dispTotal;
    data[36] = cgTotal + dispTotal;

    const pacRotMoto = getNum(37); 
    const pacExpMoto = getNum(38); 
    data[39] = volRot > 0 ? formatPercent(pacRotMoto / volRot) : "0,00%";
    data[40] = volExp > 0 ? formatPercent(pacExpMoto / volExp) : "0,00%";

    // 🔥 CORREÇÃO DA REALOCAÇÃO (Lendo dos novos índices)
    const realocPre = getNum(51); // AZ
    const realocDur = getNum(52); // BA
    const naoCoube = getNum(54);  // BC
    const naoOutros = getNum(55); // BD

    const totalRealoc = realocPre + realocDur;
    data[53] = totalRealoc; // BB

    // Taxas e Eficiência (BE, BF, BG, BH)
    data[56] = volProc > 0 ? formatPercent(totalRealoc / volProc) : "0,00%";
    data[57] = volProc > 0 ? formatPercent(naoCoube / volProc) : "0,00%";
    data[58] = volProc > 0 ? formatPercent(naoOutros / volProc) : "0,00%";
    data[59] = volProc > 0 ? formatPercent(volExp / volProc) : "0,00%";

    const capHubNominal = parseBrNumber(data.capHubVirtual) || getNum(43); 
    const percHub = capHubNominal > 0 ? (volExp / capHubNominal) : 0;
    data[43] = percHub > 0 ? formatPercent(percHub) : "";

    if (percHub === 0) data[44] = "";
    else if (percHub < 1.0) data[44] = "ABAIXO";
    else if (percHub === 1.0) data[44] = "LIMITE";
    else data[44] = "ACIMA";

    const capFleetNominal = parseBrNumber(data.capFleetVirtual) || getNum(45);
    const percFleet = capFleetNominal > 0 ? (volExp / capFleetNominal) : 0;
    data[45] = percFleet > 0 ? formatPercent(percFleet) : "";

    if (percFleet === 0) data[46] = "";
    else if (percFleet < 1.0) data[46] = "ATENDE";
    else if (percFleet === 1.0) data[46] = "LIMITE";
    else data[46] = "NÃO ATENDE";

    return data;
  };

  const salvarDados = async () => {
    setIsSaving(true);
    try {
      let payload = [...editFormData];
      payload.capHubVirtual = editFormData.capHubVirtual;
      payload.capFleetVirtual = editFormData.capFleetVirtual;
      payload[3] = formatDataForGoogle(payload[3]);

      // ======== ANTI-DUPLICIDADE COM ALERTA CUSTOMIZADO ========
      if (modalMode === 'new') {
        const dataComparacao = payload[3];
        const stationComparacao = payload[4];
        const turnoComparacao = payload[5];

        const jaExiste = rows.some(r => 
          formatDataForGoogle(r[3]) === dataComparacao && 
          r[4] === stationComparacao && 
          r[5] === turnoComparacao
        );

        if (jaExiste) {
          setDuplicateAlert({ station: stationComparacao, turno: turnoComparacao, data: dataComparacao });
          setIsSaving(false);
          return; // Para o salvamento aqui
        }
      }
      // ==========================================================

      try { payload = calcularCampos(payload); } catch (errCalc) { console.error("Erro interno nos cálculos:", errCalc); }

      delete payload._rowIndex;
      delete payload.capHubVirtual;
      delete payload.capFleetVirtual;

      payload = payload.map(item => item === undefined || item === null ? "" : item);

      if (modalMode === 'edit') {
        await updateRowData(editingRowIndex, payload);
        carregarDados(); 
      } else {
        await insertRowData(payload); 
        await salvarNasOrigens(payload);
        setTimeout(() => { carregarDados(); }, 1500); 
      }
      
      setIsModalOpen(false); // Fecha o modal após sucesso
    } catch (error) {
      console.error(error);
      alert("Falha na conexão. Verifique sua internet.");
    } finally {
      setIsSaving(false);
    }
  };

const handleExcluir = async () => {
    setIsDeleting(true);
    try {
      await deleteRowData(editingRowIndex, editFormData); 
      setIsModalOpen(false);
      carregarDados();
    } catch (error) {
      console.error(error);
      alert("Falha ao excluir a linha.");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-[#1f232d] rounded-2xl shadow-sm border border-slate-200 dark:border-gray-800 p-6 transition-colors relative">
      
      {/* OVERLAY DE LOADING */}
      {(isSaving || isDeleting) && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[9999] flex flex-col items-center justify-center">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4 shadow-lg"></div>
          <p className="text-white font-black text-xl tracking-tight">
            {isSaving ? 'PROCESSANDO DADOS...' : 'EXCLUINDO REGISTRO...'}
          </p>
          <p className="text-blue-300 text-sm mt-2 font-bold animate-pulse">Comunicando com o Google Sheets</p>
        </div>
      )}

      {/* OVERLAY DO ALERTA DE DUPLICIDADE (O BONITÃO) */}
      {duplicateAlert && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[99999] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#1f232d] rounded-2xl shadow-2xl p-6 max-w-md w-full border border-red-100 dark:border-red-900/30">
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-red-100 dark:bg-red-900/30 p-3 rounded-full text-[#EE4D2D] dark:text-red-400">
                <AlertTriangle size={24} />
              </div>
              <h3 className="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tight">Registro Duplicado</h3>
            </div>
            <p className="text-slate-600 dark:text-gray-300 text-sm mb-6 leading-relaxed">
              Já existe um formulário preenchido para o Hub <strong className="text-slate-800 dark:text-white">{duplicateAlert.station}</strong> no turno <strong className="text-slate-800 dark:text-white">{duplicateAlert.turno}</strong> da data <strong className="text-slate-800 dark:text-white">{duplicateAlert.data}</strong>.
              <br/><br/>
              Feche esta janela, busque pela data na tabela e clique em "Editar".
            </p>
            <div className="flex justify-end">
              <button 
                onClick={() => setDuplicateAlert(null)} 
                className="bg-[#EE4D2D] hover:bg-[#d64528] text-white px-5 py-2.5 rounded-xl font-bold text-sm transition-colors shadow-sm"
              >
                Entendi
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4 shrink-0">
        <div>
        <h2 className="text-2xl font-black text-slate-800 dark:text-white uppercase tracking-tight flex items-center gap-2">
              <LucideBarChartHorizontal className="text-[#EE4D2D]" size={28} /> Base de Dados - Gestão SPI && Realocação SOP
            </h2>
          <p className="text-xs text-slate-500 dark:text-gray-400 font-bold">Mostrando {filteredRows.length} de {rows.length} registros</p>
        </div>
        
        <div className="flex flex-wrap gap-2">
          <button onClick={carregarDados} className="text-xs font-bold bg-slate-100 dark:bg-gray-800 text-slate-600 dark:text-gray-300 px-4 py-2 rounded-lg hover:bg-slate-200 dark:hover:bg-gray-700 transition-colors">
            {loading ? "Sincronizando..." : "Atualizar"}
          </button>
          <button onClick={abrirModalNovo} className="flex items-center gap-2 text-xs font-bold bg-red-700 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors shadow-sm">
            <Plus size={16} /> Adicionar Dados
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4 mb-6 bg-slate-50 dark:bg-[#15171e] p-4 rounded-xl border border-slate-100 dark:border-gray-800 items-end shrink-0">
        <div className="flex flex-col"><label className="text-[10px] font-bold text-slate-400 dark:text-gray-500 uppercase mb-1">Regional</label><select name="regional" value={draftFilters.regional} onChange={handleFilterChange} className="bg-white dark:bg-[#1f232d] dark:text-white border border-slate-200 dark:border-gray-700 rounded-lg p-2 text-sm"><option value="">Todas</option>{opcoesDropdown.regionais.map(reg => <option key={reg} value={reg}>{reg}</option>)}</select></div>
        <div className="flex flex-col"><label className="text-[10px] font-bold text-slate-400 dark:text-gray-500 uppercase mb-1">Ano</label><select name="ano" value={draftFilters.ano} onChange={handleFilterChange} className="bg-white dark:bg-[#1f232d] dark:text-white border border-slate-200 dark:border-gray-700 rounded-lg p-2 text-sm"><option value="">Todos</option>{opcoesDropdown.anos.map(ano => <option key={ano} value={ano}>{ano}</option>)}</select></div>
        <div className="flex flex-col"><label className="text-[10px] font-bold text-slate-400 dark:text-gray-500 uppercase mb-1">Mês</label><select name="mes" value={draftFilters.mes} onChange={handleFilterChange} className="bg-white dark:bg-[#1f232d] dark:text-white border border-slate-200 dark:border-gray-700 rounded-lg p-2 text-sm"><option value="">Todos</option>{MESES.map(mes => <option key={mes.value} value={mes.value}>{mes.label}</option>)}</select></div>
        <div className="flex flex-col"><label className="text-[10px] font-bold text-slate-400 dark:text-gray-500 uppercase mb-1">Semana</label><select name="semana" value={draftFilters.semana} onChange={handleFilterChange} className="bg-white dark:bg-[#1f232d] dark:text-white border border-slate-200 dark:border-gray-700 rounded-lg p-2 text-sm"><option value="">Todas</option>{opcoesDropdown.semanas.map(sem => <option key={sem} value={sem}>{sem}</option>)}</select></div>
        <div className="flex flex-col lg:col-span-1 md:col-span-2 col-span-2"><label className="text-[10px] font-bold text-slate-400 dark:text-gray-500 uppercase mb-1">Station / Hub</label><select name="station" value={draftFilters.station} onChange={handleFilterChange} className="bg-white dark:bg-[#1f232d] dark:text-white border border-slate-200 dark:border-gray-700 rounded-lg p-2 text-sm"><option value="">Todas</option>{opcoesDropdown.stations.map(station => <option key={station} value={station}>{station}</option>)}</select></div>
        <div className="flex flex-col"><label className="text-[10px] font-bold text-slate-400 dark:text-gray-500 uppercase mb-1">Data Início</label><input type="date" name="dataInicio" value={draftFilters.dataInicio} onChange={handleFilterChange} className="bg-white dark:bg-[#1f232d] dark:text-gray-300 border border-slate-200 dark:border-gray-700 rounded-lg p-2 text-sm" /></div>
        <div className="flex flex-col"><label className="text-[10px] font-bold text-slate-400 dark:text-gray-500 uppercase mb-1">Data Fim</label><input type="date" name="dataFim" value={draftFilters.dataFim} onChange={handleFilterChange} className="bg-white dark:bg-[#1f232d] dark:text-gray-300 border border-slate-200 dark:border-gray-700 rounded-lg p-2 text-sm" /></div>
        
        {/* BOTÕES DE BUSCAR E LIMPAR */}
        <div className="flex gap-2 lg:col-span-1 md:col-span-4 col-span-2 h-[38px]">
          <button onClick={limparFiltros} className="flex flex-1 items-center justify-center bg-slate-200 dark:bg-gray-700 hover:bg-slate-300 dark:hover:bg-gray-600 text-slate-700 dark:text-gray-200 font-bold rounded-lg transition-colors" title="Limpar Filtros">
            <Eraser size={16} />
          </button>
          <button onClick={handleSearch} className="flex-[3] flex items-center justify-center gap-2 bg-[#0055A5] hover:bg-blue-700 text-white font-bold text-sm rounded-lg transition-colors">
            <Search size={16} /> Buscar
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-1 flex-col items-center justify-center"><div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div></div>
      ) : (
        <div className="flex-1 overflow-x-auto rounded-xl border border-slate-200 dark:border-gray-800 relative shadow-sm h-[calc(100vh-320px)] min-h-[400px]">
          <table className="w-full text-left text-sm text-slate-600 dark:text-gray-300 whitespace-nowrap">
            <thead className="bg-slate-100 dark:bg-[#15171e] text-slate-500 dark:text-gray-400 uppercase text-[10px] sticky top-0 z-20">
              <tr>
                <th className="px-4 py-3 font-bold sticky left-0 bg-slate-100 dark:bg-[#15171e] z-30 shadow-[1px_0_0_0_#e2e8f0] dark:shadow-[1px_0_0_0_#1f2937]">Ações</th>
                {headers.map((col, i) => <th key={i} className="px-4 py-3 font-bold border-b border-slate-200 dark:border-gray-800">{col}</th>)}
              </tr>
            </thead>
            <tbody>
              {currentRows.map((row, rowIndex) => (
                <tr key={rowIndex} className="border-b border-slate-100 dark:border-gray-800 hover:bg-blue-50 dark:hover:bg-gray-800/50">
                  <td className="px-4 py-3 text-center sticky left-0 bg-white dark:bg-[#1f232d] shadow-[1px_0_0_0_#f1f5f9] dark:shadow-[1px_0_0_0_#1f2937] z-10">
                    <button onClick={() => abrirModalEdicao(row)} className="text-[#EE4D2D] dark:text-blue-400 hover:text-white hover:bg-[#EE4D2D] font-bold text-[10px] uppercase border border-[#EE4D2D]/30 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 px-3 py-1 rounded-full transition-colors">Editar</button>
                  </td>
                  
                  {headers.map((_, cellIndex) => {
                    const isLongText = cellIndex === 41 || cellIndex === 42;
                    const content = row[cellIndex];
                    const keyId = `${rowIndex}-${cellIndex}`;
                    const isExpanded = !!expandedObs[keyId];

                    return (
                      <td key={cellIndex} className="px-4 py-3 max-w-[250px]">
                        {isLongText ? (
                          <div className="flex items-center justify-between gap-2">
                            <span className={isExpanded ? "whitespace-normal break-words" : "truncate block"}>
                              {content}
                            </span>
                            {content && content.length > 20 && (
                              <button onClick={() => toggleExpand(keyId)} className="text-blue-500 hover:bg-blue-50 p-1 rounded-full transition-colors shrink-0">
                                {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                              </button>
                            )}
                          </div>
                        ) : (
                          <span className="truncate block max-w-[200px]">{content}</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && (
        <div className="flex justify-between items-center mt-4 shrink-0">
          <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-gray-400">
            <span>Linhas:</span>
            <select value={itemsPerPage} onChange={(e) => setItemsPerPage(Number(e.target.value))} className="bg-slate-50 dark:bg-[#15171e] border border-slate-200 dark:border-gray-700 rounded-lg p-1 text-slate-700 dark:text-gray-300">
              <option value={10}>10</option><option value={50}>50</option><option value={100}>100</option>
            </select>
          </div>
          <div className="flex gap-1 items-center">
            <span className="text-sm font-bold text-slate-500 mr-2">Pág {currentPage} de {totalPages || 1}</span>
            <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} className="p-2 rounded-lg border border-slate-200 dark:border-gray-700 bg-white dark:bg-[#1f232d] hover:bg-slate-50 disabled:opacity-50"><ChevronLeft size={16} /></button>
            <button disabled={currentPage === totalPages || totalPages === 0} onClick={() => setCurrentPage(p => p + 1)} className="p-2 rounded-lg border border-slate-200 dark:border-gray-700 bg-white dark:bg-[#1f232d] hover:bg-slate-50 disabled:opacity-50"><ChevronRight size={16} /></button>
          </div>
        </div>
      )}

      <FormSection 
        isOpen={isModalOpen}
        mode={modalMode}
        rowIndex={editingRowIndex}
        formData={editFormData}
        onChange={handleEditChange}
        onSave={salvarDados}
        onDelete={handleExcluir}
        onClose={() => setIsModalOpen(false)}
        isSaving={isSaving}
        isDeleting={isDeleting}
      />

    </div>
  );
};

export default DataTable;