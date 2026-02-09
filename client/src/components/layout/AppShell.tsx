import React from "react";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { Button } from "@/lib/components/ui/button";
import { Badge } from "@/lib/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/lib/components/ui/popover";
import { t } from "@/lib/i18n/t";
import { useAuth } from "@/lib/auth-context";
import { LayoutGrid, FlaskConical, KanbanSquare, HelpCircle, Shield, Activity } from "lucide-react";

interface AppShellProps {
  title?: string;
  subtitle?: string;
  leftAction?: React.ReactNode;
  rightActions?: React.ReactNode;
  activeSection?: "base" | "lab" | "kanban" | "metrics";
  onSwitchSection?: (section: "base" | "lab" | "kanban" | "metrics") => void;
  sectionCounts?: { base?: number; lab?: number; kanban?: number };
  helpContent?: string[];
  children?: React.ReactNode;
  className?: string;
}

export function AppShell({ 
  title, 
  subtitle, 
  leftAction, 
  rightActions, 
  activeSection,
  onSwitchSection,
  sectionCounts,
  helpContent,
  children,
  className 
}: AppShellProps) {
  const [location, setLocation] = useLocation();
  const { user } = useAuth();
  const isAdmin = Boolean(user?.isAdmin || user?.role === "admin");

  const handleSwitch = (section: "base" | "lab" | "kanban" | "metrics") => {
    if (onSwitchSection) {
      onSwitchSection(section);
      return;
    }
    
    if (section === "base") setLocation("/");
    if (section === "lab") {
      setLocation("/laba"); 
    }
    if (section === "kanban") {
      setLocation("/kanban");
    }
    if (section === "metrics") {
      setLocation("/metrics");
    }
  };

  return (
    <div className={cn("min-h-screen bg-design-background", className)}>
      {/* Sticky Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-white/80 backdrop-blur-md shadow-sm">
        <div className="flex h-16 items-center px-8 max-w-[1600px] mx-auto justify-between">
          
          {/* Left: Title & Subtitle */}
          <div className="flex items-center gap-4">
             {leftAction}
             <div>
               <h1 className="text-xl font-bold tracking-tight text-slate-900 leading-tight">
                 {title || "Growth OS"}
               </h1>
               {subtitle && (
                 <p className="text-xs font-medium text-slate-500">{subtitle}</p>
               )}
             </div>
          </div>

          {/* Center: Base/Lab/Kanban Tabs */}
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              title={t("nav.base")}
              onClick={() => handleSwitch("base")}
              className={cn(
                "relative h-9 w-9 rounded-lg transition-all",
                activeSection === "base"
                  ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200"
                  : "text-slate-500 hover:text-slate-700"
              )}
            >
              <LayoutGrid className="h-4 w-4" />
              {sectionCounts?.base !== undefined && (
                <Badge className="absolute -top-1 -right-1 h-5 min-w-[20px] px-1 text-[10px] bg-slate-100 text-slate-600 border border-slate-200">
                  {sectionCounts.base}
                </Badge>
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              title={t("nav.laba")}
              onClick={() => handleSwitch("lab")}
              className={cn(
                "relative h-9 w-9 rounded-lg transition-all",
                activeSection === "lab"
                  ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200"
                  : "text-slate-500 hover:text-slate-700"
              )}
            >
              <FlaskConical className="h-4 w-4" />
              {sectionCounts?.lab !== undefined && (
                <Badge className="absolute -top-1 -right-1 h-5 min-w-[20px] px-1 text-[10px] bg-slate-100 text-slate-600 border border-slate-200">
                  {sectionCounts.lab}
                </Badge>
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              title={t("nav.kanban")}
              onClick={() => handleSwitch("kanban")}
              className={cn(
                "relative h-9 w-9 rounded-lg transition-all",
                activeSection === "kanban"
                  ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200"
                  : "text-slate-500 hover:text-slate-700"
              )}
            >
              <KanbanSquare className="h-4 w-4" />
              {sectionCounts?.kanban !== undefined && (
                <Badge className="absolute -top-1 -right-1 h-5 min-w-[20px] px-1 text-[10px] bg-slate-100 text-slate-600 border border-slate-200">
                  {sectionCounts.kanban}
                </Badge>
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              title={t("nav.metrics")}
              onClick={() => handleSwitch("metrics")}
              className={cn(
                "relative h-9 w-9 rounded-lg transition-all",
                activeSection === "metrics"
                  ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200"
                  : "text-slate-500 hover:text-slate-700"
              )}
            >
              <Activity className="h-4 w-4" />
            </Button>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-3">
            {isAdmin && location !== "/admin" && (
              <Button
                variant="ghost"
                size="sm"
                className="gap-2 text-slate-600"
                onClick={() => setLocation("/admin")}
              >
                <Shield className="w-4 h-4" />
                Админ
              </Button>
            )}
            {helpContent && helpContent.length > 0 && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="sm" className="gap-2 text-slate-500">
                    <HelpCircle className="w-4 h-4" />
                    Что здесь делать?
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-72 text-sm text-slate-600 leading-relaxed">
                  <div className="space-y-1">
                    {helpContent.slice(0, 3).map((line, i) => (
                      <p key={i}>{line}</p>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            )}
            {rightActions}
          </div>
        </div>
      </header>
      
      {/* Main Content */}
      <main className="w-full">
        {children}
      </main>
    </div>
  );
}
