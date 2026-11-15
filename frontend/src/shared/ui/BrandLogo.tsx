import logoUrl from '../../../assets/logos/logo_horizontal.svg?url';
import markUrl from '../../../assets/logos/logo_without_white.svg?url';

export function BrandLogo() {
  return (
    <span className="relative block h-10 w-28 overflow-hidden md:h-16 md:w-48">
      <img
        src={logoUrl}
        alt="Rivnova"
        className="absolute inset-x-0 top-0 w-full max-w-none -translate-y-[32%]"
      />
    </span>
  );
}

export function BrandMark({ className = 'h-10 w-auto' }: { className?: string }) {
  return <img src={markUrl} alt="" aria-hidden="true" className={className} />;
}
