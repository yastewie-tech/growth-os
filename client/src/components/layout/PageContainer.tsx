import React from "react";
import { cn } from "@/lib/utils";

interface PageContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function PageContainer({ className, children, ...props }: PageContainerProps) {
  return (
    <div 
      className={cn(
        "min-h-screen bg-design-background w-full flex flex-col items-center",
        className
      )} 
      {...props}
    >
      <div className="w-full max-w-[1600px] px-8 py-8 space-y-8">
        {children}
      </div>
    </div>
  );
}
