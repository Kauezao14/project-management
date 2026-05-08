import type { ButtonHTMLAttributes, ReactNode } from 'react'

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md'
  children: ReactNode
}

const variants = {
  primary: 'bg-blue-600 text-white hover:bg-blue-700 border-transparent',
  secondary: 'bg-white text-gray-700 hover:bg-gray-50 border-gray-200',
  ghost: 'bg-transparent text-gray-600 hover:bg-gray-100 border-transparent',
  danger: 'bg-red-600 text-white hover:bg-red-700 border-transparent',
}
const sizes = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2 text-sm',
}

export function Button({ variant = 'primary', size = 'md', children, className = '', ...rest }: Props) {
  return (
    <button
      className={`inline-flex items-center gap-1.5 font-medium rounded-lg border transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${variants[variant]} ${sizes[size]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  )
}
