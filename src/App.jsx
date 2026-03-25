import React, { useState } from 'react';
import { LayoutDashboard, Send, Database, AlertCircle } from 'lucide-react'; 
import Visualizations from './components/Visualizations';
// NOVA IMPORTAÇÃO: Trazemos a tabela de dados
import DataTable from './components/DataTable'; 
import { STATIONS_LIST } from './constants/stations';
import { calcTotals, getStatusColor } from './utils/calculations';
import { sendDataToSheets } from './api/googleSheets';

function App() {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    dataInput: new Date().toISOString().split('T')[0],
    station: '', turno: '', horaInicio: '', horaFim: '',
    totalAtRoteirizado: 0, volRoteirizado: 0, volProcessado: 0, volExpedido: 0,
    ofertUtil: 0, ofertPass: 0, ofertMoto: 0, ofertVan: 0,
    cargUtil: 0, cargPass: 0, cargMoto: 0, cargVan: 0,
    realocPre: 0, realocDur: 0, naoExpCoube: 0, naoExpOutros: 0
  });

  const totals = calcTotals(formData);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await sendDataToSheets(formData);
      alert("Enviado com sucesso!");
    } catch (err) {
      alert("Erro ao enviar.");
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-10 font-sans">
      <header className="max-w-6xl mx-auto mb-8 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 p-2 rounded-lg">
            <LayoutDashboard className="text-white" size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-800 tracking-tight">SPI CONTROL</h1>
            <p className="text-slate-500 uppercase text-[10px] font-bold tracking-[0.2em]">Logistics Intelligence</p>
          </div>
        </div>
        
        <div className="hidden md:flex items-center gap-4 bg-white px-4 py-2 rounded-full border border-slate-200 shadow-sm">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-xs font-bold text-slate-600 uppercase">Sistema Operacional</span>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          <section className="lg:col-span-2 space-y-8">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
              <div className="flex items-center gap-2 mb-6">
                <Database className="text-blue-600" size={20} />
                <h2 className="text-lg font-bold text-slate-800">Entrada de Dados Diários</h2>
              </div>
              
              {/* O seu form continua aqui */}
            </div>
          </section>

          <aside className="space-y-6">
            <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl flex gap-3">
              <AlertCircle className="text-amber-600 shrink-0" />
              <p className="text-xs text-amber-800">
                <strong>Atenção:</strong> Certifique-se de que o turno selecionado corresponde ao horário de início realocado.
              </p>
            </div>
          </aside>
        </div>

        {/* SEÇÃO DE VISUALIZAÇÃO: Gráficos */}
        <Visualizations />

        {/* NOVA SEÇÃO: A Tabela de Dados (Consolidado) */}
        <DataTable />

      </main>
      
      <footer className="max-w-6xl mx-auto mt-12 pb-8 text-center text-slate-400 text-xs">
        © 2026 GESTÃO SPI - Todos os direitos reservados.
      </footer>
    </div>
  );
}

export default App;