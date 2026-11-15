import { useId, type ReactNode } from 'react';

type InsightSectionProps = {
  title: string;
  description?: string;
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
};

export function InsightSection({
  title,
  description,
  aside,
  children,
  className = '',
}: InsightSectionProps) {
  const titleId = useId();
  return (
    <section aria-labelledby={titleId} className={`min-w-0 ${className}`}>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-3">
          <h2 id={titleId} className="type-page-title">
            {title}
          </h2>
          {description && <p className="type-label tabular-nums">{description}</p>}
        </div>
        {aside}
      </div>
      {children}
    </section>
  );
}
