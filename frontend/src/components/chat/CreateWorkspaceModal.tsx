"use client";

import React, { useState } from "react";
import { useRouter, usePathname } from "next/navigation"; // 🔴 THE FIX: Imports
import { X, Loader2, Briefcase } from "lucide-react";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { useChatStore } from "@/src/store/chat";
import { useAuthStore } from "@/src/store/authStore";

interface CreateWorkspaceModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CreateWorkspaceModal({
  isOpen,
  onClose,
}: CreateWorkspaceModalProps) {
  const [name, setName] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const router = useRouter();
  const pathname = usePathname();
  const { token } = useAuthStore();
  const {
    workspaces,
    setWorkspaces,
    setActiveWorkspaceId,
    setActiveChannelId,
  } = useChatStore();

  if (!isOpen) return null;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !token) return;

    setIsLoading(true);
    try {
      const response = await fetch("http://localhost:5000/api/workspaces", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: name.trim() }),
      });

      if (response.ok) {
        const newWorkspace = await response.json();

        // 1. Update the store with the new workspace
        setWorkspaces([...workspaces, newWorkspace]);

        // 🚀 THE MEMORY WIPE FIX: Naye workspace mein shift hone se pehle purana kachra saaf karo
        useChatStore.getState().setChannels([]);
        useChatStore.getState().setUsers([]);
        useChatStore.getState().setMessages([]);

        // 2. Clear current channel UI & Switch to the new workspace immediately
        setActiveChannelId(null);
        setActiveWorkspaceId(newWorkspace.id);

        setName("");
        onClose();

        // 🚀 THE ESCAPE FIX: Agar user onboarding jail mein tha, toh usay azaad karo
        if (pathname === "/create-workspace") {
          router.push("/");
        }
      } else {
        const err = await response.json();
        alert(err.error || "Failed to create workspace");
      }
    } catch (error) {
      console.error("❌ Workspace creation error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-background border border-border w-full max-w-md rounded-xl shadow-lg p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-muted-foreground hover:text-foreground"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-primary/10 rounded-lg text-primary">
            <Briefcase className="h-6 w-6" />
          </div>
          <h2 className="text-xl font-bold">Build your workspace</h2>
        </div>
        <p className="text-sm text-muted-foreground mb-6">
          This is where your company or team will collaborate.
        </p>

        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="text-sm font-semibold mb-1.5 block">
              Workspace Name
            </label>
            <Input
              autoFocus
              placeholder="e.g. Acme Corp, Design Team"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={40}
            />
          </div>

          <div className="pt-4 flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim() || isLoading}>
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Create Workspace"
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
