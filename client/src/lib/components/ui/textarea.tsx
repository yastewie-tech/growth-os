/* eslint-disable react/display-name */
// @ts-nocheck
import * as React from "react"
import { cn } from "../../utils"
import Editor from "react-simple-code-editor"
import Prism from "prismjs";
import "prismjs/components/prism-json";
import "prismjs/themes/prism.css"; // Using standard theme as base

// Custom styles to make Prism theme match our design system better
const customStyles = `
  .token.property { color: #222; font-weight: 500; }
  .token.string { color: #0f766e; }
  .token.number { color: #0369a1; }
  .token.boolean { color: #be185d; }
  .token.null { color: #71717a; }
  .token.punctuation { color: #94a3b8; }
`;

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
    disableHighlight?: boolean;
}

const JsonViewer = ({ data, level = 0 }: { data: any, level?: number }) => {
    if (data === null) return <span className="text-slate-400 italic">null</span>;
    
    if (Array.isArray(data)) {
        if (data.length === 0) return <span className="text-slate-300">[]</span>;
        return (
            <div className="flex flex-col gap-3">
                {data.map((item, i) => (
                    <div key={i} className="relative pl-4 border-l-2 border-slate-100/80">
                         {/* Optional index label? <div className="absolute -left-[21px] top-0 text-[10px] text-slate-300 select-none bg-white py-1">{i}</div> */}
                         <JsonViewer data={item} level={level} />
                    </div>
                ))}
            </div>
        )
    }

    if (typeof data === 'object') {
        if (Object.keys(data).length === 0) return <span className="text-slate-300">{"{}"}</span>;
        return (
            <div className={cn("grid gap-3", level > 0 ? "grid-cols-1" : "")}>
                {Object.entries(data).map(([key, value]) => {
                     // Heuristic: if value is a long string, primitive or array, use full width. 
                     // Logic: Render key as a label-block, value as content-block
                     
                     const isComplex = typeof value === 'object' && value !== null;
                     
                     return (
                        <div key={key} className={cn(
                            "group/item rounded-lg transition-all",
                            level === 0 ? "bg-slate-50 border border-slate-200 p-3" : "pl-1 border-l border-transparent hover:border-slate-200"
                        )}>
                            <div className="flex items-baseline gap-2 mb-1.5">
                                <span className={cn(
                                    "text-xs font-bold uppercase tracking-wider select-none", 
                                    level === 0 ? "text-slate-700" : "text-slate-400"
                                )}>
                                    {key.replace(/_/g, ' ')}
                                </span>
                                {/* Optional type badge? */}
                            </div>
                            
                            <div className={cn("text-sm text-slate-700 leading-relaxed break-words", isComplex ? "mt-2" : "")}>
                                <JsonViewer data={value} level={level + 1} />
                            </div>
                        </div>
                     );
                })}
            </div>
        );
    }

    return <span>{String(data)}</span>;
}


const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(({ className, value, defaultValue, onChange, disableHighlight, ...props }, ref) => {
    const isControlled = value !== undefined;
    const [isFocused, setIsFocused] = React.useState(false);
    
    const [code, setCode] = React.useState<string>(
        isControlled ? String(value) : (defaultValue ? String(defaultValue) : "")
    );

    const containerRef = React.useRef<HTMLDivElement>(null);
    const textareaRef = React.useRef<HTMLTextAreaElement | null>(null);

    React.useEffect(() => {
        if (isControlled) {
            setCode(String(value));
        }
    }, [value, isControlled]);

    // Parse JSON for Preview Mode
    const previewData = React.useMemo(() => {
        if (disableHighlight) return null;
        try {
            const trimmed = code.trim();
            if ((trimmed.startsWith('{') || trimmed.startsWith('[')) && trimmed.length > 2) {
                 return JSON.parse(code);
            }
        } catch(e) { return null; }
        return null;
    }, [code, disableHighlight]);

    // Auto-prettify when switching to Edit mode if needed (optional, keeping previous logic)
    // We'll skip aggressive auto-format on mount to avoid layout shifts in this new design, 
    // relying on the View Mode to make it look good.
    // However, if the user explicitly clicks edit, it might be nice to format it for them.
    
    const handleFocus = (e: React.FocusEvent<HTMLTextAreaElement>) => {
        setIsFocused(true);
        props.onFocus?.(e);
        
        // Auto-format on focus if it's minified JSON
        if (previewData && !code.includes('\n')) {
             const formatted = JSON.stringify(previewData, null, 2);
             if (formatted !== code) {
                 setCode(formatted);
                 // We don't trigger onChange here to avoid "dirtying" the form just by focusing
             }
        }
    };

    const handleBlur = (e: React.FocusEvent<HTMLTextAreaElement>) => {
        setIsFocused(false);
        props.onBlur?.(e);
    };

    const handlePreviewClick = () => {
        setIsFocused(true);
        // Find internal textarea and focus it
        if (containerRef.current) {
            const textarea = containerRef.current.querySelector('textarea');
            textarea?.focus();
        }
    };

    // Ref forwarding
    React.useEffect(() => {
        if (!containerRef.current) return;
        const innerTextarea = containerRef.current.querySelector('textarea');
        if (innerTextarea) {
             textareaRef.current = innerTextarea;
             if (typeof ref === 'function') {
                 ref(innerTextarea);
             } else if (ref) {
                 (ref as React.MutableRefObject<HTMLTextAreaElement | null>).current = innerTextarea;
             }
        }
    }, [ref, containerRef]); 

    // Handle typing
    const onValueChange = (newCode: string) => {
        if (!isControlled) {
            setCode(newCode);
        }
        if (onChange) {
             const event = {
                 target: {
                     value: newCode,
                     name: props.name,
                     type: 'textarea',
                 },
                 currentTarget: {
                    value: newCode,
                    name: props.name,
                 }
             } as unknown as React.ChangeEvent<HTMLTextAreaElement>;
             onChange(event);
        }
    };

    const highlight = (code: string) => {
        if (disableHighlight) return code;
        try {
            return Prism.highlight(code, Prism.languages.json, 'json');
        } catch (e) {
            return code;
        }
    };

    const showPreview = !isFocused && previewData !== null;

    return (
        <div 
          ref={containerRef} 
          className={cn(
            "relative w-full rounded-md border border-slate-200 bg-white text-sm ring-offset-white focus-within:ring-2 focus-within:ring-slate-950 focus-within:ring-offset-2 transition-all",
            className
          )}
        >
          <style>{customStyles}</style>

          {/* Preview Overlay */}
          {showPreview && (
              <div 
                onClick={handlePreviewClick}
                className="absolute inset-0 z-10 w-full h-full overflow-auto p-3 bg-white rounded-md cursor-text hover:bg-slate-50/30 transition-colors"
              >
                  <JsonViewer data={previewData} />
              </div>
          )}

          {/* Editor - Hidden visually when preview is active, but kept in DOM */}
          <div className={cn(showPreview ? "opacity-0 pointer-events-none absolute inset-0" : "relative")}>
            <Editor
                value={code}
                onValueChange={onValueChange}
                highlight={highlight}
                padding={10}
                onFocus={handleFocus}
                onBlur={handleBlur}
                textareaClassName="focus:outline-none bg-transparent"
                style={{
                fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
                fontSize: 14,
                backgroundColor: 'transparent',
                minHeight: '80px',
                }}
                {...props} 
            />
          </div>
        </div>
    )
})

Textarea.displayName = "Textarea"
export { Textarea }



