import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Truck } from 'lucide-react';

export default function RegionalSelection() {
  const navigate = useNavigate();
  // Garante que o que vier da planilha fique limpo e em maiúsculas
  const allowed = String(localStorage.getItem("userRegional") || "").trim().toUpperCase(); 

  // Quando clica, salva 'SPI' ou 'SPM' para o resto do sistema entender qual "metade" carregar
  const selecionar = (reg) => {
    localStorage.setItem("selectedRegional", reg); 
    navigate("/app/tabela");
  };

  // 🔥 AS REGRINHAS MÁGICAS: Verifica qual botão deve acender
  const canAccessSPI = allowed === 'SPI' || allowed === 'SPO' || allowed === 'BOTH';
  const canAccessSPM = allowed === 'SPM' || allowed === 'SPC' || allowed === 'BOTH';

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-6">
      <Truck size={64} className="text-[#EE4D2D] mb-6 animate-bounce" />
      <h2 className="text-2xl font-black text-[#113366] uppercase mb-8">Selecione a sua Regional</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-2xl">
        
        {/* BOTÃO SPI / SPO */}
        <button 
          disabled={!canAccessSPI}
          onClick={() => selecionar('SPI')}
          className={`p-8 rounded-2xl border-2 transition-all flex flex-col items-center gap-4
            ${canAccessSPI 
              ? 'bg-white border-orange-500 hover:shadow-xl cursor-pointer' 
              : 'bg-gray-200 border-gray-300 opacity-50 cursor-not-allowed'}`}
        >
          <span className="text-4xl font-black text-[#113366]">SPI / SPO</span>
          <span className="text-sm font-bold text-slate-400">Interior e Oeste</span>
        </button>

        {/* BOTÃO SPM / SPC */}
        <button 
          disabled={!canAccessSPM}
          onClick={() => selecionar('SPM')}
          className={`p-8 rounded-2xl border-2 transition-all flex flex-col items-center gap-4
            ${canAccessSPM 
              ? 'bg-white border-blue-500 hover:shadow-xl cursor-pointer' 
              : 'bg-gray-200 border-gray-300 opacity-50 cursor-not-allowed'}`}
        >
          <span className="text-4xl font-black text-[#113366]">SPM / SPC</span>
          <span className="text-sm font-bold text-slate-400">Capital e Central</span>
        </button>

      </div>
    </div>
  );
}