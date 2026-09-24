declare namespace Express {
  interface Request {
    requestId: string;
    installId?: string;
    userId?: string;
  }
}
