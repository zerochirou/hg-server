import { DynamicModule, Module } from '@nestjs/common';

@Module({})
export class AuthModule {
  static forRoot(options?: any): DynamicModule {
    return {
      module: AuthModule,
      providers: [],
      exports: [],
    };
  }
}

export const AllowGuest = () => () => {};
export const Roles = (...roles: any[]) => () => {};
export const Permissions = (...permissions: any[]) => () => {};
export const CurrentUser = () => () => {};
export const Session = () => () => {};
export const AuthSession = () => () => {};
