import React from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/src/store/authStore";
import { useChatStore } from "@/src/store/chat";
import { useSocket } from "@/src/providers/SocketProvider";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/src/components/ui/avatar";
import { Button } from "@/src/components/ui/button";
import { LogOut } from "lucide-react";

export default function CurrentUserFooter() {
  const { user, logout } = useAuthStore();
  const { resetChat } = useChatStore();
  const { isConnected } = useSocket();
  const router = useRouter();

  const handleStrictLogout = async () => {
    try {
      await fetch("http://localhost:5000/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });
      resetChat();
      logout();
      router.push("/auth/login");
    } catch (error) {
      console.error("❌ Logout failed:", error);
      resetChat();
      logout();
      router.push("/auth/login");
    }
  };

  return (
    <div className="p-3 border-t border-border mt-auto flex items-center justify-between bg-background transition-colors">
      <div className="flex items-center gap-2 overflow-hidden">
        <div className="relative shrink-0">
          <Avatar className="h-8 w-8 rounded-md border border-border">
            <AvatarImage
              src={`https://api.dicebear.com/7.x/initials/svg?seed=${user?.name}`}
            />
            <AvatarFallback className="rounded-md">
              {user?.name?.substring(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <span
            className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-background ${isConnected ? "bg-green-500" : "bg-red-500"}`}
          ></span>
        </div>
        <div className="flex flex-col truncate">
          <span className="text-sm font-bold leading-none truncate">
            {user?.name}
          </span>
          <span className="text-[10px] text-muted-foreground mt-1 truncate">
            {isConnected ? "Available" : "Offline / Reconnecting..."}
          </span>
        </div>
      </div>

      <Button
        variant="ghost"
        size="icon"
        onClick={handleStrictLogout}
        className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0"
        title="Logout"
      >
        <LogOut className="h-4 w-4" />
      </Button>
    </div>
  );
}
