/**
 * AvatarSVG — simple but charming character renderer.
 *   <AvatarSVG config={user.avatar} size={120} />
 *
 * config: {
 *   skin: "fair" | "tan" | "deep" | "olive",
 *   bg:   "purple" | "teal" | "amber" | "rose" | "lime" | "sky",
 *   hair: "none" | "short" | "curly" | "long" | "bun" | "buzz",
 *   hairColor: "black" | "brown" | "blonde" | "red" | "white" | "blue",
 *   expression: "smile" | "smirk" | "open" | "thinking",
 *   glasses: "none" | "round" | "square" | "shades",
 *   hat: "none" | "cap" | "beanie" | "wizard",
 * }
 */
const SKIN = { fair: "#F5D6BA", tan: "#D6A57B", deep: "#7C4F2F", olive: "#C9A96E" };
const HAIR = { black: "#1F1F1F", brown: "#5B3A1B", blonde: "#E8C56F", red: "#B14A2A", white: "#E5E5E5", blue: "#3B82F6" };
const BG = {
  purple: ["#7C3AED", "#6D28D9"],
  teal:   ["#14B8A6", "#0D9488"],
  amber:  ["#F59E0B", "#D97706"],
  rose:   ["#F43F5E", "#E11D48"],
  lime:   ["#84CC16", "#65A30D"],
  sky:    ["#0EA5E9", "#0284C7"],
};

export const DEFAULT_AVATAR = {
  skin: "fair",
  bg: "purple",
  hair: "short",
  hairColor: "brown",
  expression: "smile",
  glasses: "none",
  hat: "none",
};

export const AVATAR_OPTIONS = {
  skin: Object.keys(SKIN),
  bg: Object.keys(BG),
  hair: ["none", "short", "curly", "long", "bun", "buzz"],
  hairColor: Object.keys(HAIR),
  expression: ["smile", "smirk", "open", "thinking"],
  glasses: ["none", "round", "square", "shades"],
  hat: ["none", "cap", "beanie", "wizard"],
};

export const AvatarSVG = ({ config = {}, size = 96, ringColor = null }) => {
  const c = { ...DEFAULT_AVATAR, ...config };
  const skin = SKIN[c.skin] || SKIN.fair;
  const hair = HAIR[c.hairColor] || HAIR.brown;
  const [bg1, bg2] = BG[c.bg] || BG.purple;
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className="block"
      style={{ borderRadius: "50%", background: `linear-gradient(135deg, ${bg1}, ${bg2})`, border: ringColor ? `3px solid ${ringColor}` : undefined }}
    >
      {/* shoulders */}
      <ellipse cx="50" cy="98" rx="36" ry="20" fill={skin} />
      {/* shirt */}
      <ellipse cx="50" cy="105" rx="32" ry="18" fill="#E5E7EB" />
      {/* head */}
      <ellipse cx="50" cy="50" rx="24" ry="26" fill={skin} />
      {/* hair styles */}
      <Hair style={c.hair} color={hair} />
      {/* eyes */}
      <Eyes expression={c.expression} />
      {/* mouth */}
      <Mouth expression={c.expression} />
      {/* glasses */}
      <Glasses style={c.glasses} />
      {/* hat */}
      <Hat style={c.hat} />
    </svg>
  );
};

const Hair = ({ style, color }) => {
  if (style === "none" || style === "buzz") {
    if (style === "buzz") return <ellipse cx="50" cy="34" rx="22" ry="6" fill={color} opacity="0.55" />;
    return null;
  }
  if (style === "short") {
    return <path d="M 28 36 Q 50 18 72 36 Q 70 30 50 28 Q 30 30 28 36 Z" fill={color} />;
  }
  if (style === "curly") {
    return (
      <g fill={color}>
        <circle cx="34" cy="32" r="6" />
        <circle cx="44" cy="28" r="7" />
        <circle cx="56" cy="28" r="7" />
        <circle cx="66" cy="32" r="6" />
        <circle cx="40" cy="36" r="5" />
        <circle cx="60" cy="36" r="5" />
      </g>
    );
  }
  if (style === "long") {
    return <path d="M 26 36 Q 30 70 36 80 L 64 80 Q 70 70 74 36 Q 70 22 50 22 Q 30 22 26 36 Z" fill={color} />;
  }
  if (style === "bun") {
    return (
      <>
        <circle cx="50" cy="22" r="9" fill={color} />
        <path d="M 28 36 Q 50 22 72 36 Q 70 30 50 30 Q 30 30 28 36 Z" fill={color} />
      </>
    );
  }
  return null;
};

const Eyes = ({ expression }) => {
  if (expression === "thinking") {
    return (
      <g fill="#1F1F1F">
        <ellipse cx="40" cy="50" rx="2" ry="1" />
        <ellipse cx="60" cy="50" rx="2" ry="1" />
      </g>
    );
  }
  return (
    <g fill="#1F1F1F">
      <circle cx="40" cy="50" r="2.5" />
      <circle cx="60" cy="50" r="2.5" />
    </g>
  );
};

const Mouth = ({ expression }) => {
  if (expression === "smile") {
    return <path d="M 42 62 Q 50 70 58 62" stroke="#1F1F1F" strokeWidth="2.4" strokeLinecap="round" fill="none" />;
  }
  if (expression === "smirk") {
    return <path d="M 42 64 Q 50 68 58 60" stroke="#1F1F1F" strokeWidth="2.4" strokeLinecap="round" fill="none" />;
  }
  if (expression === "open") {
    return <ellipse cx="50" cy="64" rx="4" ry="3" fill="#1F1F1F" />;
  }
  if (expression === "thinking") {
    return <line x1="44" y1="64" x2="56" y2="64" stroke="#1F1F1F" strokeWidth="2.4" strokeLinecap="round" />;
  }
  return null;
};

const Glasses = ({ style }) => {
  if (style === "none") return null;
  const stroke = "#1F1F1F";
  if (style === "round") {
    return (
      <g fill="none" stroke={stroke} strokeWidth="1.8">
        <circle cx="40" cy="50" r="6" />
        <circle cx="60" cy="50" r="6" />
        <line x1="46" y1="50" x2="54" y2="50" />
      </g>
    );
  }
  if (style === "square") {
    return (
      <g fill="none" stroke={stroke} strokeWidth="1.8">
        <rect x="34" y="44" width="12" height="10" rx="1" />
        <rect x="54" y="44" width="12" height="10" rx="1" />
        <line x1="46" y1="49" x2="54" y2="49" />
      </g>
    );
  }
  if (style === "shades") {
    return (
      <g>
        <rect x="33" y="44" width="14" height="10" rx="2" fill="#1F1F1F" />
        <rect x="53" y="44" width="14" height="10" rx="2" fill="#1F1F1F" />
        <line x1="47" y1="49" x2="53" y2="49" stroke="#1F1F1F" strokeWidth="2" />
      </g>
    );
  }
  return null;
};

const Hat = ({ style }) => {
  if (style === "none") return null;
  if (style === "cap") {
    return (
      <g>
        <ellipse cx="50" cy="28" rx="22" ry="6" fill="#2563EB" />
        <rect x="48" y="20" width="20" height="8" rx="2" fill="#2563EB" />
      </g>
    );
  }
  if (style === "beanie") {
    return (
      <g>
        <path d="M 28 32 Q 28 18 50 16 Q 72 18 72 32 Z" fill="#DC2626" />
        <rect x="28" y="30" width="44" height="5" rx="1" fill="#7F1D1D" />
        <circle cx="50" cy="14" r="3" fill="#FCA5A5" />
      </g>
    );
  }
  if (style === "wizard") {
    return (
      <g>
        <path d="M 32 30 L 50 6 L 68 30 Z" fill="#4F46E5" />
        <circle cx="44" cy="22" r="1.4" fill="#FBBF24" />
        <circle cx="56" cy="18" r="1" fill="#FBBF24" />
      </g>
    );
  }
  return null;
};

export default AvatarSVG;
