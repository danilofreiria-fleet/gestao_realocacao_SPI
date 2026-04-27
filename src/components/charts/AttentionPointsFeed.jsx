import React, { useMemo } from 'react';
import { MessageSquareWarning, Calendar, MapPin, Clock, AlertTriangle } from 'lucide-react';

export default function AttentionPointsFeed({ rawData, filtrosGlobais = {} }) {
  
  const parseDate = (dateStr) => {
    if (!dateStr) return null;
    if (String(dateStr).includes('/')) {
      const [dia, mes, ano] = dateStr.split(' ')[0].split('/');
      return new Date(`${ano}-${mes}-${dia}T12:00:00`);
    }
    return new Date(dateStr);
  };

  // 🔥 SUPER FILTRO DE RUÍDO: Inteligência para ignorar as preguiças de preenchimento
  const isRuido = (textoOriginal) => {
    // 1. Remove acentos, transforma em minúscula e tira pontuações (pontos, barras, traços)
    let t = String(textoOriginal || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    t = t.replace(/[^\w\s]/gi, '').replace(/\s+/g, ' ').trim(); // "s/ pontos." vira "s pontos"

    if (t.length < 3 && t !== "ok" && t !== "na") return true; 

    // 2. Lista de correspondências exatas após a limpeza
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

    // 3. Captura frases que começam com "sem pontos..." mesmo se tiver algo a mais esquecido
    if (t.startsWith("sem pontos de") || t.startsWith("sem ocorrencia")) return true;

    return false; // Se sobreviveu a tudo isso, é um relato real!
  };

  const feedData = useMemo(() => {
    if (!rawData || rawData.length === 0) return [];

    let filtrados = rawData.filter(row => {
      // Ajuste o índice 41 se a coluna AP não for a 41 (A=0, B=1... AP=41)
      const texto = row[41]; 
      
      // Passa pela guilhotina do filtro de ruído
      if (isRuido(texto)) return false;

      // APLICA OS FILTROS GLOBAIS DE DATA/STATION/TURNO
      const dObj = parseDate(row[3]);
      let pass = true;
      if (filtrosGlobais.regional && row[1] !== filtrosGlobais.regional) pass = false;
      if (filtrosGlobais.station && row[4] !== filtrosGlobais.station) pass = false;
      if (filtrosGlobais.semana && row[2] !== filtrosGlobais.semana) pass = false;
      if (filtrosGlobais.turno && filtrosGlobais.turno.length > 0 && !filtrosGlobais.turno.includes(row[5])) pass = false;
      
      if (dObj && !isNaN(dObj)) {
        if (filtrosGlobais.mes && String(dObj.getMonth() + 1).padStart(2, '0') !== filtrosGlobais.mes) pass = false;
        if (filtrosGlobais.dataInicio || filtrosGlobais.dataFim) {
          const start = filtrosGlobais.dataInicio ? new Date(filtrosGlobais.dataInicio + 'T00:00:00') : null;
          const end = filtrosGlobais.dataFim ? new Date(filtrosGlobais.dataFim + 'T23:59:59') : null;
          if (start && dObj < start) pass = false;
          if (end && dObj > end) pass = false;
        }
      }
      return pass;
    });

    // FORMATA O OBJETO E ORDENA DA DATA MAIS RECENTE PARA A MAIS ANTIGA
    return filtrados.map((row, idx) => ({
      id: idx,
      regional: row[1],
      semana: row[2],
      dataStr: String(row[3]).split(' ')[0],
      dataObj: parseDate(row[3]) || new Date(0),
      station: String(row[4]).replace('LM Hub_SP_', ''),
      turno: row[5],
      texto: String(row[41] || "").trim() // Mantém o texto original para exibição
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
    <div className="bg-white dark:bg-[#1f232d] rounded-2xl shadow-sm border border-[#113366] overflow-hidden mt-6 flex flex-col max-h-[800px] min-h-[500px]">
      
      {/* HEADER DO FEED */}
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

      {/* CORPO DO FEED */}
      <div className="p-6 overflow-y-auto custom-scrollbar flex-1 bg-slate-50/50 dark:bg-[#15171e]">
        {feedData.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-400 opacity-70 mt-10">
            <AlertTriangle size={64} className="mb-4 text-slate-300" />
            <p className="font-black text-xl text-slate-500">Nenhuma ocorrência relatada!</p>
            <p className="text-sm font-bold mt-2 max-w-sm text-center">
              A operação ocorreu dentro da normalidade para estes filtros. Mensagens de rotina e avisos de "sem pontos de atenção" foram ocultados automaticamente.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {feedData.map(item => (
              <div key={item.id} className="bg-white dark:bg-[#1f232d] border border-slate-200 dark:border-gray-800 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
                
                {/* Barra lateral vermelha de destaque */}
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

                {/* Texto da Ocorrência preservando quebras de linha e emojis */}
                <div className="text-sm text-slate-700 dark:text-gray-300 font-medium leading-relaxed whitespace-pre-wrap pl-2">
                  {item.texto}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}