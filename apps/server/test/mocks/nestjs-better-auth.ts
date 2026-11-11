import { DynamicModule, Module } from '@nestjs/common';

@Module({})
export class AuthModule {
  static forRoot(): DynamicModule {
    return {
      module: AuthModule,
      providers: [],
      exports: [],
    };
  }
}

export const AllowGuest = () => () => {};
export const AllowAnonymous = () => () => {};
export const OptionalAuth = () => () => {};
export const Public = () => () => {};
export const Roles = () => () => {};
export const Permissions = () => () => {};
export const CurrentUser = () => () => {};
export const Session = () => () => {};
export const AuthSession = () => () => {};

export type UserSession = {
  session: {
    id: string;
    userId: string;
    token: string;
    expiresAt: Date;
    createdAt: Date;
    updatedAt: Date;
    ipAddress?: string | null;
    userAgent?: string | null;
  };
  user: {
    id: string;
    email: string;
    emailVerified: boolean;
    name?: string | null;
    image?: string | null;
    createdAt: Date;
    updatedAt: Date;
    role?: string | string[];
  };
};
