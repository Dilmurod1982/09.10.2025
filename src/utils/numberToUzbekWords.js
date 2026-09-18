// Конвертер чисел в узбекские слова (латиница)
// Пример: 500000 → "besh yuz ming"

const ONES = [
    "",
    "bir",
    "ikki",
    "uch",
    "to'rt",
    "besh",
    "olti",
    "yetti",
    "sakkiz",
    "to'qqiz",
  ];
  
  const TEENS = [
    "o'n",
    "o'n bir",
    "o'n ikki",
    "o'n uch",
    "o'n to'rt",
    "o'n besh",
    "o'n olti",
    "o'n yetti",
    "o'n sakkiz",
    "o'n to'qqiz",
  ];
  
  const TENS = [
    "",
    "",
    "yigirma",
    "o'ttiz",
    "qirq",
    "ellik",
    "oltmish",
    "yetmish",
    "sakson",
    "to'qson",
  ];
  
  function threeDigitToWords(n) {
    let result = "";
    const hundreds = Math.floor(n / 100);
    const rest = n % 100;
  
    if (hundreds) result += ONES[hundreds] + " yuz";
    if (rest >= 10 && rest < 20) {
      result += (result ? " " : "") + TEENS[rest - 10];
    } else if (rest >= 20) {
      const tens = Math.floor(rest / 10);
      const ones = rest % 10;
      result += (result ? " " : "") + TENS[tens];
      if (ones) result += " " + ONES[ones];
    } else if (rest > 0) {
      result += (result ? " " : "") + ONES[rest];
    }
  
    return result;
  }
  
  export function numberToUzbekWords(num) {
    if (num === 0) return "nol";
    if (!num || isNaN(num)) return "";
  
    num = Math.floor(Number(num));
    const parts = [];
  
    const billions = Math.floor(num / 1_000_000_000);
    const millions = Math.floor((num % 1_000_000_000) / 1_000_000);
    const thousands = Math.floor((num % 1_000_000) / 1000);
    const rest = num % 1000;
  
    if (billions) parts.push(threeDigitToWords(billions) + " milliard");
    if (millions) parts.push(threeDigitToWords(millions) + " million");
    if (thousands) parts.push(threeDigitToWords(thousands) + " ming");
    if (rest) parts.push(threeDigitToWords(rest));
  
    return parts.join(" ");
  }