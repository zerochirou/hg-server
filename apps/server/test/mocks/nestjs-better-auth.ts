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
export const Roles = () => () => {};
export const Permissions = () => () => {};
export const CurrentUser = () => () => {};
export const Session = () => () => {};
export const AuthSession = () => () => {};
