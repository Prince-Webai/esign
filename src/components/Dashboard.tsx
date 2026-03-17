"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { FileText, Check, Clock, ChevronRight, Loader2, User, LogOut } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface AssignedRAMS {
  id: string;
  name: string;
  role_name: string;
  status: string;
  rams_documents: {
    id: string;
    name: string;
    file_path: string;
    status: string;
    created_at: string;
    final_file_path?: string;
  };
  token: string;
}

export function SignerDashboard({ userEmail }: { userEmail: string }) {
  const [documents, setDocuments] = useState<AssignedRAMS[]>([]);
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState("");

  useEffect(() => {
    async function fetchDashboard() {
      setLoading(true);
      
      // 1. Get user details
      const { data: userData } = await supabase
        .from("registered_users")
        .select("id, name")
        .eq("email", userEmail)
        .single();
      
      if (userData) {
        setUserName(userData.name);
        
        // 2. Get assigned documents
        const { data: assignedDocs } = await supabase
          .from("signers")
          .select(`
            id,
            role_name,
            status,
            token,
            rams_documents (
              id,
              name,
              file_path,
              status,
              created_at
            )
          `)
          .eq("assigned_user_id", userData.id)
          .order("created_at", { foreignTable: "rams_documents", ascending: false });

        if (assignedDocs) {
          setDocuments(assignedDocs as any);
        }
      }
      
      setLoading(false);
    }

    if (userEmail) fetchDashboard();
  }, [userEmail]);

  const handleLogout = () => {
    localStorage.removeItem("tre_user_session");
    window.location.href = "/login";
  };

  return (
    <div className="min-h-screen bg-[#020617] text-slate-100 p-6 md:p-12">
      <div className="max-w-5xl mx-auto space-y-12">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-8 border-b border-white/5">
          <div className="space-y-2">
            <h1 className="text-4xl font-bold tracking-tight text-white">
              Welcome back, <span className="text-primary">{userName.split(' ')[0]}</span>
            </h1>
            <p className="text-slate-400 font-medium">You have <span className="text-white font-bold">{documents.filter(d => d.status === 'pending').length} pending</span> documents to sign.</p>
          </div>
          
          <button 
            onClick={handleLogout}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-all border border-white/5"
          >
            <LogOut className="w-4 h-4" />
            <span className="text-sm font-bold uppercase tracking-widest">Logout</span>
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-slate-900/40 backdrop-blur-md p-6 rounded-2xl border border-white/5 shadow-xl">
             <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-4">
                <FileText className="w-5 h-5" />
             </div>
             <p className="text-3xl font-bold">{documents.length}</p>
             <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">Total Assignments</p>
          </div>
          <div className="bg-slate-900/40 backdrop-blur-md p-6 rounded-2xl border border-amber-500/10 shadow-xl shadow-amber-500/5">
             <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center mb-4">
                <Clock className="w-5 h-5" />
             </div>
             <p className="text-3xl font-bold text-amber-400">{documents.filter(d => d.status === 'pending').length}</p>
             <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">Pending Actions</p>
          </div>
          <div className="bg-slate-900/40 backdrop-blur-md p-6 rounded-2xl border border-emerald-500/10 shadow-xl shadow-emerald-500/5">
             <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center mb-4">
                <Check className="w-5 h-5" />
             </div>
             <p className="text-3xl font-bold text-emerald-400">{documents.filter(d => d.status === 'signed').length}</p>
             <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">Completed Items</p>
          </div>
        </div>

        {/* Document List */}
        <div className="space-y-6">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            Active RAMS Documents
          </h2>

          <div className="grid grid-cols-1 gap-4">
            {loading ? (
              <div className="py-20 flex flex-col items-center justify-center gap-4">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">Synchronizing documents...</p>
              </div>
            ) : documents.length === 0 ? (
              <div className="py-20 border-2 border-dashed border-white/5 rounded-3xl flex flex-col items-center justify-center text-center">
                <p className="text-slate-500 italic">No RAMS documents have been assigned to you yet.</p>
              </div>
            ) : (
              documents.map((doc) => (
                <div 
                  key={doc.id}
                  className="group bg-slate-900/40 hover:bg-slate-900/60 transition-all border border-white/5 rounded-2xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-xl"
                >
                  <div className="flex items-center gap-4">
                    <div className={cn(
                      "w-12 h-12 rounded-xl flex items-center justify-center text-slate-950 shadow-lg",
                      doc.status === 'signed' ? "bg-emerald-500 shadow-emerald-500/20" : "bg-amber-500 shadow-amber-500/20"
                    )}>
                      {doc.status === 'signed' ? <Check className="w-6 h-6" /> : <Clock className="w-6 h-6" />}
                    </div>
                    <div>
                      <h3 className="font-bold text-lg group-hover:text-primary transition-colors">{doc.rams_documents.name}</h3>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest bg-white/5 px-2 py-0.5 rounded-md">
                          {doc.role_name}
                        </span>
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                          {new Date(doc.rams_documents.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right hidden md:block">
                       <p className={cn(
                         "text-[10px] font-bold uppercase tracking-[0.2em]",
                         doc.status === 'signed' ? "text-emerald-500" : "text-amber-500"
                       )}>
                         {doc.status === 'signed' ? 'Document Signed' : 'Action Required'}
                       </p>
                    </div>
                    {doc.status === 'pending' ? (
                      <Link 
                        href={`/sign/${doc.token}`}
                        className="flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-primary-foreground font-bold shadow-lg shadow-primary/20 hover:scale-105 transition-all active:scale-95"
                      >
                        Sign Document
                        <ChevronRight className="w-4 h-4" />
                      </Link>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Link 
                          href={`/sign/${doc.token}`}
                          className="flex items-center gap-2 px-6 py-3 rounded-xl bg-white/5 text-slate-400 font-bold hover:bg-white/10 transition-all"
                        >
                          View Record
                          <ChevronRight className="w-4 h-4" />
                        </Link>
                        {doc.rams_documents.status === 'completed' && doc.rams_documents.final_file_path && (
                          <button 
                            onClick={() => {
                              const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/rams/${doc.rams_documents.final_file_path}`;
                              window.open(url, '_blank');
                            }}
                            className="p-3 rounded-xl bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 transition-all border border-emerald-500/20"
                            title="Download Final PDF"
                          >
                            <FileText className="w-5 h-5" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
