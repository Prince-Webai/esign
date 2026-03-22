"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { UserPlus, Trash2, Mail, Loader2, ShieldCheck, Key, User, ShieldAlert, BadgeCheck, X, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface RegisteredUser {
  id: string;
  name: string;
  email: string;
  role?: string;
  created_at: string;
}

export function UserManager() {
  const [users, setUsers] = useState<RegisteredUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPIN, setNewPIN] = useState(""); 
  const [newRole, setNewRole] = useState("signer");

  useEffect(() => {
    fetchUsers();
  }, []);

  async function fetchUsers() {
    setLoading(true);
    const { data } = await supabase
      .from("registered_users")
      .select("*")
      .order("created_at", { ascending: false });
    
    if (data) setUsers(data);
    setLoading(false);
  }

  async function handleAddUser(e: React.FormEvent) {
    e.preventDefault();
    if (!newName || !newEmail || !newPIN) return;

    setIsAdding(true);
    
    const userData: any = { 
      name: newName, 
      email: newEmail, 
      password_hash: newPIN 
    };

    const { error: initialError } = await supabase
      .from("registered_users")
      .insert([{ ...userData, role: newRole }]);

    if (initialError) {
      const { error: retryError } = await supabase
        .from("registered_users")
        .insert([userData]);

      if (retryError) {
        alert("Error adding user: " + retryError.message);
      } else {
        alert("User added! Reminder: Run setup-database.sql for full role features.");
        resetForm();
      }
    } else {
      resetForm();
    }
    setIsAdding(false);
  }

  const resetForm = () => {
    setNewName("");
    setNewEmail("");
    setNewPIN("");
    setNewRole("signer");
    fetchUsers();
  };

  async function handleDeleteUser(id: string) {
    const { error } = await supabase.from("registered_users").delete().eq("id", id);
    if (!error) {
      fetchUsers();
    } else {
      // Check for foreign key constraint violation (common when user is assigned to documents)
      if (error.code === '23503') {
        alert("Cannot delete: This user is assigned to one or more RAMS documents. Please run the Database Fix in Supabase Settings to allow unlinking.");
      } else {
        alert("Failed to delete: " + error.message);
      }
    }
  }

  async function handleUpdatePIN(id: string, pin: string) {
    const { error } = await supabase
      .from("registered_users")
      .update({ password_hash: pin })
      .eq("id", id);
    
    if (!error) {
      fetchUsers();
      return true;
    } else {
      alert("Update failed: " + error.message);
      return false;
    }
  }

  const admins = users.filter(u => u.role === 'admin');
  const signers = users.filter(u => u.role !== 'admin');

  return (
    <div className="space-y-8 pb-12 animate-in fade-in slide-in-from-top-4 duration-500">
      {/* Create User Card */}
      <div className="bg-white border border-slate-200/60 rounded-2xl p-6 md:p-8 shadow-sm">
        <div className="flex items-center gap-4 mb-6">
           <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <UserPlus className="w-6 h-6" />
           </div>
           <div>
              <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Add User</h2>
              <p className="text-slate-500 text-base">Provision a new account for this portal</p>
           </div>
        </div>

        <form onSubmit={handleAddUser} className="grid grid-cols-1 md:grid-cols-5 gap-5 items-end">
          <div className="space-y-2 text-left md:col-span-1">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 pl-1">Name</label>
            <input 
              value={newName} onChange={(e) => setNewName(e.target.value)}
              placeholder="Full Name"
              className="w-full bg-white border border-slate-200/60 rounded-xl px-4 py-3 text-base font-semibold text-slate-900 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all placeholder:text-slate-400 shadow-sm"
            />
          </div>
          <div className="space-y-2 text-left md:col-span-1">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 pl-1">Email</label>
            <input 
              value={newEmail} onChange={(e) => setNewEmail(e.target.value)}
              placeholder="Email address"
              className="w-full bg-white border border-slate-200/60 rounded-xl px-4 py-3 text-base font-semibold text-slate-900 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all placeholder:text-slate-400 shadow-sm"
            />
          </div>
          <div className="space-y-2 text-left md:col-span-1">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 pl-1">Security PIN</label>
            <div className="relative">
               <Key className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-emerald-500" />
               <input 
                 type="password"
                 value={newPIN} onChange={(e) => setNewPIN(e.target.value)}
                 placeholder="PIN Code"
                 className="w-full bg-white border border-slate-200/60 rounded-xl pl-11 pr-4 py-3 text-base font-semibold text-slate-900 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all placeholder:text-slate-400 shadow-sm"
               />
            </div>
          </div>
          <div className="space-y-2 text-left md:col-span-1">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 pl-1">Account Role</label>
            <div className="relative group">
              <select 
                value={newRole} 
                onChange={(e) => setNewRole(e.target.value)}
                className="w-full bg-white border border-slate-200/60 rounded-xl px-4 py-3 text-base font-semibold text-slate-900 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none appearance-none cursor-pointer shadow-sm"
              >
                <option value="signer">Signer (Execution)</option>
                <option value="admin">Admin (Systems)</option>
              </select>
              <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                 <ShieldCheck className="w-5 h-5" />
              </div>
            </div>
          </div>
          <button 
            disabled={isAdding}
            type="submit"
            className="bg-emerald-600 text-white font-bold h-[48px] rounded-xl flex items-center justify-center gap-2 transition-all shadow-sm hover:bg-emerald-700 text-base active:scale-95 disabled:opacity-50"
          >
            {isAdding ? <Loader2 className="w-4 h-4 animate-spin" /> : "Add User"}
          </button>
        </form>
      </div>

      {/* Lists */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Administrators */}
        <div className="space-y-4">
          <h3 className="text-base font-bold uppercase tracking-wider text-slate-900 flex items-center gap-2 pl-2">
             <div className="w-2 h-2 rounded-full bg-emerald-500" />
             Administrators
          </h3>
          <div className="bg-white border border-slate-200/60 rounded-2xl overflow-hidden shadow-sm">
            {admins.length === 0 ? (
              <div className="p-10 text-center text-slate-500 font-medium text-sm py-16">No administrators found</div>
            ) : (
              <div className="divide-y divide-slate-100">
                {admins.map(user => (
                  <UserRow key={user.id} user={user} onDelete={handleDeleteUser} onUpdatePIN={handleUpdatePIN} />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Signers */}
        <div className="space-y-4">
          <h3 className="text-base font-bold uppercase tracking-wider text-slate-900 flex items-center gap-2 pl-2">
             <div className="w-2 h-2 rounded-full bg-emerald-500" />
             Signers
          </h3>
          <div className="bg-white border border-slate-200/60 rounded-2xl overflow-hidden shadow-sm">
             {signers.length === 0 ? (
                <div className="p-10 text-center text-slate-500 font-medium text-sm py-16">No signers registered</div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {signers.map(user => (
                    <UserRow key={user.id} user={user} onDelete={handleDeleteUser} onUpdatePIN={handleUpdatePIN} />
                  ))}
                </div>
              )}
          </div>
        </div>
      </div>
    </div>
  );
}

function UserRow({ 
  user, 
  onDelete,
  onUpdatePIN 
}: { 
  user: RegisteredUser, 
  onDelete: (id: string) => void,
  onUpdatePIN: (id: string, pin: string) => Promise<boolean>
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isEditingPIN, setIsEditingPIN] = useState(false);
  const [newPIN, setNewPIN] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);

  const performDelete = async () => {
    setIsDeleting(true);
    await onDelete(user.id);
    setIsDeleting(false);
    setConfirmDelete(false);
  };

  const performUpdatePIN = async () => {
    if (newPIN.length < 4) {
      alert("PIN must be 4 digits");
      return;
    }
    setIsUpdating(true);
    const success = await onUpdatePIN(user.id, newPIN);
    if (success) {
      setIsEditingPIN(false);
      setNewPIN("");
    }
    setIsUpdating(false);
  };

  return (
    <div className="group flex flex-col hover:bg-slate-50/50 transition-all divide-y divide-slate-100">
      <div className="flex items-center justify-between p-4 md:p-6">
        <div className="flex items-center gap-4">
          <div className={cn(
            "w-12 h-12 rounded-xl flex items-center justify-center text-base font-bold shadow-sm border transition-transform group-hover:scale-110 duration-300",
            user.role === 'admin' ? "bg-amber-50 border-amber-100 text-amber-600" : "bg-emerald-50 border-emerald-100 text-emerald-600"
          )}>
            {user.name.charAt(0).toUpperCase()}
          </div>
          <div className="space-y-0.5">
            <p className="font-bold text-slate-900 text-base leading-tight tracking-tight">{user.name}</p>
            <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
                {user.email}
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {!confirmDelete && !isEditingPIN && (
            <button 
              onClick={() => setIsEditingPIN(true)}
              className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all border border-transparent hover:border-emerald-100"
              title="Change PIN"
            >
              <Key className="w-4 h-4" />
            </button>
          )}

          {confirmDelete ? (
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200/60 rounded-xl p-1 animate-in fade-in zoom-in duration-200">
              <button 
                onClick={performDelete}
                disabled={isDeleting}
                className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all"
                title="Confirm Removal"
              >
                {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              </button>
              <button 
                onClick={() => setConfirmDelete(false)}
                className="p-1.5 text-slate-400 hover:bg-white rounded-lg transition-all"
                title="Cancel"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : !isEditingPIN ? (
            <button 
              onClick={() => setConfirmDelete(true)}
              className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all border border-transparent hover:border-red-100"
              title="Remove User"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          ) : null}
        </div>
      </div>

      {isEditingPIN && (
        <div className="px-6 py-4 bg-slate-50/50 animate-in slide-in-from-top-4 duration-500">
           <div className="flex items-center gap-4">
              <div className="flex-1 max-w-[200px]">
                <div className="relative">
                  <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-500" />
                  <input 
                    type="password"
                    maxLength={4}
                    value={newPIN}
                    onChange={(e) => setNewPIN(e.target.value)}
                    placeholder="New 4-digit PIN"
                    className="w-full bg-white border border-slate-200/60 rounded-xl pl-9 pr-4 py-2 text-sm font-medium text-slate-900 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all placeholder:text-slate-400 shadow-sm"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={performUpdatePIN}
                  disabled={isUpdating || newPIN.length < 4}
                  className="px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-xl hover:bg-emerald-700 transition-colors disabled:opacity-50 shadow-sm flex items-center gap-2"
                >
                  {isUpdating ? <Loader2 className="w-4 h-4 animate-spin" /> : "Update PIN"}
                </button>
                <button 
                  onClick={() => setIsEditingPIN(false)}
                  className="p-2 bg-white text-slate-400 hover:text-slate-900 border border-slate-200/60 rounded-xl transition-colors shadow-sm"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
}
