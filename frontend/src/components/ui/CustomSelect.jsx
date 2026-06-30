import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';

export default function CustomSelect({
    value,
    onChange,
    children,
    className = '',
    style = {},
    disabled = false,
    name,
    id,
    'aria-label': ariaLabel,
    title,
    required
}) {
    const [isOpen, setIsOpen] = useState(false);
    const [dropdownStyles, setDropdownStyles] = useState({});
    const containerRef = useRef(null);
    const dropdownRef = useRef(null);

    // Parse children to options, flattening any arrays
    const options = [];
    React.Children.toArray(children).forEach(child => {
        // Child can be a standard option element or a React Fragment containing options
        if (child && typeof child === 'object') {
            if (child.type === 'option') {
                options.push({
                    value: child.props.value,
                    label: child.props.children,
                    disabled: child.props.disabled
                });
            } else if (child.props && child.props.children) {
                 // Deeply nested options (e.g., inside fragments or arrays mapped out)
                 React.Children.toArray(child.props.children).forEach(subChild => {
                     if (subChild && subChild.type === 'option') {
                         options.push({
                             value: subChild.props.value,
                             label: subChild.props.children,
                             disabled: subChild.props.disabled
                         });
                     }
                 });
            }
        }
    });

    // Determine current label
    const selectedOption = options.find(o => String(o.value) === String(value)) || options[0] || { label: '' };

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (
                containerRef.current && !containerRef.current.contains(e.target) &&
                (!dropdownRef.current || !dropdownRef.current.contains(e.target))
            ) {
                setIsOpen(false);
            }
        };

        const handleScroll = (e) => {
            if (isOpen) {
                if (dropdownRef.current && dropdownRef.current.contains(e.target)) {
                    return;
                }
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            window.addEventListener('scroll', handleScroll, true);
        }
        
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            window.removeEventListener('scroll', handleScroll, true);
        };
    }, [isOpen]);

    useLayoutEffect(() => {
        if (isOpen && containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect();
            
            const spaceBelow = window.innerHeight - rect.bottom;
            const spaceAbove = rect.top;
            
            let topPosition, bottomPosition;
            if (spaceBelow < 260 && spaceAbove > spaceBelow) {
                // Not enough space below (assuming max-height 250px), open upwards
                bottomPosition = window.innerHeight - rect.top + 4;
                topPosition = 'auto';
            } else {
                // Open downwards
                topPosition = rect.bottom + 4;
                bottomPosition = 'auto';
            }
            
            setDropdownStyles({
                position: 'fixed',
                top: topPosition,
                bottom: bottomPosition,
                left: rect.left,
                minWidth: rect.width,
                zIndex: 999999, // Extremely high z-index to escape all modals and sticky headers
                background: 'rgba(20, 20, 25, 0.95)',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '8px',
                padding: '4px',
                boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                maxHeight: '250px',
                overflowY: 'auto'
            });
        }
    }, [isOpen, options.length]);

    const handleSelect = (optionValue) => {
        if (disabled) return;
        if (onChange) {
            // Mimic standard native event object structure expected by most onChange handlers
            onChange({ target: { value: optionValue, name } });
        }
        setIsOpen(false);
    };

    return (
        <div 
            ref={containerRef} 
            className={`custom-select-container ${className}`} 
            style={{ 
                position: 'relative', 
                display: 'inline-flex', 
                alignItems: 'center',
                ...style, 
                opacity: disabled ? 0.5 : 1, 
                cursor: disabled ? 'not-allowed' : 'pointer' 
            }}
            title={title}
            aria-label={ariaLabel}
            id={id}
        >
            <div 
                className="custom-select-trigger"
                onClick={() => !disabled && setIsOpen(!isOpen)}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    width: '100%',
                    height: '100%'
                }}
            >
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {selectedOption.label}
                </span>
                <ChevronDown size={14} style={{ marginLeft: '8px', flexShrink: 0, transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }} />
            </div>

            {isOpen && !disabled && createPortal(
                <div 
                    ref={dropdownRef}
                    className="custom-select-dropdown"
                    style={dropdownStyles}
                >
                    {options.map((opt, i) => (
                        <div 
                            key={i}
                            onClick={() => !opt.disabled && handleSelect(opt.value)}
                            style={{
                                padding: '8px 12px',
                                borderRadius: '4px',
                                cursor: opt.disabled ? 'not-allowed' : 'pointer',
                                background: String(value) === String(opt.value) ? 'rgba(255,255,255,0.1)' : 'transparent',
                                color: opt.disabled ? 'rgba(255,255,255,0.3)' : '#fff',
                                fontSize: '13px',
                                transition: 'background 0.1s',
                                whiteSpace: 'nowrap'
                            }}
                            onMouseEnter={(e) => {
                                if(!opt.disabled && String(value) !== String(opt.value)) {
                                    e.target.style.background = 'rgba(255,255,255,0.05)';
                                }
                            }}
                            onMouseLeave={(e) => {
                                if(!opt.disabled && String(value) !== String(opt.value)) {
                                    e.target.style.background = 'transparent';
                                }
                            }}
                        >
                            {opt.label}
                        </div>
                    ))}
                </div>,
                document.body
            )}
        </div>
    );
}
