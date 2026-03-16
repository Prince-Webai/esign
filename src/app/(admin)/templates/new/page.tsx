"use client";

import dynamic from "next/dynamic";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";

const TemplateCreator = dynamic(
  () => import("@/components/TemplateCreator").then((mod) => mod.TemplateCreator),
  { ssr: false }
);

export default function NewTemplate() {
  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <Link 
          href="/templates" 
          className="p-2 h-10 w-10 flex items-center justify-center rounded-xl bg-secondary hover:bg-secondary/70 transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">New RAMS Template</h1>
          <p className="text-muted-foreground">Upload a sample RAMS and define signature placement areas.</p>
        </div>
      </div>

      <TemplateCreator />
    </div>
  );
}
