import { useEffect } from "react";
import { useChatStore } from "@/src/store/chatStore";
import { useAuthStore } from "@/src/store/authStore";
import { authFetch } from "@/src/utils/apiUtils";
import { useRouter } from "next/navigation";
import type { Socket } from "socket.io-client";
import type { Channel } from "@/src/types/channelTypes";
import type { SidebarUser, WorkspaceRole } from "@/src/types/workspaceTypes";
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
          console.log("ðŸŸ¢ Real-time User Joined:", data.user.name);
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
            `âš¡ Security Cleared: My role updated from ${previousRole} to: ${data.newRole}`,
          );
          state.setCurrentUserRole(data.newRole);

          try {
            const channelsRes = await authFetch(
              `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/channels/${data.workspaceId}`,
            );
            if (channelsRes.ok) {
              const updatedChannels =
                (await channelsRes.json()) as Channel[];
              state.setChannels(updatedChannels);
            }
          } catch (err) {
            console.error("Failed to re-sync channels after role update", err);
          }

          toast.info(`Your role was updated to ${data.newRole}`);
        }
      }
    };

    const handleMemberRemoved = (data: {
      workspaceId: string;
      userId: string;
    }) => {
      const state = chatState();
      const { user } = useAuthStore.getState();

      if (state.activeWorkspaceId === data.workspaceId) {
        if (user && user.id === data.userId) {
          toast.error("You have been removed from this workspace");
          localStorage.removeItem("lastActiveWorkspaceId");
          state.resetChat();
          router.replace("/create-workspace");
          return;
        }

        state.removeUser(data.userId);

        if (state.selectedUser?.id === data.userId) {
          state.setSelectedUser(null);
          state.setActiveRoomId(null);
          state.setMessages([]);
        }
      }
    };

    const handleWorkspaceDeleted = (data: { workspaceId: string }) => {
      const state = chatState();

      const remaining = state.workspaces.filter(
        (w) => w.id !== data.workspaceId,
      );
      state.setWorkspaces(remaining);

      if (state.activeWorkspaceId === data.workspaceId) {
        localStorage.removeItem("lastActiveWorkspaceId");

        if (remaining.length > 0) {
          toast.info("Active workspace was deleted. Switching workspace...");
          state.setActiveWorkspaceId(remaining[0].id);
        } else {
          toast.info("Workspace deleted. Create or join a new workspace.");
          state.resetChat();
          router.replace("/create-workspace");
        }
      }
    };

    const handleOwnershipTransferred = (data: {
      workspaceId: string;
      previousOwnerId: string;
      newOwnerId: string;
    }) => {
      const state = chatState();
      const { user } = useAuthStore.getState();

      if (state.activeWorkspaceId !== data.workspaceId || !user) return;

      if (user.id === data.newOwnerId) {
        state.setCurrentUserRole("OWNER");
        toast.success("Workspace ownership transferred to you");
      } else if (user.id === data.previousOwnerId) {
        state.setCurrentUserRole("ADMIN");
        toast.info("Workspace ownership transferred to another member");
      }
    };

    socket.on("member_joined", handleMemberJoined);
    socket.on("member_role_updated", handleRoleUpdated);
    socket.on("member_removed", handleMemberRemoved);
    socket.on("workspace_deleted", handleWorkspaceDeleted);
    socket.on("workspace_ownership_transferred", handleOwnershipTransferred);

    return () => {
      socket.off("member_joined", handleMemberJoined);
      socket.off("member_role_updated", handleRoleUpdated);
      socket.off("member_removed", handleMemberRemoved);
      socket.off("workspace_deleted", handleWorkspaceDeleted);
      socket.off("workspace_ownership_transferred", handleOwnershipTransferred);
    };
  }, [socket, router]);
};

