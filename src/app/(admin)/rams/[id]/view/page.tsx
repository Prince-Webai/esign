"use client";

import dynamic from "next/dynamic";
import { useParams } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";

const DocumentInspector = dynamic(
  () => import("@/components/DocumentInspector").then((mod) => mod.DocumentInspector),
  { ssr: false }
);

export default function ViewRAMS() {
  const params = useParams();
  const id = params.id as string;

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <Link 
          href="/" 
          className="p-2 h-10 w-10 flex items-center justify-center rounded-xl bg-secondary hover:bg-secondary/70 transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">RAMS Inspection</h1>
          <p className="text-muted-foreground">View document and check signature integrity.</p>
        </div>
      </div>

      <DocumentInspector ramsId={id} />
    </div>
  );
}
