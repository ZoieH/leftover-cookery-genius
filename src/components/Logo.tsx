import React from 'react';
import { cn } from '@/lib/utils';

interface LogoProps {
  className?: string;
}

const Logo: React.FC<LogoProps> = ({ className }) => {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <img 
        src="/logo-lefto.png" 
        alt="Lefto - AI Recipe Generator" 
        className="h-8 w-auto"
      />
    </div>
  );
};

export default Logo;
