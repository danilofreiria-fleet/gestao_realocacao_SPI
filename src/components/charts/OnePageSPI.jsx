import React, { useMemo, useState } from 'react';
import { Zap, ChevronDown, ChevronRight } from 'lucide-react';

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

export default function OnePageSPI({ rawData, dashData }) {
  const [expandedReg, setExpandedReg] = useState({});

  const parseNum = (val) => {
    let s = String(val || '0').trim();
    if (s.includes(',')) return Number(s.replace(/\./g, '').replace(',', '.'));
    return Number(s) || 0;
  };

  const formatInt = (val) => new Intl.NumberFormat('pt-BR').format(Math.round(val || 0));
  const formatMil = (val) => {
    if (!val || val < 1000) return formatInt(val);
    return `${(val / 1000).toFixed(2).replace('.', ',')} mil`;
  };

  const extractWeekNumber = (str) => {
    const match = String(str || "").match(/\d+/);
    return match ? parseInt(match[0], 10) : -1;
  };

  // 🎯 NOVA MÁGICA: Em vez de usar o relógio do PC, ele descobre qual é a "Semana Atual"
  // procurando qual é a maior semana preenchida dentro da sua própria base de dados!
  const currentWeekNum = useMemo(() => {
    let maxWeek = 0;
    if (rawData && rawData.length > 0) {
      rawData.forEach(row => {
        const w = extractWeekNumber(row[2]);
        if (w > maxWeek) maxWeek = w;
      });
    }
    if (maxWeek === 0 && dashData && dashData.length > 0) {
      dashData.forEach(row => {
        const w = extractWeekNumber(row[4]);
        if (w > maxWeek) maxWeek = w;
      });
    }
    return maxWeek > 0 ? maxWeek : 13; // Fallback de segurança
  }, [rawData, dashData]);

  const onePageData = useMemo(() => {
    const aggs = {};
    const regionaisConhecidas = ["SPI1", "SPI2", "SPI3", "SPI4", "SPI5"];
    
    regionaisConhecidas.forEach(r => {
      aggs[r] = { 
        driversOferta: 0, rotasAtsRot: 0, noShowAtsPiso: 0, 
        rhAtivos: 0, rhRisco: 0, rhDormentes: 0, rhChurn: 0, rhNecessarios: 0,
        hubs: {} 
      };
    });

    // ========================================================
    // 1. OPERACIONAL (Usando a Maior Semana Encontrada)
    // ========================================================
    if (rawData && rawData.length > 0) {
      rawData.forEach(row => {
        if (extractWeekNumber(row[2]) !== currentWeekNum) return;

        const station = row[4] || "";
        const regional = MAPA_REGIONAL[station];
        if (!regional) return;

        if (!aggs[regional].hubs[station]) {
          aggs[regional].hubs[station] = {
            driversOferta: 0, rotasAtsRot: 0, noShowAtsPiso: 0,
            rhAtivos: 0, rhRisco: 0, rhDormentes: 0, rhChurn: 0, rhNecessarios: 0
          };
        }

        aggs[regional].driversOferta += parseNum(row[24]);
        aggs[regional].rotasAtsRot += parseNum(row[11]);
        aggs[regional].noShowAtsPiso += parseNum(row[19]);

        aggs[regional].hubs[station].driversOferta += parseNum(row[24]);
        aggs[regional].hubs[station].rotasAtsRot += parseNum(row[11]);
        aggs[regional].hubs[station].noShowAtsPiso += parseNum(row[19]);
      });
    }

    // ========================================================
    // 2. RH (Com pulo de linhas vazias)
    // ========================================================
    const rhProcessado = new Set();
    if (dashData && dashData.length > 0) {
      dashData.forEach(row => {
        if (extractWeekNumber(row[4]) !== currentWeekNum) return;

        const station = String(row[3] || "").trim();
        const regional = MAPA_REGIONAL[station];
        if (!regional) return;

        const ativos = parseNum(row[14]);      
        const dormentes = parseNum(row[15]);   
        const risco = parseNum(row[16]);       
        const churn = parseNum(row[17]);       
        const necessarios = parseNum(row[18]); 

        // 🔥 CORREÇÃO VITAL: Se a linha do RH estiver zerada (ex: dia futuro), pula e vai pro dia anterior!
        if (ativos === 0 && necessarios === 0) return;

        if (rhProcessado.has(station)) return;
        rhProcessado.add(station);

        if (!aggs[regional].hubs[station]) {
          aggs[regional].hubs[station] = {
            driversOferta: 0, rotasAtsRot: 0, noShowAtsPiso: 0,
            rhAtivos: 0, rhRisco: 0, rhDormentes: 0, rhChurn: 0, rhNecessarios: 0
          };
        }

        aggs[regional].rhAtivos += ativos;
        aggs[regional].rhDormentes += dormentes;
        aggs[regional].rhRisco += risco;
        aggs[regional].rhChurn += churn;
        aggs[regional].rhNecessarios += necessarios;

        aggs[regional].hubs[station].rhAtivos = ativos;
        aggs[regional].hubs[station].rhDormentes = dormentes;
        aggs[regional].hubs[station].rhRisco = risco;
        aggs[regional].hubs[station].rhChurn = churn;
        aggs[regional].hubs[station].rhNecessarios = necessarios;
      });
    }

    return regionaisConhecidas.map(reg => {
      const r = aggs[reg];
      const hubsArr = Object.keys(r.hubs).map(hName => {
        const h = r.hubs[hName];
        return {
          name: hName,
          driversDisp: h.driversOferta,
          rotasDisp: h.rotasAtsRot,
          noShowPct: h.rotasAtsRot > 0 ? (h.noShowAtsPiso / h.rotasAtsRot) * 100 : 0,
          ativos: h.rhAtivos,
          churn: h.rhChurn,
          riscoPct: h.rhAtivos > 0 ? ((h.rhRisco + h.rhDormentes) / h.rhAtivos) * 100 : 0,
          gapPct: h.rhNecessarios > 0 ? ((h.rhAtivos - h.rhNecessarios) / h.rhNecessarios) * 100 : 0
        };
      });

      return {
        id: reg,
        colB_driversDisp: r.driversOferta,
        colC_rotasDisp: r.rotasAtsRot,
        colD_noShowPct: r.rotasAtsRot > 0 ? (r.noShowAtsPiso / r.rotasAtsRot) * 100 : 0,
        colE_driversAtivos: r.rhAtivos,
        colF_churn: r.rhChurn,
        colG_riscoChurnPct: r.rhAtivos > 0 ? ((r.rhRisco + r.rhDormentes) / r.rhAtivos) * 100 : 0,
        colH_gapPct: r.rhNecessarios > 0 ? ((r.rhAtivos - r.rhNecessarios) / r.rhNecessarios) * 100 : 0,
        hubs: hubsArr
      };
    });

  }, [rawData, dashData, currentWeekNum]);

  const toggleExpandReg = (id) =>
    setExpandedReg(prev => ({ ...prev, [id]: !prev[id] }));

  return (
    <div className="bg-white dark:bg-[#1f232d] rounded-2xl shadow-sm border border-[#113366] overflow-hidden">
      <div className="bg-[#113366] text-white text-center py-4 text-xl md:text-2xl font-black tracking-wider flex items-center justify-center gap-2">
        <Zap className="text-[#EE4D2D]" size={28}/> ONE PAGE SPI [W-{currentWeekNum}]
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-center text-sm whitespace-nowrap">
          <thead className="bg-[#EE4D2D] text-white text-[10px] uppercase font-bold tracking-widest">
            <tr>
              <th className="px-4 py-3">SUBREGIONAL</th>
              <th className="px-4 py-3">DRIVERS DISP.</th>
              <th className="px-4 py-3">ROTAS DISP.</th>
              <th className="px-4 py-3">NO SHOW</th>
              <th className="px-4 py-3">DRIVERS ATIVOS</th>
              <th className="px-4 py-3">CHURN</th>
              <th className="px-4 py-3">RISCO CHURN</th>
              <th className="px-4 py-3">% GAP</th>
            </tr>
          </thead>

          <tbody className="font-bold divide-y divide-slate-100 dark:divide-gray-800">
            {onePageData.map(row => {
               const noShowColor = row.colD_noShowPct > 2 ? 'text-[#D0011B]' : 'text-green-600';
               const gapColor = row.colH_gapPct >= 0 ? 'text-green-600' : 'text-[#D0011B]';

               return (
                <React.Fragment key={row.id}>
                  <tr onClick={() => toggleExpandReg(row.id)} className="cursor-pointer hover:bg-slate-50 dark:hover:bg-gray-800/30 transition-colors">
                    <td className="px-4 py-4 text-left flex items-center gap-2 text-[#EE4D2D] text-lg">
                       {expandedReg[row.id] ? <ChevronDown size={16}/> : <ChevronRight size={16}/>} {row.id}
                    </td>
                    <td className="px-4 py-4 text-slate-800 dark:text-white">{formatInt(row.colB_driversDisp)}</td>
                    <td className="px-4 py-4 text-slate-800 dark:text-white">{formatInt(row.colC_rotasDisp)}</td>
                    <td className={`px-4 py-4 ${noShowColor}`}>{row.colD_noShowPct.toFixed(2)}%</td>
                    <td className="px-4 py-4 text-slate-800 dark:text-white">{formatMil(row.colE_driversAtivos)}</td>
                    <td className="px-4 py-4 text-slate-800 dark:text-white">{formatMil(row.colF_churn)}</td>
                    <td className="px-4 py-4 text-slate-800 dark:text-white">{row.colG_riscoChurnPct.toFixed(2)}%</td>
                    <td className={`px-4 py-4 ${gapColor}`}>{row.colH_gapPct.toFixed(2)}%</td>
                  </tr>
                  {expandedReg[row.id] && row.hubs.map(hub => {
                     const hNoShowColor = hub.noShowPct > 2 ? 'text-[#D0011B]' : 'text-green-600';
                     const hGapColor = hub.gapPct >= 0 ? 'text-green-600' : 'text-[#D0011B]';
                     return (
                        <tr key={hub.name} className="bg-slate-50/50 dark:bg-[#15171e] text-xs text-slate-500 dark:text-gray-400">
                          <td className="px-4 py-2 text-left pl-10 font-medium">↳ {hub.name}</td>
                          <td className="px-4 py-2">{formatInt(hub.driversDisp)}</td>
                          <td className="px-4 py-2">{formatInt(hub.rotasDisp)}</td>
                          <td className={`px-4 py-2 font-bold ${hNoShowColor}`}>{hub.noShowPct.toFixed(2)}%</td>
                          <td className="px-4 py-2">{formatInt(hub.ativos)}</td>
                          <td className="px-4 py-2">{formatInt(hub.churn)}</td>
                          <td className="px-4 py-2">{hub.riscoPct.toFixed(2)}%</td>
                          <td className={`px-4 py-2 font-bold ${hGapColor}`}>{hub.gapPct.toFixed(2)}%</td>
                        </tr>
                     )
                  })}
                </React.Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}