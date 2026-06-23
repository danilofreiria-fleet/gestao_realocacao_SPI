import React, { useState, useEffect } from 'react';
import OverviewTable from './charts/OverviewTable';
import OnePageSPI from './charts/OnePageSPI';
import AtPisoDiarioTable from './charts/AtPisoDiarioTable';
import FleetGapCharts from './charts/FleetGapCharts';
import FirstTripsChart from './charts/FirstTripsChart';
import VolumeDispatchCharts from './charts/VolumeDispatchCharts';
import CapFleetCharts from './charts/CapFleetCharts';
import AttentionPointsFeed from './charts/AttentionPointsFeed';
import StatusEvolutionChart from './charts/StatusEvolutionChart';
import FleetHealthCharts from './charts/FleetHealthCharts';
import PackagesAndReallocation from './charts/PackagesAndReallocation'; 
import RotationTable from './charts/RotationTable';
import TimeAnalysisCharts from './charts/TimeAnalysisCharts';
import AtPisoClusterTable from './charts/AtPisoClusterTable';
import RecusasClusterTable from './charts/RecusasClusterTable'; 
import AtExpedidaClusterTable from './charts/AtExpedidaClusterTable';
import EstudosCapacidade from './charts/EstudosCapacidade';
import { MapPin, Database, Maximize2, Loader2 } from 'lucide-react';

// IMPORT DAS APIs PARA O LAZY LOAD
import { getRecusasData, getAtExpedidaData } from '../api/googleSheets';

// 🔥 CORREÇÃO GLOBAL: Atrelando ao 'window', qualquer gráfico nas suas pastas 
// conseguirá usar o TRADUZ_MES sem gerar erro de escopo não definido.
window.TRADUZ_MES = {
  '01': 'Jan', '02': 'Fev', '03': 'Mar', '04': 'Abr', 
  '05': 'Mai', '06': 'Jun', '07': 'Jul', '08': 'Ago', 
  '09': 'Set', '10': 'Out', '11': 'Nov', '12': 'Dez'
};

const Visualizations = ({ 
  activeCategory, 
  data, 
  rawData, 
  dashData, 
  atPisoData, 
  baseData, 
  firstTripsData, 
  historicoFrotaData,
  ofertasModalData,
  filtrosGlobais,
  atPisoClusterData,
  atExpedidaData: propAtExpedidaData,
  recusasData: propRecusasData 
}) => {

  const [clusterSubTab, setClusterSubTab] = useState('piso'); 

  // =================================================================
  // ESTADOS DO LAZY LOAD (CARGA SOB DEMANDA)
  // =================================================================
  const [lazyRecusas, setLazyRecusas] = useState(propRecusasData || []);
  const [lazyExpedida, setLazyExpedida] = useState(propAtExpedidaData || []);
  const [isLoadingPesados, setIsLoadingPesados] = useState(false);

  // =================================================================
  // MOTOR DE BUSCA SOB DEMANDA DAS BASES PESADAS
  // =================================================================
  useEffect(() => {
    // Só dispara se o usuário entrar em abas que usam esses dados E se os dados ainda não foram baixados
    const precisaBaixar = 
      (activeCategory === 'estudosCluster' || activeCategory === 'saude') && 
      (lazyRecusas.length <= 1 || lazyExpedida.length <= 1);

    if (precisaBaixar) {
      const fetchDadosPesados = async () => {
        setIsLoadingPesados(true);
        try {
          const mesesParaBuscar = new Set();
          
          if (rawData && rawData.length > 0) {
            rawData.forEach(row => {
              let d = row[3];
              if (d && String(d).includes('/')) {
                const [dia, mes, ano] = String(d).split(' ')[0].split('/');
                mesesParaBuscar.add(`${mes.padStart(2, '0')}-${ano.length === 2 ? '20'+ano : ano}`);
              }
            });
          }
          
          if (mesesParaBuscar.size === 0) {
            const hoje = new Date();
            mesesParaBuscar.add(`${String(hoje.getMonth() + 1).padStart(2, '0')}-${hoje.getFullYear()}`);
          }

          const nomesAbasMes = Array.from(mesesParaBuscar).map(mStr => {
             const [m, y] = mStr.split('-');
             return `${['JAN','FEV','MAR','ABR','MAI','JUN','JUL','AGO','SET','OUT','NOV','DEZ'][parseInt(m, 10)-1]}-${y}`;
          });

          const promessasRecusas = Array.from(mesesParaBuscar).map(mStr => {
             const [m, y] = mStr.split('-');
             return getRecusasData(parseInt(m, 10), parseInt(y, 10));
          });
          const promessasExpedidas = nomesAbasMes.map(abaNome => getAtExpedidaData(abaNome));

          const [resultadosRecusas, resultadosExpedidas] = await Promise.all([
             Promise.all(promessasRecusas),
             Promise.all(promessasExpedidas)
          ]);

          let bancoRecusasUnificado = [];
          resultadosRecusas.forEach(res => {
             if (res && res.length > 1) {
               if (bancoRecusasUnificado.length === 0) bancoRecusasUnificado.push(res[0]);
               bancoRecusasUnificado = bancoRecusasUnificado.concat(res.slice(1));
             }
          });
          setLazyRecusas(bancoRecusasUnificado);

          let bancoExpedidasUnificado = [];
          resultadosExpedidas.forEach(res => {
             if (res && res.length > 1) {
               if (bancoExpedidasUnificado.length === 0) bancoExpedidasUnificado.push(res[0]);
               bancoExpedidasUnificado = bancoExpedidasUnificado.concat(res.slice(1));
             }
          });
          setLazyExpedida(bancoExpedidasUnificado);

        } catch (error) {
          console.error("Erro no Lazy Load de Dados Pesados:", error);
        } finally {
          setIsLoadingPesados(false);
        }
      };

      fetchDadosPesados();
    }
  }, [activeCategory, rawData]);

  // Sub-componente de Loading Visual
  const LoadingOverlay = () => (
    <div className="flex flex-col items-center justify-center p-20 border border-dashed border-slate-300 dark:border-gray-700 rounded-2xl bg-slate-50/50 dark:bg-[#1f232d] min-h-[400px]">
       <Loader2 className="w-12 h-12 animate-spin text-[#EE4D2D] mb-4" />
       <p className="font-black text-[#113366] dark:text-white uppercase tracking-widest text-base">Baixando Planilhas de Cluster...</p>
       <p className="text-xs text-slate-500 font-bold mt-2">A Fila do Google está processando o histórico de Recusas e Expedição. Isso pode levar alguns segundos.</p>
    </div>
  );

  return (
    <div className="space-y-6">
      
      {activeCategory === 'resumo' && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <OverviewTable data={data} rawData={rawData} baseData={baseData} firstTripsData={firstTripsData} filtrosGlobais={filtrosGlobais} historicoFrotaData={historicoFrotaData}/>
        </div>
      )}

      {activeCategory === 'onePage' && (
        <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <OnePageSPI data={data} rawData={rawData} baseData={baseData} firstTripsData={firstTripsData} filtrosGlobais={filtrosGlobais} />
          <AtPisoDiarioTable data={data} rawData={rawData} atPisoData={atPisoData} filtrosGlobais={filtrosGlobais} />
        </div>
      )}

      {activeCategory === 'frota' && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <FleetGapCharts baseData={baseData} filtrosGlobais={filtrosGlobais} />
          <FirstTripsChart firstTripsData={firstTripsData} filtrosGlobais={filtrosGlobais} />
          <StatusEvolutionChart historicoFrotaData={historicoFrotaData} filtrosGlobais={filtrosGlobais} />
        </div>
      )}

      {/* SAÚDE DE FROTA (Usa Lazy Load) */}
      {activeCategory === 'saude' && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
           {isLoadingPesados ? <LoadingOverlay /> : (
             <FleetHealthCharts 
                rawData={rawData} 
                historicoFrotaData={historicoFrotaData} 
                firstTripsData={firstTripsData}          
                recusasData={lazyRecusas} // 🔥 Passa a variável local!
                filtrosGlobais={filtrosGlobais} 
             />
           )}
        </div>
      )}

      {activeCategory === 'volumes' && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
           <VolumeDispatchCharts data={data} />
        </div>
      )}

      {/* ESTUDOS DE CLUSTERS (Usa Lazy Load) */}
      {activeCategory === 'estudosCluster' && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
           
           <div className="flex flex-wrap bg-white dark:bg-[#1f232d] p-1.5 rounded-xl shadow-sm border border-slate-200 dark:border-gray-800 gap-1 w-fit">
              <button onClick={() => setClusterSubTab('piso')} className={`px-5 py-2.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${clusterSubTab === 'piso' ? 'bg-[#113366] text-white shadow-md' : 'text-slate-500 hover:text-[#EE4D2D]'}`}>
                Acúmulo (AT no Piso)
              </button>
              <button onClick={() => setClusterSubTab('recusas')} className={`px-5 py-2.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${clusterSubTab === 'recusas' ? 'bg-[#113366] text-white shadow-md' : 'text-slate-500 hover:text-[#EE4D2D]'}`}>
                Recusas Operacionais
              </button>
              <button onClick={() => setClusterSubTab('expedida')} className={`px-5 py-2.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${clusterSubTab === 'expedida' ? 'bg-[#113366] text-white shadow-md' : 'text-slate-500 hover:text-[#EE4D2D]'}`}>
                Rotas Expedidas
              </button>
           </div>

           <div className="bg-white dark:bg-[#1f232d] p-5 md:p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-gray-800 shrink-0">
             <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 bg-slate-50 dark:bg-[#15171e] p-5 rounded-xl border border-slate-200 dark:border-gray-700">
               
               <div className="flex gap-3 items-start">
                 <div className="p-2 bg-blue-50 dark:bg-blue-950/30 text-[#113366] dark:text-blue-400 rounded-lg shrink-0">
                   <MapPin size={16} />
                 </div>
                 <div className="flex flex-col gap-1">
                   <h4 className="text-[11px] font-black text-slate-800 dark:text-white uppercase tracking-wider">Mapas de Calor (Clusters)</h4>
                   <p className="text-[11px] text-slate-500 dark:text-gray-400 font-medium leading-relaxed">
                     Este módulo imersivo detalha as dores e a operação de cada Hub em nível de <strong>Cluster</strong> (Bairros/Regiões). Você pode alternar as abas no topo da tela para visualizar três diferentes matrizes de ofensores.
                   </p>
                 </div>
               </div>

               <div className="flex gap-3 items-start border-t lg:border-t-0 lg:border-l border-slate-200 dark:border-gray-700 pt-4 lg:pt-0 lg:pl-6">
                 <div className="p-2 bg-orange-50 dark:bg-orange-950/20 text-[#EE4D2D] rounded-lg shrink-0">
                   <Database size={16} />
                 </div>
                 <div className="flex flex-col gap-1">
                   <h4 className="text-[11px] font-black text-slate-800 dark:text-white uppercase tracking-wider">Estrutura de Análise</h4>
                   <ul className="text-[11px] text-slate-500 dark:text-gray-400 font-medium leading-relaxed list-disc pl-4 space-y-1">
                     <li><strong>AT no Piso:</strong> Acúmulo + Ofensores Absolutos.</li>
                     <li><strong>Recusas:</strong> Insucesso + Ofensores + Motivos de Recusa.</li>
                     <li><strong>Rotas Expedidas:</strong> Volume de Saída + Demandas por Cluster.</li>
                   </ul>
                 </div>
               </div>

               <div className="flex gap-3 items-start border-t lg:border-t-0 lg:border-l border-slate-200 dark:border-gray-700 pt-4 lg:pt-0 lg:pl-6">
                 <div className="p-2 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 rounded-lg shrink-0">
                   <Maximize2 size={16} />
                 </div>
                 <div className="flex flex-col gap-1">
                   <h4 className="text-[11px] font-black text-slate-800 dark:text-white uppercase tracking-wider">Dicas de Interatividade</h4>
                   <p className="text-[11px] text-slate-500 dark:text-gray-400 font-medium leading-relaxed">
                     Todas as informações podem ser filtradas por <strong>Dia, Semana ou Mês</strong>. Para evitar poluição visual, todos os Hubs nascem contraídos; basta clicar sobre o nome da Station para expandir e visualizar cada Cluster.
                   </p>
                 </div>
               </div>

             </div>
           </div>

           {/*Tabela 1: Não usa Lazy Load */}
           {clusterSubTab === 'piso' && (
             <AtPisoClusterTable atPisoClusterData={atPisoClusterData} filtrosGlobais={filtrosGlobais} />
           )}

           {/*Tabelas 2 e 3: Usam Lazy Load */}
           {clusterSubTab === 'recusas' && (
             isLoadingPesados ? <LoadingOverlay /> : <RecusasClusterTable recusasData={lazyRecusas} filtrosGlobais={filtrosGlobais} />
           )}

           {clusterSubTab === 'expedida' && (
             isLoadingPesados ? <LoadingOverlay /> : <AtExpedidaClusterTable atExpedidaData={lazyExpedida} filtrosGlobais={filtrosGlobais} />
           )}

        </div>
      )}

      {activeCategory === 'gargalos' && (
        <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
           <CapFleetCharts data={data} />
        </div>
      )}

      {activeCategory === 'capacidade' && (
        <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
           <EstudosCapacidade consolidadoData={rawData} baseData={baseData} />
        </div>
      )}

      {activeCategory === 'pacotes' && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
           <PackagesAndReallocation rawData={rawData} filtrosGlobais={filtrosGlobais} />
        </div>
      )}

      {activeCategory === 'rodizio' && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
           <RotationTable filtrosGlobais={filtrosGlobais} />
        </div>
      )}

      {activeCategory === 'tempo' && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
           <TimeAnalysisCharts data={data} />
        </div>
      )}

      {activeCategory === 'ocorrencias' && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
           <AttentionPointsFeed rawData={rawData} filtrosGlobais={filtrosGlobais} />
        </div>
      )}

      {(!data || data.length === 0) && !['resumo', 'onePage', 'frota', 'saude', 'pacotes', 'ocorrencias', 'estudosCluster', 'capacidade'].includes(activeCategory) && (
        <div className="p-12 text-center font-bold text-slate-400 bg-white dark:bg-[#1f232d] rounded-2xl border border-dashed border-slate-300 dark:border-gray-700">
          Nenhum registro operacional encontrado para os filtros selecionados nesta categoria.
        </div>
      )}

    </div>
  );
};

export default Visualizations;