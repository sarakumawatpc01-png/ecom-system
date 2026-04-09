import { Request } from 'express';

export type UserRole = 'super_admin' | 'site_admin' | 'editor' | 'viewer';

export type JwtClaims = {
  sub: string;
  role: UserRole;
  sites: string[];
  iat: number;
  exp: number;
};

export type RequestContext = {
  user?: JwtClaims;
  siteId?: string;
};

export type AppRequest = Request & { ctx?: RequestContext };
