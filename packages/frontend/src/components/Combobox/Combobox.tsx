import React, { useState, useRef, useEffect, useId, useMemo } from 'react';
import { ChevronDown, Check, X, Search } from 'lucide-react';
import { getNextActiveIndex, filterComboboxOptions } from '../../utils/comboboxNavigation.ts';

export interface ComboboxProps<T> {
  options: T[];
  value?: T | null;
  onChange: (selected: T) => void;
  getOptionLabel: (option: T) => string;
  getOptionKey: (option: T) => string;
  renderOption?: (option: T, isSelected: boolean, isActive: boolean) => React.ReactNode;
  placeholder?: string;
  ariaLabel?: string;
  disabled?: boolean;
  className?: string;
}

export function Combobox<T>({
  options,
  value,
  onChange,
  getOptionLabel,
  getOptionKey,
  renderOption,
  placeholder = 'Select option...',
  ariaLabel = 'Select option',
  disabled = false,
  className = '',
}: ComboboxProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(-1);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listboxRef = useRef<HTMLUListElement>(null);
  const listboxId = useId();

  const filteredOptions = useMemo(
    () => filterComboboxOptions(options, searchQuery, getOptionLabel),
    [options, searchQuery, getOptionLabel],
  );

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setActiveIndex(-1);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Scroll active item into view when keyboard navigating
  useEffect(() => {
    if (isOpen && activeIndex >= 0 && listboxRef.current) {
      const activeEl = listboxRef.current.children[activeIndex] as HTMLElement | undefined;
      activeEl?.scrollIntoView({ block: 'nearest' });
    }
  }, [isOpen, activeIndex]);

  const handleSelect = (option: T) => {
    onChange(option);
    setIsOpen(false);
    setSearchQuery('');
    setActiveIndex(-1);
    inputRef.current?.blur();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return;

    switch (e.key) {
      case 'ArrowDown': {
        e.preventDefault();
        if (!isOpen) {
          setIsOpen(true);
          setActiveIndex(0);
        } else {
          setActiveIndex((prev) => getNextActiveIndex(prev, filteredOptions.length, 'next'));
        }
        break;
      }
      case 'ArrowUp': {
        e.preventDefault();
        if (!isOpen) {
          setIsOpen(true);
          setActiveIndex(filteredOptions.length - 1);
        } else {
          setActiveIndex((prev) => getNextActiveIndex(prev, filteredOptions.length, 'prev'));
        }
        break;
      }
      case 'Enter': {
        e.preventDefault();
        if (isOpen && activeIndex >= 0 && filteredOptions[activeIndex]) {
          handleSelect(filteredOptions[activeIndex]!);
        } else if (!isOpen) {
          setIsOpen(true);
        }
        break;
      }
      case 'Escape': {
        e.preventDefault();
        setIsOpen(false);
        setActiveIndex(-1);
        break;
      }
      case 'Tab': {
        setIsOpen(false);
        setActiveIndex(-1);
        break;
      }
    }
  };

  const displayValue = value ? getOptionLabel(value) : '';

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      {/* Combobox Input Trigger */}
      <div className="relative flex items-center">
        <Search className="absolute left-3 w-4 h-4 text-[#FFF8EE]/40 pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-label={ariaLabel}
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          aria-autocomplete="list"
          aria-controls={listboxId}
          aria-activedescendant={
            isOpen && activeIndex >= 0 ? `${listboxId}-option-${activeIndex}` : undefined
          }
          disabled={disabled}
          value={isOpen ? searchQuery : displayValue}
          placeholder={placeholder}
          onFocus={() => {
            setIsOpen(true);
            setSearchQuery('');
          }}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            if (!isOpen) setIsOpen(true);
            setActiveIndex(0);
          }}
          onKeyDown={handleKeyDown}
          className="w-full bg-[#101B2D]/80 border border-white/10 hover:border-white/20 focus:border-[#F4A100]/60 rounded-xl pl-9 pr-16 py-2 text-sm text-[#FFF8EE] placeholder:text-[#FFF8EE]/30 focus:outline-none focus:ring-1 focus:ring-[#F4A100]/30 transition-all font-sans"
        />

        <div className="absolute right-2.5 flex items-center gap-1">
          {isOpen && searchQuery && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setActiveIndex(-1);
                inputRef.current?.focus();
              }}
              aria-label="Clear search input"
              className="text-[#FFF8EE]/40 hover:text-[#FFF8EE] p-1 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            type="button"
            tabIndex={-1}
            onClick={() => {
              if (isOpen) {
                setIsOpen(false);
              } else {
                setIsOpen(true);
                inputRef.current?.focus();
              }
            }}
            aria-label="Toggle options list"
            className="text-[#FFF8EE]/40 hover:text-[#FFF8EE] p-1 transition-colors"
          >
            <ChevronDown
              className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180 text-[#F4A100]' : ''}`}
            />
          </button>
        </div>
      </div>

      {/* Dropdown Options Listbox */}
      {isOpen && (
        <ul
          ref={listboxRef}
          id={listboxId}
          role="listbox"
          aria-label={ariaLabel}
          className="absolute left-0 right-0 top-full mt-1.5 max-h-60 overflow-y-auto basbuddy-scroll bg-[#101B2D] border border-white/20 rounded-xl shadow-2xl z-50 p-1 flex flex-col gap-0.5 animate-in fade-in zoom-in-95 duration-100"
        >
          {filteredOptions.length === 0 ? (
            <li className="py-4 px-3 text-center text-xs text-[#FFF8EE]/40 font-sans">
              No options found
            </li>
          ) : (
            filteredOptions.map((option, idx) => {
              const key = getOptionKey(option);
              const label = getOptionLabel(option);
              const isSelected = value ? getOptionKey(value) === key : false;
              const isActive = activeIndex === idx;

              return (
                <li
                  key={key}
                  id={`${listboxId}-option-${idx}`}
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => handleSelect(option)}
                  onMouseEnter={() => setActiveIndex(idx)}
                  className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs font-sans cursor-pointer transition-colors ${
                    isActive
                      ? 'bg-[#1F7A6C]/40 text-[#FFF8EE]'
                      : isSelected
                        ? 'bg-white/10 text-[#FFF8EE]'
                        : 'text-[#FFF8EE]/80 hover:bg-white/5'
                  }`}
                >
                  <div className="flex-1 min-w-0 pr-2">
                    {renderOption ? (
                      renderOption(option, isSelected, isActive)
                    ) : (
                      <span className="truncate block">{label}</span>
                    )}
                  </div>
                  {isSelected && (
                    <Check className="w-3.5 h-3.5 text-[#F4A100] shrink-0 ml-1.5" />
                  )}
                </li>
              );
            })
          )}
        </ul>
      )}
    </div>
  );
}
