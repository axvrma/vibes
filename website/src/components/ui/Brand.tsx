export function Brand({ className = "" }: { className?: string }) {
  return (
    <a className={`brand ${className}`} href="#home" aria-label="Vibes home">
      <img src="/wordmark.svg" alt="vibes." width="104" height="38" />
    </a>
  );
}
