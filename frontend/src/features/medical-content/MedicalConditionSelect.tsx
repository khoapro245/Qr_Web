import { Check, ChevronDown, Search, X } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { Badge } from '../../components/ui/Badge';
import { MedicalIcon } from './icon-map';
import { useMedicalConditions } from './medical-content.storage';
import type { DiseaseSeverity } from './medical-content.types';

const SEVERITY_CONFIG: Record<
  DiseaseSeverity,
  { label: string; tone: 'danger' | 'info' | 'neutral' }
> = {
  critical: { label: 'Nguy kịch', tone: 'danger' },
  high: { label: 'Cực kỳ nguy hiểm', tone: 'danger' },
  medium: { label: 'Cần xử lý ngay', tone: 'info' },
  low: { label: 'Theo dõi', tone: 'neutral' },
};

interface MedicalConditionSelectProps {
  value: string;
  onChange: (conditionId: string) => void;
  label?: string;
  hint?: string;
  error?: string;
}

export function MedicalConditionSelect({
  value,
  onChange,
  label = 'Bệnh lý nền / Tình trạng sức khỏe đi kèm',
  hint = 'Khi người khác quét mã QR áo và mở Cẩm nang sơ cứu, hệ thống sẽ tự động hiển thị hướng dẫn sơ cứu cho bệnh này.',
  error,
}: MedicalConditionSelectProps) {
  const id = useId();
  const { conditions } = useMedicalConditions();
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const selectedCondition = conditions.find((c) => c.id === value) || conditions[0];

  // Close dropdown on click outside or Escape
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
      searchInputRef.current?.focus();
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const filteredConditions = conditions.filter((c) => {
    if (!search.trim()) return true;
    const query = search.trim().toLowerCase();
    return (
      c.name.toLowerCase().includes(query) ||
      c.description.toLowerCase().includes(query) ||
      c.id.toLowerCase().includes(query)
    );
  });

  return (
    <div className="space-y-1.5" ref={containerRef}>
      <label htmlFor={id} className="block text-sm font-medium text-fg">
        {label}
      </label>

      {/* Main trigger button */}
      <div className="relative">
        <button
          id={id}
          type="button"
          onClick={() => {
            setIsOpen(!isOpen);
            setSearch('');
          }}
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          className="flex w-full items-center justify-between rounded-xl border border-border bg-surface px-3.5 py-2.5 text-left text-sm shadow-xs transition hover:border-primary/50 focus:border-primary focus:outline-hidden focus:ring-2 focus:ring-primary/20"
        >
          {selectedCondition ? (
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
                <MedicalIcon name={selectedCondition.icon} className="size-4" />
              </span>
              <span className="truncate font-semibold text-fg">{selectedCondition.name}</span>
              <Badge tone={SEVERITY_CONFIG[selectedCondition.severity]?.tone || 'neutral'}>
                {SEVERITY_CONFIG[selectedCondition.severity]?.label || 'Thông thường'}
              </Badge>
            </div>
          ) : (
            <span className="text-fg-muted">Chọn bệnh lý nền...</span>
          )}

          <ChevronDown
            aria-hidden="true"
            className={`size-4 text-fg-muted transition-transform duration-200 ${
              isOpen ? 'rotate-180' : ''
            }`}
          />
        </button>

        {/* Dropdown panel */}
        {isOpen && (
          <div className="absolute z-50 mt-1.5 w-full rounded-2xl border border-border bg-surface p-2 shadow-xl ring-1 ring-black/5 animate-in fade-in-0 zoom-in-95 duration-100">
            {/* Search Input */}
            <div className="relative mb-2">
              <Search
                aria-hidden="true"
                className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fg-muted"
              />
              <input
                ref={searchInputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Tìm loại bệnh (VD: hen suyễn, tim mạch, động kinh...)"
                className="w-full rounded-xl border border-border bg-surface-muted/50 py-2 pl-9 pr-8 text-xs text-fg placeholder:text-fg-muted focus:border-primary focus:bg-surface focus:outline-hidden focus:ring-1 focus:ring-primary"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  aria-label="Xóa tìm kiếm"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-fg-muted hover:bg-surface hover:text-fg"
                >
                  <X aria-hidden="true" className="size-3.5" />
                </button>
              )}
            </div>

            {/* Options list */}
            <div role="listbox" className="max-h-60 overflow-y-auto space-y-1">
              {filteredConditions.length === 0 ? (
                <div className="py-4 text-center text-xs text-fg-muted">
                  Không tìm thấy loại bệnh phù hợp với từ khóa &ldquo;{search}&rdquo;
                </div>
              ) : (
                filteredConditions.map((cond) => {
                  const isSelected = cond.id === selectedCondition?.id;
                  const sev = SEVERITY_CONFIG[cond.severity];

                  return (
                    <button
                      key={cond.id}
                      role="option"
                      aria-selected={isSelected}
                      type="button"
                      onClick={() => {
                        onChange(cond.id);
                        setIsOpen(false);
                      }}
                      className={`flex w-full items-start justify-between gap-3 rounded-xl p-2.5 text-left text-xs transition ${
                        isSelected
                          ? 'bg-primary-soft/60 text-primary font-medium'
                          : 'hover:bg-surface-muted text-fg'
                      }`}
                    >
                      <div className="flex items-start gap-2.5 min-w-0">
                        <span
                          className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${
                            isSelected
                              ? 'bg-primary text-primary-fg'
                              : 'bg-surface-muted text-primary'
                          }`}
                        >
                          <MedicalIcon name={cond.icon} className="size-4" />
                        </span>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-semibold text-fg">{cond.name}</span>
                            <Badge tone={sev.tone}>{sev.label}</Badge>
                          </div>
                          <p className="line-clamp-1 text-[11px] text-fg-muted mt-0.5">
                            {cond.description}
                          </p>
                        </div>
                      </div>

                      {isSelected && (
                        <Check aria-hidden="true" className="size-4 shrink-0 text-primary mt-1" />
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      {hint && !error && <p className="text-xs text-fg-muted">{hint}</p>}
      {error && <p className="text-xs text-danger font-medium">{error}</p>}
    </div>
  );
}
