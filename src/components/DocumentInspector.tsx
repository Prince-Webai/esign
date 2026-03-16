"use client";

import { useState, useEffect, useRef } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { supabase } from "@/lib/supabase";
import { Check, Loader2, Users, FileText, ChevronLeft, Download } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

export function DocumentInspector({ ramsId }: { ramsId: string }) {
  const [loading, setLoading] = useState(true);
  const [document, setDocument] = useState<any>(null);
  const [allSigners, setAllSigners] = useState<any[]>([]);
  const [fields, setFields] = useState<any[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [numPages, setNumPages] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function init() {
      // 1. Fetch document
      const { data: docData } = await supabase
        .from("rams_documents")
        .select("*")
        .eq("id", ramsId)
        .single();

      if (!docData) return;
      setDocument(docData);

      // 2. Fetch all signers
      const { data: signers } = await supabase
        .from("signers")
        .select("*")
        .eq("rams_id", ramsId);
      
      if (signers) setAllSigners(signers);

      // 3. Fetch template fields
      const { data: templateFields } = await supabase
        .from("template_signature_fields")
        .select("*")
        .eq("template_id", docData.template_id);
      
      if (templateFields) setFields(templateFields);

      setLoading(false);

      // 4. Realtime updates for signatures
      const channel = supabase
        .channel(`rams-inspect-${ramsId}`)
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "signers",
            filter: `rams_id=eq.${ramsId}`,
          },
          (payload) => {
            setAllSigners((prev) => 
              prev.map(s => s.id === payload.new.id ? { ...s, ...payload.new } : s)
            );
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }

    init();
  }, [ramsId]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-20 gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-muted-foreground">Loading RAMS Inspector...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row gap-8">
      {/* Sidebar: Details & Audit */}
      <div className="w-full lg:w-80 space-y-6">
        <div className="bg-card border border-border/50 rounded-2xl p-6 shadow-sm">
           <div className="flex items-center gap-3 mb-6">
             <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
               <FileText className="w-6 h-6" />
             </div>
             <div>
               <h2 className="font-bold text-white leading-tight">Document Audit</h2>
               <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Status: {document.status}</p>
             </div>
           </div>

           <div className="space-y-4">
             <div className="space-y-2">
               <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Participants</p>
               <div className="space-y-2">
                 {allSigners.map(s => (
                   <div key={s.id} className="flex items-center gap-3 p-2 bg-secondary/30 rounded-lg border border-border/30">
                     <div className={cn(
                       "w-6 h-6 rounded-full flex items-center justify-center text-[8px] font-bold",
                       s.status === 'signed' ? "bg-emerald-500 text-black" : "bg-slate-700 text-slate-400"
                     )}>
                       {s.status === 'signed' ? <Check className="w-4 h-4" /> : s.role_name.charAt(0)}
                     </div>
                     <div className="flex-1 min-w-0">
                       <p className="text-xs font-bold truncate text-white">{s.name}</p>
                       <p className="text-[9px] text-muted-foreground uppercase">{s.role_name}</p>
                     </div>
                   </div>
                 ))}
               </div>
             </div>

             {document.status === 'completed' && (
               <a 
                 href={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/rams/${document.final_file_path}`}
                 target="_blank"
                 rel="noreferrer"
                 className="w-full flex items-center justify-center gap-2 py-3 bg-emerald-500 text-black font-bold rounded-xl hover:scale-[1.02] transition-transform shadow-lg shadow-emerald-500/20"
               >
                 <Download className="w-4 h-4" />
                 Download Signed PDF
               </a>
             )}
           </div>
        </div>
      </div>

      {/* Main View: PDF with live overlays */}
      <div className="flex-1 space-y-4">
        <div className="flex items-center justify-between border border-border/50 bg-secondary/20 p-4 rounded-2xl">
           <div className="flex items-center gap-4 text-sm font-bold text-muted-foreground uppercase">
              <span>Page {currentPage} of {numPages}</span>
              <div className="flex gap-2">
                 <button onClick={() => setCurrentPage(c => Math.max(1, c - 1))} className="hover:text-primary transition-colors disabled:opacity-30" disabled={currentPage <= 1}>Prev</button>
                 <div className="w-px h-3 bg-border"></div>
                 <button onClick={() => setCurrentPage(c => Math.min(numPages, c + 1))} className="hover:text-primary transition-colors disabled:opacity-30" disabled={currentPage >= numPages}>Next</button>
              </div>
           </div>
        </div>

        <div className="relative border border-border/50 rounded-2xl overflow-hidden bg-white shadow-2xl flex justify-center">
          <div ref={containerRef} className="relative">
            <Document 
              file={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/rams/${document.file_path}`} 
              onLoadSuccess={({ numPages }) => setNumPages(numPages)}
            >
              <Page 
                pageNumber={currentPage} 
                renderTextLayer={false} 
                renderAnnotationLayer={false}
                width={800}
              />
            </Document>

            {fields.filter(f => f.page_number === currentPage).map((field) => {
              const signerForField = allSigners.find(s => s.role_name === field.role_name);
              if (!signerForField?.signature_data) return null;

              return (
                <div
                  key={field.role_name}
                  style={{
                    position: 'absolute',
                    left: `${field.placement_x}%`,
                    top: `${field.placement_y}%`,
                    width: `${field.width}%`,
                    height: `${field.height}%`,
                    transform: 'translate(-50%, -50%)'
                  }}
                  className="animate-in fade-in zoom-in duration-500"
                >
                  <img src={signerForField.signature_data} className="w-full h-full object-contain mix-blend-multiply" />
                  <div className="absolute -top-4 left-0 text-[8px] font-bold text-slate-500 hover:text-primary transition-colors cursor-default uppercase tracking-tighter whitespace-nowrap bg-white/80 px-1 rounded shadow-sm border border-slate-100">
                    {signerForField.name} ({signerForField.role_name})
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
