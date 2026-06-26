import React from "react";
import { useChatStore, SidebarUser } from "@/src/store/chat";
import { useSocket } from "@/src/providers/SocketProvider";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/src/components/ui/avatar";
import { Badge } from "@/src/components/ui/badge";

export default function DirectMessageList() {
  const { users, selectedUser, setSelectedUser, onlineUsers, unreadCounts } =
    useChatStore();
  const { socket } = useSocket();

  const handleUserSelect = (targetUser: SidebarUser) => {
    setSelectedUser(targetUser);
    if (socket) {
      socket.emit("joinPrivateChat", targetUser.id);
    }
  };

  return (
    <div className="mb-4">
      <div className="mt-6 mb-1 px-2 flex items-center justify-between">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Direct Messages
        </h3>
      </div>

      <div className="flex flex-col gap-0.5 pb-4">
        {users.length === 0 ? (
          <p className="text-[11px] text-muted-foreground px-2 py-1 italic">
            No team members found.
          </p>
        ) : (
          users.map((u) => {
            const isOnline = onlineUsers.includes(u.id);
            const isSelected = selectedUser?.id === u.id;
            const initials = u.name
              .split(" ")
              .map((n) => n[0])
              .join("")
              .toUpperCase()
              .substring(0, 2);

            return (
              <div
                key={u.id}
                onClick={() => handleUserSelect(u)}
                className={`flex justify-between items-center px-2 py-1.5 rounded-md cursor-pointer transition-colors ${
                  isSelected
                    ? "bg-primary/10 text-primary"
                    : "hover:bg-muted/60"
                }`}
              >
                <div className="flex items-center gap-2 overflow-hidden">
                  <div className="relative shrink-0">
                    <Avatar className="h-5 w-5 rounded-sm">
                      <AvatarImage
                        src={`https://api.dicebear.com/7.x/initials/svg?seed=${u.name}`}
                      />
                      <AvatarFallback className="text-[8px] rounded-sm">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <span
                      className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-background ${isOnline ? "bg-green-500" : "bg-transparent"}`}
                    ></span>
                  </div>
                  <span
                    className={`text-sm truncate ${isSelected ? "font-semibold" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    {u.name}
                  </span>
                </div>

                {unreadCounts[u.id] > 0 && (
                  <Badge
                    variant="destructive"
                    className="h-4 min-w-4 flex items-center justify-center rounded-full px-1 text-[9px] shrink-0"
                  >
                    {unreadCounts[u.id]}
                  </Badge>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
