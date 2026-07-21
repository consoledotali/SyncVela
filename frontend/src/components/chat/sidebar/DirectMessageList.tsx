import React from "react";
import { useChatStore } from "@/src/store/chat";
import { useSocket } from "@/src/providers/SocketProvider";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/src/components/ui/avatar";
import { Badge } from "@/src/components/ui/badge";

export default function DirectMessageList() {
  const {
    users,
    selectedUser,
    setSelectedUser,
    onlineUsers,
    unreadCounts,
    clearUnread,
  } = useChatStore();
  const { socket } = useSocket();

  const handleUserSelect = (targetUser: any) => {
    setSelectedUser(targetUser);
    clearUnread(targetUser.id);
    if (socket) {
      socket.emit("joinPrivateChat", targetUser.id);
    }
  };

  const sortedUsers = [...users].sort((a: any, b: any) => {
    const timeA = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
    const timeB = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;

    const aCount =
      unreadCounts[a.id] !== undefined
        ? unreadCounts[a.id]
        : a.unreadCount || 0;
    const bCount =
      unreadCounts[b.id] !== undefined
        ? unreadCounts[b.id]
        : b.unreadCount || 0;

    if (timeA !== timeB && (timeA > 0 || timeB > 0)) {
      return timeB - timeA;
    }

    if (aCount !== bCount) {
      return bCount - aCount;
    }

    return a.name.localeCompare(b.name);
  });

  return (
    <div className="mb-4">
      <div className="mt-6 mb-1 px-2 flex items-center justify-between">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Direct Messages
        </h3>
      </div>

      <div className="flex flex-col gap-0.5 pb-4">
        {sortedUsers.length === 0 ? (
          <p className="text-[11px] text-muted-foreground px-2 py-1 italic">
            No team members found.
          </p>
        ) : (
          sortedUsers.map((u: any) => {
            const isOnline = onlineUsers.includes(u.id);
            const isSelected = selectedUser?.id === u.id;

            const count =
              unreadCounts[u.id] !== undefined
                ? unreadCounts[u.id]
                : u.unreadCount || 0;
            const isUnread = count > 0 && !isSelected;

            const initials = u.name
              .split(" ")
              .map((n: string) => n[0])
              .join("")
              .toUpperCase()
              .substring(0, 2);

            return (
              <div
                key={u.id}
                onClick={() => handleUserSelect(u)}
                className={`flex justify-between items-center px-2 py-1.5 rounded-md cursor-pointer transition-colors ${
                  isSelected
                    ? "bg-primary/10 text-primary font-bold"
                    : isUnread
                      ? "hover:bg-muted/60 text-foreground font-bold"
                      : "hover:bg-muted/60 text-muted-foreground font-medium"
                }`}
              >
                <div className="flex items-center gap-2 overflow-hidden">
                  <div className="relative shrink-0">
                    <Avatar className="h-5 w-5 !rounded-md">
                      <AvatarImage
                        src={
                          u?.avatarUrl
                            ? u.avatarUrl
                            : `https://api.dicebear.com/7.x/initials/svg?seed=${u?.name}`
                        }
                        className="object-cover w-full h-full !rounded-md"
                      />
                      <AvatarFallback className="text-[8px] !rounded-md text-foreground/70 bg-muted-foreground/20 font-bold">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <span
                      className={`absolute -bottom-0.5 -right-0.5 w-[9px] h-[9px] rounded-full border-[1.5px] border-[#f8f9fa] ${isOnline ? "bg-green-500" : "bg-transparent"}`}
                    ></span>
                  </div>
                  <span
                    className={`text-sm truncate ${isUnread ? "font-bold text-foreground" : "hover:text-foreground"}`}
                  >
                    {u.name}
                  </span>
                </div>
                {isUnread && (
                  <Badge
                    variant="destructive"
                    className="h-4 min-w-4 flex items-center justify-center rounded-full px-1 text-[9px] shrink-0 font-bold"
                  >
                    {count}
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
