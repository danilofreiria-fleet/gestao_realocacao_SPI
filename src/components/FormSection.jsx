import React, { useState, useEffect } from 'react';
import { X, Save, Trash2, AlertTriangle, CheckSquare } from 'lucide-react';

const MAPA_REGIONAL = {
"LM Hub_SP_Campinas_São Martinho": "SPI1",  
"LM Hub_SP_Leme": "SPI1",  
"LM Hub_SP_Limeira_Campo Belo": "SPI1",  
"LM Hub_SP_Mogi Mirim": "SPI1",  
"LM Hub_SP_Piracicaba": "SPI1",  
"LM Hub_SP_Sumaré_Nova Veneza": "SPI1",  
"LM Hub_SP_Campinas_PqCidade": "SPI1",  
"LM Hub_SP_Araraquara": "SPO1",  
"LM Hub_SP_Bauru_Centro": "SPO3",  
"LM Hub_SP_Jaú": "SPO1",  
"LM Hub_SP_Ribeirão Preto_02": "SPO1",  
"LM Hub_SP_São Carlos": "SPO1",  
"LM Hub_SP_RibeirãoPretoEstaça": "SPO1",  
"LM Hub_SP_Barretos": "SPO2",  
"LM Hub_SP_Franca_Distrito_Indust": "SPO2",  
"LM Hub_SP_São José do Rio P": "SPO2",  
"LM Hub_SP_Votuporanga": "SPO2",  
"LM Hub_SP_Botucatu": "SPI3",  
"LM Hub_SP_Atibaia_Ponte_Alta": "SPI2",  
"LM Hub_SP_Itapetininga": "SPI3",  
"LM Hub_SP_Itapeva": "SPI3",  
"LM Hub_SP_Jundiaí": "SPI2",  
"LM Hub_SP_Sorocaba_Região Norte": "SPI3",  
"LM Hub_SP_Tatuí": "SPI3",  
"LM Hub_SP_Várzea Paulista": "SPI2",  
"LM Hub_SP_Araçatuba": "SPO2",  
"LM Hub_SP_Assis": "SPO3",  
"LM Hub_SP_Marília": "SPO3",  
"LM Hub_SP_Presidente Prudente": "SPO3"
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

  // --- NOVOS CAMPOS: REALOCAÇÃO SOP ---
  { idx: 51, label: 'Realoc. Pré Exp.', type: 'number', span: 'col-span-1' },        
  { idx: 52, label: 'Realoc. Durante Exp.', type: 'number', span: 'col-span-1' },    
  { idx: 54, label: 'Não Exp. (Não Coube)', type: 'number', span: 'col-span-1' },    
  { idx: 55, label: 'Não Exp. (Outros)', type: 'number', span: 'col-span-1' },       
  
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

const FormSection = ({ isOpen, mode, rowIndex, formData, onChange, onSave, onDelete, onClose, isSaving, isDeleting, baseData }) => {
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  
  // ESTADOS
  const [focusedField, setFocusedField] = useState(null);
  const [atPisoConfirmado, setAtPisoConfirmado] = useState(false);
  
  // 🔥 NOVO ESTADO: Sem operação no turno
  const [semOperacao, setSemOperacao] = useState(false);

  // Reseta as confirmações sempre que o modal for aberto
  useEffect(() => {
    if (isOpen) {
      setAtPisoConfirmado(false);
      setSemOperacao(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;
  
  const handleClose = () => { 
    setShowConfirmDelete(false); 
    setFocusedField(null);
    onClose(); 
  };

  // 🔥 NOVA FUNÇÃO: Preenchimento Automático de Zeros
  const handleSemOperacaoToggle = (e) => {
    const isChecked = e.target.checked;
    setSemOperacao(isChecked);

    if (isChecked) {
      // Varre todos os campos configurados
      FORM_FIELDS.forEach(field => {
        // Se for campo de número, joga 0
        if (field.type === 'number') {
          onChange(field.idx, 0);
        }
      });
      // Preenche o Ponto de Atenção automaticamente
      onChange(41, "Sem Expedição no turno");
    }
  };

  // 🔥 VALIDAÇÕES DE SALVAMENTO
  const volumeAtPiso = Number(formData[19]) || 0;
  
  // Verifica se os 3 campos vitais têm algum valor preenchido
  const camposObrigatoriosPreenchidos = Boolean(formData[3] && formData[4] && formData[5]);
  
  // Bloqueia se a regra do AT Piso for violada OU se faltar campo obrigatório
  const bloqueiaSalvamento = (volumeAtPiso > 0 && !atPisoConfirmado) || !camposObrigatoriosPreenchidos;

  // (Este código substitui do seu 'return (' para baixo)
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

        {/* Checkbox de Sem Operação */}
        <div className="px-6 pt-4 pb-2">
          <label className="flex items-center gap-2 cursor-pointer bg-slate-50 hover:bg-slate-100 dark:bg-[#15171e] dark:hover:bg-gray-800 p-3 rounded-lg border border-slate-200 dark:border-gray-700 w-max transition-colors">
            <input 
              type="checkbox" 
              checked={semOperacao}
              onChange={handleSemOperacaoToggle}
              className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
            />
            <span className="text-sm font-bold text-slate-700 dark:text-gray-300 uppercase tracking-wide">
              Sem operação neste turno
            </span>
          </label>
        </div>

        <div className="p-6 pt-2 overflow-y-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {FORM_FIELDS.map((field) => {
            
            // Lógica do Turno Dinâmico
            let fieldOptions = field.options;
            let isFieldDisabled = field.disabled;

            if (field.idx === 5) { 
              const stationAtual = formData[4];
              if (stationAtual && baseData && baseData.length > 0) {
                const turnosDoHub = baseData
                  .filter(r => String(r[0]).trim() === String(stationAtual).trim())
                  .map(r => String(r[1]).trim())
                  .filter(t => t); 
                if (turnosDoHub.length > 0) {
                  fieldOptions = [...new Set(turnosDoHub)];
                }
              } else {
                fieldOptions = [];
                isFieldDisabled = true;
              }
            }

            const isObrigatorio = [3, 4, 5].includes(field.idx);

            return (
              <div key={field.idx} className={`flex flex-col relative ${field.span}`}>
                <label className="text-[10px] font-bold text-slate-500 dark:text-gray-400 uppercase mb-1 flex items-center">
                  {field.label}
                  {isObrigatorio && <span className="text-red-500 ml-1 text-xs">*</span>}
                </label>
                
                {field.type === 'select' ? (
                  <select 
                    value={formData[field.idx] ?? ""} 
                    onChange={(e) => onChange(field.idx, e.target.value)} 
                    disabled={isFieldDisabled}
                    onFocus={() => setFocusedField(field.idx)}
                    onBlur={() => setFocusedField(null)}
                    className={`bg-slate-50 dark:bg-[#15171e] text-slate-800 dark:text-gray-200 border ${isObrigatorio && !formData[field.idx] ? 'border-red-300 dark:border-red-800/50' : 'border-slate-200 dark:border-gray-700'} rounded-lg p-2 text-sm focus:border-blue-500 ${isFieldDisabled ? 'opacity-60 cursor-not-allowed' : ''}`}
                  >
                    <option value="">
                      {field.idx === 5 && !formData[4] ? "Selecione a Station..." : "Selecione..."}
                    </option>
                    {fieldOptions?.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                ) : field.type === 'textarea' ? (
                  <textarea 
                    value={formData[field.idx] ?? ""} 
                    onChange={(e) => onChange(field.idx, e.target.value)} 
                    disabled={isFieldDisabled} 
                    maxLength={1000}
                    onFocus={() => setFocusedField(field.idx)}
                    onBlur={() => setFocusedField(null)} 
                    className={`bg-slate-50 dark:bg-[#15171e] text-slate-800 dark:text-gray-200 border border-slate-200 dark:border-gray-700 rounded-lg p-2.5 text-sm focus:outline-none focus:border-blue-500 resize-none h-20 ${isFieldDisabled ? 'opacity-60 cursor-not-allowed' : ''}`} 
                  />
                ) : (
                  <input 
                    type={field.type} 
                    value={formData[field.idx] ?? ""} 
                    onChange={(e) => onChange(field.idx, e.target.value)} 
                    disabled={isFieldDisabled}
                    onFocus={() => setFocusedField(field.idx)}
                    onBlur={() => setFocusedField(null)}
                    className={`bg-slate-50 dark:bg-[#15171e] text-slate-800 dark:text-gray-200 border ${isObrigatorio && !formData[field.idx] ? 'border-red-300 dark:border-red-800/50' : 'border-slate-200 dark:border-gray-700'} rounded-lg p-2.5 text-sm focus:outline-none focus:border-blue-500 ${isFieldDisabled ? 'opacity-60 cursor-not-allowed' : ''}`} 
                  />
                )}

                {/* LÓGICA EXCLUSIVA DO AT PISO (Índice 19) */}
                {field.idx === 19 && (
                  <div className="w-full mt-1">
                    {focusedField === 19 && (
                      <div className="absolute z-10 w-[250px] bg-red-600 text-white text-[10px] font-black p-2.5 rounded shadow-xl flex gap-2 items-start animate-in fade-in zoom-in top-full mt-1 left-0 border border-red-700">
                        <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                        <span className="leading-tight">AT's NO PISO SÃO *APENAS* AS ROTAS QUE NÃO FORAM EXPEDIDAS NO D-0 E SERÃO EXPEDIDAS NO D+1</span>
                      </div>
                    )}

                    {volumeAtPiso > 0 && (
                      <div className="mt-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-2 rounded-md flex items-start gap-2 animate-in fade-in">
                        <input
                          type="checkbox"
                          id="confirm-at-piso"
                          checked={atPisoConfirmado}
                          onChange={(e) => setAtPisoConfirmado(e.target.checked)}
                          className="mt-0.5 shrink-0 w-4 h-4 text-red-600 rounded cursor-pointer"
                        />
                        <label htmlFor="confirm-at-piso" className="text-[9px] font-bold text-red-700 dark:text-red-400 leading-tight cursor-pointer uppercase">
                          Você confirma que as AT's no Piso assinaladas só serão expedidas no D+1?
                        </label>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="p-6 border-t border-slate-100 dark:border-gray-800 flex justify-between bg-slate-50 dark:bg-[#1f232d] rounded-b-2xl">
          <div>
            {mode === 'edit' && !showConfirmDelete && (
              <button onClick={() => setShowConfirmDelete(true)} className="text-red-500 font-bold text-sm flex items-center gap-2"><Trash2 size={16}/> Excluir</button>
            )}
            {showConfirmDelete && (
              <div className="flex gap-2 items-center">
                <span className="text-xs font-bold text-red-600">Confirmar?</span>
                <button onClick={onDelete} className="bg-red-500 text-white px-2 py-1 rounded text-xs">Sim</button>
                <button onClick={() => setShowConfirmDelete(false)} className="text-slate-500 dark:text-gray-400 text-xs">Não</button>
              </div>
            )}
          </div>
          <div className="flex gap-2 items-center">
            <button onClick={handleClose} className="px-4 py-2 font-bold text-slate-500 dark:text-gray-400">Cancelar</button>
            
            <div title={!camposObrigatoriosPreenchidos ? "Preencha Data, Station e Turno" : bloqueiaSalvamento ? "Confirme a regra das AT's no Piso para salvar" : ""}>
              
              {/* 🔥 AQUI FICA A NOSSA VALIDAÇÃO EXPRESSA: Ele só chama o 'onSave' se as regras estiverem ok */}
              <button 
                onClick={() => {
                  if (!camposObrigatoriosPreenchidos) {
                    alert("Atenção: Os campos Data, Station e Turno são obrigatórios.");
                    return;
                  }
                  if (volumeAtPiso > 0 && !atPisoConfirmado) {
                    alert("Atenção: Confirme a regra de AT's no Piso marcando a caixinha vermelha.");
                    return;
                  }
                  onSave(); // Se passar, manda pro Pai salvar
                }} 
                disabled={isSaving} 
                className={`text-white px-6 py-2 rounded-lg font-bold shadow-md flex items-center gap-2 transition-all ${
                  isSaving 
                    ? 'bg-slate-400 cursor-wait opacity-70' 
                    : bloqueiaSalvamento 
                      ? 'bg-blue-300 cursor-not-allowed opacity-70' 
                      : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                <Save size={18}/> 
                {isSaving ? "Salvando..." : "Salvar Dados Unificados"}
              </button>

            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FormSection;