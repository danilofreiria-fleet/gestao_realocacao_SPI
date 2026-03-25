import React, { useState, useEffect } from 'react';
import { Users } from 'lucide-react';
import { getDadosRHDashboard, getDadosAtPiso } from '../api/googleSheets';

import OnePageSPI from './charts/OnePageSPI';
import AtPisoDiarioTable from './charts/AtPisoDiarioTable';
import FleetGapCharts from './charts/FleetGapCharts';
import CapFleetCharts from './charts/CapFleetCharts';
import VolumeDispatchCharts from './charts/VolumeDispatchCharts';
import AtPisoCharts from './charts/AtPisoCharts';

const Visualizations = ({ data, rawData }) => {
  const [dashData, setDashData] = useState([]); 
  const [atPisoData, setAtPisoData] = useState([]); // <-- O estado que estava faltando!
  const [loadingExtra, setLoadingExtra] = useState(true);

  useEffect(() => {
    const carregarDadosExtras = async () => {
      setLoadingExtra(true);
      try {
        const [rhResult, pisoResult] = await Promise.all([
          getDadosRHDashboard(),
          getDadosAtPiso()
        ]);

        if (rhResult) {
           const getTime = (dateStr) => {
             if (!dateStr) return 0;
             let s = String(dateStr).trim().split('T')[0].split(' ')[0];
             if (s.includes('/')) {
               const [d, m, a] = s.split('/');
               return new Date(a, m - 1, d).getTime();
             }
             if (s.includes('-')) {
               const [a, m, d] = s.split('-');
               return new Date(a, m - 1, d).getTime();
             }
             return new Date(s).getTime() || 0;
           };
           const sorted = rhResult.slice(1).sort((a,b) => getTime(b[1]) - getTime(a[1]));
           setDashData(sorted);
        }

        if (pisoResult) {
          setAtPisoData(pisoResult);
        }

      } catch (error) { 
        console.error(error); 
      } finally { 
        setLoadingExtra(false); 
      }
    };
    
    carregarDadosExtras();
  }, []);

  if (loadingExtra) return (
    <div className="p-20 text-center flex flex-col items-center gap-4">
      <Users className="animate-pulse text-[#EE4D2D]" size={48} />
      <p className="font-bold text-slate-500">Cruzando dados operacionais com RH e Malha...</p>
    </div>
  );

  return (
    <div className="space-y-10 pb-10">
      
      <OnePageSPI rawData={rawData} dashData={dashData} />
      
      <AtPisoDiarioTable data={data} rawData={rawData} atPisoData={atPisoData} />
      
      <FleetGapCharts dashData={dashData} />

        {data && data.length > 0 ? (
        <>
          <CapFleetCharts data={data} />
          <VolumeDispatchCharts data={data} />
          <AtPisoCharts data={data} />
        </>
      ) : (
        <div className="p-8 text-center font-bold text-slate-400 bg-white dark:bg-[#1f232d] rounded-2xl border border-slate-200 dark:border-gray-800">
          Nenhum registro operacional para os filtros selecionados.
        </div>
      )}

    </div>
  );
};

export default Visualizations;