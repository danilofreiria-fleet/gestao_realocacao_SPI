// =================================================================
// VARIÁVEIS DE AMBIENTE (Lendo do .env)
// =================================================================
const WEB_APP_URL = import.meta.env.VITE_WEB_APP_URL;
const SPREADSHEET_ID = import.meta.env.VITE_SPREADSHEET_ID_PRINCIPAL; 
const ID_PLANILHA_REPORTS = import.meta.env.VITE_SPREADSHEET_ID_REPORTS;
const ID_PLANILHA_SOP = import.meta.env.VITE_SPREADSHEET_ID_SOP;

const ABA_NOME = "CONSOLIDADO-GESTÃO-SPI_REALOCAÇÃO";

// =================================================================
// POST (Criar Nova Linha - Via Apps Script)
// =================================================================
export const sendDataToSheets = async (payload) => {
  try {
    const response = await fetch(WEB_APP_URL, {
      method: 'POST',
      mode: 'no-cors', 
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return { success: true };
  } catch (error) {
    console.error("Erro na API (POST):", error);
    throw error;
  }
};

// =================================================================
// GET (Leitura Super Rápida - Via API Oficial)
// =================================================================
export const getConsolidadoData = async () => {
  try {
    const token = localStorage.getItem("spiToken");
    if (!token) {
        throw new Error("Usuário não autenticado. Faça login novamente.");
    }

    const RANGE = `${ABA_NOME}!A:BH`; 
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${RANGE}`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Accept": "application/json"
      }
    });
    
    if (!response.ok) {
        throw new Error(`Erro HTTP: ${response.status} - O Token pode ter expirado.`);
    }

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

    // O insertDataOption=INSERT_ROWS garante que ele crie uma linha nova e não sobrescreva atalhos
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${ABA_NOME}!A:A:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ values: [rowData] })
    });

    if (!response.ok) throw new Error(`Erro HTTP: ${response.status}`);
    return await response.json();
  } catch (error) {
    console.error("Erro na API (POST append):", error);
    throw error;
  }
};

// =================================================================
// GET BASE (Busca os dados de CAP e Setup na aba BASE da MESMA planilha)
// =================================================================
export const getBaseReferenceData = async () => {
  try {
    const token = localStorage.getItem("spiToken");
    if (!token) return [];

    // Busca exatamente da coluna A até a F na aba "BASE"
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/BASE!A:F`;
    
    const response = await fetch(url, {
      method: "GET",
      headers: { "Authorization": `Bearer ${token}`, "Accept": "application/json" }
    });
    
    if (!response.ok) return [];
    const result = await response.json();
    return result.values || [];
  } catch (error) {
    console.error("Erro na API (GET BASE):", error);
    return [];
  }
};

// =================================================================
// SALVAR DIRETO NAS PLANILHAS DE ORIGEM
// =================================================================
export const salvarNasOrigens = async (payload) => {
  try {
    const token = localStorage.getItem("spiToken");
    if (!token) throw new Error("Usuário não autenticado.");

    // 1. O Report Diário pega exatamente as primeiras 47 colunas (0 a 46)
    const linhaGestao = payload.slice(0, 47);

    // 2. A SOP pega informações pontuais (Ajustado para os índices corretos)
// A nova linha Controle que vai para a aba SOP (Atualizado os índices 51 a 59)
    const linhaControle = [
      rowData[3] || "",  // A: Data
      rowData[1] || "",  // B: Regional
      rowData[4] || "",  // C: Station
      rowData[5] || "",  // D: Turno
      rowData[12] || "", // E: Vol Roteirizado
      rowData[13] || "", // F: Vol Processado
      rowData[14] || "", // G: Vol Expedido
      rowData[51] || "", // H: Realoc Pre (AZ)
      rowData[52] || "", // I: Realoc Durante (BA)
      rowData[53] || "", // J: Total Realocados (Calculado) (BB)
      rowData[54] || "", // K: Não Coube (BC)
      rowData[55] || "", // L: Outros Motivos (BD)
      rowData[56] || "", // M: Taxa Correção Fleet (BE)
      rowData[57] || "", // N: Desvio Piso Fleet (BF)
      rowData[58] || "", // O: Desvio Piso Hub (BG)
      rowData[2] || "",  // P: Semana do Ano
      rowData[59] || ""  // Q: Eficiência Expedição (BH)
    ];;

    const urlGestao = `https://sheets.googleapis.com/v4/spreadsheets/${ID_PLANILHA_REPORTS}/values/'REPORT DIARIO'!A:A:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;
    const urlControle = `https://sheets.googleapis.com/v4/spreadsheets/${ID_PLANILHA_SOP}/values/CONTROLE!A:A:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;

    // Dispara as duas gravações simultaneamente
    const [resGestao, resControle] = await Promise.all([
      fetch(urlGestao, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ values: [linhaGestao] })
      }),
      fetch(urlControle, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ values: [linhaControle] })
      })
    ]);

    if (!resGestao.ok || !resControle.ok) {
       console.error("Erro em uma das requisições", await resGestao.text(), await resControle.text());
       throw new Error("Falha ao salvar em uma das planilhas de origem.");
    }

    return true;
  } catch (error) {
    console.error("Erro ao salvar nas origens:", error);
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
  const response = await fetch(url, { headers: { "Authorization": `Bearer ${token}` } });
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
// PUT (Edição)
// =================================================================
export const updateRowData = async (rowIndex, rowData, oldRowData) => {
  try {
    const token = localStorage.getItem("spiToken");
    if (!token) throw new Error("Usuário não autenticado.");

    // 1. Atualiza Consolidado
    const urlConsolidado = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${ABA_NOME}!A${rowIndex}?valueInputOption=USER_ENTERED`;
    const responseConsolidado = await fetch(urlConsolidado, {
      method: "PUT",
      headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ values: [rowData] })
    });

    const dataBusca = oldRowData ? oldRowData[3] : rowData[3];
    const hubBusca = oldRowData ? oldRowData[4] : rowData[4];
    const turnoBusca = oldRowData ? oldRowData[5] : rowData[5];

    const dataAlvo = padronizarData(dataBusca);
    const stationAlvo = limpaTexto(hubBusca);
    const turnoAlvo = limpaTexto(turnoBusca);
    console.log(`Buscando a linha ANTIGA para EDITAR: ${dataAlvo} | ${stationAlvo} | ${turnoAlvo}`);

    const linhaGestao = rowData.slice(0, 47);
    // A nova linha Controle que vai para a aba SOP (Atualizado os índices 51 a 59)
    const linhaControle = [
      rowData[3] || "",  // A: Data
      rowData[1] || "",  // B: Regional
      rowData[4] || "",  // C: Station
      rowData[5] || "",  // D: Turno
      rowData[12] || "", // E: Vol Roteirizado
      rowData[13] || "", // F: Vol Processado
      rowData[14] || "", // G: Vol Expedido
      rowData[51] || "", // H: Realoc Pre (AZ)
      rowData[52] || "", // I: Realoc Durante (BA)
      rowData[53] || "", // J: Total Realocados (Calculado) (BB)
      rowData[54] || "", // K: Não Coube (BC)
      rowData[55] || "", // L: Outros Motivos (BD)
      rowData[56] || "", // M: Taxa Correção Fleet (BE)
      rowData[57] || "", // N: Desvio Piso Fleet (BF)
      rowData[58] || "", // O: Desvio Piso Hub (BG)
      rowData[2] || "",  // P: Semana do Ano
      rowData[59] || ""  // Q: Eficiência Expedição (BH)
    ];

    // 2. Caça e Edita Report Diário
    try {
      const respReport = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${ID_PLANILHA_REPORTS}/values/'REPORT%20DIARIO'!A:G?valueRenderOption=UNFORMATTED_VALUE`, { headers: { "Authorization": `Bearer ${token}` } });
      const dataReport = await respReport.json();
      
      if (dataReport.values) {
        for (let i = dataReport.values.length - 1; i >= 1; i--) {
          const row = dataReport.values[i];
          let dataLida = row[3];
          if (typeof dataLida === 'number') {
             const d = new Date((dataLida - 25569) * 86400 * 1000);
             dataLida = d.toISOString().split('T')[0];
          }

          if (padronizarData(dataLida) === dataAlvo && limpaTexto(row[4]) === stationAlvo && limpaTexto(row[5]) === turnoAlvo) {
            console.log("Achou no Report! Editando...");
            const urlRep = `https://sheets.googleapis.com/v4/spreadsheets/${ID_PLANILHA_REPORTS}/values/'REPORT%20DIARIO'!A${i + 1}?valueInputOption=USER_ENTERED`;
            await fetch(urlRep, { method: "PUT", headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ values: [linhaGestao] }) });
            break;
          }
        }
      }
    } catch (e) { console.error("Erro Report:", e); }

    // 3. Caça e Edita SOP
    try {
      const respSOP = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${ID_PLANILHA_SOP}/values/CONTROLE!A:E?valueRenderOption=UNFORMATTED_VALUE`, { headers: { "Authorization": `Bearer ${token}` } });
      const dataSOP = await respSOP.json();
      
      if (dataSOP.values) {
        for (let i = dataSOP.values.length - 1; i >= 1; i--) {
          const row = dataSOP.values[i];
          let dataLida = row[0];
          if (typeof dataLida === 'number') {
             const d = new Date((dataLida - 25569) * 86400 * 1000);
             dataLida = d.toISOString().split('T')[0];
          }

          if (padronizarData(dataLida) === dataAlvo && limpaTexto(row[2]) === stationAlvo && limpaTexto(row[3]) === turnoAlvo) {
            console.log("Achou na SOP! Editando...");
            const urlSOP = `https://sheets.googleapis.com/v4/spreadsheets/${ID_PLANILHA_SOP}/values/CONTROLE!A${i + 1}?valueInputOption=USER_ENTERED`;
            await fetch(urlSOP, { method: "PUT", headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ values: [linhaControle] }) });
            break;
          }
        }
      }
    } catch (e) { console.error("Erro SOP:", e); }

    return await responseConsolidado.json();
  } catch (error) { throw error; }
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
    console.log(`Buscando para EXCLUIR: ${dataAlvo} | ${stationAlvo} | ${turnoAlvo}`);

    // 1. Deleta do Consolidado
    const gidConsolidado = await getSheetIdByName(SPREADSHEET_ID, ABA_NOME, token);
    await executeDeleteAPI(SPREADSHEET_ID, gidConsolidado, rowIndex, token);

    // 2. Deleta do Report
    try {
      const respReport = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${ID_PLANILHA_REPORTS}/values/'REPORT%20DIARIO'!A:G?valueRenderOption=UNFORMATTED_VALUE`, { headers: { "Authorization": `Bearer ${token}` } });
      const dataReport = await respReport.json();
      
      if (dataReport.values) {
        for (let i = dataReport.values.length - 1; i >= 1; i--) {
          const row = dataReport.values[i];
          let dataLida = row[3];
          if (typeof dataLida === 'number') {
             const d = new Date((dataLida - 25569) * 86400 * 1000);
             dataLida = d.toISOString().split('T')[0];
          }

          if (padronizarData(dataLida) === dataAlvo && limpaTexto(row[4]) === stationAlvo && limpaTexto(row[5]) === turnoAlvo) {
            console.log("Achou no Report! Excluindo...");
            const gidReport = await getSheetIdByName(ID_PLANILHA_REPORTS, "REPORT DIARIO", token);
            await executeDeleteAPI(ID_PLANILHA_REPORTS, gidReport, i + 1, token);
            break; 
          }
        }
      }
    } catch (e) { console.error("Erro Report:", e); }

    // 3. Deleta da SOP
    try {
      const respSOP = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${ID_PLANILHA_SOP}/values/CONTROLE!A:E?valueRenderOption=UNFORMATTED_VALUE`, { headers: { "Authorization": `Bearer ${token}` } });
      const dataSOP = await respSOP.json();
      
      if (dataSOP.values) {
        for (let i = dataSOP.values.length - 1; i >= 1; i--) {
          const row = dataSOP.values[i];
          let dataLida = row[0];
          if (typeof dataLida === 'number') {
             const d = new Date((dataLida - 25569) * 86400 * 1000);
             dataLida = d.toISOString().split('T')[0];
          }

          if (padronizarData(dataLida) === dataAlvo && limpaTexto(row[2]) === stationAlvo && limpaTexto(row[3]) === turnoAlvo) {
            console.log("Achou na SOP! Excluindo...");
            const gidSOP = await getSheetIdByName(ID_PLANILHA_SOP, "CONTROLE", token);
            await executeDeleteAPI(ID_PLANILHA_SOP, gidSOP, i + 1, token);
            break;
          }
        }
      }
    } catch (e) { console.error("Erro SOP:", e); }

    return { success: true };
  } catch (error) { throw error; }
};

// =================================================================
// GET DADOS RH (Para a One Page SPI)
// =================================================================
export const getDadosRHDashboard = async () => {
  try {
    const token = localStorage.getItem("spiToken");
    if (!token) throw new Error("Usuário não autenticado.");

    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/DADOS_DASHBOARD!A:AD`;

    const response = await fetch(url, {
      method: "GET",
      headers: { "Authorization": `Bearer ${token}`, "Accept": "application/json" }
    });

    if (!response.ok) throw new Error(`Erro HTTP: ${response.status}`);
    const result = await response.json();
    return result.values || [];
  } catch (error) {
    console.error("Erro na API (GET DADOS RH):", error);
    throw error;
  }
};

// =================================================================
// GET DADOS DO AT PISO DIÁRIO
// =================================================================
export const getDadosAtPiso = async () => {
  try {
    const token = localStorage.getItem("spiToken");
    if (!token) throw new Error("Usuário não autenticado.");

    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/AT_PISO!A:ZZ`;

    const response = await fetch(url, {
      method: "GET",
      headers: { "Authorization": `Bearer ${token}`, "Accept": "application/json" }
    });

    if (!response.ok) throw new Error(`Erro HTTP: ${response.status}`);
    const result = await response.json();
    return result.values || [];
  } catch (error) {
    console.error("Erro na API (GET AT PISO DIÁRIO):", error);
    return [];
  }
};