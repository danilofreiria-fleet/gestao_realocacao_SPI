import React, { useState, useEffect, useMemo } from 'react';
import { getConsolidadoData, getBaseReferenceData } from '../api/googleSheets';
import { getHubsPermitidos } from '../constants/regionais';
import { Copy, Check, Layout, MessageSquare, ClipboardList, MapPin, CalendarDays, Clock, Maximize2, X, Printer, Package, AlertCircle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend, LabelList } from 'recharts';

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

  const reportText = useMemo(() => {
    if (!r) return "";
    
    const sprRefRow = baseData.find(b => String(b[0]).trim() === String(r[4]).trim() && String(b[1]).trim() === String(r[5]).trim());
    const sprReferencial = sprRefRow ? sprRefRow[6] : 'N/A';

    const pacotesRoteirizados = Number(r[12]) || 0;    
    const pacotesExpedidos = Number(r[14]) || 0;       
    const totalRotasRoteirizadas = Number(r[11]) || 0; 
    const totalRotasCarregadas = Number(r[29]) || 0;   
    const volProc = Number(r[13]) || 0;                

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

  const visualData = useMemo(() => {
    if (!r) return null;

    const noShow = Number(r[19]) || 0;               
    const totalCarregado = Number(r[29]) || 0;       
    const totalProgramado = Number(r[11]) || 0;      
    const ofertaTotal = Number(r[24]) || 0;          

    const pacotesRoteirizados = Number(r[12]) || 0;  
    const pacotesExpedidos = Number(r[14]) || 0;     
    const motosExpedidas = Number(r[38]) || 0;       

    const sprRoteirizadoValue = Number(r[15]) || 0;  
    const sprExpedidoValue = Number(r[16]) || 0;     

    const motosCarr = Number(r[27]) || 0;            
    const passeioCarr = Number(r[26]) || 0;          
    const fiorinosCarr = Number(r[25]) || 0;         
    const vansCarr = Number(r[28]) || 0;             
    
    const timeRefRow = baseData.find(b => String(b[0]).trim() === String(r[4]).trim() && String(b[1]).trim() === String(r[5]).trim());

    return {
      stacked: [{ name: 'OWNFLEET', ofertado: ofertaTotal, programado: totalProgramado, carregado: totalCarregado, noshow: noShow }],
      progXcarr: [
        { name: 'PROG.', val: totalProgramado, fill: '#14b8a6' },
        { name: 'CARR.', val: totalCarregado, fill: '#f97316' }
      ],
      pacotesComp: [
        { name: 'ROT.', val: pacotesRoteirizados, fill: '#3b82f6' },
        { name: 'CARR.', val: pacotesExpedidos, fill: '#ef4444' }
      ],
      modal: [
        { name: 'MOTOS', value: motosCarr, fill: '#3b82f6' },
        { name: 'PASSEIO', value: passeioCarr, fill: '#ef4444' },
        { name: 'FIORINO', value: fiorinosCarr, fill: '#facc15' },
        { name: 'VANS', value: vansCarr, fill: '#60a5fa' }
      ],
      share: [
        { name: 'MOTOS', value: motosExpedidas, fill: '#facc15' },
        { name: 'OUTROS', value: Math.max(0, pacotesExpedidos - motosExpedidas), fill: '#3b82f6' }
      ],
      sprComp: [
        { name: 'ROT.', val: sprRoteirizadoValue, fill: '#3b82f6' },
        { name: 'EXP.', val: sprExpedidoValue, fill: '#14b8a6' }
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

  const renderVisualReport = () => (
    // min-w-[1024px] garante que o print nunca achate os graficos ideais mesmo abrindo em telas mini
    <div className="w-full bg-[#fff0ed] p-5 text-slate-800 font-sans border border-slate-300 min-w-[1000px] overflow-hidden rounded-xl">
      
      {/* CABEÇALHO */}
      <div className="flex justify-between items-center border-b-2 border-red-200 pb-3 mb-4">
        <div className="text-[#EE4D2D] font-black italic text-2xl tracking-tighter">ShopeeXPRESS</div>
        <div className="text-lg font-black uppercase tracking-wider text-slate-900">REPORT FLEET - {r[4]}</div>
        <div className="flex gap-4 text-[10px] font-black uppercase text-center bg-white p-2 rounded shadow-sm border border-slate-200">
          <div><div className="text-slate-500 mb-0.5">Data</div><div className="text-xs text-slate-800">{r[3]}</div></div>
          <div><div className="text-slate-500 mb-0.5">Ciclo</div><div className="text-xs text-slate-800">{r[5]}</div></div>
          <div><div className="text-slate-500 mb-0.5">Status</div><div className="text-green-600 text-xs">CONCLUÍDO</div></div>
        </div>
      </div>

      {/* CORPO DO DASHBOARD */}
      <div className="grid grid-cols-12 gap-5">
        
        {/* LADO ESQUERDO (COL 8) */}
        <div className="col-span-8 flex flex-col gap-4">
          <div className="bg-white p-4 border border-slate-200 shadow-sm rounded-xl flex flex-col">
            <h3 className="text-center font-black uppercase text-xs mb-3 text-slate-700 tracking-wide">Performance Por Ownfleet</h3>
            
            <div className="flex justify-center gap-4 text-[9px] font-black uppercase mb-4 text-slate-500">
              <span className="flex items-center gap-1"><div className="w-2.5 h-2.5 bg-[#f97316] rounded-sm"></div> No Show</span>
              <span className="flex items-center gap-1"><div className="w-2.5 h-2.5 bg-[#ef4444] rounded-sm"></div> Carregado</span>
              <span className="flex items-center gap-1"><div className="w-2.5 h-2.5 bg-[#3b82f6] rounded-sm"></div> Programado</span>
              <span className="flex items-center gap-1"><div className="w-2.5 h-2.5 bg-[#1e3a8a] rounded-sm"></div> Ofertado</span>
            </div>

            {/* Altura fixa controlada para o container de gráficos */}
            <div className="w-full h-44 max-w-lg mx-auto">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={visualData.stacked} margin={{top: 10, right: 10, left: -20, bottom: 0}}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9"/>
                  <XAxis dataKey="name" tick={{fontSize: 9, fontWeight: 'bold'}} />
                  <YAxis tick={{fontSize: 9}} />
                  <Tooltip cursor={{fill: 'transparent'}} />
                  <Bar dataKey="noshow" stackId="a" fill="#f97316"><LabelList dataKey="noshow" position="center" fill="#fff" fontSize={10} fontWeight="bold"/></Bar>
                  <Bar dataKey="carregado" stackId="a" fill="#ef4444"><LabelList dataKey="carregado" position="center" fill="#fff" fontSize={10} fontWeight="bold"/></Bar>
                  <Bar dataKey="programado" stackId="a" fill="#3b82f6"><LabelList dataKey="programado" position="center" fill="#fff" fontSize={10} fontWeight="bold"/></Bar>
                  <Bar dataKey="ofertado" stackId="a" fill="#1e3a8a"><LabelList dataKey="ofertado" position="center" fill="#fff" fontSize={10} fontWeight="bold"/></Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* TABELAS DO RODAPÉ */}
          <div className="grid grid-cols-2 gap-4 items-start">
            <table className="w-full text-[10px] border-collapse border border-slate-300 bg-white shadow-sm rounded-lg overflow-hidden">
              <tbody>
                <tr><td colSpan="4" className="border-b border-slate-300 font-black text-left p-1.5 bg-slate-100 text-slate-700">OBSERVAÇÃO</td></tr>
                <tr className="border-b border-slate-200">
                  <td className="p-1.5 font-bold text-slate-500">Total Rotas:</td><td className="p-1.5 font-black text-center text-slate-800">{visualData.tabelaObs.totalRotas}</td>
                  <td className="p-1.5 font-bold text-slate-500">No Show:</td><td className="p-1.5 font-black text-center text-[#f97316]">{visualData.tabelaObs.noShow}</td>
                </tr>
                <tr className="border-b border-slate-200">
                  <td className="p-1.5 font-bold text-slate-500">Pcts Rot.:</td><td className="p-1.5 font-black text-center text-slate-800">{visualData.tabelaObs.pacotesRot}</td>
                  <td className="p-1.5 font-bold text-slate-500">Rotas Exp:</td><td className="p-1.5 font-black text-center text-slate-800">{visualData.tabelaObs.rotasExp}</td>
                </tr>
                <tr>
                  <td className="p-1.5 font-bold text-slate-500">Pcts Exp:</td><td className="p-1.5 font-black text-center text-slate-800">{visualData.tabelaObs.pacotesExp}</td>
                  <td className="p-1.5 font-bold text-slate-500">SPR Exp:</td><td className="p-1.5 font-black text-center text-[#EE4D2D]">{visualData.tabelaObs.sprExpedido}</td>
                </tr>
              </tbody>
            </table>

            <div className="flex flex-col gap-3">
              <table className="w-full text-[10px] border-collapse border border-slate-300 bg-white text-center shadow-sm rounded-lg overflow-hidden">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 font-black">
                    <th className="p-1.5 border-r border-slate-200">MOTOS</th>
                    <th className="p-1.5 border-r border-slate-200">PASSEIO</th>
                    <th className="p-1.5 border-r border-slate-200">FIORINO</th>
                    <th className="p-1.5">VANS</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="text-slate-800 font-black">
                    <td className="p-1.5 border-r border-slate-200 bg-blue-50/30">{visualData.tabelaModal.motos}</td>
                    <td className="p-1.5 border-r border-slate-200 bg-red-50/30">{visualData.tabelaModal.passeio}</td>
                    <td className="p-1.5 border-r border-slate-200 bg-yellow-50/30">{visualData.tabelaModal.fiorino}</td>
                    <td className="p-1.5 bg-sky-50/30">{visualData.tabelaModal.vans}</td>
                  </tr>
                </tbody>
              </table>

              <table className="w-full text-[9px] border-collapse border border-slate-300 bg-white text-center font-bold shadow-sm rounded-lg overflow-hidden">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 font-black">
                    <th className="p-1 text-left pl-2">MÉTRICA</th>
                    <th className="p-1">CLOCK</th>
                    <th className="p-1">HUB</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-slate-200 text-slate-600">
                    <td className="p-1 text-left pl-2 font-bold">Início</td>
                    <td className="p-1 font-black">{visualData.clock.opsIni}</td>
                    <td className="p-1 font-black text-slate-800">{visualData.clock.hubIni}</td>
                  </tr>
                  <tr className="border-b border-slate-200 text-slate-600">
                    <td className="p-1 text-left pl-2 font-bold">Fim</td>
                    <td className="p-1 font-black">{visualData.clock.opsFim}</td>
                    <td className="p-1 font-black text-slate-800">{visualData.clock.hubFim}</td>
                  </tr>
                  <tr className="bg-orange-50/20">
                    <td className="p-1 text-left pl-2 text-slate-700 font-black">Tempo Op.</td>
                    <td className="p-1 text-slate-400">-</td>
                    <td className="p-1 text-[#EE4D2D] font-black">{visualData.clock.tempoOp}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* LADO DIREITO (COL 4) */}
        <div className="col-span-4 flex flex-col gap-3">
          
          {/* Prog x Carregado */}
          <div className="bg-white p-2 border border-slate-200 shadow-sm rounded-xl h-24 flex flex-col">
            <h3 className="text-center font-black uppercase text-[9px] text-slate-500 mb-1">Programado X Carregado</h3>
            <div className="flex-1 min-h-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart layout="vertical" data={visualData.progXcarr} margin={{top: 5, right: 35, left: -15, bottom: 5}}>
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" width={45} tick={{fontSize: 8, fontWeight: 'bold'}} axisLine={false} tickLine={false} />
                  <Bar dataKey="val" barSize={12} radius={[0, 3, 3, 0]}>
                    <LabelList dataKey="val" position="right" fontSize={9} fontWeight="bold" fill="#475569" offset={5} />
                    {visualData.progXcarr.map((e, i) => <Cell key={i} fill={e.fill}/>)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Modal Pie & Pacotes Comp */}
          <div className="grid grid-cols-2 gap-3 h-36">
            <div className="bg-white p-2 border border-slate-200 shadow-sm rounded-xl flex flex-col">
              <h3 className="text-center font-black uppercase text-[9px] text-slate-500 mb-1">Modal</h3>
              <div className="flex-1 min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie 
                      data={visualData.modal} 
                      cx="50%" 
                      cy="45%" 
                      innerRadius={14} 
                      outerRadius={24} 
                      dataKey="value" 
                      label={false}
                    >
                      {visualData.modal.map((e, i) => <Cell key={i} fill={e.fill}/>)}
                    </Pie>
                    <Legend iconSize={5} layout="horizontal" verticalAlign="bottom" align="center" wrapperStyle={{fontSize: '7px', fontWeight: 'bold', paddingTop: '4px'}}/>
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
            
            <div className="bg-white p-2 border border-slate-200 shadow-sm rounded-xl flex flex-col">
               <h3 className="text-center font-black uppercase text-[9px] text-slate-500 mb-1">Pcts (Rot x Carr)</h3>
               <div className="flex-1 min-h-0">
                 <ResponsiveContainer width="100%" height="100%">
<BarChart data={visualData.pacotesComp} margin={{top: 18, right: 8, left: 0, bottom: 15}}>
   <XAxis 
     dataKey="name" 
     interval={0} 
     tick={{fontSize: 8, fontWeight: 'bold'}} 
     axisLine={false} 
     tickLine={false}
   />
   <YAxis hide />
   <Bar dataKey="val" barSize={18} radius={[3,3,0,0]}>
     <LabelList dataKey="val" position="top" fontSize={8} fontWeight="bold" fill="#475569" offset={4}/>
     {visualData.pacotesComp.map((e, i) => <Cell key={`cell-${i}`} fill={e.fill}/>)}
   </Bar>
</BarChart>
                 </ResponsiveContainer>
               </div>
            </div>
          </div>

          {/* SHARE PACOTES & SPR */}
          <div className="grid grid-cols-2 gap-3 h-36">
            <div className="bg-white p-2 border border-slate-200 shadow-sm rounded-xl flex flex-col">
              <h3 className="text-center font-black uppercase text-[9px] text-slate-500 mb-1">Share Expedidos</h3>
              <div className="flex-1 min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie 
                      data={visualData.share} 
                      cx="50%" 
                      cy="45%" 
                      innerRadius={14} 
                      outerRadius={24} 
                      dataKey="value" 
                      label={false}
                    >
                      {visualData.share.map((e, i) => <Cell key={i} fill={e.fill}/>)}
                    </Pie>
                    <Legend iconSize={5} layout="horizontal" verticalAlign="bottom" align="center" wrapperStyle={{fontSize: '7px', fontWeight: 'bold', paddingTop: '4px'}}/>
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

<div className="bg-white p-2 border border-slate-200 shadow-sm rounded-xl flex flex-col">
  <h3 className="text-center font-black uppercase text-[9px] text-slate-500 mb-1">SPR (Rot vs Exp)</h3>
  <div className="flex-1 min-h-0">
    <ResponsiveContainer width="100%" height="100%">
      {/* 🛠️ Mudança aqui: left mudou de -25 para 0 para centralizar */}
      <BarChart data={visualData.sprComp} margin={{top: 18, right: 8, left: 0, bottom: 15}}>
        <XAxis dataKey="name" tick={{fontSize: 8, fontWeight: 'bold'}} axisLine={false} tickLine={false} />
        <YAxis hide domain={[0, 'dataMax + 5']} />
        <Bar dataKey="val" barSize={18} radius={[3,3,0,0]}>
           <LabelList dataKey="val" position="top" fontSize={8} fontWeight="bold" fill="#475569" offset={4}/>
           {visualData.sprComp.map((e, i) => <Cell key={`cell-${i}`} fill={e.fill}/>)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  </div>
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
              className="w-full bg-slate-50 dark:bg-[#15171e] border border-slate-200 dark:border-gray-700 rounded-xl p-2.5 text-sm font-bold text-[#113366] dark:text-white outline-none focus:ring-2 focus:ring-[#EE4D2D] cursor-pointer"
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
            <div className="bg-white dark:bg-[#1f232d] rounded-2xl shadow-sm border border-slate-200 dark:border-gray-800 flex-1 flex flex-col overflow-hidden">
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
            <div className="flex flex-col flex-1 min-h-0">
              <div className="flex justify-end mb-2 print:hidden">
                <button onClick={() => setIsFullscreen(true)} className="flex items-center gap-2 bg-[#113366] hover:bg-blue-800 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm">
                  <Maximize2 size={14}/> Ampliar / Imprimir Gráficos
                </button>
              </div>
              
              <div className="w-full border border-slate-300 shadow-md rounded-xl overflow-x-auto bg-[#fff0ed]">
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

      {isFullscreen && r && (
        <div className="fixed inset-0 z-[99999] bg-slate-900/95 flex flex-col print:bg-white print:block">
          <div className="h-16 flex items-center justify-between px-6 bg-[#1f232d] border-b border-gray-800 print:hidden shrink-0">
            <span className="text-white font-black uppercase tracking-widest text-sm flex items-center gap-2"><Layout size={18} className="text-[#EE4D2D]"/> Visualização de Imagem para Print</span>
            <div className="flex items-center gap-3">
              <button onClick={handlePrint} className="flex items-center gap-2 bg-[#EE4D2D] hover:bg-[#D0011B] text-white px-4 py-2 rounded-lg font-bold text-xs transition-colors shadow-lg"><Printer size={16}/> Salvar PDF / Imprimir</button>
              <button onClick={() => setIsFullscreen(false)} className="bg-red-500/20 text-red-500 hover:bg-red-500 hover:text-white p-2 rounded-lg transition-colors"><X size={20}/></button>
            </div>
          </div>
          <div className="flex-1 overflow-auto p-8 print:p-0 print:overflow-visible flex items-start justify-center">
            <div className="shadow-xl bg-[#fff0ed] p-2 rounded-xl">
              {renderVisualReport()}
            </div>
          </div>
        </div>
      )}

      {copied && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-[#113366] text-white px-6 py-3 rounded-full shadow-2xl z-[9999] flex items-center gap-2 font-bold">
          <Check size={20} className="text-[#EE4D2D]"/> Report copiado para a área de transferência!
        </div>
      )}
    </div>
  );
}