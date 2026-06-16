import React, { useState } from 'react';
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
import {Map, Database, Maximize2} from 'lucide-react';

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
  atExpedidaData,
  recusasData 
}) => {

  // 💡 ESTADO DO SUB-MENU PARA ESTUDOS DE CLUSTER
  const [clusterSubTab, setClusterSubTab] = useState('piso'); // 'piso', 'recusas', 'expedida'

  return (
    <div className="space-y-6">
      
      {/* RESUMO (Apenas o Overview) */}
      {activeCategory === 'resumo' && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <OverviewTable 
            data={data} 
            rawData={rawData} 
            baseData={baseData} 
            firstTripsData={firstTripsData} 
            filtrosGlobais={filtrosGlobais} 
          />
        </div>
      )}

      {/* ONE PAGE (OnePage Unificado + Tabela de Piso) */}
      {activeCategory === 'onePage' && (
        <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <OnePageSPI 
            data={data} 
            rawData={rawData} 
            baseData={baseData} 
            firstTripsData={firstTripsData} 
            filtrosGlobais={filtrosGlobais} 
          />
          <AtPisoDiarioTable 
            data={data} 
            rawData={rawData} 
            atPisoData={atPisoData} 
            filtrosGlobais={filtrosGlobais} 
          />
        </div>
      )}

      {/* GESTÃO DE FROTA */}
      {activeCategory === 'frota' && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <FleetGapCharts baseData={baseData} filtrosGlobais={filtrosGlobais} />
          <FirstTripsChart firstTripsData={firstTripsData} filtrosGlobais={filtrosGlobais} />
          <StatusEvolutionChart historicoFrotaData={historicoFrotaData} filtrosGlobais={filtrosGlobais} />
        </div>
      )}

      {/* SAÚDE DE FROTA */}
      {activeCategory === 'saude' && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
           <FleetHealthCharts 
              rawData={rawData} 
              historicoFrotaData={historicoFrotaData} 
              firstTripsData={firstTripsData}          
              recusasData={recusasData} 
              filtrosGlobais={filtrosGlobais} 
           />
        </div>
      )}

      {/* VOLUMES & SPR */}
      {activeCategory === 'volumes' && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
           <VolumeDispatchCharts data={data} />
        </div>
      )}

      {/* 💡 ESTUDOS DE CLUSTERS (SUB-MENU ESTRATÉGICO) */}
      {activeCategory === 'estudosCluster' && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            
           {/* MINI NAVEGADOR DE ABAS */}
           <div className="flex flex-wrap bg-white dark:bg-[#1f232d] p-1.5 rounded-xl shadow-sm border border-slate-200 dark:border-gray-800 gap-1 w-fit">
              <button 
                onClick={() => setClusterSubTab('piso')} 
                className={`px-5 py-2.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${clusterSubTab === 'piso' ? 'bg-[#113366] text-white shadow-md' : 'text-slate-500 hover:text-[#EE4D2D]'}`}
              >
                Acúmulo (AT no Piso)
              </button>
              <button 
                onClick={() => setClusterSubTab('recusas')} 
                className={`px-5 py-2.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${clusterSubTab === 'recusas' ? 'bg-[#113366] text-white shadow-md' : 'text-slate-500 hover:text-[#EE4D2D]'}`}
              >
                Recusas Operacionais
              </button>
              <button 
                onClick={() => setClusterSubTab('expedida')} 
                className={`px-5 py-2.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${clusterSubTab === 'expedida' ? 'bg-[#113366] text-white shadow-md' : 'text-slate-500 hover:text-[#EE4D2D]'}`}
              >
                Rotas Expedidas
              </button>
           </div>

           {/* 🔥 BANNER DE STORYTELLING PARA A GESTÃO FIXO */}
           <div className="bg-white dark:bg-[#1f232d] p-5 md:p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-gray-800 shrink-0">
             <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 bg-slate-50 dark:bg-[#15171e] p-5 rounded-xl border border-slate-200 dark:border-gray-700">
               
               {/* Pilar 1: Mapas de Calor */}
               <div className="flex gap-3 items-start">
                 <div className="p-2 bg-blue-50 dark:bg-blue-950/30 text-[#113366] dark:text-blue-400 rounded-lg shrink-0">
                   <Map size={16} />
                 </div>
                 <div className="flex flex-col gap-1">
                   <h4 className="text-[11px] font-black text-slate-800 dark:text-white uppercase tracking-wider">Mapas de Calor (Clusters)</h4>
                   <p className="text-[11px] text-slate-500 dark:text-gray-400 font-medium leading-relaxed">
                     Este módulo imersivo detalha as dores e a operação de cada Hub em nível de <strong>Cluster</strong> (Bairros/Regiões). Você pode alternar as abas no topo da tela para visualizar três diferentes matrizes de ofensores.
                   </p>
                 </div>
               </div>

               {/* Pilar 2: Visão do Módulo */}
               <div className="flex gap-3 items-start border-t lg:border-t-0 lg:border-l border-slate-200 dark:border-gray-700 pt-4 lg:pt-0 lg:pl-6">
                 <div className="p-2 bg-orange-50 dark:bg-orange-950/20 text-[#EE4D2D] rounded-lg shrink-0">
                   <Database size={16} />
                 </div>
                 <div className="flex flex-col gap-1">
                   <h4 className="text-[11px] font-black text-slate-800 dark:text-white uppercase tracking-wider">Estrutura de Análise</h4>
                   <ul className="text-[11px] text-slate-500 dark:text-gray-400 font-medium leading-relaxed list-disc pl-4 space-y-1">
                     <li><strong>AT no Piso:</strong> Acúmulo + Ofensores Absolutos.</li>
                     <li><strong>Recusas (Declined):</strong> Insucesso + Ofensores + Motivos de Recusa.</li>
                     <li><strong>Rotas Expedidas:</strong> Volume de Saída + Demandas por Cluster + Proporção de Frota.</li>
                   </ul>
                 </div>
               </div>

               {/* Pilar 3: Interatividade */}
               <div className="flex gap-3 items-start border-t lg:border-t-0 lg:border-l border-slate-200 dark:border-gray-700 pt-4 lg:pt-0 lg:pl-6">
                 <div className="p-2 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 rounded-lg shrink-0">
                   <Maximize2 size={16} />
                 </div>
                 <div className="flex flex-col gap-1">
                   <h4 className="text-[11px] font-black text-slate-800 dark:text-white uppercase tracking-wider">Dicas de Interatividade</h4>
                   <p className="text-[11px] text-slate-500 dark:text-gray-400 font-medium leading-relaxed">
                     Todas as informações podem ser filtradas por <strong>Dia, Semana ou Mês</strong> usando o toggle em cada gráfico. Para evitar poluição visual, todos os Hubs nascem contraídos; basta clicar sobre o nome da Station para expandir e visualizar cada Cluster.
                   </p>
                 </div>
               </div>

             </div>
           </div>

           {/* RENDERIZAÇÃO CONDICIONAL DAS TABELAS */}
           {clusterSubTab === 'piso' && (
             <AtPisoClusterTable atPisoClusterData={atPisoClusterData} filtrosGlobais={filtrosGlobais} />
           )}

           {clusterSubTab === 'recusas' && (
             <RecusasClusterTable recusasData={recusasData} filtrosGlobais={filtrosGlobais} />
           )}

           {clusterSubTab === 'expedida' && (
             <AtExpedidaClusterTable atExpedidaData={atExpedidaData} filtrosGlobais={filtrosGlobais} />
           )}

        </div>
      )}

      {/* GARGALOS & CAP */}
      {activeCategory === 'gargalos' && (
        <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
           <CapFleetCharts data={data} />
        </div>
      )}

      {/* ESTUDOS DE CAPACIDADE */}
      {activeCategory === 'capacidade' && (
        <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
           <EstudosCapacidade 
              consolidadoData={rawData} 
              baseData={baseData} 
           />
        </div>
      )}

      {/* PACOTES E REALOCAÇÃO */}
      {activeCategory === 'pacotes' && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
           <PackagesAndReallocation 
              rawData={rawData} 
              filtrosGlobais={filtrosGlobais} 
           />
        </div>
      )}

      {/* RODÍZIO */}
      {activeCategory === 'rodizio' && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
           <RotationTable filtrosGlobais={filtrosGlobais} />
        </div>
      )}

      {/* TEMPO DE EXPEDIÇÃO */}
      {activeCategory === 'tempo' && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
           <TimeAnalysisCharts data={data} />
        </div>
      )}

      {/* LOGBOOK DE OCORRÊNCIAS (Aba Exclusiva) */}
      {activeCategory === 'ocorrencias' && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
           <AttentionPointsFeed rawData={rawData} filtrosGlobais={filtrosGlobais} />
        </div>
      )}

      {/* MENSAGEM SE NÃO HOUVER DADOS */}
      {(!data || data.length === 0) && !['resumo', 'onePage', 'frota', 'saude', 'pacotes', 'ocorrencias', 'estudosCluster'].includes(activeCategory) && (
        <div className="p-12 text-center font-bold text-slate-400 bg-white dark:bg-[#1f232d] rounded-2xl border border-dashed border-slate-300 dark:border-gray-700">
          Nenhum registro operacional encontrado para os filtros selecionados nesta categoria.
        </div>
      )}

    </div>
  );
};

export default Visualizations;