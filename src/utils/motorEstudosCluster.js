import { MAPA_REGIONAL_COMPLETO, getHubsPermitidos } from '../constants/regionais';
import { CLUSTERS_POR_HUB } from '../constants/cluster_SPI_SPM'; 



const padronizarHubLocal = (nome) => {
  if (!nome) return "";
  let n = String(nome).trim();
  let nLimpo = n.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, '');
  
  
  if (nLimpo.includes("ribeiraopretoesta")) return "LM Hub_SP_RibeirãoPretoEstaça";
  if (nLimpo.includes("sumare") && nLimpo.includes("veneza")) return "LM Hub_SP_Sumaré_Nova Veneza";
  
  return n;
};

// ==========================================
// CACHES E SANITIZADORES (ALTA PERFORMANCE)
// ==========================================
const SANITIZE_CACHE = new Map();

const fastSanitizeHub = (str) => {
  if (!str) return "";
  let cached = SANITIZE_CACHE.get(str);
  if (cached) return cached;

  // rodando dentro do limpador
  let s = padronizarHubLocal(str);
  
  let sanitized = s.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  sanitized = sanitized.replace(/[_-]\d+$/, "");
  sanitized = sanitized.replace(/[^A-Z0-9]/g, '');

  SANITIZE_CACHE.set(str, sanitized);
  return sanitized;
};

const fastSanitizeCluster = (str) => {
  if (!str) return "";
  const key = `C_${str}`;
  let cached = SANITIZE_CACHE.get(key);
  if (cached) return cached;
  let cleaned = String(str).toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
  SANITIZE_CACHE.set(key, cleaned);
  return cleaned;
};

// Detecção O(1) de Datas
const isDateFast = (val) => {
  if (!val) return false;
  const s = String(val).trim();
  return s.length >= 8 && (s.indexOf('-') === 4 || s.indexOf('/') === 2);
};

const TRUTH_MAP = new Map();
if (CLUSTERS_POR_HUB) {
  Object.entries(CLUSTERS_POR_HUB).forEach(([hub, clusters]) => {
    const hC = fastSanitizeHub(hub);
    if (!TRUTH_MAP.has(hC)) TRUTH_MAP.set(hC, []);
    const list = TRUTH_MAP.get(hC);
    clusters.forEach(c => { list.push({ clean: fastSanitizeCluster(c), original: c }); });
  });
}

const RESOLVER_CACHE = new Map();
const resolveClusterName = (hubRaw, clusterRaw) => {
  const hC = fastSanitizeHub(hubRaw);
  const cC = fastSanitizeCluster(clusterRaw);
  if (!cC || cC === "NAOPREENCHIDO" || cC === "SEMCLUSTER") return "SEM CLUSTER";
  
  const cacheKey = `${hC}|${cC}`;
  let cached = RESOLVER_CACHE.get(cacheKey);
  if (cached) return cached;
  
  let finalName = "OUTROS / NÃO MAPEADO";
  const truthList = TRUTH_MAP.get(hC);
  if (truthList) {
    let match = truthList.find(x => x.clean === cC);
    if (!match) match = truthList.find(x => x.clean.includes(cC) || cC.includes(x.clean)); 
    if (match) finalName = match.original;
  } else {
    finalName = String(clusterRaw).toUpperCase().trim();
  }
  RESOLVER_CACHE.set(cacheKey, finalName);
  return finalName;
};

const parseUniversalDate = (dateStr) => {
  if (!dateStr) return null;
  let s = String(dateStr).trim().split('T')[0].split(' ')[0];
  if (s.includes('/')) {
    const parts = s.split('/');
    return `${parts[2].length === 2 ? '20'+parts[2] : parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}T12:00:00`;
  }
  return `${s}T12:00:00`;
};

const getISOWeek = (isoDate) => {
  if (!isoDate) return "";
  const d = new Date(isoDate);
  const dCopy = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = dCopy.getUTCDay() || 7;
  dCopy.setUTCDate(dCopy.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(dCopy.getUTCFullYear(), 0, 1));
  return `W-${String(Math.ceil((((dCopy - yearStart) / 86400000) + 1) / 7)).padStart(2, '0')}`;
};

const parseNum = (val) => {
  if (!val) return 0;
  if (typeof val === 'number') return val;
  const s = String(val).trim();
  if (s.indexOf(',') === -1) return Number(s) || 0;
  return Number(s.replace(/\./g, '').replace(',', '.')) || 0;
};

const buildHeadersAndSortRows = (colTimeSet, aggs, viewMode) => {
  const MESES_ORDEM = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];
  const headers = Array.from(colTimeSet).sort((a, b) => {
    if (viewMode === 'mes') return MESES_ORDEM.indexOf(a) - MESES_ORDEM.indexOf(b);
    if (viewMode === 'dia') {
      const [d1, m1] = a.split('/');
      const [d2, m2] = b.split('/');
      if (m1 !== m2) return Number(m1) - Number(m2);
      return Number(d1) - Number(d2);
    }
    return a.localeCompare(b);
  });

  const rows = Object.values(aggs).map(h => {
    const clustersList = Object.values(h.clustersMap).sort((a, b) => a.cluster.localeCompare(b.cluster));
    return { hub: h.hub, valoresHub: h.valoresHub, clusters: clustersList };
  }).sort((a, b) => a.hub.localeCompare(b.hub));

  return { headers, rows };
};

// ==========================================
// EXPORTS DOS MOTORES (O "BACKEND")
// ==========================================

// 1. MOTOR DISPONIBILIDADE
export const calcularMatrizDispo = async ({ dispoData, filtrosGlobais, selectedModal, currentRegional, viewMode }) => {
  const { regional = [], station = [], turno = [], dataInicio = '', dataFim = '', semana = '', mes = '' } = filtrosGlobais;
  const aggs = {};
  const colTimeSet = new Set();
  const stationsSet = new Set();
  const modalSet = new Set();

  const dataInicioObj = dataInicio ? new Date(dataInicio + 'T00:00:00') : null;
  const dataFimObj = dataFim ? new Date(dataFim + 'T23:59:59') : null;

  const isAll = !currentRegional || ['BOTH', 'TODAS', 'TODOS', 'ALL'].includes(String(currentRegional).toUpperCase());
  const permittedHubsList = isAll ? [] : (getHubsPermitidos(currentRegional) || []);
  const extraPermitted = isAll ? [] : Object.keys(MAPA_REGIONAL_COMPLETO).filter(k => {
    const reg = MAPA_REGIONAL_COMPLETO[k] || "";
    return String(reg).toUpperCase().includes(String(currentRegional).toUpperCase());
  });
  const permittedHubsSet = new Set([...permittedHubsList, ...extraPermitted].map(fastSanitizeHub));

  // Laço Síncrono (Instantâneo)
  if (dispoData && dispoData.length > 1) {
    const len = dispoData.length;
    for (let i = 1; i < len; i++) {
      const row = dispoData[i];
      const hubRaw = padronizarHubLocal(row[0]);
      if (!hubRaw) continue;
      
      const hC = fastSanitizeHub(hubRaw);
      if (!isAll && !permittedHubsSet.has(hC)) continue;

      let dateIdx = 4;
      for (let k = 4; k <= 8; k++) { if (isDateFast(row[k])) { dateIdx = k; break; } }
      
      let clusterRaw = dateIdx === 4 ? String(row[1] || "") : row.slice(1, dateIdx - 2).join(", ");
      const finalCluster = resolveClusterName(hubRaw, clusterRaw);
      if (finalCluster === "SEM CLUSTER") continue;

      let turnoLinha = String(row[dateIdx - 2] || "").trim().toUpperCase();
      let turnoConfirmado = turnoLinha === 'SD' ? 'PM1' : turnoLinha === 'PM' ? 'PM2' : turnoLinha;

      const modalRow = String(row[dateIdx - 1] || "").trim().toUpperCase();
      if (modalRow) modalSet.add(modalRow);

      const dataRaw = row[dateIdx]; 
      const qtd = parseNum(row[dateIdx + 1]); 
      const subreg = MAPA_REGIONAL_COMPLETO[hubRaw] || ""; 

      if (!dataRaw || qtd === 0) continue;
      if (regional.length > 0 && !regional.some(r => subreg.toUpperCase().includes(String(r).toUpperCase()))) continue;
      if (station.length > 0 && !station.includes(hubRaw)) continue;
      if (turno.length > 0 && !turno.includes(turnoConfirmado)) continue;
      if (selectedModal && !modalRow.includes(selectedModal)) continue; 

      const isoDate = parseUniversalDate(dataRaw);
      if (!isoDate) continue;
      const dObj = new Date(isoDate);
      if (isNaN(dObj.getTime())) continue;
      if (dataInicioObj && dObj < dataInicioObj) continue;
      if (dataFimObj && dObj > dataFimObj) continue;
      if (mes && String(dObj.getMonth() + 1).padStart(2, '0') !== mes) continue;
      if (semana && getISOWeek(isoDate) !== semana) continue;

      let dynamicKey = "";
      if (viewMode === 'dia') dynamicKey = `${String(dObj.getDate()).padStart(2, '0')}/${String(dObj.getMonth() + 1).padStart(2, '0')}`;
      else if (viewMode === 'semana') dynamicKey = getISOWeek(isoDate);
      else if (viewMode === 'mes') dynamicKey = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'][dObj.getMonth()];

      if (!dynamicKey) continue;

      colTimeSet.add(dynamicKey);
      stationsSet.add(hubRaw.toUpperCase());

      if (!aggs[hC]) aggs[hC] = { hub: hubRaw.toUpperCase(), valoresHub: {}, clustersMap: {} };
      if (aggs[hC].valoresHub[dynamicKey] === undefined) aggs[hC].valoresHub[dynamicKey] = 0;
      aggs[hC].valoresHub[dynamicKey] += qtd;

      const clusterCleanKey = fastSanitizeCluster(finalCluster);
      if (!aggs[hC].clustersMap[clusterCleanKey]) aggs[hC].clustersMap[clusterCleanKey] = { cluster: finalCluster, valores: {} };
      if (aggs[hC].clustersMap[clusterCleanKey].valores[dynamicKey] === undefined) aggs[hC].clustersMap[clusterCleanKey].valores[dynamicKey] = 0;
      aggs[hC].clustersMap[clusterCleanKey].valores[dynamicKey] += qtd;
    }
  }

  const { headers, rows } = buildHeadersAndSortRows(colTimeSet, aggs, viewMode);
  const modaisUnicos = Array.from(modalSet).sort();

  return { headers, rows, stationsUnicas: Array.from(stationsSet).sort(), modaisUnicos };
};

// 2. MOTOR AT PISO
export const calcularMatrizPiso = async ({ atPisoClusterData, filtrosGlobais, viewMode, currentRegional }) => {
  const { regional = [], station = [], dataInicio = '', dataFim = '', semana = '', mes = '' } = filtrosGlobais;
  const aggs = {};
  const colTimeSet = new Set();
  const stationsSet = new Set();
  const clusterRankMap = {};

  const dataInicioObj = dataInicio ? new Date(dataInicio + 'T00:00:00') : null;
  const dataFimObj = dataFim ? new Date(dataFim + 'T23:59:59') : null;

  const isAll = !currentRegional || ['BOTH', 'TODAS', 'TODOS', 'ALL'].includes(String(currentRegional).toUpperCase());
  const permittedHubsList = isAll ? [] : (getHubsPermitidos(currentRegional) || []);
  const extraPermitted = isAll ? [] : Object.keys(MAPA_REGIONAL_COMPLETO).filter(k => {
    const reg = MAPA_REGIONAL_COMPLETO[k] || "";
    return String(reg).toUpperCase().includes(String(currentRegional).toUpperCase());
  });
  const permittedHubsSet = new Set([...permittedHubsList, ...extraPermitted].map(fastSanitizeHub));

  if (atPisoClusterData && atPisoClusterData.length > 1) {
    const len = atPisoClusterData.length;
    for (let i = 1; i < len; i++) {
      const row = atPisoClusterData[i];
      const hubRaw = padronizarHubLocal(row[3]);
      if (!hubRaw) continue;
      
      const hC = fastSanitizeHub(hubRaw);
      if (!isAll && !permittedHubsSet.has(hC)) continue;

      let qtdIdx = 5;
      for (let k = row.length - 1; k >= 5; k--) {
         if (row[k] !== undefined && String(row[k]).trim() !== "") { qtdIdx = k; break; }
      }
      const clusterRaw = qtdIdx === 5 ? String(row[4] || "") : row.slice(4, qtdIdx).join(", ");
      const finalCluster = resolveClusterName(hubRaw, clusterRaw);
      if (finalCluster === "SEM CLUSTER") continue;

      const dataStr = String(row[0] || "").trim();
      const subreg = MAPA_REGIONAL_COMPLETO[hubRaw] || ""; 
      const qtdAt = parseNum(row[qtdIdx]);

      if (!dataStr || qtdAt === 0) continue;
      if (regional.length > 0 && !regional.some(r => subreg.toUpperCase().includes(String(r).toUpperCase()))) continue;
      if (station.length > 0 && !station.includes(hubRaw)) continue;

      const isoDate = parseUniversalDate(dataStr);
      const dObj = isoDate ? new Date(isoDate) : null;
      
      if (dObj) {
        if (dataInicioObj && dObj < dataInicioObj) continue;
        if (dataFimObj && dObj > dataFimObj) continue;
        if (mes && String(dObj.getMonth() + 1).padStart(2, '0') !== mes) continue;
      }
      if (semana && getISOWeek(isoDate) !== semana) continue;

      let chaveTempo = "";
      if (viewMode === 'dia') {
        if (dObj) chaveTempo = `${String(dObj.getDate()).padStart(2, '0')}/${String(dObj.getMonth() + 1).padStart(2, '0')}`;
      } else if (viewMode === 'semana') {
        chaveTempo = getISOWeek(isoDate);
      } else if (viewMode === 'mes') {
        if (dObj) chaveTempo = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'][dObj.getMonth()];
      }

      if (!chaveTempo) continue;

      colTimeSet.add(chaveTempo);
      stationsSet.add(hubRaw.toUpperCase());

      if (!aggs[hC]) aggs[hC] = { hub: hubRaw.toUpperCase(), valoresHub: {}, clustersMap: {} };
      if (aggs[hC].valoresHub[chaveTempo] === undefined) aggs[hC].valoresHub[chaveTempo] = 0;
      aggs[hC].valoresHub[chaveTempo] += qtdAt;

      const clusterCleanKey = fastSanitizeCluster(finalCluster);
      if (!aggs[hC].clustersMap[clusterCleanKey]) aggs[hC].clustersMap[clusterCleanKey] = { cluster: finalCluster, valores: {} };
      if (aggs[hC].clustersMap[clusterCleanKey].valores[chaveTempo] === undefined) aggs[hC].clustersMap[clusterCleanKey].valores[chaveTempo] = 0;
      aggs[hC].clustersMap[clusterCleanKey].valores[chaveTempo] += qtdAt;

      const nomeUnicoCluster = `${hubRaw.toUpperCase()} - ${finalCluster}`;
      if (!clusterRankMap[nomeUnicoCluster]) clusterRankMap[nomeUnicoCluster] = 0;
      clusterRankMap[nomeUnicoCluster] += qtdAt;
    }
  }

  const { headers, rows } = buildHeadersAndSortRows(colTimeSet, aggs, viewMode);
  const ranking = Object.entries(clusterRankMap).map(([name, total]) => ({ name, total })).sort((a, b) => b.total - a.total).slice(0, 12);

  return { headers, rows, stationsUnicas: Array.from(stationsSet).sort(), ranking };
};

// 3. MOTOR EXPEDIDAS
export const calcularMatrizExpedida = async ({ atExpedidaData, filtrosGlobais, selectedModal, viewMode, currentRegional }) => {
  const { regional = [], station = [], turno = [], dataInicio = '', dataFim = '', semana = '', mes = '' } = filtrosGlobais;
  const aggs = {};
  const colTimeSet = new Set();
  const stationsSet = new Set();
  const clusterRankMap = {};
  const modalRankMap = {};

  const dataInicioObj = dataInicio ? new Date(dataInicio + 'T00:00:00') : null;
  const dataFimObj = dataFim ? new Date(dataFim + 'T23:59:59') : null;

  const isAll = !currentRegional || ['BOTH', 'TODAS', 'TODOS', 'ALL'].includes(String(currentRegional).toUpperCase());
  const permittedHubsList = isAll ? [] : (getHubsPermitidos(currentRegional) || []);
  const extraPermitted = isAll ? [] : Object.keys(MAPA_REGIONAL_COMPLETO).filter(k => {
    const reg = MAPA_REGIONAL_COMPLETO[k] || "";
    return String(reg).toUpperCase().includes(String(currentRegional).toUpperCase());
  });
  const permittedHubsSet = new Set([...permittedHubsList, ...extraPermitted].map(fastSanitizeHub));

  if (atExpedidaData && atExpedidaData.length > 1) {
    const len = atExpedidaData.length;
    for (let i = 1; i < len; i++) {
      const row = atExpedidaData[i];
      const hubRaw = padronizarHubLocal(row[1]);
      if (!hubRaw) continue;
      
      const hC = fastSanitizeHub(hubRaw);
      if (!isAll && !permittedHubsSet.has(hC)) continue;

      let dateIdx = 5;
      for (let k = 5; k <= 9; k++) { if (isDateFast(row[k])) { dateIdx = k; break; } }
      
      const clusterRaw = dateIdx === 5 ? String(row[4] || "") : row.slice(4, dateIdx).join(", ");
      const finalCluster = resolveClusterName(hubRaw, clusterRaw);
      if (finalCluster === "SEM CLUSTER") continue;

      const modalRow = String(row[3] || "NÃO INFORMADO").trim().toUpperCase(); 
      const dataStr = String(row[dateIdx] || "").trim(); 
      const tConf = String(row[2] || "").trim().toUpperCase();
      const subreg = MAPA_REGIONAL_COMPLETO[hubRaw] || ""; 

      if (!dataStr) continue;
      if (regional.length > 0 && !regional.some(r => subreg.toUpperCase().includes(String(r).toUpperCase()))) continue;
      if (station.length > 0 && !station.includes(hubRaw)) continue;
      if (turno.length > 0 && !turno.includes(tConf)) continue;
      if (selectedModal) {
        if (selectedModal === 'FIORINO' && !modalRow.includes('FIORINO') && !modalRow.includes('UTIL')) continue;
        else if (selectedModal !== 'FIORINO' && !modalRow.includes(selectedModal)) continue;
      }

      const isoDate = parseUniversalDate(dataStr);
      const dObj = isoDate ? new Date(isoDate) : null;
      if (dObj) {
        if (dataInicioObj && dObj < dataInicioObj) continue;
        if (dataFimObj && dObj > dataFimObj) continue;
        if (mes && String(dObj.getMonth() + 1).padStart(2, '0') !== mes) continue;
      }
      if (semana && getISOWeek(isoDate) !== semana) continue;

      let chaveTempo = "";
      if (viewMode === 'dia') {
        if (dObj) chaveTempo = `${String(dObj.getDate()).padStart(2, '0')}/${String(dObj.getMonth() + 1).padStart(2, '0')}`;
      } else if (viewMode === 'semana') {
        chaveTempo = getISOWeek(isoDate);
      } else if (viewMode === 'mes') {
        if (dObj) chaveTempo = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'][dObj.getMonth()];
      }
      if (!chaveTempo) continue;

      colTimeSet.add(chaveTempo);
      stationsSet.add(hubRaw.toUpperCase());

      if (!aggs[hC]) aggs[hC] = { hub: hubRaw.toUpperCase(), valoresHub: {}, clustersMap: {} };
      if (aggs[hC].valoresHub[chaveTempo] === undefined) aggs[hC].valoresHub[chaveTempo] = 0;
      aggs[hC].valoresHub[chaveTempo] += 1;

      const clusterCleanKey = fastSanitizeCluster(finalCluster);
      if (!aggs[hC].clustersMap[clusterCleanKey]) aggs[hC].clustersMap[clusterCleanKey] = { cluster: finalCluster, valores: {} };
      if (aggs[hC].clustersMap[clusterCleanKey].valores[chaveTempo] === undefined) aggs[hC].clustersMap[clusterCleanKey].valores[chaveTempo] = 0;
      aggs[hC].clustersMap[clusterCleanKey].valores[chaveTempo] += 1;

      const nomeUnicoCluster = `${hubRaw.toUpperCase()} - ${finalCluster}`;
      if (!clusterRankMap[nomeUnicoCluster]) clusterRankMap[nomeUnicoCluster] = 0;
      clusterRankMap[nomeUnicoCluster] += 1;

      if (!modalRankMap[modalRow]) modalRankMap[modalRow] = 0;
      modalRankMap[modalRow] += 1;
    }
  }

  const { headers, rows } = buildHeadersAndSortRows(colTimeSet, aggs, viewMode);
  const rankingClusters = Object.entries(clusterRankMap).map(([name, total]) => ({ name, total })).sort((a, b) => b.total - a.total).slice(0, 10);
  const rankingModais = Object.entries(modalRankMap).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);

  return { headers, rows, stationsUnicas: Array.from(stationsSet).sort(), rankingClusters, rankingModais };
};

// 4. MOTOR RECUSAS
export const calcularMatrizRecusas = async ({ recusasData, filtrosGlobais, selectedModal, viewMode, currentRegional }) => {
  const { regional = [], station = [], turno = [], dataInicio = '', dataFim = '', semana = '', mes = '' } = filtrosGlobais;
  const aggs = {};
  const colTimeSet = new Set();
  const stationsSet = new Set();
  const clusterRankMap = {};
  const motivoRankMap = {};

  const dataInicioObj = dataInicio ? new Date(dataInicio + 'T00:00:00') : null;
  const dataFimObj = dataFim ? new Date(dataFim + 'T23:59:59') : null;

  const isAll = !currentRegional || ['BOTH', 'TODAS', 'TODOS', 'ALL'].includes(String(currentRegional).toUpperCase());
  const permittedHubsList = isAll ? [] : (getHubsPermitidos(currentRegional) || []);
  const extraPermitted = isAll ? [] : Object.keys(MAPA_REGIONAL_COMPLETO).filter(k => {
    const reg = MAPA_REGIONAL_COMPLETO[k] || "";
    return String(reg).toUpperCase().includes(String(currentRegional).toUpperCase());
  });
  const permittedHubsSet = new Set([...permittedHubsList, ...extraPermitted].map(fastSanitizeHub));

  if (recusasData && recusasData.length > 1) {
    const len = recusasData.length;
    for (let i = 1; i < len; i++) {
      const row = recusasData[i];
      const hubRaw = padronizarHubLocal(row[4]);
      if (!hubRaw) continue;
      
      const hC = fastSanitizeHub(hubRaw);
      if (!isAll && !permittedHubsSet.has(hC)) continue;

      let dateIdx = 8;
      for (let k = 8; k <= 12; k++) { if (isDateFast(row[k])) { dateIdx = k; break; } }
      
      const clusterRaw = dateIdx === 8 ? String(row[6] || "") : row.slice(6, dateIdx - 1).join(", ");
      const finalCluster = resolveClusterName(hubRaw, clusterRaw);
      if (finalCluster === "SEM CLUSTER") continue;

      const dataStr = String(row[dateIdx] || "").trim();
      const motivo = String(row[9] || "").trim() || "NÃO INFORMADO";
      const subreg = MAPA_REGIONAL_COMPLETO[hubRaw] || ""; 
      const tConf = String(row[dateIdx - 1] || "").trim().toUpperCase();
      const modalRow = String(row[dateIdx + 2] || "").trim().toUpperCase();

      if (!dataStr) continue;
      if (regional.length > 0 && !regional.some(r => subreg.toUpperCase().includes(String(r).toUpperCase()))) continue;
      if (station.length > 0 && !station.includes(hubRaw)) continue;
      if (turno.length > 0 && !turno.includes(tConf)) continue;
      if (selectedModal) {
        if (selectedModal === 'FIORINO' && !modalRow.includes('FIORINO') && !modalRow.includes('UTIL')) continue;
        else if (selectedModal !== 'FIORINO' && !modalRow.includes(selectedModal)) continue;
      }

      const isoDate = parseUniversalDate(dataStr);
      const dObj = isoDate ? new Date(isoDate) : null;
      if (dObj) {
        if (dataInicioObj && dObj < dataInicioObj) continue;
        if (dataFimObj && dObj > dataFimObj) continue;
        if (mes && String(dObj.getMonth() + 1).padStart(2, '0') !== mes) continue;
      }
      if (semana && getISOWeek(isoDate) !== semana) continue;

      let chaveTempo = "";
      if (viewMode === 'dia') {
        if (dObj) chaveTempo = `${String(dObj.getDate()).padStart(2, '0')}/${String(dObj.getMonth() + 1).padStart(2, '0')}`;
      } else if (viewMode === 'semana') {
        chaveTempo = getISOWeek(isoDate);
      } else if (viewMode === 'mes') {
        if (dObj) chaveTempo = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'][dObj.getMonth()];
      }
      if (!chaveTempo) continue;

      colTimeSet.add(chaveTempo);
      stationsSet.add(hubRaw.toUpperCase());

      if (!aggs[hC]) aggs[hC] = { hub: hubRaw.toUpperCase(), valoresHub: {}, clustersMap: {} };
      if (aggs[hC].valoresHub[chaveTempo] === undefined) aggs[hC].valoresHub[chaveTempo] = 0;
      aggs[hC].valoresHub[chaveTempo] += 1;

      const clusterCleanKey = fastSanitizeCluster(finalCluster);
      if (!aggs[hC].clustersMap[clusterCleanKey]) aggs[hC].clustersMap[clusterCleanKey] = { cluster: finalCluster, valores: {} };
      if (aggs[hC].clustersMap[clusterCleanKey].valores[chaveTempo] === undefined) aggs[hC].clustersMap[clusterCleanKey].valores[chaveTempo] = 0;
      aggs[hC].clustersMap[clusterCleanKey].valores[chaveTempo] += 1;

      const nomeUnicoCluster = `${hubRaw.toUpperCase()} - ${finalCluster}`;
      if (!clusterRankMap[nomeUnicoCluster]) clusterRankMap[nomeUnicoCluster] = 0;
      clusterRankMap[nomeUnicoCluster] += 1;

      if (!motivoRankMap[motivo]) motivoRankMap[motivo] = 0;
      motivoRankMap[motivo] += 1;
    }
  }

  const { headers, rows } = buildHeadersAndSortRows(colTimeSet, aggs, viewMode);
  const rankingClusters = Object.entries(clusterRankMap).map(([name, total]) => ({ name, total })).sort((a, b) => b.total - a.total).slice(0, 10);
  const rankingMotivos = Object.entries(motivoRankMap).map(([name, total]) => ({ name, total })).sort((a, b) => b.total - a.total).slice(0, 10);

  return { headers, rows, stationsUnicas: Array.from(stationsSet).sort(), rankingClusters, rankingMotivos };
};

// 5. MOTOR ESTRESSE E CHURN (CRUZAMENTO TOTAL)
export const calcularMatrizEstresse = async ({
  data, dispoData, atPisoClusterData, recusasData, atExpedidaData, filtrosGlobais, selectedModal, currentRegional
}) => {
  const { regional = [], station = [], turno = [], dataInicio = '', dataFim = '', semana = '', mes = '' } = filtrosGlobais;
  const aggs = {};
  const historicoDiario = {}; 

  const dataInicioObj = dataInicio ? new Date(dataInicio + 'T00:00:00') : null;
  const dataFimObj = dataFim ? new Date(dataFim + 'T23:59:59') : null;

  const isAll = !currentRegional || ['BOTH', 'TODAS', 'TODOS', 'ALL'].includes(String(currentRegional).toUpperCase());
  const permittedHubsList = isAll ? [] : (getHubsPermitidos(currentRegional) || []);
  const extraPermitted = isAll ? [] : Object.keys(MAPA_REGIONAL_COMPLETO).filter(k => {
    const reg = MAPA_REGIONAL_COMPLETO[k] || "";
    return String(reg).toUpperCase().includes(String(currentRegional).toUpperCase());
  });
  const permittedHubsSet = new Set([...permittedHubsList, ...extraPermitted].map(fastSanitizeHub));

  const isValidDate = (dateStr) => {
    const iso = parseUniversalDate(dateStr);
    if (!iso) return false;
    const dObj = new Date(iso);
    if (isNaN(dObj.getTime())) return false;
    if (dataInicioObj && dObj < dataInicioObj) return false;
    if (dataFimObj && dObj > dataFimObj) return false;
    if (mes && String(dObj.getMonth() + 1).padStart(2, '0') !== mes) return false;
    if (semana && getISOWeek(iso) !== semana) return false;
    return true;
  };

  const injectAggs = (hubRaw, clusterRaw, dataRaw, campo, qtd) => {
    const hC = fastSanitizeHub(hubRaw);
    const finalCluster = resolveClusterName(hubRaw, clusterRaw); 
    if (finalCluster === "SEM CLUSTER") return;
    const hubFinalName = String(hubRaw).trim().toUpperCase();

    if (!aggs[hC]) aggs[hC] = { hub: hubFinalName, dispo: 0, atPiso: 0, recusas: 0, expedidas: 0, clustersMap: {} };
    aggs[hC][campo] += qtd;

    const clusterKey = fastSanitizeCluster(finalCluster);
    if (!aggs[hC].clustersMap[clusterKey]) aggs[hC].clustersMap[clusterKey] = { cluster: finalCluster, dispo: 0, atPiso: 0, recusas: 0, expedidas: 0 };
    aggs[hC].clustersMap[clusterKey][campo] += qtd;

    const isoDate = parseUniversalDate(dataRaw)?.substring(0, 10); 
    if (isoDate) {
      const dKey = `${hC}|${finalCluster}|${isoDate}`;
      if (!historicoDiario[dKey]) historicoDiario[dKey] = { dispo: 0, expedidas: 0, atPiso: 0, recusas: 0 };
      historicoDiario[dKey][campo] += qtd;
    }
  };

  let totalDispoGlobal = 0;
  if (data && data.length > 0) {
    const lenData = data.length;
    for (let i = 1; i < lenData; i++) {
      const row = data[i];
      // Garante que só puxa os totais da regional correta também (Opcional, mas seguro)
      const hubRow = padronizarHubLocal(row[4]);
      if (hubRow && (!isAll && !permittedHubsSet.has(fastSanitizeHub(hubRow)))) continue;

      if (!selectedModal) totalDispoGlobal += parseNum(row[24]);
      else {
        if (selectedModal === 'PASSEIO') totalDispoGlobal += parseNum(row[21]);
        else if (selectedModal === 'FIORINO') totalDispoGlobal += parseNum(row[20]);
        else if (selectedModal === 'MOTO') totalDispoGlobal += parseNum(row[22]);
        else if (selectedModal === 'VAN') totalDispoGlobal += parseNum(row[23]);
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
      if (!isAll && !permittedHubsSet.has(hC)) continue;

      let dateIdx = 4;
      for (let k = 4; k <= 8; k++) { if (isDateFast(row[k])) { dateIdx = k; break; } }
      let clusterRaw = dateIdx === 4 ? String(row[1] || "") : row.slice(1, dateIdx - 2).join(", ");
      
      const turnoLinha = String(row[dateIdx - 2] || "").trim().toUpperCase();
      const modalRaw = String(row[dateIdx - 1] || "").trim().toUpperCase();
      const dataRaw = row[dateIdx];
      const qtd = parseNum(row[dateIdx + 1]);
      
      if (!dataRaw || qtd === 0) continue;
      let tConf = turnoLinha === 'SD' ? 'PM1' : turnoLinha === 'PM' ? 'PM2' : turnoLinha;
      const subreg = MAPA_REGIONAL_COMPLETO[hubRaw] || ""; 
      
      if (regional.length > 0 && !regional.some(r => subreg.toUpperCase().includes(String(r).toUpperCase()))) continue;
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
      const hubRaw = padronizarHubLocal(row[3]);
      if (!hubRaw) continue;
      
      const hC = fastSanitizeHub(hubRaw);
      if (!isAll && !permittedHubsSet.has(hC)) continue;

      let qtdIdx = 5;
      for (let k = row.length - 1; k >= 5; k--) {
         if (row[k] !== undefined && String(row[k]).trim() !== "") { qtdIdx = k; break; }
      }
      const clusterRaw = qtdIdx === 5 ? String(row[4] || "") : row.slice(4, qtdIdx).join(", ");
      const dataRaw = row[0];
      const qtd = parseNum(row[qtdIdx]);
      const subreg = MAPA_REGIONAL_COMPLETO[hubRaw] || ""; 

      if (!dataRaw || qtd === 0) continue;
      if (regional.length > 0 && !regional.some(r => subreg.toUpperCase().includes(String(r).toUpperCase()))) continue;
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
      if (!isAll && !permittedHubsSet.has(hC)) continue;

      let dateIdx = 8;
      for (let k = 8; k <= 12; k++) { if (isDateFast(row[k])) { dateIdx = k; break; } }
      const clusterRaw = dateIdx === 8 ? String(row[6] || "") : row.slice(6, dateIdx - 1).join(", ");
      const tConf = String(row[dateIdx - 1] || "").trim().toUpperCase();
      const dataRaw = row[dateIdx];
      const modalRaw = String(row[dateIdx + 2] || "").trim().toUpperCase(); 
      const subreg = MAPA_REGIONAL_COMPLETO[hubRaw] || ""; 

      if (!dataRaw || !clusterRaw) continue;
      if (regional.length > 0 && !regional.some(r => subreg.toUpperCase().includes(String(r).toUpperCase()))) continue;
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
      if (!isAll && !permittedHubsSet.has(hC)) continue;

      let dateIdx = 5;
      for (let k = 5; k <= 9; k++) { if (isDateFast(row[k])) { dateIdx = k; break; } }
      const tConf = String(row[2] || "").trim().toUpperCase();
      const modalRaw = String(row[3] || "").trim().toUpperCase();
      const clusterRaw = dateIdx === 5 ? String(row[4] || "") : row.slice(4, dateIdx).join(", ");
      const dataRaw = row[dateIdx];
      const subreg = MAPA_REGIONAL_COMPLETO[hubRaw] || ""; 

      if (!dataRaw) continue;
      if (regional.length > 0 && !regional.some(r => subreg.toUpperCase().includes(String(r).toUpperCase()))) continue;
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

  let resumo = { totalDispo: totalDispoGlobal, demandaTotal: 0, deficitGeral: 0 };
  const linhas = Object.values(aggs).map(hubObj => {
    const hubDemanda = hubObj.expedidas + hubObj.atPiso + hubObj.recusas;
    hubObj.estresse = hubObj.dispo > 0 ? (hubDemanda / hubObj.dispo) : (hubDemanda > 0 ? 9.9 : 0);
    hubObj.deficit = hubDemanda - hubObj.dispo;
    hubObj.frotaReal = hubObj.dispo - hubObj.recusas;
    hubObj.demandaTotal = hubDemanda;
    resumo.demandaTotal += hubDemanda;

    hubObj.clusters = Object.values(hubObj.clustersMap).map(clObj => {
      const clDemanda = clObj.expedidas + clObj.atPiso + clObj.recusas;
      clObj.estresse = clObj.dispo > 0 ? (clDemanda / clObj.dispo) : (clDemanda > 0 ? 9.9 : 0);
      clObj.deficit = clDemanda - clObj.dispo;
      clObj.frotaReal = clObj.dispo - clObj.recusas;
      clObj.demandaTotal = clDemanda;

      const cKeyLookup = `${fastSanitizeHub(hubObj.hub)}|${clObj.cluster}`;
      clObj.diasEstressados = pontosDeAtritoPorCluster[cKeyLookup] || 0;
      return clObj;
    }).sort((a, b) => a.cluster.localeCompare(b.cluster));

    return hubObj;
  }).sort((a, b) => a.hub.localeCompare(b.hub));

  resumo.deficitGeral = resumo.demandaTotal - resumo.totalDispo;
  return { linhas, resumo };
};