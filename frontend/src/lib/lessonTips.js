// 150 lesson tips, served at random on the pre-lesson loading splash.
// Hand-curated; mix of multiplication tricks, mental-math shortcuts,
// number-theory patterns, real-world hooks, and brain-tickling facts.
// Each tip is < 220 chars so it fits comfortably on the splash card.

const TIPS = [
  // ── Times-table tricks (×1–×9) ────────────────────────────────────────
  { kind: "rule",    text: "Anything multiplied by 1 stays itself. The identity rule." },
  { kind: "trick",   text: "Anything × 0 = 0. Doesn't matter how big the number is." },
  { kind: "formula", text: "2 × n = n + n. Just double the number." },
  { kind: "pattern", text: "Every multiple of 2 is even — last digit is 0, 2, 4, 6 or 8." },
  { kind: "trick",   text: "3 × n = 2 × n + n. Double, then add the original." },
  { kind: "rule",    text: "A number is divisible by 3 if its digits add to a multiple of 3." },
  { kind: "trick",   text: "4 × n is just doubling twice. 4 × 7 → 7 → 14 → 28." },
  { kind: "rule",    text: "Divisible by 4 if the last two digits make a multiple of 4." },
  { kind: "pattern", text: "Multiples of 5 always end in 0 or 5. No exceptions." },
  { kind: "trick",   text: "5 × n = (10 × n) ÷ 2. Multiply by ten, then halve." },
  { kind: "trick",   text: "6 × n = 5 × n + n. (6 × 8 = 40 + 8 = 48)" },
  { kind: "rule",    text: "Divisible by 6 only if it's divisible by both 2 and 3." },
  { kind: "anchor",  text: "7 × 7 = 49. 7 × 8 = 56 (\"5, 6, 7, 8\"). Worth memorising." },
  { kind: "trick",   text: "7 × 9 = 63. \"Six, three is seven, nine.\"" },
  { kind: "trick",   text: "8 × n = double, double, double. 8 × 6 → 6 → 12 → 24 → 48." },
  { kind: "formula", text: "8 × n = 10 × n − 2 × n. (8 × 7 = 70 − 14 = 56)" },
  { kind: "formula", text: "9 × n = 10 × n − n. (9 × 7 = 70 − 7 = 63)" },
  { kind: "pattern", text: "For 9 × n (where n ≤ 10), the digits of the answer always add to 9." },
  { kind: "trick",   text: "Finger trick for 9: hold up 10 fingers, fold the n-th, count each side." },
  { kind: "trick",   text: "10 × n = just stick a 0 on the end of n." },

  // ── Times-table tricks (×11–×20) ──────────────────────────────────────
  { kind: "trick",   text: "11 × n (single digit): write n twice. 11 × 4 = 44." },
  { kind: "trick",   text: "11 × ab = a_(a+b)_b. 11 × 23 → 2_5_3 = 253." },
  { kind: "rule",    text: "Divisible by 11 if the alternating digit sum is a multiple of 11." },
  { kind: "formula", text: "12 × n = 10 × n + 2 × n. (12 × 7 = 70 + 14 = 84)" },
  { kind: "anchor",  text: "12 × 12 = 144. The famous 'gross' (a dozen dozen)." },
  { kind: "formula", text: "13 × n = 10 × n + 3 × n. (13 × 6 = 60 + 18 = 78)" },
  { kind: "trick",   text: "14 × n = 7 × n × 2. If your 7s are solid, just double." },
  { kind: "formula", text: "15 × n = (30 × n) ÷ 2. Triple it, then halve." },
  { kind: "trick",   text: "16 × n = 8 × n × 2. Or 4 × n × 4." },
  { kind: "anchor",  text: "17 × 17 = 289. Drill the harder anchors — they pay off." },
  { kind: "trick",   text: "18 × n = 9 × n × 2. Or 20 × n − 2 × n." },
  { kind: "formula", text: "19 × n = 20 × n − n. (19 × 8 = 160 − 8 = 152)" },
  { kind: "trick",   text: "20 × n = double n, then add a zero. 20 × 7 → 14 → 140." },
  { kind: "anchor",  text: "13 × 13 = 169. 14 × 14 = 196. 15 × 15 = 225. 16 × 16 = 256." },
  { kind: "anchor",  text: "25 × 4 = 100 — one of the most useful anchors in mental math." },
  { kind: "anchor",  text: "25 × 25 = 625. Useful when scaling quarters of 100." },

  // ── Mental-math shortcuts ─────────────────────────────────────────────
  { kind: "trick",   text: "Multiplying by 25? Multiply by 100, then divide by 4." },
  { kind: "trick",   text: "Multiplying by 50? Multiply by 100, then halve." },
  { kind: "trick",   text: "Multiplying by 99? Multiply by 100, then subtract the original." },
  { kind: "trick",   text: "Multiplying by 101 (2-digit n)? Just write n twice. 101 × 23 = 2323." },
  { kind: "trick",   text: "Squaring a number ending in 5? a5² = a×(a+1) followed by 25. 35² = 12_25 = 1225." },
  { kind: "trick",   text: "To multiply two close numbers, use (a+b)/2 squared minus the half-difference squared." },
  { kind: "formula", text: "Difference of squares: a² − b² = (a − b)(a + b). 19² − 1² = 18 × 20 = 360." },
  { kind: "trick",   text: "Want to halve an odd number? Halve the even neighbour, add 0.5." },
  { kind: "trick",   text: "Doubling and halving: 16 × 25 = 8 × 50 = 4 × 100 = 400." },
  { kind: "trick",   text: "Break apart: 13 × 47 = 13 × 50 − 13 × 3 = 650 − 39 = 611." },
  { kind: "trick",   text: "Multiply a number by itself: (n − 1)(n + 1) + 1. 12² = 11 × 13 + 1 = 144." },
  { kind: "trick",   text: "Round-and-correct: 47 × 6 ≈ 50 × 6 − 3 × 6 = 300 − 18 = 282." },
  { kind: "rule",    text: "When multiplying by 0.5, you're halving. By 0.25, you're quartering." },
  { kind: "trick",   text: "Multiplying decimals? Ignore the dots, multiply, then count decimal places." },

  // ── Division shortcuts ────────────────────────────────────────────────
  { kind: "rule",    text: "Divisible by 4? Last two digits work as a unit. 932 → '32' is a multiple of 4." },
  { kind: "rule",    text: "Divisible by 5? Ends in 0 or 5." },
  { kind: "rule",    text: "Divisible by 8? Last three digits form a multiple of 8." },
  { kind: "rule",    text: "Divisible by 9? Digit sum is a multiple of 9. (729 → 18 ✓)" },
  { kind: "rule",    text: "Divisible by 12? Must satisfy both 'divisible by 3' and 'divisible by 4'." },
  { kind: "trick",   text: "Dividing by 5? Multiply by 2, then divide by 10. 65 ÷ 5 = 130 ÷ 10 = 13." },
  { kind: "trick",   text: "Dividing by 25? Multiply by 4, then divide by 100." },
  { kind: "trick",   text: "Dividing by 50? Multiply by 2, then divide by 100." },
  { kind: "trick",   text: "Long division is just repeated subtraction wearing a fancier outfit." },

  // ── Patterns & number theory ──────────────────────────────────────────
  { kind: "pattern", text: "Multiplying any whole number by 11 produces a palindrome trick — the digits 'mirror' the addition." },
  { kind: "pattern", text: "The last digit of n × n only ever cycles through {0, 1, 4, 5, 6, 9}." },
  { kind: "pattern", text: "Multiples of 9 in the range 1-90 always have digits that sum to 9." },
  { kind: "pattern", text: "Successive multiples of 12: 12, 24, 36, 48 — last digit cycles 2, 4, 6, 8, 0." },
  { kind: "pattern", text: "The product of two odd numbers is always odd. Even × anything is even." },
  { kind: "pattern", text: "Multiplying a number by 6 and adding the original: 7n. (Useful for 7s.)" },
  { kind: "pattern", text: "Square numbers: 1, 4, 9, 16, 25, 36 — gaps grow by 2 each step (3, 5, 7, 9, 11)." },
  { kind: "pattern", text: "Triangular numbers: 1, 3, 6, 10, 15 — each is one row taller than the last." },
  { kind: "rule",    text: "A prime number > 3 is always one less or one more than a multiple of 6." },
  { kind: "anchor",  text: "12 × 12 = 144 = a 'gross'. 144 × 12 = 1728 = a 'great gross'." },
  { kind: "pattern", text: "Powers of 2: 2, 4, 8, 16, 32, 64, 128, 256, 512, 1024. The CS bedrock." },
  { kind: "pattern", text: "Powers of 3: 3, 9, 27, 81, 243, 729. Triple each time." },
  { kind: "pattern", text: "Powers of 5: 5, 25, 125, 625, 3125. Each is 5× the previous." },
  { kind: "anchor",  text: "1 mile ≈ 1.609 km — multiplying by 1.6 gets you 99% of the way." },
  { kind: "rule",    text: "If a number ends in 0, it's divisible by 10. So also by 2 and 5." },

  // ── Long multiplication / division ────────────────────────────────────
  { kind: "formula", text: "Long mul: 23 × 47 = 23 × 40 + 23 × 7 = 920 + 161 = 1081." },
  { kind: "trick",   text: "Lattice (grid) method: split each factor by place value, fill cells, add diagonals." },
  { kind: "trick",   text: "Partial products: handle each digit pair, then sum. Slower but bulletproof." },
  { kind: "trick",   text: "Long division? 'Divide, multiply, subtract, bring down' — the four-step rhythm." },
  { kind: "trick",   text: "Estimate first. 487 ÷ 12 ≈ 40, then refine. Catches huge mistakes early." },
  { kind: "trick",   text: "Dividing by powers of 10? Just shift the decimal left by that many places." },
  { kind: "trick",   text: "Dividing by 2-digit numbers? Round the divisor up to the nearest 10 to estimate the quotient digit." },

  // ── Real-world hooks ──────────────────────────────────────────────────
  { kind: "anchor",  text: "60 sec × 60 min = 3600 sec/hour. 24 × 3600 = 86,400 sec/day." },
  { kind: "anchor",  text: "365 × 24 = 8760 hours in a non-leap year." },
  { kind: "anchor",  text: "12 inches/foot × 5280 ft/mile = 63,360 inches/mile." },
  { kind: "anchor",  text: "1 dozen eggs × 12 = 144 eggs (a gross). Caterers think in dozens for a reason." },
  { kind: "anchor",  text: "A pizza divided into 8 slices among 3 people: 8 ÷ 3 = 2 slices each, 2 left over." },
  { kind: "anchor",  text: "Tipping 15% on a $40 bill? 10% = $4, half of that = $2, so $6." },
  { kind: "anchor",  text: "Tipping 20% is just doubling 10%. $47 → $4.70 × 2 ≈ $9.40." },
  { kind: "anchor",  text: "Splitting a $84 dinner four ways? 84 ÷ 4 = 21 each." },
  { kind: "anchor",  text: "Marathon: 26.2 miles × 1.609 km/mi ≈ 42.2 km." },
  { kind: "anchor",  text: "A standard deck has 52 cards. 52 ÷ 4 = 13 cards per suit." },
  { kind: "anchor",  text: "A chessboard has 8 × 8 = 64 squares. 32 of each colour." },

  // ── Brain-tickling facts ──────────────────────────────────────────────
  { kind: "trick",   text: "Fact: 111,111,111 × 111,111,111 = 12,345,678,987,654,321. A perfect palindrome." },
  { kind: "trick",   text: "Fact: 142,857 × 1, 2, 3, 4, 5, 6 just rotates the same six digits." },
  { kind: "trick",   text: "Fact: 1089 × 9 = 9801. The reverse." },
  { kind: "trick",   text: "Fact: 12,345,679 × 9 = 111,111,111. The 8 is missing on purpose." },
  { kind: "anchor",  text: "Fact: 1 + 2 + 3 + … + 100 = 5050. Carl Gauss saw it at age 9." },
  { kind: "anchor",  text: "Fact: 9² = 81 and 9³ = 729 — and 8 + 1 = 9, 7 + 2 + 9 = 18 → 1 + 8 = 9." },
  { kind: "anchor",  text: "Fact: e ≈ 2.71828. π ≈ 3.14159. Both irrational, both everywhere." },
  { kind: "anchor",  text: "Fact: φ (the golden ratio) ≈ 1.61803. Show up in art, biology, finance." },
  { kind: "anchor",  text: "Fact: a googol = 10¹⁰⁰. A googolplex = 10^googol. Larger than atoms in the universe." },
  { kind: "anchor",  text: "Fact: only one prime is even — 2. Every other prime is odd." },
  { kind: "anchor",  text: "Fact: 1 is not prime. The definition explicitly excludes it." },
  { kind: "anchor",  text: "Fact: there are infinitely many primes (Euclid proved this around 300 BC)." },

  // ── Mindset / metacognition ───────────────────────────────────────────
  { kind: "trick",   text: "If you're stuck, break the number into pieces you DO know. 17 × 8 = (10 + 7) × 8." },
  { kind: "trick",   text: "Speed comes from recall, not calculation. Drill the small ones until they're free." },
  { kind: "trick",   text: "Whenever you forget a fact, say the answer aloud after looking. It sticks better." },
  { kind: "trick",   text: "Spaced repetition beats cramming. Five minutes a day for two weeks > one big session." },
  { kind: "trick",   text: "When in doubt, estimate first. Big errors get caught instantly." },
  { kind: "rule",    text: "Order of operations: PEMDAS — Parentheses, Exponents, Mul/Div, Add/Sub." },

  // ── Variations & flips ────────────────────────────────────────────────
  { kind: "rule",    text: "Multiplication is commutative: a × b = b × a. Always." },
  { kind: "rule",    text: "Multiplication is associative: (a × b) × c = a × (b × c)." },
  { kind: "rule",    text: "Multiplication distributes over addition: a × (b + c) = a×b + a×c." },
  { kind: "rule",    text: "Division does NOT distribute the same way. 12 ÷ (2 + 4) ≠ 12÷2 + 12÷4." },
  { kind: "trick",   text: "If you can do a × b, you can do b × a. Pick whichever feels easier." },
  { kind: "rule",    text: "0 × n = 0. Always. Even when n is huge." },
  { kind: "rule",    text: "Division by zero is undefined. Not infinity, not 0 — undefined." },

  // ── Speed builders ────────────────────────────────────────────────────
  { kind: "trick",   text: "Combine doubles: 4 × 6 = 2 × (2 × 6) = 2 × 12 = 24. Two doublings beat memorising sometimes." },
  { kind: "trick",   text: "13 × 5 = 65. Anchor — appears in coin counts, time, geometry." },
  { kind: "trick",   text: "14 × 5 = 70. 16 × 5 = 80. 18 × 5 = 90. The five-times of even numbers are easy." },
  { kind: "trick",   text: "17 × 6 = 102. 17 × 7 = 119. 17 × 8 = 136. 17 × 9 = 153. Drill these." },
  { kind: "trick",   text: "Use known to find unknown: 7 × 13 = 7 × 12 + 7 = 84 + 7 = 91." },
  { kind: "trick",   text: "Squaring fast: 19² = 20 × 18 + 1 = 360 + 1 = 361." },

  // ── Long-form fact bombs ──────────────────────────────────────────────
  { kind: "anchor",  text: "Fact: a sheet of paper folded 42 times would reach the moon (in theory)." },
  { kind: "anchor",  text: "Fact: a billion seconds ≈ 31.7 years. A trillion seconds ≈ 31,710 years." },
  { kind: "anchor",  text: "Fact: 12 × 12 × 12 = 1728. The cubic-foot count behind a 'great gross'." },
  { kind: "anchor",  text: "Fact: 21,978 × 4 = 87,912. The reverse. (And there's only ONE 5-digit number with that property.)" },
  { kind: "anchor",  text: "Fact: 2520 is the smallest number divisible by every integer from 1 to 10." },
  { kind: "anchor",  text: "Fact: 1729 is the smallest 'taxicab' number — the smallest number expressible as the sum of two positive cubes in two distinct ways." },
  { kind: "anchor",  text: "Fact: a year has roughly π × 10⁷ seconds. (~31.4 million.)" },
  { kind: "anchor",  text: "Fact: 1, 1, 2, 3, 5, 8, 13, 21 — Fibonacci numbers. Each is the sum of the previous two." },
  { kind: "anchor",  text: "Fact: Fibonacci ratios converge to the golden ratio φ ≈ 1.618." },
  { kind: "anchor",  text: "Fact: 1 light-year ≈ 9.46 × 10¹² km — that's about 9.46 trillion km." },

  // ── Final 30 to round out to 150 ──────────────────────────────────────
  { kind: "trick",   text: "Estimating fast: round both numbers, multiply, then adjust. 47 × 19 ≈ 50 × 20 = 1000, actual 893." },
  { kind: "trick",   text: "Whole-number multiplication can never give you a fraction. If your answer is fractional, redo." },
  { kind: "rule",    text: "An even × odd is always even. Even × even is even. Odd × odd is odd." },
  { kind: "trick",   text: "When stuck on a × b, try (a − 1) × b + b. Build down from a known fact." },
  { kind: "pattern", text: "The 9 times table: 9, 18, 27, 36, 45, 54, 63, 72, 81, 90 — tens digit goes up, ones digit goes down." },
  { kind: "trick",   text: "Remembering 6 × 7? '6 and 7 jumped over 42.' (Or 'sex and seven hopped 42 fences.')" },
  { kind: "trick",   text: "Remembering 7 × 8 = 56? Count: 5, 6, 7, 8 — \"56 is 7 × 8\"." },
  { kind: "trick",   text: "Remembering 6 × 8 = 48? '6 + 8 = 14, but 6 × 8 lands on 48 like a brick.' Drill it." },
  { kind: "anchor",  text: "Anchor: 7² = 49 · 8² = 64 · 9² = 81." },
  { kind: "anchor",  text: "Anchor: 11² = 121 · 12² = 144 · 13² = 169." },
  { kind: "anchor",  text: "Anchor: 14² = 196 · 15² = 225 · 16² = 256." },
  { kind: "anchor",  text: "Anchor: 17² = 289 · 18² = 324 · 19² = 361." },
  { kind: "trick",   text: "Multiplying 2-digit by 2-digit? FOIL: First, Outer, Inner, Last." },
  { kind: "trick",   text: "Want 23 × 17? (20 + 3)(20 − 3) = 400 − 9 = 391." },
  { kind: "rule",    text: "Multiplying by a fraction less than 1 always shrinks the number." },
  { kind: "rule",    text: "Multiplying by a fraction greater than 1 always grows it." },
  { kind: "trick",   text: "Doubling odd numbers? Double the even neighbour, then add or subtract 2." },
  { kind: "anchor",  text: "Useful: 1/8 = 0.125 · 1/4 = 0.25 · 1/3 ≈ 0.333 · 1/2 = 0.5 · 2/3 ≈ 0.667 · 3/4 = 0.75 · 7/8 = 0.875." },
  { kind: "anchor",  text: "Quick percent: 1% = ÷100 · 10% = ÷10 · 25% = ÷4 · 50% = ÷2 · 75% = 3/4." },
  { kind: "trick",   text: "20% off? Take 10%, double it, subtract from original. $89 → $8.90 → $17.80 → $71.20." },
  { kind: "anchor",  text: "Compound interest doubles money roughly every 72 ÷ rate years (Rule of 72). 8% → ~9 yrs." },
  { kind: "trick",   text: "Mental subtraction: round the bottom up, subtract, then add the difference back." },
  { kind: "trick",   text: "Counting change? Count UP from the price, not down from the cash given." },
  { kind: "rule",    text: "Negative × negative = positive. Negative × positive = negative." },
  { kind: "anchor",  text: "Pi facts: π × d = circumference of a circle. π × r² = area." },
  { kind: "anchor",  text: "Sphere volume: (4/3) × π × r³. Surface area: 4 × π × r²." },
  { kind: "trick",   text: "Working out 12.5%? It's 1/8. Just divide by 8." },
  { kind: "trick",   text: "Working out 16.66…%? It's 1/6. Just divide by 6." },
  { kind: "anchor",  text: "Memorise the small ones cold (×2 to ×9, factors 1-12), and 90% of arithmetic feels easy." },
  { kind: "trick",   text: "Trust the algorithm. Long mul/div always works — no need to invent a shortcut every time." },
];

const KIND_LABEL = {
  trick: "Trick",
  formula: "Formula",
  rule: "Rule",
  pattern: "Pattern",
  anchor: "Fact",
};

export function pickRandomTip() {
  const tip = TIPS[Math.floor(Math.random() * TIPS.length)];
  return {
    ...tip,
    kindLabel: KIND_LABEL[tip.kind] || "Tip",
  };
}

export const TIP_COUNT = TIPS.length;
