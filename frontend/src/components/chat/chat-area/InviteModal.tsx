"use client";

import React, { useState } from "react";
import { useChatStore } from "@/src/store/chat";
import { useAuthStore } from "@/src/store/authStore";
import { useSocket } from "@/src/providers/SocketProvider"; // 🟢 ADDED SOCKET
import { X, UserPlus, Loader2, Check } from "lucide-react";

interface InviteModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function InviteModal({ isOpen, onClose }: InviteModalProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const { users, activeChannelId, channels } = useChatStore();
  const { token } = useAuthStore();
  const { socket } = useSocket(); // 🟢 ADDED SOCKET

  if (!isOpen || !activeChannelId) return null;

  const activeChannel = channels.find((c) => c.id === activeChannelId);

  const toggleUser = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((uid) => uid !== id) : [...prev, id],
    );
  };

  const handleInvite = async () => {
    if (selectedIds.length === 0) return;
    setIsLoading(true);

    try {
      const response = await fetch(
        `http://localhost:5000/api/channels/${activeChannelId}/invite`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ userIds: selectedIds }),
        },
      );

      const data = await response.json();

      if (response.ok) {
        alert(
          `✅ Successfully added ${data.addedUsers} members to ${activeChannel?.name}!`,
        );

        // 🟢 THE REAL-TIME FIX: Notify via Socket
        if (socket && activeChannel) {
          socket.emit("notify_channel_invites", {
            channel: activeChannel,
            userIds: selectedIds,
          });
        }

        setSelectedIds([]);
        onClose();
      } else {
        alert(`❌ Error: ${data.error}`);
      }
    } catch (error) {
      console.error("Invite failed:", error);
      alert("❌ Critical Error: Failed to send invites.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-background w-full max-w-md rounded-xl shadow-2xl border border-border p-6 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-primary" />
              Add People
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              Invite members to{" "}
              <span className="font-semibold text-foreground">
                #{activeChannel?.name}
              </span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-muted transition-colors"
          >
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>

        <div className="max-h-[300px] overflow-y-auto pr-2 flex flex-col gap-2 mb-6">
          {users.length === 0 ? (
            <p className="text-sm text-center text-muted-foreground py-4">
              No other members in this workspace to invite.
            </p>
          ) : (
            users.map((u) => {
              const isSelected = selectedIds.includes(u.id);
              return (
                <div
                  key={u.id}
                  onClick={() => toggleUser(u.id)}
                  className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-all border ${
                    isSelected
                      ? "border-primary bg-primary/10"
                      : "border-border hover:border-primary/50 hover:bg-muted/50"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center font-bold text-xs text-foreground">
                      {u.name.substring(0, 2).toUpperCase()}
                    </div>
                    <span
                      className={`text-sm ${isSelected ? "font-semibold" : "font-medium"}`}
                    >
                      {u.name}
                    </span>
                  </div>
                  {isSelected && <Check className="h-4 w-4 text-primary" />}
                </div>
              );
            })
          )}
        </div>

        <button
          onClick={handleInvite}
          disabled={selectedIds.length === 0 || isLoading}
          className="w-full flex items-center justify-center py-2.5 bg-primary text-primary-foreground font-semibold rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            `Invite ${selectedIds.length > 0 ? `(${selectedIds.length})` : ""}`
          )}
        </button>
      </div>
    </div>
  );
}
