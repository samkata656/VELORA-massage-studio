export function LogoMark({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <rect width="64" height="64" rx="15" fill="#2E2620" />
      <path d="M16.5 19 L32 47.5 L47.5 19" fill="none" stroke="#D9B27C" strokeWidth="4.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M47.5 19 C48.5 15.2 51.4 12.6 55.6 12 C54.9 16.1 51.9 18.7 47.5 19 Z" fill="#AEB38B" />
    </svg>
  );
}

export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <LogoMark className="h-8 w-8" />
      <span className="font-display text-[1.6rem] leading-none tracking-[0.28em] text-espresso">VELORA</span>
    </span>
  );
}
