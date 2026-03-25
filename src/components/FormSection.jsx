import React, { useState } from 'react';
import { X, Save, Trash2, AlertTriangle } from 'lucide-react';

const MAPA_REGIONAL = {
  "LM Hub_SP_Campinas_São Martinho": "SPI1", "LM Hub_SP_Leme": "SPI1", "LM Hub_SP_Limeira_Campo Belo": "SPI1",
  "LM Hub_SP_Mogi Mirim": "SPI1", "LM Hub_SP_Piracicaba": "SPI1", "LM Hub_SP_Sumaré_Nova Veneza": "SPI1",
  "LM Hub_SP_Campinas_PqCidade": "SPI1", "LM Hub_SP_Araraquara": "SPI2", "LM Hub_SP_Bauru_Centro": "SPI2",
  "LM Hub_SP_Jaú": "SPI2", "LM Hub_SP_Ribeirão Preto_02": "SPI2", "LM Hub_SP_São Carlos": "SPI2",
  "LM Hub_SP_RibeirãoPretoEstação": "SPI2", "LM Hub_SP_Barretos": "SPI3", "LM Hub_SP_Franca_Distrito_Indust": "SPI3",
  "LM Hub_SP_São José do Rio P": "SPI3", "LM Hub_SP_Votuporanga": "SPI3", "LM Hub_SP_Botucatu": "SPI4",
  "LM Hub_SP_Atibaia_Ponte_Alta": "SPI4", "LM Hub_SP_Itapetininga": "SPI4", "LM Hub_SP_Itapeva": "SPI4",
  "LM Hub_SP_Jundiaí": "SPI4", "LM Hub_SP_Sorocaba_Região Norte": "SPI4", "LM Hub_SP_Tatuí": "SPI4",
  "LM Hub_SP_Várzea Paulista": "SPI4", "LM Hub_SP_Araçatuba": "SPI5", "LM Hub_SP_Assis": "SPI5",
  "LM Hub_SP_Marília": "SPI5", "LM Hub_SP_Presidente Prudente": "SPI5"
};

// MAPEAMENTO UNIFICADO (SPI + SOP)
export const FORM_FIELDS = [
  // --- GESTÃO SPI BÁSICO ---
  { idx: 3, label: 'Data', type: 'date', span: 'col-span-1' },                     
  { idx: 4, label: 'Station', type: 'select', options: Object.keys(MAPA_REGIONAL).sort(), span: 'col-span-2' }, 
  { idx: 5, label: 'Turno', type: 'select', options: ['AM', 'PM1', 'PM2'], span: 'col-span-1' }, 
  { idx: 6, label: 'Início (HH:MM)', type: 'time', span: 'col-span-1' },           
  { idx: 7, label: 'Final (HH:MM)', type: 'time', span: 'col-span-1' },

  // --- REFERÊNCIAS (BLOQUEADOS) ---
  { idx: 8, label: 'Setup Início (Ref)', type: 'text', span: 'col-span-1', disabled: true },
  { idx: 9, label: 'Setup Fim (Ref)', type: 'text', span: 'col-span-1', disabled: true },
  { idx: 'capHubVirtual', label: 'CAP Hub Bruto (Ref)', type: 'text', span: 'col-span-1', disabled: true },
  { idx: 'capFleetVirtual', label: 'CAP Fleet Bruto (Ref)', type: 'text', span: 'col-span-1', disabled: true },
  
  // --- VOLUMES ---
  { idx: 11, label: 'Total AT Rot.', type: 'number', span: 'col-span-1' },         
  { idx: 12, label: 'Vol. Rot.', type: 'number', span: 'col-span-1' },             
  { idx: 13, label: 'Vol. Proc.', type: 'number', span: 'col-span-1' },            
  { idx: 14, label: 'Vol. Exp.', type: 'number', span: 'col-span-1' },             

  // --- NOVOS CAMPOS: REALOCAÇÃO SOP (ÍNDICES CORRIGIDOS PARA AZ, BA, BC, BD) ---
  { idx: 51, label: 'Realoc. Pré Exp.', type: 'number', span: 'col-span-1' },        // Coluna AZ
  { idx: 52, label: 'Realoc. Durante Exp.', type: 'number', span: 'col-span-1' },    // Coluna BA
  { idx: 54, label: 'Não Exp. (Não Coube)', type: 'number', span: 'col-span-1' },    // Coluna BC
  { idx: 55, label: 'Não Exp. (Outros)', type: 'number', span: 'col-span-1' },       // Coluna BD
  
  // --- OFERTAS E CARREGADOS ---
  { idx: 19, label: 'AT Piso', type: 'number', span: 'col-span-1' },               
  { idx: 20, label: 'Oferta Util.', type: 'number', span: 'col-span-1' },          
  { idx: 21, label: 'Oferta Pass.', type: 'number', span: 'col-span-1' },          
  { idx: 22, label: 'Oferta Moto', type: 'number', span: 'col-span-1' },           
  { idx: 23, label: 'Oferta Van', type: 'number', span: 'col-span-1' },            
  { idx: 25, label: 'Carreg. Util.', type: 'number', span: 'col-span-1' },         
  { idx: 26, label: 'Carreg. Pass.', type: 'number', span: 'col-span-1' },         
  { idx: 27, label: 'Carreg. Moto', type: 'number', span: 'col-span-1' },          
  { idx: 28, label: 'Carreg. Van', type: 'number', span: 'col-span-1' },           
  
  { idx: 35, label: 'Recusas', type: 'number', span: 'col-span-1' },               
  { idx: 37, label: 'Pac. Rot. Moto', type: 'number', span: 'col-span-1' },        
  { idx: 38, label: 'Pac. Exp. Moto', type: 'number', span: 'col-span-1' },        
  
  { idx: 41, label: 'Pontos de Atenção', type: 'textarea', span: 'col-span-2' },   
  { idx: 42, label: 'Justificativa Desvio', type: 'textarea', span: 'col-span-2' },
];

const FormSection = ({ isOpen, mode, rowIndex, formData, onChange, onSave, onDelete, onClose, isSaving, isDeleting }) => {
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  if (!isOpen) return null;
  const handleClose = () => { setShowConfirmDelete(false); onClose(); };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-[#1f232d] w-full max-w-5xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
        <div className="flex justify-between items-center p-6 border-b border-slate-100 dark:border-gray-800">
          <div>
            <h2 className="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tight">
              {mode === 'new' ? 'Adicionar Novo Registro' : `Editar Registro (Linha ${rowIndex})`}
            </h2>
            <p className="text-xs text-slate-500 mt-1 font-bold italic">Integração Gestão SPI + Realocação SOP ativa.</p>
          </div>
          <button onClick={handleClose} className="text-slate-400 hover:text-red-500 transition-colors"><X size={24} /></button>
        </div>

        <div className="p-6 overflow-y-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {FORM_FIELDS.map((field) => (
            <div key={field.idx} className={`flex flex-col ${field.span}`}>
              <label className="text-[10px] font-bold text-slate-500 dark:text-gray-400 uppercase mb-1">{field.label}</label>
              {field.type === 'select' ? (
                <select value={formData[field.idx] || ""} onChange={(e) => onChange(field.idx, e.target.value)} disabled={field.disabled} className={`bg-slate-50 dark:bg-[#15171e] text-slate-800 dark:text-gray-200 border border-slate-200 dark:border-gray-700 rounded-lg p-2 text-sm focus:border-blue-500 ${field.disabled ? 'opacity-60' : ''}`}><option value="">Selecione...</option>{field.options.map(opt => <option key={opt} value={opt}>{opt}</option>)}</select>
              ) : field.type === 'textarea' ? (
                <textarea 
                  value={formData[field.idx] || ""} 
                  onChange={(e) => onChange(field.idx, e.target.value)} 
                  disabled={field.disabled} 
                  maxLength={300} 
                  className={`bg-slate-50 dark:bg-[#15171e] text-slate-800 dark:text-gray-200 border border-slate-200 dark:border-gray-700 rounded-lg p-2.5 text-sm focus:outline-none focus:border-blue-500 resize-none h-20 ${field.disabled ? 'opacity-60 cursor-not-allowed' : ''}`} 
                />
              ) : (
                <input 
                  type={field.type} 
                  value={formData[field.idx] || ""} 
                  onChange={(e) => onChange(field.idx, e.target.value)} 
                  disabled={field.disabled} 
                  className={`bg-slate-50 dark:bg-[#15171e] text-slate-800 dark:text-gray-200 border border-slate-200 dark:border-gray-700 rounded-lg p-2.5 text-sm focus:outline-none focus:border-blue-500 ${field.disabled ? 'opacity-60 cursor-not-allowed' : ''}`} 
                />
              )}
            </div>
          ))}
        </div>

        <div className="p-6 border-t border-slate-100 flex justify-between bg-slate-50 rounded-b-2xl">
          <div>
            {mode === 'edit' && !showConfirmDelete && (
              <button onClick={() => setShowConfirmDelete(true)} className="text-red-500 font-bold text-sm flex items-center gap-2"><Trash2 size={16}/> Excluir</button>
            )}
            {showConfirmDelete && (
              <div className="flex gap-2 items-center">
                <span className="text-xs font-bold text-red-600">Confirmar?</span>
                <button onClick={onDelete} className="bg-red-500 text-white px-2 py-1 rounded text-xs">Sim</button>
                <button onClick={() => setShowConfirmDelete(false)} className="text-slate-500 text-xs">Não</button>
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={handleClose} className="px-4 py-2 font-bold text-slate-500">Cancelar</button>
            <button onClick={onSave} disabled={isSaving} className="bg-blue-600 text-white px-6 py-2 rounded-lg font-bold shadow-md disabled:opacity-50 flex items-center gap-2"><Save size={18}/> {isSaving ? "Salvando..." : "Salvar Dados Unificados"}</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FormSection;