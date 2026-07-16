import React, { useState } from "react";
import { Button } from "@/src/components/ui/button";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/src/components/ui/avatar";
import { Lock, Hash, ArrowLeft, UserPlus, Users } from "lucide-react";
import { Channel, SidebarUser } from "@/src/store/chat";
import { usePermissions } from "@/src/hooks/usePermissions"; // 🚀 THE RBAC ENGINE
import InviteModal from "./InviteModal";
import ChannelMembersModal from "../ChannelMembersModal";

interface ChatHeaderProps {
  isChannelView: boolean;
  activeChannel: Channel | undefined;
  selectedUser: SidebarUser | null;
  onBack: () => void;
}

export default function ChatHeader({
  isChannelView,
  activeChannel,
  selectedUser,
  onBack,
}: ChatHeaderProps) {
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [isMembersModalOpen, setIsMembersModalOpen] = useState(false);

  // 🛡️ THE CLEAN UI GATEKEEPER (No more messy if/else checks!)
  const { hasPermission } = usePermissions();
  const canInvite = hasPermission("INVITE_USERS");

  return (
    <header className="sticky top-0 z-10 flex items-center justify-between px-4 py-3 border-b border-border bg-background select-none">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden shrink-0 -ml-2 text-muted-foreground"
          onClick={onBack}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>

        {isChannelView && activeChannel ? (
          <div className="flex flex-col">
            <h2 className="text-[17px] font-bold text-foreground flex items-center gap-1.5 leading-tight">
              {activeChannel.type === "PRIVATE" ? (
                <Lock className="h-4 w-4" />
              ) : (
                <Hash className="h-5 w-5 text-muted-foreground" />
              )}
              {activeChannel.name}
            </h2>
          </div>
        ) : (
          selectedUser && (
            <>
              <Avatar className="h-8 w-8 rounded-md border border-border">
                <AvatarImage
                  src={`https://api.dicebear.com/7.x/initials/svg?seed=${selectedUser.name}`}
                />
                <AvatarFallback className="rounded-md bg-primary/10 text-primary">
                  {selectedUser.name.substring(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col">
                <h2 className="text-[17px] font-bold text-foreground leading-tight">
                  {selectedUser.name}
                </h2>
              </div>
            </>
          )
        )}
      </div>

      {/* Action Buttons Section */}
      {isChannelView && activeChannel && (
        <div className="ml-auto flex items-center gap-2">
          {/* 🟢 VIEW MEMBERS BUTTON (Everyone can view) */}
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-muted-foreground hover:text-foreground"
            onClick={() => setIsMembersModalOpen(true)}
            title="View Channel Members"
          >
            <Users className="h-4 w-4" />
          </Button>

          {/* 🛡️ ADD MEMBERS BUTTON (Strictly controlled by RBAC) */}
          {activeChannel.type === "PRIVATE" && canInvite && (
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-2 text-muted-foreground hover:text-foreground"
              onClick={() => setIsInviteModalOpen(true)}
            >
              <UserPlus className="h-4 w-4" />
              <span className="hidden sm:inline">Add Members</span>
            </Button>
          )}
        </div>
      )}

      {/* Modals */}
      <InviteModal
        isOpen={isInviteModalOpen}
        onClose={() => setIsInviteModalOpen(false)}
      />

      {activeChannel && (
        <ChannelMembersModal
          isOpen={isMembersModalOpen}
          onClose={() => setIsMembersModalOpen(false)}
          channelId={activeChannel.id}
          channelName={activeChannel.name}
        />
      )}
    </header>
  );
}
