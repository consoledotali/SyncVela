import React from "react";
import { Hash } from "lucide-react";
import { Workspace } from "@/src/store/chat";

interface EmptyStateProps {
  activeWorkspace: Workspace | undefined;
}

export default function EmptyState({ activeWorkspace }: EmptyStateProps) {
  return (
    <div className="hidden md:flex flex-1 items-center justify-center bg-background h-[100dvh]">
      <div className="text-center space-y-3 px-4">
        <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-muted">
          <Hash className="h-8 w-8 text-muted-foreground" />
        </div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">
          Welcome to {activeWorkspace ? activeWorkspace.name : "SyncVela"}
        </h2>
        <p className="text-muted-foreground text-sm max-w-sm mx-auto">
          Select a channel or direct message from the sidebar to get started.
        </p>
      </div>
    </div>
  );
}
