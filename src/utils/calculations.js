export const calcTotals = (formData) => {
  const oferta = Number(formData.ofertUtil) + Number(formData.ofertPass) + Number(formData.ofertMoto) + Number(formData.ofertVan);
  const carregado = Number(formData.cargUtil) + Number(formData.cargPass) + Number(formData.cargMoto) + Number(formData.cargVan);
  
  return {
    ofertaTotal: oferta,
    carregadoTotal: carregado,
    dispensaTotal: oferta - carregado,
    eficiencia: formData.volProcessado > 0 ? (formData.volExpedido / formData.volProcessado) * 100 : 0
  };
};

export const getStatusColor = (valor) => {
  if (valor > 0) return 'text-red-500'; // Sobra de carro (dispensa)
  if (valor < 0) return 'text-yellow-500'; // Faltou carro
  return 'text-green-500'; // Zerado
};