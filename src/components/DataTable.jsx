import React, { useState, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getConsolidadoData, updateRowData, insertRowData, deleteRowData, getBaseReferenceData, salvarNasOrigens } from '../api/googleSheets';
import { Search, ChevronLeft, ChevronRight, Plus, ChevronDown, ChevronUp, AlertTriangle, Eraser, LucideBarChartHorizontal } from 'lucide-react';
import FormSection from './FormSection';

import { MAPA_REGIONAL_COMPLETO, getHubsPermitidos } from '../constants/regionais';

const PINNED_WIDTHS = [80, 100, 80, 100, 250, 140]; // Ações, Regional, Semana, Data, Station Name, Dispatch Window

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
  const [originalRowData, setOriginalRowData] = useState(null);
  const [editFormData, setEditFormData] = useState([]);
  
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [duplicateAlert, setDuplicateAlert] = useState(null); 

  // 🔥 ESTADO ÚNICO DE FILTROS (Sem Rascunho!)
  const initialFilters = { regional: [], ano: '', mes: '', semana: [], station: [], dataInicio: '', dataFim: '' };
  const [appliedFilters, setAppliedFilters] = useState(initialFilters);
  
  const [openFilterDropdown, setOpenFilterDropdown] = useState(null);
  const [stationSearchTerm, setStationSearchTerm] = useState('');

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
        emptyRow[1] = action.prefill.regional || MAPA_REGIONAL_COMPLETO[action.prefill.station] || "";
        emptyRow[2] = action.prefill.semana || ""; 

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

      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, loading, baseData, headers, navigate]);

  const parseDate = (dateStr) => {
    if (!dateStr) return new Date(0);
    let str = String(dateStr).trim().split(' ')[0];
    if (str.includes('/')) {
      let [dia, mes, ano] = str.split('/');
      if (ano && ano.length === 2) ano = `20${ano}`;
      return new Date(`${ano}-${mes}-${dia}T12:00:00`);
    }
    return new Date(str);
  };

  const carregarDados = async () => {
    setLoading(true);
    try {
      const data = await getConsolidadoData();
      if (data && data.length > 0) {
        setHeaders(data[0]);
        
        let processedRows = data.slice(1).map((row, idx) => {
          const fullRow = Array(data[0].length).fill("");
          row.forEach((cell, i) => { fullRow[i] = cell; });
          fullRow._rowIndex = idx + 2; 
          return fullRow;
        });

        const regEscolhida = localStorage.getItem("selectedRegional");
        const hubsPermitidos = getHubsPermitidos(regEscolhida);
        
        processedRows = processedRows.filter(row => hubsPermitidos.includes(String(row[4]).trim()));

        processedRows.sort((a, b) => {
          const dataA = parseDate(a[3]) || new Date(0);
          const dataB = parseDate(b[3]) || new Date(0);
          return dataB - dataA; 
        });

        setRows(processedRows);
      }
    } catch (error) { console.error("Erro ao carregar", error); } 
    finally { setLoading(false); }
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
      const matchRegional = appliedFilters.regional.length === 0 || (colIndex.regional !== -1 && appliedFilters.regional.includes(String(row[colIndex.regional])));
      const matchSemana = appliedFilters.semana.length === 0 || (colIndex.semana !== -1 && appliedFilters.semana.includes(String(row[colIndex.semana])));
      const matchStation = appliedFilters.station.length === 0 || (colIndex.station !== -1 && appliedFilters.station.includes(String(row[colIndex.station])));
      
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

  const handleFilterChange = (e) => {
    setAppliedFilters(prev => ({ ...prev, [e.target.name]: e.target.value }));
    setCurrentPage(1); 
  };
  
  const limparFiltros = () => {
    setAppliedFilters(initialFilters);
    setCurrentPage(1);
    setStationSearchTerm('');
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
    setOriginalRowData([...row]);
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
    setEditFormData(prevData => {
      const newData = [...prevData];
      newData.capHubVirtual = prevData.capHubVirtual;
      newData.capFleetVirtual = prevData.capFleetVirtual;
      
      newData[index] = value;
      
      if (index === 3) newData[2] = calcularSemana(value); 
      if (index === 4) newData[1] = MAPA_REGIONAL_COMPLETO[value] || ""; 

      if (index === 4 || index === 5) {
        const stationAtual = index === 4 ? value : newData[4];
        const turnoAtual = index === 5 ? value : newData[5];

        const ref = baseData.find(r => 
          String(r[0]).trim() === String(stationAtual).trim() && 
          String(r[1]).trim() === String(turnoAtual).trim()
        );

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
      return newData;
    });
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

    const temVolumes = data[11] !== "" && data[12] !== "" && data[13] !== "" && data[14] !== "";
    
    if (temVolumes) {
      data[0] = "✅";
    } else {
      data[0] = "❌";
    }

    data[10] = calcularHoras(data[6], data[7]);

    const atRot = getNum(11); 
    const volRot = getNum(12); 
    const volProc = getNum(13); 
    const volExp = getNum(14); 

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

    const realocPre = getNum(51); 
    const realocDur = getNum(52); 
    const naoCoube = getNum(54);  
    const naoOutros = getNum(55); 

    const totalRealoc = realocPre + realocDur;
    data[53] = totalRealoc; 

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
    if (isSaving) return; 
    
    setIsSaving(true);
    try {
      let payload = [...editFormData];
      payload.capHubVirtual = editFormData.capHubVirtual;
      payload.capFleetVirtual = editFormData.capFleetVirtual;
      payload[3] = formatDataForGoogle(payload[3]);

      if (modalMode === 'new') {
        const dataCompNum = parseDate(payload[3])?.getTime();
        const stationCompStr = String(payload[4]).trim().toLowerCase();
        const turnoCompStr = String(payload[5]).trim().toLowerCase();

        const jaExiste = rows.some(r => {
          const rDataNum = parseDate(r[3])?.getTime();
          const rStationStr = String(r[4]).trim().toLowerCase();
          const rTurnoStr = String(r[5]).trim().toLowerCase();

          return (
            rDataNum === dataCompNum && 
            rStationStr === stationCompStr && 
            rTurnoStr === turnoCompStr
          );
        });

        if (jaExiste) {
          setDuplicateAlert({ station: payload[4], turno: payload[5], data: payload[3] });
          setIsSaving(false);
          return; 
        }
      }

      try { payload = calcularCampos(payload); } catch (errCalc) { console.error("Erro interno nos cálculos:", errCalc); }

      delete payload._rowIndex;
      delete payload.capHubVirtual;
      delete payload.capFleetVirtual;

      payload = payload.map(item => item === undefined || item === null ? "" : item);

      if (modalMode === 'edit') {
        await updateRowData(editingRowIndex, payload, originalRowData); 
      } else {
        await Promise.all([
          insertRowData(payload),
          salvarNasOrigens(payload)
        ]);

        setRows(prevRows => {
          const linhaVisual = [...payload];
          linhaVisual._rowIndex = prevRows.length > 0 ? prevRows[0]._rowIndex + 1 : 9999;
          const novasLinhas = [linhaVisual, ...prevRows];
          return novasLinhas.sort((a, b) => (parseDate(b[3]) || new Date(0)) - (parseDate(a[3]) || new Date(0)));
        });
      }
      
      setIsModalOpen(false); 
      setIsSaving(false); 
      
      carregarDados(); 
      
    } catch (error) {
      console.error(error);
      alert("Falha na conexão. Verifique sua internet.");
      setIsSaving(false);
    }
  };

  const handleExcluir = async () => {
    setIsDeleting(true);
    try {
      await deleteRowData(editingRowIndex, originalRowData); 
      setIsModalOpen(false);
      setIsDeleting(false); 
      
      carregarDados(); 
    } catch (error) {
      console.error(error);
      alert("Falha ao excluir a linha.");
      setIsDeleting(false);
    }
  };

  const renderMultiSelect = (label, filterKey, options, enableSearch = false, widthClass = "w-full") => {
    const isOpen = openFilterDropdown === filterKey;
    const selectedCount = appliedFilters[filterKey].length;

    return (
      <div className={`flex flex-col relative ${widthClass}`}>
        <label className="text-[10px] font-bold text-slate-400 dark:text-gray-500 uppercase mb-1">{label}</label>
        <div 
          onClick={() => setOpenFilterDropdown(isOpen ? null : filterKey)}
          className="bg-white dark:bg-[#1f232d] dark:text-white border border-slate-200 dark:border-gray-700 rounded-lg px-3 text-[11px] font-bold cursor-pointer flex justify-between items-center h-[38px] hover:border-[#113366] transition-colors"
        >
          <span className="truncate pr-2 select-none text-slate-700 dark:text-gray-200">
            {selectedCount === 0 ? "Todas as opções" : `${selectedCount} selecionada(s)`}
          </span>
          <ChevronDown size={14} className={`text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}/>
        </div>

        {isOpen && (
          <>
            <div className="fixed inset-0 z-[90]" onClick={() => setOpenFilterDropdown(null)} />
            <div className={`absolute top-full left-0 mt-1 min-w-[220px] w-full bg-white dark:bg-[#1f232d] border border-slate-200 dark:border-gray-700 rounded-lg shadow-xl z-[100] p-2 flex flex-col max-h-[280px]`}>
              
              {enableSearch && (
                <div className="relative mb-2 shrink-0">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={12} />
                  <input 
                    type="text"
                    className="w-full bg-slate-50 dark:bg-[#15171e] border border-slate-200 dark:border-gray-700 rounded text-[11px] py-1.5 pl-7 pr-2 font-medium outline-none text-slate-700 dark:text-white"
                    placeholder="Pesquisar..."
                    value={stationSearchTerm}
                    onChange={(e) => setStationSearchTerm(e.target.value)}
                  />
                </div>
              )}

              <div className="flex justify-between text-[10px] font-black border-b border-slate-100 dark:border-gray-800 pb-1.5 px-1 mb-1 shrink-0">
                <button 
                  type="button" 
                  className="text-[#113366] dark:text-blue-400 hover:underline" 
                  onClick={() => { setAppliedFilters(prev => ({...prev, [filterKey]: options})); setCurrentPage(1); }}
                >
                  Selecionar Todas
                </button>
                <button 
                  type="button" 
                  className="text-red-500 hover:underline" 
                  onClick={() => { setAppliedFilters(prev => ({...prev, [filterKey]: []})); setCurrentPage(1); }}
                >
                  Limpar
                </button>
              </div>
              
              <div className="overflow-y-auto custom-scrollbar flex-1 space-y-0.5">
                {options.filter(opt => !enableSearch || !stationSearchTerm || String(opt).toLowerCase().includes(stationSearchTerm.toLowerCase())).length === 0 ? (
                   <div className="text-[10px] text-slate-400 text-center py-4 font-bold">Nenhum resultado</div>
                ) : (
                  options.filter(opt => !enableSearch || !stationSearchTerm || String(opt).toLowerCase().includes(stationSearchTerm.toLowerCase())).map(opt => {
                    const isChecked = appliedFilters[filterKey].includes(opt);
                    return (
                      <label key={opt} className="flex items-center space-x-2 px-2 py-1.5 rounded hover:bg-slate-50 dark:hover:bg-gray-800 cursor-pointer text-[11px] font-bold text-slate-700 dark:text-slate-300 select-none transition-colors">
                        <input 
                          type="checkbox" 
                          checked={isChecked} 
                          onChange={() => {
                            setAppliedFilters(prev => ({
                              ...prev,
                              [filterKey]: isChecked ? prev[filterKey].filter(v => v !== opt) : [...prev[filterKey], opt]
                            }));
                            setCurrentPage(1); // Força ir pra pág 1 ao filtrar
                          }} 
                          className="rounded border-slate-300 dark:border-gray-600 text-[#113366] focus:ring-[#113366] h-3.5 w-3.5 cursor-pointer" 
                        />
                        <span className="truncate">{opt}</span>
                      </label>
                    )
                  })
                )}
              </div>
            </div>
          </>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-[#1f232d] rounded-2xl shadow-sm border border-slate-200 dark:border-gray-800 p-6 transition-colors relative">
      
      {(isSaving || isDeleting) && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[9999] flex flex-col items-center justify-center">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4 shadow-lg"></div>
          <p className="text-white font-black text-xl tracking-tight">
            {isSaving ? 'PROCESSANDO DADOS...' : 'EXCLUINDO REGISTRO...'}
          </p>
          <p className="text-blue-300 text-sm mt-2 font-bold animate-pulse">Comunicando com o Google Sheets</p>
        </div>
      )}

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

      {}
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
        
        <div className="lg:col-span-1 md:col-span-2 col-span-2">
           {renderMultiSelect('Regional', 'regional', opcoesDropdown.regionais)}
        </div>
        
        <div className="flex flex-col">
          <label className="text-[10px] font-bold text-slate-400 dark:text-gray-500 uppercase mb-1">Ano</label>
          <select name="ano" value={appliedFilters.ano} onChange={handleFilterChange} className="bg-white dark:bg-[#1f232d] dark:text-white border border-slate-200 dark:border-gray-700 rounded-lg px-2 text-[11px] font-bold outline-none h-[38px] cursor-pointer">
             <option value="">Todos</option>
             {opcoesDropdown.anos.map(ano => <option key={ano} value={ano}>{ano}</option>)}
          </select>
        </div>
        
        <div className="flex flex-col">
          <label className="text-[10px] font-bold text-slate-400 dark:text-gray-500 uppercase mb-1">Mês</label>
          <select name="mes" value={appliedFilters.mes} onChange={handleFilterChange} className="bg-white dark:bg-[#1f232d] dark:text-white border border-slate-200 dark:border-gray-700 rounded-lg px-2 text-[11px] font-bold outline-none h-[38px] cursor-pointer">
             <option value="">Todos</option>
             {MESES.map(mes => <option key={mes.value} value={mes.value}>{mes.label}</option>)}
          </select>
        </div>
        
        <div className="lg:col-span-1 md:col-span-2 col-span-2">
           {renderMultiSelect('Semana', 'semana', opcoesDropdown.semanas)}
        </div>
        
        <div className="flex flex-col lg:col-span-2 md:col-span-4 col-span-2">
           {renderMultiSelect('Station / Hub', 'station', opcoesDropdown.stations, true)}
        </div>
        
        <div className="flex flex-col">
          <label className="text-[10px] font-bold text-slate-400 dark:text-gray-500 uppercase mb-1">Data Início</label>
          <input type="date" name="dataInicio" value={appliedFilters.dataInicio} onChange={handleFilterChange} className="bg-white dark:bg-[#1f232d] dark:text-white border border-slate-200 dark:border-gray-700 rounded-lg px-2 text-[11px] font-bold outline-none h-[38px]" />
        </div>
        <div className="flex flex-col">
          <label className="text-[10px] font-bold text-slate-400 dark:text-gray-500 uppercase mb-1">Data Fim</label>
          <input type="date" name="dataFim" value={appliedFilters.dataFim} onChange={handleFilterChange} className="bg-white dark:bg-[#1f232d] dark:text-white border border-slate-200 dark:border-gray-700 rounded-lg px-2 text-[11px] font-bold outline-none h-[38px]" />
        </div>
        
        <div className="flex gap-2 lg:col-span-8 md:col-span-4 col-span-2 mt-2 pt-4 border-t border-slate-200 dark:border-gray-700">
          <button onClick={limparFiltros} className="flex-1 flex items-center justify-center bg-slate-200 dark:bg-gray-700 hover:bg-slate-300 dark:hover:bg-gray-600 text-slate-700 dark:text-gray-200 font-bold rounded-lg transition-colors h-[38px]" title="Limpar Todos os Filtros">
            <Eraser size={16} className="mr-2"/> Limpar Todos os Filtros
          </button>
        </div>
      </div>

      {}
      {loading ? (
        <div className="flex flex-1 flex-col items-center justify-center"><div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div></div>
      ) : (
        <div className="flex-1 overflow-x-auto rounded-xl border border-slate-200 dark:border-gray-800 relative shadow-sm h-[calc(100vh-320px)] min-h-[400px] custom-scrollbar">
          <table className="w-full text-left text-sm text-slate-600 dark:text-gray-300 whitespace-nowrap">
            <thead className="text-slate-500 dark:text-gray-400 uppercase text-[10px]">
              <tr>
                <th 
                  className="px-4 py-3 font-bold sticky top-0 left-0 bg-slate-100 dark:bg-[#15171e] z-[40] border-b border-slate-200 dark:border-gray-800"
                  style={{ minWidth: PINNED_WIDTHS[0] }}
                >
                  Ações
                </th>
                {headers.map((col, i) => {
                  if (i === 0) return null;
                  
                  // Verifica se é uma das 5 colunas de dados seguintes (1 ao 5)
                  const isPinned = i <= 5;
                  // Calcula a posição Left somando as larguras das colunas anteriores
                  const leftPos = isPinned ? PINNED_WIDTHS.slice(0, i).reduce((a, b) => a + b, 0) : 0;

                  return (
                    <th 
                      key={i} 
                      className={`px-4 py-3 font-bold border-b border-slate-200 dark:border-gray-800 bg-slate-100 dark:bg-[#15171e] sticky top-0 ${isPinned ? 'z-[40]' : 'z-[20]'} ${isPinned && i === 5 ? 'shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] dark:shadow-[2px_0_5px_-2px_rgba(0,0,0,0.5)]' : ''}`}
                      style={isPinned ? { left: leftPos, minWidth: PINNED_WIDTHS[i] } : {}}
                    >
                      {col}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {currentRows.map((row, rowIndex) => (
                <tr key={rowIndex} className="bg-white dark:bg-[#1f232d] border-b border-slate-100 dark:border-gray-800 hover:bg-blue-50 dark:hover:bg-gray-800/50 transition-colors">
                  <td 
                    className="px-4 py-3 text-center sticky left-0 bg-inherit z-[20]"
                    style={{ minWidth: PINNED_WIDTHS[0] }}
                  >
                    <button onClick={() => abrirModalEdicao(row)} className="text-[#EE4D2D] dark:text-blue-400 hover:text-white hover:bg-[#EE4D2D] font-bold text-[10px] uppercase border border-[#EE4D2D]/30 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 px-3 py-1 rounded-full transition-colors">Editar</button>
                  </td>
                  
                  {headers.map((_, cellIndex) => {
                    if (cellIndex === 0) return null;

                    const isPinned = cellIndex <= 5;
                    const leftPos = isPinned ? PINNED_WIDTHS.slice(0, cellIndex).reduce((a, b) => a + b, 0) : 0;

                    const isLongText = cellIndex === 41 || cellIndex === 42;
                    const content = row[cellIndex];
                    const keyId = `${rowIndex}-${cellIndex}`;
                    const isExpanded = !!expandedObs[keyId];

                    return (
                      <td 
                        key={cellIndex} 
                        className={`px-4 py-3 max-w-[250px] ${isPinned ? `sticky bg-inherit z-[20] ${cellIndex === 5 ? 'shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] dark:shadow-[2px_0_5px_-2px_rgba(0,0,0,0.3)]' : ''}` : ''}`}
                        style={isPinned ? { left: leftPos, minWidth: PINNED_WIDTHS[cellIndex] } : {}}
                      >
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

      {}
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
        baseData={baseData}
      />

    </div>
  );
};

export default DataTable;