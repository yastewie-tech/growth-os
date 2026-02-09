import React, { useCallback, useMemo, useState } from "react";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { ListTodo, CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";

import { ScrollArea } from "@/lib/components/ui/scroll-area";
import { Badge } from "@/lib/components/ui/badge";
import { Button } from "@/lib/components/ui/button";
import { cn } from "@/lib/utils";
import { SprintCard } from "@/lib/components/ab-tests/SprintCard";
import { CreateExpressCardDialog } from "./CreateExpressCardDialog";
import { ABTest } from "@shared/schema";

// Fallback for missing utils
const MONTHS = ["Янв", "Фев", "Мар", "Апр", "Май", "Июн", "Июл", "Авг", "Сен", "Окт", "Ноя", "Дек"];

// Use ABTest instead of custom KanbanTask
export type KanbanTask = ABTest;

type Column = {
  id: string;
  title: string;
  icon: React.ReactNode;
  items: KanbanTask[];
};

type Props = {
  tests: KanbanTask[];
  onSelect: (t: KanbanTask) => void;
  onMoveTask: (taskId: number, sprintId: string, newStatus: string) => void;
  onReorderTask: (taskId: number, newPosition: number) => void;
  onDeleteTask?: (taskId: number) => void;
  onSendToLab?: (taskId: number) => void;
};

const BACKLOG_ID = "backlog";
const ROMAN = ["I", "II", "III", "IV", "V"] as const;

const CATEGORY_TOKENS: Record<
  string,
  { label: string; solid: string; soft: string; border: string }
> = {
  "oral care": {
    label: "SMILE",
    solid: "#c0b0f0",
    soft: "rgba(192,176,240,0.18)",
    border: "rgba(192,176,240,0.55)",
  },
  hair: {
    label: "HAIR",
    solid: "#406090",
    soft: "rgba(64,96,144,0.14)",
    border: "rgba(64,96,144,0.45)",
  },
  body: {
    label: "BODY",
    solid: "#404030",
    soft: "rgba(64,64,48,0.10)",
    border: "rgba(64,64,48,0.35)",
  },
  "make-up": {
    label: "MAKEUP",
    solid: "#f0f0e0",
    soft: "rgba(240,240,224,0.55)",
    border: "rgba(226,232,240,0.9)",
  },
  face: {
    label: "FACE",
    solid: "#70c0d0",
    soft: "rgba(112,192,208,0.18)",
    border: "rgba(112,192,208,0.55)",
  },
  uncategorized: {
    label: "NO TAG",
    solid: "#f1f5f9",
    soft: "rgba(241,245,249,0.85)",
    border: "rgba(226,232,240,0.9)",
  },
};

function sortByPos(a: KanbanTask, b: KanbanTask) {
  return (a.position ?? 0) - (b.position ?? 0);
}

function getCurrentYearMonth() {
  const d = new Date();
  return { y: d.getFullYear(), m: d.getMonth() };
}

function normalizeCategory(input: any) {
  const raw = String(input ?? "").trim();
  if (!raw) return "uncategorized";
  const lower = raw.toLowerCase();

  if (lower === "oral" || lower === "oralcare" || lower === "oral care" || lower === "smile") return "oral care";
  if (lower === "makeup" || lower === "make-up" || lower === "make up") return "make-up";
  if (lower === "body") return "body";
  if (lower === "face") return "face";
  if (lower === "hair") return "hair";
  return raw;
}

function getCategoryTheme(catKey: string) {
  const key = String(catKey).toLowerCase();
  return CATEGORY_TOKENS[key] || CATEGORY_TOKENS.uncategorized;
}

function normalizeTestType(v: any) {
  const s = String(v ?? "").trim().toUpperCase();
  if (s === "CRT") return "CTR";
  if (s === "РИЧ") return "RICH";
  return s;
}

function countTypes(items: KanbanTask[]) {
  let ctr = 0;
  let cr = 0;
  let rich = 0;
  for (const t of items) {
    const tt = normalizeTestType(t.testType);
    if (tt === "CTR") ctr++;
    else if (tt === "CR") cr++;
    else if (tt === "RICH") rich++;
  }
  return { total: items.length, ctr, cr, rich };
}

export function KanbanBoard({
  tests,
  onSelect,
  onMoveTask,
  onReorderTask,
  onDeleteTask,
  onSendToLab,
}: Props) {
  const now = getCurrentYearMonth();
  const [year, setYear] = useState(now.y);
  const [month, setMonth] = useState(now.m);

  const normalizedTests = useMemo(() => {
    return tests.map((t, index) => {
      if (t.position === undefined || t.position === null) {
        return { ...t, position: index * 1000 };
      }
      return t;
    });
  }, [tests]);

  const categories = useMemo(() => {
    const order = ["face", "body", "hair", "make-up", "oral care"];
    const map = new Map<string, number>();

    // 1. Инициализируем основные категории нулями, чтобы они всегда были видны
    for (const cat of order) {
        map.set(cat, 0);
    }
    
    // 2. Считаем реальные данные
    for (const t of normalizedTests) {
      const key = normalizeCategory(t.category);
      map.set(key, (map.get(key) ?? 0) + 1);
    }

    const arr = Array.from(map.entries()).map(([key, count]) => ({ key, count }));

    arr.sort((a, b) => {
      // make-up vs makeup normalization happens in keys already
      const ai = order.indexOf(String(a.key).toLowerCase());
      const bi = order.indexOf(String(b.key).toLowerCase());
      
      const aRank = ai === -1 ? 999 : ai;
      const bRank = bi === -1 ? 999 : bi;
      
      if (aRank !== bRank) return aRank - bRank;
      return a.key.localeCompare(b.key);
    });

    // Оставляем только те, что в списке order, ЛИБО те, где есть тесты (uncategorized и т.д.)
    return arr.filter(c => order.includes(c.key) || c.count > 0);
  }, [normalizedTests]);

  const [activeCategory, setActiveCategory] = useState<string>(() => categories[0]?.key ?? "uncategorized");

  React.useEffect(() => {
    if (!categories.length) return;
    const exists = categories.some((c) => c.key === activeCategory);
    if (!exists) setActiveCategory(categories[0].key);
  }, [categories, activeCategory]);

  const scopedTests = useMemo(() => {
    return normalizedTests.filter((t) => normalizeCategory(t.category) === activeCategory);
  }, [normalizedTests, activeCategory]);

  const columns: Column[] = useMemo(() => {
    const cols: Column[] = [];

    // Backlog column
    cols.push({
      id: BACKLOG_ID,
      title: "Бэклог",
      icon: <ListTodo className="h-4 w-4" />,
      items: scopedTests.filter((t) => !t.sprint || t.sprint === BACKLOG_ID).slice().sort(sortByPos),
    });

    // Sprint columns (5 weeks)
    for (let i = 1; i <= 5; i++) {
        // Format: YYYY-MM-W# (month is 1-based here for ID consistency with typical logic, or match JS month + 1)
        // User's previous code used `year-${month + 1}-W${i}`
      const sprintVal = `${year}-${month + 1}-W${i}`;
      cols.push({
        id: sprintVal,
        title: `Спринт ${ROMAN[i - 1]}`,
        icon: <CalendarDays className="h-4 w-4" />,
        items: scopedTests.filter((t) => t.sprint === sprintVal).slice().sort(sortByPos),
      });
    }

    return cols;
  }, [scopedTests, year, month]);

  const onDragEnd = useCallback(
    (result: DropResult) => {
      const { destination, source, draggableId } = result;
      if (!destination) return;
      if (destination.droppableId === source.droppableId && destination.index === source.index) return;

      const taskId = Number(String(draggableId).replace("test-", ""));
      if (!Number.isFinite(taskId)) return;
      const draggedTask = scopedTests.find((t) => t.id === taskId);
      if (!draggedTask) return;

      const targetCol = columns.find((c) => c.id === destination.droppableId);
      if (!targetCol) return;

      if (source.droppableId !== destination.droppableId) {
        const newStatus = destination.droppableId === BACKLOG_ID ? "backlog" : "active";
        onMoveTask(taskId, destination.droppableId, newStatus);
      }

      // Calculate new position
      const targetWithoutDragged = targetCol.items.filter((t) => t.id !== taskId);
      const nextList = targetWithoutDragged.slice();
      nextList.splice(destination.index, 0, draggedTask);

      const prev = nextList[destination.index - 1];
      const next = nextList[destination.index + 1];

      let newPos: number;
      if (!prev && !next) newPos = 1000;
      else if (!prev && next) newPos = (next.position ?? 1000) / 2;
      else if (prev && !next) newPos = (prev.position ?? 0) + 1000;
      else newPos = ((prev.position ?? 0) + (next.position ?? 0)) / 2;

      onReorderTask(taskId, Number(newPos.toFixed(4)));
    },
    [columns, onMoveTask, onReorderTask, scopedTests],
  );

  const activeTheme = getCategoryTheme(activeCategory);

  return (
    <div className="flex h-full flex-col bg-design-background w-full">
      {/* Top Panel */}
      <div className="shrink-0 space-y-3 px-4 pt-4">
        {/* Categories */}
        <div className="flex items-center gap-3">
            <div className="flex-1 rounded-2xl border border-slate-100 bg-white px-3 py-2 shadow-sm min-w-0">
            <ScrollArea className="w-full whitespace-nowrap">
                <div className="flex items-center gap-2 py-1">
                {categories.map((c) => {
                    const theme = getCategoryTheme(c.key);
                    const active = c.key === activeCategory;

                    return (
                    <button
                        key={c.key}
                        type="button"
                        onClick={() => setActiveCategory(c.key)}
                        className={cn(
                        "relative rounded-full px-4 py-2 text-xs font-extrabold transition-all",
                        active ? "text-slate-900" : "text-slate-500 hover:text-slate-900"
                        )}
                        style={{
                        backgroundColor: active ? theme.soft : "transparent",
                        }}
                        title={theme.label}
                    >
                        <span className="tracking-[0.16em]">{theme.label}</span>
                        <span className="ml-2 text-[10px] font-black text-slate-500">{c.count}</span>

                        {active && (
                        <span
                            className="absolute left-4 right-4 -bottom-0.5 h-[2px] rounded-full"
                            style={{ backgroundColor: theme.solid }}
                        />
                        )}
                    </button>
                    );
                })}
                </div>
            </ScrollArea>
            </div>
            
            <div className="shrink-0">
                <CreateExpressCardDialog />
            </div>
        </div>


        {/* Date Navigation */}
        <div className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-white px-3 py-2 shadow-sm">
          <div className="flex items-center gap-2 pr-3 border-r border-slate-100">
            <Button type="button" variant="ghost" size="icon" onClick={() => setYear((v) => v - 1)} aria-label="Prev year">
              <ChevronLeft className="h-4 w-4" />
            </Button>

            <div className="min-w-[72px] text-center text-lg font-black text-slate-900">{year}</div>

            <Button type="button" variant="ghost" size="icon" onClick={() => setYear((v) => v + 1)} aria-label="Next year">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <ScrollArea className="w-full whitespace-nowrap">
            <div className="flex space-x-2 py-1">
              {MONTHS.map((label, idx) => {
                const active = month === idx;
                return (
                  <button
                    key={label}
                    type="button"
                    onClick={() => setMonth(idx)}
                    className={cn(
                      "rounded-full px-4 py-2 text-xs font-bold transition-all",
                      active ? "bg-slate-900 text-white shadow" : "text-slate-500 hover:text-slate-900"
                    )}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </ScrollArea>

          <div className="hidden md:flex items-center gap-2 pl-2">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: activeTheme.solid }} />
          </div>
        </div>
      </div>

      {/* Kanban */}
      <div className="flex-1 min-h-0">
        <DragDropContext onDragEnd={onDragEnd}>
          <div className="flex h-full min-h-0 items-start gap-5 overflow-x-auto overflow-y-hidden px-6 pb-6 pt-5">
            {columns.map((col) => {
            const stats = countTypes(col.items);

            return (
              <div
                key={col.id}
                className={cn(
                  "flex h-full min-w-[320px] max-w-[360px] flex-col",
                  "rounded-[22px] border border-slate-200 bg-white shadow-sm"
                )}
              >
                {/* Header */}
                <div className="flex items-center justify-between px-4 pt-4 pb-3">
                  <div className="flex items-center gap-2 text-sm font-extrabold text-slate-800">
                    {col.icon}
                    <span>{col.title}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Badge className="h-6 rounded-full border border-slate-200 bg-slate-50 px-2 text-[10px] font-black text-slate-700">
                      {stats.total}
                    </Badge>

                    <div className="flex items-center gap-2 text-[10px] font-extrabold text-slate-500">
                      <span>CTR {stats.ctr}</span>
                      <span>CR {stats.cr}</span>
                      <span>RICH {stats.rich}</span>
                    </div>
                  </div>
                </div>

                <Droppable droppableId={col.id}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={cn(
                        "mx-3 mb-3 flex-1 rounded-[18px] p-3",
                        "bg-slate-50/60 border border-slate-100",
                        "transition-all duration-200"
                      )}
                      style={
                        snapshot.isDraggingOver
                          ? {
                              background: "rgba(238,242,255,0.55)",
                              boxShadow: "inset 0 0 0 2px rgba(99,102,241,0.20)",
                            }
                          : undefined
                      }
                    >
                      <div className="flex flex-col gap-3 pb-10">
                        {col.items.map((t, index) => (
                          <Draggable key={String(t.id)} draggableId={`test-${t.id}`} index={index}>
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                style={provided.draggableProps.style}
                                className={cn("transition-all duration-150", snapshot.isDragging ? "z-50 rotate-1" : "")}
                              >
                                <SprintCard
                                  test={t}
                                  onClick={() => onSelect(t)}
                                  onDelete={onDeleteTask}
                                  dragHandleProps={provided.dragHandleProps}
                                />
                              </div>
                            )}
                          </Draggable>
                        ))}

                        {provided.placeholder}

                        {col.items.length === 0 && !snapshot.isDraggingOver && (
                          <div className="flex h-24 items-center justify-center rounded-[16px] border border-dashed border-slate-200 bg-white text-xs font-bold text-slate-400">
                            Перетащи сюда
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </Droppable>
              </div>
            );
            })}
          </div>
        </DragDropContext>
      </div>
    </div>
  );
}
