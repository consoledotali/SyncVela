import React from "react";
import { useSocket } from "@/src/providers/SocketProvider";
import { useChatStore, SidebarUser } from "@/src/store/chatStore";
import { useAuthStore } from "@/src/store/authStore";

// Shadcn & Icons
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/src/components/ui/avatar";
import { Badge } from "@/src/components/ui/badge";
import { Button } from "@/src/components/ui/button";
import { LogOut, Wifi, WifiOff, Users } from "lucide-react";

export default function Sidebar() {
  const { socket, isConnected } = useSocket();
  const {
    users,
    selectedUser,
    setSelectedUser,
    onlineUsers,
    unreadCounts,
    resetChat,
  } = useChatStore();
  const { user, logout } = useAuthStore();

  const handleUserSelect = (targetUser: SidebarUser) => {
    setSelectedUser(targetUser);
    if (socket) {
      socket.emit("joinPrivateChat", targetUser.id);
    }
  };

  const handleStrictLogout = () => {
    resetChat(); // Memory Wipe
    logout(); // Auth Wipe
  };

  const currentUserInitials = user?.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .substring(0, 2)
    : "Me";

  return (
    <div
      className={`bg-background border-r border-border flex-col h-[100dvh] w-full md:w-80 flex-shrink-0 transition-all ${
        selectedUser ? "hidden md:flex" : "flex"
      }`}
    >
      {/* 🔴 CURRENT USER HEADER */}
      <div className="p-4 border-b border-border bg-muted/10 flex justify-between items-center h-[73px]">
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10 border border-border shadow-sm">
            <AvatarImage
              src={`https://api.dicebear.com/7.x/initials/svg?seed=${user?.name}`}
              alt={user?.name || "User"}
            />
            <AvatarFallback className="bg-primary text-primary-foreground font-semibold">
              {currentUserInitials}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col">
            <h2 className="font-semibold text-sm text-foreground leading-tight truncate max-w-[120px]">
              {user?.name}
            </h2>
            <div className="flex items-center gap-1.5 mt-0.5">
              {isConnected ? (
                <Wifi className="h-3 w-3 text-green-500" />
              ) : (
                <WifiOff className="h-3 w-3 text-destructive animate-pulse" />
              )}
              <span className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider">
                {isConnected ? "Connected" : "Reconnecting"}
              </span>
            </div>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleStrictLogout}
          className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
          title="Logout"
        >
          <LogOut className="h-4.5 w-4.5" />
        </Button>
      </div>

      {/* 🔴 CONTACTS LIST */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden scroll-smooth">
        <div className="px-4 py-3 flex items-center gap-2 mt-2">
          <Users className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
            Direct Messages
          </h3>
        </div>

        <div className="flex flex-col gap-1 px-2 pb-4">
          {users.map((u) => {
            const isOnline = onlineUsers.includes(u.id);
            const unreadCount = unreadCounts[u.id] || 0;
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
                className={`p-2.5 rounded-xl cursor-pointer transition-all flex justify-between items-center group ${
                  isSelected
                    ? "bg-primary shadow-md"
                    : "hover:bg-muted/60 bg-transparent"
                }`}
              >
                <div className="flex items-center gap-3 overflow-hidden">
                  {/* AVATAR WITH ONLINE STATUS BADGE */}
                  <div className="relative shrink-0">
                    <Avatar
                      className={`h-10 w-10 border ${isSelected ? "border-primary-foreground/20" : "border-border"}`}
                    >
                      <AvatarImage
                        src={`https://api.dicebear.com/7.x/initials/svg?seed=${u.name}`}
                        alt={u.name}
                      />
                      <AvatarFallback
                        className={
                          isSelected
                            ? "bg-primary-foreground/20 text-primary-foreground"
                            : "bg-muted text-foreground"
                        }
                      >
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    {isOnline && (
                      <span
                        className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 ${isSelected ? "border-primary bg-green-400" : "border-background bg-green-500"}`}
                      ></span>
                    )}
                  </div>

                  {/* NAME & EMAIL */}
                  <div className="flex flex-col min-w-0">
                    <span
                      className={`text-sm font-semibold truncate ${isSelected ? "text-primary-foreground" : "text-foreground group-hover:text-foreground"}`}
                    >
                      {u.name}
                    </span>
                    <span
                      className={`text-xs truncate max-w-[140px] ${isSelected ? "text-primary-foreground/70" : "text-muted-foreground"}`}
                    >
                      {u.email}
                    </span>
                  </div>
                </div>

                {/* UNREAD BADGE */}
                {unreadCount > 0 && (
                  <Badge
                    variant={isSelected ? "secondary" : "destructive"}
                    className={`h-5 min-w-5 flex items-center justify-center rounded-full px-1.5 text-[10px] shrink-0 ${isSelected ? "bg-primary-foreground text-primary" : ""}`}
                  >
                    {unreadCount}
                  </Badge>
                )}
              </div>
            );
          })}

          {users.length === 0 && (
            <div className="text-center py-10 px-4">
              <p className="text-sm text-muted-foreground font-medium">
                No contacts found.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
