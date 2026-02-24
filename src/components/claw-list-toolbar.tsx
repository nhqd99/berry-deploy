"use client";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search } from "lucide-react";

export type StatusFilter = "all" | "running" | "stopped" | "error" | "creating";
export type SortOption = "name-asc" | "name-desc" | "newest" | "oldest" | "status";

export function ClawListToolbar({
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  sort,
  onSortChange,
}: {
  search: string;
  onSearchChange: (value: string) => void;
  statusFilter: StatusFilter;
  onStatusFilterChange: (value: StatusFilter) => void;
  sort: SortOption;
  onSortChange: (value: SortOption) => void;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="relative flex-1 input-glow rounded-xl">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground/60" />
        <Input
          placeholder="Search claws..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9 bg-white/[0.05] border-white/[0.10] rounded-xl transition-all duration-300 focus-visible:bg-white/[0.07]"
        />
      </div>
      <div className="flex gap-2">
        <Select
          value={statusFilter}
          onValueChange={(v) => onStatusFilterChange(v as StatusFilter)}
        >
          <SelectTrigger className="w-[130px] bg-white/[0.05] border-white/[0.10] rounded-xl">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="running">Running</SelectItem>
            <SelectItem value="stopped">Stopped</SelectItem>
            <SelectItem value="error">Error</SelectItem>
            <SelectItem value="creating">Creating</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={sort}
          onValueChange={(v) => onSortChange(v as SortOption)}
        >
          <SelectTrigger className="w-[140px] bg-white/[0.05] border-white/[0.10] rounded-xl">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="name-asc">Name A-Z</SelectItem>
            <SelectItem value="name-desc">Name Z-A</SelectItem>
            <SelectItem value="newest">Newest</SelectItem>
            <SelectItem value="oldest">Oldest</SelectItem>
            <SelectItem value="status">Status</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
