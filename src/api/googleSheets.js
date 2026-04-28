// =================================================================
// VARIÁVEIS DE AMBIENTE (Lendo do .env)
// =================================================================
const WEB_APP_URL = import.meta.env.VITE_WEB_APP_URL;
const SPREADSHEET_ID = import.meta.env.VITE_SPREADSHEET_ID_PRINCIPAL; 
const ID_PLANILHA_REPORTS = import.meta.env.VITE_SPREADSHEET_ID_REPORTS;
const ID_PLANILHA_SOP = import.meta.env.VITE_SPREADSHEET_ID_SOP;
const ID_PLANILHA_LOGS = import.meta.env.VITE_SPREADSHEET_ID_LOGS;

const ABA_NOME = "CONSOLIDADO-GESTÃO-SPI_REALOCAÇÃO";

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
// SISTEMA DE LOGS (Com Backup em Array/JSON na Coluna H)
// =================================================================
export const registrarLog = async (acao, dataRef, station, turno, statusInfo, rawData = null) => {
  try {
    const token = localStorage.getItem("spiToken");
    if (!token) return;

    const userEmail = localStorage.getItem("userEmail") || "Analista"; 
    const dataHoraAtual = new Date().toLocaleString('pt-BR');

    // 🔥 MÁGICA DO BACKUP: Transforma o array em texto para caber numa célula
    const backupSnapshot = rawData && rawData.length > 0 
      ? JSON.stringify(rawData) 
      : "[]";

    const logData = [
      dataHoraAtual,
      userEmail,
      acao,             
      dataRef || "",    
      station || "",    
      turno || "",      
      statusInfo || "Sucesso",
      backupSnapshot    // 🔥 COLUNA H: Onde o Array vai morar!
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
    
    const jsonResult = await response.json();

    // 🔥 LOG DE SUCESSO: Veja o 'rowData' aqui no finalzinho!
    registrarLog("CRIAR", rowData[3], rowData[4], rowData[5], "Salvo no Consolidado Principal", rowData);

    return jsonResult;
  } catch (error) {
    console.error("Erro na API (POST append):", error);
    
    // 🔥 LOG DE ERRO: Se der erro, a gente salva o 'rowData' do mesmo jeito pra não perder o que o analista digitou!
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

    // 1. O Report Diário pega exatamente as primeiras 47 colunas (0 a 46)
    const linhaGestao = payload.slice(0, 47);

    // 2. A SOP pega informações pontuais (mantendo o ?? para não perder zeros)
    const linhaControle = [
      payload[3] ?? "",  // A: Data
      payload[1] ?? "",  // B: Regional
      payload[4] ?? "",  // C: Station
      payload[5] ?? "",  // D: Turno
      payload[12] ?? "", // E: Vol Roteirizado
      payload[13] ?? "", // F: Vol Processado
      payload[14] ?? "", // G: Vol Expedido
      payload[51] ?? "", // H: Realoc Pre (AZ)
      payload[52] ?? "", // I: Realoc Durante (BA)
      payload[53] ?? "", // J: Total Realocados (Calculado) (BB)
      payload[54] ?? "", // K: Não Coube (BC)
      payload[55] ?? "", // L: Outros Motivos (BD)
      payload[56] ?? "", // M: Taxa Correção Fleet (BE)
      payload[57] ?? "", // N: Desvio Piso Fleet (BF)
      payload[58] ?? "", // O: Desvio Piso Hub (BG)
      payload[2] ?? "",  // P: Semana do Ano
      payload[59] ?? ""  // Q: Eficiência Expedição (BH)
    ];

    const urlGestao = `https://sheets.googleapis.com/v4/spreadsheets/${ID_PLANILHA_REPORTS}/values/'REPORT DIARIO'!A:A:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;
    const urlControle = `https://sheets.googleapis.com/v4/spreadsheets/${ID_PLANILHA_SOP}/values/CONTROLE!A:A:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;

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
       throw new Error(`Falha nas Origens - Report: ${resGestao.status} | SOP: ${resControle.status}`);
    }

    // 🔥 LOG: SUCESSO ORIGENS
    registrarLog("CRIAR_ORIGENS", payload[3], payload[4], payload[5], "Salvo simultaneamente no Report e SOP");

    return true;
  } catch (error) {
    console.error("Erro ao salvar nas origens:", error);
    // 🔥 LOG: ERRO ORIGENS
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

    // --- 1. EXECUÇÃO CONSOLIDADO ---
    try {
      const payloadConsolidado = [{
        range: `'${ABA_NOME}'!A${rowIndex}`,
        values: [rowData.map(safeVal)]
      }];
      
      const reqConsol = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values:batchUpdate`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ valueInputOption: "USER_ENTERED", data: payloadConsolidado })
      });
      if (!reqConsol.ok) throw new Error(await reqConsol.text());
      console.log("✅ 1/3 - Consolidado Atualizado (Linha Inteira)!");
    } catch (e) { 
      throw new Error(`Falha no Consolidado: ${e.message}`); 
    }

    // --- 2. EXECUÇÃO REPORT DIÁRIO ---
    try {
      const respRep = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${ID_PLANILHA_REPORTS}/values/${encodeURIComponent("'REPORT DIARIO'!A:G")}`, { headers: { "Authorization": `Bearer ${token}` } });
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
              method: "POST",
              headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
              body: JSON.stringify({ valueInputOption: "USER_ENTERED", data: payloadRep })
            });
            if (!reqRep.ok) throw new Error(await reqRep.text());
            console.log("✅ 2/3 - Report Diário Atualizado (Linha Existente)!");
            break;
          }
        }
      }

      // 🔥 AUTO-CURA: Se não achou a linha para editar, cria uma nova!
      if (!encontrouReport) {
        const urlAppendRep = `https://sheets.googleapis.com/v4/spreadsheets/${ID_PLANILHA_REPORTS}/values/'REPORT DIARIO'!A:A:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;
        const reqAppend = await fetch(urlAppendRep, {
          method: "POST",
          headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ values: [linhaGestao] })
        });
        if (!reqAppend.ok) throw new Error(await reqAppend.text());
        console.log("✅ 2/3 - Report Diário Atualizado (Nova Linha Injetada)!");
      }
    } catch (e) { 
      throw new Error(`Falha no Report: ${e.message}`); 
    }

    // --- 3. EXECUÇÃO SOP ---
    try {
      const respSop = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${ID_PLANILHA_SOP}/values/${encodeURIComponent("CONTROLE!A:E")}`, { headers: { "Authorization": `Bearer ${token}` } });
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
              method: "POST",
              headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
              body: JSON.stringify({ valueInputOption: "USER_ENTERED", data: payloadSop })
            });
            if (!reqSop.ok) throw new Error(await reqSop.text());
            console.log("✅ 3/3 - SOP Atualizada (Linha Existente)!");
            break;
          }
        }
      }

      // 🔥 AUTO-CURA: Se o analista adicionou Realocação depois, cria a linha na SOP agora!
      if (!encontrouSop) {
        const urlAppendSop = `https://sheets.googleapis.com/v4/spreadsheets/${ID_PLANILHA_SOP}/values/CONTROLE!A:A:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;
        const reqAppendSop = await fetch(urlAppendSop, {
          method: "POST",
          headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ values: [linhaControle] })
        });
        if (!reqAppendSop.ok) throw new Error(await reqAppendSop.text());
        console.log("✅ 3/3 - SOP Atualizada (Nova Linha Injetada)!");
      }
    } catch (e) { 
      throw new Error(`Falha na SOP: ${e.message}`); 
    }

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
    console.log(`Buscando para EXCLUIR: ${dataAlvo} | ${stationAlvo} | ${turnoAlvo}`);

    // 1. Deleta do Consolidado
    const gidConsolidado = await getSheetIdByName(SPREADSHEET_ID, ABA_NOME, token);
    await executeDeleteAPI(SPREADSHEET_ID, gidConsolidado, rowIndex, token);

    // 2. Deleta do Report
    try {
      const respReport = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${ID_PLANILHA_REPORTS}/values/'REPORT%20DIARIO'!A:G`, { headers: { "Authorization": `Bearer ${token}` } });
      const dataReport = await respReport.json();
      
      if (dataReport.values) {
        for (let i = dataReport.values.length - 1; i >= 1; i--) {
          const row = dataReport.values[i];
          let dataLida = row[3];

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
      const respSOP = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${ID_PLANILHA_SOP}/values/CONTROLE!A:E`, { headers: { "Authorization": `Bearer ${token}` } });
      const dataSOP = await respSOP.json();
      
      if (dataSOP.values) {
        for (let i = dataSOP.values.length - 1; i >= 1; i--) {
          const row = dataSOP.values[i];
          let dataLida = row[0];

          if (padronizarData(dataLida) === dataAlvo && limpaTexto(row[2]) === stationAlvo && limpaTexto(row[3]) === turnoAlvo) {
            console.log("Achou na SOP! Excluindo...");
            const gidSOP = await getSheetIdByName(ID_PLANILHA_SOP, "CONTROLE", token);
            await executeDeleteAPI(ID_PLANILHA_SOP, gidSOP, i + 1, token);
            break;
          }
        }
      }
    } catch (e) { console.error("Erro SOP:", e); }

    // Ache essa linha e adicione o rowData no final:
registrarLog("EXCLUIR", dataAlvo, stationAlvo, turnoAlvo, "Excluído com sucesso", rowData);

    return { success: true };
  } catch (error) { 
    // 🔥 LOG: ERRO EXCLUIR
    registrarLog("ERRO_EXCLUIR", rowData[3], rowData[4], rowData[5], String(error.message));
    throw error; 
  }
};

// =================================================================
// POST (Criar Nova Linha - Via Apps Script) [LEGADO/OPCIONAL]
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
// GET BASE (Busca os dados de CAP e Setup na aba BASE)
// =================================================================
export const getBaseReferenceData = async () => {
  try {
    const token = localStorage.getItem("spiToken");
    if (!token) return [];

    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/BASE!A:Z`;
    
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

    if (!response.ok) {
        console.warn("Aba DADOS_DASHBOARD ausente. Retornando vazio para não quebrar a tela.");
        return [];
    }
    
    const result = await response.json();
    return result.values || [];
  } catch (error) {
    console.error("Erro na API (GET DADOS RH):", error);
    return []; 
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

// =================================================================
// VERIFICAÇÃO DE ACESSO AO DASHBOARD
// =================================================================
export const verificarAcessoGestor = async (emailUsuario, token) => {
  try {
    if (!token) return false;

    // 🔥 VACINA 1: Adiciona um timestamp na URL para o navegador nunca fazer cache
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/ACESSOS_DASHBOARD!A:A?t=${new Date().getTime()}`;
    
    const response = await fetch(url, {
      method: "GET",
      headers: { 
        "Authorization": `Bearer ${token}`, 
        "Accept": "application/json",
        // 🔥 VACINA 2: Força o navegador a buscar dados frescos
        "Cache-Control": "no-cache",
        "Pragma": "no-cache"
      }
    });
    
    if (!response.ok) return false;
    
    const result = await response.json();
    if (!result.values) return false;

    // 🔥 VACINA 3: Filtra linhas vazias antes de mapear
    const emailsPermitidos = result.values
      .filter(linha => linha && linha.length > 0 && linha[0]) // Só passa se a célula tiver algo
      .map(linha => String(linha[0]).trim().toLowerCase());
    
    return emailsPermitidos.includes(String(emailUsuario).trim().toLowerCase());
  } catch (error) {
    console.error("Erro ao verificar permissões de gestor:", error);
    return false; 
  }
};


export const getFirstTripsData = async () => {
  try {
    const token = localStorage.getItem("spiToken");
    if (!token) throw new Error("Usuário não autenticado.");
    const resp = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/FIRST_TRIPS!A:Z`, {
      headers: { "Authorization": `Bearer ${token}` }
    });
    const data = await resp.json();
    return data.values || [];
  } catch (error) {
    console.error("Erro ao buscar First Trips:", error);
    return [];
  }
};


// =================================================================
// GET HISTORICO DE FROTA
// =================================================================
export const getHistoricoFrotaData = async () => {
  try {
    const token = localStorage.getItem("spiToken");
    if (!token) throw new Error("Usuário não autenticado.");
    
    // Busca os dados da nova aba HISTORICO_FROTA (A até I)
    const resp = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/HISTORICO_FROTA!A:i`, {
      headers: { "Authorization": `Bearer ${token}` }
    });
    
    if (!resp.ok) {
        console.warn("Aba HISTORICO_FROTA ausente ou vazia.");
        return [];
    }

    const data = await resp.json();
    return data.values || [];
  } catch (error) {
    console.error("Erro ao buscar Histórico de Frota:", error);
    return [];
  }
};


