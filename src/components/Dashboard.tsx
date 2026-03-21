"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { FileText, Check, Clock, ChevronRight, Loader2, User, LogOut } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { useOrganization } from "@/hooks/useOrganization";

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
  const { org } = useOrganization();
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
    <div className="min-h-screen bg-slate-50 text-slate-900 p-6 md:p-8 animate-in fade-in slide-in-from-top-4 duration-500">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-slate-200/60">
          <div className="space-y-2">
            {org.logo_url ? (
              <img src={org.logo_url} alt={org.name} className="h-8 object-contain mb-4" />
            ) : (
              <div className="inline-flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center font-bold text-white text-xs shadow-sm">TRE</div>
                <span className="font-bold text-slate-900 tracking-tight text-sm">{org.name}</span>
              </div>
            )}
            <div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900">
                Welcome back, <span className="text-primary">{userName.split(' ')[0]}</span>
              </h1>
              <p className="text-slate-500 text-sm font-medium mt-1">You have <span className="text-slate-900 font-semibold">{documents.filter(d => d.status === 'pending').length} pending</span> documents to sign.</p>
            </div>

          </div>
          
          <button 
            onClick={handleLogout}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-600 hover:text-slate-900 transition-colors border border-slate-200/60 shadow-sm"
          >
            <LogOut className="w-4 h-4" />
            <span className="text-sm font-medium">Logout</span>
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-sm hover:shadow-md transition-shadow">
             <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-4">
                <FileText className="w-5 h-5" />
             </div>
             <p className="text-3xl font-bold tracking-tight text-slate-900">{documents.length}</p>
             <p className="text-sm font-medium text-slate-500 mt-1">Total Assignments</p>
          </div>
          <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-sm hover:shadow-md transition-shadow">
             <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 border border-amber-100 flex items-center justify-center mb-4">
                <Clock className="w-5 h-5" />
             </div>
             <p className="text-3xl font-bold tracking-tight text-slate-900">{documents.filter(d => d.status === 'pending').length}</p>
             <p className="text-sm font-medium text-slate-500 mt-1">Pending Actions</p>
          </div>
          <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-sm hover:shadow-md transition-shadow">
             <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center mb-4">
                <Check className="w-5 h-5" />
             </div>
             <p className="text-3xl font-bold tracking-tight text-slate-900">{documents.filter(d => d.status === 'signed').length}</p>
             <p className="text-sm font-medium text-slate-500 mt-1">Completed Items</p>
          </div>
        </div>

        {/* Document List */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2 text-slate-900">
            <FileText className="w-5 h-5 text-primary" />
            Active RAMS Documents
          </h2>

          <div className="grid grid-cols-1 gap-4">
            {loading ? (
              <div className="py-20 flex flex-col items-center justify-center gap-4">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <p className="text-slate-500 font-medium text-sm">Loading assignments...</p>
              </div>
            ) : documents.length === 0 ? (
              <div className="py-16 border border-slate-200/60 bg-white shadow-sm rounded-2xl flex flex-col items-center justify-center text-center">
                <p className="text-sm font-medium text-slate-500">No RAMS documents have been assigned to you yet.</p>
              </div>
            ) : (
              documents.map((doc) => (
                <div 
                  key={doc.id}
                  className="group bg-white hover:bg-slate-50/50 transition-all border border-slate-200/60 rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-sm hover:shadow-md"
                >
                  <div className="flex items-center gap-4">
                    <div className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center shadow-sm",
                      doc.status === 'signed' ? "bg-emerald-50 border border-emerald-100 text-emerald-600" : "bg-amber-50 border border-amber-100 text-amber-600"
                    )}>
                      {doc.status === 'signed' ? <Check className="w-5 h-5" /> : <Clock className="w-5 h-5" />}
                    </div>
                    <div>
                      <h3 className="font-medium text-slate-900 text-sm group-hover:text-primary transition-colors">{doc.rams_documents.name}</h3>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-xs font-medium text-slate-600 bg-slate-100 px-2.5 py-1 rounded-md">
                          {doc.role_name}
                        </span>
                        <span className="text-xs text-slate-500">
                          {new Date(doc.rams_documents.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right hidden md:block">
                       <p className={cn(
                         "text-[11px] font-medium px-2.5 py-1 rounded-md border",
                         doc.status === 'signed' ? "text-emerald-700 bg-emerald-50 border-emerald-100" : "text-amber-700 bg-amber-50 border-amber-100"
                       )}>
                         {doc.status === 'signed' ? 'Document Signed' : 'Action Required'}
                       </p>
                    </div>
                    {doc.status === 'pending' ? (
                      <Link 
                        href={`/sign/${doc.token}`}
                        className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground font-medium text-sm shadow-sm hover:bg-primary/90 transition-colors"
                      >
                        Sign
                        <ChevronRight className="w-4 h-4 text-primary-foreground/70" />
                      </Link>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Link 
                          href={`/sign/${doc.token}`}
                          className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-slate-50 border border-slate-200/60 text-slate-700 font-medium text-sm hover:bg-slate-100 transition-colors shadow-sm"
                        >
                          View
                          <ChevronRight className="w-4 h-4 text-slate-400" />
                        </Link>
                        {doc.rams_documents.status === 'completed' && doc.rams_documents.final_file_path && (
                          <button 
                            onClick={() => {
                              const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/rams/${doc.rams_documents.final_file_path}`;
                              window.open(url, '_blank');
                            }}
                            className="p-2 rounded-xl bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-colors border border-emerald-100 shadow-sm"
                            title="Download Final PDF"
                          >
                            <FileText className="w-4 h-4" />
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
