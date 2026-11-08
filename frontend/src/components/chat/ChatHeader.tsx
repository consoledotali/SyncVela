import React, { useEffect, useRef, useState } from "react";
import { Button } from "@/src/components/ui/button";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/src/components/ui/avatar";
import { Lock, Hash, ArrowLeft, UserPlus, Users, Search, X } from "lucide-react";
import { Input } from "@/src/components/ui/input";
import { Channel, SidebarUser } from "@/src/types/chat";
import { usePermissions } from "@/src/hooks/usePermissions";
import { resolveAvatarUrl } from "@/src/utils/avatarUtils";
import InviteModal from "@/src/components/channels/InviteModal";
import ChannelMembersModal from "@/src/components/channels/ChannelMembersModal";

interface ChatHeaderProps {
  isChannelView: boolean;
  activeChannel: Channel | undefined;
  selectedUser: SidebarUser | null;
  onBack: () => void;
  searchTerm: string;
  onSearchTermChange: (value: string) => void;
}

export default function ChatHeader({
  isChannelView,
  activeChannel,
  selectedUser,
  onBack,
  searchTerm,
  onSearchTermChange,
}: ChatHeaderProps) {
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [isMembersModalOpen, setIsMembersModalOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isSearchOpen) {
      searchInputRef.current?.focus();
    }
  }, [isSearchOpen]);

  useEffect(() => {
    const resetTask = window.setTimeout(() => {
      setIsSearchOpen(false);
      onSearchTermChange("");
    }, 0);

    return () => window.clearTimeout(resetTask);
  }, [activeChannel?.id, isChannelView, onSearchTermChange, selectedUser?.id]);

  const closeSearch = () => {
    setIsSearchOpen(false);
    onSearchTermChange("");
  };

  const handleSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      closeSearch();
    }
  };

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
              <Avatar className="h-8 w-8 !rounded-md border border-border">
                <AvatarImage
                  src={
                    resolveAvatarUrl(selectedUser?.avatarUrl)
                      ? resolveAvatarUrl(selectedUser?.avatarUrl)
                      : `https://api.dicebear.com/7.x/initials/svg?seed=${selectedUser?.name}`
                  }
                  className="object-cover w-full h-full !rounded-md"
                />
                <AvatarFallback className="!rounded-md bg-primary/10 text-primary font-bold">
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

      <div className="relative ml-auto flex shrink-0 items-center gap-1">
        <div className="relative flex items-center">
          <div
            id="conversation-search-tray"
            className={`absolute right-[calc(100%+0.5rem)] top-1/2 z-30 flex w-[min(22rem,calc(100vw-4.5rem))] origin-right -translate-y-1/2 items-center gap-2 rounded-2xl border border-border/80 bg-card/95 p-2 shadow-2xl shadow-primary/10 ring-1 ring-black/5 backdrop-blur-xl transition-[transform,opacity] duration-200 ease-out motion-reduce:transition-none dark:ring-white/10 ${
              isSearchOpen
                ? "translate-x-0 scale-100 opacity-100"
                : "pointer-events-none translate-x-2 scale-95 opacity-0"
            }`}
            aria-hidden={!isSearchOpen}
          >
            <Input
              ref={searchInputRef}
              value={searchTerm}
              onChange={(event) => onSearchTermChange(event.target.value)}
              onKeyDown={handleSearchKeyDown}
              placeholder="Search messages"
              aria-label="Search messages in this conversation"
              tabIndex={isSearchOpen ? 0 : -1}
              className="h-9 min-w-0 flex-1 rounded-xl border border-border/70 bg-muted/45 px-3 text-sm font-medium shadow-inner shadow-black/[0.03] placeholder:text-muted-foreground/70 focus-visible:border-primary/40 focus-visible:ring-2 focus-visible:ring-primary/15"
            />
            <button
              type="button"
              onClick={closeSearch}
              aria-label="Close message search"
              tabIndex={isSearchOpen ? 0 : -1}
              className="rounded-xl p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => (isSearchOpen ? closeSearch() : setIsSearchOpen(true))}
            aria-label={isSearchOpen ? "Close message search" : "Search messages"}
            aria-expanded={isSearchOpen}
            aria-controls="conversation-search-tray"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
          >
            <Search className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>

        {isChannelView && activeChannel && (
          <>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              onClick={() => setIsMembersModalOpen(true)}
              title="View channel members"
              aria-label="View channel members"
            >
              <Users className="h-4 w-4" aria-hidden="true" />
            </Button>

            {canInvite && (
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-2 text-muted-foreground hover:text-foreground"
                onClick={() => setIsInviteModalOpen(true)}
              >
                <UserPlus className="h-4 w-4" aria-hidden="true" />
                <span className="hidden sm:inline">Add Members</span>
              </Button>
            )}
          </>
        )}
      </div>

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

