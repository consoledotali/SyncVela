"use client";

import React, { useState } from "react";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/src/components/ui/dialog";
import AvatarUploader from "../../profile/AvatarUploader";

export default function CurrentUserFooter() {
  const { user, logout } = useAuthStore();
  const { resetChat } = useChatStore();
  const { isConnected } = useSocket();
  const router = useRouter();

  const [isProfileOpen, setIsProfileOpen] = useState(false);

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
    <>
      <div className="p-3 border-t border-border mt-auto flex items-center justify-between bg-background transition-colors">
        <div
          onClick={() => setIsProfileOpen(true)}
          className="flex items-center gap-2 overflow-hidden cursor-pointer hover:bg-muted/60 p-1.5 rounded-lg transition-all flex-1 mr-2 group"
        >
          <div className="relative shrink-0">
            {/* 🚀 THE FIX: Force !rounded-md on container, image, and fallback */}
            <Avatar className="h-8 w-8 !rounded-md border border-border group-hover:ring-1 ring-primary transition-all">
              <AvatarImage
                src={
                  user?.avatarUrl
                    ? `${user.avatarUrl}?t=${new Date().getTime()}`
                    : `https://api.dicebear.com/7.x/initials/svg?seed=${user?.name}`
                }
                className="object-cover w-full h-full !rounded-md"
              />
              <AvatarFallback className="!rounded-md bg-primary/10 text-primary font-bold">
                {user?.name?.substring(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <span
              className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-background ${isConnected ? "bg-green-500" : "bg-red-500"}`}
            ></span>
          </div>
          <div className="flex flex-col truncate">
            <span className="text-sm font-bold leading-none truncate group-hover:text-primary transition-colors">
              {user?.name}
            </span>
            <span className="text-[10px] text-muted-foreground mt-1 truncate">
              {isConnected ? "Available" : "Offline"}
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

      <Dialog open={isProfileOpen} onOpenChange={setIsProfileOpen}>
        <DialogContent className="sm:max-w-[400px] bg-background border border-border rounded-xl shadow-lg">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-foreground text-center">
              Profile Settings
            </DialogTitle>
          </DialogHeader>

          <div className="py-6 flex flex-col items-center justify-center">
            <AvatarUploader />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
