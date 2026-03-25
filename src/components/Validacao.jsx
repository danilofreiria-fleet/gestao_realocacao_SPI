import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { getConsolidadoData } from '../api/googleSheets';
import { AlertCircle, CheckCircle2, Search, Filter, ShieldCheck, AlertTriangle, ArrowRightCircle, CalendarDays, MapPin, Clock, Download } from 'lucide-react';
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

const STATIONS_ESPERADAS = Object.keys(MAPA_REGIONAL).sort();
const TURNOS_ESPERADOS = ['AM', 'PM1', 'PM2'];

const CAMPOS_AUDITADOS = [
  { idx: 6, nome: 'Início' }, { idx: 7, nome: 'Fim' },
  { idx: 11, nome: 'AT Rot.' }, { idx: 12, nome: 'Vol. Rot.' },
  { idx: 13, nome: 'Vol. Proc.' }, { idx: 14, nome: 'Vol. Exp.' },
  { idx: 19, nome: 'AT Piso' }, { idx: 20, nome: 'Of. Util.' },
  { idx: 21, nome: 'Of. Pass.' }, { idx: 22, nome: 'Of. Moto' },
  { idx: 23, nome: 'Of. Van' }, { idx: 25, nome: 'Cg. Util.' },
  { idx: 26, nome: 'Cg. Pass.' }, { idx: 27, nome: 'Cg. Moto' },
  { idx: 28, nome: 'Cg. Van' }, { idx: 35, nome: 'Recusas' },
  { idx: 37, nome: 'Pac. Rot. Moto' }, { idx: 38, nome: 'Pac. Exp. Moto' },
  { idx: 50, nome: 'Realoc. Pré' }, { idx: 51, nome: 'Realoc. Dur.' },
  { idx: 53, nome: 'Não Coube' }, { idx: 54, nome: 'Não Exp. Outros' }
];

export default function Validacao() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [rawData, setRawData] = useState([]);
  
  const [filtroPeriodo, setFiltroPeriodo] = useState('15d'); 
  const [filtroStatus, setFiltroStatus] = useState('todos'); 
  const [filtroRegional, setFiltroRegional] = useState('');
  const [filtroStation, setFiltroStation] = useState('');
  const [filtroTurno, setFiltroTurno] = useState(''); // NOVO FILTRO DE TURNO

  useEffect(() => { carregarDados(); }, []);

  const carregarDados = async () => {
    setLoading(true);
    try {
      const data = await getConsolidadoData();
      if (data && data.length > 0) setRawData(data.slice(1));
    } catch (error) { console.error("Erro", error); } 
    finally { setLoading(false); }
  };

  const diasAnalisados = useMemo(() => {
    const dias = [];
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    if (filtroPeriodo.includes('d')) {
      const qtd = parseInt(filtroPeriodo);
      for (let i = 0; i <= qtd; i++) {
        const d = new Date(hoje);
        d.setDate(d.getDate() - i);
        dias.push(d);
      }
    }

    return dias.map(d => {
      const diaStr = String(d.getDate()).padStart(2, '0');
      const mesStr = String(d.getMonth() + 1).padStart(2, '0');
      const anoStr = d.getFullYear();
      return {
        dataObj: d,
        dataFormatadaBR: `${diaStr}/${mesStr}/${anoStr}`,
        dataFomartadaISO: `${anoStr}-${mesStr}-${diaStr}` 
      };
    }).sort((a, b) => b.dataObj - a.dataObj); 
  }, [filtroPeriodo]);

  const relatorioValidacao = useMemo(() => {
    if (rawData.length === 0) return [];

    const mapaRegistros = new Map();
    rawData.forEach((row, idx) => {
      const dataRow = String(row[3] || "").trim();
      const station = String(row[4] || "").trim();
      const turno = String(row[5] || "").trim();
      
      let dataNormalizada = dataRow;
      if (dataRow.includes('-')) {
        const partes = dataRow.split(' ')[0].split('-');
        if (partes.length === 3) dataNormalizada = `${partes[2]}/${partes[1]}/${partes[0]}`;
      }
      
      row._rowIndex = idx + 2; // Salva o índice original da linha para edição
      mapaRegistros.set(`${dataNormalizada}|${station}|${turno}`, row);
    });

    const relatorio = [];

    STATIONS_ESPERADAS.forEach(station => {
      if (filtroRegional && MAPA_REGIONAL[station] !== filtroRegional) return;
      if (filtroStation && station !== filtroStation) return;

      diasAnalisados.forEach(dia => {
        TURNOS_ESPERADOS.forEach(turno => {
          if (filtroTurno && turno !== filtroTurno) return; // Aplica o filtro de turno

          const keyBR = `${dia.dataFormatadaBR}|${station}|${turno}`;
          const keyISO = `${dia.dataFomartadaISO}|${station}|${turno}`;
          const registro = mapaRegistros.get(keyBR) || mapaRegistros.get(keyISO);

          if (!registro) {
            if (filtroStatus === 'todos' || filtroStatus === 'pendente') {
              relatorio.push({ 
                id: keyBR, dataBR: dia.dataFormatadaBR, station, turno, status: 'pendente', faltantes: ['Nenhum formulário enviado'],
                action: { mode: 'new', prefill: { data: dia.dataFomartadaISO, station, turno } }
              });
            }
          } else {
            const camposVazios = [];
            CAMPOS_AUDITADOS.forEach(campo => {
              const valor = registro[campo.idx];
              if (valor === undefined || valor === null || String(valor).trim() === "") {
                camposVazios.push(campo.nome);
              }
            });

            if (camposVazios.length > 0 && (filtroStatus === 'todos' || filtroStatus === 'incompleto')) {
              relatorio.push({ 
                id: keyBR, dataBR: dia.dataFormatadaBR, station, turno, status: 'incompleto', faltantes: camposVazios,
                action: { mode: 'edit', row: registro } // Manda a linha completa para o DataTable editar
              });
            }
          }
        });
      });
    });

    return relatorio;
  }, [rawData, diasAnalisados, filtroStatus, filtroRegional, filtroStation, filtroTurno]);

  const relatorioAgrupado = useMemo(() => {
    const agrupado = {};
    relatorioValidacao.forEach(item => {
      if (!agrupado[item.station]) agrupado[item.station] = [];
      agrupado[item.station].push(item);
    });
    return agrupado;
  }, [relatorioValidacao]);

  const irParaPreenchimento = (item) => {
    navigate('/app/tabela', { state: { resolveAction: item.action } });
  };

  // NOVA FUNÇÃO: EXPORTAR PARA CSV
  const exportarCSV = () => {
    if (relatorioValidacao.length === 0) {
      alert("Não há pendências para exportar com os filtros atuais.");
      return;
    }

    // Cabeçalho do arquivo
    const headersCSV = ["Data", "Regional", "Hub (Station)", "Turno", "Status", "Campos Afetados"];
    
    // Mapeia os dados pulando aspas e separando por vírgulas
    const linhasCSV = relatorioValidacao.map(item => {
      const data = item.dataBR;
      const regional = MAPA_REGIONAL[item.station] || "";
      const station = item.station;
      const turno = item.turno;
      const status = item.status === 'pendente' ? 'Não Iniciado' : 'Incompleto';
      // Junta os campos faltantes e envolve em aspas duplas para o Excel não quebrar a coluna
      const faltantes = `"${item.faltantes.join(', ')}"`; 

      return [data, regional, station, turno, status, faltantes].join(",");
    });

    // Junta tudo. O "\uFEFF" garante que o Excel vai ler os acentos (UTF-8 BOM)
    const csvContent = "\uFEFF" + [headersCSV.join(","), ...linhasCSV].join("\n");
    
    // Cria o arquivo virtual e força o download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    
    // Nome do arquivo com a data de hoje
    const hoje = new Date().toISOString().split('T')[0];
    link.setAttribute("download", `Auditoria_SPI_SOP_${hoje}.csv`);
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) return (<div className="flex h-full items-center justify-center"><div className="w-12 h-12 border-4 border-[#EE4D2D] border-t-transparent rounded-full animate-spin"></div></div>);

  return (
    <div className="flex flex-col h-full space-y-6">
      
      <div className="bg-white dark:bg-[#1f232d] rounded-2xl shadow-sm border border-slate-200 dark:border-gray-800 p-6 shrink-0">
<div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
          <div>
            <h2 className="text-2xl font-black text-slate-800 dark:text-white uppercase tracking-tight flex items-center gap-2">
              <ShieldCheck className="text-[#EE4D2D]" size={28} /> Validação de Preenchimento
            </h2>
            <p className="text-sm text-slate-500 dark:text-gray-400 mt-1">Auditoria de campos obrigatórios SPI e Realocação SOP.</p>
          </div>
          
          {/* BOTÕES DE AÇÃO */}
          <div className="flex gap-2">
            <button 
              onClick={exportarCSV} 
              className="flex items-center gap-2 bg-slate-100 dark:bg-gray-800 text-slate-700 dark:text-gray-200 border border-slate-200 dark:border-gray-700 px-4 py-2 rounded-xl font-bold text-sm hover:bg-slate-200 dark:hover:bg-gray-700 transition-colors shadow-sm"
            >
              <Download size={16} /> Exportar CSV
            </button>
            <button 
              onClick={carregarDados} 
              className="bg-blue-50 dark:bg-[#0055A5]/20 text-[#0055A5] dark:text-blue-400 border border-blue-200 dark:border-[#0055A5] px-4 py-2 rounded-xl font-bold text-sm hover:bg-blue-100 transition-colors shadow-sm"
            >
              Re-auditar Base
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 bg-slate-50 dark:bg-[#15171e] p-4 rounded-xl border border-slate-100 dark:border-gray-800">
          <div className="flex flex-col">
            <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 flex items-center gap-1"><CalendarDays size={12}/> Período</label>
            <select value={filtroPeriodo} onChange={(e) => setFiltroPeriodo(e.target.value)} className="bg-white dark:bg-[#1f232d] dark:text-white border border-slate-200 dark:border-gray-700 rounded-lg p-2.5 text-sm">
              <option value="15d">Últimos 15 Dias</option>
              <option value="7d">Últimos 7 Dias</option>
            </select>
          </div>
          <div className="flex flex-col">
            <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 flex items-center gap-1"><Filter size={12}/> Status</label>
            <select value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)} className="bg-white dark:bg-[#1f232d] dark:text-white border border-slate-200 dark:border-gray-700 rounded-lg p-2.5 text-sm">
              <option value="todos">Todos os Alertas</option>
              <option value="pendente">Não Iniciados (Pendente)</option>
              <option value="incompleto">Campos Vazios (Incompleto)</option>
            </select>
          </div>
          <div className="flex flex-col">
            <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 flex items-center gap-1"><MapPin size={12}/> Regional</label>
            <select value={filtroRegional} onChange={(e) => {setFiltroRegional(e.target.value); setFiltroStation('');}} className="bg-white dark:bg-[#1f232d] dark:text-white border border-slate-200 dark:border-gray-700 rounded-lg p-2.5 text-sm">
              <option value="">Todas</option>
              {['SPI1','SPI2','SPI3','SPI4','SPI5'].map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div className="flex flex-col">
            <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 flex items-center gap-1"><Search size={12}/> Hub</label>
            <select value={filtroStation} onChange={(e) => setFiltroStation(e.target.value)} className="bg-white dark:bg-[#1f232d] dark:text-white border border-slate-200 dark:border-gray-700 rounded-lg p-2.5 text-sm">
              <option value="">Todos os Hubs</option>
              {STATIONS_ESPERADAS.filter(s => !filtroRegional || MAPA_REGIONAL[s] === filtroRegional).map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="flex flex-col">
            <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 flex items-center gap-1"><Clock size={12}/> Turno</label>
            <select value={filtroTurno} onChange={(e) => setFiltroTurno(e.target.value)} className="bg-white dark:bg-[#1f232d] dark:text-white border border-slate-200 dark:border-gray-700 rounded-lg p-2.5 text-sm">
              <option value="">Todos os Turnos</option>
              {TURNOS_ESPERADOS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pr-2 space-y-6">
        {Object.keys(relatorioAgrupado).length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center space-y-3 opacity-60 mt-10">
            <CheckCircle2 size={64} className="text-green-500" />
            <div>
              <p className="font-bold text-2xl text-slate-800 dark:text-white">Auditoria Limpa!</p>
              <p className="text-slate-500 dark:text-gray-400">Nenhuma pendência encontrada para os filtros selecionados.</p>
            </div>
          </div>
        ) : (
          Object.entries(relatorioAgrupado).map(([station, alertas]) => (
            <div key={station} className="bg-white dark:bg-[#1f232d] rounded-2xl shadow-sm border border-slate-200 dark:border-gray-800 overflow-hidden">
              <div className="bg-slate-100 dark:bg-[#15171e] p-4 border-b border-slate-200 dark:border-gray-800 flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="bg-[#0055A5] text-white p-2 rounded-lg"><MapPin size={20}/></div>
                  <div>
                    <h3 className="font-black text-slate-800 dark:text-white text-lg">{station}</h3>
                    <p className="text-xs text-slate-500 dark:text-gray-400 font-bold uppercase">{MAPA_REGIONAL[station]} • {alertas.length} ocorrência(s)</p>
                  </div>
                </div>
              </div>
              
              <div className="divide-y divide-slate-100 dark:divide-gray-800">
                {alertas.map((item, idx) => (
                  <div key={idx} className={`p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-colors hover:bg-slate-50 dark:hover:bg-gray-800/50 ${item.status === 'pendente' ? 'bg-red-50/20' : 'bg-amber-50/20'}`}>
                    
                    <div className="flex items-start gap-4 md:w-1/3">
                      <div className={`mt-1 p-2 rounded-full ${item.status === 'pendente' ? 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400' : 'bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400'}`}>
                        {item.status === 'pendente' ? <AlertCircle size={18} /> : <AlertTriangle size={18} />}
                      </div>
                      <div>
                        <p className="font-bold text-slate-800 dark:text-gray-200 text-base">{item.dataBR}</p>
                        <p className="text-sm text-slate-500 font-bold">Turno: <span className="text-[#0055A5] dark:text-blue-400">{item.turno}</span></p>
                      </div>
                    </div>

                    <div className="md:w-1/2">
                      <p className="text-xs font-bold text-slate-400 uppercase mb-1">Campos Afetados:</p>
                      <div className="flex flex-wrap gap-1.5">
                        {item.faltantes.map((campo, i) => (
                          <span key={i} className="bg-white dark:bg-[#15171e] border border-slate-200 dark:border-gray-700 text-slate-600 dark:text-gray-300 text-[11px] font-bold px-2 py-1 rounded-md shadow-sm">
                            {campo}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="md:w-auto flex justify-end">
                      <button 
                        onClick={() => irParaPreenchimento(item)}
                        className="flex items-center gap-2 bg-[#EE4D2D] hover:bg-[#d64528] text-white px-4 py-2 rounded-xl text-sm font-bold shadow-sm transition-colors"
                      >
                        Resolver <ArrowRightCircle size={16} />
                      </button>
                    </div>

                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}