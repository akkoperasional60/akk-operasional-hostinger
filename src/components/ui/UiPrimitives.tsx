import React, { useEffect } from 'react';
import { ChevronDown, ChevronRight, X, PanelLeftClose, PanelLeftOpen } from 'lucide-react';

/**
 * 1. CARDS
 * Small rectangular or square modules that contain different kinds of information
 * in the form of buttons, text, rich media, and metrics.
 */
export interface UiCardProps {
  title?: string;
  subtitle?: string;
  badge?: React.ReactNode;
  headerAction?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  compact?: boolean;
}

export const UiCard: React.FC<UiCardProps> = ({
  title,
  subtitle,
  badge,
  headerAction,
  footer,
  children,
  className = '',
  compact = false
}) => {
  return (
    <div
      className={`bg-slate-900 border border-slate-800 rounded-xl flex flex-col justify-between transition-colors hover:border-slate-700 ${
        compact ? 'p-4' : 'p-5'
      } ${className}`}
    >
      <div>
        {(title || badge || headerAction) && (
          <div className="flex items-start justify-between gap-3 pb-3 mb-3 border-b border-slate-800/80">
            <div className="min-w-0">
              {title && (
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-semibold text-white truncate">{title}</h4>
                  {badge}
                </div>
              )}
              {subtitle && (
                <p className="text-xs text-slate-400 mt-0.5 truncate">{subtitle}</p>
              )}
            </div>
            {headerAction && <div className="shrink-0">{headerAction}</div>}
          </div>
        )}
        <div className="text-xs text-slate-300">{children}</div>
      </div>

      {footer && (
        <div className="pt-3 mt-3 border-t border-slate-800/80 flex items-center justify-between gap-2">
          {footer}
        </div>
      )}
    </div>
  );
};

/**
 * 2. SIDEBAR (Contextual Collapsible Side Panel)
 * Displays a group of navigational or filter actions on the side of a page.
 * Can be visible or tucked away.
 */
export interface UiCollapsibleSidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  title: string;
  badgeCount?: number;
  children: React.ReactNode;
}

export const UiCollapsibleSidebar: React.FC<UiCollapsibleSidebarProps> = ({
  isOpen,
  onToggle,
  title,
  badgeCount,
  children
}) => {
  if (!isOpen) {
    return (
      <div className="shrink-0">
        <button
          type="button"
          onClick={onToggle}
          className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-xs font-semibold text-slate-200 transition cursor-pointer"
          title="Tampilkan Panel Samping"
        >
          <PanelLeftOpen className="w-4 h-4 text-blue-400" />
          <span className="hidden sm:inline">{title}</span>
          {badgeCount !== undefined && badgeCount > 0 && (
            <UiBadge count={badgeCount} variant="blue" />
          )}
        </button>
      </div>
    );
  }

  return (
    <aside className="w-full lg:w-72 shrink-0 bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-4 self-start">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-white">{title}</span>
          {badgeCount !== undefined && badgeCount > 0 && (
            <UiBadge count={badgeCount} variant="blue" />
          )}
        </div>
        <button
          type="button"
          onClick={onToggle}
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          title="Sembunyikan Panel Samping"
        >
          <PanelLeftClose className="w-4 h-4" />
        </button>
      </div>
      <div className="space-y-4">{children}</div>
    </aside>
  );
};

/**
 * 3. WIDGETS
 * Interactive dashboard element with live controls, metrics, or embedded service actions.
 */
export interface UiWidgetProps {
  title: string;
  kicker?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export const UiWidget: React.FC<UiWidgetProps> = ({
  title,
  kicker,
  icon,
  action,
  children,
  className = ''
}) => {
  return (
    <div className={`bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col justify-between gap-3 ${className}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          {icon && (
            <div className="w-8 h-8 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-center text-blue-400 shrink-0">
              {icon}
            </div>
          )}
          <div className="min-w-0">
            {kicker && (
              <div className="text-[11px] text-slate-400 truncate">{kicker}</div>
            )}
            <h3 className="text-xs font-semibold text-white truncate">{title}</h3>
          </div>
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      <div>{children}</div>
    </div>
  );
};

/**
 * 4. POPOVER
 * Behaves like a light modal: blocks user action/scroll in the background
 * and is dismissed immediately with a click outside of itself.
 */
export interface UiPopoverProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export const UiPopover: React.FC<UiPopoverProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  footer
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-[2px] animate-in fade-in duration-150"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 py-3 bg-slate-950 border-b border-slate-800 flex items-center justify-between gap-2">
          <div>
            <h4 className="text-xs font-semibold text-white">{title}</h4>
            {subtitle && <p className="text-[11px] text-slate-400 mt-0.5">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            title="Klik di luar atau tekan tombol ini untuk menutup"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-4 text-xs text-slate-300 space-y-3 max-h-[65vh] overflow-y-auto">
          {children}
        </div>
        {footer ? (
          <div className="px-4 py-2.5 bg-slate-950 border-t border-slate-800 flex items-center justify-end gap-2">
            {footer}
          </div>
        ) : (
          <div className="px-4 py-2 bg-slate-950/60 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
            <span>Klik di luar area popover untuk menutup</span>
            <button
              type="button"
              onClick={onClose}
              className="text-blue-400 hover:text-blue-300 font-semibold cursor-pointer"
            >
              Tutup
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * 5. TOGGLE SWITCH
 * Flip it on or off to choose between two opposite options, like enabling or disabling a feature.
 */
export interface UiToggleSwitchProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  description?: string;
}

export const UiToggleSwitch: React.FC<UiToggleSwitchProps> = ({
  checked,
  onChange,
  label,
  description
}) => {
  return (
    <div
      onClick={() => onChange(!checked)}
      className="flex items-center justify-between gap-3 py-1.5 cursor-pointer select-none group"
    >
      <div className="min-w-0">
        <div className="text-xs font-medium text-slate-200 group-hover:text-white transition-colors">
          {label}
        </div>
        {description && (
          <div className="text-[11px] text-slate-400 leading-tight mt-0.5">
            {description}
          </div>
        )}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={(e) => {
          e.stopPropagation();
          onChange(!checked);
        }}
        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-150 focus:outline-none ${
          checked ? 'bg-blue-600' : 'bg-slate-700'
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-xs transition duration-150 ${
            checked ? 'translate-x-4' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  );
};

/**
 * 6. TEXT FIELDS
 * Boxes where users type in information, with label, leading icon, and clear button.
 */
export interface UiTextFieldProps {
  label?: string;
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  icon?: React.ReactNode;
  helperText?: string;
  type?: 'text' | 'number' | 'email' | 'search';
}

export const UiTextField: React.FC<UiTextFieldProps> = ({
  label,
  value,
  onChange,
  placeholder = '',
  icon,
  helperText,
  type = 'text'
}) => {
  return (
    <div className="space-y-1.5 w-full">
      {label && (
        <label className="block text-xs font-medium text-slate-300">
          {label}
        </label>
      )}
      <div className="relative">
        {icon && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
            {icon}
          </span>
        )}
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`w-full ${
            icon ? 'pl-9' : 'pl-3'
          } pr-8 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors`}
        />
        {value && (
          <button
            type="button"
            onClick={() => onChange('')}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs cursor-pointer"
            title="Bersihkan teks"
          >
            &times;
          </button>
        )}
      </div>
      {helperText && (
        <p className="text-[11px] text-slate-400">{helperText}</p>
      )}
    </div>
  );
};

/**
 * 7. MODAL
 * Pop-up window that grabs attention and requires user interaction before moving on.
 */
export interface UiModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  primaryActionLabel?: string;
  onPrimaryAction?: () => void;
  secondaryActionLabel?: string;
}

export const UiModal: React.FC<UiModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  primaryActionLabel,
  onPrimaryAction,
  secondaryActionLabel = 'Batal'
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-lg bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden">
        <div className="px-5 py-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-white">{title}</h3>
            {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5 text-xs text-slate-300 space-y-4 max-h-[70vh] overflow-y-auto">
          {children}
        </div>
        <div className="px-5 py-3 bg-slate-950 border-t border-slate-800 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition cursor-pointer"
          >
            {secondaryActionLabel}
          </button>
          {primaryActionLabel && onPrimaryAction && (
            <button
              type="button"
              onClick={onPrimaryAction}
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition cursor-pointer"
            >
              {primaryActionLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

/**
 * 8. ACCORDION
 * Organizes lots of information in a neat, stacked format.
 * Expand or collapse sections to view more details without cluttering the screen.
 */
export interface UiAccordionItemProps {
  id: string;
  isExpanded: boolean;
  onToggle: (id: string) => void;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  rightMeta?: React.ReactNode;
  children: React.ReactNode;
}

export const UiAccordionItem: React.FC<UiAccordionItemProps> = ({
  id,
  isExpanded,
  onToggle,
  title,
  subtitle,
  rightMeta,
  children
}) => {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden transition-colors hover:border-slate-700">
      <button
        type="button"
        onClick={() => onToggle(id)}
        aria-expanded={isExpanded}
        className="w-full px-4 py-3 flex items-center justify-between gap-3 text-left cursor-pointer select-none hover:bg-slate-800/40 transition-colors"
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <span className="text-slate-400 shrink-0">
            {isExpanded ? (
              <ChevronDown className="w-4 h-4 text-blue-400" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-semibold text-white truncate">{title}</div>
            {subtitle && <div className="text-[11px] text-slate-400 mt-0.5 truncate">{subtitle}</div>}
          </div>
        </div>
        {rightMeta && <div className="shrink-0 flex items-center gap-3">{rightMeta}</div>}
      </button>

      {isExpanded && (
        <div className="px-4 pb-4 pt-3 border-t border-slate-800/80 bg-slate-950/40 text-xs text-slate-300">
          {children}
        </div>
      )}
    </div>
  );
};

/**
 * 9. BADGE
 * A tiny counter or indicator, like the red/amber/blue bubble that shows unread messages or trip counts.
 */
export interface UiBadgeProps {
  count: number | string;
  variant?: 'red' | 'amber' | 'emerald' | 'blue' | 'slate';
  title?: string;
}

export const UiBadge: React.FC<UiBadgeProps> = ({
  count,
  variant = 'red',
  title
}) => {
  const colorMap: Record<NonNullable<UiBadgeProps['variant']>, string> = {
    red: 'bg-rose-600 text-white',
    amber: 'bg-amber-500 text-slate-950',
    emerald: 'bg-emerald-600 text-white',
    blue: 'bg-blue-600 text-white',
    slate: 'bg-slate-800 text-slate-200 border border-slate-700'
  };

  return (
    <span
      title={title}
      className={`inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full text-[10px] font-bold font-mono tabular-nums leading-none shrink-0 ${colorMap[variant]}`}
    >
      {count}
    </span>
  );
};

/**
 * 10. PROGRESS BAR
 * Visual guide showing how far along you are in completing a task, quota, or rotation threshold.
 */
export interface UiProgressBarProps {
  value: number;
  max: number;
  label?: string;
  valueLabel?: string;
  status?: 'normal' | 'warning' | 'danger' | 'success';
  size?: 'sm' | 'md';
}

export const UiProgressBar: React.FC<UiProgressBarProps> = ({
  value,
  max,
  label,
  valueLabel,
  status = 'normal',
  size = 'sm'
}) => {
  const safeMax = max > 0 ? max : 1;
  const percent = Math.min(100, Math.max(0, Math.round((value / safeMax) * 100)));

  const barColor =
    status === 'danger'
      ? 'bg-rose-500'
      : status === 'warning'
      ? 'bg-amber-500'
      : status === 'success'
      ? 'bg-emerald-500'
      : 'bg-blue-500';

  return (
    <div className="w-full space-y-1">
      {(label || valueLabel) && (
        <div className="flex items-center justify-between gap-2 text-[11px]">
          {label && <span className="text-slate-400 truncate">{label}</span>}
          {valueLabel ? (
            <span className="font-mono tabular-nums font-semibold text-slate-200 shrink-0">
              {valueLabel}
            </span>
          ) : (
            <span className="font-mono tabular-nums font-semibold text-slate-200 shrink-0">
              {percent}%
            </span>
          )}
        </div>
      )}
      <div
        className={`w-full bg-slate-800 rounded-full overflow-hidden ${
          size === 'sm' ? 'h-1.5' : 'h-2.5'
        }`}
      >
        <div
          className={`h-full rounded-full transition-transform duration-200 origin-left ${barColor}`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
};
