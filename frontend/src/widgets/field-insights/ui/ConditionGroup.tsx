import type { ReactNode } from 'react';

type ConditionGroupProps = {
  title: string;
  children: ReactNode;
};

export function ConditionGroup({ title, children }: ConditionGroupProps) {
  return (
    <div className="min-w-0">
      <h3 className="type-section-title">{title}</h3>
      <dl className="mt-2 grid gap-1">{children}</dl>
    </div>
  );
}
