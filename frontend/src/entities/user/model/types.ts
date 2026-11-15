export type UserProfile = {
  id: string;
  displayName: string;
  email: string;
  avatarUrl?: string;
  isDemoAccount?: boolean;
};

export type CurrentUserResponse =
  { authenticated: false; user: null } | { authenticated: true; user: UserProfile };

export type UpdateProfileRequest = {
  displayName: string;
};
