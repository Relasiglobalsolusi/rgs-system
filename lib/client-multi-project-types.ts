export type MultiProjectCodeDTO = {
  id: string;
  kind: "MASTER" | "GROUP";
  codeHint: string | null;
  failedAttempts: number;
  lockedUntil: string | null;
  updatedAt: string;
};

export type MultiProjectProjectDTO = {
  id: string;
  name: string;
  status: string;
  groupId: string | null;
};

export type MultiProjectGroupDTO = {
  id: string;
  name: string;
  sortOrder: number;
  projects: Array<Pick<MultiProjectProjectDTO, "id" | "name" | "status">>;
  securityCodes: MultiProjectCodeDTO[];
};

export type MultiProjectAdminState = {
  id: string;
  name: string;
  multiProjectAccess: boolean;
  multiProjectSecurityMode: "GROUP_ONLY" | "MASTER_AND_GROUP" | null;
  countableProjects: number;
  active: boolean;
  readyPrompt: boolean;
  ungrouped: MultiProjectProjectDTO[];
  projects: MultiProjectProjectDTO[];
  projectGroups: MultiProjectGroupDTO[];
  masterCode: MultiProjectCodeDTO | null;
};
