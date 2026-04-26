import { type ButtonHTMLAttributes, forwardRef } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'sm' | 'default' | 'lg';
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = '', variant = 'default', size = 'default', ...props }, ref) => {
    const base = 'inline-flex items-center justify-center font-semibold transition-colors focus-visible:outline-none disabled:opacity-50 disabled:pointer-events-none cursor-pointer';

    const variants = {
      default: 'bg-primary-500 text-white hover:bg-primary-600',
      outline: 'border border-white/30 text-white hover:bg-white/10 bg-transparent',
      ghost:   'text-white hover:bg-white/10 bg-transparent',
    };

    const sizes = {
      sm:      'h-8 px-3 text-sm rounded-lg',
      default: 'h-10 px-5 text-sm rounded-xl',
      lg:      'h-14 px-8 text-base rounded-2xl',
    };

    return (
      <button
        ref={ref}
        className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';
