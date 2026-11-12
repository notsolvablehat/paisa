"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  DateRangePicker,
  type DateRange,
  type DateRangePreset,
} from "@/components/arc/date-range-picker/date-range-picker";
import {
  FilterToolbar,
  type FilterChip,
  type FilterField,
} from "@/components/arc/filter-toolbar/filter-toolbar";
import { Pagination } from "@/components/arc/pagination/pagination";
import { SearchField } from "@/components/arc/search-field/search-field";
import {
  SortableDataTable,
  type DataColumn,
  type SortState,
} from "@/components/arc/sortable-data-table/sortable-data-table";
import { Tooltip } from "@/components/arc/tooltip/tooltip";
import { Button } from "@/components/arc/button/button";
import { LoadFailed, useAppData } from "@/components/dashboard/app-shell";
import { CategoryDonut } from "@/components/dashboard/category-donut";
import {
  Chip,
  EmptyState,
  Panel,
  Spinner,
  Stat,
} from "@/components/dashboard/primitives";
import { useLedger } from "@/hooks/use-dashboard";
import { useDeleteSpend } from "@/hooks/use-delete-spend";
import { INCOME_SOURCES, SOURCE_META } from "@/lib/constants";
import {
  addDays,
  addMonths,
  dayMonth,
  ISO_DATE,
  monthRange,
  parseISO,
  toISO,
  todayISO,
} from "@/lib/dates";
import {
  formatINR,
  formatRoundINR,
  formatTotalINR,
  NO_DATA,
} from "@/lib/money";
import type { DashboardData, LedgerRow } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useUI } from "@/stores/ui";

const PAGE_SIZE = 25;

export function TransactionsPage() {
  const { data, failed, retry } = useAppData();
  return <TransactionsView data={data} failed={failed} retry={retry} />;
}

/* ───────────────────────── dates ⇄ picker ───────────────────────── */

const toDate = (iso: string) => {
  const { y, m, d } = parseISO(iso);
  return new Date(y, m - 1, d);
};
const fromDate = (d: Date) =>
  toISO({ y: d.getFullYear(), m: d.getMonth() + 1, d: d.getDate() });
const validISO = (s: string | null) => (s && ISO_DATE.test(s) ? s : null);

function presets(todayISO: string): DateRangePreset[] {
  const thisMonth = todayISO.slice(0, 7);
  const r = (from: string, to: string) => () => ({
    start: toDate(from),
    end: toDate(to),
  });
  return [
    { label: "This month", range: r(monthRange(thisMonth).start, todayISO) },
    {
      label: "Last month",
      range: r(
        monthRange(addMonths(thisMonth, -1)).start,
        monthRange(addMonths(thisMonth, -1)).end,
      ),
    },
    { label: "Last 90 days", range: r(addDays(todayISO, -89), todayISO) },
    { label: "This year", range: r(`${todayISO.slice(0, 4)}-01-01`, todayISO) },
    { label: "Last 12 months", range: r(addDays(todayISO, -364), todayISO) },
  ];
}

/* ───────────────────────── filters ───────────────────────── */

type Option = { value: string; label: string };
const TYPE_OPTIONS: Option[] = [
  { value: "spend", label: "Spends" },
  { value: "income", label: "Income" },
  { value: "bill", label: "Bill payments" },
];
const AMOUNT_OPTIONS: (Option & { min: number; max: number })[] = [
  { value: "lt500", label: "Under ₹500", min: 0, max: 500_00 },
  { value: "500-2k", label: "₹500 – ₹2,000", min: 500_00, max: 2_000_00 },
  { value: "2k-10k", label: "₹2,000 – ₹10,000", min: 2_000_00, max: 10_000_00 },
  { value: "gt10k", label: "Over ₹10,000", min: 10_000_00, max: Infinity },
];

type Row = {
  id: string;
  date: string;
  description: string;
  category: string;
  amount: number;
  row: LedgerRow;
};

/* ───────────────────────── view ───────────────────────── */

/**
 * Two requests feed this page: the dashboard (categories) and the ledger (rows). The title and
 * date range need neither; the table and totals each show a spinner until their data is in.
 */
function TransactionsView({
  data,
  failed,
  retry,
}: {
  data: DashboardData | undefined;
  failed: boolean;
  retry: () => void;
}) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const openModal = useUI((s) => s.openModal);
  const onDelete = useDeleteSpend();

  const today = data?.today ?? todayISO();
  const categories = useMemo(() => data?.categories ?? [], [data]);
  const to = validISO(params.get("to")) ?? today;
  const from = validISO(params.get("from")) ?? addDays(to, -89);
  const ledger = useLedger(from, to);

  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<FilterChip[]>([]);
  const [sort, setSort] = useState<SortState>({
    key: "date",
    direction: "desc",
  });
  const [page, setPage] = useState(1);

  const catBy = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories],
  );
  const all = useMemo(() => ledger.data?.rows ?? [], [ledger.data]);

  const setRange = (range: DateRange) => {
    const qs = new URLSearchParams({
      from: fromDate(range.start),
      to: fromDate(range.end),
    });
    router.replace(`${pathname}?${qs}`, { scroll: false });
    setPage(1);
  };

  /* Filter menu, with live counts for the loaded range. */
  const fields = useMemo<FilterField[]>(() => {
    const count = (pred: (r: LedgerRow) => boolean) => all.filter(pred).length;
    return [
      {
        id: "type",
        label: "Type",
        icon: <i className="ri-swap-line" aria-hidden />,
        options: TYPE_OPTIONS.map((o) => ({
          value: o.value,
          label: o.label,
          hint: count(typePred(o.value)),
        })),
      },
      {
        id: "category",
        label: "Category",
        icon: <i className="ri-price-tag-3-line" aria-hidden />,
        options: categories.map((c) => ({
          value: c.id,
          label: c.name,
          hint: count((r) => r.categoryId === c.id),
          icon: <i className={c.icon} style={{ color: c.color }} aria-hidden />,
        })),
      },
      {
        id: "source",
        label: "Income source",
        icon: <i className="ri-briefcase-4-line" aria-hidden />,
        options: INCOME_SOURCES.map((k) => ({
          value: k,
          label: k,
          hint: count((r) => r.source === k),
          icon: (
            <i
              className={SOURCE_META[k].icon}
              style={{ color: SOURCE_META[k].color }}
              aria-hidden
            />
          ),
        })),
      },
      {
        id: "amount",
        label: "Amount",
        icon: <i className="ri-money-rupee-circle-line" aria-hidden />,
        options: AMOUNT_OPTIONS.map((o) => ({
          value: o.value,
          label: o.label,
          hint: count(amountPred(o)),
        })),
      },
    ];
  }, [all, categories]);

  /* Chips carry the option label; map back to a predicate. */
  const filtered = useMemo(() => {
    const preds: ((r: LedgerRow) => boolean)[] = [];
    for (const chip of filters) {
      const field = fields.find((f) => f.id === chip.id);
      const opt = field?.options.find(
        (o) => typeof o !== "string" && o.label === chip.value,
      );
      if (!opt || typeof opt === "string") continue;
      if (chip.id === "type") preds.push(typePred(opt.value));
      if (chip.id === "category") preds.push((r) => r.categoryId === opt.value);
      if (chip.id === "source") preds.push((r) => r.source === opt.value);
      if (chip.id === "amount") {
        const a = AMOUNT_OPTIONS.find((x) => x.value === opt.value);
        if (a) preds.push(amountPred(a));
      }
    }
    const q = query.trim().toLowerCase();
    return all.filter((r) => {
      if (!preds.every((p) => p(r))) return false;
      if (!q) return true;
      const label =
        r.kind === "spend"
          ? (catBy.get(r.categoryId ?? "")?.name ?? "")
          : (r.source ?? "");
      return (
        r.note.toLowerCase().includes(q) || label.toLowerCase().includes(q)
      );
    });
  }, [all, filters, fields, query, catBy]);

  const rows = useMemo<Row[]>(
    () =>
      filtered.map((r) => {
        const c = r.categoryId ? catBy.get(r.categoryId) : undefined;
        const category =
          r.kind === "spend" ? (c?.name ?? "Unknown") : (r.source ?? "Income");
        return {
          id: `${r.kind}:${r.id}`,
          date: r.date,
          description: r.note || category,
          category,
          amount: r.amount,
          row: r,
        };
      }),
    [filtered, catBy],
  );

  // Sort the whole set here so pages are cut from the sorted list; the table re-sorts the page identically.
  const sorted = useMemo(() => {
    const dir = sort.direction === "asc" ? 1 : -1;
    const k = sort.key as keyof Row;
    return [...rows].sort((a, b) => {
      const x = a[k],
        y = b[k];
      const res =
        typeof x === "number" && typeof y === "number"
          ? x - y
          : collator.compare(String(x), String(y));
      return res * dir;
    });
  }, [rows, sort]);
  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageRows = sorted.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE,
  );

  const totals = useMemo(() => {
    let spent = 0,
      received = 0;
    const byCat = new Map<string, number>();
    for (const r of filtered) {
      if (r.kind === "spend") {
        spent += r.amount;
        byCat.set(r.categoryId!, (byCat.get(r.categoryId!) ?? 0) + r.amount);
      } else received += r.amount;
    }
    return { spent, received, byCat };
  }, [filtered]);

  // Rows need category names, so the table waits for both requests.
  const tableLoading = ledger.isPending || !data;
  const thisYear = today.slice(0, 4);
  const columns: DataColumn<Row>[] = [
    {
      key: "date",
      label: "Date",
      sortable: true,
      width: 104,
      render: (_, r) => (
        <span className="whitespace-nowrap text-(--p-fg2)">
          {dayMonth(r.date)}
          {r.date.slice(0, 4) !== thisYear && (
            <span className="text-(--p-fg3)"> {r.date.slice(0, 4)}</span>
          )}
        </span>
      ),
    },
    {
      key: "description",
      label: "Description",
      sortable: true,
      render: (_, r) => (
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate">{r.description}</span>
          {r.row.billId && (
            <span className="shrink-0 rounded-full border border-(--p-line) px-1.5 text-[11px] text-(--p-fg3)">
              Bill
            </span>
          )}
        </span>
      ),
    },
    {
      key: "category",
      label: "Category",
      sortable: true,
      width: 168,
      render: (_, r) => {
        const color =
          r.row.kind === "spend"
            ? catBy.get(r.row.categoryId ?? "")?.color
            : r.row.source
              ? SOURCE_META[r.row.source].color
              : undefined;
        return <Chip color={color}>{r.category}</Chip>;
      },
    },
    {
      key: "amount",
      label: "Amount",
      sortable: true,
      numeric: true,
      width: 128,
      render: (_, r) =>
        r.row.kind === "income" ? (
          <span className="font-medium text-(--p-pos)">
            +{formatINR(r.amount)}
          </span>
        ) : (
          <span className="font-medium">{formatINR(r.amount)}</span>
        ),
    },
    {
      key: "actions",
      label: "Actions",
      width: 84,
      render: (_, r) =>
        r.row.kind === "spend" ? (
          <span className="flex justify-end gap-0.5">
            <Tooltip content="Edit">
              <button
                type="button"
                aria-label={`Edit ${r.description}`}
                onClick={() =>
                  openModal("Spend", {
                    editTxId: r.row.id,
                    amount: r.row.amount,
                    categoryId: r.row.categoryId ?? undefined,
                    note: r.row.note,
                    date: r.row.date,
                  })
                }
                className="grid size-8 place-items-center rounded-full text-(--p-fg3) hover:bg-(--p-surface2) hover:text-(--p-ink)"
              >
                <i className="ri-pencil-line text-[15px]" aria-hidden />
              </button>
            </Tooltip>
            <Tooltip content="Delete">
              <button
                type="button"
                aria-label={`Delete ${r.description}`}
                onClick={() => onDelete(r.row.id)}
                className="grid size-8 place-items-center rounded-full text-(--p-fg3) hover:bg-(--p-surface2) hover:text-(--p-warn)"
              >
                <i className="ri-delete-bin-6-line text-[15px]" aria-hidden />
              </button>
            </Tooltip>
          </span>
        ) : null,
    },
  ];

  const donut = categories
    .filter((c) => (totals.byCat.get(c.id) ?? 0) > 0)
    .map((c) => ({
      key: c.id,
      label: c.name,
      amount: totals.byCat.get(c.id) ?? 0,
      color: c.color,
    }));

  const clearAll = () => {
    setFilters([]);
    setQuery("");
    setPage(1);
  };

  return (
    <>
      <div className="-mb-[clamp(16px,2.5cqw,40px)] flex flex-wrap items-end justify-between gap-4 px-1">
        <div>
          <h1 className="font-display text-[clamp(28px,3.2cqw,36px)] font-normal tracking-[-.03em]">
            Transactions
          </h1>
          <p className="mt-1 text-sm text-(--p-fg3)">
            {ledger.isPending
              ? "Loading…"
              : `${filtered.length} of ${all.length} in range`}
            {ledger.data?.truncated &&
              " · showing the latest 5,000 — narrow the dates to see older ones"}
          </p>
        </div>
        <DateRangePicker
          label="Date range"
          value={{ start: toDate(from), end: toDate(to) }}
          onChange={setRange}
          presets={presets(today)}
          maxDate={toDate(today)}
          weekStartsOn={1}
          locale="en-IN"
        />
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Panel className="min-w-0">
          <div className="mb-4 flex flex-col gap-3">
            <div className="max-w-[420px]">
              <SearchField
                label="Search transactions"
                placeholder="Search notes, categories, sources"
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
                  setFilters((f) => [
                    ...f.filter((x) => x.id !== chip.id),
                    chip,
                  ]);
                  setPage(1);
                },
              }}
            />
          </div>

          {failed ? (
            <LoadFailed onRetry={retry} />
          ) : ledger.isError ? (
            <EmptyState
              scene="inbox"
              title="Couldn't load transactions"
              action={
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => ledger.refetch()}
                >
                  Try again
                </Button>
              }
            />
          ) : tableLoading ? (
            <div className="grid min-h-60 place-items-center">
              <Spinner label="Loading transactions" />
            </div>
          ) : rows.length === 0 ? (
            <EmptyState
              scene="search"
              title={
                all.length === 0 ? "Nothing in this range" : "Nothing matches"
              }
              action={
                all.length > 0 ? (
                  <Button size="sm" variant="secondary" onClick={clearAll}>
                    Clear filters
                  </Button>
                ) : undefined
              }
            >
              {all.length === 0
                ? "Pick a wider date range."
                : "Try removing a filter or searching for something else."}
            </EmptyState>
          ) : (
            <div
              className={cn(
                "list-table -mx-2 overflow-x-auto px-2 transition-opacity",
                ledger.isFetching && "opacity-60",
              )}
            >
              <SortableDataTable<Row>
                rows={pageRows}
                columns={columns}
                rowKey="id"
                caption="Transactions"
                defaultSort={sort}
                onSortChange={(s) => {
                  setSort(s);
                  setPage(1);
                }}
                itemName={{ one: "transaction", other: "transactions" }}
              />
            </div>
          )}

          {pageCount > 1 && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <span className="text-xs text-(--p-fg3)">
                {(safePage - 1) * PAGE_SIZE + 1}–
                {Math.min(safePage * PAGE_SIZE, sorted.length)} of{" "}
                {sorted.length}
              </span>
              <Pagination
                page={safePage}
                pageCount={pageCount}
                onPageChange={setPage}
                label="Transaction pages"
              />
            </div>
          )}
        </Panel>

        <aside
          className="flex flex-col gap-4"
          aria-label="Totals for the filtered transactions"
        >
          {ledger.isPending ? (
            <Panel className="grid min-h-36 place-items-center">
              <Spinner label="Loading totals" />
            </Panel>
          ) : (
            <Panel className="grid grid-cols-2 gap-x-4 gap-y-5">
              <Stat
                label="Spent"
                value={formatTotalINR(totals.spent, formatRoundINR)}
              />
              <Stat
                label="Received"
                value={formatTotalINR(totals.received, formatRoundINR)}
                tone={totals.received > 0 ? "pos" : undefined}
              />
              <Stat
                label="Net"
                value={
                  filtered.length === 0
                    ? NO_DATA
                    : `${totals.received - totals.spent < 0 ? "−" : "+"}${formatRoundINR(Math.abs(totals.received - totals.spent))}`
                }
                tone={
                  filtered.length === 0
                    ? undefined
                    : totals.received - totals.spent < 0
                      ? "warn"
                      : "pos"
                }
              />
              <Stat label="Transactions" value={String(filtered.length)} />
            </Panel>
          )}
          <Panel className="min-w-0">
            <h2 className="mb-3 text-sm font-medium">Spent by category</h2>
            {tableLoading ? (
              <div className="grid min-h-48 place-items-center">
                <Spinner label="Loading categories" />
              </div>
            ) : donut.length === 0 ? (
              <EmptyState scene="search" compact title="No spends here" />
            ) : (
              <CategoryDonut
                slices={donut}
                label="Spending by category"
                totalLabel="Spent"
              />
            )}
          </Panel>
        </aside>
      </div>
    </>
  );
}

const collator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: "base",
});

function typePred(v: string): (r: LedgerRow) => boolean {
  if (v === "spend") return (r) => r.kind === "spend";
  if (v === "income") return (r) => r.kind === "income";
  return (r) => r.billId != null;
}
function amountPred(o: { min: number; max: number }) {
  return (r: LedgerRow) => r.amount >= o.min && r.amount < o.max;
}
