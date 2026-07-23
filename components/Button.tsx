import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost';
  fullWidth?: boolean;
  icon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({ 
  children, 
  variant = 'primary', 
  fullWidth = false, 
  className = '', 
  icon,
  type = 'button',
  ...props 
}) => {
  const baseStyles = "inline-flex items-center justify-center px-6 py-3.5 text-sm font-semibold rounded-2xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]";
  
  const variants = {
    primary: "border border-transparent text-white bg-black hover:bg-zinc-800 shadow-lg shadow-zinc-200",
    secondary: "border border-transparent text-black bg-zinc-100 hover:bg-zinc-200",
    outline: "border border-zinc-200 text-zinc-800 bg-white hover:bg-zinc-50 shadow-sm",
    danger: "border border-transparent text-white bg-red-500 hover:bg-red-600 shadow-sm",
    ghost: "text-zinc-500 hover:text-black bg-transparent hover:bg-zinc-100"
  };

  return (
    <button 
      type={type}
      className={`${baseStyles} ${variants[variant]} ${fullWidth ? 'w-full' : ''} ${className}`}
      {...props}
    >
      {icon && <span className="mr-2">{icon}</span>}
      {children}
    </button>
  );
};