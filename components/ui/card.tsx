import { type HTMLAttributes } from 'react';

export function Card({ className = '', style, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`rounded-xl shadow-sm overflow-hidden ${className}`}
      style={{ background: 'var(--bg)', border: '1px solid var(--border)', ...style }}
      {...props}
    />
  );
}

export function CardHeader({ className = '', ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={`p-6 pb-4 ${className}`} {...props} />;
}

export function CardTitle({ className = '', style, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={`text-xl font-semibold ${className}`}
      style={{ color: 'var(--ink)', fontFamily: 'var(--font-display)', ...style }}
      {...props}
    />
  );
}

export function CardContent({ className = '', ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={`p-6 pt-2 ${className}`} {...props} />;
}
