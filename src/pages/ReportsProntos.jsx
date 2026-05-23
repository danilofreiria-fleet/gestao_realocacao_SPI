import React, { useState, useEffect, useMemo } from 'react';
import { getConsolidadoData, getBaseReferenceData } from '../api/googleSheets';
import { getHubsPermitidos } from '../constants/regionais';
import { Copy, Check, Layout, MessageSquare, ClipboardList, MapPin, CalendarDays, Clock, Maximize2, X, Printer, Package, AlertCircle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend, LabelList, LineChart, Line } from 'recharts';

export default function ReportsProntos() {
  const [loading, setLoading] = useState(true);
  const [rawData, setRawData] = useState([]);
  const [baseData, setBaseData] = useState([]); 
  
  // SELETORES
  const [selectedHub, setSelectedHub] = useState('');
  const [selectedData, setSelectedData] = useState('');
  const [selectedTurno, setSelectedTurno] = useState('');
  
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState('text'); 
  const [isFullscreen, setIsFullscreen] = useState(false);

  const currentRegional = localStorage.getItem("selectedRegional");

  useEffect(() => {
    const load = async () => {
      try {
        const [data, bData] = await Promise.all([
          getConsolidadoData(),
          getBaseReferenceData()
        ]);
        
        const hubsPermitidos = getHubsPermitidos(currentRegional);
        if (data && data.length > 1) {
          const filtrados = data.slice(1)
            .filter(r => hubsPermitidos.includes(String(r[4]).trim()))
            .reverse(); 
          setRawData(filtrados);
        }
        if (bData && bData.length > 1) {
          setBaseData(bData);
        }
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    };
    load();
  }, [currentRegional]);

  const availableHubs = useMemo(() => [...new Set(rawData.map(r => String(r[4]).trim()))].sort(), [rawData]);
  
  // 🔥 FILTRO DE DATA ORDENADO Z -> A (Mais recente primeiro)
  const availableDatas = useMemo(() => {
    if (!selectedHub) return [];
    const datas = rawData.filter(r => String(r[4]).trim() === selectedHub).map(r => r[3]);
    const uniqueDatas = [...new Set(datas)];
    
    return uniqueDatas.sort((a, b) => {
      const parseD = (str) => {
        if (!str) return 0;
        if (str.includes('/')) {
          const [d, m, y] = str.split('/');
          return new Date(y, m - 1, d).getTime();
        }
        if (str.includes('-')) {
          const [y, m, d] = str.split('T')[0].split('-');
          return new Date(y, m - 1, d).getTime();
        }
        return new Date(str).getTime();
      };
      return parseD(b) - parseD(a);
    });
  }, [rawData, selectedHub]);

  const availableTurnos = useMemo(() => {
    if (!selectedHub || !selectedData) return [];
    return [...new Set(rawData.filter(r => String(r[4]).trim() === selectedHub && r[3] === selectedData).map(r => r[5]))].sort();
  }, [rawData, selectedHub, selectedData]);

  useEffect(() => { setSelectedData(''); setSelectedTurno(''); }, [selectedHub]);
  useEffect(() => { setSelectedTurno(''); }, [selectedData]);

  const r = useMemo(() => {
    if (!selectedHub || !selectedData || !selectedTurno) return null;
    return rawData.find(row => String(row[4]).trim() === selectedHub && row[3] === selectedData && row[5] === selectedTurno);
  }, [rawData, selectedHub, selectedData, selectedTurno]);

  // =======================================================================
  // 1. REPORT TEXTUAL (WHATSAPP)
  // =======================================================================
  const reportText = useMemo(() => {
    if (!r) return "";
    
    const sprRefRow = baseData.find(b => String(b[0]).trim() === String(r[4]).trim() && String(b[1]).trim() === String(r[5]).trim());
    const sprReferencial = sprRefRow ? sprRefRow[6] : 'N/A'; // BASE: Coluna G

    const pacotesRoteirizados = Number(r[12]) || 0;    // CONSOL: Coluna M
    const pacotesExpedidos = Number(r[14]) || 0;       // CONSOL: Coluna O
    const totalRotasRoteirizadas = Number(r[11]) || 0; // CONSOL: Coluna L
    const totalRotasCarregadas = Number(r[29]) || 0;   // CONSOL: Coluna AD
    const volProc = Number(r[13]) || 0;                // CONSOL: Coluna N

    // Cálculo do desvio percentual e absoluto
    const desvioAbsoluto = pacotesExpedidos - pacotesRoteirizados;
    const desvioPctVal = pacotesRoteirizados > 0 ? (desvioAbsoluto / pacotesRoteirizados) * 100 : 0;
    const sinal = desvioPctVal > 0 ? '+' : '';
    const desvioPctStr = `${sinal}${desvioPctVal.toFixed(2).replace('.', ',')}%`;

    const sprRoteirizado = totalRotasRoteirizadas > 0 ? Math.round(pacotesRoteirizados / totalRotasRoteirizadas) : 0;
    const sprProcessado = totalRotasCarregadas > 0 ? Math.round(volProc / totalRotasCarregadas) : 0;
    const sprExpedido = totalRotasCarregadas > 0 ? Math.round(pacotesExpedidos / totalRotasCarregadas) : 0;

    return `📊 *Report SPR*
📍 *${r[4]}*
📅 *Data:* ${r[3]}
🌤 *Ciclo:* ${r[5]}
\u200B
\u200B
🔹 *SPR Referencial:* ${sprReferencial}
🔹 *SPR Roteirizado:* ${sprRoteirizado} | ${pacotesRoteirizados}
🔹 *SPR Processado:* ${sprProcessado} | ${volProc}
🔹 *SPR Expedido:* ${sprExpedido} | ${pacotesExpedidos}
🔹 *Desvio:* ${desvioPctStr} | ${Math.abs(desvioAbsoluto)} PCTS
\u200B
\u200B
\u200B
📉 *Desvios (não expedidos):*
\u200B
${r[42] || 'Sem justificativas'}
\u200B
\u200B
➡ *Pontos de Atenção:*
\u200B
${r[41] || 'Sem pontos de atenção'}
\u200B
\u200B`;
  }, [r, baseData]);

  // =======================================================================
  // 2. REPORT VISUAL (RÉPLICA DO SEU DASHBOARD FLEET)
  // =======================================================================
  const visualData = useMemo(() => {
    if (!r) return null;

    const noShow = Number(r[19]) || 0;               // Col T: AT no Piso (No Show)
    const totalCarregado = Number(r[29]) || 0;       // Col AD: Total Carregado / Rotas Exp
    const totalProgramado = Number(r[11]) || 0;      // Col L: Total AT Roteirizado / Programado
    const ofertaTotal = Number(r[24]) || 0;          // Col Y: Oferta Total

    const pacotesRoteirizados = Number(r[12]) || 0;  // Col M
    const pacotesExpedidos = Number(r[14]) || 0;     // Col O
    const motosExpedidas = Number(r[38]) || 0;       // 🔥 NOVO: Col AM (Pacotes Expedidos Motos)

    const sprRoteirizadoValue = Number(r[15]) || 0;  // 🔥 NOVO: Col P
    const sprExpedidoValue = Number(r[16]) || 0;     // 🔥 NOVO: Col Q

    const motosCarr = Number(r[27]) || 0;            // Col AB
    const passeioCarr = Number(r[26]) || 0;          // Col AA
    const fiorinosCarr = Number(r[25]) || 0;         // Col Z
    const vansCarr = Number(r[28]) || 0;             // Col AC
    
    // Tempos de Operação
    const timeRefRow = baseData.find(b => String(b[0]).trim() === String(r[4]).trim() && String(b[1]).trim() === String(r[5]).trim());

    return {
      stacked: [{ name: 'OWNFLEET', ofertado: ofertaTotal, programado: totalProgramado, carregado: totalCarregado, noshow: noShow }],
      progXcarr: [
        { name: 'PROGRAMADO', val: totalProgramado, fill: '#14b8a6' },
        { name: 'CARREGADO', val: totalCarregado, fill: '#f97316' }
      ],
      pacotesComp: [
        { name: 'ROTEIRIZADOS', val: pacotesRoteirizados, fill: '#3b82f6' },
        { name: 'CARREGADOS', val: pacotesExpedidos, fill: '#ef4444' }
      ],
      modal: [
        { name: 'MOTOS', value: motosCarr, fill: '#3b82f6' },
        { name: 'PASSEIOS', value: passeioCarr, fill: '#ef4444' },
        { name: 'FIORINOS', value: fiorinosCarr, fill: '#facc15' },
        { name: 'VANS', value: vansCarr, fill: '#60a5fa' }
      ],
      // 🔥 NOVO: Share comparando Expedidos (O) vs Motos Expedidas (AM)
      share: [
        { name: 'MOTOS', value: motosExpedidas, fill: '#facc15' },
        { name: 'OUTROS', value: Math.max(0, pacotesExpedidos - motosExpedidas), fill: '#3b82f6' }
      ],
      // 🔥 NOVO: Comparação de SPR Roteirizado vs Expedido
      sprComp: [
        { name: 'ROTEIR.', val: sprRoteirizadoValue, fill: '#3b82f6' },
        { name: 'EXPED.', val: sprExpedidoValue, fill: '#14b8a6' }
      ],
      tabelaObs: { 
        totalRotas: totalProgramado, pacotesRot: pacotesRoteirizados, pacotesExp: pacotesExpedidos, 
        noShow: noShow, rotasExp: totalCarregado, sprExpedido: sprExpedidoValue 
      },
      tabelaModal: { motos: motosCarr, passeio: passeioCarr, fiorino: fiorinosCarr, vans: vansCarr },
      clock: { 
        opsIni: timeRefRow ? timeRefRow[4] : '--:--', 
        opsFim: timeRefRow ? timeRefRow[5] : '--:--', 
        hubIni: r[6] || '--:--', 
        hubFim: r[7] || '--:--', 
        tempoOp: r[10] || '--:--' 
      }
    };
  }, [r, baseData]);

  const handleCopy = () => {
    navigator.clipboard.writeText(reportText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePrint = () => window.print();

  if (loading) return <div className="p-10 text-center animate-pulse font-black text-slate-400">CARREGANDO MODELOS...</div>;

  const renderVisualReport = (isExpanded = false) => (
    <div className="w-full h-full bg-[#fff0ed] p-6 text-slate-800 font-sans border border-slate-300">
      
      {/* CABEÇALHO */}
      <div className="flex justify-between items-center border-b-2 border-red-200 pb-3 mb-6">
        <div className="text-[#EE4D2D] font-black italic text-2xl tracking-tighter">ShopeeXPRESS</div>
        <div className="text-xl font-black uppercase tracking-widest text-slate-900">REPORT FLEET - {r[4]}</div>
        <div className="flex gap-6 text-[10px] font-black uppercase text-center bg-white p-2 rounded shadow-sm border border-slate-200">
          <div><div className="text-slate-500 mb-1">Data</div><div className="text-sm">{r[3]}</div></div>
          <div><div className="text-slate-500 mb-1">Ciclo</div><div className="text-sm">{r[5]}</div></div>
          <div><div className="text-slate-500 mb-1">Performance</div><div className="text-green-600 text-sm">100%</div></div>
        </div>
      </div>

      {/* CORPO DO DASHBOARD */}
      <div className="grid grid-cols-12 gap-6 h-full">
        
        {/* LADO ESQUERDO */}
        <div className="col-span-8 flex flex-col gap-4">
          <div className="bg-white p-4 border border-slate-300 shadow-sm flex-1 flex flex-col">
            <h3 className="text-center font-black uppercase text-sm mb-4">Performance Por Ownfleet</h3>
            
            <div className="flex justify-center gap-4 text-[9px] font-bold uppercase mb-6 text-slate-600">
              <span className="flex items-center gap-1"><div className="w-3 h-3 bg-[#f97316]"></div> No Show</span>
              <span className="flex items-center gap-1"><div className="w-3 h-3 bg-[#ef4444]"></div> Carregado</span>
              <span className="flex items-center gap-1"><div className="w-3 h-3 bg-[#3b82f6]"></div> Programado</span>
              <span className="flex items-center gap-1"><div className="w-3 h-3 bg-[#1e3a8a]"></div> Ofertado Pelo 3PL</span>
            </div>

            <div className="flex-1 w-full max-w-md mx-auto">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={visualData.stacked} margin={{top: 20, right: 30, left: 0, bottom: 0}}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tick={{fontSize: 10, fontWeight: 'bold'}} />
                  <YAxis tickFormatter={(val) => `${val}`} tick={{fontSize: 10}} />
                  <Tooltip cursor={{fill: 'transparent'}} />
                  <Bar dataKey="noshow" stackId="a" fill="#f97316"><LabelList dataKey="noshow" position="center" fill="#fff" fontSize={12} fontWeight="bold"/></Bar>
                  <Bar dataKey="carregado" stackId="a" fill="#ef4444"><LabelList dataKey="carregado" position="center" fill="#fff" fontSize={12} fontWeight="bold"/></Bar>
                  <Bar dataKey="programado" stackId="a" fill="#3b82f6"><LabelList dataKey="programado" position="center" fill="#fff" fontSize={12} fontWeight="bold"/></Bar>
                  <Bar dataKey="ofertado" stackId="a" fill="#1e3a8a"><LabelList dataKey="ofertado" position="center" fill="#fff" fontSize={12} fontWeight="bold"/></Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* TABELAS DO RODAPÉ ESQUERDO */}
          <div className="flex gap-4 items-start">
            <table className="flex-1 text-[10px] border-collapse border border-slate-400 bg-white">
              <tbody>
                <tr><td colSpan="4" className="border border-slate-400 font-black text-left p-1 bg-slate-200">OBSERVAÇÃO</td></tr>
                <tr>
                  <td className="border border-slate-400 p-1 font-bold">Total de Rotas:</td><td className="border border-slate-400 p-1 font-black text-center">{visualData.tabelaObs.totalRotas}</td>
                  <td className="border border-slate-400 p-1 font-bold">Noshow:</td><td className="border border-slate-400 p-1 font-black text-center">{visualData.tabelaObs.noShow}</td>
                </tr>
                <tr>
                  <td className="border border-slate-400 p-1 font-bold">Pacotes Roteirizado:</td><td className="border border-slate-400 p-1 font-black text-center">{visualData.tabelaObs.pacotesRot}</td>
                  <td className="border border-slate-400 p-1 font-bold">Rotas Expedidas:</td><td className="border border-slate-400 p-1 font-black text-center">{visualData.tabelaObs.rotasExp}</td>
                </tr>
                <tr>
                  <td className="border border-slate-400 p-1 font-bold">Pacotes Expedidos:</td><td className="border border-slate-400 p-1 font-black text-center">{visualData.tabelaObs.pacotesExp}</td>
                  <td className="border border-slate-400 p-1 font-bold">SPR Expedido:</td><td className="border border-slate-400 p-1 font-black text-center">{visualData.tabelaObs.sprExpedido}</td>
                </tr>
              </tbody>
            </table>

            <table className="text-[10px] border-collapse border border-slate-400 bg-white text-center">
              <thead>
                <tr className="bg-slate-200">
                  <th className="border border-slate-400 p-1">MOTOS</th>
                  <th className="border border-slate-400 p-1">PASSEIO</th>
                  <th className="border border-slate-400 p-1">FIORINO</th>
                  <th className="border border-slate-400 p-1">VANS</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border border-slate-400 p-1 font-black">{visualData.tabelaModal.motos}</td>
                  <td className="border border-slate-400 p-1 font-black">{visualData.tabelaModal.passeio}</td>
                  <td className="border border-slate-400 p-1 font-black">{visualData.tabelaModal.fiorino}</td>
                  <td className="border border-slate-400 p-1 font-black">{visualData.tabelaModal.vans}</td>
                </tr>
              </tbody>
            </table>
          </div>
          
          <table className="w-64 text-[10px] border-collapse border border-slate-400 bg-white text-center font-bold">
            <thead>
              <tr className="bg-slate-200">
                <th className="border border-slate-400 p-1 text-left">MÉTRICA</th>
                <th className="border border-slate-400 p-1 text-left">OPS CLOCK</th>
                <th className="border border-slate-400 p-1 text-left">OPS HUB</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-slate-400 p-1 text-left">Início</td>
                <td className="border border-slate-400 p-1">{visualData.clock.opsIni}</td>
                <td className="border border-slate-400 p-1">{visualData.clock.hubIni}</td>
              </tr>
              <tr>
                <td className="border border-slate-400 p-1 text-left">Fim</td>
                <td className="border border-slate-400 p-1">{visualData.clock.opsFim}</td>
                <td className="border border-slate-400 p-1">{visualData.clock.hubFim}</td>
              </tr>
              <tr>
                <td className="border border-slate-400 p-1 text-left">Tempo de Op.</td>
                <td className="border border-slate-400 p-1 bg-slate-100">-</td>
                <td className="border border-slate-400 p-1 text-[#EE4D2D]">{visualData.clock.tempoOp}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* LADO DIREITO */}
        <div className="col-span-4 flex flex-col gap-4">
          
          {/* Prog x Carregado */}
          <div className="bg-white p-2 border border-slate-300 shadow-sm h-32 flex flex-col">
            <h3 className="text-center font-black uppercase text-[10px] mb-2">Programado X Carregado</h3>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart layout="vertical" data={visualData.progXcarr} margin={{top: 0, right: 30, left: 0, bottom: 0}}>
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" width={80} tick={{fontSize: 8, fontWeight: 'bold'}} axisLine={false} tickLine={false} />
                <Bar dataKey="val" barSize={16}>
                  <LabelList dataKey="val" position="right" fontSize={10} fontWeight="bold" />
                  {visualData.progXcarr.map((e, i) => <Cell key={i} fill={e.fill}/>)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Modal Pie & Pacotes Comp */}
          <div className="flex gap-4 h-40">
            <div className="bg-white p-2 border border-slate-300 shadow-sm flex-1 flex flex-col">
              <h3 className="text-center font-black uppercase text-[10px]">Modal</h3>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={visualData.modal} cx="50%" cy="50%" innerRadius={20} outerRadius={35} dataKey="value" label={{fontSize: 8, fontWeight: 'bold'}} labelLine={false}>
                    {visualData.modal.map((e, i) => <Cell key={i} fill={e.fill}/>)}
                  </Pie>
                  <Legend wrapperStyle={{fontSize: '7px', fontWeight: 'bold'}}/>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="bg-white p-2 border border-slate-300 shadow-sm flex-1 flex flex-col justify-center items-center">
               <h3 className="text-center font-black uppercase text-[8px] mb-2 text-slate-400">Roteirizado x Carregado</h3>
               <ResponsiveContainer width="100%" height="100%">
                 <BarChart data={visualData.pacotesComp} margin={{top: 15, right: 5, left: -20, bottom: 0}}>
                    <XAxis dataKey="name" tick={{fontSize: 8, fontWeight: 'bold'}} axisLine={false} tickLine={false}/>
                    <YAxis hide />
                    <Tooltip />
                    <Bar dataKey="val" barSize={30} radius={[4,4,0,0]}>
                      <LabelList dataKey="val" position="top" fontSize={10} fontWeight="bold"/>
                      {visualData.pacotesComp.map((e, i) => <Cell key={`cell-${i}`} fill={e.fill}/>)}
                    </Bar>
                 </BarChart>
               </ResponsiveContainer>
            </div>
          </div>

          {/* 🔥 SHARE PACOTES & SPR (MODIFICADOS AQUI) 🔥 */}
          <div className="flex gap-4 h-40">
            <div className="bg-white p-2 border border-slate-300 shadow-sm flex-1 flex flex-col">
              <h3 className="text-center font-black uppercase text-[10px]">Share - Expedidos</h3>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={visualData.share} cx="50%" cy="50%" innerRadius={20} outerRadius={35} dataKey="value" label={{fontSize: 8, fontWeight: 'bold'}} labelLine={false}>
                    {visualData.share.map((e, i) => <Cell key={i} fill={e.fill}/>)}
                  </Pie>
                  <Legend wrapperStyle={{fontSize: '8px', fontWeight: 'bold'}}/>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="bg-white p-2 border border-slate-300 shadow-sm flex-1 flex flex-col">
              <h3 className="text-center font-black uppercase text-[9px] mb-2">SPR (Rot. vs Exp.)</h3>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={visualData.sprComp} margin={{top: 15, right: 5, left: -20, bottom: 0}}>
                  <XAxis dataKey="name" tick={{fontSize: 8, fontWeight: 'bold'}} axisLine={false} tickLine={false} />
                  <YAxis hide domain={[0, 'dataMax + 10']} />
                  <Tooltip cursor={{fill: 'rgba(0,0,0,0.05)'}} />
                  <Bar dataKey="val" barSize={30} radius={[4,4,0,0]}>
                     <LabelList dataKey="val" position="top" fontSize={10} fontWeight="bold"/>
                     {visualData.sprComp.map((e, i) => <Cell key={`cell-${i}`} fill={e.fill}/>)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

        </div>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-full gap-6 relative">
      {/* SELETORES */}
      <div className="bg-white dark:bg-[#1f232d] p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-gray-800 shrink-0 print:hidden">
        <div className="mb-4">
          <h2 className="text-2xl font-black text-[#113366] dark:text-white uppercase tracking-tight flex items-center gap-2">
            <ClipboardList className="text-[#EE4D2D]" /> Reports Prontos
          </h2>
          <p className="text-sm text-slate-500 font-bold">Configure os seletores abaixo para gerar o report automático.</p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex flex-col">
            <label className="text-[10px] font-black text-slate-400 uppercase mb-1 flex items-center gap-1"><MapPin size={12}/> Station / Hub</label>
            <select 
              className="w-full bg-slate-50 dark:bg-[#15171e] border border-slate-200 dark:border-gray-700 rounded-xl p-2.5 text-sm font-bold text-[#113366] dark:text-white outline-none focus:ring-2 focus:ring-[#EE4D2D] cursor-pointer disabled:opacity-50"
              value={selectedHub} onChange={(e) => setSelectedHub(e.target.value)}
            >
              <option value="">1. Selecione o Hub...</option>
              {availableHubs.map((hub, i) => <option key={i} value={hub}>{hub}</option>)}
            </select>
          </div>
          <div className="flex flex-col">
            <label className="text-[10px] font-black text-slate-400 uppercase mb-1 flex items-center gap-1"><CalendarDays size={12}/> Data</label>
            <select 
              className="w-full bg-slate-50 dark:bg-[#15171e] border border-slate-200 dark:border-gray-700 rounded-xl p-2.5 text-sm font-bold text-[#113366] dark:text-white outline-none focus:ring-2 focus:ring-[#EE4D2D] cursor-pointer disabled:opacity-50"
              value={selectedData} onChange={(e) => setSelectedData(e.target.value)} disabled={!selectedHub}
            >
              <option value="">2. Selecione a Data...</option>
              {availableDatas.map((dt, i) => <option key={i} value={dt}>{dt}</option>)}
            </select>
          </div>
          <div className="flex flex-col">
            <label className="text-[10px] font-black text-slate-400 uppercase mb-1 flex items-center gap-1"><Clock size={12}/> Ciclo / Turno</label>
            <select 
              className="w-full bg-slate-50 dark:bg-[#15171e] border border-slate-200 dark:border-gray-700 rounded-xl p-2.5 text-sm font-bold text-[#113366] dark:text-white outline-none focus:ring-2 focus:ring-[#EE4D2D] cursor-pointer disabled:opacity-50"
              value={selectedTurno} onChange={(e) => setSelectedTurno(e.target.value)} disabled={!selectedData}
            >
              <option value="">3. Selecione o Ciclo...</option>
              {availableTurnos.map((tn, i) => <option key={i} value={tn}>{tn}</option>)}
            </select>
          </div>
        </div>
      </div>

      {r ? (
        <div className="flex flex-col flex-1 min-h-0">
          <div className="flex gap-2 mb-4 shrink-0 print:hidden">
            <button onClick={() => setActiveTab('text')} className={`px-6 py-2 rounded-xl text-xs font-black uppercase transition-all flex items-center gap-2 ${activeTab === 'text' ? 'bg-[#113366] text-white shadow-md' : 'bg-white text-slate-400 hover:text-[#EE4D2D] border border-slate-200'}`}><MessageSquare size={16}/> Report Escrito</button>
            <button onClick={() => setActiveTab('visual')} className={`px-6 py-2 rounded-xl text-xs font-black uppercase transition-all flex items-center gap-2 ${activeTab === 'visual' ? 'bg-[#113366] text-white shadow-md' : 'bg-white text-slate-400 hover:text-[#EE4D2D] border border-slate-200'}`}><Layout size={16}/> Report Visual (Fleet)</button>
          </div>

          {activeTab === 'text' ? (
            <div className="bg-white dark:bg-[#1f232d] rounded-2xl shadow-sm border border-slate-200 dark:border-gray-800 flex-1 flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-4">
              <div className="p-4 bg-slate-50 dark:bg-gray-800/50 border-b border-slate-100 dark:border-gray-800 flex justify-between items-center shrink-0">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Preview da Mensagem</span>
                <button onClick={handleCopy} className="flex items-center gap-2 bg-[#EE4D2D] text-white px-5 py-2 rounded-lg font-black text-xs hover:bg-[#D0011B] transition-all shadow-md">
                  {copied ? <Check size={16} strokeWidth={3}/> : <Copy size={16} strokeWidth={2.5}/>}
                  {copied ? 'COPIADO!' : 'COPIAR TEXTO'}
                </button>
              </div>
              <div className="p-8 overflow-y-auto custom-scrollbar flex-1 bg-white dark:bg-[#1f232d]">
                <pre className="font-sans text-[15px] text-slate-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">{reportText}</pre>
              </div>
            </div>
          ) : (
            <div className="flex flex-col flex-1 overflow-y-auto">
              <div className="flex justify-end mb-2 print:hidden">
                <button onClick={() => setIsFullscreen(true)} className="flex items-center gap-2 bg-[#113366] hover:bg-blue-800 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm">
                  <Maximize2 size={14}/> Ampliar / Imprimir Gráficos
                </button>
              </div>
              <div className="relative border border-slate-300 shadow-md rounded-xl overflow-hidden" style={{ width: '100%', height: '500px', transform: 'scale(1)', transformOrigin: 'top left' }}>
                 {renderVisualReport()}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-slate-400 bg-white dark:bg-[#1f232d] rounded-2xl border-2 border-dashed border-slate-200 dark:border-gray-800 print:hidden min-h-[300px]">
          <ClipboardList size={64} strokeWidth={1} className="mb-4 text-slate-300" />
          <p className="font-bold uppercase tracking-widest text-xs">Aguardando Seleção (Hub, Data e Turno)</p>
        </div>
      )}

      {/* FULLSCREEN PARA O PRINT */}
      {isFullscreen && r && (
        <div className="fixed inset-0 z-[99999] bg-slate-900/95 flex flex-col print:bg-white print:block">
          <div className="h-16 flex items-center justify-between px-6 bg-[#1f232d] border-b border-gray-800 print:hidden shrink-0">
            <span className="text-white font-black uppercase tracking-widest text-sm flex items-center gap-2"><Layout size={18} className="text-[#EE4D2D]"/> Visualização de Imagem</span>
            <div className="flex items-center gap-3">
              <button onClick={handlePrint} className="flex items-center gap-2 bg-[#EE4D2D] hover:bg-[#D0011B] text-white px-4 py-2 rounded-lg font-bold text-xs transition-colors shadow-lg"><Printer size={16}/> Salvar PDF / Imprimir</button>
              <button onClick={() => setIsFullscreen(false)} className="bg-red-500/20 text-red-500 hover:bg-red-500 hover:text-white p-2 rounded-lg transition-colors"><X size={20}/></button>
            </div>
          </div>
          <div className="flex-1 overflow-auto flex items-center justify-center p-8 print:p-0 print:overflow-visible">
            <div className="w-full max-w-6xl shadow-2xl print:shadow-none bg-white">
              {renderVisualReport()}
            </div>
          </div>
        </div>
      )}

      {copied && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-[#113366] text-white px-6 py-3 rounded-full shadow-2xl z-[9999] flex items-center gap-2 font-bold animate-in zoom-in slide-in-from-bottom-8">
          <Check size={20} className="text-[#EE4D2D]"/> Report copiado para a área de transferência!
        </div>
      )}
    </div>
  );
}