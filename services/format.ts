export const formatMoney = (amount: number, currency = 'EUR'): string =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency }).format(amount || 0);
