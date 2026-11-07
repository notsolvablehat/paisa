"use client";

import type { SessionUser } from "@/components/dashboard/header";

import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Badge } from "@/components/arc/badge/badge";
import { Button } from "@/components/arc/button/button";
import { DateRangePicker, type DateRange, type DateRangePreset } from "@/components/arc/date-range-picker/date-range-picker";
import { FilterToolbar, type FilterChip, type FilterField } from "@/components/arc/filter-toolbar/filter-toolbar";
import { Pagination } from "@/components/arc/pagination/pagination";
import { SearchField } from "@/components/arc/search-field/search-field";
import { SortableDataTable, type DataColumn, type SortState } from "@/components/arc/sortable-data-table/sortable-data-table";
import { Tooltip } from "@/components/arc/tooltip/tooltip";
import { AppShell } from "@/components/dashboard/app-shell";
import { CategoryDonut } from "@/components/dashboard/category-donut";
import { Chip, EmptyState, Panel, Stat } from "@/components/dashboard/primitives";
import { useAction, useReminders, useToast } from "@/hooks/use-dashboard";
import { RECURRENCES } from "@/lib/constants";
import { addDays, addMonths, dayMonth, diffDays, ISO_DATE, isoToLocalDate, localDateToISO, monthRange } from "@/lib/dates";
import { formatINR, formatRoundINR, formatTotalINR } from "@/lib/money";
import type { DashboardData, ReminderRow } from "@/lib/types";
import { cn } from "@/lib/utils";
import { deleteBill, setBillPaid } from "@/server/actions";
import { useUI } from "@/stores/ui";
import { ReminderDialog } from "./reminder-dialog";

const PAGE_SIZE = 25;

export function RemindersPage({ user }: { user: SessionUser }) {
  return (
    <AppShell page="reminders" user={user}>
      {(data) => <RemindersView data={data} />}
    </AppShell>
  );
}

type Status = "overdue" | "soon" | "upcoming" | "paid";
const STATUS: { value: Status; label: string }[] = [
  { value: "overdue", label: "Overdue" },
  { value: "soon", label: "Due in 14 days" },
  { value: "upcoming", label: "Later" },
  { value: "paid", label: "Paid" },
];

type Row = {
  id: string;
  dueOn: string;
  name: string;
  category: string;
  amount: number;
  status: Status;
  /** Earlier unpaid occurrence of the same series (must be paid first). */
  blockedBy: ReminderRow | null;
  r: ReminderRow;
};

const validISO = (s: string | null) => (s && ISO_DATE.test(s) ? s : null);

function presets(today: string): DateRangePreset[] {
  const r = (from: string, to: string) => () => ({ start: isoToLocalDate(from), end: isoToLocalDate(to) });
  const m = today.slice(0, 7);
  return [
    { label: "Next 30 days", range: r(today, addDays(today, 30)) },
    { label: "Next 90 days", range: r(today, addDays(today, 90)) },
    { label: "This month", range: r(monthRange(m).start, monthRange(m).end) },
    { label: "Last month", range: r(monthRange(addMonths(m, -1)).start, monthRange(addMonths(m, -1)).end) },
    { label: "This year", range: r(`${today.slice(0, 4)}-01-01`, `${today.slice(0, 4)}-12-31`) },
  ];
}

function statusOf(r: ReminderRow, today: string): Status {
  if (r.paidOn) return "paid";
  const d = diffDays(today, r.dueOn);
  return d < 0 ? "overdue" : d <= 14 ? "soon" : "upcoming";
}

function relative(r: Row, today: string): string {
  if (r.status === "paid") return `Paid ${dayMonth(r.r.paidOn!)}`;
  const d = diffDays(today, r.dueOn);
  if (d < 0) return `${-d} day${d === -1 ? "" : "s"} overdue`;
  if (d === 0) return "Today";
  if (d === 1) return "Tomorrow";
  return `in ${d} days`;
}

function RemindersView({ data }: { data: DashboardData }) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const openModal = useUI((s) => s.openModal);
  const toast = useToast();
  const toggle = useAction(setBillPaid);
  const remove = useAction(deleteBill);
  const [editing, setEditing] = useState<ReminderRow | null>(null);

  const today = data.today;
  const from = validISO(params.get("from")) ?? addDays(today, -30);
  const to = validISO(params.get("to")) ?? addDays(today, 90);
  const q = useReminders(from, to);

  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<FilterChip[]>([]);
  const [sort, setSort] = useState<SortState>({ key: "dueOn", direction: "asc" });
  const [page, setPage] = useState(1);

  const catBy = useMemo(() => new Map(data.categories.map((c) => [c.id, c])), [data.categories]);
  const all = useMemo<Row[]>(() => {
    const list = q.data?.rows ?? [];
    // First unpaid occurrence per series; anything after it waits its turn.
    const firstUnpaid = new Map<string, ReminderRow>();
    for (const r of list) if (!r.paidOn && !firstUnpaid.has(r.seriesId)) firstUnpaid.set(r.seriesId, r);
    return list.map((r) => {
      const first = firstUnpaid.get(r.seriesId);
      return {
        id: r.id,
        dueOn: r.dueOn,
        name: r.name,
        category: catBy.get(r.categoryId)?.name ?? "Unknown",
        amount: r.amount,
        status: statusOf(r, today),
        blockedBy: !r.paidOn && first && first.id !== r.id ? first : null,
        r,
      };
    });
  }, [q.data, catBy, today]);

  const setRange = (range: DateRange) => {
    const qs = new URLSearchParams({ from: localDateToISO(range.start), to: localDateToISO(range.end) });
    router.replace(`${pathname}?${qs}`, { scroll: false });
    setPage(1);
  };

  const fields = useMemo<FilterField[]>(() => {
    const count = (pred: (r: Row) => boolean) => all.filter(pred).length;
    return [
      {
        id: "status",
        label: "Status",
        icon: <i className="ri-checkbox-circle-line" aria-hidden />,
        options: STATUS.map((s) => ({ value: s.value, label: s.label, hint: count((r) => r.status === s.value) })),
      },
      {
        id: "repeats",
        label: "Repeats",
        icon: <i className="ri-repeat-line" aria-hidden />,
        options: RECURRENCES.map((k) => ({ value: k, label: k, hint: count((r) => r.r.recurrence === k) })),
      },
      {
        id: "category",
        label: "Category",
        icon: <i className="ri-price-tag-3-line" aria-hidden />,
        options: data.categories
          .filter((c) => all.some((r) => r.r.categoryId === c.id))
          .map((c) => ({
            value: c.id,
            label: c.name,
            hint: count((r) => r.r.categoryId === c.id),
            icon: <i className={c.icon} style={{ color: c.color }} aria-hidden />,
          })),
      },
    ];
  }, [all, data.categories]);

  const filtered = useMemo(() => {
    const preds: ((r: Row) => boolean)[] = [];
    for (const chip of filters) {
      const opt = fields.find((f) => f.id === chip.id)?.options.find((o) => typeof o !== "string" && o.label === chip.value);
      if (!opt || typeof opt === "string") continue;
      if (chip.id === "status") preds.push((r) => r.status === opt.value);
      if (chip.id === "repeats") preds.push((r) => r.r.recurrence === opt.value);
      if (chip.id === "category") preds.push((r) => r.r.categoryId === opt.value);
    }
    const needle = query.trim().toLowerCase();
    return all.filter(
      (r) => preds.every((p) => p(r)) && (!needle || r.name.toLowerCase().includes(needle) || r.category.toLowerCase().includes(needle)),
    );
  }, [all, filters, fields, query]);

  const sorted = useMemo(() => {
    const dir = sort.direction === "asc" ? 1 : -1;
    const k = sort.key as keyof Row;
    return [...filtered].sort((a, b) => {
      const x = a[k], y = b[k];
      const res = typeof x === "number" && typeof y === "number" ? x - y : collator.compare(String(x), String(y));
      return res * dir;
    });
  }, [filtered, sort]);
  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageRows = sorted.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const totals = useMemo(() => {
    const sum = (s: Status) => filtered.filter((r) => r.status === s).reduce((a, r) => a + r.amount, 0);
    // Recurring cost per month: latest occurrence of each repeating series.
    const latest = new Map<string, ReminderRow>();
    for (const r of all) if (r.r.recurrence !== "Once") latest.set(r.r.seriesId, r.r);
    const byCat = new Map<string, number>();
    let perMonth = 0;
    for (const r of latest.values()) {
      const monthly = r.recurrence === "Monthly" ? r.amount : Math.round(r.amount / 12);
      perMonth += monthly;
      byCat.set(r.categoryId, (byCat.get(r.categoryId) ?? 0) + monthly);
    }
    return {
      overdue: sum("overdue"),
      overdueN: filtered.filter((r) => r.status === "overdue").length,
      soon: sum("soon"),
      paid: sum("paid"),
      perMonth,
      byCat,
    };
  }, [filtered, all]);

  const onDelete = (r: ReminderRow) =>
    remove.mutate(
      { billId: r.id },
      {
        onSuccess: (n) =>
          toast.success(
            r.recurrence === "Once" ? "Reminder deleted" : "Reminder stopped",
            n > 1 ? `Removed ${n} upcoming occurrences. Paid ones stay in your history.` : "Paid ones stay in your history.",
          ),
      },
    );

  const columns: DataColumn<Row>[] = [
    {
      key: "dueOn",
      label: "Due",
      sortable: true,
      width: 120,
      render: (_, r) => (
        <span className="flex flex-col leading-tight">
          <span className={cn("whitespace-nowrap", r.status === "paid" ? "text-(--p-fg3)" : "font-medium")}>
            {dayMonth(r.dueOn)}
            {r.dueOn.slice(0, 4) !== today.slice(0, 4) && <span className="text-(--p-fg3)"> {r.dueOn.slice(0, 4)}</span>}
          </span>
          <span className={cn("mt-0.5 text-xs whitespace-nowrap", r.status === "overdue" ? "text-(--p-warn)" : "text-(--p-fg3)")}>
            {relative(r, today)}
          </span>
        </span>
      ),
    },
    {
      key: "name",
      label: "Reminder",
      sortable: true,
      render: (_, r) => (
        <span className="flex min-w-0 items-center gap-2">
          <span title={r.name} className={cn("truncate", r.status === "paid" && "text-(--p-fg3) line-through")}>{r.name}</span>
          <Badge className="shrink-0" size="sm" pill outline>
            {r.r.recurrence}
          </Badge>
        </span>
      ),
    },
    {
      key: "category",
      label: "Category",
      sortable: true,
      width: 140,
      render: (_, r) => <Chip color={catBy.get(r.r.categoryId)?.color}>{r.category}</Chip>,
    },
    {
      key: "amount",
      label: "Amount",
      sortable: true,
      numeric: true,
      width: 96,
      render: (_, r) => <span className={cn("font-medium", r.status === "paid" && "text-(--p-fg3) line-through")}>{formatINR(r.amount)}</span>,
    },
    {
      key: "actions",
      label: "Actions",
      width: 120,
      render: (_, r) => {
        const busy = toggle.isPending && toggle.variables?.billId === r.id;
        const paid = r.status === "paid";
        const check = (
          <button
            type="button"
            role="checkbox"
            aria-checked={paid}
            aria-label={`Mark ${r.name} due ${dayMonth(r.dueOn)} ${paid ? "unpaid" : "paid"}`}
            disabled={busy || r.blockedBy != null}
            onClick={() => toggle.mutate({ billId: r.id, paid: !paid })}
            className="grid size-9 place-items-center disabled:cursor-not-allowed"
          >
            <span
              className={cn(
                "grid size-[22px] place-items-center rounded-[7px] border transition-colors",
                paid ? "border-(--p-primary) bg-(--p-primary) text-(--p-onPrimary)" : "border-(--p-lineStrong)",
                (busy || r.blockedBy) && "opacity-40",
              )}
            >
              {paid && <i className="ri-check-line text-[14px]" aria-hidden />}
            </span>
          </button>
        );
        return (
          <span className="flex items-center justify-end gap-0.5">
            <Tooltip content={r.blockedBy ? `Pay the ${dayMonth(r.blockedBy.dueOn)} one first` : paid ? "Mark unpaid" : "Mark paid"}>
              {check}
            </Tooltip>
            {paid ? (
              <span className="w-[68px]" aria-hidden />
            ) : (
              <>
                <Tooltip content="Edit">
                  <button
                    type="button"
                    aria-label={`Edit ${r.name}`}
                    onClick={() => setEditing(r.r)}
                    className="grid size-8 place-items-center rounded-full text-(--p-fg3) hover:bg-(--p-surface2) hover:text-(--p-ink)"
                  >
                    <i className="ri-pencil-line text-[15px]" aria-hidden />
                  </button>
                </Tooltip>
                <Tooltip content={r.r.recurrence === "Once" ? "Delete" : "Stop reminder"}>
                  <button
                    type="button"
                    aria-label={`${r.r.recurrence === "Once" ? "Delete" : "Stop"} ${r.name}`}
                    onClick={() => onDelete(r.r)}
                    className="grid size-8 place-items-center rounded-full text-(--p-fg3) hover:bg-(--p-surface2) hover:text-(--p-warn)"
                  >
                    <i className="ri-delete-bin-6-line text-[15px]" aria-hidden />
                  </button>
                </Tooltip>
              </>
            )}
          </span>
        );
      },
    },
  ];

  const donut = data.categories
    .filter((c) => (totals.byCat.get(c.id) ?? 0) > 0)
    .map((c) => ({ key: c.id, label: c.name, amount: totals.byCat.get(c.id) ?? 0, color: c.color }));

  const clearAll = () => {
    setFilters([]);
    setQuery("");
    setPage(1);
  };

  return (
    <>
      <div className="-mb-[clamp(16px,2.5cqw,40px)] flex flex-wrap items-end justify-between gap-4 px-1">
        <div>
          <h1 className="font-display text-[clamp(28px,3.2cqw,36px)] font-normal tracking-[-.03em]">Reminders</h1>
          <p className="mt-1 text-sm text-(--p-fg3)">
            {q.isPending ? "Loading…" : `${filtered.length} of ${all.length} in range · overdue ones always show`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <DateRangePicker
            label="Date range"
            value={{ start: isoToLocalDate(from), end: isoToLocalDate(to) }}
            onChange={setRange}
            presets={presets(today)}
            weekStartsOn={1}
            locale="en-IN"
          />
          <Button size="sm" variant="secondary" onClick={() => openModal("Reminder")}>
            <i className="ri-add-line text-[16px]" aria-hidden />
            Add reminder
          </Button>
        </div>
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Panel className="min-w-0">
          <div className="mb-4 flex flex-col gap-3">
            <div className="max-w-[420px]">
              <SearchField
                label="Search reminders"
                placeholder="Search names and categories"
                value={query}
                onValueChange={(v) => {
                  setQuery(v);
                  setPage(1);
                }}
              />
            </div>
            <FilterToolbar
              filters={filters}
              onRemove={(id) => {
                setFilters((f) => f.filter((x) => x.id !== id));
                setPage(1);
              }}
              onClearAll={clearAll}
              addFilter={{
                fields,
                align: "start",
                onAdd: (chip) => {
                  setFilters((f) => [...f.filter((x) => x.id !== chip.id), chip]);
                  setPage(1);
                },
              }}
            />
          </div>

          {q.isError ? (
            <EmptyState
              scene="inbox"
              title="Couldn't load reminders"
              action={
                <Button size="sm" variant="secondary" onClick={() => q.refetch()}>
                  Try again
                </Button>
              }
            />
          ) : !q.isPending && filtered.length === 0 ? (
            <EmptyState
              scene="inbox"
              title={all.length === 0 ? "No reminders in this range" : "Nothing matches"}
              action={
                all.length > 0 ? (
                  <Button size="sm" variant="secondary" onClick={clearAll}>
                    Clear filters
                  </Button>
                ) : (
                  <Button size="sm" variant="secondary" onClick={() => openModal("Reminder")}>
                    Add a reminder
                  </Button>
                )
              }
            >
              {all.length === 0 ? "Rent, subscriptions and insurance go here, and count against safe-to-spend." : "Try removing a filter."}
            </EmptyState>
          ) : (
            <div className={cn("-mx-2 overflow-x-auto px-2 transition-opacity", q.isFetching && "opacity-60")}>
              <SortableDataTable<Row>
                rows={pageRows}
                columns={columns}
                rowKey="id"
                caption="Reminders"
                defaultSort={sort}
                onSortChange={(s) => {
                  setSort(s);
                  setPage(1);
                }}
                itemName={{ one: "reminder", other: "reminders" }}
              />
            </div>
          )}

          {pageCount > 1 && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <span className="text-xs text-(--p-fg3)">
                {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, sorted.length)} of {sorted.length}
              </span>
              <Pagination page={safePage} pageCount={pageCount} onPageChange={setPage} label="Reminder pages" />
            </div>
          )}
        </Panel>

        <aside className="flex flex-col gap-4" aria-label="Reminder totals">
          <Panel className="grid grid-cols-2 gap-x-4 gap-y-5">
            <Stat label={`Overdue${totals.overdueN ? ` · ${totals.overdueN}` : ""}`} value={formatTotalINR(totals.overdue, formatRoundINR)} tone={totals.overdue > 0 ? "warn" : undefined} />
            <Stat label="Due in 14 days" value={formatTotalINR(totals.soon, formatRoundINR)} />
            <Stat label="Paid in range" value={formatTotalINR(totals.paid, formatRoundINR)} tone={totals.paid > 0 ? "pos" : undefined} />
            <Stat label="Recurring / month" value={formatTotalINR(totals.perMonth, formatRoundINR)} />
          </Panel>
          <Panel className="min-w-0">
            <h2 className="mb-1 text-sm font-medium">Fixed costs by category</h2>
            <p className="mb-3 text-xs text-(--p-fg3)">Monthly and yearly reminders, per month.</p>
            {donut.length === 0 ? (
              <EmptyState scene="inbox" compact title="No repeating reminders" />
            ) : (
              <CategoryDonut slices={donut} label="Recurring costs by category" totalLabel="Per month" />
            )}
          </Panel>
        </aside>
      </div>

      <ReminderDialog reminder={editing} categories={data.categories} onClose={() => setEditing(null)} />
    </>
  );
}

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });
