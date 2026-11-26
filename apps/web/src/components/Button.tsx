import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Icon } from './Icon';
import type { IconName } from './Icon';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'primary' | 'danger' | 'ghost';
  icon?: IconName;
  /** Shows a busy state and blocks clicks. */
  loading?: boolean;
}
export function Button({
  variant = 'default',
  icon,
  loading = false,
  className,
  children,
  disabled,
  type = 'button',
  ...rest
}: ButtonProps): ReactNode {
  const cls = [
    'gs-btn',
    variant === 'primary' && 'gs-btn--primary',
    variant === 'danger' && 'gs-btn--danger',
    variant === 'ghost' && 'gs-kit-btn--ghost',
    'gs-kit-btn',
    className,
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <button
      {...rest}
      type={type}
      className={cls}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
    >
      {loading ? <span className="gs-kit-spinner" aria-hidden="true" /> : icon ? <Icon name={icon} /> : null}
      {children}
    </button>
  );
}

export interface IconButtonProps extends Omit<ButtonProps, 'children' | 'icon'> {
  icon: IconName;
  /** Required accessible name. Also shown as the native tooltip. */
  label: string;
}
export function IconButton({ icon, label, className, ...rest }: IconButtonProps): ReactNode {
  return (
    <Button
      {...rest}
      aria-label={label}
      title={label}
      className={['gs-kit-iconbtn', className].filter(Boolean).join(' ')}
    >
      <Icon name={icon} />
    </Button>
  );
}
