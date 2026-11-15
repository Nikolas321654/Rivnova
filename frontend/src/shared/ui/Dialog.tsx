import { faXmark } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

type DialogProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: ReactNode;
  footer?: ReactNode;
  dismissible?: boolean;
  closeOnBackdropClick?: boolean;
  size?: 'sm' | 'md' | 'lg';
  media?: ReactNode;
  decoration?: ReactNode;
  headerDivider?: boolean;
  titleClassName?: string;
};

const sizeClasses = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
} as const;

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  dismissible = true,
  closeOnBackdropClick = true,
  size = 'md',
  media,
  decoration,
  headerDivider = true,
  titleClassName = 'text-xl font-semibold text-text-primary',
}: DialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!open || !dialog) return;

    const previousFocus = document.activeElement;
    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;

    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    dialog.showModal();
    if (!dialog.contains(document.activeElement)) dialog.focus();

    return () => {
      dialog.close();
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) {
        previousFocus.focus();
      }
    };
  }, [open]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <dialog
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      tabIndex={-1}
      onCancel={(event) => {
        event.preventDefault();
        if (dismissible) onClose();
      }}
      onClick={(event) => {
        const dialog = dialogRef.current;
        if (!dialog || event.target !== dialog || !dismissible || !closeOnBackdropClick) return;

        const bounds = dialog.getBoundingClientRect();
        const outside =
          event.clientX < bounds.left ||
          event.clientX > bounds.right ||
          event.clientY < bounds.top ||
          event.clientY > bounds.bottom;
        if (outside) onClose();
      }}
      className={`relative m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] overflow-y-auto overflow-x-hidden rounded-card border border-border bg-modal p-0 text-text-primary shadow-xl backdrop:bg-navy/50 focus:outline-none ${sizeClasses[size]}`}
    >
      {decoration}
      <div
        className={`relative flex items-start justify-between gap-4 px-5 sm:px-6 ${headerDivider ? 'border-b border-border py-4' : 'pb-1 pt-5'}`}
      >
        <div className="min-w-0">
          {media && <div className="mb-3">{media}</div>}
          <h2 id={titleId} className={titleClassName}>
            {title}
          </h2>
          {description && (
            <p id={descriptionId} className="mt-2 text-ui-sm text-text-secondary">
              {description}
            </p>
          )}
        </div>
        {dismissible && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="-mr-2 -mt-1 grid size-9 shrink-0 place-items-center rounded-control text-text-secondary transition-colors duration-150 hover:bg-surface-muted hover:text-text-primary focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none"
          >
            <FontAwesomeIcon icon={faXmark} aria-hidden="true" />
          </button>
        )}
      </div>
      {children && <div className="relative px-5 py-5 sm:px-6">{children}</div>}
      {footer && (
        <div className="flex flex-wrap justify-end gap-3 border-t border-border px-5 py-4 sm:px-6">
          {footer}
        </div>
      )}
    </dialog>,
    document.body,
  );
}
