declare namespace Express {
  interface Request {
    requestId: string;
    /** Set by authenticateRequest. The only source of the caller's user id. */
    principal?: import('../modules/auth/auth.service').UserPrincipal;
    /** Set by authenticateAdmin. Admins are a separate identity from users. */
    admin?: import('../modules/admin/admin.auth').AdminPrincipal;
  }
}
