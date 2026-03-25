import React, { useMemo, useState } from 'react';
import { CalendarDays, ChevronDown, ChevronRight } from 'lucide-react';

export default function AtPisoDiarioTable({ data, rawData, atPisoData }) {
  const [expandedReg, setExpandedReg] = useState({});

  const parseNum = (val) => {
    let s = String(val || '0').trim();
    if (s.includes(',')) return Number(s.replace(/\./g, '').replace(',', '.'));
    return Number(s) || 0;
  };

  const formatInt = (val) => new Intl.NumberFormat('pt-BR').format(Math.round(val || 0));

  const extractWeekNumber = (str) => {
    const match = String(str || "").trim().match(/^W[- ]?0*(\d+)$/i);
    return match ? parseInt(match[1], 10) : -1;
  };

  const targetWeekNum = useMemo(() => {
    const weeksInData = new Set();
    data.forEach(r => {
      const w = extractWeekNumber(r[2]);
      if (w > 0) weeksInData.add(w);
    });

    if (weeksInData.size === 1) return Array.from(weeksInData)[0];

    let maxWeek = 0;
    rawData.forEach(r => {
      const w = extractWeekNumber(r[2]);
      if (w > maxWeek) maxWeek = w;
    });
    return maxWeek > 0 ? maxWeek : 13;
  }, [data, rawData]);

  const tableData = useMemo(() => {
    if (!atPisoData || atPisoData.length === 0) return [];

    let headerRowIdx = -1;
    for (let i = 0; i < Math.min(20, atPisoData.length); i++) {
      if (atPisoData[i] && String(atPisoData[i][4]).trim() === "Abbreviation") {
        headerRowIdx = i;
        break;
      }
    }
    if (headerRowIdx === -1) return [];

    const headerRow = atPisoData[headerRowIdx];

    let weekColIdx = -1;
    for (let j = 0; j < headerRow.length; j++) {
      if (extractWeekNumber(headerRow[j]) === targetWeekNum) {
        weekColIdx = j;
        break;
      }
    }
    if (weekColIdx === -1) return [];

    const validHubs = new Set();
    data.forEach(r => {
      const hub = String(r[4] || "").trim();
      if (hub) validHubs.add(hub);
    });

    const aggs = {};

    for (let i = headerRowIdx + 1; i < atPisoData.length; i++) {
      const row = atPisoData[i];
      const rawHubName = String(row[4] || "").trim();
      if (!rawHubName) continue;

      if (validHubs.size > 0 && !validHubs.has(rawHubName)) continue;

      // 🔥 CORREÇÃO AQUI: Agora pega o índice 3 (Coluna D) que contém SPI1, SPI2, etc.
      const subregional = String(row[3] || "Sem Subregional").trim();
      
      const total = parseNum(row[weekColIdx]);
      const seg = parseNum(row[weekColIdx + 1]);
      const ter = parseNum(row[weekColIdx + 2]);
      const qua = parseNum(row[weekColIdx + 3]);
      const qui = parseNum(row[weekColIdx + 4]);
      const sex = parseNum(row[weekColIdx + 5]);
      const sab = parseNum(row[weekColIdx + 6]);
      const dom = parseNum(row[weekColIdx + 7]);

      if (!aggs[subregional]) {
        aggs[subregional] = { regional: subregional, total: 0, seg: 0, ter: 0, qua: 0, qui: 0, sex: 0, sab: 0, dom: 0, hubs: [] };
      }

      aggs[subregional].total += total; aggs[subregional].seg += seg; aggs[subregional].ter += ter;
      aggs[subregional].qua += qua; aggs[subregional].qui += qui; aggs[subregional].sex += sex;
      aggs[subregional].sab += sab; aggs[subregional].dom += dom;

      aggs[subregional].hubs.push({
        name: rawHubName.replace('LM Hub_SP_', ''),
        total, seg, ter, qua, qui, sex, sab, dom
      });
    }

    return Object.values(aggs).sort((a, b) => a.regional.localeCompare(b.regional));
  }, [atPisoData, targetWeekNum, data]);

  const toggleExpandReg = (id) => setExpandedReg(prev => ({ ...prev, [id]: !prev[id] }));

  if (tableData.length === 0) return null;

  const displayWeek = `W-${String(targetWeekNum).padStart(2, '0')}`;

  return (
    <div className="bg-white dark:bg-[#1f232d] rounded-2xl shadow-sm border border-[#EE4D2D] overflow-hidden pt-2">
      <div className="bg-[#113366] text-white text-center py-4 text-xl md:text-2xl font-black tracking-wider flex items-center justify-center gap-2">
        <CalendarDays className="text-[#EE4D2D]" size={28}/> AT NO PISO DIÁRIO - DATASUITE [{displayWeek}]
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-center text-sm whitespace-nowrap">
          <thead className="bg-[#EE4D2D] text-white text-[10px] uppercase font-bold tracking-widest">
            <tr>
              <th className="px-4 py-3 text-left">SUBREGIONAL / HUB</th>
              <th className="px-4 py-3">TOTAL SEMANA</th>
              <th className="px-4 py-3 text-slate-100">SEG</th>
              <th className="px-4 py-3 text-slate-100">TER</th>
              <th className="px-4 py-3 text-slate-100">QUA</th>
              <th className="px-4 py-3 text-slate-100">QUI</th>
              <th className="px-4 py-3 text-slate-100">SEX</th>
              <th className="px-4 py-3 text-slate-100">SÁB</th>
              <th className="px-4 py-3 text-slate-100">DOM</th>
            </tr>
          </thead>

          <tbody className="font-bold divide-y divide-slate-100 dark:divide-gray-800">
            {tableData.map(row => (
              <React.Fragment key={row.regional}>
                <tr onClick={() => toggleExpandReg(row.regional)} className="cursor-pointer hover:bg-slate-50 dark:hover:bg-gray-800/30 transition-colors">
                  <td className="px-4 py-4 text-left flex items-center gap-2 text-[#113366] dark:text-blue-400 text-lg">
                    {expandedReg[row.regional] ? <ChevronDown size={16}/> : <ChevronRight size={16}/>} {row.regional}
                  </td>
                  <td className="px-4 py-4 text-[#EE4D2D] text-lg">{formatInt(row.total)}</td>
                  <td className="px-4 py-4 text-slate-600 dark:text-gray-300">{formatInt(row.seg)}</td>
                  <td className="px-4 py-4 text-slate-600 dark:text-gray-300">{formatInt(row.ter)}</td>
                  <td className="px-4 py-4 text-slate-600 dark:text-gray-300">{formatInt(row.qua)}</td>
                  <td className="px-4 py-4 text-slate-600 dark:text-gray-300">{formatInt(row.qui)}</td>
                  <td className="px-4 py-4 text-slate-600 dark:text-gray-300">{formatInt(row.sex)}</td>
                  <td className="px-4 py-4 text-slate-800 dark:text-gray-100">{formatInt(row.sab)}</td>
                  <td className="px-4 py-4 text-slate-800 dark:text-gray-100">{formatInt(row.dom)}</td>
                </tr>
                {expandedReg[row.regional] && row.hubs.map(hub => (
                  <tr key={hub.name} className="bg-slate-50/50 dark:bg-[#15171e] text-xs text-slate-500 dark:text-gray-400">
                    <td className="px-4 py-2 text-left pl-10 font-medium">↳ {hub.name}</td>
                    <td className="px-4 py-2 text-[#EE4D2D] font-bold">{formatInt(hub.total)}</td>
                    <td className="px-4 py-2">{formatInt(hub.seg)}</td>
                    <td className="px-4 py-2">{formatInt(hub.ter)}</td>
                    <td className="px-4 py-2">{formatInt(hub.qua)}</td>
                    <td className="px-4 py-2">{formatInt(hub.qui)}</td>
                    <td className="px-4 py-2">{formatInt(hub.sex)}</td>
                    <td className="px-4 py-2 font-bold">{formatInt(hub.sab)}</td>
                    <td className="px-4 py-2 font-bold">{formatInt(hub.dom)}</td>
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