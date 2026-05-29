import React, { useMemo, useState } from 'react';
import { ComposedChart, BarChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, LabelList, ReferenceLine } from 'recharts';
import { Truck, Maximize2, Minimize2, X, Calendar, CalendarDays } from 'lucide-react';

const NAMES_MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

export default function VolumeDispatchCharts({ data }) {
  const [fullscreenChart, setFullscreenChart] = useState(null);

  // ========================================================
  // PARSERS SEGUROS
  // ========================================================
  const parseNum = (val) => {
    let s = String(val || '0').trim();
    if (s.includes(',')) return Number(s.replace(/\./g, '').replace(',', '.'));
    return Number(s) || 0;
  };

  const parseUniversalDate = (dateStr) => {
    if (!dateStr) return null;
    let s = String(dateStr).trim().split('T')[0].split(' ')[0];
    if (s.includes('/')) {
      const [dia, mes, ano] = s.split('/');
      if (ano && mes && dia) return new Date(ano, mes - 1, dia, 12, 0, 0);
    }
    if (s.includes('-')) {
      const [ano, mes, dia] = s.split('-');
      if (ano && mes && dia) return new Date(ano, mes - 1, dia, 12, 0, 0);
    }
    return null;
  };

  const extractWeekNumber = (str) => {
    const match = String(str || "").match(/\d+/);
    return match ? parseInt(match[0], 10) : 999;
  };

  // ========================================================
  // MOTOR DE CÁLCULO DE DADOS E VARIAÇÕES INDIVIDUAIS
  // ========================================================
  const processedData = useMemo(() => {
    if (!data || data.length === 0) return { dailyAggregated: [], weeklyAggregated: [], monthlyAggregated: [] };

    const rawDayAgg = {};
    const rawWeekAgg = {};
    const rawMonthAgg = {};

    // 1. Agrupamento Bruto
    data.forEach(row => {
      const dateObj = parseUniversalDate(row[3]); 
      const weekStr = row[2] || '';             
      
      const volPlanned = parseNum(row[12]);    
      const volProcessed = parseNum(row[13]);  
      const volExpedited = parseNum(row[14]);  
      const sprPlanned = parseNum(row[15]);  // SPR Roteirizado (Coluna P)
      const sprDelivering = parseNum(row[16]);  // SPR Expedido (Coluna Q)

      const rotasRoteirizadas = parseNum(row[11]); 
      const cargUtil = parseNum(row[25]);          
      const cargPass = parseNum(row[26]);          
      const cargMoto = parseNum(row[27]);          
      const cargVan = parseNum(row[28]);           
      const cargTotal = cargUtil + cargPass + cargMoto + cargVan;

      const baseDataObj = { 
        volPlanned: 0, volProcessed: 0, volExpedited: 0, 
        sprSum: 0, sprCount: 0, 
        sprPlannedSum: 0, sprPlannedCount: 0, 
        rotasRoteirizadas: 0, cargUtil: 0, cargPass: 0, cargMoto: 0, cargVan: 0, cargTotal: 0 
      };

      if (dateObj) {
        // Chaves para Dia e Mês
        const dayKey = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;
        const monthKey = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}`;
        
        // --- AGREGADOR DIÁRIO ---
        if (!rawDayAgg[dayKey]) rawDayAgg[dayKey] = { ...baseDataObj };
        rawDayAgg[dayKey].volPlanned += volPlanned;
        rawDayAgg[dayKey].volProcessed += volProcessed;
        rawDayAgg[dayKey].volExpedited += volExpedited;
        rawDayAgg[dayKey].sprSum += sprDelivering;
        rawDayAgg[dayKey].sprCount += 1;
        rawDayAgg[dayKey].sprPlannedSum += sprPlanned; 
        rawDayAgg[dayKey].sprPlannedCount += 1; 
        rawDayAgg[dayKey].rotasRoteirizadas += rotasRoteirizadas;
        rawDayAgg[dayKey].cargUtil += cargUtil;
        rawDayAgg[dayKey].cargPass += cargPass;
        rawDayAgg[dayKey].cargMoto += cargMoto;
        rawDayAgg[dayKey].cargVan += cargVan;
        rawDayAgg[dayKey].cargTotal += cargTotal;

        // --- AGREGADOR MENSAL ---
        if (!rawMonthAgg[monthKey]) rawMonthAgg[monthKey] = { ...baseDataObj };
        rawMonthAgg[monthKey].volPlanned += volPlanned;
        rawMonthAgg[monthKey].volProcessed += volProcessed;
        rawMonthAgg[monthKey].volExpedited += volExpedited;
        rawMonthAgg[monthKey].sprSum += sprDelivering;
        rawMonthAgg[monthKey].sprCount += 1;
        rawMonthAgg[monthKey].sprPlannedSum += sprPlanned; 
        rawMonthAgg[monthKey].sprPlannedCount += 1; 
        rawMonthAgg[monthKey].rotasRoteirizadas += rotasRoteirizadas;
        rawMonthAgg[monthKey].cargUtil += cargUtil;
        rawMonthAgg[monthKey].cargPass += cargPass;
        rawMonthAgg[monthKey].cargMoto += cargMoto;
        rawMonthAgg[monthKey].cargVan += cargVan;
        rawMonthAgg[monthKey].cargTotal += cargTotal;
      }

      // --- AGREGADOR SEMANAL ---
      if (weekStr && weekStr.toUpperCase().includes('W-')) {
        if (!rawWeekAgg[weekStr]) rawWeekAgg[weekStr] = { ...baseDataObj };
        rawWeekAgg[weekStr].volPlanned += volPlanned;
        rawWeekAgg[weekStr].volProcessed += volProcessed;
        rawWeekAgg[weekStr].volExpedited += volExpedited;
        rawWeekAgg[weekStr].sprSum += sprDelivering;
        rawWeekAgg[weekStr].sprCount += 1;
        rawWeekAgg[weekStr].sprPlannedSum += sprPlanned; 
        rawWeekAgg[weekStr].sprPlannedCount += 1; 
        rawWeekAgg[weekStr].rotasRoteirizadas += rotasRoteirizadas;
        rawWeekAgg[weekStr].cargUtil += cargUtil;
        rawWeekAgg[weekStr].cargPass += cargPass;
        rawWeekAgg[weekStr].cargMoto += cargMoto;
        rawWeekAgg[weekStr].cargVan += cargVan;
        rawWeekAgg[weekStr].cargTotal += cargTotal;
      }
    });

    const calculateVar = (curr, prev) => {
      if (!prev || prev === 0) return 0;
      return Number((((curr - prev) / prev) * 100).toFixed(1));
    };

    // 2. Formatador Genérico
    const formatAggregatedData = (rawObj, periodType) => {
      return Object.keys(rawObj)
        .sort((a, b) => {
          if (periodType === 'week') return extractWeekNumber(a) - extractWeekNumber(b);
          return a.localeCompare(b); // Para Day (YYYY-MM-DD) e Month (YYYY-MM) a ordem alfabética já resolve cronologicamente
        })
        .map((key, index, arr) => {
          const d = rawObj[key];
          const prev = index > 0 ? rawObj[arr[index - 1]] : null;
          
          const sprAvg = d.sprCount > 0 ? Number((d.sprSum / d.sprCount).toFixed(2)) : 0;
          const prevSprAvg = prev && prev.sprCount > 0 ? (prev.sprSum / prev.sprCount) : 0;

          const sprPlannedAvg = d.sprPlannedCount > 0 ? Number((d.sprPlannedSum / d.sprPlannedCount).toFixed(2)) : 0;
          const prevSprPlannedAvg = prev && prev.sprPlannedCount > 0 ? (prev.sprPlannedSum / prev.sprPlannedCount) : 0;

          const gapSpr = Number((sprAvg - sprPlannedAvg).toFixed(2));

          // 🔥 CÁLCULO DE PROPORÇÃO (%) DOS MODAIS
          const pctUtil = d.cargTotal > 0 ? Number(((d.cargUtil / d.cargTotal) * 100).toFixed(1)) : 0;
          const pctPass = d.cargTotal > 0 ? Number(((d.cargPass / d.cargTotal) * 100).toFixed(1)) : 0;
          const pctMoto = d.cargTotal > 0 ? Number(((d.cargMoto / d.cargTotal) * 100).toFixed(1)) : 0;
          const pctVan  = d.cargTotal > 0 ? Number(((d.cargVan / d.cargTotal) * 100).toFixed(1)) : 0;

          let name = key;
          if (periodType === 'month') {
            const [year, month] = key.split('-');
            name = `${NAMES_MESES[parseInt(month, 10) - 1]}/${year.substring(2)}`;
          } else if (periodType === 'day') {
            const [year, month, day] = key.split('-');
            name = `${day}/${month}`;
          }

          return {
            name,
            volPlanned: d.volPlanned,
            varPlannedPct: calculateVar(d.volPlanned, prev?.volPlanned),
            
            volProcessed: d.volProcessed,
            varProcessedPct: calculateVar(d.volProcessed, prev?.volProcessed),
            
            volExpedited: d.volExpedited,
            varExpeditedPct: calculateVar(d.volExpedited, prev?.volExpedited),
            
            sprDeliveringAvg: sprAvg,
            varSprPct: calculateVar(sprAvg, prevSprAvg),

            sprPlannedAvg: sprPlannedAvg,
            varSprPlannedPct: calculateVar(sprPlannedAvg, prevSprPlannedAvg),

            gapSpr: gapSpr, 

            rotasRoteirizadas: d.rotasRoteirizadas,
            varRotasPct: calculateVar(d.rotasRoteirizadas, prev?.rotasRoteirizadas),

            cargUtil: d.cargUtil,
            varCargUtilPct: calculateVar(d.cargUtil, prev?.cargUtil),

            cargPass: d.cargPass,
            varCargPassPct: calculateVar(d.cargPass, prev?.cargPass),

            cargMoto: d.cargMoto,
            varCargMotoPct: calculateVar(d.cargMoto, prev?.cargMoto),

            cargVan: d.cargVan,
            varCargVanPct: calculateVar(d.cargVan, prev?.cargVan),

            cargTotal: d.cargTotal,
            varCargTotalPct: calculateVar(d.cargTotal, prev?.cargTotal),

            // Novos campos para o gráfico de Stack
            pctUtil,
            pctPass,
            pctMoto,
            pctVan
          };
        });
    };

    return { 
      dailyAggregated: formatAggregatedData(rawDayAgg, 'day'),
      weeklyAggregated: formatAggregatedData(rawWeekAgg, 'week'),
      monthlyAggregated: formatAggregatedData(rawMonthAgg, 'month')
    };
  }, [data]);

  // ========================================================
  // COMPONENTES VISUAIS
  // ========================================================
  
  const formatYAxis = (tickItem) => {
    if (tickItem === 0) return '0';
    if (tickItem >= 1000000) return `${(tickItem / 1000000).toFixed(1)}M`;
    if (tickItem >= 1000) return `${(tickItem / 1000).toFixed(0)}k`;
    return tickItem.toString();
  };

  const CustomTooltip = ({ active, payload, label, suffix = '', valueName = 'Valor', lineKey, isModal = false, isSprCompare = false, isProportion = false, selectedModal = 'ALL' }) => {
    if (active && payload && payload.length) {
      
      // TOOLTIP DE PROPORÇÃO (%)
      if (isProportion) {
        const pUtil = payload.find(p => p.dataKey === 'pctUtil')?.value || 0;
        const pPass = payload.find(p => p.dataKey === 'pctPass')?.value || 0;
        const pMoto = payload.find(p => p.dataKey === 'pctMoto')?.value || 0;
        const pVan = payload.find(p => p.dataKey === 'pctVan')?.value || 0;

        const utilAbs = payload.find(p => p.dataKey === 'pctUtil')?.payload?.cargUtil || 0;
        const passAbs = payload.find(p => p.dataKey === 'pctPass')?.payload?.cargPass || 0;
        const motoAbs = payload.find(p => p.dataKey === 'pctMoto')?.payload?.cargMoto || 0;
        const vanAbs = payload.find(p => p.dataKey === 'pctVan')?.payload?.cargVan || 0;
        const totalAbs = payload.find(p => p.dataKey === 'pctUtil')?.payload?.cargTotal || 0;

        return (
          <div className="bg-white dark:bg-[#1f232d] p-3 rounded-lg shadow-xl border border-[#113366]">
            <p className="font-black text-[#113366] dark:text-[#EE4D2D] border-b border-slate-200 pb-2 mb-2">{label}</p>
            <p className="font-black text-slate-500 dark:text-white mb-2 text-xs uppercase tracking-wider">Total Expedido: {totalAbs.toLocaleString('pt-BR')} rotas</p>
            <div className="text-sm font-bold space-y-1">
              <p style={{ color: '#113366' }}>Utilitário: {pUtil}% <span className="text-[10px] text-slate-400">({utilAbs.toLocaleString('pt-BR')})</span></p>
              <p style={{ color: '#EE4D2D' }}>Passeio: {pPass}% <span className="text-[10px] text-slate-400">({passAbs.toLocaleString('pt-BR')})</span></p>
              <p style={{ color: '#D0011B' }}>Moto: {pMoto}% <span className="text-[10px] text-slate-400">({motoAbs.toLocaleString('pt-BR')})</span></p>
              {pVan > 0 && <p style={{ color: '#F59E0B' }}>Van: {pVan}% <span className="text-[10px] text-slate-400">({vanAbs.toLocaleString('pt-BR')})</span></p>}
            </div>
          </div>
        );
      }

      if (isSprCompare) {
        const rot = payload.find(p => p.dataKey === 'sprPlannedAvg')?.value || 0;
        const exp = payload.find(p => p.dataKey === 'sprDeliveringAvg')?.value || 0;
        const gap = payload.find(p => p.dataKey === 'gapSpr')?.value || 0;

        return (
          <div className="bg-white dark:bg-[#1f232d] p-3 rounded-lg shadow-xl border border-[#113366]">
            <p className="font-black text-[#113366] dark:text-[#EE4D2D] border-b border-slate-200 pb-2 mb-2">{label}</p>
            <p className="font-bold text-sm mt-1" style={{ color: '#EE4D2D' }}>SPR Roteirizado: {rot}</p>
            <p className="font-bold text-sm mt-1" style={{ color: '#113366' }}>SPR Expedido: {exp}</p>
            <p className="font-black mt-3 text-[#D0011B] pt-2 border-t border-slate-100">
              Diferença (Gap): {gap > 0 ? '+' : ''}{gap} pacotes/rota
            </p>
          </div>
        );
      }

      if (isModal) {
        const varData = payload.find(p => p.dataKey === lineKey);
        const util = payload.find(p => p.dataKey === 'cargUtil')?.value || 0;
        const pass = payload.find(p => p.dataKey === 'cargPass')?.value || 0;
        const moto = payload.find(p => p.dataKey === 'cargMoto')?.value || 0;
        const van = payload.find(p => p.dataKey === 'cargVan')?.value || 0;
        const total = util + pass + moto + van;

        return (
          <div className="bg-white dark:bg-[#1f232d] p-3 rounded-lg shadow-xl border border-[#113366]">
            <p className="font-black text-[#113366] dark:text-[#EE4D2D] border-b border-slate-200 pb-2 mb-2">{label}</p>
            
            {selectedModal === 'ALL' ? (
              <>
                <p className="font-black text-[#113366] dark:text-white">Total Carregado: {total.toLocaleString('pt-BR')}</p>
                <div className="text-xs font-bold mt-2 space-y-1">
                  <p style={{ color: '#113366' }}>Utilitário: {util.toLocaleString('pt-BR')}</p>
                  <p style={{ color: '#EE4D2D' }}>Passeio: {pass.toLocaleString('pt-BR')}</p>
                  <p style={{ color: '#D0011B' }}>Moto: {moto.toLocaleString('pt-BR')}</p>
                  {van > 0 && <p style={{ color: '#113366' }}>Van: {van.toLocaleString('pt-BR')}</p>}
                </div>
              </>
            ) : (
              <div className="text-sm font-bold mt-2 space-y-1">
                {selectedModal === 'UTIL' && <p style={{ color: '#113366' }}>Utilitário: {util.toLocaleString('pt-BR')}</p>}
                {selectedModal === 'PASS' && <p style={{ color: '#EE4D2D' }}>Passeio: {pass.toLocaleString('pt-BR')}</p>}
                {selectedModal === 'MOTO' && <p style={{ color: '#D0011B' }}>Moto: {moto.toLocaleString('pt-BR')}</p>}
                {selectedModal === 'VAN' && <p style={{ color: '#113366' }}>Van: {van.toLocaleString('pt-BR')}</p>}
              </div>
            )}

            {varData && (
              <p className="font-black mt-3 text-[#D0011B]">
                Variação: {varData.value > 0 ? '+' : ''}{varData.value}% vs Anterior
              </p>
            )}
          </div>
        );
      }

      const valData = payload.find(p => p.dataKey !== lineKey);
      const varData = payload.find(p => p.dataKey === lineKey);

      return (
        <div className="bg-white dark:bg-[#1f232d] p-3 rounded-lg shadow-xl border border-[#113366]">
          <p className="font-black text-[#113366] dark:text-[#EE4D2D] border-b border-slate-200 pb-2 mb-2">{label}</p>
          {valData && (
            <p className="font-black text-[#113366] dark:text-white">
              {valueName}: <span className="text-lg">{valData.value.toLocaleString('pt-BR')}</span> {suffix}
            </p>
          )}
          {varData && (
            <p className="font-black mt-2 text-[#D0011B]">
              Variação: <span className="text-lg">{varData.value > 0 ? '+' : ''}{varData.value}%</span> vs Anterior
            </p>
          )}
        </div>
      );
    }
    return null;
  };

  const BarLineVariationChart = ({ data, barKey, lineKey, valueName, barColor, suffix = '', isAverage = false }) => (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={data} margin={{ top: 30, right: 20, left: -10, bottom: 20 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 'bold', fill: '#113366' }} angle={-45} textAnchor="end" interval={0} />
        <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#113366' }} tickFormatter={isAverage ? undefined : formatYAxis} />
        <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#D0011B' }} tickFormatter={(val) => `${val}%`} domain={['auto', 'auto']} />
        
        <Tooltip content={<CustomTooltip suffix={suffix} valueName={valueName} lineKey={lineKey} />} cursor={{ fill: 'rgba(0,0,0,0.05)' }} />
        <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: '11px', fontWeight: 'bold', color: '#113366' }} />
        <ReferenceLine yAxisId="right" y={0} stroke="#D0011B" strokeDasharray="3 3" />

        <Bar yAxisId="left" dataKey={barKey} name={valueName} fill={barColor} radius={[4, 4, 0, 0]} maxBarSize={50}>
          <LabelList dataKey={barKey} position="top" formatter={isAverage ? undefined : formatYAxis} style={{ fill: barColor, fontSize: 10, fontWeight: '900' }} />
        </Bar>

        <Line yAxisId="right" type="monotone" dataKey={lineKey} name="Variação %" stroke="#D0011B" strokeWidth={3} dot={{ r: 5, strokeWidth: 2, fill: 'white', stroke: '#D0011B' }} activeDot={{ r: 6 }} >
          <LabelList dataKey={lineKey} position="top" formatter={(val) => `${val > 0 ? '+' : ''}${val}%`} style={{ fill: '#D0011B', fontSize: 10, fontWeight: '900', textShadow: '1px 1px 2px rgba(255,255,255,0.8)' }} />
        </Line>
      </ComposedChart>
    </ResponsiveContainer>
  );

  const SprCompareChart = ({ data }) => (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={data} margin={{ top: 30, right: 20, left: -10, bottom: 20 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 'bold', fill: '#113366' }} angle={-45} textAnchor="end" interval={0} />
        <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#113366' }} domain={[0, 'auto']} />
        <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#D0011B' }} domain={['auto', 'auto']} />
        
        <Tooltip content={<CustomTooltip isSprCompare={true} />} cursor={{ fill: 'rgba(0,0,0,0.05)' }} />
        <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: '11px', fontWeight: 'bold', color: '#113366' }} />
        <ReferenceLine yAxisId="right" y={0} stroke="#D0011B" strokeDasharray="3 3" />

        <Bar yAxisId="left" dataKey="sprPlannedAvg" name="SPR Roteirizado" fill="#EE4D2D" radius={[4, 4, 0, 0]} maxBarSize={45}>
          <LabelList dataKey="sprPlannedAvg" position="top" style={{ fill: '#EE4D2D', fontSize: 10, fontWeight: '900' }} />
        </Bar>
        
        <Bar yAxisId="left" dataKey="sprDeliveringAvg" name="SPR Expedido" fill="#113366" radius={[4, 4, 0, 0]} maxBarSize={45}>
          <LabelList dataKey="sprDeliveringAvg" position="top" style={{ fill: '#113366', fontSize: 10, fontWeight: '900' }} />
        </Bar>

        <Line yAxisId="right" type="monotone" dataKey="gapSpr" name="Diferença (Gap)" stroke="#D0011B" strokeWidth={3} dot={{ r: 5, strokeWidth: 2, fill: 'white', stroke: '#D0011B' }} activeDot={{ r: 6 }} >
          <LabelList dataKey="gapSpr" position="bottom" formatter={(val) => `${val > 0 ? '+' : ''}${val}`} style={{ fill: '#D0011B', fontSize: 10, fontWeight: '900', textShadow: '1px 1px 2px rgba(255,255,255,0.8)' }} />
        </Line>
      </ComposedChart>
    </ResponsiveContainer>
  );

  const ModalBarLineVariationChart = ({ data, selectedModal }) => {
    let lineKey = 'varCargTotalPct';
    let lineName = 'Variação % Total';
    if (selectedModal === 'UTIL') { lineKey = 'varCargUtilPct'; lineName = 'Var % Utilitário'; }
    if (selectedModal === 'PASS') { lineKey = 'varCargPassPct'; lineName = 'Var % Passeio'; }
    if (selectedModal === 'MOTO') { lineKey = 'varCargMotoPct'; lineName = 'Var % Moto'; }
    if (selectedModal === 'VAN') { lineKey = 'varCargVanPct'; lineName = 'Var % Van'; }

    return (
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 30, right: 20, left: -10, bottom: 20 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
          <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 'bold', fill: '#113366' }} angle={-45} textAnchor="end" interval={0} />
          <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#113366' }} tickFormatter={formatYAxis} />
          <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#D0011B' }} tickFormatter={(val) => `${val}%`} domain={['auto', 'auto']} />
          
          <Tooltip content={<CustomTooltip lineKey={lineKey} isModal={true} selectedModal={selectedModal} />} cursor={{ fill: 'rgba(0,0,0,0.05)' }} />
          <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: '11px', fontWeight: 'bold', color: '#113366' }} />
          <ReferenceLine yAxisId="right" y={0} stroke="#D0011B" strokeDasharray="3 3" />

          {(selectedModal === 'ALL' || selectedModal === 'UTIL') && <Bar yAxisId="left" dataKey="cargUtil" name="Utilitário" fill="#113366" radius={[4, 4, 0, 0]} maxBarSize={40} />}
          {(selectedModal === 'ALL' || selectedModal === 'PASS') && <Bar yAxisId="left" dataKey="cargPass" name="Passeio" fill="#EE4D2D" radius={[4, 4, 0, 0]} maxBarSize={40} />}
          {(selectedModal === 'ALL' || selectedModal === 'MOTO') && <Bar yAxisId="left" dataKey="cargMoto" name="Moto" fill="#D0011B" radius={[4, 4, 0, 0]} maxBarSize={40} />}
          {(selectedModal === 'ALL' || selectedModal === 'VAN') && <Bar yAxisId="left" dataKey="cargVan" name="Van" fill="#F59E0B" fillOpacity={0.8} radius={[4, 4, 0, 0]} maxBarSize={40} />}

          <Line yAxisId="right" type="monotone" dataKey={lineKey} name={lineName} stroke="#D0011B" strokeWidth={3} dot={{ r: 5, strokeWidth: 2, fill: 'white', stroke: '#D0011B' }} activeDot={{ r: 6 }} >
            <LabelList dataKey={lineKey} position="top" formatter={(val) => `${val > 0 ? '+' : ''}${val}%`} style={{ fill: '#D0011B', fontSize: 10, fontWeight: '900', textShadow: '1px 1px 2px rgba(255,255,255,0.8)' }} />
          </Line>
        </ComposedChart>
      </ResponsiveContainer>
    );
  };

  // 🔥 NOVO GRÁFICO: PROPORÇÃO DE MODAIS (100% STACKED BAR)
  const ProportionModalChart = ({ data }) => (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 30, right: 20, left: -10, bottom: 20 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 'bold', fill: '#113366' }} angle={-45} textAnchor="end" interval={0} />
        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#113366' }} tickFormatter={(val) => `${val}%`} domain={[0, 100]} />
        
        <Tooltip content={<CustomTooltip isProportion={true} />} cursor={{ fill: 'rgba(0,0,0,0.05)' }} />
        <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: '11px', fontWeight: 'bold', color: '#113366' }} />

        {/* StackId "a" empilha as barras. Usamos as variáveis pct já calculadas */}
        <Bar dataKey="pctUtil" name="Utilitário" stackId="a" fill="#113366" maxBarSize={60}>
          <LabelList dataKey="pctUtil" position="center" formatter={(val) => val > 5 ? `${val}%` : ''} style={{ fill: 'white', fontSize: 11, fontWeight: '900' }} />
        </Bar>
        <Bar dataKey="pctPass" name="Passeio" stackId="a" fill="#EE4D2D" maxBarSize={60}>
          <LabelList dataKey="pctPass" position="center" formatter={(val) => val > 5 ? `${val}%` : ''} style={{ fill: 'white', fontSize: 11, fontWeight: '900' }} />
        </Bar>
        <Bar dataKey="pctMoto" name="Moto" stackId="a" fill="#D0011B" maxBarSize={60}>
          <LabelList dataKey="pctMoto" position="center" formatter={(val) => val > 5 ? `${val}%` : ''} style={{ fill: 'white', fontSize: 11, fontWeight: '900' }} />
        </Bar>
        <Bar dataKey="pctVan" name="Van" stackId="a" fill="#F59E0B" maxBarSize={60}>
          <LabelList dataKey="pctVan" position="center" formatter={(val) => val > 5 ? `${val}%` : ''} style={{ fill: 'white', fontSize: 11, fontWeight: '900' }} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );

  // ========================================================
  // CARD INTELIGENTE (COM TOGGLE DIA/SEMANA/MÊS E MODAL)
  // ========================================================
  const ToggleableChartCard = ({ id, titleBase, valueName, barKeyBase, varKeyBase, barColor, isAverage = false, isModal = false, isSprCompare = false, isProportion = false, colSpan = "col-span-1" }) => {
    const [timeframe, setTimeframe] = useState('week'); 
    const [selectedModal, setSelectedModal] = useState('ALL'); 
    
    const isFullscreen = fullscreenChart === id;
    
    // Puxa do State Dinamicamente
    const chartData = timeframe === 'day' ? processedData.dailyAggregated 
                    : timeframe === 'week' ? processedData.weeklyAggregated 
                    : processedData.monthlyAggregated;
    
    // Altera o título para refletir a escolha (DIA, SEMANA ou MÊS)
    const periodLabel = timeframe === 'day' ? 'DAY' : timeframe === 'week' ? 'WEEK' : 'MONTH';
    const title = `${titleBase} [PER ${periodLabel}]`;

    const cardContent = (
      <div className={`bg-white dark:bg-[#1f232d] rounded-2xl shadow-sm border border-slate-200 dark:border-gray-800 flex flex-col relative transition-all ${isFullscreen ? 'w-full h-full p-8' : `h-[450px] p-6 ${colSpan}`} print:break-inside-avoid print:h-[450px]`}>
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 border-b border-slate-100 dark:border-gray-800 pb-4 shrink-0 gap-3">
          <h3 className={`font-black text-[#113366] uppercase ${isFullscreen ? 'text-2xl' : 'text-sm xl:text-base'}`}>
            {title}
          </h3>
          
          <div className="flex items-center gap-3">
            {isModal && !isProportion && (
              <select 
                value={selectedModal} 
                onChange={(e) => setSelectedModal(e.target.value)}
                className="bg-slate-50 dark:bg-gray-800 text-[#113366] dark:text-white text-xs font-bold p-2 rounded-lg border border-slate-200 dark:border-gray-700 outline-none cursor-pointer"
              >
                <option value="ALL">Todos os Modais</option>
                <option value="UTIL">Utilitários</option>
                <option value="PASS">Passeio</option>
                <option value="MOTO">Motos</option>
                <option value="VAN">Vans</option>
              </select>
            )}

            <div className="flex items-center bg-slate-100 dark:bg-gray-800 p-1 rounded-lg">
              <button onClick={() => setTimeframe('day')} className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all flex items-center gap-1 ${timeframe === 'day' ? 'bg-[#113366] shadow text-white' : 'text-[#113366] opacity-50 hover:opacity-100'}`}><CalendarDays size={14}/> Dia</button>
              <button onClick={() => setTimeframe('week')} className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all flex items-center gap-1 ${timeframe === 'week' ? 'bg-[#113366] shadow text-white' : 'text-[#113366] opacity-50 hover:opacity-100'}`}><CalendarDays size={14}/> Sem</button>
              <button onClick={() => setTimeframe('month')} className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all flex items-center gap-1 ${timeframe === 'month' ? 'bg-[#113366] shadow text-white' : 'text-[#113366] opacity-50 hover:opacity-100'}`}><Calendar size={14}/> Mês</button>
            </div>
            
            <button onClick={() => setFullscreenChart(isFullscreen ? null : id)} className="text-[#113366] hover:text-[#EE4D2D] bg-slate-50 hover:bg-orange-50 dark:bg-gray-800 p-2 rounded-lg transition-colors print:hidden">
              {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar print:overflow-hidden">
          <div className="w-full h-full min-h-[350px]">
            {isProportion ? (
              <ProportionModalChart data={chartData} />
            ) : isSprCompare ? (
              <SprCompareChart data={chartData} />
            ) : isModal ? (
              <ModalBarLineVariationChart 
                data={chartData} 
                selectedModal={selectedModal}
              />
            ) : (
              <BarLineVariationChart 
                data={chartData}
                barKey={barKeyBase}
                lineKey={varKeyBase}
                valueName={valueName}
                barColor={barColor}
                isAverage={isAverage}
              />
            )}
          </div>
        </div>
      </div>
    );

    if (isFullscreen) {
      return (
        <div className="fixed inset-4 z-[99999] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-6 print:hidden">
          <div className="w-full h-full relative">
             {cardContent}
             <button onClick={() => setFullscreenChart(null)} className="absolute top-4 right-4 bg-[#113366] text-white p-2 rounded-full hover:bg-[#EE4D2D] shadow-lg"><X size={24}/></button>
          </div>
        </div>
      );
    }
    return cardContent;
  };

  if (!data || data.length === 0) return null;

  return (
    <div className="space-y-6 pt-6 print:pt-0">
      
      <div className="bg-[#113366] rounded-2xl shadow-sm overflow-hidden border border-[#113366] print:break-inside-avoid">
        <div className="text-white text-center py-5 px-6 flex flex-col items-center justify-center gap-1">
          <h2 className="text-xl md:text-3xl font-black uppercase tracking-widest flex items-center gap-3">
            <Truck size={28} className="text-[#EE4D2D]"/> Volume Roteirizado x Expedido
          </h2>
          <p className="text-xs md:text-sm font-bold text-white/80 uppercase tracking-wider">
            Aderência do Plano vs Execução • Evolução de Volume e Produtividade (SPR)
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 print:block print:space-y-6">
        <ToggleableChartCard id="planned" titleBase="VOL ROTEIRIZADO" valueName="Total Vol Planned" barKeyBase="volPlanned" varKeyBase="varPlannedPct" barColor="#113366" />
        <ToggleableChartCard id="processed" titleBase="VOL PROCESSADO" valueName="Total Vol Processado" barKeyBase="volProcessed" varKeyBase="varProcessedPct" barColor="#EE4D2D" />
        <ToggleableChartCard id="expedited" titleBase="VOL EXPEDIDO" valueName="Total Vol Expedido" barKeyBase="volExpedited" varKeyBase="varExpeditedPct" barColor="#D0011B" />
        <ToggleableChartCard id="rotas" titleBase="ROTAS ROTEIRIZADAS" valueName="Rotas Roteirizadas" barKeyBase="rotasRoteirizadas" varKeyBase="varRotasPct" barColor="#EE4D2D" />
        
        <ToggleableChartCard id="sprCompare" titleBase="COMPARAÇÃO DE SPR (ROTEIRIZADO VS EXPEDIDO)" isSprCompare={true} colSpan="xl:col-span-2" />
        
        {/* GRÁFICO ABSOLUTO DE MODAIS */}
        <ToggleableChartCard id="modais" titleBase="ROTAS CARREGADAS [POR MODAL]" isModal={true} colSpan="xl:col-span-2" />
        
        {/* 🔥 NOVO GRÁFICO DE PROPORÇÃO DE MODAIS */}
        <ToggleableChartCard id="modaisProportion" titleBase="PROPORÇÃO DE MODAIS EXPEDIDOS (%)" isProportion={true} colSpan="xl:col-span-2" />
      </div>
    </div>
  );
}