import { useEffect } from "react";
import { useChatStore } from "@/src/store/chat";
import { useAuthStore } from "@/src/store/authStore"; // 🚀 REQUIRED FOR THE FIX

export const useWorkspaceEvents = (socket: any) => {
  useEffect(() => {
    if (!socket) return;
    const chatState = useChatStore.getState;

    const handleMemberJoined = (data: { workspaceId: string; user: any }) => {
      const { activeWorkspaceId, users, setUsers } = chatState();

      if (activeWorkspaceId === data.workspaceId) {
        const isDuplicate = users.some((u) => u.id === data.user.id);
        if (!isDuplicate) {
          console.log("🟢 Real-time User Joined:", data.user.name);
          setUsers([...users, { ...data.user, unreadCount: 0 }]);
        }
      }
    };

    // 🚀 THE REAL-TIME PERMISSION REWRITE ENGINE
    const handleRoleUpdated = (data: {
      workspaceId: string;
      userId: string;
      newRole: string;
    }) => {
      const state = chatState();
      const { user } = useAuthStore.getState(); // Strictly get the active user's ID without React Lifecycle issues

      if (state.activeWorkspaceId === data.workspaceId) {
        // 🛡️ CRITICAL SYNC: Agar mera apna role change hua hai, toh meri apni aukaat (store permission) update karo
        if (user && user.id === data.userId) {
          console.log(
            `⚡ Security Cleared: My role in this workspace dynamically updated to: ${data.newRole}`,
          );
          state.setCurrentUserRole(data.newRole);
        }

        // Sidebar list mein users array ka role sync karo taake UI theek rahay
        state.setUsers(
          state.users.map((u) =>
            u.id === data.userId ? { ...u, role: data.newRole } : u,
          ),
        );
      }
    };

    // 🚀 THE PURGE RADAR (Sidebar Update)
    const handleMemberKicked = (data: {
      workspaceId: string;
      userId: string;
    }) => {
      const state = chatState();

      if (state.activeWorkspaceId === data.workspaceId) {
        // Remove the kicked member from the local sidebar state instantly
        state.setUsers(state.users.filter((u) => u.id !== data.userId));

        // Agar active chat wahi user tha jo kick hua, toh screen blank karo
        if (state.selectedUser?.id === data.userId) {
          state.setSelectedUser(null);
        }
      }
    };

    // 🚀 THE REVOCATION ENGINE (If I am the one who got kicked!)
    const handleWorkspaceRevoked = (workspaceId: string) => {
      const state = chatState();

      if (state.activeWorkspaceId === workspaceId) {
        alert(
          "🚨 Security Alert: Your access to this workspace has been revoked by the administrator.",
        );

        // 1. 🛡️ ZUSTAND MEMORY WIPE (Kill the persist middleware's source of truth)
        state.setActiveWorkspaceId(null);
        state.setActiveChannelId(null);
        state.setSelectedUser(null);

        // 2. 🛡️ BROWSER STORAGE WIPE
        localStorage.removeItem("lastActiveWorkspaceId");

        // 3. 🛡️ HARD REDIRECT TO DASHBOARD (System will now see null states and hydrate cleanly)
        window.location.href = "/";
      }
    };

    // 🚀 PRIVATE CHANNEL REVOCATION: When demoted to MEMBER/GUEST, remove
    // private channels the user no longer has access to from the sidebar.
    const handlePrivateChannelsRevoked = ({ channelIds }: { channelIds: string[] }) => {
      const state = chatState();
      const revokedSet = new Set(channelIds);
      state.setChannels(state.channels.filter((c) => !revokedSet.has(c.id)));
      if (state.activeChannelId && revokedSet.has(state.activeChannelId)) {
        state.setActiveChannelId(null);
      }
    };

    // BIND SOCKET LISTENERS
    socket.on("workspace_member_joined", handleMemberJoined);
    socket.on("member_role_updated", handleRoleUpdated);
    socket.on("member_kicked", handleMemberKicked);
    socket.on("workspace_revoked", handleWorkspaceRevoked);
    socket.on("private_channels_revoked", handlePrivateChannelsRevoked);

    return () => {
      // UNBIND ON UNMOUNT (Memory leak prevention)
      socket.off("workspace_member_joined", handleMemberJoined);
      socket.off("member_role_updated", handleRoleUpdated);
      socket.off("member_kicked", handleMemberKicked);
      socket.off("workspace_revoked", handleWorkspaceRevoked);
      socket.off("private_channels_revoked", handlePrivateChannelsRevoked);
    };
  }, [socket]);
};
