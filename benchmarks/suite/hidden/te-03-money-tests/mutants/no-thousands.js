const SYMBOLS = { USD: '$', EUR: '€', GBP: '£' };

/** Formats integer cents: 123456 → "$1,234.56", -500 → "-$5.00". */
function formatMoney(cents, currency = 'USD') {
  const symbol = SYMBOLS[currency] ?? `${currency} `;
  const sign = cents < 0 ? '-' : '';
  const absolute = Math.abs(cents);
  const whole = Math.floor(absolute / 100)
    .toString()
;
  const fraction = String(absolute % 100).padStart(2, '0');
  return `${sign}${symbol}${whole}.${fraction}`;
}

module.exports = { formatMoney };
