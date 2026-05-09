import { type ButtonHTMLAttributes, forwardRef } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'sm' | 'default' | 'lg';
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = '', variant = 'default', size = 'default', style, ...props }, ref) => {
    const base = 'inline-flex items-center justify-center font-semibold font-sans transition-colors focus-visible:outline-none disabled:opacity-50 disabled:pointer-events-none cursor-pointer';

    const variantStyles: Record<string, React.CSSProperties> = {
      default: { background: 'var(--ink)', color: '#fff' },
      outline: { background: 'transparent', color: 'var(--ink)', border: '1px solid var(--ink)' },
      ghost:   { background: 'transparent', color: 'var(--ink)' },
    };

    const sizes = {
      sm:      'h-8 px-4 text-sm rounded-lg',
      default: 'h-10 px-6 py-2.5 text-sm rounded-lg',
      lg:      'h-14 px-8 text-base rounded-lg',
    };

    return (
      <button
        ref={ref}
        className={`${base} ${sizes[size]} ${className}`}
        style={{ ...variantStyles[variant], ...style }}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';
