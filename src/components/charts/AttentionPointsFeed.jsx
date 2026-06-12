import React, { useMemo } from 'react';
import { MessageSquareWarning, Calendar, MapPin, Clock, AlertTriangle, Database, Filter, Lightbulb } from 'lucide-react';

export default function AttentionPointsFeed({ rawData, filtrosGlobais = {} }) {
  
  const parseDate = (dateStr) => {
    if (!dateStr) return null;
    if (String(dateStr).includes('/')) {
      const [dia, mes, ano] = dateStr.split(' ')[0].split('/');
      return new Date(`${ano}-${mes}-${dia}T12:00:00`);
    }
    return new Date(dateStr);
  };

  //Inteligência para ignorar as preguiças de preenchimento
  const isRuido = (textoOriginal) => {
    let t = String(textoOriginal || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    t = t.replace(/[^\w\s]/gi, '').replace(/\s+/g, ' ').trim(); 

    if (t.length < 3 && t !== "ok" && t !== "na") return true; 

    const ignorar = [
      "ok", "na", "nda", "nada", "zerado", "tudo certo", "tudo ok", "normal", "padrao",
      "sem pontos de atencao", "sem ponto de atencao", "s pontos de atencao", "s ponto de atencao", 
      "sem pto de atencao", "s pto de atencao", "sem pa", "s pa", "sem p a",
      "sem ocorrencias", "sem ocorrencia", "s ocorrencia", "s ocorrencias",
      "sem divergencias", "sem divergencia", "s divergencia",
      "sem novidades", "sem novidade", "s novidade",
      "nada a declarar", "sem justificativa", "operacao normal", "nenhum", "nenhuma"
    ];

    if (ignorar.includes(t)) return true;
    if (t.startsWith("sem pontos de") || t.startsWith("sem ocorrencia")) return true;

    return false; 
  };

  const feedData = useMemo(() => {
    if (!rawData || rawData.length === 0) return [];

    // Puxamos os filtros e garantimos que os múltiplos sejam Arrays (mesmo padrão do Dashboard)
    const { regional = [], station = [], turno = [], semana = "", mes = "", dataInicio, dataFim } = filtrosGlobais;

    let filtrados = rawData.filter(row => {
      const texto = row[41]; // Coluna AP
      
      if (isRuido(texto)) return false;

      // Aplica os Filtros Múltiplos (Arrays)
      if (regional.length > 0 && !regional.includes(row[1])) return false;
      if (station.length > 0 && !station.includes(row[4])) return false;
      if (turno.length > 0 && !turno.includes(row[5])) return false;
      
      if (semana && row[2] !== semana) return false;
      
      const dObj = parseDate(row[3]);
      if (dObj && !isNaN(dObj)) {
        if (mes && String(dObj.getMonth() + 1).padStart(2, '0') !== mes) return false;
        
        if (dataInicio || dataFim) {
          const start = dataInicio ? new Date(dataInicio + 'T00:00:00') : null;
          const end = dataFim ? new Date(dataFim + 'T23:59:59') : null;
          if (start && dObj < start) return false;
          if (end && dObj > end) return false;
        }
      }
      return true;
    });

    return filtrados.map((row, idx) => ({
      id: idx,
      regional: row[1],
      semana: row[2],
      dataStr: String(row[3]).split(' ')[0],
      dataObj: parseDate(row[3]) || new Date(0),
      station: String(row[4]).replace('LM Hub_SP_', ''),
      turno: row[5],
      texto: String(row[41] || "").trim() 
    })).sort((a, b) => b.dataObj - a.dataObj);

  }, [rawData, filtrosGlobais]);

  const getTurnoColor = (turno) => {
    switch (String(turno).toUpperCase()) {
      case 'AM': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'PM1': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'PM2': return 'bg-purple-100 text-purple-800 border-purple-200';
      default: return 'bg-slate-100 text-slate-800 border-slate-200';
    }
  };

  return (
    <div className="flex flex-col gap-6 mt-6">
      
      {/* 🔥 BANNER DE STORYTELLING PARA A GESTÃO */}
      <div className="bg-white dark:bg-[#1f232d] p-5 md:p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-gray-800 shrink-0">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 bg-slate-50 dark:bg-[#15171e] p-5 rounded-xl border border-slate-200 dark:border-gray-700">
          
          {/* Pilar 1: Origem */}
          <div className="flex gap-3 items-start">
            <div className="p-2 bg-blue-50 dark:bg-blue-950/30 text-[#113366] dark:text-blue-400 rounded-lg shrink-0">
              <Database size={16} />
            </div>
            <div className="flex flex-col gap-1">
              <h4 className="text-[11px] font-black text-slate-800 dark:text-white uppercase tracking-wider">Origem dos Dados</h4>
              <p className="text-[11px] text-slate-500 dark:text-gray-400 font-medium leading-relaxed">
                Todos os relatos e justificativas apresentados neste <em>Logbook</em> são preenchidos <strong>totalmente pelos analistas</strong> na base durante o fechamento de cada turno.
              </p>
            </div>
          </div>

          {/* Pilar 2: Filtro Anti-Ruído */}
          <div className="flex gap-3 items-start border-t lg:border-t-0 lg:border-l border-slate-200 dark:border-gray-700 pt-4 lg:pt-0 lg:pl-6">
            <div className="p-2 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 rounded-lg shrink-0">
              <Filter size={16} />
            </div>
            <div className="flex flex-col gap-1">
              <h4 className="text-[11px] font-black text-slate-800 dark:text-white uppercase tracking-wider">Filtro Anti-Ruído</h4>
              <p className="text-[11px] text-slate-500 dark:text-gray-400 font-medium leading-relaxed">
                O sistema possui uma trava de limpeza que <strong>desconsidera automaticamente</strong> respostas vazias ou genéricas (ex: <em>"ok", "sem novidades", "nada a declarar", "sem pontos de atencao"</em>). Aqui você visualiza apenas problemas e ocorrências reais.
              </p>
            </div>
          </div>

          {/* Pilar 3: Dica Prática */}
          <div className="flex gap-3 items-start border-t lg:border-t-0 lg:border-l border-slate-200 dark:border-gray-700 pt-4 lg:pt-0 lg:pl-6">
            <div className="p-2 bg-orange-50 dark:bg-orange-950/20 text-[#EE4D2D] rounded-lg shrink-0">
              <Lightbulb size={16} />
            </div>
            <div className="flex flex-col gap-1">
              <h4 className="text-[11px] font-black text-slate-800 dark:text-white uppercase tracking-wider">Dica Prática de Análise</h4>
              <p className="text-[11px] text-slate-500 dark:text-gray-400 font-medium leading-relaxed">
                O Logbook é a resposta para os seus números. Se os painéis de <em>Gargalos</em>, <em>Realocação</em> ou <em>Tempo de Expedição</em> acusarem um Hub "estourado", busque o mesmo Hub/Data neste feed para entender a raiz do problema reportada pelo time.
              </p>
            </div>
          </div>

        </div>
      </div>

      {/* FEED DO LOGBOOK */}
      <div className="bg-white dark:bg-[#1f232d] rounded-2xl shadow-sm border border-[#113366] overflow-hidden flex flex-col max-h-[800px] min-h-[500px]">
        
        <div className="bg-[#113366] py-4 px-6 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-3">
             <MessageSquareWarning className="text-[#EE4D2D]" size={28} />
             <div>
                <h2 className="text-white text-xl font-black uppercase tracking-tight">Logbook Diário</h2>
                <p className="text-xs font-bold text-slate-300">Registros de gargalos e justificativas operacionais</p>
             </div>
          </div>
          <span className="bg-[#EE4D2D] text-white text-sm font-black px-4 py-1.5 rounded-full shadow-md border border-white/20">
            {feedData.length} Ocorrências
          </span>
        </div>

        <div className="p-6 overflow-y-auto custom-scrollbar flex-1 bg-slate-50/50 dark:bg-[#15171e]">
          {feedData.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 opacity-70 mt-10">
              <AlertTriangle size={64} className="mb-4 text-slate-300" />
              <p className="font-black text-xl text-slate-500">Nenhuma ocorrência relatada!</p>
              <p className="text-sm font-bold mt-2 max-w-sm text-center">
                A operação ocorreu dentro da normalidade para estes filtros. Mensagens de rotina e avisos genéricos foram ocultados automaticamente.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              {feedData.map(item => (
                <div key={item.id} className="bg-white dark:bg-[#1f232d] border border-slate-200 dark:border-gray-800 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
                  
                  <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-[#EE4D2D] opacity-60 group-hover:opacity-100 transition-opacity"></div>

                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-2 pl-2">
                      <MapPin size={18} className="text-[#113366] dark:text-blue-400" />
                      <h3 className="font-black text-[#113366] dark:text-white text-base uppercase tracking-tight">{item.station}</h3>
                    </div>
                    <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded border ${getTurnoColor(item.turno)}`}>
                      {item.turno}
                    </span>
                  </div>

                  <div className="flex items-center gap-4 text-xs font-bold text-slate-500 dark:text-gray-400 mb-4 pb-3 border-b border-slate-100 dark:border-gray-800 pl-2">
                    <span className="flex items-center gap-1.5"><Calendar size={14} /> {item.dataStr} ({item.semana})</span>
                    <span className="flex items-center gap-1.5"><Clock size={14} /> Região: {item.regional}</span>
                  </div>

                  <div className="text-sm text-slate-700 dark:text-gray-300 font-medium leading-relaxed whitespace-pre-wrap pl-2">
                    {item.texto}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}