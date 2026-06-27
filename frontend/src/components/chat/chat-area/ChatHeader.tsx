import React from "react";
import { Button } from "@/src/components/ui/button";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/src/components/ui/avatar";
import { Lock, Hash, ArrowLeft } from "lucide-react";
import { Channel, SidebarUser } from "@/src/store/chat";

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
    </header>
  );
}
