import React from "react";
import { cn } from "@/lib/utils";

interface SectionCardProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}

export function SectionCard({ 
  className, 
  title, 
  subtitle, 
  action, 
  children, 
  ...props 
}: SectionCardProps) {
  return (
    <div 
      className={cn(
        "bg-white rounded-3xl border border-white/50 shadow-sm p-6 md:p-8",
        className
      )} 
      {...props}
    >
      {(title || action) && (
        <div className="flex items-center justify-between mb-6">
          <div>
            {title && <h3 className="text-xl font-bold tracking-tight text-slate-900">{title}</h3>}
            {subtitle && <p className="text-sm text-slate-500 mt-1">{subtitle}</p>}
          </div>
          {action && <div>{action}</div>}
        </div>
      )}
      {children}
    </div>
  );
}
