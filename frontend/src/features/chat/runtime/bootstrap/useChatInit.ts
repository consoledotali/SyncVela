/**
 * @deprecated Workspace member hydration is now handled exclusively by useWorkspaceMembers
 * with strict workspace isolation.
 */
export const useChatInit = () => {
  // No-op to preserve backwards compatibility without leaking cross-workspace members
};
