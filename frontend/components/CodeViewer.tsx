import { cn } from "@/lib/utils";

type CodeViewerProps = {
  filePath: string;
  content: string;
  className?: string;
};

export function CodeViewer({ filePath, content, className }: CodeViewerProps) {
  return (
    <div className={cn("rounded-3xl border border-amber-100/20 bg-white/4 p-5 shadow-[0_18px_60px_rgba(0,0,0,0.28)] backdrop-blur-xl", className)}>
      <h2 className="text-lg font-semibold text-white">Code Viewer</h2>
      <p className="mt-2 truncate text-xs uppercase tracking-[0.14em] text-amber-100/85">
        {filePath || "No file selected"}
      </p>

      <pre className="mt-4 h-[calc(100%-4rem)] overflow-auto rounded-2xl border border-white/15 bg-slate-950/90 p-4 font-mono text-xs leading-6 text-slate-100/90">
        <code>{content}</code>
      </pre>
    </div>
  );
}
