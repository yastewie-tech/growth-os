import { useQuery } from "@tanstack/react-query";
import { AbTest } from "@shared/schema";
import { SprintCard } from "./SprintCard";
import { Loader2, KanbanSquare, Plus } from "lucide-react";
import { useLocation } from "wouter";
import { Button } from "@/lib/components/ui/button";

// Determine columns based on usage
const COLUMNS = [
  { id: "idea", title: "Idea", color: "bg-yellow-400" },
  { id: "backlog", title: "Backlog", color: "bg-slate-400" },
  { id: "todo", title: "В очереди", color: "bg-blue-400" },
  { id: "in-progress", title: "В работе", color: "bg-indigo-500" },
  { id: "review", title: "На проверке", color: "bg-purple-500" },
  { id: "done", title: "Готово", color: "bg-green-500" },
];

export function KanbanBoard({ searchQuery }: { searchQuery: string }) {
  const [_, setLocation] = useLocation();
  const { data: tests, isLoading } = useQuery<AbTest[]>({
    queryKey: ["ab-tests"],
    queryFn: async () => {
      const res = await fetch("/api/tests");
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  if (isLoading) return (
    <div className="flex justify-center items-center h-[50vh] text-slate-400">
       <Loader2 className="w-8 h-8 animate-spin" />
    </div>
  );

  const safeTests = tests || [];
  const filteredTests = safeTests.filter(t => 
    t.productName.toLowerCase().includes(searchQuery.toLowerCase()) || 
    t.sku.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Group by status
  const columns = COLUMNS.map(col => ({
    ...col,
    items: filteredTests.filter(t => {
        // Simple normalization
        const s = (t.status || "backlog").toLowerCase().trim();
        const c = col.id.toLowerCase();
        
        // Direct match or mapping
        if (s === c) return true;
        if (c === "todo" && (s === "to-do" || s === "queued")) return true;
        if (c === "in-progress" && (s === "running" || s === "active")) return true;
        
        return false;
    })
  }));

  // Items that didn't fit into known columns -> Backlog
  const knownIds = new Set(columns.flatMap(c => c.items.map(i => i.id)));
  const unknownItems = filteredTests.filter(t => !knownIds.has(t.id));
  
  if (unknownItems.length > 0) {
      const backlog = columns.find(c => c.id === "backlog");
      if (backlog) {
          // Add only unique
          unknownItems.forEach(item => {
              if (!backlog.items.find(i => i.id === item.id)) {
                  backlog.items.push(item);
              }
          });
      }
  }

  return (
    <div className="flex gap-6 h-full overflow-x-auto pb-6 px-2 snap-x items-start">
       {columns.map(col => (
           <div key={col.id} className="min-w-[320px] max-w-[320px] flex flex-col gap-4 snap-start shrink-0">
               {/* Column Header */}
               <div className="flex items-center justify-between px-3">
                   <div className="flex items-center gap-2">
                        <div className={`w-2.5 h-2.5 rounded-full ${col.color} ring-2 ring-white shadow-sm`} />
                        <span className="font-bold text-sm text-slate-800 tracking-tight">{col.title}</span>
                        <span className="text-[10px] text-slate-400 font-bold bg-white px-2 py-0.5 rounded-full border border-slate-100 shadow-sm">
                             {col.items.length}
                        </span>
                   </div>
                   
                     <Button variant="ghost" size="icon" className="h-6 w-6 rounded-full hover:bg-slate-100 text-slate-400">
                       <Plus className="h-4 w-4" />
                   </Button>
               </div>

               {/* Column Content */}
               <div className="rounded-3xl p-1.5 flex flex-col gap-3 min-h-[200px]">
                   {col.items.length === 0 ? (
                       <div className="h-[200px] rounded-3xl border-2 border-dashed border-slate-100 flex flex-col items-center justify-center text-slate-300 gap-2">
                           <KanbanSquare className="w-8 h-8 opacity-20" />
                           <span className="text-xs font-medium opacity-50">Пусто</span>
                       </div>
                   ) : (
                       col.items.map(test => (
                           <SprintCard 
                             key={test.id} 
                             test={test} 
                             onClick={(t) => setLocation(`/tests/${t.id}`)}
                           />
                       ))
                   )}
               </div>
           </div>
       ))}
    </div>
  );
}