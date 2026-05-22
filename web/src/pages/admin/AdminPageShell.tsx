import type { ReactNode } from 'react';
import './AdminPageShell.css';

export interface AdminPageShellProps {
  children: ReactNode;
  header?: ReactNode;
  tabs?: ReactNode;
  className?: string;
  contentClassName?: string;
}

export default function AdminPageShell({
  children,
  header,
  tabs,
  className,
  contentClassName,
}: AdminPageShellProps) {
  const shellClassName = ['admin-page-shell', className].filter(Boolean).join(' ');
  const contentWrapperClassName = ['admin-page-shell__content', contentClassName]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={shellClassName}>
      <div className="admin-page-shell__chrome">
        {header ? <div className="admin-page-shell__header">{header}</div> : null}
        {tabs ? <div className="admin-page-shell__tabs">{tabs}</div> : null}
      </div>
      <div className={contentWrapperClassName}>{children}</div>
    </div>
  );
}