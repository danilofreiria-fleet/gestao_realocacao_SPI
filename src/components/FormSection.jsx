import React, { useState, useEffect } from 'react';
import { X, Save, Trash2, AlertTriangle, CalendarDays } from 'lucide-react';

// 🔥 IMPORTANDO A FONTE ÚNICA DE VERDADE
import { MAPA_REGIONAL_COMPLETO, getHubsPermitidos } from '../constants/regionais';

// ===================================================================
// TODOS OS CAMPOS EDITÁVEIS AGORA SÃO OBRIGATÓRIOS
// ===================================================================

export const FORM_FIELDS = [
  // --- GESTÃO BÁSICO ---
  { idx: 3, label: 'Data', type: 'date', span: 'col-span-1' },
  { idx: 4, label: 'Station', type: 'select', options: Object.keys(MAPA_REGIONAL_COMPLETO).sort(), span: 'col-span-2' },
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

  // --- REALOCAÇÃO SOP ---
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

const CAMPOS_OBRIGATORIOS = FORM_FIELDS.filter(field => !field.disabled).map(field => field.idx);

const FormSection = ({
  isOpen,
  mode,
  rowIndex,
  formData,
  onChange,
  onSave,
  onDelete,
  onClose,
  isSaving,
  baseData
}) => {
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [focusedField, setFocusedField] = useState(null);

  const [atPisoConfirmado, setAtPisoConfirmado] = useState(false);
  const [volExpMaiorConfirmado, setVolExpMaiorConfirmado] = useState(false);
  const [semOperacao, setSemOperacao] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setAtPisoConfirmado(false);
      setVolExpMaiorConfirmado(false);
      setSemOperacao(false);
      setShowConfirmDelete(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleClose = () => {
    setShowConfirmDelete(false);
    setFocusedField(null);
    onClose();
  };

  const handleSemOperacaoToggle = (e) => {
    const isChecked = e.target.checked;
    setSemOperacao(isChecked);

    if (isChecked) {
      FORM_FIELDS.forEach(field => {
        if (field.type === 'number') {
          onChange(field.idx, 0);
        }
      });
      
      onChange(41, "Sem Expedição no turno");
      onChange(42, "Sem Expedição no turno");

      const setupIni = formData[8] ? String(formData[8]).substring(0, 5) : "";
      const setupFim = formData[9] ? String(formData[9]).substring(0, 5) : "";
      
      if (setupIni) onChange(6, setupIni);
      if (setupFim) onChange(7, setupFim);
    }
  };

  const volumeAtPiso = Number(formData[19]) || 0;
  const volProc = Number(formData[13]) || 0;
  const volExp = Number(formData[14]) || 0;
  const isVolExpMaior = volExp > volProc;

  const camposFaltando = CAMPOS_OBRIGATORIOS.filter(idx => {
    const valor = formData[idx];
    if (valor === undefined || valor === null) return true;
    if (typeof valor === 'string' && valor.trim() === '') return true;
    return false;
  });

  const camposObrigatoriosPreenchidos = camposFaltando.length === 0;

  const bloqueiaSalvamento =
    !camposObrigatoriosPreenchidos ||
    (volumeAtPiso > 0 && !atPisoConfirmado) ||
    (isVolExpMaior && !volExpMaiorConfirmado);

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-[#1f232d] w-full max-w-5xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
        
        {/* HEADER */}
        <div className="flex justify-between items-center p-6 border-b border-slate-100 dark:border-gray-800">
          <div>
            <h2 className="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tight">
              {mode === 'new' ? 'Adicionar Novo Registro' : `Editar Registro (Linha ${rowIndex})`}
            </h2>
            <p className="text-xs text-slate-500 mt-1 font-bold italic">Todos os campos são obrigatórios.</p>
          </div>
          <button onClick={handleClose} className="text-slate-400 hover:text-red-500 transition-colors">
            <X size={24} />
          </button>
        </div>

        {/* SEM OPERAÇÃO */}
        <div className="px-6 pt-4 pb-2">
          <label className="flex items-center gap-2 cursor-pointer bg-slate-50 hover:bg-slate-100 dark:bg-[#15171e] dark:hover:bg-gray-800 p-3 rounded-lg border border-slate-200 dark:border-gray-700 w-max transition-colors shadow-sm">
            <input
              type="checkbox"
              checked={semOperacao}
              onChange={handleSemOperacaoToggle}
              className="w-4 h-4 text-blue-600 rounded border-gray-300"
            />
            <span className="text-sm font-bold text-[#EE4D2D] dark:text-[#ff6b4a] uppercase tracking-wide">
              Sem operação neste turno
            </span>
          </label>
        </div>

        {/* FORM GRID */}
        <div className="p-6 pt-2 overflow-y-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {FORM_FIELDS.map((field) => {
            let fieldOptions = field.options;
            let isFieldDisabled = field.disabled;

            if (field.idx === 4) {
              const regEscolhida = localStorage.getItem("selectedRegional");
              if (regEscolhida && regEscolhida !== "TODOS") {
                fieldOptions = getHubsPermitidos(regEscolhida).sort();
              } else {
                fieldOptions = Object.keys(MAPA_REGIONAL_COMPLETO).sort();
              }
            }

            if (field.idx === 5) {
              const stationAtual = formData[4];
              if (stationAtual && baseData?.length > 0) {
                const turnosDoHub = baseData
                  .filter(r => String(r[0]).trim() === String(stationAtual).trim())
                  .map(r => String(r[1]).trim())
                  .filter(t => t);

                if (turnosDoHub.length > 0) {
                  fieldOptions = [...new Set(turnosDoHub)];
                } else {
                  fieldOptions = [];
                }
              } else {
                fieldOptions = [];
                isFieldDisabled = true;
              }
            }

            const isObrigatorio = !field.disabled;
            const valorVazio = formData[field.idx] === undefined || formData[field.idx] === null || String(formData[field.idx]).trim() === '';
            const fieldValue = formData[field.idx] != null ? formData[field.idx] : "";

            return (
              <div key={field.idx} className={`flex flex-col relative ${field.span}`}>
                <label className="text-[10px] font-bold text-slate-500 dark:text-gray-400 uppercase mb-1 flex items-center">
                  {field.label}
                  {isObrigatorio && <span className="text-red-500 ml-1 text-xs">*</span>}
                </label>

                {field.type === 'date' ? (
                  <div className="relative w-full">
                    <input
                      type="date"
                      value={fieldValue}
                      onChange={(e) => onChange(field.idx, e.target.value)}
                      disabled={isFieldDisabled}
                      onKeyDown={(e) => e.preventDefault()}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    />
                    <div className={`w-full bg-slate-50 dark:bg-[#15171e] text-slate-800 dark:text-gray-200 border ${isObrigatorio && valorVazio ? 'border-red-400 dark:border-red-700' : 'border-slate-200 dark:border-gray-700'} rounded-lg p-2.5 text-sm flex items-center justify-between transition-colors`}>
                      <span className={fieldValue ? 'font-medium' : 'text-slate-400'}>
                        {fieldValue ? new Date(fieldValue + 'T12:00:00').toLocaleDateString('pt-BR') : 'Selecionar data'}
                      </span>
                      <CalendarDays size={16} className="text-[#113366] dark:text-blue-400" />
                    </div>
                  </div>
                ) : field.type === 'select' ? (
                  <select
                    value={fieldValue}
                    onChange={(e) => onChange(field.idx, e.target.value)}
                    disabled={isFieldDisabled}
                    onFocus={() => setFocusedField(field.idx)}
                    onBlur={() => setFocusedField(null)}
                    className={`bg-slate-50 dark:bg-[#15171e] text-slate-800 dark:text-gray-200 border ${isObrigatorio && valorVazio ? 'border-red-400 dark:border-red-700' : 'border-slate-200 dark:border-gray-700'} rounded-lg p-2 text-sm focus:border-blue-500 outline-none focus:ring-2 focus:ring-blue-500/20 ${isFieldDisabled ? 'opacity-60 cursor-not-allowed' : ''}`}
                  >
                    <option value="">{field.idx === 5 && !formData[4] ? "Selecione a Station..." : "Selecione..."}</option>
                    {fieldOptions?.map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                ) : field.type === 'textarea' ? (
                  <textarea
                    value={fieldValue}
                    onChange={(e) => onChange(field.idx, e.target.value)}
                    disabled={isFieldDisabled}
                    maxLength={3000}
                    onFocus={() => setFocusedField(field.idx)}
                    onBlur={() => setFocusedField(null)}
                    className={`bg-slate-50 dark:bg-[#15171e] text-slate-800 dark:text-gray-200 border ${isObrigatorio && valorVazio ? 'border-red-400 dark:border-red-700' : 'border-slate-200 dark:border-gray-700'} rounded-lg p-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 resize-none h-20`}
                  />
                ) : (
                  <input
                    type={field.type}
                    value={fieldValue}
                    onKeyDown={(e) => {
                      //BLINDA O TECLADO PARA CAMPOS DE NÚMERO
                      if (field.type === 'number') {
                        // Veta espaço, vírgula, ponto, letras e sinais matemáticos
                        if (['e', 'E', '+', '-', '.', ',', ' '].includes(e.key)) {
                          e.preventDefault();
                        }
                      }
                    }}
                    onInput={(e) => {
                     //CASO O USUÁRIO DE "CTRL+V" COM LIXO, LIMPA TUDO QUE NÃO É DÍGITO
                      if (field.type === 'number') {
                        e.target.value = e.target.value.replace(/\D/g, ''); 
                      }
                      
                      // Regra de 3 dígitos pro limite do AT Roteirizado
                      if (field.idx === 11 && e.target.value.length > 3) {
                        e.target.value = e.target.value.slice(0, 3);
                      }
                    }}
                    onChange={(e) => onChange(field.idx, e.target.value)}
                    disabled={isFieldDisabled}
                    onFocus={() => setFocusedField(field.idx)}
                    onBlur={() => setFocusedField(null)}
                    min="0"
                    max={field.idx === 11 ? "999" : undefined}
                    className={`bg-slate-50 dark:bg-[#15171e] text-slate-800 dark:text-gray-200 border ${isObrigatorio && valorVazio ? 'border-red-400 dark:border-red-700' : 'border-slate-200 dark:border-gray-700'} rounded-lg p-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 ${isFieldDisabled ? 'opacity-60 cursor-not-allowed' : ''}`}
                  />
                )}

                {/* ALERTAS */}
                {field.idx === 14 && isVolExpMaior && (
                  <div className="mt-2 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 p-2 rounded-md flex items-start gap-2">
                    <input type="checkbox" checked={volExpMaiorConfirmado} onChange={(e) => setVolExpMaiorConfirmado(e.target.checked)} className="mt-0.5 shrink-0 w-4 h-4 text-orange-600 rounded cursor-pointer" />
                    <span className="text-[9px] font-bold text-orange-700 dark:text-orange-400 uppercase">Confirmo que o Volume Expedido é superior ao Volume Processado.</span>
                  </div>
                )}
                {field.idx === 19 && volumeAtPiso > 0 && (
                  <div className="mt-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-2 rounded-md flex items-start gap-2">
                    <input type="checkbox" checked={atPisoConfirmado} onChange={(e) => setAtPisoConfirmado(e.target.checked)} className="mt-0.5 shrink-0 w-4 h-4 text-red-600 rounded cursor-pointer" />
                    <span className="text-[9px] font-bold text-red-700 dark:text-red-400 uppercase">Confirmo que as AT's no Piso serão expedidas no D+1.</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* FOOTER */}
        <div className="p-6 border-t border-slate-100 dark:border-gray-800 flex justify-between bg-slate-50 dark:bg-[#1f232d] rounded-b-2xl">
          <div>
            {mode === 'edit' && (
              showConfirmDelete ? (
                <div className="flex items-center gap-3 animate-in fade-in slide-in-from-left-2">
                  <span className="text-sm font-bold text-red-500 flex items-center gap-1">
                    <AlertTriangle size={16} /> Tem certeza?
                  </span>
                  <button onClick={() => { onDelete(); setShowConfirmDelete(false); }} className="bg-red-500 hover:bg-red-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold shadow-sm transition-colors">
                    Sim, excluir
                  </button>
                  <button onClick={() => setShowConfirmDelete(false)} className="text-slate-500 hover:text-slate-700 dark:text-gray-400 dark:hover:text-gray-200 text-xs font-bold transition-colors">
                    Cancelar
                  </button>
                </div>
              ) : (
                <button onClick={() => setShowConfirmDelete(true)} className="text-red-500 hover:text-red-600 font-bold text-sm flex items-center gap-2 transition-colors">
                  <Trash2 size={16}/> Excluir Registro
                </button>
              )
            )}
          </div>

          <div className="flex gap-2 items-center">
            <button onClick={handleClose} className="px-4 py-2 font-bold text-slate-500 dark:text-gray-400 hover:text-slate-700 dark:hover:text-gray-200 transition-colors">
              Cancelar
            </button>
            <button
              onClick={() => {
                if (!camposObrigatoriosPreenchidos) {
                  alert(`Preencha todos os campos obrigatórios.\n\nFaltando: ${camposFaltando.join(', ')}`);
                  return;
                }
                if (volumeAtPiso > 0 && !atPisoConfirmado) {
                  alert("Confirme a regra de AT Piso.");
                  return;
                }
                if (isVolExpMaior && !volExpMaiorConfirmado) {
                  alert("Confirme a divergência de Volume Expedido.");
                  return;
                }
                onSave();
              }}
              disabled={isSaving || bloqueiaSalvamento}
              className={`text-white px-6 py-2 rounded-lg font-bold shadow-md flex items-center gap-2 transition-all ${isSaving || bloqueiaSalvamento ? 'bg-slate-400 cursor-not-allowed opacity-70' : 'bg-[#113366] hover:bg-blue-800'}`}
            >
              <Save size={18}/>
              {isSaving ? "Salvando..." : "Salvar Dados Unificados"}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default FormSection;