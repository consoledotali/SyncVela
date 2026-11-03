import { useEffect } from "react";
import { useChatStore } from "@/src/features/chat/state";
import { useAuthStore } from "@/src/store/authStore";
import { authFetch } from "@/src/lib/authFetch";
import { useRouter } from "next/navigation";
import type { Socket } from "socket.io-client";
import type {
  Channel,
  SidebarUser,
  WorkspaceRole,
} from "@/src/features/chat/state/types";
import { toast } from "sonner";

type MemberJoinedPayload = { workspaceId: string; user: SidebarUser };

export const useWorkspaceEvents = (socket: Socket | null) => {
  const router = useRouter();

  useEffect(() => {
    if (!socket) return;
    const chatState = useChatStore.getState;

    const handleMemberJoined = (data: MemberJoinedPayload) => {
      const { activeWorkspaceId, users, setUsers } = chatState();

      if (activeWorkspaceId === data.workspaceId) {
        const isDuplicate = users.some((u) => u.id === data.user.id);
        if (!isDuplicate) {
          console.log("🟢 Real-time User Joined:", data.user.name);
          setUsers([...users, data.user]);
        }
      }
    };

    const handleRoleUpdated = async (data: {
      workspaceId: string;
      userId: string;
      newRole: WorkspaceRole;
    }) => {
      const state = chatState();
      const { user } = useAuthStore.getState();

      if (state.activeWorkspaceId === data.workspaceId) {
        if (user && user.id === data.userId) {
          const previousRole = state.currentUserRole;

          console.log(
            `⚡ Security Cleared: My role updated from ${previousRole} to: ${data.newRole}`,
          );
          state.setCurrentUserRole(data.newRole);

          if (previousRole === "GUEST" && data.newRole !== "GUEST") {
            try {
              const res = await authFetch(
                `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/channels/${data.workspaceId}`,
              );
              if (res.ok) {
                const freshChannels = (await res.json()) as Channel[];
                chatState().setChannels(freshChannels);
              }
            } catch (err) {
              console.error(
                "❌ Failed to hydrate channels after promotion",
                err,
              );
            }
          }
        }

        state.setUsers(
          state.users.map((u) =>
            u.id === data.userId ? { ...u, role: data.newRole } : u,
          ),
        );
      }
    };

    const handleWorkspaceEviction = (
      revokedWorkspaceId: string,
      reason: string = "Your access to this workspace has been revoked by the administrator.",
    ) => {
      const state = chatState();
      const updatedWorkspaces = state.workspaces.filter(
        (w) => w.id !== revokedWorkspaceId,
      );

      state.setWorkspaces(updatedWorkspaces);

      if (state.activeWorkspaceId === revokedWorkspaceId) {
        toast.error(reason);

        state.setChannels([]);
        state.setUsers([]);
        state.setMessages([]);
        state.setActiveChannelId(null);
        state.setSelectedUser(null);
        state.setCurrentUserRole(null);
        useChatStore.setState({
          onlineUsers: [],
          unreadCounts: {},
          channelUnreadCounts: {},
          threadMessages: [],
          activeThreadParent: null,
        });

        if (updatedWorkspaces.length > 0) {
          const nextWs = updatedWorkspaces[0];
          state.setActiveWorkspaceId(nextWs.id);
          localStorage.setItem("lastActiveWorkspaceId", nextWs.id);
        } else {
          state.setActiveWorkspaceId(null);
          localStorage.removeItem("lastActiveWorkspaceId");
          router.replace("/create-workspace");
        }
      }
    };

    const handleMemberKicked = (data: {
      workspaceId: string;
      userId: string;
    }) => {
      const state = chatState();
      const { user } = useAuthStore.getState();

      // 🚨 CRITICAL: If the current user is the one who was kicked from the workspace!
      if (user?.id === data.userId) {
        handleWorkspaceEviction(
          data.workspaceId,
          "You have been removed from this workspace by an administrator.",
        );
        return;
      }

      if (state.activeWorkspaceId === data.workspaceId) {
        state.setUsers(state.users.filter((u) => u.id !== data.userId));

        if (state.selectedUser?.id === data.userId) {
          state.setSelectedUser(null);
        }

        useChatStore.setState((current) => {
          const unreadCounts = { ...current.unreadCounts };
          delete unreadCounts[data.userId];
          return {
            onlineUsers: current.onlineUsers.filter(
              (userId) => userId !== data.userId,
            ),
            unreadCounts,
          };
        });
      }
    };

    const handleWorkspaceOwnershipTransferred = (data: {
      workspaceId: string;
      previousOwnerId: string;
      newOwnerId: string;
    }) => {
      const state = chatState();
      const { user } = useAuthStore.getState();

      if (state.activeWorkspaceId !== data.workspaceId) return;

      if (user?.id === data.previousOwnerId) {
        state.setCurrentUserRole("ADMIN");
      } else if (user?.id === data.newOwnerId) {
        state.setCurrentUserRole("OWNER");
      }

      state.setWorkspaces(
        state.workspaces.map((workspace) =>
          workspace.id === data.workspaceId
            ? { ...workspace, ownerId: data.newOwnerId }
            : workspace,
        ),
      );

      state.setUsers(
        state.users.map((member) => {
          if (member.id === data.previousOwnerId) {
            return { ...member, role: "ADMIN" };
          }
          if (member.id === data.newOwnerId) {
            return { ...member, role: "OWNER" };
          }
          return member;
        }),
      );
    };

    const handleWorkspaceRevoked = (data: string | { workspaceId: string }) => {
      const revokedWorkspaceId =
        typeof data === "string" ? data : data?.workspaceId;
      if (!revokedWorkspaceId) return;

      handleWorkspaceEviction(
        revokedWorkspaceId,
        "Your access to this workspace has been revoked by the administrator.",
      );
    };

    const handlePrivateChannelsRevoked = ({
      channelIds,
    }: {
      channelIds: string[];
    }) => {
      const state = chatState();
      const revokedSet = new Set(channelIds);

      state.setChannels(state.channels.filter((c) => !revokedSet.has(c.id)));

      if (state.activeChannelId && revokedSet.has(state.activeChannelId)) {
        state.setActiveChannelId(null);
        state.setMessages([]);
        state.closeThread();
      }

      useChatStore.setState((current) => {
        const channelUnreadCounts = { ...current.channelUnreadCounts };
        channelIds.forEach((channelId) => delete channelUnreadCounts[channelId]);
        return { channelUnreadCounts };
      });
    };

    // 🚀 THE REAL-TIME WORKSPACE DELETION RADAR
    const handleWorkspaceDeleted = (deletedWorkspaceId: string) => {
      const state = chatState();
      const updatedWorkspaces = state.workspaces.filter(
        (w) => w.id !== deletedWorkspaceId,
      );

      state.setWorkspaces(updatedWorkspaces);

      if (state.activeWorkspaceId === deletedWorkspaceId) {
        toast.error("The workspace you were viewing has been deleted by the owner.");

        state.setChannels([]);
        state.setUsers([]);
        state.setMessages([]);
        state.setActiveChannelId(null);
        state.setSelectedUser(null);
        useChatStore.setState({
          onlineUsers: [],
          unreadCounts: {},
          channelUnreadCounts: {},
          threadMessages: [],
          activeThreadParent: null,
        });

        if (updatedWorkspaces.length > 0) {
          const nextWs = updatedWorkspaces[0];
          state.setActiveWorkspaceId(nextWs.id);
          localStorage.setItem("lastActiveWorkspaceId", nextWs.id);
        } else {
          state.setActiveWorkspaceId(null);
          localStorage.removeItem("lastActiveWorkspaceId");
          router.replace("/create-workspace");
        }
      }
    };

    // BIND SOCKET LISTENERS
    socket.on("workspace_member_joined", handleMemberJoined);
    socket.on("member_role_updated", handleRoleUpdated);
    socket.on("workspace_ownership_transferred", handleWorkspaceOwnershipTransferred);
    socket.on("member_kicked", handleMemberKicked);
    socket.on("workspace_revoked", handleWorkspaceRevoked);
    socket.on("private_channels_revoked", handlePrivateChannelsRevoked);
    socket.on("workspace_deleted", handleWorkspaceDeleted);

    return () => {
      socket.off("workspace_member_joined", handleMemberJoined);
      socket.off("member_role_updated", handleRoleUpdated);
      socket.off("workspace_ownership_transferred", handleWorkspaceOwnershipTransferred);
      socket.off("member_kicked", handleMemberKicked);
      socket.off("workspace_revoked", handleWorkspaceRevoked);
      socket.off("private_channels_revoked", handlePrivateChannelsRevoked);
      socket.off("workspace_deleted", handleWorkspaceDeleted);
    };
  }, [router, socket]);
};
