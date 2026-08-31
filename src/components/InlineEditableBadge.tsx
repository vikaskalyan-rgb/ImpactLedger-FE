import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Badge, badgeVariants } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { VariantProps } from "class-variance-authority";

type BadgeVariant = VariantProps<typeof badgeVariants>["variant"];

/**
 * Turns a Badge into a one-click dropdown for the "change this one field without
 * opening the full edit dialog" case — priority/status on a task row, for example.
 * Uses the same appearance-none + overlaid chevron approach as the app's own
 * <Select>, just sized down to fit inside a pill.
 */
export function InlineEditableBadge<T extends string>({
  value,
  options,
  variant,
  label,
  onChange,
  disabled = false,
}: {
  value: T;
  options: readonly T[];
  variant: (v: T) => BadgeVariant;
  label: (v: T) => string;
  onChange: (v: T) => void;
  disabled?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const selectRef = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    if (editing) selectRef.current?.focus();
  }, [editing]);

  if (disabled) {
    return <Badge variant={variant(value)}>{label(value)}</Badge>;
  }

  if (editing) {
    return (
      <span className="relative inline-flex" onClick={(e) => e.stopPropagation()}>
        <select
          ref={selectRef}
          value={value}
          onChange={(e) => {
            onChange(e.target.value as T);
            setEditing(false);
          }}
          onBlur={() => setEditing(false)}
          className={cn(
            badgeVariants({ variant: variant(value) }),
            "appearance-none cursor-pointer pr-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          )}
        >
          {options.map((opt) => (
            <option key={opt} value={opt}>{label(opt)}</option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-1 top-1/2 -translate-y-1/2 h-3 w-3 text-current opacity-70" />
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        setEditing(true);
      }}
      title="Click to change"
      className="cursor-pointer rounded-full transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
    >
      <Badge variant={variant(value)}>{label(value)}</Badge>
    </button>
  );
}
