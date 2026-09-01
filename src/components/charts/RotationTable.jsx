import React, { useState, useMemo, useEffect } from 'react';
import { Search, CheckCircle, AlertTriangle, XCircle, Slash, Truck, ChevronLeft, ChevronRight, ArrowUpDown, Filter, CalendarDays, Calendar, MapPin, ChevronDown, Download, Database, Lightbulb, TrendingUp, TrendingDown, Minus, Upload, Loader2, Target } from 'lucide-react';
import { getRodagemData, getDeliverySuccessData, uploadCadastroSPX, getCadastroFrotaData } from '../../api/googleSheets'; 
import { getHubsPermitidos } from '../../constants/regionais';

const STATUS_MAP = {
  'RODOU': { icon: <CheckCircle size={12} />, color: 'bg-green-500 text-white', label: 'Trabalhou' },
  'RECUSOU': { icon: <XCircle size={12} />, color: 'bg-red-500 text-white', label: 'Recusou' },
  'DISPO': { icon: <AlertTriangle size={12} />, color: 'bg-yellow-400 text-yellow-900', label: 'Disponível' },
  'INDISP': { icon: <Slash size={10} />, color: 'bg-slate-100 text-slate-400 dark:bg-gray-700 dark:text-gray-500', label: 'Indisponível' }
};

const padronizarHubLocal = (nome) => {
  if (!nome) return "";
  let n = String(nome).trim();
  let nLimpo = n.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, '');
  
  if (nLimpo.includes("ribeiraopretoesta")) return "LM Hub_SP_RibeirãoPretoEstaça";
  if (nLimpo.includes("sumare") && nLimpo.includes("veneza")) return "LM Hub_SP_Sumaré_Nova Veneza";
  
  return n;
};

export default function RotationTable() {
  const [rawData, setRawData] = useState([]); 
  const [dsRawData, setDsRawData] = useState([]); 
  const [cadastroRawData, setCadastroRawData] = useState([]); 
  const [loading, setLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [filtrosAbertos, setFiltrosAbertos] = useState(true);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedHubs, setSelectedHubs] = useState([]); 
  const [hubDropdownOpen, setHubDropdownOpen] = useState(false);
  const [hubSearchTerm, setHubSearchTerm] = useState('');

  const [hubDownload, setHubDownload] = useState('');
  const [hubUpload, setHubUpload] = useState('');

  const [selectedModal, setSelectedModal] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [selectedTrips, setSelectedTrips] = useState('ALL'); 
  const [selectedClassificacao, setSelectedClassificacao] = useState('ALL'); 
  
  // LÓGICA D-1: O painel sempre inicia olhando para a "data de ontem".
  // Isso evita que no dia 01 de cada mês a tela fique vazia procurando uma aba que ainda não existe.
  const dataReferencia = new Date();
  dataReferencia.setDate(dataReferencia.getDate() - 1);

  const [targetMonth, setTargetMonth] = useState(dataReferencia.getMonth() + 1); 
  const [targetYear] = useState(dataReferencia.getFullYear());
  
  const [viewMode, setViewMode] = useState('semana'); 
  const [targetWeek, setTargetWeek] = useState('');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });

  const [sortConfig, setSortConfig] = useState({ direction: 'desc' });
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50); 

  const regEscolhida = localStorage.getItem("selectedRegional");

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const monthStr = ['JAN','FEV','MAR','ABR','MAI','JUN','JUL','AGO','SET','OUT','NOV','DEZ'][targetMonth - 1];
        const tabName = `${monthStr}-${targetYear}`;
        
        const [dataRodizio, dataDS, dataCadastro] = await Promise.all([
            getRodagemData(tabName),
            getDeliverySuccessData().catch(() => []),
            getCadastroFrotaData().catch(() => []) 
        ]);

        setRawData(dataRodizio || []);
        setDsRawData(dataDS || []);
        setCadastroRawData(dataCadastro || []);
      } catch (error) {
        console.error("Erro ao carregar rodízio, DS ou Cadastro:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [targetMonth, targetYear]);

  const cadastroMap = useMemo(() => {
    const map = new Map();
    if (!cadastroRawData || cadastroRawData.length < 2) return map;
    for (let i = 1; i < cadastroRawData.length; i++) {
        const row = cadastroRawData[i];
        const id = String(row[0]).trim();
        const nome = String(row[1] || "").trim();
        if (id) map.set(id, nome);
    }
    return map;
  }, [cadastroRawData]);

  const dsMap = useMemo(() => {
    if (!dsRawData || dsRawData.length < 2) return new Map();
    const map = new Map();
    const headers = dsRawData[0];
    
    const weekIndices = {};
    headers.forEach((h, idx) => {
      if (!h) return;
      const headerStr = String(h).trim().toUpperCase();
      if (headerStr.startsWith('W') && (headerStr.includes('D-0') || headerStr.includes('D0'))) {
        const match = headerStr.match(/W\d+/);
        if (match) {
          const weekStr = match[0].replace('W', 'W-'); 
          weekIndices[weekStr] = idx;
        }
      }
    });

    for (let i = 1; i < dsRawData.length; i++) {
      const row = dsRawData[i];
      const driverId = String(row[0] || "").trim();
      if (!driverId) continue;
      
      const driverScores = {};
      for (const [wk, idx] of Object.entries(weekIndices)) {
        let val = row[idx];
        if (val !== null && val !== undefined && val !== '') {
          let s = String(val).trim().replace(/%/g, '');
          if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
          const n = Number(s);
          if (!isNaN(n)) driverScores[wk] = n;
        }
      }
      map.set(driverId, driverScores);
    }
    return map;
  }, [dsRawData]);

  const parseUniversalDate = (dateStr) => {
    if (!dateStr) return null;
    let s = String(dateStr).trim().split('T')[0].split(' ')[0];
    if (s.includes('/')) {
      const [dia, m, a] = s.split('/');
      return `${a}-${m.padStart(2, '0')}-${dia.padStart(2, '0')}`;
    }
    return s;
  };

  const getISOWeek = (dateStr) => {
    const isoDate = parseUniversalDate(dateStr);
    if (!isoDate) return "";
    const d = new Date(isoDate + 'T12:00:00');
    const dCopy = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const dayNum = dCopy.getUTCDay() || 7;
    dCopy.setUTCDate(dCopy.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(dCopy.getUTCFullYear(),0,1));
    return `W-${String(Math.ceil((((dCopy - yearStart) / 86400000) + 1)/7)).padStart(2, '0')}`;
  };

  const availableWeeks = useMemo(() => {
    if (!rawData || rawData.length < 1) return [];
    const headers = rawData[0];
    const dataColsStart = 5; 
    const weeks = new Set();
    
    for (let i = dataColsStart; i < headers.length; i++) {
        const w = getISOWeek(headers[i]);
        if (w) weeks.add(w);
    }
    return Array.from(weeks).sort();
  }, [rawData]);

  useEffect(() => {
    if (availableWeeks.length > 0) {
      if (!targetWeek || !availableWeeks.includes(targetWeek)) {
        setTargetWeek(availableWeeks[availableWeeks.length - 1]);
      }
    }
  }, [availableWeeks]);

  const hubsDisponiveis = useMemo(() => {
    if (!rawData || rawData.length < 2) return [];
    const hubs = new Set();
    const permitidos = regEscolhida && regEscolhida !== "TODOS" ? getHubsPermitidos(regEscolhida) : null;

    rawData.slice(1).forEach(row => {
      const rowHub = padronizarHubLocal(row[4]);
      if (!rowHub) return;
      if (permitidos && !permitidos.includes(rowHub)) return; 
      hubs.add(rowHub);
    });
    return Array.from(hubs).sort();
  }, [rawData, regEscolhida]);

  const modaisDisponiveis = useMemo(() => {
    if (!rawData || rawData.length < 2) return [];
    const modais = new Set();
    const permitidos = regEscolhida && regEscolhida !== "TODOS" ? getHubsPermitidos(regEscolhida) : null;
    
    rawData.slice(1).forEach(row => {
      const rowHub = padronizarHubLocal(row[4]);
      const matchesHub = permitidos ? permitidos.includes(rowHub) : true;
      if (matchesHub && row[1]) modais.add(String(row[1]).trim().toUpperCase());
    });
    return Array.from(modais).sort();
  }, [rawData, regEscolhida]);

  useEffect(() => {
    setSelectedHubs(prev => prev.filter(hub => hubsDisponiveis.includes(hub)));
  }, [hubsDisponiveis]);

  const matrix = useMemo(() => {
    if (!rawData || rawData.length < 1) return { headers: [], rows: [], availableTrips: [], wksPast: [] };
    if (selectedHubs.length === 0) return { headers: [], rows: [], availableTrips: [], wksPast: [] };

    const headers = rawData[0];
    const dataColsStart = 5; 

    const activeDateCols = headers.map((h, i) => ({ label: String(h), idx: i })).filter((col, i) => {
      if (i < dataColsStart) return false;
      const dateStr = parseUniversalDate(col.label);
      if (!dateStr) return false;

      if (viewMode === 'month') return true; 
      if (viewMode === 'semana') return getISOWeek(dateStr) === targetWeek;
      if (viewMode === 'range' && dateRange.start && dateRange.end) {
        return dateStr >= dateRange.start && dateStr <= dateRange.end;
      }
      return true; 
    });

    const permitidos = regEscolhida && regEscolhida !== "TODOS" ? getHubsPermitidos(regEscolhida) : null;

    let currWkNum = parseInt(targetWeek.replace(/\D/g, ''), 10);
    if (isNaN(currWkNum)) currWkNum = 0;
    
    const wkCurrent = targetWeek;
    const wksPast = [
      `W-${String(Math.max(1, currWkNum - 1)).padStart(2, '0')}`,
      `W-${String(Math.max(1, currWkNum - 2)).padStart(2, '0')}`,
      `W-${String(Math.max(1, currWkNum - 3)).padStart(2, '0')}`
    ];

    const initialRows = rawData.slice(1).filter(row => {
      const rowHub = padronizarHubLocal(row[4]); 
      const rowModal = String(row[1] || "").trim().toUpperCase(); 

      if (permitidos && !permitidos.includes(rowHub)) return false;

      const matchesHub = selectedHubs.includes(rowHub);
      const matchesSearch = String(row[0] || "").toLowerCase().includes(searchTerm.toLowerCase());
      const matchesModal = selectedModal === 'ALL' ? true : rowModal === selectedModal;
      
      return matchesHub && matchesSearch && matchesModal;
    }).map(row => {
      let countRodou = 0;
      const days = {};
      
      activeDateCols.forEach(col => {
        const status = row[col.idx] ? String(row[col.idx]).toUpperCase() : 'INDISP';
        days[col.label] = status;
        if (status === 'RODOU') countRodou++;
      });

      const driverId = row[0];
      const driverDsInfo = dsMap.get(driverId) || {};
      const nomeMotorista = cadastroMap.get(driverId) || ""; 

      const dsAtual = driverDsInfo[wkCurrent];
      const dsPast1 = driverDsInfo[wksPast[0]];
      const dsPast2 = driverDsInfo[wksPast[1]];
      const dsPast3 = driverDsInfo[wksPast[2]];
      
      let pastSum = 0; let pastCount = 0;
      wksPast.forEach(w => {
         if (driverDsInfo[w] !== undefined) { pastSum += driverDsInfo[w]; pastCount++; }
      });
      const pastAvg = pastCount > 0 ? (pastSum / pastCount) : null;
      const dsDiff = (dsAtual !== undefined && pastAvg !== null) ? (dsAtual - pastAvg) : null;

      return {
        id: driverId,
        nome: nomeMotorista,
        modal: row[1] || "-",
        regional: row[3] || regEscolhida || "-", 
        hub: padronizarHubLocal(row[4]), 
        days,
        total: countRodou,
        dsAtual,
        dsPast1,
        dsPast2,
        dsPast3,
        dsDiff
      };
    });

    const statusFilteredRows = initialRows.filter(row => {
      if (selectedStatus === 'ALL') return true;
      return Object.values(row.days).includes(selectedStatus);
    });

    const classificacaoFilteredRows = statusFilteredRows.filter(row => {
      if (selectedClassificacao === 'ALL') return true;
      const val = row.dsAtual; 
      if (val === null || val === undefined || val === '-') return false;
      
      const isVerde = val >= 95;
      const isAmarelo = val >= 90 && val < 95;
      const isVermelho = val < 90;

      if (selectedClassificacao === 'VERDE') return isVerde;
      if (selectedClassificacao === 'AMARELO') return isAmarelo;
      if (selectedClassificacao === 'VERMELHO') return isVermelho;
      return true;
    });

    const uniqueTrips = new Set();
    classificacaoFilteredRows.forEach(row => uniqueTrips.add(row.total));
    const availableTripsList = Array.from(uniqueTrips).sort((a, b) => a - b);

    const finalRows = classificacaoFilteredRows.filter(row => {
      if (selectedTrips === 'ALL') return true;
      return row.total === Number(selectedTrips);
    });

    finalRows.sort((a, b) => {
      if (sortConfig.direction === 'desc') return b.total - a.total;
      return a.total - b.total;
    });

    return { headers: activeDateCols, rows: finalRows, availableTrips: availableTripsList, wksPast };
  }, [rawData, viewMode, targetWeek, dateRange, searchTerm, selectedHubs, selectedModal, selectedStatus, selectedTrips, selectedClassificacao, sortConfig, regEscolhida, dsMap, cadastroMap]);


  // MOTOR DE CÁLCULO PARA OS CARDS E CURVA ABC
  const summaryMetrics = useMemo(() => {
    let rodou = 0;
    let recusou = 0;
    let dispo = 0;

    // Varre os motoristas que estão visíveis na tela e os dias ativos no filtro
    matrix.rows.forEach(row => {
      matrix.headers.forEach(col => {
        const st = row.days[col.label];
        if (st === 'RODOU') rodou++;
        else if (st === 'RECUSOU') recusou++;
        else if (st === 'DISPO') dispo++;
      });
    });

    const totalPossivel = rodou + recusou + dispo;
    const taxaUtilizacao = totalPossivel > 0 ? ((rodou / totalPossivel) * 100).toFixed(1) : 0;
    const taxaRecusa = totalPossivel > 0 ? ((recusou / totalPossivel) * 100).toFixed(1) : 0;

    // Isola os Top 20% que mais rodaram no período (Curva A)
    const sorted = [...matrix.rows].sort((a,b) => b.total - a.total).filter(d => d.total > 0);
    const topCount = Math.max(1, Math.floor(sorted.length * 0.20));
    const topDrivers = sorted.slice(0, topCount);

    let dsSoma = 0;
    let dsQtd = 0;
    topDrivers.forEach(d => {
       if (typeof d.dsAtual === 'number') {
          dsSoma += d.dsAtual;
          dsQtd++;
       }
    });
    
    const dsMedioTop = dsQtd > 0 ? (dsSoma / dsQtd).toFixed(1) : null;

    return { rodou, recusou, dispo, taxaUtilizacao, taxaRecusa, topCount, dsMedioTop };
  }, [matrix]);

  useEffect(() => {
    if (selectedTrips !== 'ALL' && !matrix.availableTrips.includes(Number(selectedTrips))) {
      setSelectedTrips('ALL');
    }
  }, [matrix.availableTrips]);

  const totalPages = Math.max(1, Math.ceil(matrix.rows.length / itemsPerPage));
  const paginatedRows = matrix.rows.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  useEffect(() => { 
    setCurrentPage(1); 
  }, [searchTerm, selectedHubs, selectedModal, selectedStatus, selectedTrips, selectedClassificacao, itemsPerPage, viewMode, targetWeek]);

  const formatDateHeader = (d) => {
    if (!d || !d.includes('-')) return d;
    return d.split('-')[2];
  };

  const toggleSort = () => {
    setSortConfig(prev => ({ direction: prev.direction === 'desc' ? 'asc' : 'desc' }));
  };

  const handleFileUpload = async (event) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    if (!hubUpload) {
      alert("Por favor, selecione para qual HUB você está enviando esta base (no seletor azul).");
      event.target.value = null;
      return;
    }

    setIsUploading(true);

    try {
      let allExtractedData = [];

      const readFileAsText = (file) => {
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target.result);
          reader.onerror = (e) => reject(e);
          reader.readAsText(file, 'utf-8');
        });
      };

      const parseCSVLine = (line, separator) => {
         const result = [];
         let cur = '';
         let inQuotes = false;
         for (let i = 0; i < line.length; i++) {
             const char = line[i];
             if (char === '"') inQuotes = !inQuotes;
             else if (char === separator && !inQuotes) {
                 result.push(cur);
                 cur = '';
             } else {
                 cur += char;
             }
         }
         result.push(cur);
         return result;
      };

      for (let f = 0; f < files.length; f++) {
        const text = await readFileAsText(files[f]);
        const rows = text.split('\n');
        if (rows.length < 2) continue; 

        const headerLine = rows[0];
        const sep = headerLine.split(';').length > headerLine.split(',').length ? ';' : ','; 

        for(let i = 1; i < rows.length; i++) {
            if(!rows[i].trim()) continue;
            
            const cols = parseCSVLine(rows[i], sep);
            const clean = (val) => val ? String(val).trim().replace(/(^"|"$)/g, '') : '';
            
            const driverId = clean(cols[0]); 
            if(!driverId || isNaN(Number(driverId))) continue;

            allExtractedData.push({
               driverId: driverId,
               nome: clean(cols[1]),       
               telefone: clean(cols[8]),   
               cpf: clean(cols[10]),       
               placa: clean(cols[45]),     
               status: clean(cols[51]),    
               hub: hubUpload              
            });
        }
      }

      const uniqueDataMap = new Map();
      allExtractedData.forEach(item => {
          uniqueDataMap.set(item.driverId, item); 
      });
      const finalDataToUpload = Array.from(uniqueDataMap.values());

      if (finalDataToUpload.length === 0) {
          alert("Nenhum dado válido encontrado. Verifique se os arquivos são as exportações corretas do SPX.");
          return;
      }

      await uploadCadastroSPX(finalDataToUpload, hubUpload);
      alert(`Sucesso! A base de cadastro do Hub ${hubUpload} foi atualizada com ${finalDataToUpload.length} motoristas únicos (lidos de ${files.length} arquivo(s))!`);
      
      getCadastroFrotaData().then(data => setCadastroRawData(data || []));

    } catch (err) {
      alert("Falha ao processar ou salvar base: " + err.message);
    } finally {
      setIsUploading(false);
      event.target.value = null; 
    }
  };

  const exportarHubCSV = () => {
    if (!hubDownload) return alert("Por favor, selecione uma Station antes de baixar.");
    if (rawData.length < 2) return alert("Nenhum dado base carregado ainda.");

    const headers = rawData[0];
    const dataColsStart = 5;

    const dateCols = [];
    for (let i = dataColsStart; i < headers.length; i++) {
      dateCols.push({ label: String(headers[i]), idx: i });
    }

    const headersCSV = [
        "Driver ID", "Nome", "Regional", "Modal", "HUB", 
        matrix.wksPast[2] || "W-3", matrix.wksPast[1] || "W-2", matrix.wksPast[0] || "W-1", targetWeek, "Evolucao", 
        ...dateCols.map(c => {
           const d = parseUniversalDate(c.label);
           return d ? `${d.split('-')[2]}/${d.split('-')[1]}` : c.label;
        }), 
        "Total Dias Rodados"
    ];

    const linhasCSV = [];
    matrix.rows.forEach(row => {
      if (row.hub === hubDownload) {
        let totalRodou = 0;
        const dias = dateCols.map(col => {
          const status = row.days[col.label] ? String(row.days[col.label]).toUpperCase() : 'INDISP';
          if (status === 'RODOU') totalRodou++;
          return status; 
        });

        linhasCSV.push([
            row.id,
            row.nome,
            row.regional,
            row.modal, 
            row.hub, 
            row.dsPast3 !== undefined ? row.dsPast3 : '-',
            row.dsPast2 !== undefined ? row.dsPast2 : '-',
            row.dsPast1 !== undefined ? row.dsPast1 : '-',
            row.dsAtual !== undefined ? row.dsAtual : '-',
            row.dsDiff !== null ? row.dsDiff.toFixed(2) : '-',
            ...dias, 
            totalRodou
        ].join(","));
      }
    });

    if (linhasCSV.length === 0) return alert("Nenhum dado encontrado para este Hub com os filtros atuais.");

    const csvContent = "\uFEFF" + [headersCSV.join(","), ...linhasCSV].join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `Rodizio_${hubDownload.replace(/\s+/g, '_')}_Mes${targetMonth}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4 animate-in fade-in duration-300">
        <Loader2 size={48} className="text-[#EE4D2D] animate-spin" />
        <h2 className="text-xl font-black text-[#113366] dark:text-blue-400 uppercase tracking-widest animate-pulse text-center">
          Carregando informações de rodízio...
        </h2>
        <p className="text-xs font-bold text-slate-400 text-center max-w-sm">
          Estamos cruzando milhares de dados com a base de cadastros do SPX. Isso pode levar alguns segundos.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col space-y-4 mt-6">
      
      <div className="bg-white dark:bg-[#1f232d] rounded-2xl shadow-sm border border-slate-200 dark:border-gray-800 shrink-0 mt-4">
        <div 
          onClick={() => setFiltrosAbertos(!filtrosAbertos)}
          className="p-5 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 cursor-pointer hover:bg-slate-50/50 dark:hover:bg-gray-800/50 transition-colors rounded-t-2xl select-none"
        >
          <div>
            <h2 className="text-2xl font-black text-[#113366] dark:text-white uppercase tracking-tight flex items-center gap-2">
              <Calendar className="text-[#EE4D2D]" size={26} /> Tabela de Rodízio
            </h2>
            <p className="text-xs font-bold text-slate-400 uppercase mt-1 flex items-center gap-2">
              <span>Acompanhamento Operacional de Condutores</span>
            </p>
          </div>
          
          <div className="flex items-center gap-3">
             <button className="flex items-center justify-center gap-1.5 bg-[#113366] hover:bg-blue-900 text-white px-4 py-2 rounded-xl text-[11px] font-black uppercase transition-colors shadow-sm">
                {filtrosAbertos ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                {filtrosAbertos ? 'Recolher Painel' : 'Expandir Painel'}
             </button>
          </div>
        </div>

        {filtrosAbertos && (
          <div className="p-6 pt-0 flex flex-col gap-6 animate-in slide-in-from-top-4 duration-300">
            <div className="h-px w-full bg-slate-100 dark:bg-gray-800 mb-2"></div>
            
           <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-6 bg-slate-50 dark:bg-[#15171e] p-5 rounded-xl border border-slate-200 dark:border-gray-700">
              
              <div className="flex gap-3 items-start">
                <div className="p-2 bg-blue-50 dark:bg-blue-950/30 text-[#113366] dark:text-blue-400 rounded-lg shrink-0">
                  <Database size={16} />
                </div>
                <div className="flex flex-col gap-1">
                  <h4 className="text-[11px] font-black text-slate-800 dark:text-white uppercase tracking-wider">Origem & Atualização</h4>
                  <p className="text-[11px] text-slate-500 dark:text-gray-400 font-medium leading-relaxed">
                    A base consolidada é atualizada importando o arquivo de cadastro de motoristas. Acesse o <strong>SPX</strong> (<em>Gestão de Equipe &gt; Perfil de motorista</em>), clique em <strong>Exportar</strong> e faça o download. Após isso, selecione o Hub e clique em <strong>Importar SPX</strong>.
                    <br/><br/>
                    <span className="text-[9px] bg-slate-200 dark:bg-gray-700 text-slate-600 dark:text-gray-300 px-2 py-0.5 rounded font-bold">
                      Uso do Banco de Dados: {((cadastroMap.size / 1400000) * 100).toFixed(2).replace('.', ',')}% (Capacidade: 1.4M)
                    </span>
                  </p>
                </div>
              </div>

              <div className="flex gap-3 items-start border-t lg:border-t-0 xl:border-l border-slate-200 dark:border-gray-700 pt-4 lg:pt-0 xl:pl-6">
                <div className="p-2 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 rounded-lg shrink-0">
                  <MapPin size={16} />
                </div>
                <div className="flex flex-col gap-1 w-full">
                  <h4 className="text-[11px] font-black text-slate-800 dark:text-white uppercase tracking-wider">Legenda de Status</h4>
                  <div className="flex flex-col gap-1 mt-1 text-[11px] font-medium leading-relaxed">
                    <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-bold"><CheckCircle size={12}/> RODOU (Viagem concluída)</span>
                    <span className="flex items-center gap-1 text-[#D0011B] font-bold"><XCircle size={12}/> RECUSOU (Substituição ou cancelamento)</span>
                    <span className="flex items-center gap-1 text-yellow-600 dark:text-yellow-400 font-bold"><AlertTriangle size={12}/> DISPONÍVEL (Aguardando oferta)</span>
                    <span className="flex items-center gap-1 text-slate-400 font-bold"><div className="w-3 h-3 rounded bg-slate-200 dark:bg-gray-700 flex items-center justify-center">-</div> INDISPONÍVEL</span>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 items-start border-t xl:border-t-0 lg:border-l border-slate-200 dark:border-gray-700 pt-4 xl:pt-0 lg:pl-6">
                <div className="p-2 bg-orange-50 dark:bg-orange-950/20 text-[#EE4D2D] rounded-lg shrink-0">
                  <Lightbulb size={16} />
                </div>
                <div className="flex flex-col gap-1">
                  <h4 className="text-[11px] font-black text-slate-800 dark:text-white uppercase tracking-wider">Dica Prática de Análise</h4>
                  <p className="text-[11px] text-slate-500 dark:text-gray-400 font-medium leading-relaxed">
                    A matriz reflete exatamente os filtros aplicados (Modal, Status, Classificação).<br/><br/>
                    As colunas de <strong>Histórico (W-1 a W-3)</strong> mostram o DS recente. A coluna de <strong>Evolução</strong> compara a semana atual focada com a média destas 3 anteriores.
                    <br/><br/>
                    <span className="italic text-[11px] text-slate-800">
                      Algoritmo de DS por Matheus Alcântara - SPO3
                    </span>
                  </p>
                </div>
              </div>

              <div className="flex gap-3 items-start border-t xl:border-t-0 lg:border-t-0 xl:border-l border-slate-200 dark:border-gray-700 pt-4 xl:pt-0 xl:pl-6">
                <div className="p-2 bg-indigo-50 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400 rounded-lg shrink-0">
                  <Target size={16} />
                </div>
                <div className="flex flex-col gap-1">
                  <h4 className="text-[11px] font-black text-slate-800 dark:text-white uppercase tracking-wider">Entendendo a Curva ABC</h4>
                  <p className="text-[11px] text-slate-500 dark:text-gray-400 font-medium leading-relaxed">
                    O card inferior calcula a qualidade do seu "núcleo duro" de condutores.<br/><br/>
                    O sistema isola os <strong>Top 20%</strong> que mais trabalharam no período e mostra a nota de DS deles. Responde à pergunta central gerencial: <em>"Estou priorizando escalas para os motoristas certos?"</em>
                  </p>
                </div>
              </div>

            </div>
          </div>
        )}
      </div>

      <div className="bg-white dark:bg-[#1f232d] rounded-xl shadow-sm border border-slate-200 dark:border-gray-800 p-4 shrink-0 flex flex-col gap-4">
        
        <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 border-b border-slate-100 dark:border-gray-800 pb-4">
          <div className="text-xs font-black text-[#113366] dark:text-slate-400 uppercase flex items-center gap-2">
             <Filter size={16} className="text-[#EE4D2D]" /> Central de Filtros
          </div>
          
          <div className="flex flex-col md:flex-row items-center gap-3 w-full xl:w-auto">
            <div className="flex items-center gap-2 bg-blue-50 dark:bg-blue-900/20 p-2 rounded-xl border border-blue-200 dark:border-blue-800 w-full md:w-auto">
              <select 
                value={hubUpload} 
                onChange={(e) => setHubUpload(e.target.value)}
                disabled={isUploading}
                className="bg-white dark:bg-[#1f232d] dark:text-white text-xs font-bold p-2.5 rounded-lg border border-blue-200 dark:border-blue-800 outline-none cursor-pointer flex-1 min-w-[180px] text-[#113366] dark:text-blue-400 disabled:opacity-50"
              >
                <option value="">1. HUB do Upload (SPX)...</option>
                {hubsDisponiveis.map(h => <option key={`ul-${h}`} value={h}>{h}</option>)}
              </select>
              
              <input type="file" accept=".csv" id="spx-upload" className="hidden" onChange={handleFileUpload} disabled={isUploading} multiple />
              <button 
                onClick={() => document.getElementById('spx-upload').click()}
                disabled={isUploading}
                className="flex items-center justify-center gap-1.5 bg-[#113366] hover:bg-blue-900 text-white px-4 py-2.5 rounded-lg text-[11px] font-black uppercase transition-all shadow-sm shrink-0 w-full md:w-auto disabled:opacity-50"
              >
                {isUploading ? <Loader2 size={14} className="animate-spin"/> : <Upload size={14}/>}
                {isUploading ? 'Enviando...' : '2. Importar SPX'}
              </button>
            </div>

            <div className="flex items-center gap-2 bg-slate-50 dark:bg-[#15171e] p-2 rounded-xl border border-slate-200 dark:border-gray-700 w-full md:w-auto">
              <select 
                value={hubDownload} 
                onChange={(e) => setHubDownload(e.target.value)}
                className="bg-white dark:bg-[#1f232d] dark:text-white text-xs font-bold p-2.5 rounded-lg border border-slate-200 dark:border-gray-700 outline-none cursor-pointer flex-1 min-w-[180px]"
              >
                <option value="">Baixar Base Station...</option>
                {hubsDisponiveis.map(h => <option key={`dl-${h}`} value={h}>{h}</option>)}
              </select>
              <button 
                onClick={exportarHubCSV}
                className="flex items-center justify-center gap-1.5 bg-[#EE4D2D] hover:bg-[#D0011B] text-white px-4 py-2.5 rounded-lg text-[11px] font-black uppercase transition-all shadow-sm shrink-0 w-full md:w-auto"
              >
                <Download size={14}/> Baixar CSV
              </button>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
          
          <div className="flex flex-col flex-1 min-w-[120px] max-w-[180px]">
            <label className="text-[9px] font-black text-slate-400 uppercase mb-0.5 ml-1">Buscar ID</label>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#EE4D2D]" size={14} />
              <input 
                type="text" 
                className="w-full bg-slate-50 dark:bg-[#15171e] border border-slate-200 dark:border-gray-700 rounded-lg py-1.5 pl-8 pr-3 text-xs font-medium focus:ring-2 focus:ring-[#113366] outline-none transition-all dark:text-white"
                placeholder="Ex: 123456..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-col flex-1 min-w-[160px] max-w-[220px] relative">
            <label className="text-[9px] font-black text-slate-400 uppercase mb-0.5 ml-1 flex items-center gap-1">
              <MapPin size={10}/> Hub / Station ({selectedHubs.length})
            </label>
            
            <div 
              className="w-full bg-slate-50 dark:bg-[#15171e] border border-slate-200 dark:border-gray-700 rounded-lg py-1.5 px-3 text-xs font-bold text-[#113366] dark:text-white cursor-pointer hover:border-[#113366] transition-colors flex justify-between items-center"
              onClick={() => setHubDropdownOpen(!hubDropdownOpen)}
            >
              <span className="truncate select-none">
                {selectedHubs.length === 0 
                  ? "Selecione os Hubs..." 
                  : selectedHubs.length === hubsDisponiveis.length 
                  ? "Todos os Hubs" 
                  : `${selectedHubs.length} selecionado(s)`}
              </span>
              <ChevronDown size={14} className={`text-slate-400 transition-transform ${hubDropdownOpen ? 'rotate-180' : ''}`} />
            </div>

            {hubDropdownOpen && (
              <div className="fixed inset-0 z-[90]" onClick={() => setHubDropdownOpen(false)} />
            )}

            {hubDropdownOpen && (
              <div className="absolute top-full left-0 mt-1 w-full bg-white dark:bg-[#1f232d] border border-slate-200 dark:border-gray-700 rounded-lg shadow-xl z-[100] p-2 flex flex-col space-y-2 max-h-[260px]">
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" size={12} />
                  <input 
                    type="text"
                    className="w-full bg-slate-50 dark:bg-[#15171e] border border-slate-200 dark:border-gray-700 rounded text-[11px] py-1 pl-6 pr-2 font-medium outline-none text-slate-700 dark:text-white"
                    placeholder="Pesquisar hub..."
                    value={hubSearchTerm}
                    onChange={(e) => setHubSearchTerm(e.target.value)}
                    onClick={(e) => e.stopPropagation()} 
                  />
                </div>
                
                <div className="flex justify-between text-[10px] font-black border-b border-slate-100 dark:border-gray-800 pb-1.5 px-1">
                  <button type="button" className="text-blue-600 dark:text-blue-400 hover:underline" onClick={(e) => { e.stopPropagation(); setSelectedHubs(hubsDisponiveis); }}>Todos</button>
                  <button type="button" className="text-red-500 hover:underline" onClick={(e) => { e.stopPropagation(); setSelectedHubs([]); }}>Limpar</button>
                </div>

                <div className="overflow-y-auto custom-scrollbar flex-1 space-y-0.5 pr-1 max-h-[160px]">
                  {hubsDisponiveis.filter(h => h.toLowerCase().includes(hubSearchTerm.toLowerCase())).length === 0 ? (
                    <div className="text-[10px] text-slate-400 text-center py-2 font-medium">Nenhum hub encontrado</div>
                  ) : (
                    hubsDisponiveis
                      .filter(hub => hub.toLowerCase().includes(hubSearchTerm.toLowerCase()))
                      .map(hub => {
                        const isChecked = selectedHubs.includes(hub);
                        return (
                          <label key={hub} className="flex items-center space-x-2 px-1.5 py-1 rounded hover:bg-slate-50 dark:hover:bg-gray-800 cursor-pointer text-[11px] font-bold text-slate-700 dark:text-slate-300 select-none" onClick={(e) => e.stopPropagation()}>
                            <input 
                              type="checkbox"
                              className="rounded border-slate-300 dark:border-gray-600 text-[#113366] focus:ring-[#113366] h-3.5 w-3.5 cursor-pointer"
                              checked={isChecked}
                              onChange={() => {
                                if (isChecked) {
                                  setSelectedHubs(selectedHubs.filter(h => h !== hub));
                                } else {
                                  setSelectedHubs([...selectedHubs, hub]);
                                }
                              }}
                            />
                            <span className="truncate">{hub}</span>
                          </label>
                        );
                      })
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-col">
            <label className="text-[9px] font-black text-slate-400 uppercase mb-0.5 ml-1">Modal</label>
            <select 
              className="bg-slate-50 dark:bg-[#15171e] border border-slate-200 dark:border-gray-700 rounded-lg py-1.5 px-3 text-xs font-bold text-[#113366] dark:text-white outline-none cursor-pointer hover:border-[#113366] transition-colors"
              value={selectedModal}
              onChange={(e) => setSelectedModal(e.target.value)}
            >
              <option value="ALL">Todos os Modais</option>
              {modaisDisponiveis.map(modal => <option key={modal} value={modal}>{modal}</option>)}
            </select>
          </div>

          <div className="flex flex-col">
            <label className="text-[9px] font-black text-slate-400 uppercase mb-0.5 ml-1 flex items-center gap-1"><Filter size={10}/> Status</label>
            <select 
              className="bg-slate-50 dark:bg-[#15171e] border border-slate-200 dark:border-gray-700 rounded-lg py-1.5 px-3 text-xs font-bold text-[#113366] dark:text-white outline-none cursor-pointer hover:border-[#113366] transition-colors"
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
            >
              <option value="ALL">Qualquer Status</option>
              <option value="RODOU">RODARAM</option>
              <option value="DISPO">DISPONÍVEIS</option>
              <option value="RECUSOU">RECUSARAM</option>
              <option value="INDISP">INDISPONIVEIS</option>
            </select>
          </div>

          <div className="flex flex-col">
            <label className="text-[9px] font-black text-slate-400 uppercase mb-0.5 ml-1 flex items-center gap-1"><Target size={10}/> Classificação DS</label>
            <select 
              className="bg-slate-50 dark:bg-[#15171e] border border-slate-200 dark:border-gray-700 rounded-lg py-1.5 px-3 text-xs font-bold text-[#113366] dark:text-white outline-none cursor-pointer hover:border-[#113366] transition-colors"
              value={selectedClassificacao}
              onChange={(e) => setSelectedClassificacao(e.target.value)}
            >
              <option value="ALL">Qualquer DS</option>
              <option value="VERDE">Melhores</option>
              <option value="AMARELO">Risco</option>
              <option value="VERMELHO">Ofensores</option>
            </select>
          </div>

          <div className="flex flex-col border-l border-slate-200 dark:border-gray-700 pl-4 ml-2">
            <label className="text-[9px] font-black text-slate-400 uppercase mb-0.5 ml-1">Mês Base</label>
            <div className="flex items-center bg-slate-50 dark:bg-[#15171e] border border-slate-200 dark:border-gray-700 rounded-lg p-0.5 h-[30px]">
              <button onClick={() => setTargetMonth(m => Math.max(1, m-1))} className="p-1 text-slate-400 hover:text-[#EE4D2D] transition-colors"><ChevronLeft size={14}/></button>
              <span className="px-2 text-xs font-black text-[#113366] dark:text-white min-w-[50px] text-center uppercase tracking-wider">
                {['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'][targetMonth-1]}
              </span>
              <button onClick={() => setTargetMonth(m => Math.min(12, m+1))} className="p-1 text-slate-400 hover:text-[#EE4D2D] transition-colors"><ChevronRight size={14}/></button>
            </div>
          </div>

          {viewMode === 'semana' && availableWeeks.length > 0 && (
            <div className="flex flex-col animate-in fade-in slide-in-from-left-2">
              <label className="text-[9px] font-black text-slate-400 uppercase mb-0.5 ml-1 text-center">Filtro Semana</label>
              <div className="flex items-center bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-lg p-0.5 h-[30px] shadow-sm">
                <button 
                  onClick={() => { const idx = availableWeeks.indexOf(targetWeek); if (idx > 0) setTargetWeek(availableWeeks[idx - 1]); }} 
                  className="p-1 text-slate-400 hover:text-[#EE4D2D] disabled:opacity-30 transition-colors"
                  disabled={availableWeeks.indexOf(targetWeek) <= 0}
                ><ChevronLeft size={14}/></button>
                <span className="px-2 text-xs font-black text-[#EE4D2D] min-w-[50px] text-center uppercase tracking-wider">{targetWeek}</span>
                <button 
                  onClick={() => { const idx = availableWeeks.indexOf(targetWeek); if (idx < availableWeeks.length - 1) setTargetWeek(availableWeeks[idx + 1]); }} 
                  className="p-1 text-slate-400 hover:text-[#EE4D2D] disabled:opacity-30 transition-colors"
                  disabled={availableWeeks.indexOf(targetWeek) >= availableWeeks.length - 1}
                ><ChevronRight size={14}/></button>
              </div>
            </div>
          )}

          <div className="flex bg-slate-100 dark:bg-gray-800 p-1 rounded-lg ml-auto border border-slate-200 dark:border-gray-700">
            <button onClick={() => setViewMode('semana')} className={`flex items-center gap-1.5 px-4 py-1 rounded text-[10px] font-black uppercase tracking-wider transition-all ${viewMode === 'semana' ? 'bg-[#113366] text-white shadow-sm' : 'text-slate-500 hover:text-[#113366]'}`}><CalendarDays size={12}/>Semana</button>
            <button onClick={() => setViewMode('month')} className={`flex items-center gap-1.5 px-4 py-1 rounded text-[10px] font-black uppercase tracking-wider transition-all ${viewMode === 'month' ? 'bg-[#113366] text-white shadow-sm' : 'text-slate-500 hover:text-[#113366]'}`}><Calendar size={12}/>Mês</button>
            <button onClick={() => setViewMode('range')} className={`flex items-center gap-1.5 px-4 py-1 rounded text-[10px] font-black uppercase tracking-wider transition-all ${viewMode === 'range' ? 'bg-[#113366] text-white shadow-sm' : 'text-slate-500 hover:text-[#113366]'}`}><Filter size={12}/>Manual</button>
          </div>
        </div>

        {viewMode === 'range' && (
          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-100 dark:border-gray-800 animate-in fade-in slide-in-from-top-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mr-2">Data Customizada:</span>
            <input type="date" className="bg-slate-50 dark:bg-[#15171e] text-xs py-1 px-2 rounded border border-slate-200 dark:border-gray-700 font-bold text-[#113366] dark:text-white outline-none" value={dateRange.start} onChange={e => setDateRange({...dateRange, start: e.target.value})} />
            <span className="text-slate-300 font-bold text-xs">até</span>
            <input type="date" className="bg-slate-50 dark:bg-[#15171e] text-xs py-1 px-2 rounded border border-slate-200 dark:border-gray-700 font-bold text-[#113366] dark:text-white outline-none" value={dateRange.end} onChange={e => setDateRange({...dateRange, end: e.target.value})} />
          </div>
        )}
      </div>


    '{/* 🔥 CARDS DE RESUMO OPERACIONAL E CURVA ABC */}
      {matrix.rows.length > 0 && selectedHubs.length > 0 && !loading && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-2 animate-in fade-in slide-in-from-bottom-4">
          
          {/* Card 1: Engajamento / Rodou */}
          <div className="bg-white dark:bg-[#1f232d] p-4 rounded-xl shadow-sm border border-slate-200 dark:border-gray-800 flex flex-col relative overflow-hidden">
            <div className="absolute -right-4 -top-4 text-emerald-50 opacity-50 dark:opacity-5 transform rotate-12">
                <CheckCircle size={80} />
            </div>
            <div className="flex items-center gap-2 mb-2 relative z-10">
                <div className="p-1.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-md">
                  <Truck size={14} strokeWidth={3} />
                </div>
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Viagens (Rodou)</span>
            </div>
            <div className="flex items-end gap-3 relative z-10">
                <span className="text-3xl font-black text-[#113366] dark:text-white leading-none">{summaryMetrics.rodou}</span>
                <div className="flex flex-col mb-0.5">
                  <span className="text-[10px] font-bold text-emerald-500 flex items-center gap-0.5">
                      <TrendingUp size={10} /> {summaryMetrics.taxaUtilizacao}% Ocupação
                  </span>
                </div>
            </div>
          </div>

          {/* Card 2: Recusas */}
          <div className="bg-white dark:bg-[#1f232d] p-4 rounded-xl shadow-sm border border-slate-200 dark:border-gray-800 flex flex-col relative overflow-hidden">
            <div className="absolute -right-4 -top-4 text-red-50 opacity-50 dark:opacity-5 transform rotate-12">
                <XCircle size={80} />
            </div>
            <div className="flex items-center gap-2 mb-2 relative z-10">
                <div className="p-1.5 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-md">
                  <XCircle size={14} strokeWidth={3} />
                </div>
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Recusas na Base</span>
            </div>
            <div className="flex items-end gap-3 relative z-10">
                <span className="text-3xl font-black text-[#113366] dark:text-white leading-none">{summaryMetrics.recusou}</span>
                <div className="flex flex-col mb-0.5">
                  <span className={`text-[10px] font-bold flex items-center gap-0.5 ${summaryMetrics.taxaRecusa > 5 ? 'text-[#D0011B]' : 'text-slate-400'}`}>
                      <TrendingDown size={10} /> {summaryMetrics.taxaRecusa}% Taxa Geral
                  </span>
                </div>
            </div>
          </div>

          {/* Card 3: Disponibilidade (Ociosidade) */}
          <div className="bg-white dark:bg-[#1f232d] p-4 rounded-xl shadow-sm border border-slate-200 dark:border-gray-800 flex flex-col relative overflow-hidden">
            <div className="absolute -right-4 -top-4 text-yellow-50 opacity-50 dark:opacity-5 transform rotate-12">
                <AlertTriangle size={80} />
            </div>
            <div className="flex items-center gap-2 mb-2 relative z-10">
                <div className="p-1.5 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400 rounded-md">
                  <AlertTriangle size={14} strokeWidth={3} />
                </div>
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Ociosidade Ativa</span>
            </div>
            <div className="flex items-end gap-3 relative z-10">
                <span className="text-3xl font-black text-[#113366] dark:text-white leading-none">{summaryMetrics.dispo}</span>
                <div className="flex flex-col mb-0.5">
                  <span className="text-[9px] font-bold text-slate-400 uppercase">
                      Disp. sem Rota
                  </span>
                </div>
            </div>
          </div>

          {/* Card 4: Insight Curva ABC */}
          <div className="bg-gradient-to-br from-[#113366] to-blue-900 p-4 rounded-xl shadow-sm border border-[#113366] flex flex-col relative overflow-hidden">
            <div className="absolute -right-4 -top-4 text-white opacity-5 transform rotate-12">
                <Target size={80} />
            </div>
            <div className="flex items-center gap-2 mb-2 relative z-10">
                <div className="p-1.5 bg-white/10 text-white rounded-md">
                  <Target size={14} strokeWidth={3} />
                </div>
                <span className="text-[10px] font-black text-blue-200 uppercase tracking-widest">Curva ABC (Top {summaryMetrics.topCount})</span>
            </div>
            <div className="flex flex-col gap-1 relative z-10">
                {summaryMetrics.dsMedioTop ? (
                  <>
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-black text-white leading-none">{summaryMetrics.dsMedioTop}%</span>
                      <span className="text-[10px] text-blue-200 font-bold uppercase mb-0.5">DS Médio</span>
                    </div>
                    <p className="text-[9px] text-blue-100/70 font-medium leading-tight mt-1">
                      Qualidade D-0 do grupo (<strong className="text-white">Top 20%</strong>) que mais roda no período selecionado.
                    </p>
                  </>
                ) : (
                  <span className="text-[10px] text-blue-200 font-bold mt-2">Dados insuficientes no período.</span>
                )}
            </div>
          </div>
        </div>
      )}'


      <div className="bg-white dark:bg-[#1f232d] rounded-2xl shadow-sm border border-[#113366] overflow-hidden flex flex-col relative">
        <div className="overflow-auto custom-scrollbar w-full max-h-[55vh] min-h-[300px]">
          <table className="w-full border-collapse text-center">
            <thead>
              <tr className="bg-[#113366] text-white tracking-widest text-[9px] xl:text-[10px]">
                <th className="p-3 text-left sticky left-0 top-0 z-[40] bg-[#113366] border-r border-white/20 min-w-[200px] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.3)]">
                  CONDUTOR
                </th>
                
                <th className="p-2 border-r border-white/20 sticky top-0 z-[30] bg-[#113366] min-w-[70px]">
                  REGIONAL
                </th>
                
                <th className="p-2 border-r border-white/20 sticky top-0 z-[30] bg-[#113366] min-w-[65px] leading-tight opacity-70" title="Semana -3">
                  DS D0<br/><span className="text-[7px] font-medium">({matrix.wksPast?.[2] || 'W-3'})</span>
                </th>
                <th className="p-2 border-r border-white/20 sticky top-0 z-[30] bg-[#113366] min-w-[65px] leading-tight opacity-80" title="Semana -2">
                  DS D0<br/><span className="text-[7px] font-medium">({matrix.wksPast?.[1] || 'W-2'})</span>
                </th>
                <th className="p-2 border-r border-white/20 sticky top-0 z-[30] bg-[#113366] min-w-[65px] leading-tight opacity-90" title="Semana -1">
                  DS D0<br/><span className="text-[7px] font-medium">({matrix.wksPast?.[0] || 'W-1'})</span>
                </th>

                <th className="p-2 border-r border-white/20 sticky top-0 z-[30] bg-[#113366] min-w-[70px] leading-tight text-white font-black" title="Semana Atual Focada">
                  DS D0<br/><span className="text-[8px] text-yellow-300">({targetWeek})</span>
                </th>
                <th className="p-2 border-r border-white/20 sticky top-0 z-[30] bg-[#113366] min-w-[80px] leading-tight text-white font-black" title="Comparação com a média das 3 semanas anteriores">
                  EVOLUÇÃO<br/><span className="text-[7px] text-slate-300 font-medium">(vs Média 3 sem)</span>
                </th>
                
                <th className="p-2 border-r border-white/20 sticky top-0 z-[30] bg-[#113366] min-w-[60px]">
                  <Truck className="mx-auto text-yellow-300" size={12}/>
                </th>
                
                {matrix.headers.map(col => (
                  <th key={col.label} className="p-1.5 border-r border-white/10 min-w-[32px] opacity-90 sticky top-0 z-[30] bg-[#113366]">
                    {formatDateHeader(col.label)}
                  </th>
                ))}
                
                <th 
                  className="p-2 bg-[#EE4D2D] hover:bg-[#D0011B] cursor-pointer transition-colors group select-none min-w-[70px] sticky top-0 right-0 z-[40] shadow-[-2px_0_5px_-2px_rgba(0,0,0,0.3)]"
                  onClick={toggleSort}
                >
                  <div className="flex items-center justify-center gap-1 font-black">
                    TOTAL <ArrowUpDown className={`transition-opacity ${sortConfig.direction ? 'opacity-100 text-yellow-300' : 'opacity-40 group-hover:opacity-100'}`} size={10} />
                  </div>
                </th>
              </tr>
            </thead>
            
            <tbody className="divide-y divide-slate-100 dark:divide-gray-800">
              {selectedHubs.length === 0 ? (
                <tr>
                  <td colSpan={matrix.headers.length + 9} className="p-16 text-center">
                    <div className="flex flex-col items-center justify-center space-y-2 text-slate-400">
                      <MapPin className="text-[#EE4D2D] animate-bounce" size={32}/>
                      <span className="font-black text-sm text-slate-600 dark:text-slate-200">Selecione seu Hub</span>
                    </div>
                  </td>
                </tr>
              ) : matrix.rows.length === 0 ? (
                <tr><td colSpan={matrix.headers.length + 9} className="p-10 text-center font-black text-slate-400 text-xs">Nenhum motorista encontrado.</td></tr>
              ) : (
                paginatedRows.map((row) => (
                  <tr key={row.id} className="even:bg-slate-50 odd:bg-white dark:even:bg-gray-800/40 dark:odd:bg-[#15171e] hover:bg-orange-50 dark:hover:bg-gray-700 transition-colors">
                    
                    <td className="px-4 py-2 text-left sticky left-0 z-[20] even:bg-slate-50 odd:bg-white dark:even:bg-gray-800 dark:odd:bg-[#15171e] border-r border-slate-200 dark:border-gray-700 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                      <div className="font-black text-[#113366] dark:text-blue-400 text-[12px] truncate max-w-[190px] leading-tight">{row.id}</div>
                      {row.nome && <div className="text-[10px] text-slate-500 font-bold truncate max-w-[190px] leading-tight" title={row.nome}>{row.nome}</div>}
                      <div className="text-[9px] text-slate-400 font-bold uppercase truncate max-w-[190px] leading-tight mt-0.5">{row.hub}</div>
                    </td>

                    <td className="p-2 border-r border-slate-200 dark:border-gray-700 text-[10px] font-black text-slate-600 dark:text-slate-300 uppercase">
                      {row.regional}
                    </td>

                    <td className="p-2 border-r border-slate-200 dark:border-gray-700 text-[10px] font-bold bg-slate-100/50 dark:bg-gray-800/50 opacity-60">
                      {row.dsPast3 !== undefined ? <span className={row.dsPast3 >= 95 ? 'text-emerald-500' : row.dsPast3 >= 90 ? 'text-yellow-500' : 'text-[#D0011B]'}>{row.dsPast3.toFixed(1)}%</span> : '-'}
                    </td>
                    <td className="p-2 border-r border-slate-200 dark:border-gray-700 text-[10px] font-bold bg-slate-100/50 dark:bg-gray-800/50 opacity-75">
                      {row.dsPast2 !== undefined ? <span className={row.dsPast2 >= 95 ? 'text-emerald-500' : row.dsPast2 >= 90 ? 'text-yellow-500' : 'text-[#D0011B]'}>{row.dsPast2.toFixed(1)}%</span> : '-'}
                    </td>
                    <td className="p-2 border-r border-slate-200 dark:border-gray-700 text-[10px] font-bold bg-slate-100/50 dark:bg-gray-800/50 opacity-90">
                      {row.dsPast1 !== undefined ? <span className={row.dsPast1 >= 95 ? 'text-emerald-500' : row.dsPast1 >= 90 ? 'text-yellow-500' : 'text-[#D0011B]'}>{row.dsPast1.toFixed(1)}%</span> : '-'}
                    </td>

                    <td className="p-2 border-r border-slate-200 dark:border-gray-700 text-[11px] font-black bg-blue-50/30 dark:bg-blue-900/10">
                      {row.dsAtual !== undefined ? (
                        <span className={row.dsAtual >= 95 ? 'text-emerald-500' : row.dsAtual >= 90 ? 'text-yellow-500' : 'text-[#D0011B]'}>
                           {row.dsAtual.toFixed(1)}%
                        </span>
                      ) : '-'}
                    </td>

                    <td className="p-2 border-r border-slate-200 dark:border-gray-700 text-[11px] font-black bg-slate-50/50 dark:bg-[#1a1d24]">
                      {row.dsDiff !== null ? (
                        <div className={`flex items-center justify-center gap-0.5 ${row.dsDiff > 0 ? 'text-emerald-500' : row.dsDiff < 0 ? 'text-[#D0011B]' : 'text-slate-400'}`}>
                           {row.dsDiff > 0 ? <TrendingUp size={12} strokeWidth={3}/> : row.dsDiff < 0 ? <TrendingDown size={12} strokeWidth={3}/> : <Minus size={12}/>}
                           <span>{Math.abs(row.dsDiff).toFixed(1)}%</span>
                        </div>
                      ) : <span className="text-slate-400">-</span>}
                    </td>

                    <td className="p-2 border-r border-slate-100 dark:border-gray-800 text-[10px] font-black text-slate-500">{row.modal}</td>
                    
                    {matrix.headers.map(col => {
                      const status = row.days[col.label];
                      const config = STATUS_MAP[status] || STATUS_MAP['INDISP'];
                      return (
                        <td key={col.label} className="p-0 border-r border-slate-50 dark:border-gray-800">
                          <div className={`w-full h-10 flex items-center justify-center ${config.color} hover:opacity-80 transition-opacity cursor-default`} title={`${row.id} - ${col.label}: ${config.label}`}>
                            {config.icon}
                          </div>
                        </td>
                      );
                    })}
                    
                    <td className="p-2 font-black text-[13px] text-[#EE4D2D] bg-orange-50 dark:bg-orange-900/10 border-l border-orange-200 dark:border-orange-900/30 sticky right-0 z-[20] shadow-[-2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                      {row.total}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="px-4 py-2 border-t border-[#113366] flex justify-between items-center bg-slate-50 dark:bg-[#1f232d] shrink-0 z-50">
          <div className="flex items-center gap-3">
            <div className="text-[9px] font-black text-[#113366] dark:text-slate-400 uppercase tracking-widest bg-white dark:bg-gray-800 px-2 py-1 rounded border border-slate-200 dark:border-gray-700 shadow-sm">
              Total: {matrix.rows.length} motoristas
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button 
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(p => p - 1)}
              className="p-1 rounded bg-white dark:bg-gray-800 text-[#113366] dark:text-white hover:bg-slate-200 dark:hover:bg-gray-700 disabled:opacity-30 transition-all shadow-sm border border-slate-200 dark:border-gray-700"
            >
              <ChevronLeft size={14}/>
            </button>
            <span className="text-[10px] font-black text-[#113366] dark:text-white uppercase tracking-wider">Pág {currentPage}/{totalPages}</span>
            <button 
              disabled={currentPage === totalPages || totalPages === 0}
              onClick={() => setCurrentPage(p => p + 1)}
              className="p-1 rounded bg-white dark:bg-gray-800 text-[#113366] dark:text-white hover:bg-slate-200 dark:hover:bg-gray-700 disabled:opacity-30 transition-all shadow-sm border border-slate-200 dark:border-gray-700"
            >
              <ChevronRight size={14}/>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}