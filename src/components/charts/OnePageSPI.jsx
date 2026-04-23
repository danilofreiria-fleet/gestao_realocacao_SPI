import React, { useMemo, useState } from 'react';
import { Zap, ChevronDown, ChevronRight } from 'lucide-react';

const MAPA_REGIONAL = {
  "LM Hub_SP_Campinas_São Martinho": "SPI1", "LM Hub_SP_Leme": "SPI1", "LM Hub_SP_Limeira_Campo Belo": "SPI1",
  "LM Hub_SP_Mogi Mirim": "SPI1", "LM Hub_SP_Piracicaba": "SPI1", "LM Hub_SP_Sumaré_Nova Veneza": "SPI1",
  "LM Hub_SP_Campinas_PqCidade": "SPI1", "LM Hub_SP_Araraquara": "SPO1", "LM Hub_SP_Bauru_Centro": "SPO3",
  "LM Hub_SP_Jaú": "SPO1", "LM Hub_SP_Ribeirão Preto_02": "SPO1", "LM Hub_SP_São Carlos": "SPO1",
  "LM Hub_SP_RibeirãoPretoEstaça": "SPO1", "LM Hub_SP_Barretos": "SPO2", "LM Hub_SP_Franca_Distrito_Indust": "SPO2",
  "LM Hub_SP_São José do Rio P": "SPO2", "LM Hub_SP_Votuporanga": "SPO2", "LM Hub_SP_Botucatu": "SPI3",
  "LM Hub_SP_Atibaia_Ponte_Alta": "SPI2", "LM Hub_SP_Itapetininga": "SPI3", "LM Hub_SP_Itapeva": "SPI3",
  "LM Hub_SP_Jundiaí": "SPI2", "LM Hub_SP_Sorocaba_Região Norte": "SPI3", "LM Hub_SP_Tatuí": "SPI3",
  "LM Hub_SP_Várzea Paulista": "SPI2", "LM Hub_SP_Araçatuba": "SPO2", "LM Hub_SP_Assis": "SPO3",
  "LM Hub_SP_Marília": "SPO3", "LM Hub_SP_Presidente Prudente": "SPO3"
};

const REGIONAIS_ATIVAS = Array.from(new Set(Object.values(MAPA_REGIONAL))).sort();

// 🔥 RECEBEMOS O firstTripsData AQUI
export default function OnePageSPI({ rawData, baseData, firstTripsData }) {
  const [expandedReg, setExpandedReg] = useState({});

  const normalizar = (t) => String(t || "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/lmhub_sp_|hub_sp_|_1/g, "").replace(/\s+/g, '');

  const parseNum = (val) => {
    let s = String(val || '0').trim();
    if (s.includes(',')) return Number(s.replace(/\./g, '').replace(',', '.'));
    return Number(s) || 0;
  };

  const formatInt = (val) => new Intl.NumberFormat('pt-BR').format(Math.round(val || 0));
  const formatMil = (val) => (!val || val < 1000) ? formatInt(val) : `${(val / 1000).toFixed(2).replace('.', ',')} mil`;

  const extractWeekNumber = (str) => {
    const match = String(str || "").match(/\d+/);
    return match ? parseInt(match[0], 10) : -1;
  };

  const currentWeekNum = useMemo(() => {
    let maxW = 0;
    if (rawData) {
      rawData.forEach(r => {
        const w = extractWeekNumber(r[2]);
        if (w > maxW) maxW = w;
      });
    }
    return maxW || 17;
  }, [rawData]);

  const onePageData = useMemo(() => {
    const aggs = {};
    
    REGIONAIS_ATIVAS.forEach(r => {
      aggs[r] = { driversOferta: 0, rotasAtsRot: 0, noShowAtsPiso: 0, rhAtivos: 0, rhDormentes: 0, rhChurn: 0, mediaDisp: 0, firstTrips: 0, hubs: {} };
    });

    if (rawData) {
      rawData.forEach(row => {
        const w = extractWeekNumber(row[2]);
        if (w !== currentWeekNum) return;

        const station = String(row[4] || "").trim();
        const regional = MAPA_REGIONAL[station];
        if (!regional) return;

        if (!aggs[regional].hubs[station]) {
          aggs[regional].hubs[station] = { driversOferta: 0, rotasAtsRot: 0, noShowAtsPiso: 0, rhAtivos: 0, rhDormentes: 0, rhChurn: 0, mediaDisp: 0, firstTrips: 0 };
        }

        const noShowVal = Math.abs(parseNum(row[19])); 
        aggs[regional].driversOferta += parseNum(row[24]);
        aggs[regional].rotasAtsRot += parseNum(row[11]);
        aggs[regional].noShowAtsPiso += noShowVal;

        aggs[regional].hubs[station].driversOferta += parseNum(row[24]);
        aggs[regional].hubs[station].rotasAtsRot += parseNum(row[11]);
        aggs[regional].hubs[station].noShowAtsPiso += noShowVal;
      });
    }

    if (baseData) {
      const rhVistos = new Set();
      baseData.forEach(row => {
        const station = String(row[0] || "").trim();
        const regional = MAPA_REGIONAL[station];
        if (!regional || !aggs[regional]) return;

        const hubKey = Object.keys(aggs[regional].hubs).find(h => normalizar(h) === normalizar(station)) || station;
        if (!aggs[regional].hubs[hubKey]) {
            aggs[regional].hubs[hubKey] = { driversOferta: 0, rotasAtsRot: 0, noShowAtsPiso: 0, rhAtivos: 0, rhDormentes: 0, rhChurn: 0, mediaDisp: 0, firstTrips: 0 };
        }

        aggs[regional].mediaDisp += parseNum(row[12]);
        aggs[regional].hubs[hubKey].mediaDisp += parseNum(row[12]);

        if (!rhVistos.has(station)) {
          rhVistos.add(station);
          const ativos = parseNum(row[9]);
          aggs[regional].rhAtivos += ativos;
          aggs[regional].rhChurn += parseNum(row[10]);
          aggs[regional].rhDormentes += parseNum(row[11]);
          aggs[regional].hubs[hubKey].rhAtivos = ativos;
          aggs[regional].hubs[hubKey].rhChurn = parseNum(row[10]);
          aggs[regional].hubs[hubKey].rhDormentes = parseNum(row[11]);
        }
      });
    }

    // 🔥 NOVA LÓGICA DE FIRST TRIPS (Busca EXATAMENTE a semana que o OnePage está mostrando)
    if (firstTripsData && firstTripsData.length > 1) {
      const headers = firstTripsData[0];
      // Ex: Formata currentWeekNum (17) para "W-17" para achar a coluna correta
      const targetWeekStr = `W-${String(currentWeekNum).padStart(2, '0')}`;
      const targetColIndex = headers.findIndex(h => h === targetWeekStr);

      if (targetColIndex !== -1) {
        firstTripsData.slice(1).forEach(row => {
          const station = String(row[0] || "").trim();
          const regional = MAPA_REGIONAL[station];
          if (!regional || !aggs[regional]) return;

          const hubKey = Object.keys(aggs[regional].hubs).find(h => normalizar(h) === normalizar(station)) || station;
          if (!aggs[regional].hubs[hubKey]) return; // Só soma em hubs que tiveram operação na semana

          const qtdFirstTripsSemana = parseNum(row[targetColIndex]);
          
          aggs[regional].firstTrips += qtdFirstTripsSemana;
          aggs[regional].hubs[hubKey].firstTrips += qtdFirstTripsSemana;
        });
      }
    }

    return REGIONAIS_ATIVAS.map(reg => {
      const r = aggs[reg];
      const hubsArr = Object.keys(r.hubs).sort().map(hName => {
        const h = r.hubs[hName];
        return { name: hName, driversOferta: h.driversOferta, mediaDisp: h.mediaDisp, rotasDisp: h.rotasAtsRot, noShowPct: h.rotasAtsRot > 0 ? (h.noShowAtsPiso / h.rotasAtsRot) * 100 : 0, ativos: h.rhAtivos, dormentes: h.rhDormentes, churn: h.rhChurn, firstTrips: h.firstTrips };
      });
      return { id: reg, ofertaAtual: r.driversOferta, mediaDisp: r.mediaDisp, rotas: r.rotasAtsRot, noShowPct: r.rotasAtsRot > 0 ? (r.noShowAtsPiso / r.rotasAtsRot) * 100 : 0, ativos: r.rhAtivos, dormentes: r.rhDormentes, churn: r.rhChurn, firstTrips: r.firstTrips, hubs: hubsArr };
    });
  }, [rawData, baseData, firstTripsData, currentWeekNum]);

  const toggleExpandReg = (id) => setExpandedReg(prev => ({ ...prev, [id]: !prev[id] }));

  return (
    <div className="bg-white dark:bg-[#1f232d] rounded-2xl shadow-sm border border-[#113366] overflow-hidden">
      <div className="bg-[#113366] text-white text-center py-4 text-xl md:text-2xl font-black tracking-wider flex items-center justify-center gap-2">
        <Zap className="text-[#EE4D2D]" size={28}/> ONE PAGE SEMANAL [W-{currentWeekNum}]
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-center text-sm whitespace-nowrap">
          <thead className="bg-[#EE4D2D] text-white text-[10px] uppercase font-bold tracking-widest">
            <tr>
              <th className="px-4 py-3 text-left">SUBREGIONAL</th>
              <th className="px-4 py-3">OFERTA (W)</th>
              <th className="px-4 py-3 bg-white/10">MÉDIA DISP.</th>
              <th className="px-4 py-3">ROTAS (W)</th>
              <th className="px-4 py-3">NO SHOW</th>
              <th className="px-4 py-3 border-l border-white/20">ATIVOS</th>
              <th className="px-4 py-3 text-orange-200">DORMENTES</th>
              <th className="px-4 py-3 text-red-200">CHURN</th>
              {/* Título adaptado para deixar claro que é só da semana da tabela */}
              <th className="px-4 py-3 bg-white/10 border-l border-white/20">1ST TRIPS (W)</th>
            </tr>
          </thead>
          <tbody className="font-bold divide-y divide-slate-100 dark:divide-gray-800">
            {onePageData.map(row => (
              <React.Fragment key={row.id}>
                <tr onClick={() => toggleExpandReg(row.id)} className="cursor-pointer hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-4 text-left flex items-center gap-2 text-[#EE4D2D] text-lg">
                    {expandedReg[row.id] ? <ChevronDown size={16}/> : <ChevronRight size={16}/>} {row.id}
                  </td>
                  <td className="px-4 py-4">{formatInt(row.ofertaAtual)}</td>
                  <td className="px-4 py-4 bg-slate-50/50">{formatInt(row.mediaDisp)}</td>
                  <td className="px-4 py-4">{formatInt(row.rotas)}</td>
                  <td className={`px-4 py-4 ${row.noShowPct > 2 ? 'text-[#D0011B]' : 'text-green-600'}`}>{row.noShowPct.toFixed(2)}%</td>
                  <td className="px-4 py-4 border-l">{formatMil(row.ativos)}</td>
                  <td className="px-4 py-4 text-orange-600">{formatMil(row.dormentes)}</td>
                  <td className="px-4 py-4 text-[#D0011B]">{formatMil(row.churn)}</td>
                  <td className="px-4 py-4 border-l bg-slate-50/50 text-[#113366] text-base">{formatInt(row.firstTrips)}</td>
                </tr>
                {expandedReg[row.id] && row.hubs.map(hub => (
                  <tr key={hub.name} className="bg-slate-50/50 text-xs text-slate-500">
                    <td className="px-4 py-2 text-left pl-10">↳ {hub.name}</td>
                    <td className="px-4 py-2">{formatInt(hub.driversOferta)}</td>
                    <td className="px-4 py-2 font-bold bg-white/5">{formatInt(hub.mediaDisp)}</td>
                    <td className="px-4 py-2">{formatInt(hub.rotasDisp)}</td>
                    <td className={`px-4 py-2 font-bold ${hub.noShowPct > 2 ? 'text-[#D0011B]' : 'text-green-600'}`}>{hub.noShowPct.toFixed(2)}%</td>
                    <td className="px-4 py-2 border-l">{formatInt(hub.ativos)}</td>
                    <td className="px-4 py-2">{formatInt(hub.dormentes)}</td>
                    <td className="px-4 py-2">{formatInt(hub.churn)}</td>
                    <td className="px-4 py-2 font-bold border-l bg-white/5 text-[#113366]">{formatInt(hub.firstTrips)}</td>
                  </tr>
                ))}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}