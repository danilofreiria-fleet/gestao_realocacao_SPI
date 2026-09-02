import React, { useState, useMemo, useEffect } from 'react';
import { Search, MapPin, AlertTriangle, TrendingDown, TrendingUp, ChevronLeft, ChevronRight, Activity, Layers, ChevronDown, BarChart2, UserMinus, ShieldAlert } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, LabelList } from 'recharts';
import { CLUSTERS_POR_HUB } from '../../constants/cluster_SPI_SPM'; 
import { MAPA_REGIONAL_COMPLETO, getHubsPermitidos } from '../../constants/regionais';

// ============================================================================
// CACHES DE ALTA PERFORMANCE & VACINAS
// ============================================================================
const SANITIZE_CACHE = new Map();
const PARSED_DATE_CACHE = new Map();

const padronizarHubLocal = (nome) => {
  if (!nome) return "";
  let n = String(nome).trim();
  let nLimpo = n.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, '');
  if (nLimpo.includes("ribeiraopretoesta")) return "LM Hub_SP_RibeirãoPretoEstaça";
  if (nLimpo.includes("sumare") && nLimpo.includes("veneza")) return "LM Hub_SP_Sumaré_Nova Veneza";
  return n;
};

const fastSanitizeHub = (str) => {
  if (!str) return "";
  let cached = SANITIZE_CACHE.get(str);
  if (cached) return cached;
  let s = padronizarHubLocal(str);
  let sanitized = s.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  sanitized = sanitized.replace(/[_-]\d+$/, "").replace(/[^A-Z0-9]/g, '');
  SANITIZE_CACHE.set(str, sanitized);
  return sanitized;
};

const fastSanitizeCluster = (str) => {
  if (!str) return "";
  const key = `C_${str}`;
  let cached = SANITIZE_CACHE.get(key);
  if (cached) return cached;
  let s = String(str).toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  s = s.replace(/[^A-Z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
  SANITIZE_CACHE.set(key, s);
  return s;
};

const isDateFast = (val) => {
  if (!val || typeof val !== 'string') return false;
  const s = val.trim();
  if (s.length < 8) return false;
  return (s[4] === '-' && s[7] === '-') || (s[2] === '/' && s[5] === '/'); 
};

const fastParseDate = (s) => {
  if (!s) return null;
  let str = String(s).trim();
  let cached = PARSED_DATE_CACHE.get(str);
  if (cached) return cached;
  let dStr = str.length > 10 ? str.substring(0,10) : str;
  if (dStr.indexOf('/') !== -1) {
      const parts = dStr.split('/');
      if (parts.length === 3) dStr = `${parts[2].length === 2 ? '20'+parts[2] : parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
  }
  const res = dStr + 'T12:00:00';
  PARSED_DATE_CACHE.set(str, res);
  return res;
};

export default function EstresseClusterTable({ 
  data = [], dispoData = [], atPisoClusterData = [], recusasData = [], atExpedidaData = [], filtrosGlobais = {} 
}) {
  const currentRegional = localStorage.getItem("selectedRegional") || 'TODOS';
  
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedModal, setSelectedModal] = useState(''); 
  const [expandedHubs, setExpandedHubs] = useState({});
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(15);
  const [sortConfig, setSortConfig] = useState({ key: 'estresse', direction: 'desc' });

  const MODAIS = ['PASSEIO', 'FIORINO', 'MOTO', 'VAN'];

  const esqueletoBase = useMemo(() => {
    const permitidos = new Set();
    const mapaLimpoRegs = new Map();
    const isAll = currentRegional === 'BOTH' || currentRegional === 'TODAS' || currentRegional === 'TODOS' || currentRegional === 'ALL';
    
    const permittedHubsList = isAll ? [] : (getHubsPermitidos(currentRegional) || []);
    const permittedSanitized = permittedHubsList.map(fastSanitizeHub);

    Object.keys(MAPA_REGIONAL_COMPLETO).forEach(k => {
      const reg = MAPA_REGIONAL_COMPLETO[k] || "";
      const hC = fastSanitizeHub(k);
      mapaLimpoRegs.set(hC, reg);
      if (isAll || reg.toUpperCase().includes(String(currentRegional).toUpperCase()) || permittedSanitized.includes(hC)) {
        permitidos.add(hC);
      }
    });

    const aggsTpl = {};
    const resolverCache = new Map();
    let totalClusters = 0;

    if (CLUSTERS_POR_HUB) {
      Object.entries(CLUSTERS_POR_HUB).forEach(([hubRaw, clusters]) => {
         const hC = fastSanitizeHub(hubRaw);
         if (!permitidos.has(hC)) return; 
         
         aggsTpl[hC] = { 
           hub: String(hubRaw).trim().toUpperCase(), 
           dispo: 0, atPiso: 0, recusas: 0, expedidas: 0,
           clustersMap: {}
         };
         
         clusters.forEach(cRaw => {
           const cC = fastSanitizeCluster(cRaw);
           aggsTpl[hC].clustersMap[cC] = { cluster: cRaw, dispo: 0, atPiso: 0, recusas: 0, expedidas: 0 };
           resolverCache.set(`${hC}|${cC}`, cC);
           totalClusters++;
         });
         aggsTpl[hC].clustersMap['OUTROS'] = { cluster: 'OUTROS / NÃO MAPEADO', dispo: 0, atPiso: 0, recusas: 0, expedidas: 0 };
      });
    }

    return { aggsTpl, resolverCache, mapaLimpoRegs, totalClusters, permitidos };
  }, [currentRegional]);

  const matrizEstresse = useMemo(() => {
    const { regional = [], station = [], turno = [], dataInicio = '', dataFim = '', semana = '', mes = '' } = filtrosGlobais;
    const aggs = JSON.parse(JSON.stringify(esqueletoBase.aggsTpl)); 
    const historicoDiario = {}; 

    const dataInicioObj = dataInicio ? new Date(dataInicio + 'T00:00:00') : null;
    const dataFimObj = dataFim ? new Date(dataFim + 'T23:59:59') : null;

    const isValidDate = (dateStr) => {
      const iso = fastParseDate(dateStr);
      if (!iso) return false;
      const dObj = new Date(iso);
      if (isNaN(dObj.getTime())) return false; 
      if (dataInicioObj && dObj < dataInicioObj) return false;
      if (dataFimObj && dObj > dataFimObj) return false;
      if (mes && String(dObj.getMonth() + 1).padStart(2, '0') !== mes) return false;
      
      if (semana) {
        const dCopy = new Date(Date.UTC(dObj.getFullYear(), dObj.getMonth(), dObj.getDate()));
        const dayNum = dCopy.getUTCDay() || 7;
        dCopy.setUTCDate(dCopy.getUTCDate() + 4 - dayNum);
        const yearStart = new Date(Date.UTC(dCopy.getUTCFullYear(), 0, 1));
        const wk = `W-${String(Math.ceil((((dCopy - yearStart) / 86400000) + 1) / 7)).padStart(2, '0')}`;
        if (wk !== semana) return false;
      }
      return true;
    };

    const resolveToAgg = (hC, cC) => {
        const hubAgg = aggs[hC];
        if (!hubAgg) return null; 
        if (!cC || cC === "NAOPREENCHIDO" || cC === "SEMCLUSTER") return { hubAgg, clusterAgg: hubAgg.clustersMap['OUTROS'] };
        
        let targetCKey = esqueletoBase.resolverCache.get(`${hC}|${cC}`);
        if (!targetCKey) {
           const truthKeys = Object.keys(hubAgg.clustersMap).filter(k => k !== 'OUTROS');
           targetCKey = truthKeys.find(k => k.includes(cC) || cC.includes(k));
           if (!targetCKey) targetCKey = 'OUTROS';
           esqueletoBase.resolverCache.set(`${hC}|${cC}`, targetCKey);
        }
        return { hubAgg, clusterAgg: hubAgg.clustersMap[targetCKey] };
    };

    const injectAggs = (hubRaw, clusterRaw, dataRaw, campo, qtd) => {
      const hC = fastSanitizeHub(hubRaw);
      const cC = fastSanitizeCluster(clusterRaw);
      
      const resolved = resolveToAgg(hC, cC);
      // 🔥 VACINA: Impede que clusters bugados causem o crash de "undefined" no painel
      if (!resolved || !resolved.clusterAgg) return; 

      resolved.hubAgg[campo] += qtd;
      resolved.clusterAgg[campo] += qtd;

      const isoDate = fastParseDate(dataRaw)?.split('T')[0];
      if (isoDate) {
        const dKey = `${hC}|${resolved.clusterAgg.cluster}|${isoDate}`;
        if (!historicoDiario[dKey]) historicoDiario[dKey] = { dispo: 0, expedidas: 0, atPiso: 0, recusas: 0 };
        historicoDiario[dKey][campo] += qtd;
      }
    };

    const parseNumFast = (val) => {
      if (!val) return 0;
      if (typeof val === 'number') return val;
      let s = String(val);
      if (s.indexOf(',') !== -1) s = s.replace(/\./g, '').replace(',', '.');
      return Number(s) || 0;
    };

    let totalDispoGlobal = 0;
    if (data && data.length > 0) {
      const len = data.length;
      for (let i = 1; i < len; i++) {
        const row = data[i];
        const hubRaw = String(row[4] || "");
        if (hubRaw && esqueletoBase.permitidos.has(fastSanitizeHub(hubRaw))) {
            if (!selectedModal) totalDispoGlobal += parseNumFast(row[24]);
            else if (selectedModal === 'PASSEIO') totalDispoGlobal += parseNumFast(row[21]);
            else if (selectedModal === 'FIORINO') totalDispoGlobal += parseNumFast(row[20]);
            else if (selectedModal === 'MOTO') totalDispoGlobal += parseNumFast(row[22]);
            else if (selectedModal === 'VAN') totalDispoGlobal += parseNumFast(row[23]);
        }
      }
    }

    if (dispoData && dispoData.length > 1) {
      const len = dispoData.length;
      for (let i = 1; i < len; i++) {
        const row = dispoData[i];
        const hubRaw = padronizarHubLocal(row[0]);
        if (!hubRaw) continue;
        const hC = fastSanitizeHub(hubRaw);
        if (!aggs[hC]) continue;

        let dateIdx = 4;
        for (let k = 4; k <= 8; k++) { if (isDateFast(row[k])) { dateIdx = k; break; } }
        
        const clusterRaw = dateIdx === 4 ? String(row[1] || "") : row.slice(1, dateIdx - 2).join(", ");
        const turnoLinha = String(row[dateIdx - 2] || "").trim().toUpperCase();
        const modalRaw = String(row[dateIdx - 1] || "").trim().toUpperCase();
        const dataRaw = row[dateIdx];
        const qtd = parseNumFast(row[dateIdx + 1]);
        
        if (!dataRaw || qtd === 0) continue;
        let tConf = turnoLinha === 'SD' ? 'PM1' : turnoLinha === 'PM' ? 'PM2' : turnoLinha;
        const subreg = MAPA_REGIONAL_COMPLETO[hubRaw] || esqueletoBase.mapaLimpoRegs.get(hC) || ""; 
        
        if (regional.length > 0 && !regional.includes(subreg)) continue;
        if (station.length > 0 && !station.includes(hubRaw)) continue;
        if (turno.length > 0 && !turno.includes(tConf)) continue;
        if (!isValidDate(dataRaw)) continue;
        if (selectedModal && !modalRaw.includes(selectedModal)) continue;

        injectAggs(hubRaw, clusterRaw, dataRaw, 'dispo', qtd);
      }
    }

    if (atPisoClusterData && atPisoClusterData.length > 1) {
      const len = atPisoClusterData.length;
      for (let i = 1; i < len; i++) {
        if (selectedModal) continue; 
        const row = atPisoClusterData[i];
        const hubRaw = padronizarHubLocal(row[3])
        if (!hubRaw) continue;
        const hC = fastSanitizeHub(hubRaw);
        if (!aggs[hC]) continue;

        let qtdIdx = 5;
        for (let k = row.length - 1; k >= 5; k--) {
           if (row[k] !== undefined && String(row[k]).trim() !== "") { qtdIdx = k; break; }
        }
        
        const clusterRaw = qtdIdx === 5 ? String(row[4] || "") : row.slice(4, qtdIdx).join(", ");
        const dataRaw = row[0];
        const qtd = parseNumFast(row[qtdIdx]);
        const subreg = MAPA_REGIONAL_COMPLETO[hubRaw] || esqueletoBase.mapaLimpoRegs.get(hC) || ""; 
     
        if (!dataRaw || qtd === 0) continue;
        if (regional.length > 0 && !regional.includes(subreg)) continue;
        if (station.length > 0 && !station.includes(hubRaw)) continue;
        if (!isValidDate(dataRaw)) continue;

        injectAggs(hubRaw, clusterRaw, dataRaw, 'atPiso', qtd);
      }
    }

    if (recusasData && recusasData.length > 1) {
      const len = recusasData.length;
      for (let i = 1; i < len; i++) {
        const row = recusasData[i];
        const hubRaw = padronizarHubLocal(row[4]);
        if (!hubRaw) continue;
        const hC = fastSanitizeHub(hubRaw);
        if (!aggs[hC]) continue;

        let dateIdx = 8;
        for (let k = 8; k <= 12; k++) { if (isDateFast(row[k])) { dateIdx = k; break; } }
        
        const clusterRaw = dateIdx === 8 ? String(row[6] || "") : row.slice(6, dateIdx - 1).join(", ");
        const tConf = String(row[dateIdx - 1] || "").trim().toUpperCase();
        const dataRaw = row[dateIdx];
        const modalRaw = String(row[dateIdx + 2] || "").trim().toUpperCase(); 
        const subreg = MAPA_REGIONAL_COMPLETO[hubRaw] || esqueletoBase.mapaLimpoRegs.get(hC) || ""; 

        if (!dataRaw || !clusterRaw) continue;
        if (regional.length > 0 && !regional.includes(subreg)) continue;
        if (station.length > 0 && !station.includes(hubRaw)) continue;
        if (turno.length > 0 && !turno.includes(tConf)) continue;
        if (!isValidDate(dataRaw)) continue;

        if (selectedModal) {
          if (selectedModal === 'FIORINO' && !modalRaw.includes('FIORINO') && !modalRaw.includes('UTIL')) continue;
          else if (selectedModal !== 'FIORINO' && !modalRaw.includes(selectedModal)) continue;
        }

        injectAggs(hubRaw, clusterRaw, dataRaw, 'recusas', 1);
      }
    }

    if (atExpedidaData && atExpedidaData.length > 1) {
      const len = atExpedidaData.length;
      for (let i = 1; i < len; i++) {
        const row = atExpedidaData[i];
        const hubRaw = padronizarHubLocal(row[1]);
        if (!hubRaw) continue;
        const hC = fastSanitizeHub(hubRaw);
        if (!aggs[hC]) continue;

        let dateIdx = 5;
        for (let k = 5; k <= 9; k++) { if (isDateFast(row[k])) { dateIdx = k; break; } }

        const tConf = String(row[2] || "").trim().toUpperCase();
        const modalRaw = String(row[3] || "").trim().toUpperCase();
        const clusterRaw = dateIdx === 5 ? String(row[4] || "") : row.slice(4, dateIdx).join(", ");
        const dataRaw = row[dateIdx];
        const subreg = MAPA_REGIONAL_COMPLETO[hubRaw] || esqueletoBase.mapaLimpoRegs.get(hC) || ""; 

        if (!dataRaw) continue;
        if (regional.length > 0 && !regional.includes(subreg)) continue;
        if (station.length > 0 && !station.includes(hubRaw)) continue;
        if (turno.length > 0 && !turno.includes(tConf)) continue;
        if (!isValidDate(dataRaw)) continue;

        if (selectedModal) {
          if (selectedModal === 'FIORINO' && !modalRaw.includes('FIORINO') && !modalRaw.includes('UTIL')) continue;
          else if (selectedModal !== 'FIORINO' && !modalRaw.includes(selectedModal)) continue;
        }

        injectAggs(hubRaw, clusterRaw, dataRaw, 'expedidas', 1);
      }
    }

    const uniqueDates = new Set();
    Object.keys(historicoDiario).forEach(k => uniqueDates.add(k.split('|')[2]));
    const dCount = Math.max(1, uniqueDates.size);

    const pontosDeAtritoPorCluster = {};
    Object.entries(historicoDiario).forEach(([dKey, valores]) => {
      const parts = dKey.split('|');
      const clKey = `${parts[0]}|${parts[1]}`;
      const totalDemandaDia = valores.expedidas + valores.atPiso + valores.recusas;
      const estresseDia = valores.dispo > 0 ? (totalDemandaDia / valores.dispo) : 0;
      
      if (estresseDia > 1.20) {
        if (!pontosDeAtritoPorCluster[clKey]) pontosDeAtritoPorCluster[clKey] = 0;
        pontosDeAtritoPorCluster[clKey] += 1;
      }
    });

    let resumo = { totalDispo: totalDispoGlobal, demandaTotal: 0, deficitGeral: 0, dCount };

    const linhas = Object.values(aggs).map(hAgg => {
      const hubDemanda = hAgg.expedidas + hAgg.atPiso + hAgg.recusas;
      const hubEstresse = hAgg.dispo > 0 ? (hubDemanda / hAgg.dispo) : (hubDemanda > 0 ? 9.9 : 0);
      const hubDeficit = hubDemanda - hAgg.dispo;
      const hubFrotaReal = hAgg.dispo - hAgg.recusas;

      resumo.demandaTotal += hubDemanda;

      const clustersFiltrados = Object.values(hAgg.clustersMap)
        .filter(c => c.dispo > 0 || c.expedidas > 0 || c.atPiso > 0 || c.recusas > 0)
        .map(cAgg => {
          const cDemanda = cAgg.expedidas + cAgg.atPiso + cAgg.recusas;
          const cEstresse = cAgg.dispo > 0 ? (cDemanda / cAgg.dispo) : (cDemanda > 0 ? 9.9 : 0);
          const cDeficit = cDemanda - cAgg.dispo;
          const cFrotaReal = cAgg.dispo - cAgg.recusas;
          
          const cKeyLookup = `${fastSanitizeHub(hAgg.hub)}|${cAgg.cluster}`;
          const diasEstressados = pontosDeAtritoPorCluster[cKeyLookup] || 0;
          
          return { ...cAgg, demandaTotal: cDemanda, estresse: cEstresse, deficit: cDeficit, frotaReal: cFrotaReal, diasEstressados };
        });

      clustersFiltrados.sort((a,b) => a.cluster.localeCompare(b.cluster));

      return { 
        ...hAgg, demandaTotal: hubDemanda, estresse: hubEstresse, 
        deficit: hubDeficit, frotaReal: hubFrotaReal, clusters: clustersFiltrados 
      };
    });

    resumo.deficitGeral = resumo.demandaTotal - resumo.totalDispo;
    return { linhas, resumo };
  }, [data, dispoData, atPisoClusterData, recusasData, atExpedidaData, filtrosGlobais, selectedModal, esqueletoBase]);

  const filteredAndSortedRows = useMemo(() => {
    let result = matrizEstresse.linhas.filter(h => h.clusters.length > 0);
    if (searchTerm) {
      const term = fastSanitizeCluster(searchTerm);
      result = result.filter(r => fastSanitizeHub(r.hub).includes(term) || r.clusters.some(c => fastSanitizeCluster(c.cluster).includes(term)));
    }
    result.sort((a, b) => {
      if (a[sortConfig.key] < b[sortConfig.key]) return sortConfig.direction === 'asc' ? -1 : 1;
      if (a[sortConfig.key] > b[sortConfig.key]) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
    return result;
  }, [matrizEstresse.linhas, searchTerm, sortConfig]);

  const clustersComRiscoChurn = useMemo(() => {
    const todos = [];
    matrizEstresse.linhas.forEach(h => {
      h.clusters.forEach(c => {
        if (c.diasEstressados > 0) todos.push({ hub: h.hub, ...c });
      });
    });
    return todos.sort((a, b) => b.diasEstressados - a.diasEstressados);
  }, [matrizEstresse.linhas]);

  useEffect(() => { setCurrentPage(1); }, [filteredAndSortedRows.length, itemsPerPage]);
  const totalPages = Math.max(1, Math.ceil(filteredAndSortedRows.length / itemsPerPage));
  const paginatedRows = filteredAndSortedRows.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const toggleHub = (hubName) => setExpandedHubs(prev => ({ ...prev, [hubName]: !prev[hubName] }));

  const chartData = useMemo(() => {
    const list = [];
    const dCount = matrizEstresse.resumo.dCount || 1;
    filteredAndSortedRows.forEach(h => { 
      h.clusters.forEach(c => list.push({ 
        ...c, 
        chartName: `${h.hub.split('_').pop()} - ${c.cluster}`,
        dispo: Math.round(c.dispo / dCount),
        expedidas: Math.round(c.expedidas / dCount),
        atPiso: Math.round(c.atPiso / dCount),
        recusas: Math.round(c.recusas / dCount),
        frotaReal: Math.round(c.frotaReal / dCount)
      })) 
    });
    return list.sort((a, b) => b.estresse - a.estresse).slice(0, 15);
  }, [filteredAndSortedRows, matrizEstresse.resumo.dCount]);

  const requestSort = (key) => {
    let direction = 'desc';
    if (sortConfig.key === key && sortConfig.direction === 'desc') direction = 'asc';
    setSortConfig({ key, direction });
  };

  const getStatusBadge = (estresse) => {
    if (estresse === 0) return <span className="bg-slate-100 text-slate-500 px-2 py-0.5 rounded text-[10px] font-black uppercase">Sem Demanda</span>;
    if (estresse < 0.50) return <span className="bg-emerald-100 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded text-[10px] font-black uppercase">Folga Segura</span>;
    if (estresse <= 0.99) return <span className="bg-yellow-100 text-yellow-700 border border-yellow-200 px-2 py-0.5 rounded text-[10px] font-black uppercase">Atenção (Margem Curta)</span>;
    if (estresse <= 1.25) return <span className="bg-orange-100 text-orange-700 border border-orange-200 px-2 py-0.5 rounded text-[10px] font-black uppercase">Risco (Gargalo)</span>;
    return <span className="bg-red-100 text-red-700 border border-red-200 px-2 py-0.5 rounded text-[10px] font-black uppercase shadow-sm">Ruptura Crítica</span>;
  };

  const getEstresseColor = (estresse) => {
    if (estresse === 0) return 'text-slate-400';
    if (estresse < 0.50) return 'text-emerald-600';
    if (estresse <= 0.99) return 'text-yellow-600';
    if (estresse <= 1.25) return 'text-orange-500';
    return 'text-[#D0011B]';
  };

  const dCount = matrizEstresse.resumo.dCount || 1;

  return (
    <div className="flex flex-col gap-6">
      <div className="bg-white dark:bg-[#1f232d] rounded-2xl shadow-sm border border-[#113366] overflow-hidden flex flex-col mt-4">
        <div className="p-5 border-b border-slate-100 dark:border-gray-800 flex flex-col md:flex-row justify-between items-center gap-4 bg-slate-50 dark:bg-[#15171e]">
          <div className="flex items-center gap-2">
            <Activity className="text-[#EE4D2D]" size={20} />
            <h3 className="text-sm font-black text-[#113366] dark:text-white uppercase tracking-wide">Mapeamento de Pressão Operacional</h3>
          </div>
          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="relative w-full md:w-56">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
              <input 
                type="text" placeholder="Buscar Station ou Cluster..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-lg py-1.5 pl-9 pr-3 text-xs font-bold outline-none text-slate-700 dark:text-white"
              />
            </div>
            <select
              value={selectedModal}
              onChange={(e) => setSelectedModal(e.target.value)}
              className="w-full md:w-48 bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-lg py-1.5 px-3 text-xs font-bold outline-none cursor-pointer uppercase text-slate-700 dark:text-white"
            >
              <option value="">🚙 Todos os Modais</option>
              {MODAIS.map(modal => <option key={modal} value={modal}>{modal}</option>)}
            </select>
          </div>
        </div>

        {selectedModal && (
          <div className="bg-yellow-50 dark:bg-yellow-900/20 px-5 py-2 text-[10px] font-bold text-yellow-700 dark:text-yellow-400 border-b border-yellow-100 dark:border-yellow-900/50 flex items-center gap-1.5">
            <AlertTriangle size={12} />
            Como a base de AT no Piso não possui quebra por modal, ela foi isolada do cálculo para não distorcer o Estresse da {selectedModal}.
          </div>
        )}

        <div className="overflow-auto w-full custom-scrollbar max-h-[60vh] min-h-[400px] border-b border-slate-200 dark:border-gray-700">
          <table className="w-full border-collapse text-center relative">
            <thead className="text-white tracking-widest text-[10px] uppercase font-black">
              <tr>
                <th className="p-3 text-left w-[200px] bg-[#113366] cursor-pointer hover:bg-white/10 transition-colors sticky top-0 left-0 z-[50] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.3)]" onClick={() => requestSort('hub')}>Station / Cluster</th>
                <th className="p-3 border-l border-white/20 bg-[#113366] cursor-pointer hover:bg-white/10 transition-colors sticky top-0 z-[40]" onClick={() => requestSort('dispo')}>Frota Dispo <br/><span className="text-[8px] font-medium normal-case text-slate-300">(Média/Dia)</span></th>
                <th className="p-3 cursor-pointer hover:bg-white/10 transition-colors bg-[#113366] sticky top-0 z-[40]" onClick={() => requestSort('expedidas')}>Expedidas <br/><span className="text-[8px] font-medium normal-case text-slate-300">(Média/Dia)</span></th>
                <th className={`p-3 cursor-pointer hover:bg-white/10 transition-colors bg-[#113366] sticky top-0 z-[40] ${selectedModal ? 'opacity-30' : ''}`} onClick={() => requestSort('atPiso')}>AT Piso <br/><span className="text-[8px] font-medium normal-case text-slate-300">(Média/Dia)</span></th>
                <th className="p-3 cursor-pointer hover:bg-white/10 transition-colors bg-[#113366] sticky top-0 z-[40]" onClick={() => requestSort('recusas')}>Recusas <br/><span className="text-[8px] font-medium normal-case text-slate-300">(Média/Dia)</span></th>
                <th className="p-3 border-l border-white/20 cursor-pointer hover:bg-white/10 transition-colors text-[#EE4D2D] bg-[#113366] sticky top-0 z-[40]" onClick={() => requestSort('frotaReal')}>Frota Real <br/><span className="text-[8px] font-medium normal-case text-slate-300">(Média/Dia)</span></th>
                <th className="p-3 border-l border-white/20 cursor-pointer hover:bg-white/10 transition-colors bg-[#EE4D2D] sticky top-0 z-[40]" onClick={() => requestSort('estresse')}>Índice de Estresse</th>
                <th className="p-3 bg-[#EE4D2D] sticky top-0 z-[40]">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-gray-800 font-bold text-xs bg-white dark:bg-[#1f232d]">
              {paginatedRows.length === 0 ? (
                <tr><td colSpan={8} className="p-12 text-center text-slate-400 font-bold">Nenhum dado cruzado encontrado.</td></tr>
              ) : (
                paginatedRows.map((rowHub) => {
                  const isOpen = !!expandedHubs[rowHub.hub];
                  return (
                    <React.Fragment key={rowHub.hub}>
                      <tr onClick={() => toggleHub(rowHub.hub)} className="hover:bg-orange-50 dark:hover:bg-gray-700/50 transition-colors bg-slate-50/80 dark:bg-[#15171e] cursor-pointer">
                        <td className="p-3 text-left text-[#113366] dark:text-blue-400 font-black border-r border-slate-100 dark:border-gray-800 flex items-center gap-2 sticky left-0 z-[30] bg-slate-50/90 dark:bg-[#15171e]/90 backdrop-blur-sm shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                          {isOpen ? <ChevronDown size={16} className="text-[#EE4D2D] shrink-0"/> : <ChevronRight size={16} className="text-slate-400 shrink-0"/>}
                          <MapPin size={13} className="text-[#EE4D2D] shrink-0" />
                          <span className="truncate">{rowHub.hub}</span>
                        </td>
                        <td className="p-3 text-[#113366] dark:text-blue-300 font-black">{rowHub.dispo > 0 ? Math.round(rowHub.dispo / dCount) : '-'}</td>
                        <td className="p-3 text-slate-600 dark:text-gray-300">{rowHub.expedidas > 0 ? Math.round(rowHub.expedidas / dCount) : '-'}</td>
                        <td className={`p-3 text-orange-500 ${selectedModal ? 'opacity-30' : ''}`}>{rowHub.atPiso > 0 ? Math.round(rowHub.atPiso / dCount) : '-'}</td>
                        <td className="p-3 text-[#D0011B]">{rowHub.recusas > 0 ? Math.round(rowHub.recusas / dCount) : '-'}</td>
                        <td className={`p-3 font-black border-l border-slate-100 dark:border-gray-800 ${rowHub.frotaReal < 0 ? 'text-[#D0011B]' : 'text-emerald-600'}`}>{Math.round(rowHub.frotaReal / dCount)}</td>
                        <td className={`p-3 font-black text-sm border-l border-slate-100 dark:border-gray-800 ${getEstresseColor(rowHub.estresse)}`}>
                          {rowHub.estresse === 9.9 ? 'CRÍTICO' : rowHub.estresse === 0 ? '0.0x' : `${rowHub.estresse.toFixed(2)}x`}
                        </td>
                        <td className="p-3">{getStatusBadge(rowHub.estresse)}</td>
                      </tr>
                      {isOpen && rowHub.clusters.map((c, idx) => (
                        <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-gray-800/50 transition-colors bg-white dark:bg-[#1f232d]">
                          <td className="p-3 text-left text-slate-600 dark:text-gray-300 flex items-center gap-2 pl-10 border-r border-slate-100 dark:border-gray-800 sticky left-0 z-[30] bg-white/90 dark:bg-[#1f232d]/90 backdrop-blur-sm">
                            <Layers size={11} className="text-slate-400 shrink-0" /> 
                            <span className={`truncate text-[10px] tracking-wider uppercase ${c.cluster === 'OUTROS / NÃO MAPEADO' ? 'text-red-500' : ''}`}>{c.cluster}</span>
                          </td>
                          <td className="p-3 text-[#113366] dark:text-blue-300">{c.dispo > 0 ? Math.round(c.dispo / dCount) : '-'}</td>
                          <td className="p-3 text-slate-600 dark:text-gray-300">{c.expedidas > 0 ? Math.round(c.expedidas / dCount) : '-'}</td>
                          <td className={`p-3 text-orange-500 ${selectedModal ? 'opacity-30' : ''}`}>{c.atPiso > 0 ? Math.round(c.atPiso / dCount) : '-'}</td>
                          <td className="p-3 text-[#D0011B]">{c.recusas > 0 ? Math.round(c.recusas / dCount) : '-'}</td>
                          <td className={`p-3 font-black border-l border-slate-100 dark:border-gray-800 ${c.frotaReal < 0 ? 'text-[#D0011B]' : 'text-emerald-600'}`}>{Math.round(c.frotaReal / dCount)}</td>
                          <td className={`p-3 font-black text-sm border-l border-slate-100 dark:border-gray-800 bg-slate-50 dark:bg-[#15171e] ${getEstresseColor(c.estresse)}`}>
                            {c.estresse === 9.9 ? 'CRÍTICO' : c.estresse === 0 ? '0.0x' : `${c.estresse.toFixed(2)}x`}
                          </td>
                          <td className="p-3 bg-slate-50 dark:bg-[#15171e]">{getStatusBadge(c.estresse)}</td>
                        </tr>
                      ))}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="px-4 py-3 border-t border-[#113366] flex justify-between items-center bg-slate-50 dark:bg-[#15171e] shrink-0">
          <div className="text-[9px] font-black text-[#113366] dark:text-slate-400 uppercase tracking-widest bg-white dark:bg-gray-800 px-2 py-1 rounded border border-slate-200 dark:border-gray-700 shadow-sm flex items-center gap-2">
            <span>Station: {filteredAndSortedRows.length}</span>
            <span className="h-3 w-px bg-slate-200"></span>
            <span className="text-[#EE4D2D]">Clusters Mapeados: {esqueletoBase.totalClusters}</span>
          </div>
          <div className="flex items-center gap-2">
            <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} className="p-1 rounded bg-white dark:bg-gray-800 text-[#113366] hover:bg-slate-200 disabled:opacity-30 shadow-sm border border-slate-200"><ChevronLeft size={14}/></button>
            <span className="text-[10px] font-black text-[#113366] dark:text-white uppercase tracking-wider">Pág {currentPage}/{totalPages}</span>
            <button disabled={currentPage === totalPages || totalPages === 0} onClick={() => setCurrentPage(p => p + 1)} className="p-1 rounded bg-white dark:bg-gray-800 text-[#113366] hover:bg-slate-200 disabled:opacity-30 shadow-sm border border-slate-200"><ChevronRight size={14}/></button>
          </div>
        </div>
      </div>

      {/* 🔥 GRÁFICOS DO TOP 15 */}
      {chartData.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-2">
          <div className="bg-white dark:bg-[#1f232d] p-5 rounded-2xl border border-slate-200 dark:border-gray-800 shadow-sm flex flex-col">
            <div className="flex items-center gap-2 mb-4 border-b border-slate-100 dark:border-gray-800 pb-3">
              <BarChart2 size={20} className="text-[#113366] dark:text-blue-400" />
              <div>
                <h4 className="text-sm font-black text-[#113366] dark:text-white uppercase tracking-wider">Saldo de Frota Real</h4>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Disponibilidade - Recusas (Top 15 da lista)</p>
              </div>
            </div>
            <div className="flex-1 w-full min-h-[350px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 30, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#e2e8f0" />
                  <XAxis type="number" tick={{ fontSize: 10 }} />
                  <YAxis dataKey="chartName" type="category" width={180} tick={{ fontSize: 10, fill: '#64748b', fontWeight: 'bold' }} />
                  <Tooltip contentStyle={{ borderRadius: '8px', fontWeight: 'bold' }} formatter={(value) => [value, 'Frota Real']}/>
                  <Bar dataKey="frotaReal" name="Frota Real" fill="#113366" radius={[0, 4, 4, 0]} barSize={20}>
                    <LabelList dataKey="frotaReal" position="right" style={{ fill: '#113366', fontSize: 10, fontWeight: 'bold' }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white dark:bg-[#1f232d] p-5 rounded-2xl border border-slate-200 dark:border-gray-800 shadow-sm flex flex-col">
            <div className="flex items-center gap-2 mb-4 border-b border-slate-100 dark:border-gray-800 pb-3">
              <Activity size={20} className="text-[#EE4D2D]" />
              <div>
                <h4 className="text-sm font-black text-[#113366] dark:text-white uppercase tracking-wider">Composição do Cluster (100%)</h4>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Proporção entre Oferta e Demanda Absorvida/Rejeitada</p>
              </div>
            </div>
            <div className="flex-1 w-full min-h-[350px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} stackOffset="expand" layout="vertical" margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#e2e8f0" />
                  <XAxis type="number" tickFormatter={(tick) => `${(tick * 100).toFixed(0)}%`} tick={{ fontSize: 10 }} />
                  <YAxis dataKey="chartName" type="category" width={180} tick={{ fontSize: 10, fill: '#64748b', fontWeight: 'bold' }} />
                  <Tooltip contentStyle={{ borderRadius: '8px', fontWeight: 'bold' }}/>
                  <Legend wrapperStyle={{ fontSize: '11px', fontWeight: 'bold', paddingTop: '10px' }} />
                  <Bar dataKey="dispo" name="Frota Disponível" stackId="a" fill="#113366" barSize={20} />
                  <Bar dataKey="expedidas" name="Expedidas" stackId="a" fill="#10b981" />
                  <Bar dataKey="atPiso" name="AT Piso" stackId="a" fill="#f59e0b" />
                  <Bar dataKey="recusas" name="Recusas" stackId="a" fill="#ef4444" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* MONITOR DE RISCO DE CHURN DE MOTORISTAS */}
      <div className="bg-white dark:bg-[#1f232d] rounded-2xl border border-slate-200 dark:border-gray-800 p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-5 border-b border-slate-100 dark:border-gray-800 pb-3">
          <UserMinus className="text-[#D0011B]" size={22} />
          <div>
            <h3 className="text-sm font-black text-[#113366] dark:text-white uppercase tracking-wide flex items-center gap-2">
              Alerta de Churn Preditivo (Retenção de Drivers)
            </h3>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
              Clusters onde o estresse diário superou 1.20x de saturação no período analisado
            </p>
          </div>
        </div>

        {clustersComRiscoChurn.length === 0 ? (
          <div className="text-center py-8 text-slate-400 font-bold text-xs border border-dashed border-slate-200 dark:border-gray-700 rounded-xl">
              🟢 Excelente! Nenhum ponto de atrito repetitivo detectado para os motoristas no período atual.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {clustersComRiscoChurn.slice(0, 6).map((item, index) => {
              const statusRisco = item.diasEstressados >= 3 ? 'CRÍTICO' : 'MÉDIO';
              return (
                <div key={`churn-${index}`} className={`p-4 rounded-xl border flex flex-col justify-between transition-all ${statusRisco === 'CRÍTICO' ? 'bg-red-50/50 dark:bg-red-950/20 border-red-200 dark:border-red-900/40' : 'bg-amber-50/50 dark:bg-amber-950/10 border-amber-200 dark:border-amber-900/30'}`}>
                  <div>
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-[10px] font-black text-slate-400 truncate max-w-[60%]">{item.hub.split('_').pop()}</span>
                      <span className={`text-[9px] font-black px-2 py-0.5 rounded flex items-center gap-1 shadow-sm ${statusRisco === 'CRÍTICO' ? 'bg-red-600 text-white animate-pulse' : 'bg-amber-500 text-slate-900'}`}>
                        <ShieldAlert size={10} /> RISCO {statusRisco}
                      </span>
                    </div>
                    <h4 className="font-black text-slate-800 dark:text-white text-xs uppercase tracking-wide truncate">{item.cluster}</h4>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-200/60 dark:border-gray-800 flex justify-between items-end">
                    <div className="flex flex-col">
                      <span className="text-[10px] text-slate-400 font-bold uppercase">Dias c/ Estresse &gt; 1.2:</span>
                      <span className={`text-lg font-black ${statusRisco === 'CRÍTICO' ? 'text-red-600' : 'text-amber-600'}`}>{item.diasEstressados} dias</span>
                    </div>
                    <span className="text-[9px] font-black uppercase text-slate-500 underline decoration-dotted cursor-help" title="Motoristas expostos a filas repetitivas tendem a abandonar a rota. Ação recomendada: Injetar frota volante ou reduzir SPR.">
                      Ação Requerida
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}