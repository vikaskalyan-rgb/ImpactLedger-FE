import { useState, type KeyboardEvent } from "react";
import { X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface TagInputProps {
  value: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  suggestions?: string[];
}

export function TagInput({ value, onChange, placeholder, suggestions = [] }: TagInputProps) {
  const [draft, setDraft] = useState("");

  function addTag(tag: string) {
    const trimmed = tag.trim();
    if (trimmed && !value.includes(trimmed)) {
      onChange([...value, trimmed]);
    }
    setDraft("");
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag(draft);
    } else if (e.key === "Backspace" && !draft && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  }

  const unusedSuggestions = suggestions.filter((s) => !value.includes(s));

  return (
    <div>
      <div
        className={cn(
          "flex flex-wrap items-center gap-1.5 rounded-[var(--radius-control)] border border-border bg-background px-2 py-1.5 focus-within:ring-2 focus-within:ring-brand"
        )}
      >
        {value.map((tag) => (
          <span
            key={tag}
            className="flex items-center gap-1 rounded-full bg-surface-hover px-2 py-0.5 text-xs text-foreground"
          >
            {tag}
            <button type="button" onClick={() => onChange(value.filter((t) => t !== tag))}>
              <X className="h-3 w-3 text-muted-foreground hover:text-danger" />
            </button>
          </span>
        ))}
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => draft && addTag(draft)}
          placeholder={value.length === 0 ? placeholder : ""}
          className="h-6 flex-1 min-w-[100px] border-none bg-transparent p-0 focus-visible:ring-0"
        />
      </div>
      {unusedSuggestions.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {unusedSuggestions.map((s) => (
            <button
              type="button"
              key={s}
              onClick={() => addTag(s)}
              className="rounded-full border border-border px-2 py-0.5 text-xs text-muted hover:border-brand hover:text-brand"
            >
              + {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
