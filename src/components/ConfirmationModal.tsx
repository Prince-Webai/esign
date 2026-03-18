"use client";

import { X, AlertTriangle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isDanger?: boolean;
  isLoading?: boolean;
}

export function ConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  isDanger = true,
  isLoading = false,
}: ConfirmationModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 animate-in fade-in duration-300">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" 
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative w-full max-w-md bg-white rounded-[40px] shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-8 duration-500">
        <div className="p-10 text-center">
          <div className={cn(
            "w-20 h-20 rounded-[32px] flex items-center justify-center mx-auto mb-8 border transition-all",
            isDanger ? "bg-red-50 border-red-100 text-red-500" : "bg-emerald-50 border-emerald-100 text-emerald-500"
          )}>
            <AlertTriangle className="w-10 h-10" />
          </div>
          
          <h2 className="text-3xl font-black text-slate-900 mb-4 tracking-tight">{title}</h2>
          <p className="text-slate-500 font-medium leading-relaxed mb-10 text-lg">{message}</p>
          
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={onClose}
              disabled={isLoading}
              className="py-5 bg-slate-50 text-slate-400 rounded-3xl font-black text-xs uppercase tracking-widest border border-slate-200 hover:bg-slate-100 hover:text-slate-900 transition-all active:scale-95 disabled:opacity-50"
            >
              {cancelText}
            </button>
            <button
              onClick={onConfirm}
              disabled={isLoading}
              className={cn(
                "py-5 rounded-3xl font-black text-xs uppercase tracking-widest text-white shadow-xl transition-all active:scale-95 flex items-center justify-center gap-3 disabled:opacity-50",
                isDanger ? "bg-red-500 shadow-red-500/20 hover:bg-red-600" : "bg-emerald-600 shadow-emerald-600/20 hover:bg-emerald-700"
              )}
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin text-white" /> : confirmText}
            </button>
          </div>
        </div>

        {/* Close Button */}
        <button 
          onClick={onClose}
          className="absolute top-6 right-6 p-2 text-slate-300 hover:text-slate-900 transition-colors"
        >
          <X className="w-6 h-6" />
        </button>
      </div>
    </div>
  );
}
