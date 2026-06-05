import React from 'react';
import { 
  BookOpen, ShieldAlert, Calculator, MousePointerClick, Info, MessageSquare, 
  Image as ImageIcon, LayoutDashboard, Zap, CalendarDays, Users, Activity, 
  BarChart3, AlertOctagon, Package, Clock, Truck, MessageSquareWarning, Layers 
} from 'lucide-react';

export default function Premissas() {
  return (
    // 🔥 max-w-[1600px] garante que fique gigante, mas sem deformar no Ultrawide!
    <div className="flex flex-col h-full gap-6 w-full max-w-[1600px] mx-auto pb-10 pt-2 xl:pt-6 px-2 lg:px-6">
      
      {/* HEADER */}
      <div className="bg-white dark:bg-[#1f232d] p-6 lg:p-8 rounded-2xl shadow-sm border border-slate-200 dark:border-gray-800 shrink-0">
        <h1 className="text-2xl lg:text-3xl font-black text-[#113366] dark:text-white uppercase tracking-tight flex items-center gap-3 mb-2">
          <BookOpen className="text-[#EE4D2D]" size={32} />
          Manual & Premissas do Sistema
        </h1>
        <p className="text-sm text-slate-500 dark:text-gray-400 font-bold">
          Guia de preenchimento, regras de negócio, leitura de dashboards e fórmulas dos KPIs operacionais.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* BLOCO 1: REGRAS DE PREENCHIMENTO */}
        <div className="bg-white dark:bg-[#1f232d] p-6 lg:p-8 rounded-2xl shadow-sm border border-slate-200 dark:border-gray-800 flex flex-col gap-4">
          <h2 className="text-xl font-black text-[#EE4D2D] uppercase tracking-widest flex items-center gap-2 mb-2 border-b border-slate-100 dark:border-gray-800 pb-4">
            <MousePointerClick size={20} /> Como Preencher
          </h2>
          
          <ul className="space-y-4 text-sm text-slate-700 dark:text-gray-300 font-medium">
            <li className="flex gap-3">
              <span className="text-[#113366] font-black">1.</span>
              <p><strong>Campos Obrigatórios:</strong> Todos os campos abertos do formulário são obrigatórios. O sistema não salvará o registro caso algum número, mesmo que seja zero (0), fique em branco.</p>
            </li>
            <li className="flex gap-3">
              <span className="text-[#113366] font-black">2.</span>
              <p><strong>Digitação Blindada:</strong> Os campos numéricos aceitam <em>apenas números</em>. Ponto, vírgula, espaços ou letras são bloqueados automaticamente para proteger a base de dados.</p>
            </li>
            <li className="flex gap-3">
              <span className="text-[#113366] font-black">3.</span>
              <p><strong>Sem Operação no Turno:</strong> Caso o Hub não tenha operado, marque a caixa <em>"Sem operação neste turno"</em> no formulário. Isso irá zerar todos os volumes e preencher as justificativas automaticamente.</p>
            </li>
            <li className="flex gap-3">
              <span className="text-[#113366] font-black">4.</span>
              <p><strong>Data:</strong> Para evitar erros de formatação, a data só pode ser selecionada clicando no botão de calendário.</p>
            </li>
          </ul>
        </div>

        {/* BLOCO 2: ALERTAS E TRAVAS */}
        <div className="bg-white dark:bg-[#1f232d] p-6 lg:p-8 rounded-2xl shadow-sm border border-slate-200 dark:border-gray-800 flex flex-col gap-4">
          <h2 className="text-xl font-black text-orange-500 uppercase tracking-widest flex items-center gap-2 mb-2 border-b border-slate-100 dark:border-gray-800 pb-4">
            <ShieldAlert size={20} /> Travas de Segurança
          </h2>
          
          {/* AVISO */}
          <div className="bg-red-600 text-white p-5 rounded-xl flex items-start gap-4 border-2 border-red-700 shadow-md animate-pulse">
            <ShieldAlert size={28} className="shrink-0 mt-0.5" />
            <div>
              <h4 className="font-black text-sm uppercase tracking-wider mb-1">Diretriz Crítica de Segurança</h4>
              <p className="text-[11px] font-black uppercase leading-relaxed tracking-wide">
                TODO ACESSO E ALTERAÇÃO DE DADOS DEVEM SER REALIZADOS EXCLUSIVAMENTE PELO SISTEMA. O USO DIRETO DAS PLANILHAS “GESTÃO_SPI” E “REALOCAÇÃO_SOP” É PROIBIDO. TODAS AS ALTERAÇÕES SÃO REGISTRADAS EM LOG E MONITORADAS.
              </p>
            </div>
          </div>

          <div className="bg-orange-50 dark:bg-orange-900/10 border border-orange-200 dark:border-orange-800 p-4 rounded-xl">
            <h4 className="font-black text-orange-700 dark:text-orange-400 text-xs uppercase mb-1">AT no Piso (&gt; 0)</h4>
            <p className="text-xs text-slate-600 dark:text-gray-400 font-medium">Se houver AT's sobrando no piso ao final da expedição, o sistema exigirá que você marque uma caixa confirmando que está ciente e que a carga será expedida no D+1.</p>
          </div>

          <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 p-4 rounded-xl">
            <h4 className="font-black text-red-700 dark:text-red-400 text-xs uppercase mb-1">Volume Expedido Maior que Processado</h4>
            <p className="text-xs text-slate-600 dark:text-gray-400 font-medium">Matematicamente, não se pode expedir mais do que foi processado. Se isso ocorrer, o sistema emite um alerta e exige confirmação manual da divergência sistêmica.</p>
          </div>
        </div>

        {/* BLOCO 3: ENTENDENDO OS DASHBOARDS */}
        <div className="lg:col-span-2 bg-white dark:bg-[#1f232d] p-6 lg:p-8 rounded-2xl shadow-sm border border-slate-200 dark:border-gray-800 flex flex-col gap-4">
          <h2 className="text-xl font-black text-[#113366] dark:text-blue-400 uppercase tracking-widest flex items-center gap-2 mb-2 border-b border-slate-100 dark:border-gray-800 pb-4">
            <LayoutDashboard size={20} /> Guias de Visualização (Módulos do Dashboard)
          </h2>
          
          {/* 🔥 NOVO DESIGN DE CARDS UNIFICADOS */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mt-2">
            
            <div className="flex flex-col bg-slate-50 dark:bg-[#15171e] p-5 rounded-xl border border-slate-200 dark:border-gray-700 hover:border-[#113366] dark:hover:border-blue-400 transition-colors h-full">
              <div className="flex items-center gap-2 mb-1">
                <LayoutDashboard size={18} className="text-[#EE4D2D] shrink-0"/>
                <h3 className="font-black text-slate-800 dark:text-white text-sm uppercase">Resumo (Overview)</h3>
              </div>
              <p className="text-[10px] text-slate-500 font-bold mb-3 uppercase tracking-wider">Tabela matriz com todos os KPIs</p>
              <div className="text-xs text-slate-700 dark:text-gray-300 font-medium leading-relaxed">
                Cruza e consolida o status da malha. Clique no título de qualquer coluna (ex: <em>Vol Exp</em>) para ordenar os Hubs do maior para o menor e encontrar os ofensores instantaneamente.
              </div>
            </div>

            <div className="flex flex-col bg-slate-50 dark:bg-[#15171e] p-5 rounded-xl border border-slate-200 dark:border-gray-700 hover:border-[#113366] dark:hover:border-blue-400 transition-colors h-full">
              <div className="flex items-center gap-2 mb-1">
                <Zap size={18} className="text-[#EE4D2D] shrink-0"/>
                <h3 className="font-black text-slate-800 dark:text-white text-sm uppercase">Visão One Page</h3>
              </div>
              <p className="text-[10px] text-slate-500 font-bold mb-3 uppercase tracking-wider">Visão executiva unificada</p>
              <div className="text-xs text-slate-700 dark:text-gray-300 font-medium leading-relaxed">
                Cruza dados de Operação (Volumes) e RH (Ativos, Dormentes, Churn). Tudo é agrupado por <strong>Subregional</strong>. Clique na setinha laranja para expandir os Hubs individuais.
              </div>
            </div>

            <div className="flex flex-col bg-slate-50 dark:bg-[#15171e] p-5 rounded-xl border border-slate-200 dark:border-gray-700 hover:border-[#113366] dark:hover:border-blue-400 transition-colors h-full">
              <div className="flex items-center gap-2 mb-1">
                <Users size={18} className="text-[#EE4D2D] shrink-0"/>
                <h3 className="font-black text-slate-800 dark:text-white text-sm uppercase">Gestão de Frota</h3>
              </div>
              <p className="text-[10px] text-slate-500 font-bold mb-3 uppercase tracking-wider">Déficit e status cadastral</p>
              <div className="text-xs text-slate-700 dark:text-gray-300 font-medium leading-relaxed">
                Foca no balanço entre frota cadastrada vs necessária. Avalia o Gap (Déficit de motoristas) por Hub e exibe a evolução gráfica da base (Ativos, Churn, Dormentes e Risco).
              </div>
            </div>

            <div className="flex flex-col bg-slate-50 dark:bg-[#15171e] p-5 rounded-xl border border-slate-200 dark:border-gray-700 hover:border-[#113366] dark:hover:border-blue-400 transition-colors h-full">
              <div className="flex items-center gap-2 mb-1">
                <Activity size={18} className="text-[#EE4D2D] shrink-0"/>
                <h3 className="font-black text-slate-800 dark:text-white text-sm uppercase">Saúde de Frota</h3>
              </div>
              <p className="text-[10px] text-slate-500 font-bold mb-3 uppercase tracking-wider">Comportamento e engajamento</p>
              <div className="text-xs text-slate-700 dark:text-gray-300 font-medium leading-relaxed">
                Monitora a aceitação de ofertas (Taxa de Conversão vs Recusa) dividida por tipo de modal, além de mapear o volume de entrada de novos motoristas (First Trips).
              </div>
            </div>

            <div className="flex flex-col bg-slate-50 dark:bg-[#15171e] p-5 rounded-xl border border-slate-200 dark:border-gray-700 hover:border-[#113366] dark:hover:border-blue-400 transition-colors h-full">
              <div className="flex items-center gap-2 mb-1">
                <BarChart3 size={18} className="text-[#EE4D2D] shrink-0"/>
                <h3 className="font-black text-slate-800 dark:text-white text-sm uppercase">Volumes & SPR</h3>
              </div>
              <p className="text-[10px] text-slate-500 font-bold mb-3 uppercase tracking-wider">Aderência do plano</p>
              <div className="text-xs text-slate-700 dark:text-gray-300 font-medium leading-relaxed">
                Compara graficamente as curvas de pacotes roteirizados contra expedidos, permitindo visualizar a eficiência da saída. Exibe também o atingimento do SPR percentual.
              </div>
            </div>

            <div className="flex flex-col bg-slate-50 dark:bg-[#15171e] p-5 rounded-xl border border-slate-200 dark:border-gray-700 hover:border-[#113366] dark:hover:border-blue-400 transition-colors h-full md:col-span-2">
              <div className="flex items-center gap-2 mb-1">
                <Layers size={18} className="text-[#EE4D2D] shrink-0"/>
                <h3 className="font-black text-slate-800 dark:text-white text-sm uppercase">Estudos de Cluster (Heatmaps)</h3>
              </div>
              <p className="text-[10px] text-slate-500 font-bold mb-3 uppercase tracking-wider">Acúmulo, recusas e proporção modal</p>
              <div className="text-xs text-slate-700 dark:text-gray-300 font-medium leading-relaxed space-y-2">
                <p>Módulo imersivo dividido em três abas operacionais com Matrizes de Calor expansíveis (Hub ➔ Cluster):</p>
                <ul className="list-disc pl-4 space-y-1">
                  <li><strong>AT no Piso:</strong> Monitora carretas retidas com ranking vertical dos "Top 12 Ofensores".</li>
                  <li><strong>Recusas (Declined):</strong> Mapeia insucessos na base com gráficos de Pareto detalhando a "Distribuição por Motivo".</li>
                  <li><strong>Rotas Expedidas:</strong> Consolida a saída com Gráfico de Rosca interativo demonstrando a proporção exata (%) da frota por Modal (Util, Van, Passeio, Moto).</li>
                </ul>
              </div>
            </div>

            <div className="flex flex-col bg-slate-50 dark:bg-[#15171e] p-5 rounded-xl border border-slate-200 dark:border-gray-700 hover:border-[#113366] dark:hover:border-blue-400 transition-colors h-full">
              <div className="flex items-center gap-2 mb-1">
                <AlertOctagon size={18} className="text-[#EE4D2D] shrink-0"/>
                <h3 className="font-black text-slate-800 dark:text-white text-sm uppercase">Gargalos & CAP</h3>
              </div>
              <p className="text-[10px] text-slate-500 font-bold mb-3 uppercase tracking-wider">Saturação física</p>
              <div className="text-xs text-slate-700 dark:text-gray-300 font-medium leading-relaxed">
                Mostra o ranking de Hubs que estouraram o limite da Capacidade de Frota (CAP &gt; 100%). Tabela de Timeline exibe o excesso dia a dia.
              </div>
            </div>

            <div className="flex flex-col bg-slate-50 dark:bg-[#15171e] p-5 rounded-xl border border-slate-200 dark:border-gray-700 hover:border-[#113366] dark:hover:border-blue-400 transition-colors h-full">
              <div className="flex items-center gap-2 mb-1">
                <Package size={18} className="text-[#EE4D2D] shrink-0"/>
                <h3 className="font-black text-slate-800 dark:text-white text-sm uppercase">Realocação</h3>
              </div>
              <p className="text-[10px] text-slate-500 font-bold mb-3 uppercase tracking-wider">Desvios da carga</p>
              <div className="text-xs text-slate-700 dark:text-gray-300 font-medium leading-relaxed">
                Detalha o que aconteceu com pacotes que não saíram. Separa os motivos de retenção (Não Coube x Outros) e o volume de manuseio.
              </div>
            </div>

            <div className="flex flex-col bg-slate-50 dark:bg-[#15171e] p-5 rounded-xl border border-slate-200 dark:border-gray-700 hover:border-[#113366] dark:hover:border-blue-400 transition-colors h-full">
              <div className="flex items-center gap-2 mb-1">
                <CalendarDays size={18} className="text-[#EE4D2D] shrink-0"/>
                <h3 className="font-black text-slate-800 dark:text-white text-sm uppercase">AT Piso Diário</h3>
              </div>
              <p className="text-[10px] text-slate-500 font-bold mb-3 uppercase tracking-wider">Evolução de acúmulo</p>
              <div className="text-xs text-slate-700 dark:text-gray-300 font-medium leading-relaxed">
                Rotas retidas de segunda a domingo. Excelente para identificar se um Hub possui problemas crônicos em determinados dias da semana.
              </div>
            </div>

            <div className="flex flex-col bg-slate-50 dark:bg-[#15171e] p-5 rounded-xl border border-slate-200 dark:border-gray-700 hover:border-[#113366] dark:hover:border-blue-400 transition-colors h-full">
              <div className="flex items-center gap-2 mb-1">
                <Clock size={18} className="text-[#EE4D2D] shrink-0"/>
                <h3 className="font-black text-slate-800 dark:text-white text-sm uppercase">Tempo de Expedição</h3>
              </div>
              <p className="text-[10px] text-slate-500 font-bold mb-3 uppercase tracking-wider">Ritmo e pontualidade</p>
              <div className="text-xs text-slate-700 dark:text-gray-300 font-medium leading-relaxed">
                Avalia a aderência aos horários (tolerância de 15 minutos). Tabela dedicada apenas às ocorrências que estouraram o prazo.
              </div>
            </div>

            <div className="flex flex-col bg-slate-50 dark:bg-[#15171e] p-5 rounded-xl border border-slate-200 dark:border-gray-700 hover:border-[#113366] dark:hover:border-blue-400 transition-colors h-full">
              <div className="flex items-center gap-2 mb-1">
                <Truck size={18} className="text-[#EE4D2D] shrink-0"/>
                <h3 className="font-black text-slate-800 dark:text-white text-sm uppercase">Rodízio</h3>
              </div>
              <p className="text-[10px] text-slate-500 font-bold mb-3 uppercase tracking-wider">Matriz de engajamento</p>
              <div className="text-xs text-slate-700 dark:text-gray-300 font-medium leading-relaxed">
                Rastreia o histórico individual de cada motorista (Rodou, Recusou, Indisponível). Permite gerar CSV consolidado com soma de dias rodados.
              </div>
            </div>

            <div className="flex flex-col bg-slate-50 dark:bg-[#15171e] p-5 rounded-xl border border-slate-200 dark:border-gray-700 hover:border-[#113366] dark:hover:border-blue-400 transition-colors h-full md:col-span-2 xl:col-span-4">
              <div className="flex items-center gap-2 mb-1">
                <MessageSquareWarning size={18} className="text-[#EE4D2D] shrink-0"/>
                <h3 className="font-black text-slate-800 dark:text-white text-sm uppercase">Logbook (Relatos)</h3>
              </div>
              <p className="text-[10px] text-slate-500 font-bold mb-3 uppercase tracking-wider">Ocorrências descritivas da base</p>
              <div className="text-xs text-slate-700 dark:text-gray-300 font-medium leading-relaxed">
                Um feed de "notícias" apenas com os relatos textuais de problemas na operação. Possui um filtro de ruído inteligente que oculta automaticamente preenchimentos vazios como "ok", "sem novidades" ou "sem pontos de atenção".
              </div>
            </div>

          </div>
        </div>

        {/* BLOCO 4: REPORTS PRONTOS (MENSAGENS E IMAGENS) */}
        <div className="lg:col-span-2 bg-white dark:bg-[#1f232d] p-6 lg:p-8 rounded-2xl shadow-sm border border-slate-200 dark:border-gray-800 flex flex-col gap-4">
          <h2 className="text-xl font-black text-[#113366] dark:text-blue-400 uppercase tracking-widest flex items-center gap-2 mb-2 border-b border-slate-100 dark:border-gray-800 pb-4">
            <MessageSquare size={20} /> Reports Prontos (Automação de Reports)
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-2">
            <div>
              <p className="text-sm text-slate-700 dark:text-gray-300 font-medium mb-4">
                A aba de <strong>Reports Prontos</strong> (no menu lateral) serve para automatizar o envio de resultados. Ao selecionar o <em>Hub</em>, a <em>Data</em> e o <em>Turno</em>, o sistema consolida os dados em tempo real.
              </p>
              
              <div className="space-y-4">
                <div className="flex gap-3 bg-slate-50 dark:bg-[#15171e] p-4 rounded-xl border border-slate-200 dark:border-gray-700">
                  <div className="mt-1 text-[#113366] shrink-0"><MessageSquare size={18}/></div>
                  <div>
                    <h4 className="text-xs font-black uppercase text-slate-800 dark:text-white">Report Escrito</h4>
                    <p className="text-xs text-slate-600 dark:text-gray-400 mt-1">Gera um texto formatado com negritos e quebras de linha. O SPR é calculado automaticamente. Basta clicar em <strong>Copiar Texto</strong>.</p>
                  </div>
                </div>
                
                <div className="flex gap-3 bg-slate-50 dark:bg-[#15171e] p-4 rounded-xl border border-slate-200 dark:border-gray-700">
                  <div className="mt-1 text-[#D0011B] shrink-0"><ImageIcon size={18}/></div>
                  <div>
                    <h4 className="text-xs font-black uppercase text-slate-800 dark:text-white">Report Visual (PNG)</h4>
                    <p className="text-xs text-slate-600 dark:text-gray-400 mt-1">Gera um dashboard espelhado. Clicando em <strong>Baixar PNG</strong>, o sistema tira uma foto em alta resolução do painel.</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-[#15171e] p-5 rounded-xl border border-slate-200 dark:border-gray-700 flex flex-col justify-center h-full">
              <h4 className="font-black text-slate-800 dark:text-white text-xs uppercase mb-3">Exemplo de Output do Sistema:</h4>
              <div className="bg-white dark:bg-[#1f232d] p-4 rounded-lg border border-slate-200 dark:border-gray-600 text-[11px] font-mono text-slate-600 dark:text-gray-300 shadow-sm leading-relaxed">
                📊 *Report SPR* <br/>
                📍 *LM Hub_SP_Assis* <br/>
                📅 *Data:* 21/05/2026 <br/><br/>
                🔹 *SPR Processado:* 110 | 5500 <br/>
                🔹 *SPR Expedido:* 108 | 5400 <br/>
                🔹 *Desvio:* -1,8% | 100 PCTS <br/><br/>
                📉 *Desvios (não expedidos):* <br/>
                TOTAL (100) ERRO DE ETIQUETA 50, VOLUMOSO 50
              </div>
            </div>
          </div>
        </div>

        {/* BLOCO 5: FÓRMULAS E CÁLCULOS */}
        <div className="lg:col-span-2 bg-white dark:bg-[#1f232d] p-6 lg:p-8 rounded-2xl shadow-sm border border-slate-200 dark:border-gray-800 flex flex-col gap-4">
          <h2 className="text-xl font-black text-[#113366] dark:text-blue-400 uppercase tracking-widest flex items-center gap-2 mb-2 border-b border-slate-100 dark:border-gray-800 pb-4">
            <Calculator size={20} /> Fórmulas e KPIs (Como o sistema pensa)
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mt-2">
            
            <div className="flex flex-col bg-slate-50 dark:bg-[#15171e] p-5 rounded-xl border border-slate-200 dark:border-gray-700 h-full">
              <div className="flex items-center gap-2 mb-1"><Info size={18} className="text-[#EE4D2D] shrink-0"/><h3 className="font-black text-slate-800 dark:text-white text-sm uppercase">Cálculos de SPR</h3></div>
              <p className="text-[10px] text-slate-500 font-bold mb-3 uppercase tracking-wider">Densidade da rota</p>
              <ul className="text-xs space-y-2 text-slate-700 dark:text-gray-300 font-bold flex-1">
                <li className="flex gap-2"><span className="text-[#113366] dark:text-blue-400 shrink-0">SPR Rot:</span> Vol. Roteirizado ÷ Total AT Rot.</li>
                <li className="flex gap-2"><span className="text-[#113366] dark:text-blue-400 shrink-0">SPR Proc:</span> Vol. Processado ÷ Rotas Expedidas</li>
                <li className="flex gap-2"><span className="text-[#113366] dark:text-blue-400 shrink-0">SPR Exp:</span> Vol. Expedido ÷ Rotas Expedidas</li>
              </ul>
            </div>

            <div className="flex flex-col bg-slate-50 dark:bg-[#15171e] p-5 rounded-xl border border-slate-200 dark:border-gray-700 h-full">
              <div className="flex items-center gap-2 mb-1"><Info size={18} className="text-[#EE4D2D] shrink-0"/><h3 className="font-black text-slate-800 dark:text-white text-sm uppercase">Cálculo de Desvio</h3></div>
              <p className="text-[10px] text-slate-500 font-bold mb-3 uppercase tracking-wider">Carga retida</p>
              <ul className="text-xs space-y-2 text-slate-700 dark:text-gray-300 font-bold flex-1">
                <li className="flex gap-2"><span className="text-[#113366] dark:text-blue-400 shrink-0">Desvio Abs:</span> Vol. Expedido - Vol. Roteirizado</li>
                <li className="flex gap-2"><span className="text-[#113366] dark:text-blue-400 shrink-0">Desvio (%):</span> (Desvio Absoluto ÷ Vol. Roteirizado) × 100</li>
              </ul>
            </div>

            <div className="flex flex-col bg-slate-50 dark:bg-[#15171e] p-5 rounded-xl border border-slate-200 dark:border-gray-700 h-full md:col-span-2 xl:col-span-1">
              <div className="flex items-center gap-2 mb-1"><Info size={18} className="text-[#EE4D2D] shrink-0"/><h3 className="font-black text-slate-800 dark:text-white text-sm uppercase">Tempo & Atrasos</h3></div>
              <p className="text-[10px] text-slate-500 font-bold mb-3 uppercase tracking-wider">Tolerância: 15 minutos</p>
              <ul className="text-xs space-y-2 text-slate-700 dark:text-gray-300 font-bold flex-1">
                <li className="flex gap-2"><span className="text-[#113366] dark:text-blue-400 shrink-0">Ritmo:</span> Tempo Total Ops ÷ Total Carregados</li>
                <li className="flex gap-2"><span className="text-[#113366] dark:text-blue-400 shrink-0">Atraso Início:</span> Se (Início Real) for maior que (Setup Início + 15 min)</li>
                <li className="flex gap-2"><span className="text-[#113366] dark:text-blue-400 shrink-0">Atraso Fim:</span> Se (Fim Real) for maior que (Setup Fim + 15 min)</li>
              </ul>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}