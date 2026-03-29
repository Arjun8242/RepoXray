"use client";

import { type ReactNode, useMemo, useState } from "react";
import { motion } from "framer-motion";
import type { TreeNode } from "@/lib/types";
import { cn } from "@/lib/utils";

type FileTreeProps = {
  nodes: TreeNode[];
  selectedPath: string;
  onSelectFile: (path: string) => void;
  className?: string;
};

export function FileTree({ nodes, selectedPath, onSelectFile, className }: FileTreeProps) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const topLevelFolders = useMemo(() => nodes.filter((item) => item.type === "folder").map((item) => item.path), [nodes]);

  const expandedWithDefaults = useMemo(() => {
    const defaults: Record<string, boolean> = { ...expanded };
    for (const path of topLevelFolders) {
      if (defaults[path] === undefined) {
        defaults[path] = true;
      }
    }
    return defaults;
  }, [expanded, topLevelFolders]);

  function toggleFolder(path: string) {
    setExpanded((prev) => ({ ...prev, [path]: !prev[path] }));
  }

  function renderNodes(list: TreeNode[], depth = 0): ReactNode {
    return (
      <ul className="grid gap-1">
        {list.map((node) => {
          if (node.type === "folder") {
            const isOpen = !!expandedWithDefaults[node.path];
            return (
              <li key={node.path}>
                <button
                  type="button"
                  onClick={() => toggleFolder(node.path)}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm text-slate-100/85 transition hover:bg-white/6"
                  style={{ paddingLeft: `${10 + depth * 14}px` }}
                >
                  <span className="w-4 text-center text-teal-100/90">{isOpen ? "v" : ">"}</span>
                  <span className="truncate">{node.name}</span>
                </button>
                {isOpen && node.children.length > 0 ? renderNodes(node.children, depth + 1) : null}
              </li>
            );
          }

          const isSelected = selectedPath === node.path;
          return (
            <li key={node.path}>
              <motion.button
                whileHover={{ x: 2 }}
                type="button"
                onClick={() => onSelectFile(node.path)}
                className={cn(
                  "w-full truncate rounded-lg px-2 py-1.5 text-left text-sm transition",
                  isSelected ? "bg-teal-300/20 text-teal-50" : "text-slate-100/75 hover:bg-white/6",
                )}
                style={{ paddingLeft: `${28 + depth * 14}px` }}
                title={node.path}
              >
                {node.name}
              </motion.button>
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <div className={cn("rounded-3xl border border-amber-100/20 bg-white/4 p-5 shadow-[0_18px_60px_rgba(0,0,0,0.28)] backdrop-blur-xl", className)}>
      <h2 className="text-lg font-semibold text-white">Codebase Explorer</h2>
      <div className="mt-4 h-[calc(100%-2.5rem)] overflow-auto pr-2">{nodes.length ? renderNodes(nodes) : <p className="text-sm text-slate-200/70">No files available.</p>}</div>
    </div>
  );
}
