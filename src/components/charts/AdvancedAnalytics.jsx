import React, { useState, useMemo, useEffect } from 'react';
import { Calculator, Zap, AlertTriangle, CheckCircle2, TrendingUp, TrendingDown, Target, Sliders, Info, CalendarDays, Server, Users, PackageCheck, Clock, MapPin, Copy, Check, MessageSquare } from 'lucide-react';
import { MAPA_REGIONAL_COMPLETO } from '../../constants/regionais';

export default function AdvancedAnalytics({ rawData, baseData, filtrosGlobais = {}, hubsDisponiveis, station, setStation }) {
  
  const parseNum = (val) => {
    if (val === undefined || val === null || val === '') return 0;
    let s = String(val).trim().replace(/%/g, ''); 
    if (s.includes(',')) return Number(s.replace(/\./g, '').replace(',', '.'));
    return Number(s) || 0;
  };

  const parseUniversalDate = (val) => {
    if (val === null || val === undefined || val === '') return null;
    let s = String(val).trim().split('T')[0].split(' ')[0];
    if (s.includes('/')) {
      const parts = s.split('/');
      if (parts.length === 3) {
        const [dia, m, a] = parts;
        return `${a.length === 2 ? '20'+a : a}-${m.padStart(2, '0')}-${dia.padStart(2, '0')}`;
      }
      return null; 
    }
    return s;
  };

  const [localTurno, setLocalTurno] = useState('ALL');
  const [copied, setCopied] = useState(false);

  // ============================================================================
  // 1. ENGINE HISTÓRICA (MÉDIAS E PREMISSAS DA ABA BASE)
  // ============================================================================
  
  const turnosDisponiveis = useMemo(() => {
    const turnos = new Set();
    const targetStation = station || (filtrosGlobais.station && filtrosGlobais.station[0]);
    
    if (!targetStation) return [];

    (baseData || []).slice(1).forEach(row => {
      if (String(row[0]).trim() === targetStation) {
        const t = String(row[1]).trim().toUpperCase();
        if (t) turnos.add(t);
      }
    });
    return Array.from(turnos).sort();
  }, [baseData, station, filtrosGlobais]);

  useEffect(() => {
    if (localTurno !== 'ALL' && !turnosDisponiveis.includes(localTurno)) {
      setLocalTurno('ALL');
    }
  }, [turnosDisponiveis, station]);

  const hubBaseStats = useMemo(() => {
    let sumVol = 0, sumM = 0, sumP = 0, sumU = 0, sumV = 0;
    const diasUnicos = new Set();
    let nomeHub = "Malha Consolidada";

    if (filtrosGlobais.station && filtrosGlobais.station.length === 1) {
      nomeHub = filtrosGlobais.station[0];
    } else if (station) {
      nomeHub = station;
    }

    let maxDateMs = 0;
    (rawData || []).slice(1).forEach(row => {
      const iso = parseUniversalDate(row[3]);
      if (iso) {
        const ms = new Date(iso + 'T12:00:00').getTime();
        if (ms > maxDateMs) maxDateMs = ms;
      }
    });
    const limiteQuatroSemanas = maxDateMs - (28 * 24 * 60 * 60 * 1000);

    const diasSemanaVols = { 0:{}, 1:{}, 2:{}, 3:{}, 4:{}, 5:{}, 6:{} };

    (rawData || []).slice(1).forEach(row => {
      const st = String(row[4] || "").trim();
      const reg = MAPA_REGIONAL_COMPLETO[st] || String(row[1]).trim();
      const turnoLinha = String(row[5] || "").trim().toUpperCase();
      const isoDate = parseUniversalDate(row[3]);

      if (!st || !isoDate) return;
      if (filtrosGlobais.regional?.length > 0 && !filtrosGlobais.regional.includes(reg)) return;
      
      const targetStation = station || (filtrosGlobais.station && filtrosGlobais.station[0]);
      if (targetStation && st !== targetStation) return;
      
      if (localTurno !== 'ALL' && turnoLinha !== localTurno) return;

      const vol = parseNum(row[12]);
      diasUnicos.add(isoDate);
      sumVol += vol; 
      sumU += parseNum(row[25]); 
      sumP += parseNum(row[26]); 
      sumM += parseNum(row[27]); 
      sumV += parseNum(row[28]); 

      const dObj = new Date(isoDate + 'T12:00:00');
      if (!isNaN(dObj) && dObj.getTime() >= limiteQuatroSemanas) {
        const dow = dObj.getDay();
        if (!diasSemanaVols[dow][isoDate]) diasSemanaVols[dow][isoDate] = 0;
        diasSemanaVols[dow][isoDate] += vol; 
      }
    });

    const dias = diasUnicos.size || 1;
    
    const avgDow = {};
    Object.keys(diasSemanaVols).forEach(dow => {
      const arrayVolsDia = Object.values(diasSemanaVols[dow]);
      if (arrayVolsDia.length > 0) {
        avgDow[dow] = Math.round(arrayVolsDia.reduce((a,b)=>a+b,0) / arrayVolsDia.length);
      } else {
        avgDow[dow] = 0;
      }
    });

    let baseCapHub = 0, baseCapFleet = 0, baseSprRef = 0, baseCount = 0;
    
    (baseData || []).slice(1).forEach(row => {
      const st = String(row[0] || "").trim();
      const turnoLinha = String(row[1] || "").trim().toUpperCase();
      
      if (!st) return;
      
      const targetStation = station || (filtrosGlobais.station && filtrosGlobais.station[0]);
      if (targetStation && st !== targetStation) return;
      
      if (localTurno !== 'ALL' && turnoLinha !== localTurno) return;

      baseCapHub += parseNum(row[2]); 
      baseCapFleet += parseNum(row[3]); 
      baseSprRef += parseNum(row[6]); 
      baseCount++;
    });

    const mediaSprReferencial = baseCount > 0 && baseSprRef > 0 ? Math.round(baseSprRef / baseCount) : 90;

    return {
      nomeHub,
      avgVol: Math.round(sumVol / dias),
      avgM: Math.round(sumM / dias),
      avgP: Math.round(sumP / dias),
      avgU: Math.round(sumU / dias),
      avgV: Math.round(sumV / dias),
      avgDow, 
      baseCapHub,
      baseCapFleet,
      mediaSprReferencial
    };
  }, [rawData, baseData, filtrosGlobais, localTurno, station]);

  // ============================================================================
  // 2. ESTADOS DO SIMULADOR
  // ============================================================================
  const [simVol, setSimVol] = useState(0);
  const [simM, setSimM] = useState(0);
  const [simP, setSimP] = useState(0);
  const [simU, setSimU] = useState(0);
  const [simV, setSimV] = useState(0);

  const [sprM, setSprM] = useState(0);
  const [sprP, setSprP] = useState(0);
  const [sprU, setSprU] = useState(0);
  const [sprV, setSprV] = useState(0);

  useEffect(() => {
    setSimVol(hubBaseStats.avgVol);
    setSimM(hubBaseStats.avgM);
    setSimP(hubBaseStats.avgP);
    setSimU(hubBaseStats.avgU);
    setSimV(hubBaseStats.avgV);

    const ref = hubBaseStats.mediaSprReferencial > 0 ? hubBaseStats.mediaSprReferencial : 90;
    
    setSprM(ref); 
    setSprP(ref); 
    setSprU(ref); 
    setSprV(ref); 
  }, [hubBaseStats]);

  const formataInt = (val) => new Intl.NumberFormat('pt-BR').format(Math.round(val || 0));

  const handleInput = (setter) => (e) => {
    setter(e.target.value === '' ? '' : Number(e.target.value));
  };

  // ============================================================================
  // 3. MATEMÁTICA DO LAUDO E GERAÇÃO DE TEXTO PARA O SEATALK
  // ============================================================================
  const diagnostico = useMemo(() => {
    const sVol = Number(simVol) || 0;
    const mM = Number(simM) || 0;
    const mP = Number(simP) || 0;
    const mU = Number(simU) || 0;
    const mV = Number(simV) || 0;
    const sM = Number(sprM) || 0;
    const sP = Number(sprP) || 0;
    const sU = Number(sprU) || 0;
    const sV = Number(sprV) || 0;

    const mUtil = Math.round(mM * 0.8);
    const pUtil = Math.round(mP * 0.8);
    const uUtil = Math.round(mU * 0.8);
    const vUtil = Math.round(mV * 0.8);

    const frotaInserida = mM + mP + mU + mV;
    const frotaUtil = mUtil + pUtil + uUtil + vUtil;
    
    const capUtil = (mUtil * sM) + (pUtil * sP) + (uUtil * sU) + (vUtil * sV);
    
    const sprMedioSimulado = frotaUtil > 0 ? Math.round(capUtil / frotaUtil) : 0;
    const gapPacotes = capUtil - sVol;

    const satHub = hubBaseStats.baseCapHub > 0 ? (sVol / hubBaseStats.baseCapHub) * 100 : 0;
    const satFleet = hubBaseStats.baseCapFleet > 0 ? (sVol / hubBaseStats.baseCapFleet) * 100 : 0;
    const estouroCapacidade = satHub > 100 || satFleet > 100;

    let status = 'OPERAÇÃO EQUILIBRADA';
    let cor = 'text-emerald-500';
    let bg = 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800';
    let icone = <CheckCircle2 size={32} className="text-emerald-500" />;
    
    if (gapPacotes < 0) {
      status = 'DÉFICIT DE FROTA (RUPTURA)';
      cor = 'text-[#D0011B]';
      bg = 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800';
      icone = <AlertTriangle size={32} className="text-[#D0011B]" />;
    } else if (gapPacotes > (capUtil * 0.15)) {
      status = 'ALTA OCIOSIDADE (SOBRA DE CARROS)';
      cor = 'text-orange-500';
      bg = 'bg-orange-50 dark:bg-orange-900/10 border-orange-200 dark:border-orange-800';
      icone = <Zap size={32} className="text-orange-500" />;
    }

    let texto = `Para processar o volume projetado de ${formataInt(sVol)} pacotes no turno, você inseriu uma frota bruta de ${formataInt(frotaInserida)} veículos na pré-escala. `;
    texto += `Após a aplicação da trava de segurança (desconto automático de 20% para cobrir o no-show histórico), sua Frota Útil é de ${formataInt(frotaUtil)} motoristas. `;
    
    if (gapPacotes < 0) {
      texto += `Isso gera um DÉFICIT CRÍTICO e um acúmulo previsível de ${formataInt(Math.abs(gapPacotes))} pacotes no piso.`;
    } else if (gapPacotes >= 0 && gapPacotes <= (capUtil * 0.15)) {
      texto += `Essa configuração gera uma capacidade segura de ${formataInt(capUtil)} pacotes, suportando o volume projetado com uma sobra tática (backup) de ${formataInt(gapPacotes)} pacotes.`;
    } else {
      texto += `Sobrarão cerca de ${formataInt(gapPacotes)} pacotes em capacidade ociosa, o que resultará em motoristas dispensados sem carga e possível Churn.`;
    }

    if (estouroCapacidade) {
      texto += ` ATENÇÃO: O volume inserido excede os limites físicos de CAP parametrizados na aba BASE para este turno.`;
    }

    // ==========================================
    // 🔥 GERADOR HTML BLINDADO (SEATALK FRIENDLY)
    // ==========================================
    // SeaTalk ignora <br> e \n soltos. A única forma de forçar a quebra é usando blocos <div> e &nbsp;
    const getRowHtml = (emoji, nome, util, spr) => {
      if (util > 0) {
        return `<div style="margin:0; padding:0;">${emoji} <b>${nome}:</b> ${util} x SPR ${spr} = ${formataInt(util * spr)} pcts</div>`;
      }
      return '';
    };

    const solicitacaoHTML = `
      <div style="font-family: Arial, sans-serif; font-size: 14px; color: #333;">
        <div style="margin:0; padding:0;"><b>Solicitação de Roteirização - ${hubBaseStats.nomeHub} (${localTurno === 'ALL' ? 'Todos os Turnos' : localTurno})</b></div>
        <div style="margin:0; padding:0;">&nbsp;</div>
        <div style="margin:0; padding:0;">📦 <b>Volume Projetado:</b> ${formataInt(sVol)} pacotes</div>
        <div style="margin:0; padding:0;">&nbsp;</div>
        <div style="margin:0; padding:0;"><b>🎯 PARÂMETROS DE ROTEIRIZAÇÃO (FROTA ÚTIL)</b></div>
        ${getRowHtml('🏍️', 'Motos', mUtil, sM)}
        ${getRowHtml('🚗', 'Passeios', pUtil, sP)}
        ${getRowHtml('🚙', 'Utilitários', uUtil, sU)}
        ${getRowHtml('🚐', 'Vans', vUtil, sV)}
        <div style="margin:0; padding:0;">&nbsp;</div>
        <div style="margin:0; padding:0;">✅ <b>Capacidade Total Liberada:</b> ${formataInt(capUtil)} pacotes</div>
        <div style="margin:0; padding:0;">&nbsp;</div>
        <div style="margin:0; padding:0;">${gapPacotes < 0 
          ? `⚠️ <b style="color: #D0011B;">Atenção:</b> Risco de acúmulo de ${formataInt(Math.abs(gapPacotes))} pacotes (Déficit de Frota).` 
          : `✅ <b>Status:</b> Operação coberta com sobra de ${formataInt(gapPacotes)} pacotes na capacidade.`}</div>
      </div>
    `;

    return { 
      sVol, frotaInserida, frotaUtil, capUtil, gapPacotes, sprMedioSimulado,
      status, cor, bg, icone, texto, satHub, satFleet,
      mUtil, pUtil, uUtil, vUtil, solicitacaoHTML
    };
  }, [simVol, simM, simP, simU, simV, sprM, sprP, sprU, sprV, hubBaseStats, localTurno]);

  const DOW_NAMES = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  // 🔥 TRAVA DE BLOQUEIO SE NÃO SELECIONAR TURNO/HUB
  const targetStation = station || (filtrosGlobais.station && filtrosGlobais.station[0]);
  const isCalculadoraBloqueada = !targetStation || localTurno === 'ALL';

  // 🔥 CÓPIA DE RICH TEXT (Forçando preserveção de quebras)
  const handleCopy = async () => {
    try {
      const el = document.createElement('div');
      el.innerHTML = diagnostico.solicitacaoHTML;
      el.style.position = 'fixed';
      el.style.left = '-9999px';
      // Este estilo obriga a área de transferência a respeitar os espaços e <br>
      el.style.whiteSpace = 'pre-wrap'; 
      document.body.appendChild(el);
      
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(el);
      selection.removeAllRanges();
      selection.addRange(range);
      
      document.execCommand('copy');
      
      selection.removeAllRanges();
      document.body.removeChild(el);
      
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Erro ao copiar formato HTML", err);
    }
  };

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-500 pb-12">
      
      {/* HEADER DA CALCULADORA COM SELETOR DE TURNO E HUB */}
      <div className="bg-[#113366] rounded-2xl p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-sm border border-[#113366]">
        <div className="flex items-center gap-4 text-white">
          <div className="p-3 bg-white/10 rounded-xl">
            <Calculator size={28} className="text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-black uppercase tracking-tight">Calculadora de Rotas</h2>
            <p className="text-xs font-bold text-blue-200 uppercase tracking-widest mt-1">Simule o cenário e previna gargalos de frota</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-2 bg-white/10 px-3 py-2 rounded-lg text-white shrink-0 border border-white/20">
            <Clock size={16} className="text-[#EE4D2D]" />
            <select 
              value={localTurno} 
              onChange={(e) => setLocalTurno(e.target.value)}
              className="bg-transparent text-sm font-bold uppercase tracking-wider outline-none cursor-pointer text-white"
            >
              <option value="ALL" className="text-slate-800">Todos os Turnos</option>
              {turnosDisponiveis.map(t => (
                <option key={t} value={t} className="text-slate-800">{t}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 bg-white/10 px-4 py-2 rounded-lg text-white shrink-0 border border-white/20">
             <MapPin size={16} className="text-[#EE4D2D]" />
             {hubsDisponiveis && hubsDisponiveis.length > 0 ? (
               <select
                 value={station || ''}
                 onChange={(e) => setStation && setStation(e.target.value)}
                 className="bg-transparent text-sm font-bold uppercase tracking-wider outline-none cursor-pointer text-white max-w-[200px]"
               >
                 {hubsDisponiveis.map(h => <option key={h} value={h} className="text-slate-800">{h}</option>)}
               </select>
             ) : (
               <span className="text-sm font-bold uppercase tracking-wider truncate max-w-[200px]">{hubBaseStats.nomeHub}</span>
             )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        
        {/* LADO ESQUERDO: CONTROLES DO PCP */}
        <div className="xl:col-span-5 flex flex-col gap-6">
          
          {/* BANNER DE INSTRUÇÕES OTIMIZADO */}
          <div className="bg-blue-50 dark:bg-blue-950/30 border-l-4 border-blue-500 p-5 rounded-r-2xl shadow-sm">
            <h4 className="text-sm font-black text-blue-800 dark:text-blue-400 uppercase flex items-center gap-2 mb-3">
              <Info size={18}/> Como utilizar a Calculadora
            </h4>
            <div className="text-xs text-blue-800/80 dark:text-blue-300/80 leading-relaxed font-medium space-y-3">
              <p>
                <b>Passo 1:</b> Baixe a disponibilidade dos motoristas para o seu turno do dia seguinte (Menu lateral &gt; Gestão de Equipe &gt; Disponibilidade do motorista &gt; Selecione as datas &gt; no menu seletor "disponibilidade do motorista", clique na seta "&gt;" e selecione o SEU TURNO CORRESPONDENTE).
              </p>
              <p>
                <b>Passo 2:</b> Exporte o arquivo, importe em um sheets (selecionando a option "inserir novas páginas").
              </p>
              <p>
                <b>Passo 3:</b> Filtre seus motoristas disponíveis por modal e coloque o input nos campos abaixo. Se necessário, altere os campos de SPR (Eles iniciam com o Referencial da Aba Base).
              </p>
            </div>
          </div>

          <div className="bg-white dark:bg-[#1f232d] rounded-2xl shadow-sm border border-slate-200 dark:border-gray-800 p-6 flex flex-col gap-6 relative overflow-hidden">
            
            {/* 🔥 OVERLAY DE BLOQUEIO SE NÃO SELECIONAR TURNO */}
            {isCalculadoraBloqueada && (
              <div className="absolute inset-0 z-20 bg-white/80 dark:bg-[#1f232d]/90 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center">
                <div className="bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 p-4 rounded-full mb-4">
                  <Sliders size={32} />
                </div>
                <h3 className="text-lg font-black text-[#113366] dark:text-white uppercase mb-2">Painel Bloqueado</h3>
                <p className="text-sm font-medium text-slate-600 dark:text-slate-400 max-w-[280px]">
                  Para liberar a calculadora, selecione um <strong className="text-[#EE4D2D]">Turno Específico</strong> (AM, PM1, etc.) no topo da tela.
                </p>
              </div>
            )}

            <div className="flex flex-col gap-2 border-b border-slate-100 dark:border-gray-800 pb-4">
              <div className="flex items-center gap-2">
                <Sliders className="text-[#EE4D2D]" size={20} />
                <h3 className="font-black text-[#113366] dark:text-white uppercase text-base">Painel de Imputação </h3>
              </div>
            </div>

            <div className="space-y-6">
              
              {/* 1. VOLUME */}
              <div className="flex flex-col gap-3">
                <label className="text-xs font-black text-[#113366] dark:text-blue-400 uppercase tracking-wider">1. Volume Projetado</label>
                <input 
                  type="number" 
                  value={simVol} 
                  onChange={handleInput(setSimVol)}
                  className="w-full bg-slate-50 dark:bg-[#15171e] border border-slate-200 dark:border-gray-700 rounded-lg p-3 text-2xl font-black text-center text-[#113366] dark:text-white outline-none focus:border-[#EE4D2D] focus:ring-2 focus:ring-[#EE4D2D]/20 transition-all"
                />
                
                <div className="pt-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1 mb-2">
                    <CalendarDays size={12}/> Substituir por Média (Últimas 4 Semanas):
                  </label>
                  <div className="grid grid-cols-4 gap-1.5">
                    {[1, 2, 3, 4, 5, 6, 0].map(dow => {
                      const avg = hubBaseStats.avgDow[dow] || 0;
                      return (
                        <button 
                          key={dow}
                          onClick={() => setSimVol(avg)}
                          title={`Média histórica das ${DOW_NAMES[dow]}s`}
                          className="flex flex-col items-center justify-center p-1.5 bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-600 rounded hover:border-[#EE4D2D] hover:bg-orange-50 dark:hover:bg-gray-700 transition-colors group"
                        >
                          <span className="text-[9px] font-black uppercase text-slate-400 group-hover:text-[#EE4D2D]">{DOW_NAMES[dow]}</span>
                          <span className="text-[10px] font-bold text-slate-700 dark:text-gray-300">{avg > 0 ? formataInt(avg) : '-'}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>

              {/* 2. MATRIZ DE FROTA E SPR */}
              <div className="flex flex-col gap-3">
                <label className="text-xs font-black text-[#113366] dark:text-blue-400 uppercase tracking-wider flex items-center justify-between">
                  <span>2. Matriz de Frota & SPR</span>
                  <span className="text-[9px] font-bold bg-slate-100 text-slate-500 dark:bg-gray-800 px-2 py-0.5 rounded-full">-20% Trava No-Show</span>
                </label>

                <div className="overflow-hidden border border-slate-200 dark:border-gray-700 rounded-xl shadow-sm">
                  <table className="w-full text-left text-[11px]">
                    <thead className="bg-slate-50 dark:bg-[#15171e] text-slate-500 dark:text-gray-400 uppercase font-black tracking-wider">
                      <tr>
                        <th className="p-2.5">Modal</th>
                        <th className="p-2.5 text-center">Escala (Inserir)</th>
                        <th className="p-2.5 text-center" title="Reserva de 20% para No-Show">Útil (-20%)</th>
                        <th className="p-2.5 text-center">SPR</th>
                        <th className="p-2.5 text-right">Cap. (Pcts)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:border-gray-700 font-bold bg-white dark:bg-gray-800">
                      
                      <tr className="hover:bg-slate-50 dark:hover:bg-gray-700/50">
                        <td className="p-2.5 text-slate-600 dark:text-gray-300">Motos</td>
                        <td className="p-1.5"><input type="number" value={simM} onChange={handleInput(setSimM)} className="w-14 text-center bg-orange-50 dark:bg-gray-700 border border-[#EE4D2D] p-1.5 rounded outline-none focus:ring-1 focus:ring-[#EE4D2D] dark:text-white" /></td>
                        <td className="p-2.5 text-center text-orange-500">{diagnostico.mUtil}</td>
                        <td className="p-1.5"><input type="number" value={sprM} onChange={handleInput(setSprM)} className="w-14 text-center bg-blue-50 dark:bg-gray-700 border border-[#113366] dark:border-blue-500 p-1.5 rounded outline-none focus:ring-1 focus:ring-[#113366] dark:text-white" title="Padrão: SPR Referencial da Aba Base" /></td>
                        <td className="p-2.5 text-right text-[#113366] dark:text-blue-300">{formataInt(diagnostico.mUtil * (Number(sprM) || 0))}</td>
                      </tr>
                      
                      <tr className="hover:bg-slate-50 dark:hover:bg-gray-700/50">
                        <td className="p-2.5 text-slate-600 dark:text-gray-300">Passeios</td>
                        <td className="p-1.5"><input type="number" value={simP} onChange={handleInput(setSimP)} className="w-14 text-center bg-orange-50 dark:bg-gray-700 border border-[#EE4D2D] p-1.5 rounded outline-none focus:ring-1 focus:ring-[#EE4D2D] dark:text-white" /></td>
                        <td className="p-2.5 text-center text-orange-500">{diagnostico.pUtil}</td>
                        <td className="p-1.5"><input type="number" value={sprP} onChange={handleInput(setSprP)} className="w-14 text-center bg-blue-50 dark:bg-gray-700 border border-[#113366] dark:border-blue-500 p-1.5 rounded outline-none focus:ring-1 focus:ring-[#113366] dark:text-white" /></td>
                        <td className="p-2.5 text-right text-[#113366] dark:text-blue-300">{formataInt(diagnostico.pUtil * (Number(sprP) || 0))}</td>
                      </tr>

                      <tr className="hover:bg-slate-50 dark:hover:bg-gray-700/50">
                        <td className="p-2.5 text-slate-600 dark:text-gray-300">Utilitários</td>
                        <td className="p-1.5"><input type="number" value={simU} onChange={handleInput(setSimU)} className="w-14 text-center bg-orange-50 dark:bg-gray-700 border border-[#EE4D2D] p-1.5 rounded outline-none focus:ring-1 focus:ring-[#EE4D2D] dark:text-white" /></td>
                        <td className="p-2.5 text-center text-orange-500">{diagnostico.uUtil}</td>
                        <td className="p-1.5"><input type="number" value={sprU} onChange={handleInput(setSprU)} className="w-14 text-center bg-blue-50 dark:bg-gray-700 border border-[#113366] dark:border-blue-500 p-1.5 rounded outline-none focus:ring-1 focus:ring-[#113366] dark:text-white" /></td>
                        <td className="p-2.5 text-right text-[#113366] dark:text-blue-300">{formataInt(diagnostico.uUtil * (Number(sprU) || 0))}</td>
                      </tr>

                      <tr className="hover:bg-slate-50 dark:hover:bg-gray-700/50">
                        <td className="p-2.5 text-slate-600 dark:text-gray-300">Vans</td>
                        <td className="p-1.5"><input type="number" value={simV} onChange={handleInput(setSimV)} className="w-14 text-center bg-orange-50 dark:bg-gray-700 border border-[#EE4D2D] p-1.5 rounded outline-none focus:ring-1 focus:ring-[#EE4D2D] dark:text-white" /></td>
                        <td className="p-2.5 text-center text-orange-500">{diagnostico.vUtil}</td>
                        <td className="p-1.5"><input type="number" value={sprV} onChange={handleInput(setSprV)} className="w-14 text-center bg-blue-50 dark:bg-gray-700 border border-[#113366] dark:border-blue-500 p-1.5 rounded outline-none focus:ring-1 focus:ring-[#113366] dark:text-white" /></td>
                        <td className="p-2.5 text-right text-[#113366] dark:text-blue-300">{formataInt(diagnostico.vUtil * (Number(sprV) || 0))}</td>
                      </tr>
                    </tbody>
                    <tfoot className="bg-slate-100 dark:bg-gray-900 border-t border-slate-200 dark:border-gray-700 text-[#113366] dark:text-blue-400 font-black">
                      <tr>
                        <td className="p-2.5 uppercase text-[10px]">Total</td>
                        <td className="p-2.5 text-center">{formataInt(diagnostico.frotaInserida)}</td>
                        <td className="p-2.5 text-center text-[#EE4D2D]">{formataInt(diagnostico.frotaUtil)}</td>
                        <td className="p-2.5 text-center">-</td>
                        <td className="p-2.5 text-right">{formataInt(diagnostico.capUtil)} <span className="text-[9px] uppercase font-bold text-slate-400">pcts</span></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

            </div>
          </div>
        </div>

        {/* LADO DIREITO: LAUDO E TICKET DA SOLICITAÇÃO (col-span-7) */}
        <div className="xl:col-span-7 flex flex-col gap-6 relative">
          
          {/* 🔥 OVERLAY DE BLOQUEIO SE NÃO SELECIONAR TURNO */}
          {isCalculadoraBloqueada && (
            <div className="absolute inset-0 z-20 bg-white/80 dark:bg-[#1f232d]/90 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center rounded-2xl border border-blue-200">
              <div className="bg-blue-50 dark:bg-blue-900/30 text-blue-500 dark:text-blue-400 p-4 rounded-full mb-4 shadow-sm border border-blue-100">
                <Target size={32} />
              </div>
              <h3 className="text-lg font-black text-[#113366] dark:text-white uppercase mb-2">Aguardando Parâmetros</h3>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400 max-w-[320px]">
                O laudo prescritivo e o ticket de solicitação serão gerados automaticamente assim que você selecionar o Hub e Turno corretos.
              </p>
            </div>
          )}

          {/* BLOCO SUPERIOR: CARDS MATEMÁTICOS */}
          <div className="bg-white dark:bg-[#1f232d] rounded-2xl shadow-sm border border-slate-200 dark:border-gray-800 p-6">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-gray-800 pb-4 mb-6">
              <div className="flex items-center gap-2">
                <Target className="text-[#113366] dark:text-blue-400" size={20} />
                <h3 className="font-black text-[#113366] dark:text-white uppercase text-base">Projeção do Cenário</h3>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              
              <div className="bg-blue-50 dark:bg-blue-950/20 p-5 rounded-xl border border-blue-200 dark:border-blue-900/50 flex flex-col justify-center items-center text-center shadow-sm relative overflow-hidden group">
                <div className="absolute top-0 left-0 w-full h-1 bg-blue-500"></div>
                <span className="text-[10px] font-black uppercase text-blue-600 dark:text-blue-400 mb-1 flex items-center gap-1"><PackageCheck size={14}/> Capacidade Útil</span>
                <span className="text-4xl font-black text-blue-600 dark:text-blue-300">{formataInt(diagnostico.capUtil)}</span>
                
                {/* Comparação do SPR Médio vs Referencial */}
                <div className="mt-3 bg-white dark:bg-gray-800 px-3 py-1.5 rounded-lg border border-blue-100 dark:border-blue-800 flex items-center gap-2 w-full justify-between">
                   <div className="flex flex-col text-left">
                     <span className="text-[9px] font-bold text-slate-400 uppercase">SPR Simulado</span>
                     <span className={`text-sm font-black ${diagnostico.sprMedioSimulado > hubBaseStats.mediaSprReferencial ? 'text-[#EE4D2D]' : 'text-blue-600 dark:text-blue-300'}`}>{diagnostico.sprMedioSimulado}</span>
                   </div>
                   <div className="w-px h-6 bg-slate-200 dark:bg-gray-700"></div>
                   <div className="flex flex-col text-right">
                     <span className="text-[9px] font-bold text-slate-400 uppercase">Aba Base</span>
                     <span className="text-sm font-black text-slate-600 dark:text-gray-300">{hubBaseStats.mediaSprReferencial}</span>
                   </div>
                </div>
              </div>

              <div className={`p-5 rounded-xl border flex flex-col justify-center items-center text-center shadow-sm relative overflow-hidden ${diagnostico.gapPacotes < 0 ? 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800' : 'bg-emerald-50 border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-800'}`}>
                <div className={`absolute top-0 left-0 w-full h-1 ${diagnostico.gapPacotes < 0 ? 'bg-[#D0011B]' : 'bg-emerald-500'}`}></div>
                <span className={`text-[10px] font-black uppercase mb-1 ${diagnostico.gapPacotes < 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                  {diagnostico.gapPacotes < 0 ? 'Acúmulo Projetado (Piso)' : 'Sobra Tática'}
                </span>
                <div className="flex items-center gap-2">
                  {diagnostico.gapPacotes < 0 ? <TrendingDown size={24} className="text-[#D0011B]"/> : <TrendingUp size={24} className="text-emerald-500"/>}
                  <span className={`text-4xl font-black ${diagnostico.gapPacotes < 0 ? 'text-[#D0011B]' : 'text-emerald-600'}`}>
                    {formataInt(Math.abs(diagnostico.gapPacotes))}
                  </span>
                </div>
                <span className={`text-[10px] font-bold mt-2 ${diagnostico.gapPacotes < 0 ? 'text-red-400' : 'text-emerald-400'}`}>Capacidade - Volume</span>
              </div>

              <div className="bg-slate-50 dark:bg-[#15171e] p-5 rounded-xl border border-slate-200 dark:border-gray-700 flex flex-col justify-center items-center text-center shadow-sm relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-slate-400"></div>
                <span className="text-[10px] font-black uppercase text-slate-500 mb-2 flex items-center gap-1"><Server size={14}/> Limites Físicos (Turno)</span>
                <div className="flex flex-col gap-2 w-full mt-1">
                  <div className="flex justify-between items-center bg-white dark:bg-gray-800 px-3 py-1.5 rounded border border-slate-100 dark:border-gray-700">
                    <span className="text-[10px] font-bold text-slate-500">Cap. Hub</span>
                    <span className="text-xs font-black text-[#113366] dark:text-blue-300">{formataInt(hubBaseStats.baseCapHub)}</span>
                  </div>
                  <div className="flex justify-between items-center bg-white dark:bg-gray-800 px-3 py-1.5 rounded border border-slate-100 dark:border-gray-700">
                    <span className="text-[10px] font-bold text-slate-500">Cap. Fleet</span>
                    <span className="text-xs font-black text-[#113366] dark:text-blue-300">{formataInt(hubBaseStats.baseCapFleet)}</span>
                  </div>
                </div>
              </div>
              
            </div>
          </div>

          {/* BLOCO INFERIOR: TICKET PARA COPIAR */}
          <div className="bg-white dark:bg-[#1f232d] rounded-2xl shadow-sm border border-slate-200 dark:border-gray-800 p-6 flex-1 flex flex-col">
             
             <div className="flex items-center justify-between border-b border-slate-100 dark:border-gray-800 pb-4 mb-4">
                <div className="flex items-center gap-2">
                  <MessageSquare className="text-slate-400 dark:text-gray-400" size={20} />
                  <h3 className="font-black text-[#113366] dark:text-white uppercase text-base">Preview da Solicitação</h3>
                </div>
                <button
                  onClick={handleCopy}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-black uppercase transition-all shadow-sm ${copied ? 'bg-emerald-500 text-white border-emerald-600' : 'bg-[#EE4D2D] text-white hover:bg-[#D0011B] border border-transparent'}`}
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                  {copied ? 'Copiado para Área de Transferência!' : 'Copiar Solicitação'}
                </button>
             </div>

             <p className="text-[10px] text-slate-500 font-bold mb-3 uppercase">Este é o formato exato que será enviado ao SeaTalk (com quebra de linha real):</p>

             {/* BALÃO DE MENSAGEM DO SEATALK */}
             <div className="bg-[#f0f4f8] dark:bg-gray-800 rounded-xl p-5 border border-blue-100 dark:border-gray-700 relative mb-6">
                <div className="absolute top-4 -left-2 w-4 h-4 bg-[#f0f4f8] dark:bg-gray-800 border-l border-b border-blue-100 dark:border-gray-700 transform rotate-45 rounded-sm"></div>
                <div 
                  className="text-sm text-slate-800 dark:text-gray-200"
                  dangerouslySetInnerHTML={{ __html: diagnostico.solicitacaoHTML }} 
                />
             </div>

             {/* LAUDO RECOLHIDO (MENOR) */}
             <div className={`mt-auto border rounded-xl p-4 flex gap-4 items-center ${diagnostico.bg}`}>
                <div className="shrink-0">{diagnostico.icone}</div>
                <div>
                  <h4 className={`text-sm font-black uppercase tracking-tight mb-1 ${diagnostico.cor}`}>Diagnóstico Interno: {diagnostico.status}</h4>
                  <p className="text-xs text-slate-600 dark:text-slate-400 font-medium leading-relaxed">{diagnostico.texto}</p>
                </div>
             </div>

          </div>

        </div>
      </div>
    </div>
  );
}