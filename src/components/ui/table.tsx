import * as React from "react";
import { cn } from "@/lib/utils";

function Table({
  className,
  stickyHeader = false,
  maxHeight,
  ...props
}: React.HTMLAttributes<HTMLTableElement> & { stickyHeader?: boolean; maxHeight?: string }) {
  return (
    <div
      className={cn(
        "w-full overflow-x-auto rounded-[var(--radius-card)] border border-border",
        // A sticky <thead> only sticks relative to its nearest scrolling ancestor.
        // The overflow-x-auto above already makes this div a scroll container (per
        // the CSS spec, overflow-x:auto forces overflow-y to auto too), so without
        // a bounded height it never actually scrolls — the header would just
        // scroll away with the rest of the page. Giving it its own max-height +
        // overflow-y-auto makes it the thing that scrolls, so sticky works.
        stickyHeader && "overflow-y-auto"
      )}
      style={stickyHeader && maxHeight ? { maxHeight } : undefined}
    >
      <table className={cn("w-full caption-bottom text-sm", className)} {...props} />
    </div>
  );
}

function TableHeader({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={cn("bg-surface-hover", className)} {...props} />;
}

function TableBody({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={cn("divide-y divide-border", className)} {...props} />;
}

function TableRow({ className, ...props }: React.HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={cn("transition-colors hover:bg-surface-hover/60", className)} {...props} />;
}

function TableHead({ className, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn("h-10 px-4 text-left align-middle text-xs font-medium uppercase tracking-wide text-muted", className)}
      {...props}
    />
  );
}

function TableCell({ className, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn("px-4 py-3 align-middle", className)} {...props} />;
}

export { Table, TableHeader, TableBody, TableRow, TableHead, TableCell };
