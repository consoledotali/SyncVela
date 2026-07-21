"use client";

import React, { useEffect, useState } from "react";
import { X, Users, Loader2, ShieldAlert, Search } from "lucide-react"; // 🟢 Added Search icon
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/src/components/ui/avatar";
import { useAuthStore } from "@/src/store/authStore";

interface ChannelMembersModalProps {
  isOpen: boolean;
  onClose: () => void;
  channelId: string;
  channelName: string;
}

// 🟢 THE FIX: Role must exist in your backend response
interface Member {
  id: string;
  name: string;
  avatarUrl: string | null;
  email: string;
  role?: "OWNER" | "ADMIN" | "MEMBER"; // Backend lazmi bheje yeh
}

export default function ChannelMembersModal({
  isOpen,
  onClose,
  channelId,
  channelName,
}: ChannelMembersModalProps) {
  // 🟢 Added 'user' from store to identify "(you)"
  const { token, user } = useAuthStore();
  const [members, setMembers] = useState<Member[]>([]);
  const [searchQuery, setSearchQuery] = useState(""); // 🟢 Search State
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isOpen || !channelId) {
      setSearchQuery(""); // Reset search on close
      return;
    }

    const fetchMembers = async () => {
      setIsLoading(true);
      setError("");
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/channels/${channelId}/members`,
          {
            headers: { Authorization: `Bearer ${token}` },
          },
        );

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || "Failed to fetch members");
        }

        setMembers(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchMembers();
  }, [isOpen, channelId, token]);

  // ==========================================
  // 🚀 THE PRODUCTION ENGINE (Filter + Sort)
  // ==========================================
  const filteredAndSortedMembers = members
    .filter(
      (m) =>
        m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.email.toLowerCase().includes(searchQuery.toLowerCase()),
    )
    .sort((a, b) => {
      // Rule 1: Owner hamesha strictly top par hoga
      if (a.role === "OWNER" && b.role !== "OWNER") return -1;
      if (b.role === "OWNER" && a.role !== "OWNER") return 1;

      // Rule 2: Alphabetical Fallback
      return a.name.localeCompare(b.name);
    });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-background w-full max-w-md rounded-xl shadow-2xl border border-border overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2 text-foreground">
              <Users className="h-5 w-5 text-primary" />
              Channel Members
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              {members.length} members in{" "}
              <span className="font-semibold text-foreground">
                #{channelName}
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

        {/* 🟢 Search Bar (Slack-style) */}
        <div className="px-6 pb-4 border-b border-border/50">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Find members..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-muted/50 border border-border rounded-md pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary transition-all text-foreground placeholder:text-muted-foreground"
            />
          </div>
        </div>

        {/* Content */}
        <div className="min-h-[250px] max-h-[400px] overflow-y-auto px-4 py-2 custom-scrollbar">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground mt-10">
              <Loader2 className="h-8 w-8 animate-spin mb-2" />
              <p className="text-sm">Loading members...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-full text-red-500 mt-10 bg-red-50 p-4 rounded-lg mx-2">
              <ShieldAlert className="h-8 w-8 mb-2" />
              <p className="text-sm font-medium text-center">{error}</p>
            </div>
          ) : filteredAndSortedMembers.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground mt-10">
              <p className="text-sm">No members match your search.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              {filteredAndSortedMembers.map((member) => {
                const isMe = user?.id === member.id;
                const isOwner = member.role === "OWNER";

                return (
                  <div
                    key={member.id}
                    className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors group"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar className="h-9 w-9 border border-border">
                        <AvatarImage
                          src={
                            member?.avatarUrl
                              ? member.avatarUrl
                              : `https://api.dicebear.com/7.x/initials/svg?seed=${member?.name}`
                          }
                          className="object-cover"
                        />
                        <AvatarFallback className="bg-primary/10 text-primary font-bold text-xs">
                          {member.name.substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-foreground">
                            {member.name}
                          </span>
                          {/* 🟢 Identify the current user */}
                          {isMe && (
                            <span className="text-[10px] text-muted-foreground font-medium">
                              (you)
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {member.email}
                        </span>
                      </div>
                    </div>

                    {/* 🟢 Role Badge Indicator */}
                    {isOwner && (
                      <span className="text-[10px] font-bold tracking-wider uppercase bg-primary/10 text-primary px-2 py-1 rounded-sm">
                        Owner
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

