"use client";

import dynamic from "next/dynamic";
import { useParams, useRouter } from "next/navigation";
import { ChevronLeft, Trash2 } from "lucide-react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

const TemplateCreator = dynamic(
  () => import("@/components/TemplateCreator").then((mod) => mod.TemplateCreator),
  { ssr: false }
);

export default function EditTemplate() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const deleteTemplate = async () => {
    if (!confirm("Are you sure you want to delete this template? All associated data will be lost.")) return;
    
    const { error } = await supabase.from("rams_templates").delete().eq("id", id);
    if (error) {
      alert("Error deleting template");
    } else {
      router.push("/templates");
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link 
            href="/templates" 
            className="p-2 h-10 w-10 flex items-center justify-center rounded-xl bg-secondary hover:bg-secondary/70 transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">Edit RAMS Template</h1>
            <p className="text-muted-foreground">Adjust signature fields and default roles.</p>
          </div>
        </div>
        <button 
          onClick={deleteTemplate}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-destructive/10 text-destructive hover:bg-destructive/20 border border-destructive/20 font-bold transition-all text-sm"
        >
          <Trash2 className="w-4 h-4" />
          Delete Template
        </button>
      </div>

      <TemplateCreator templateId={id} />
    </div>
  );
}
