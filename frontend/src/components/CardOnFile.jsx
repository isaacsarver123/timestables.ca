/**
 * Card-on-file display: "•••• 1234" + brand logo (Visa, Mastercard, Amex,
 * Discover, JCB, Diners, UnionPay) using inline SVG so we don't ship an asset
 * pack. Falls back to a generic "Card" pill if the brand is unknown.
 */
const COLORS = {
  visa: "#1A1F71",
  mastercard: "#EB001B",
  amex: "#2E77BC",
  discover: "#FF6000",
  jcb: "#0E4C96",
  diners: "#0079BE",
  unionpay: "#D10429",
};

const Logo = ({ brand }) => {
  const b = String(brand || "").toLowerCase();
  if (b === "visa") {
    return (
      <svg viewBox="0 0 60 20" className="h-5 w-auto"><text x="0" y="16" fontFamily="Arial, sans-serif" fontWeight="900" fontStyle="italic" fontSize="18" fill={COLORS.visa}>VISA</text></svg>
    );
  }
  if (b === "mastercard") {
    return (
      <svg viewBox="0 0 40 24" className="h-5 w-auto"><circle cx="15" cy="12" r="9" fill="#EB001B" /><circle cx="25" cy="12" r="9" fill="#F79E1B" opacity="0.85" /></svg>
    );
  }
  if (b === "amex" || b === "american express") {
    return (
      <svg viewBox="0 0 60 24" className="h-5 w-auto"><rect width="60" height="24" rx="3" fill={COLORS.amex} /><text x="30" y="17" textAnchor="middle" fontFamily="Arial, sans-serif" fontWeight="900" fontSize="11" fill="#fff">AMEX</text></svg>
    );
  }
  if (b === "discover") {
    return (
      <svg viewBox="0 0 70 24" className="h-5 w-auto"><rect width="70" height="24" rx="3" fill="#fff" stroke="#000" strokeWidth="0.5" /><circle cx="55" cy="12" r="6" fill={COLORS.discover} /><text x="6" y="16" fontFamily="Arial, sans-serif" fontWeight="700" fontSize="9" fill="#000">DISCOVER</text></svg>
    );
  }
  if (b === "jcb") {
    return (
      <svg viewBox="0 0 60 24" className="h-5 w-auto"><rect width="60" height="24" rx="3" fill={COLORS.jcb} /><text x="30" y="17" textAnchor="middle" fontFamily="Arial, sans-serif" fontWeight="900" fontSize="12" fill="#fff">JCB</text></svg>
    );
  }
  if (b === "diners" || b === "diners club") {
    return (
      <svg viewBox="0 0 60 24" className="h-5 w-auto"><rect width="60" height="24" rx="3" fill={COLORS.diners} /><text x="30" y="16" textAnchor="middle" fontFamily="Arial, sans-serif" fontWeight="700" fontSize="8" fill="#fff">Diners</text></svg>
    );
  }
  if (b === "unionpay") {
    return (
      <svg viewBox="0 0 60 24" className="h-5 w-auto"><rect width="60" height="24" rx="3" fill={COLORS.unionpay} /><text x="30" y="17" textAnchor="middle" fontFamily="Arial, sans-serif" fontWeight="900" fontSize="10" fill="#fff">UnionPay</text></svg>
    );
  }
  return (
    <span className="brut-border-soft surface-2 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted">
      {brand || "Card"}
    </span>
  );
};

export const CardOnFile = ({ brand, last4, label = "Card on file", testid = "card-on-file" }) => (
  <div className="flex items-center gap-3 brut-border-soft surface-2 p-3" data-testid={testid}>
    <Logo brand={brand} />
    <div className="min-w-0 flex-1">
      <div className="text-[10px] uppercase tracking-[0.25em] text-muted font-medium">{label}</div>
      <div className="font-mono font-bold text-fg text-base tabular-nums tracking-wider">
        •••• •••• •••• {last4 || "—"}
      </div>
    </div>
  </div>
);

export default CardOnFile;
