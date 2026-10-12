const { normalizeIndianPhone } = require('./dist/utils/phoneNormalizer');

console.log('normalizeIndianPhone("918800957178") =', normalizeIndianPhone('918800957178'));
console.log('normalizeIndianPhone("+918800957178") =', normalizeIndianPhone('+918800957178'));
console.log('normalizeIndianPhone("8800957178") =', normalizeIndianPhone('8800957178'));
