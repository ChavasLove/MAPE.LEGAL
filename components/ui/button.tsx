import { type ButtonHTMLAttributes, forwardRef } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'sm' | 'default' | 'lg';
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = '', variant = 'default', size = 'default', ...props }, ref) => {
    const base = 'inline-flex items-center justify-center font-semibold font-sans transition-colors focus-visible:outline-none disabled:opacity-50 disabled:pointer-events-none cursor-pointer';

    const variants = {
      default: 'bg-primary-950 text-white hover:bg-primary-900',
      outline: 'border border-primary-950 text-primary-950 hover:bg-primary-950/5 bg-transparent',
      ghost:   'text-primary-950 hover:bg-primary-950/5 bg-transparent',
    };

    const sizes = {
      sm:      'h-8 px-4 text-sm rounded-lg',
      default: 'h-10 px-6 py-2.5 text-sm rounded-lg',
      lg:      'h-14 px-8 text-base rounded-lg',
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
