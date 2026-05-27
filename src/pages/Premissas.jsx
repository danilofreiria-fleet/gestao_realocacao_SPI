import React from 'react';
import { 
  BookOpen, ShieldAlert, Calculator, MousePointerClick, Info, MessageSquare, 
  Image as ImageIcon, LayoutDashboard, Zap, CalendarDays, Users, Activity, 
  BarChart3, AlertOctagon, Package, Clock, Truck, MessageSquareWarning 
} from 'lucide-react';

export default function Premissas() {
  return (
    <div className="flex flex-col h-full gap-6 max-w-6xl mx-auto pb-10 mt-6">
      
      {/* HEADER */}
      <div className="bg-white dark:bg-[#1f232d] p-8 rounded-2xl shadow-sm border border-slate-200 dark:border-gray-800 shrink-0">
        <h1 className="text-3xl font-black text-[#113366] dark:text-white uppercase tracking-tight flex items-center gap-3 mb-2">
          <BookOpen className="text-[#EE4D2D]" size={32} />
          Manual & Premissas do Sistema
        </h1>
        <p className="text-sm text-slate-500 dark:text-gray-400 font-bold">
          Guia de preenchimento, regras de negócio, leitura de dashboards e fórmulas dos KPIs operacionais.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* BLOCO 1: REGRAS DE PREENCHIMENTO */}
        <div className="bg-white dark:bg-[#1f232d] p-8 rounded-2xl shadow-sm border border-slate-200 dark:border-gray-800 flex flex-col gap-4">
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
        <div className="bg-white dark:bg-[#1f232d] p-8 rounded-2xl shadow-sm border border-slate-200 dark:border-gray-800 flex flex-col gap-4">
          <h2 className="text-xl font-black text-orange-500 uppercase tracking-widest flex items-center gap-2 mb-2 border-b border-slate-100 dark:border-gray-800 pb-4">
            <ShieldAlert size={20} /> Travas de Segurança
          </h2>
          
          {/* AVISO */}
          <div className="bg-red-600 text-white p-5 rounded-xl flex items-start gap-4 border-2 border-red-700 shadow-md animate-pulse">
            <ShieldAlert size={28} className="shrink-0 mt-0.5" />
            <div>
              <h4 className="font-black text-sm uppercase tracking-wider mb-1">Diretriz Crítica de Segurança</h4>
              <p className="text-[11px] font-black uppercase leading-relaxed tracking-wide">
                TODO ACESSO E ALTERAÇÃO DE DADOS DEVEM SER REALIZADOS EXCLUSIVAMENTE PELO SISTEMA. O USO DIRETO DAS PLANILHAS “GESTÃO_SPI” E “REALOCAÇÃO_SOP” É PROIBIDO. TODAS AS ALTERAÇÕES SÃO REGISTRADAS EM LOG, MONITORADAS AUTOMATICAMENTE E ENVIADAS AOS RESPECTIVOS SUPERVISORES REGIONAIS.
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
        <div className="md:col-span-2 bg-white dark:bg-[#1f232d] p-8 rounded-2xl shadow-sm border border-slate-200 dark:border-gray-800 flex flex-col gap-4">
          <h2 className="text-xl font-black text-[#113366] dark:text-blue-400 uppercase tracking-widest flex items-center gap-2 mb-2 border-b border-slate-100 dark:border-gray-800 pb-4">
            <LayoutDashboard size={20} /> Guias de Visualização (Módulos do Dashboard)
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mt-2">
            
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2"><LayoutDashboard size={16} className="text-[#EE4D2D]"/><h3 className="font-black text-slate-800 dark:text-white text-sm uppercase">Resumo (Overview)</h3></div>
              <p className="text-xs text-slate-500 font-medium mb-2">Tabela matriz com todos os KPIs.</p>
              <div className="flex-1 text-xs text-slate-700 dark:text-gray-300 font-medium bg-slate-50 dark:bg-[#15171e] p-3 rounded-lg border border-slate-100 dark:border-gray-700 leading-relaxed">
                Cruza e consolida o status da malha. Clique no título de any coluna (ex: <em>Vol Exp</em>) para ordenar os Hubs do maior para o menor e encontrar os ofensores instantaneamente.
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2"><Zap size={16} className="text-[#EE4D2D]"/><h3 className="font-black text-slate-800 dark:text-white text-sm uppercase">Visão One Page</h3></div>
              <p className="text-xs text-slate-500 font-medium mb-2">Visão executiva unificada.</p>
              <div className="flex-1 text-xs text-slate-700 dark:text-gray-300 font-medium bg-slate-50 dark:bg-[#15171e] p-3 rounded-lg border border-slate-100 dark:border-gray-700 leading-relaxed">
                Cruza dados de Operação (Volumes) e RH (Ativos, Dormentes, Churn). Tudo é agrupado por <strong>Subregional</strong>. Clique na setinha laranja para expandir os Hubs individuais.
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2"><Users size={16} className="text-[#EE4D2D]"/><h3 className="font-black text-slate-800 dark:text-white text-sm uppercase">Gestão de Frota</h3></div>
              <p className="text-xs text-slate-500 font-medium mb-2">Déficit e status cadastral.</p>
              <div className="flex-1 text-xs text-slate-700 dark:text-gray-300 font-medium bg-slate-50 dark:bg-[#15171e] p-3 rounded-lg border border-slate-100 dark:border-gray-700 leading-relaxed">
                Foca no balanço entre frota cadastrada vs necessária. Avalia o Gap (Déficit de motoristas) por Hub e exibe a evolução gráfica da base (Ativos, Churn, Dormentes e Risco).
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2"><Activity size={16} className="text-[#EE4D2D]"/><h3 className="font-black text-slate-800 dark:text-white text-sm uppercase">Saúde de Frota</h3></div>
              <p className="text-xs text-slate-500 font-medium mb-2">Comportamento e engajamento.</p>
              <div className="flex-1 text-xs text-slate-700 dark:text-gray-300 font-medium bg-slate-50 dark:bg-[#15171e] p-3 rounded-lg border border-slate-100 dark:border-gray-700 leading-relaxed">
                Monitora a aceitação de ofertas (Taxa de Conversão vs Recusa) dividida por tipo de modal, além de mapear o volume de entrada de novos motoristas (First Trips) na operação.
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2"><BarChart3 size={16} className="text-[#EE4D2D]"/><h3 className="font-black text-slate-800 dark:text-white text-sm uppercase">Volumes & SPR</h3></div>
              <p className="text-xs text-slate-500 font-medium mb-2">Aderência do plano e produtividade.</p>
              <div className="flex-1 text-xs text-slate-700 dark:text-gray-300 font-medium bg-slate-50 dark:bg-[#15171e] p-3 rounded-lg border border-slate-100 dark:border-gray-700 leading-relaxed">
                Compara graficamente as curvas de pacotes roteirizados contra expedidos, permitindo visualizar a eficiência da saída. Exibe também o atingimento do SPR.
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2"><AlertOctagon size={16} className="text-[#EE4D2D]"/><h3 className="font-black text-slate-800 dark:text-white text-sm uppercase">Gargalos & CAP</h3></div>
              <p className="text-xs text-slate-500 font-medium mb-2">Saturação da capacidade física.</p>
              <div className="flex-1 text-xs text-slate-700 dark:text-gray-300 font-medium bg-slate-50 dark:bg-[#15171e] p-3 rounded-lg border border-slate-100 dark:border-gray-700 leading-relaxed">
                Mostra o ranking de Hubs que estouraram o limite da Capacidade de Frota (CAP &gt; 100%). Uma tabela de Timeline exibe o excesso percentual dia a dia.
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2"><Package size={16} className="text-[#EE4D2D]"/><h3 className="font-black text-slate-800 dark:text-white text-sm uppercase">Pacotes e Realocação</h3></div>
              <p className="text-xs text-slate-500 font-medium mb-2">Desvios operacionais da carga.</p>
              <div className="flex-1 text-xs text-slate-700 dark:text-gray-300 font-medium bg-slate-50 dark:bg-[#15171e] p-3 rounded-lg border border-slate-100 dark:border-gray-700 leading-relaxed">
                Detalha o que aconteceu com os pacotes que não saíram. Separa os motivos de retenção (Não Coube x Outros) e o volume de manuseio e realocação sistêmica.
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2"><CalendarDays size={16} className="text-[#EE4D2D]"/><h3 className="font-black text-slate-800 dark:text-white text-sm uppercase">AT no Piso Diário</h3></div>
              <p className="text-xs text-slate-500 font-medium mb-2">Evolução do acúmulo de carga.</p>
              <div className="flex-1 text-xs text-slate-700 dark:text-gray-300 font-medium bg-slate-50 dark:bg-[#15171e] p-3 rounded-lg border border-slate-100 dark:border-gray-700 leading-relaxed">
                Mostra as rotas retidas de segunda a domingo. Excelente para identificar se um Hub possui problemas crônicos em determinados dias da semana (ex: gargalos às segundas).
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2"><Clock size={16} className="text-[#EE4D2D]"/><h3 className="font-black text-slate-800 dark:text-white text-sm uppercase">Tempo de Expedição</h3></div>
              <p className="text-xs text-slate-500 font-medium mb-2">Ritmo, velocidade e pontualidade.</p>
              <div className="flex-1 text-xs text-slate-700 dark:text-gray-300 font-medium bg-slate-50 dark:bg-[#15171e] p-3 rounded-lg border border-slate-100 dark:border-gray-700 leading-relaxed">
                Avalia a aderência aos horários usando uma tolerância automática de 15 minutos. Conta com uma tabela dedicada apenas às ocorrências que estouraram o prazo.
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2"><Truck size={16} className="text-[#EE4D2D]"/><h3 className="font-black text-slate-800 dark:text-white text-sm uppercase">Rodízio</h3></div>
              <p className="text-xs text-slate-500 font-medium mb-2">Matriz de calor da frota.</p>
              <div className="flex-1 text-xs text-slate-700 dark:text-gray-300 font-medium bg-slate-50 dark:bg-[#15171e] p-3 rounded-lg border border-slate-100 dark:border-gray-700 leading-relaxed">
                Rastreia o engajamento individual de cada motorista (Rodou, Recusou, Indisponível). Permite buscar um ID específico para checar a frequência no mês.
              </div>
            </div>

            <div className="flex flex-col gap-2 xl:col-span-2">
              <div className="flex items-center gap-2"><MessageSquareWarning size={16} className="text-[#EE4D2D]"/><h3 className="font-black text-slate-800 dark:text-white text-sm uppercase">Logbook (Relatos)</h3></div>
              <p className="text-xs text-slate-500 font-medium mb-2">Ocorrências descritivas da base.</p>
              <div className="flex-1 text-xs text-slate-700 dark:text-gray-300 font-medium bg-slate-50 dark:bg-[#15171e] p-3 rounded-lg border border-slate-100 dark:border-gray-700 leading-relaxed">
                Um feed de "notícias" apenas com os relatos textuais de problemas na operation. Possui um filtro de ruído inteligente que oculta automaticamente preenchimentos vazios como "ok", "sem novidades" ou "sem pontos de atenção".
              </div>
            </div>

          </div>
        </div>

        {/* BLOCO 4: REPORTS PRONTOS (MENSAGENS E IMAGENS) */}
        <div className="md:col-span-2 bg-white dark:bg-[#1f232d] p-8 rounded-2xl shadow-sm border border-slate-200 dark:border-gray-800 flex flex-col gap-4">
          <h2 className="text-xl font-black text-[#113366] dark:text-blue-400 uppercase tracking-widest flex items-center gap-2 mb-2 border-b border-slate-100 dark:border-gray-800 pb-4">
            <MessageSquare size={20} /> Reports Prontos (Automação de Reports para o SEA Talk)
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-2">
            <div>
              <p className="text-sm text-slate-700 dark:text-gray-300 font-medium mb-4">
                A aba de <strong>Reports Prontos</strong> (no menu lateral) serve para automatizar o envio de resultados, eliminando cálculos manuais e erros de digitação. Ao selecionar o <em>Hub</em>, a <em>Data</em> e o <em>Turno</em>, o sistema consolida os dados imputados em tempo real.
              </p>
              
              <div className="space-y-4">
                <div className="flex gap-3">
                  <div className="mt-1 bg-blue-100 text-[#113366] p-1.5 rounded-lg shrink-0"><MessageSquare size={16}/></div>
                  <div>
                    <h4 className="text-xs font-black uppercase text-slate-800 dark:text-white">Report Escrito (SEA Talk)</h4>
                    <p className="text-xs text-slate-600 dark:text-gray-400 mt-1">Gera um texto formatado com negritos, emojis e quebras de linha. O SPR é calculado automaticamente, assim como o volume de desvios. Basta clicar em <strong>Copiar Texto</strong> e colar no grupo.</p>
                  </div>
                </div>
                
                <div className="flex gap-3">
                  <div className="mt-1 bg-red-100 text-[#D0011B] p-1.5 rounded-lg shrink-0"><ImageIcon size={16}/></div>
                  <div>
                    <h4 className="text-xs font-black uppercase text-slate-800 dark:text-white">Report Visual (Fleet PNG)</h4>
                    <p className="text-xs text-slate-600 dark:text-gray-400 mt-1">Gera um dashboard espelhado do modelo oficial. Clicando em <strong>Ampliar/Imprimir Gráficos</strong> e depois em <strong>Baixar PNG</strong>, o sistema tira uma foto em alta resolução do painel para envio à gerência.</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-[#15171e] p-4 rounded-xl border border-slate-200 dark:border-gray-700 flex flex-col justify-center">
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
        <div className="md:col-span-2 bg-white dark:bg-[#1f232d] p-8 rounded-2xl shadow-sm border border-slate-200 dark:border-gray-800 flex flex-col gap-4">
          <h2 className="text-xl font-black text-[#113366] dark:text-blue-400 uppercase tracking-widest flex items-center gap-2 mb-2 border-b border-slate-100 dark:border-gray-800 pb-4">
            <Calculator size={20} /> Fórmulas e KPIs (Como o sistema pensa)
          </h2>
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-2">
            
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2"><Info size={16} className="text-[#EE4D2D]"/><h3 className="font-black text-slate-800 dark:text-white text-sm uppercase">Cálculos de SPR</h3></div>
              <p className="text-xs text-slate-500 font-medium mb-2">O SPR (Shipment Per Route) mede a densidade da rota.</p>
              <ul className="text-xs space-y-2 text-slate-700 dark:text-gray-300 font-bold bg-slate-50 dark:bg-[#15171e] p-3 rounded-lg border border-slate-100 dark:border-gray-700">
                <li><span className="text-[#113366] dark:text-blue-400">SPR Rot:</span> Vol. Roteirizado ÷ Total AT Rot.</li>
                <li><span className="text-[#113366] dark:text-blue-400">SPR Proc:</span> Vol. Processado ÷ Rotas Expedidas</li>
                <li><span className="text-[#113366] dark:text-blue-400">SPR Exp:</span> Vol. Expedido ÷ Rotas Expedidas</li>
              </ul>
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2"><Info size={16} className="text-[#EE4D2D]"/><h3 className="font-black text-slate-800 dark:text-white text-sm uppercase">Cálculo de Desvio</h3></div>
              <p className="text-xs text-slate-500 font-medium mb-2">Mede o quanto da carga planejada não saiu.</p>
              <ul className="text-xs space-y-2 text-slate-700 dark:text-gray-300 font-bold bg-slate-50 dark:bg-[#15171e] p-3 rounded-lg border border-slate-100 dark:border-gray-700">
                <li><span className="text-[#113366] dark:text-blue-400">Desvio Absoluto:</span> Vol. Expedido - Vol. Roteirizado</li>
                <li><span className="text-[#113366] dark:text-blue-400">Desvio (%):</span> (Desvio Absoluto ÷ Vol. Roteirizado) × 100</li>
              </ul>
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2"><Info size={16} className="text-[#EE4D2D]"/><h3 className="font-black text-slate-800 dark:text-white text-sm uppercase">Tempo & Atrasos</h3></div>
              <p className="text-xs text-slate-500 font-medium mb-2">Tolerância padrão configurada: 15 minutos.</p>
              <ul className="text-xs space-y-2 text-slate-700 dark:text-gray-300 font-bold bg-slate-50 dark:bg-[#15171e] p-3 rounded-lg border border-slate-100 dark:border-gray-700">
                <li><span className="text-[#113366] dark:text-blue-400">Ritmo (Velocidade):</span> Tempo Total Ops ÷ Total Carregados</li>
                <li><span className="text-[#113366] dark:text-blue-400">Atraso Início:</span> Se (Início Real) for maior que (Setup Início + 15 min)</li>
                <li><span className="text-[#113366] dark:text-blue-400">Atraso Fim:</span> Se (Fim Real) for maior que (Setup Fim + 15 min)</li>
              </ul>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}