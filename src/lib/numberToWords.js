// Turns 6557500 into "Six Million, Five Hundred and Fifty-Seven
// Thousand, Five Hundred Naira Only" — matching the "AMOUNT IN WORDS"
// line on the sample invoice.

const ONES = [
  "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
  "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
  "Seventeen", "Eighteen", "Nineteen",
];
const TENS = [
  "", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety",
];

function threeDigits(n) {
  let str = "";
  if (n >= 100) {
    str += ONES[Math.floor(n / 100)] + " Hundred";
    n %= 100;
    if (n) str += " and ";
  }
  if (n >= 20) {
    str += TENS[Math.floor(n / 10)];
    if (n % 10) str += "-" + ONES[n % 10];
  } else if (n > 0) {
    str += ONES[n];
  }
  return str;
}

export function numberToWords(num) {
  const whole = Math.round(num);
  if (whole === 0) return "Zero Naira Only";

  const units = [
    { value: 1000000000, label: "Billion" },
    { value: 1000000, label: "Million" },
    { value: 1000, label: "Thousand" },
    { value: 1, label: "" },
  ];

  let remaining = whole;
  const parts = [];
  for (const unit of units) {
    if (remaining >= unit.value) {
      const chunk = Math.floor(remaining / unit.value);
      remaining %= unit.value;
      parts.push(`${threeDigits(chunk)}${unit.label ? " " + unit.label : ""}`);
    }
  }

  return parts.join(", ") + " Naira Only";
}
