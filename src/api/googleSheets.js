// =================================================================
// VARIÁVEIS DE AMBIENTE (Lendo do .env)
// =================================================================
const WEB_APP_URL = import.meta.env.VITE_WEB_APP_URL;
const SPREADSHEET_ID = import.meta.env.VITE_SPREADSHEET_ID_PRINCIPAL; 
const ID_PLANILHA_REPORTS = import.meta.env.VITE_SPREADSHEET_ID_REPORTS;
const ID_PLANILHA_SOP = import.meta.env.VITE_SPREADSHEET_ID_SOP;
const ID_PLANILHA_LOGS = import.meta.env.VITE_SPREADSHEET_ID_LOGS;
const ID_PERMISSION_SHEET = import.meta.env.VITE_PERMISSION_SHEET;

const ABA_NOME = "CONSOLIDADO-GESTÃO-SPI_REALOCAÇÃO";

// =================================================================
// 🛡️ MOTOR DE FILA INTELIGENTE 2.0 (ANTI-ERRO 429 E LOCK GLOBAL)
// =================================================================
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

let activeRequests = 0;
let globalRateLimitPause = false; // 🔥 O "Sinal Vermelho" Global
const MAX_CONCURRENT_REQUESTS = 2; // Baixamos para 2 para máxima segurança

const fetchWithQueue = async (url, options, retries = 5) => {
  // 1. Catraca: Aguarda se a fila está cheia OU se tomamos bloqueio global
  // O Math.random (Jitter) impede que várias requisições acordem no exato mesmo milissegundo
  while (activeRequests >= MAX_CONCURRENT_REQUESTS || globalRateLimitPause) {
    await sleep(Math.floor(Math.random() * 200) + 100); 
  }

  activeRequests++; // Entrou
  try {
    const response = await fetch(url, options);
    
    // 2. Tomou 429? Ativa o sinal vermelho para todo o sistema!
    if (response.status === 429 && retries > 0) {
      activeRequests--;
      globalRateLimitPause = true; // 🛑 Para todas as outras requisições
      
      const attempt = 6 - retries; // Vai de 1 a 5
      const waitTime = Math.pow(2, attempt) * 1500; // Ex: 3s, 6s, 12s, 24s...
      
      console.warn(`🛑 [ERRO 429] Google bloqueou. Pausa Global de ${waitTime/1000}s (Tentativa ${attempt}/5)...`);
      
      await sleep(waitTime);
      globalRateLimitPause = false; // 🟢 Libera o sinal vermelho
      
      // Coloca a requisição que falhou de volta na fila
      return fetchWithQueue(url, options, retries - 1); 
    }
    
    activeRequests--; // Saiu
    return response;
  } catch (error) {
    activeRequests--;
    throw error;
  }
};

// =================================================================
// HELPERS DE COMPARAÇÃO (À PROVA DE BALAS)
// =================================================================
const padronizarData = (str) => {
  if (!str) return "";
  let val = String(str).trim().split(" ")[0]; 
  if (val.includes('/')) {
    const [d, m, y] = val.split('/');
    let year = y.length === 2 ? `20${y}` : y;
    return `${year}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  if (val.includes('-')) {
    const [y, m, d] = val.split('T')[0].split('-');
    let year = y.length === 2 ? `20${y}` : y;
    return `${year}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  return val;
};

const limpaTexto = (str) => String(str || "").trim().toLowerCase();

const getSheetIdByName = async (spreadsheetId, sheetName, token) => {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties`;
  const response = await fetchWithQueue(url, { headers: { "Authorization": `Bearer ${token}` } });
  const data = await response.json();
  const sheet = data.sheets.find(s => s.properties.title === sheetName);
  if (!sheet) throw new Error(`Aba '${sheetName}' não encontrada.`);
  return sheet.properties.sheetId;
};

const executeDeleteAPI = async (spreadsheetId, sheetId, rowNumber, token) => {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`;
  await fetch(url, {
    method: "POST",
    headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ requests: [{ deleteDimension: { range: { sheetId: sheetId, dimension: "ROWS", startIndex: rowNumber - 1, endIndex: rowNumber } } }] })
  });
};

// =================================================================
// SISTEMA DE LOGS (Com Backup em Array/JSON na Coluna H)
// =================================================================
export const registrarLog = async (acao, dataRef, station, turno, statusInfo, rawData = null) => {
  try {
    const token = localStorage.getItem("spiToken");
    if (!token) return;

    const userEmail = localStorage.getItem("userEmail") || "Analista"; 
    const dataHoraAtual = new Date().toLocaleString('pt-BR');

    const backupSnapshot = rawData && rawData.length > 0 ? JSON.stringify(rawData) : "[]";

    const logData = [
      dataHoraAtual, userEmail, acao, dataRef || "", station || "", turno || "", statusInfo || "Sucesso", backupSnapshot 
    ];

    const url = `https://sheets.googleapis.com/v4/spreadsheets/${ID_PLANILHA_LOGS}/values/LOGS!A:A:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;

    fetch(url, {
      method: "POST",
      headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ values: [logData] })
    }).catch(() => {});
  } catch (e) {
    console.error("Falha ao gravar log:", e);
  }
};

// =================================================================
// GET (Leitura Super Rápida - Usando a Fila)
// =================================================================
export const getConsolidadoData = async () => {
  try {
    const token = localStorage.getItem("spiToken");
    if (!token) throw new Error("Usuário não autenticado. Faça login novamente.");

    const RANGE = `${ABA_NOME}!A:BH`; 
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${RANGE}`;

    const response = await fetchWithQueue(url, {
      method: "GET",
      headers: { "Authorization": `Bearer ${token}`, "Accept": "application/json" }
    });
    
    if (!response.ok) throw new Error(`Erro HTTP: ${response.status} - O Token pode ter expirado.`);

    const result = await response.json(); 
    return result.values ? result.values : [];
  } catch (error) {
    console.error("Erro na API (GET):", error);
    throw error;
  }
};

// =================================================================
// POST (Criar Nova Linha - Via API Oficial)
// =================================================================
export const insertRowData = async (rowData) => {
  try {
    const token = localStorage.getItem("spiToken");
    if (!token) throw new Error("Usuário não autenticado.");

    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${ABA_NOME}!A:A:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ values: [rowData] })
    });

    if (!response.ok) throw new Error(`Erro HTTP: ${response.status}`);
    const jsonResult = await response.json();
    registrarLog("CRIAR", rowData[3], rowData[4], rowData[5], "Salvo no Consolidado Principal", rowData);
    return jsonResult;
  } catch (error) {
    console.error("Erro na API (POST append):", error);
    registrarLog("ERRO_CRIAR", rowData[3], rowData[4], rowData[5], String(error.message), rowData);
    throw error;
  }
};

// =================================================================
// SALVAR DIRETO NAS PLANILHAS DE ORIGEM
// =================================================================
export const salvarNasOrigens = async (payload) => {
  try {
    const token = localStorage.getItem("spiToken");
    if (!token) throw new Error("Usuário não autenticado.");

    const linhaGestao = payload.slice(0, 47);
    const linhaControle = [
      payload[3] ?? "", payload[1] ?? "", payload[4] ?? "", payload[5] ?? "", payload[12] ?? "",
      payload[13] ?? "", payload[14] ?? "", payload[51] ?? "", payload[52] ?? "", payload[53] ?? "",
      payload[54] ?? "", payload[55] ?? "", payload[56] ?? "", payload[57] ?? "", payload[58] ?? "",
      payload[2] ?? "", payload[59] ?? ""
    ];

    const urlGestao = `https://sheets.googleapis.com/v4/spreadsheets/${ID_PLANILHA_REPORTS}/values/'REPORT DIARIO'!A:A:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;
    const urlControle = `https://sheets.googleapis.com/v4/spreadsheets/${ID_PLANILHA_SOP}/values/CONTROLE!A:A:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;

    const [resGestao, resControle] = await Promise.all([
      fetch(urlGestao, { method: "POST", headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ values: [linhaGestao] }) }),
      fetch(urlControle, { method: "POST", headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ values: [linhaControle] }) })
    ]);

    if (!resGestao.ok || !resControle.ok) throw new Error(`Falha nas Origens - Report: ${resGestao.status} | SOP: ${resControle.status}`);

    registrarLog("CRIAR_ORIGENS", payload[3], payload[4], payload[5], "Salvo simultaneamente no Report e SOP");
    return true;
  } catch (error) {
    console.error("Erro ao salvar nas origens:", error);
    registrarLog("ERRO_CRIAR_ORIGENS", payload[3], payload[4], payload[5], String(error.message));
    throw error;
  }
};

// =================================================================
// PUT (Edição em Bloco Cirúrgico com Auto-Cura / Upsert)
// =================================================================
export const updateRowData = async (rowIndex, rowData, oldRowData) => {
  try {
    const token = localStorage.getItem("spiToken");
    if (!token) throw new Error("Usuário não autenticado.");

    const safeVal = (v) => (v === undefined || v === null) ? "" : v;
    const dataAlvo = padronizarData(oldRowData ? oldRowData[3] : rowData[3]);
    const hubAlvo = limpaTexto(oldRowData ? oldRowData[4] : rowData[4]);
    const turnoAlvo = limpaTexto(oldRowData ? oldRowData[5] : rowData[5]);

    console.log("🚀 INICIANDO EDIÇÃO TRIPLA EM BLOCO...");

    try {
      const payloadConsolidado = [{ range: `'${ABA_NOME}'!A${rowIndex}`, values: [rowData.map(safeVal)] }];
      const reqConsol = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values:batchUpdate`, {
        method: "POST", headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ valueInputOption: "USER_ENTERED", data: payloadConsolidado })
      });
      if (!reqConsol.ok) throw new Error(await reqConsol.text());
    } catch (e) { throw new Error(`Falha no Consolidado: ${e.message}`); }

    try {
      const respRep = await fetchWithQueue(`https://sheets.googleapis.com/v4/spreadsheets/${ID_PLANILHA_REPORTS}/values/${encodeURIComponent("'REPORT DIARIO'!A:G")}`, { headers: { "Authorization": `Bearer ${token}` } });
      const dataRep = await respRep.json();
      let encontrouReport = false;
      const linhaGestao = rowData.slice(0, 47).map(safeVal);

      if (dataRep.values) {
        for (let i = dataRep.values.length - 1; i >= 1; i--) {
          const r = dataRep.values[i];
          if (padronizarData(r[3]) === dataAlvo && limpaTexto(r[4]) === hubAlvo && limpaTexto(r[5]) === turnoAlvo) {
            encontrouReport = true;
            const payloadRep = [{ range: `'REPORT DIARIO'!A${i + 1}`, values: [linhaGestao] }];
            const reqRep = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${ID_PLANILHA_REPORTS}/values:batchUpdate`, {
              method: "POST", headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
              body: JSON.stringify({ valueInputOption: "USER_ENTERED", data: payloadRep })
            });
            if (!reqRep.ok) throw new Error(await reqRep.text());
            break;
          }
        }
      }

      if (!encontrouReport) {
        const urlAppendRep = `https://sheets.googleapis.com/v4/spreadsheets/${ID_PLANILHA_REPORTS}/values/'REPORT DIARIO'!A:A:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;
        const reqAppend = await fetch(urlAppendRep, {
          method: "POST", headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ values: [linhaGestao] })
        });
        if (!reqAppend.ok) throw new Error(await reqAppend.text());
      }
    } catch (e) { throw new Error(`Falha no Report: ${e.message}`); }

    try {
      const respSop = await fetchWithQueue(`https://sheets.googleapis.com/v4/spreadsheets/${ID_PLANILHA_SOP}/values/${encodeURIComponent("CONTROLE!A:E")}`, { headers: { "Authorization": `Bearer ${token}` } });
      const dataSop = await respSop.json();
      let encontrouSop = false;
      
      const linhaControle = [
        safeVal(rowData[3]), safeVal(rowData[1]), safeVal(rowData[4]), safeVal(rowData[5]),
        safeVal(rowData[12]), safeVal(rowData[13]), safeVal(rowData[14]), safeVal(rowData[51]),
        safeVal(rowData[52]), safeVal(rowData[53]), safeVal(rowData[54]), safeVal(rowData[55]),
        safeVal(rowData[56]), safeVal(rowData[57]), safeVal(rowData[58]), safeVal(rowData[2]),
        safeVal(rowData[59])
      ];

      if (dataSop.values) {
        for (let i = dataSop.values.length - 1; i >= 1; i--) {
          const r = dataSop.values[i];
          if (padronizarData(r[0]) === dataAlvo && limpaTexto(r[2]) === hubAlvo && limpaTexto(r[3]) === turnoAlvo) {
            encontrouSop = true;
            const payloadSop = [{ range: `CONTROLE!A${i + 1}`, values: [linhaControle] }];
            const reqSop = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${ID_PLANILHA_SOP}/values:batchUpdate`, {
              method: "POST", headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
              body: JSON.stringify({ valueInputOption: "USER_ENTERED", data: payloadSop })
            });
            if (!reqSop.ok) throw new Error(await reqSop.text());
            break;
          }
        }
      }

      if (!encontrouSop) {
        const urlAppendSop = `https://sheets.googleapis.com/v4/spreadsheets/${ID_PLANILHA_SOP}/values/CONTROLE!A:A:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;
        const reqAppendSop = await fetch(urlAppendSop, {
          method: "POST", headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ values: [linhaControle] })
        });
        if (!reqAppendSop.ok) throw new Error(await reqAppendSop.text());
      }
    } catch (e) { throw new Error(`Falha na SOP: ${e.message}`); }

    registrarLog("EDITAR", dataAlvo, hubAlvo, turnoAlvo, "Editado nas origens com sucesso", rowData);
    return { success: true };
  } catch (error) {
    console.error("❌ Erro Crítico na Edição:", error);
    const dataAlvoErr = oldRowData ? oldRowData[3] : rowData[3];
    const hubAlvoErr = oldRowData ? oldRowData[4] : rowData[4];
    const turnoAlvoErr = oldRowData ? oldRowData[5] : rowData[5];
    registrarLog("ERRO_EDITAR", dataAlvoErr, hubAlvoErr, turnoAlvoErr, String(error.message));
    throw error;
  }
};

// =================================================================
// DELETE (Exclusão)
// =================================================================
export const deleteRowData = async (rowIndex, rowData) => {
  try {
    const token = localStorage.getItem("spiToken");
    if (!token) throw new Error("Usuário não autenticado.");

    const dataAlvo = padronizarData(rowData[3]);
    const stationAlvo = limpaTexto(rowData[4]);
    const turnoAlvo = limpaTexto(rowData[5]);

    const gidConsolidado = await getSheetIdByName(SPREADSHEET_ID, ABA_NOME, token);
    await executeDeleteAPI(SPREADSHEET_ID, gidConsolidado, rowIndex, token);

    try {
      const respReport = await fetchWithQueue(`https://sheets.googleapis.com/v4/spreadsheets/${ID_PLANILHA_REPORTS}/values/'REPORT%20DIARIO'!A:G`, { headers: { "Authorization": `Bearer ${token}` } });
      const dataReport = await respReport.json();
      if (dataReport.values) {
        for (let i = dataReport.values.length - 1; i >= 1; i--) {
          const row = dataReport.values[i];
          if (padronizarData(row[3]) === dataAlvo && limpaTexto(row[4]) === stationAlvo && limpaTexto(row[5]) === turnoAlvo) {
            const gidReport = await getSheetIdByName(ID_PLANILHA_REPORTS, "REPORT DIARIO", token);
            await executeDeleteAPI(ID_PLANILHA_REPORTS, gidReport, i + 1, token);
            break; 
          }
        }
      }
    } catch (e) { console.error("Erro Report:", e); }

    try {
      const respSOP = await fetchWithQueue(`https://sheets.googleapis.com/v4/spreadsheets/${ID_PLANILHA_SOP}/values/CONTROLE!A:E`, { headers: { "Authorization": `Bearer ${token}` } });
      const dataSOP = await respSOP.json();
      if (dataSOP.values) {
        for (let i = dataSOP.values.length - 1; i >= 1; i--) {
          const row = dataSOP.values[i];
          if (padronizarData(row[0]) === dataAlvo && limpaTexto(row[2]) === stationAlvo && limpaTexto(row[3]) === turnoAlvo) {
            const gidSOP = await getSheetIdByName(ID_PLANILHA_SOP, "CONTROLE", token);
            await executeDeleteAPI(ID_PLANILHA_SOP, gidSOP, i + 1, token);
            break;
          }
        }
      }
    } catch (e) { console.error("Erro SOP:", e); }

    registrarLog("EXCLUIR", dataAlvo, stationAlvo, turnoAlvo, "Excluído com sucesso", rowData);
    return { success: true };
  } catch (error) { 
    registrarLog("ERRO_EXCLUIR", rowData[3], rowData[4], rowData[5], String(error.message));
    throw error; 
  }
};

// =================================================================
// GET BASE E DADOS GERAIS DA DASHBOARD (Usando a Fila)
// =================================================================
export const getBaseReferenceData = async () => {
  try {
    const token = localStorage.getItem("spiToken");
    if (!token) return [];
    const response = await fetchWithQueue(`https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/BASE!A:Z`, {
      method: "GET", headers: { "Authorization": `Bearer ${token}`, "Accept": "application/json" }
    });
    if (!response.ok) return [];
    const result = await response.json();
    return result.values || [];
  } catch (error) { return []; }
};

export const getDadosRHDashboard = async () => {
  try {
    const token = localStorage.getItem("spiToken");
    if (!token) throw new Error("Usuário não autenticado.");
    const response = await fetchWithQueue(`https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/DADOS_DASHBOARD!A:AD`, {
      method: "GET", headers: { "Authorization": `Bearer ${token}`, "Accept": "application/json" }
    });
    if (!response.ok) return [];
    const result = await response.json();
    return result.values || [];
  } catch (error) { return []; }
};

export const getDadosAtPiso = async () => {
  try {
    const token = localStorage.getItem("spiToken");
    if (!token) throw new Error("Usuário não autenticado.");
    const ID_PLANILHA_AT_PISO = "1hppCHTfDUsPOo_DmAVhc3eSSzeKD8Yx4UgEjFzW_y_4";
    const response = await fetchWithQueue(`https://sheets.googleapis.com/v4/spreadsheets/${ID_PLANILHA_AT_PISO}/values/PIVOT_AT_PISO!A:ZZ`, { 
      method: "GET", headers: { "Authorization": `Bearer ${token}`, "Accept": "application/json" } 
    });
    if (!response.ok) throw new Error(`Erro HTTP: ${response.status}`);
    const result = await response.json();
    return result.values || [];
  } catch (error) { return []; }
};

export const verificarAcessoGestor = async (emailUsuario, token) => {
  try {
    if (!token) return false;
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/ACESSOS_DASHBOARD!A:A?t=${new Date().getTime()}`;
    const response = await fetchWithQueue(url, {
      method: "GET", headers: { "Authorization": `Bearer ${token}`, "Accept": "application/json", "Cache-Control": "no-cache", "Pragma": "no-cache" }
    });
    if (!response.ok) return false;
    const result = await response.json();
    if (!result.values) return false;
    const emailsPermitidos = result.values.filter(linha => linha && linha.length > 0 && linha[0]).map(linha => String(linha[0]).trim().toLowerCase());
    return emailsPermitidos.includes(String(emailUsuario).trim().toLowerCase());
  } catch (error) { return false; }
};

export const getFirstTripsData = async () => {
  try {
    const token = localStorage.getItem("spiToken");
    if (!token) throw new Error("Usuário não autenticado.");
    const resp = await fetchWithQueue(`https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/PIVOT_DIARIO_FIRST_TRIPS!A:ZZZ`, {
      headers: { "Authorization": `Bearer ${token}`, "Accept": "application/json" }
    });
    const data = await resp.json();
    return data.values || [];
  } catch (error) { return []; }
};

export const getHistoricoFrotaData = async () => {
  try {
    const token = localStorage.getItem("spiToken");
    if (!token) throw new Error("Usuário não autenticado.");
    const resp = await fetchWithQueue(`https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/HISTORICO_FROTA!A:i`, {
      headers: { "Authorization": `Bearer ${token}` }
    });
    if (!resp.ok) return [];
    const data = await resp.json();
    return data.values || [];
  } catch (error) { return []; }
};

export const getRodagemData = async (tabName) => {
  try {
    const token = localStorage.getItem("spiToken");
    if (!token) throw new Error("Usuário não autenticado.");
    const idSPI = import.meta.env.VITE_SPREADSHEET_ID_RODIZIO;
    const idSPM = "1_-P1-RA5rTdc_-L40GUwP5pG1iqVytOKchYz_Oq712o";
    const headers = { "Authorization": `Bearer ${token}`, "Accept": "application/json" };

    const [respSPI, respSPM] = await Promise.all([
      fetchWithQueue(`https://sheets.googleapis.com/v4/spreadsheets/${idSPI}/values/${tabName}`, { method: "GET", headers }).catch(() => null),
      fetchWithQueue(`https://sheets.googleapis.com/v4/spreadsheets/${idSPM}/values/${tabName}`, { method: "GET", headers }).catch(() => null)
    ]);

    let dadosCombinados = [];
    let cabecalho = null;

    if (respSPI && respSPI.ok) {
      const dataSPI = await respSPI.json();
      if (dataSPI.values && dataSPI.values.length > 0) {
        cabecalho = dataSPI.values[0]; 
        dadosCombinados.push(...dataSPI.values.slice(1)); 
      }
    }
    if (respSPM && respSPM.ok) {
      const dataSPM = await respSPM.json();
      if (dataSPM.values && dataSPM.values.length > 0) {
        if (!cabecalho) cabecalho = dataSPM.values[0]; 
        dadosCombinados.push(...dataSPM.values.slice(1)); 
      }
    }
    if (!cabecalho) return [];
    return [cabecalho, ...dadosCombinados];
  } catch (error) { return []; }
};

export const buscarPermissoesUsuario = async (email, token) => {
  try {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${ID_PERMISSION_SHEET}/values/PERMISSOES!A:C`;
    const response = await fetchWithQueue(url, { headers: { Authorization: `Bearer ${token}` } });
    const result = await response.json();
    if (!result.values) return null;
    const permissao = result.values.find(row => String(row[0]).trim().toLowerCase() === String(email).trim().toLowerCase());
    if (!permissao) return null;
    return { email: permissao[0], regional: permissao[1], cargo: permissao[2] };
  } catch (error) { return null; }
};

export const getAtPisoClusterData = async () => {
  try {
    const token = localStorage.getItem("spiToken");
    if (!token) throw new Error("Usuário não autenticado.");
    const idSpreadsheet = "1hppCHTfDUsPOo_DmAVhc3eSSzeKD8Yx4UgEjFzW_y_4";
    const response = await fetchWithQueue(`https://sheets.googleapis.com/v4/spreadsheets/${idSpreadsheet}/values/AT_PISO_CLUSTER!A:F`, {
      method: "GET", headers: { "Authorization": `Bearer ${token}`, "Accept": "application/json" }
    });
    if (!response.ok) throw new Error(`Erro HTTP: ${response.status}`);
    const data = await response.json();
    return data.values || [];
  } catch (error) { return []; }
};

export const getRecusasData = async (targetMonth = new Date().getMonth() + 1, targetYear = new Date().getFullYear()) => {
  try {
    const token = localStorage.getItem("spiToken");
    if (!token) throw new Error("Usuário não autenticado.");

    const monthStr = ['JAN','FEV','MAR','ABR','MAI','JUN','JUL','AGO','SET','OUT','NOV','DEZ'][targetMonth - 1];
    const tabName = `${monthStr}-${targetYear}`;

    const idSPI = import.meta.env.VITE_SPREADSHEET_ID_RECUSAS_SPI 
    const idSPM = import.meta.env.VITE_SPREADSHEET_ID_RECUSAS_SPM 
    const headers = { "Authorization": `Bearer ${token}`, "Accept": "application/json" };

    const [respSPI, respSPM] = await Promise.all([
      fetchWithQueue(`https://sheets.googleapis.com/v4/spreadsheets/${idSPI}/values/${tabName}!A:Z`, { method: "GET", headers }).catch(() => null),
      fetchWithQueue(`https://sheets.googleapis.com/v4/spreadsheets/${idSPM}/values/${tabName}!A:Z`, { method: "GET", headers }).catch(() => null)
    ]);

    let dadosCombinados = [];
    let cabecalho = null;

    if (respSPI && respSPI.ok) {
      const dataSPI = await respSPI.json();
      if (dataSPI.values && dataSPI.values.length > 0) {
        cabecalho = dataSPI.values[0]; 
        dadosCombinados.push(...dataSPI.values.slice(1)); 
      }
    }
    if (respSPM && respSPM.ok) {
      const dataSPM = await respSPM.json();
      if (dataSPM.values && dataSPM.values.length > 0) {
        if (!cabecalho) cabecalho = dataSPM.values[0]; 
        dadosCombinados.push(...dataSPM.values.slice(1)); 
      }
    }

    if (!cabecalho) return [];
    return [cabecalho, ...dadosCombinados];
  } catch (error) { return []; }
};

export const getDeliverySuccessData = async () => {
  try {
    const token = localStorage.getItem("spiToken");
    if (!token) throw new Error("Usuário não autenticado.");
    const idSopSpi = import.meta.env.VITE_DS_SHEET_ID;
    const response = await fetchWithQueue(`https://sheets.googleapis.com/v4/spreadsheets/${idSopSpi}/values/Base DS!A:ZZ`, {
      method: "GET", headers: { "Authorization": `Bearer ${token}`, "Accept": "application/json" }
    });
    if (!response.ok) throw new Error(`Erro HTTP: ${response.status}`);
    const data = await response.json();
    return data.values || [];
  } catch (error) { return []; }
};

// =================================================================
// GET RECUSAS (MAPA DE CALOR DE RECUSAS POR CLUSTER)
// =================================================================

export const getRecusasDataCluster = async (regionalAtual, mesFiltro = null, anoFiltro = null) => {

  try {

    const token = localStorage.getItem("spiToken"); // Ou o token que você usa

    if (!token) throw new Error("Usuário não autenticado.");



    // Define qual planilha usar com base na regional selecionada

    const isSpiSpo = regionalAtual === 'SPI' || regionalAtual === 'SPO';

    const sheetId = isSpiSpo

      ? import.meta.env.VITE_RECUSAS_SPI_SPO_SHEET_ID

      : import.meta.env.VITE_RECUSAS_SPM_SPC_SHEET_ID;



    if (!sheetId) throw new Error("ID da planilha de Recusas não configurado.");



    // Lógica para montar o nome da aba (ex: JAN-2026)

    const dataAtual = new Date();

    const mesIdx = mesFiltro ? parseInt(mesFiltro, 10) - 1 : dataAtual.getMonth();

    const ano = anoFiltro || dataAtual.getFullYear();

    const mesesAbrev = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];

    const tabName = `${mesesAbrev[mesIdx]}-${ano}`;



    console.log(`Buscando Recusas da aba: ${tabName} | Planilha: ${isSpiSpo ? 'SPI/SPO' : 'SPM/SPC'}`);



    const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${tabName}!A:K`;



    const response = await fetch(url, {

      method: "GET",

      headers: {

        "Authorization": `Bearer ${token}`,

        "Accept": "application/json"

      }

    });



    if (!response.ok) {

      if (response.status === 400 || response.status === 404) {

        console.warn(`Aba ${tabName} não encontrada. Pode não haver dados para este mês ainda.`);

        return [];

      }

      throw new Error(`Erro HTTP: ${response.status}`);

    }



    const data = await response.json();

    return data.values || [];

  } catch (error) {

    console.error("Erro ao buscar dados de Recusas:", error);

    return [];

  }

};



// =================================================================
// GET AT EXPEDIDAS (BUSCA DINÂMICA POR MÊS/ABA)
// =================================================================
export const getAtExpedidaData = async (abaNome) => {

  try {

    const token = localStorage.getItem("spiToken");

    if (!token) throw new Error("Usuário não autenticado.");



    const regEscolhida = localStorage.getItem("selectedRegional");

   

    // IDs protegidos pelas variáveis de ambiente do Vite

    const idSPI = import.meta.env.VITE_PLANILHA_AT_SPI;

    const idSPM = import.meta.env.VITE_PLANILHA_AT_SPM;



    // Função interna para buscar a planilha alvo

    const fetchPlanilha = async (id) => {

      if (!id) return [];

      const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${id}/values/${abaNome}!A:G`, {

        headers: { "Authorization": `Bearer ${token}` }

      });

      if (!res.ok) return [];

      const json = await res.json();

      return json.values || [];

    };



    let result = [];



    // Catraca de Segurança de Acesso

    if (regEscolhida === 'SPI' || regEscolhida === 'SPO') {

      result = await fetchPlanilha(idSPI);

    } else if (regEscolhida === 'SPM' || regEscolhida === 'SPC') {

      result = await fetchPlanilha(idSPM);

    } else if (regEscolhida === 'BOTH') {

      const [resSPI, resSPM] = await Promise.all([fetchPlanilha(idSPI), fetchPlanilha(idSPM)]);

      result = resSPI.concat(resSPM.length > 1 ? resSPM.slice(1) : []);

    }



    return result;

  } catch (error) {

    console.error(`Erro ao buscar dados de AT Expedidas na aba ${abaNome}:`, error);

    return [];

  }

};

