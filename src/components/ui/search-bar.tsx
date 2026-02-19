'use client';

import * as React from 'react';
import { Search } from 'lucide-react';
import { Input } from './input';
import { cn } from '@/lib/utils';

interface SearchBarProps {
  value?: string;
  onChange?: (value: string) => void;
  onSearch?: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

const SearchBar = React.forwardRef<HTMLInputElement, SearchBarProps>(
  ({ className, onChange, onSearch, value, placeholder = 'Search...', disabled }, ref) => {
    return (
      <div className={cn('relative', className)}>
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={ref}
          className="pl-10"
          placeholder={placeholder}
          value={value}
          disabled={disabled}
          onChange={(e) => {
            onChange?.(e.target.value);
            onSearch?.(e.target.value);
          }}
        />
      </div>
    );
  }
);
SearchBar.displayName = 'SearchBar';

export { SearchBar };
