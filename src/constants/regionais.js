import { HUBS_SPI, LISTA_SPI } from './hubsSPI';
import { HUBS_SPM, LISTA_SPM } from './hubsSPM';

// 1. O Mapa Completo do Estado de SP 
export const MAPA_REGIONAL_COMPLETO = { ...HUBS_SPI, ...HUBS_SPM };

// 2. Pega a Regional Logada e Devolve só os Hubs dela
export const getHubsPermitidos = (regEscolhida) => {
  if (regEscolhida === 'SPI' || regEscolhida === 'SPO') return LISTA_SPI;
  if (regEscolhida === 'SPM' || regEscolhida === 'SPC') return LISTA_SPM;
  
  // Se for 'BOTH', retorna o Estado de SP inteiro
  if (regEscolhida === 'BOTH') return [...LISTA_SPI, ...LISTA_SPM]; 
  
  //Se for erro, nulo, ou string não reconhecida, bloqueia o acesso
  return []; 
};

// 3. Pega as siglas da Regional Logada (Ex: SPI1, SPI2, SPC1...)
export const getSubRegionaisPermitidas = (regEscolhida) => {
  const hubs = getHubsPermitidos(regEscolhida);
  const siglas = new Set();
  
  hubs.forEach(hub => {
     if (MAPA_REGIONAL_COMPLETO[hub]) {
       siglas.add(MAPA_REGIONAL_COMPLETO[hub]);
     }
  });
  
  return Array.from(siglas).sort();
};