import React from 'react';

interface LogoProps {
  className?: string;
  imgClassName?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
}

export const Logo: React.FC<LogoProps> = ({
  className = '',
  imgClassName = '',
  size = 'md',
  showText = false,
}) => {
  const sizeClasses = {
    sm: 'w-7 h-7',
    md: 'w-9 h-9',
    lg: 'w-12 h-12',
    xl: 'w-16 h-16',
  }[size];

  return (
    <div className={`inline-flex items-center gap-2.5 ${className}`}>
      <img
        src="/logo.png"
        alt="Niraamay"
        className={`${sizeClasses} object-contain rounded-md shrink-0 ${imgClassName}`}
      />
      {showText && (
        <div className="flex flex-col">
          <span className="font-semibold text-slate-900 tracking-tight leading-tight">
            Niraamay
          </span>
          <span className="text-[10px] text-slate-500 font-normal leading-none mt-0.5">
            Bridging India to Smarter Care
          </span>
        </div>
      )}
    </div>
  );
};
