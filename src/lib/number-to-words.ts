// Simple number to words converter for French
// Handles integers up to 999
// Does not handle decimals, they need to be handled separately.

const ones = ['', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf'];
const teens = ['dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize', 'dix-sept', 'dix-huit', 'dix-neuf'];
const tens = ['', 'dix', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante', 'soixante-dix', 'quatre-vingt', 'quatre-vingt-dix'];

function convertHundred(n: number): string {
    if (n > 999) return "Nombre trop grand";

    let res = [];

    if (n >= 100) {
        const hundred = Math.floor(n / 100);
        res.push(hundred > 1 ? `${ones[hundred]} cent` : 'cent');
        if (hundred > 1 && (n % 100 === 0)) res.push('s');
        n %= 100;
    }
    
    if (n > 0) {
        if (res.length > 0) res.push(' ');
        
        if (n < 10) {
            res.push(ones[n]);
        } else if (n < 20) {
            res.push(teens[n - 10]);
        } else {
            const ten = Math.floor(n / 10);
            const one = n % 10;

            if (ten === 7 || ten === 9) { // 70s and 90s
                res.push(tens[ten - 1]);
                res.push(one !== 0 ? '-' + teens[one] : '-dix');
            } else {
                res.push(tens[ten]);
                 if(ten === 8 && one === 0) res.push('s');
                if (one > 0) {
                    res.push(one === 1 && ten !== 8 ? ' et ' : '-');
                    res.push(ones[one]);
                }
            }
        }
    }
    
    return res.join('');
}


export function numberToWords(num: number): string {
  if (typeof num !== 'number') return 'zéro';
  if (num === 0) return 'zéro';

  const integerPart = Math.floor(num);
  const decimalPart = Math.round((num - integerPart) * 100);
  
  let result = convertHundred(integerPart);
  
  if (decimalPart > 0) {
    result += ` et ${convertHundred(decimalPart)} centimes`;
  }
  
  return result.trim();
}
