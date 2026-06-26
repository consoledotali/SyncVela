import React, { useState } from "react";
import { useChatStore } from "@/src/store/chat";
import { MessageSquare, ChevronDown, UserPlus, Plus } from "lucide-react";

interface WorkspaceDropdownProps {
  onOpenCreateModal: () => void;
}

export default function WorkspaceDropdown({ onOpenCreateModal }: WorkspaceDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  
  const { workspaces, activeWorkspaceId, setActiveWorkspaceId, setActiveChannelId, setSelectedUser } = useChatStore();
  const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId);

  const handleCopyInviteLink = () => {
    const workspaceObj = activeWorkspace as any;
    if (workspaceObj && workspaceObj.inviteCode) {
      const link = `${window.location.origin}/invite/${workspaceObj.inviteCode}`;
      navigator.clipboard.writeText(link);
      alert(`✅ Invite link copied!\nShare this with your team:\n${link}`);
    } else {
      alert("⚠️ Invite code not found for this workspace. Check database.");
    }
    setIsOpen(false);
  };

  return (
    <div className="relative z-40">
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className="p-4 flex justify-between items-center h-[60px] cursor-pointer hover:bg-muted/50 transition-colors border-b border-border/50 select-none"
      >
        <div className="flex items-center gap-2 font-bold text-lg text-foreground truncate">
          <MessageSquare className="h-5 w-5 text-primary shrink-0" fill="currentColor" />
          <span className="truncate">{activeWorkspace ? activeWorkspace.name : "SyncVela"}</span>
        </div>
        <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
      </div>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setIsOpen(false)}></div>
          <div className="absolute top-[55px] left-2 right-2 bg-background border border-border rounded-lg shadow-xl py-1 z-50">
            <div className="px-3 py-2 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
              Switch Workspace
            </div>
            <div className="max-h-48 overflow-y-auto">
              {workspaces.map((w) => (
                <div
                  key={w.id}
                  onClick={() => { 
                    if (w.id !== activeWorkspaceId) {
                      setActiveChannelId(null); 
                      setSelectedUser(null);
                      useChatStore.getState().setActiveWorkspaceId(w.id); 
                    }
                    setIsOpen(false); 
                  }}
                  className={`px-3 py-2.5 text-sm cursor-pointer transition-colors ${
                    w.id === activeWorkspaceId 
                      ? "bg-primary/10 text-primary font-bold" 
                      : "hover:bg-muted text-foreground font-medium"
                  }`}
                >
                  {w.name}
                </div>
              ))}
            </div>
            
            <div className="border-t border-border mt-1 mb-1"></div>
            
            <div onClick={handleCopyInviteLink} className="px-3 py-2 text-sm cursor-pointer hover:bg-muted text-foreground font-medium flex items-center gap-2">
              <UserPlus className="h-4 w-4" /> Invite people to {activeWorkspace?.name || "workspace"}
            </div>

            <div onClick={() => { setIsOpen(false); onOpenCreateModal(); }} className="px-3 py-2 text-sm cursor-pointer hover:bg-muted text-primary font-bold flex items-center gap-2">
              <Plus className="h-4 w-4" /> Create new workspace
            </div>
          </div>
        </>
      )}
    </div>
  );
}