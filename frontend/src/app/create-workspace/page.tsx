"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Briefcase, Sparkles } from "lucide-react";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { useChatStore } from "@/src/store/chat";
import { useAuthStore } from "@/src/store/authStore";
import { authFetch } from "@/src/lib/authFetch";

export default function CreateWorkspacePage() {
  const [name, setName] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const router = useRouter();
  const { token, user } = useAuthStore();
  const { setWorkspaces, setActiveWorkspaceId, setActiveChannelId } =
    useChatStore();

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !token) return;

    setIsLoading(true);
    try {
      const response = await authFetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/workspaces`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: name.trim() }),
      });

      if (response.ok) {
        const newWorkspace = await response.json();

        // 🚀 THE STORE INJECTION
        setWorkspaces([newWorkspace]);

        // 🚀 THE MEMORY WIPE (Safety Check)
        useChatStore.getState().setChannels([]);
        useChatStore.getState().setUsers([]);
        useChatStore.getState().setMessages([]);

        // 🚀 SET ACTIVE STATE
        setActiveChannelId(null);
        setActiveWorkspaceId(newWorkspace.id);
        localStorage.setItem("lastActiveWorkspaceId", newWorkspace.id);

        // 🚀 THE ESCAPE: Unlock the user and send them to the dashboard
        router.push("/");
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
    <div className="min-h-screen bg-zinc-50 flex flex-col justify-center items-center p-4">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#e5e7eb_1px,transparent_1px),linear-gradient(to_bottom,#e5e7eb_1px,transparent_1px)] bg-[size:24px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]" />

      <div className="w-full max-w-md bg-white/90 backdrop-blur-md rounded-2xl shadow-xl border border-zinc-200 p-8 sm:p-10 relative z-10 animate-in slide-in-from-bottom-4 fade-in duration-500">
        <div className="flex flex-col items-center mb-8 text-center">
          <div className="h-14 w-14 bg-primary/10 rounded-2xl flex items-center justify-center mb-5 border border-primary/20 shadow-sm">
            <Briefcase className="h-7 w-7 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-zinc-900 mb-2 tracking-tight">
            Welcome to SyncVela, {user?.name?.split(" ")[0] || "User"}!
          </h1>
          <p className="text-sm text-zinc-500 leading-relaxed max-w-[280px]">
            To get started, you need to create a workspace for your team to
            collaborate.
          </p>
        </div>

        <form onSubmit={handleCreate} className="space-y-6">
          <div className="space-y-2">
            <label
              htmlFor="workspaceName"
              className="text-sm font-semibold text-zinc-900 flex items-center gap-2"
            >
              Workspace Name <Sparkles className="h-3.5 w-3.5 text-amber-500" />
            </label>
            <Input
              id="workspaceName"
              autoFocus
              placeholder="e.g. Acme Corp, Engineering Team"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={40}
              className="h-12 bg-white text-base focus-visible:ring-primary/50"
            />
          </div>

          <Button
            type="submit"
            disabled={!name.trim() || isLoading}
            className="w-full h-12 text-[15px] font-semibold transition-all shadow-md hover:shadow-lg disabled:opacity-50"
          >
            {isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              "Create My Workspace"
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}

