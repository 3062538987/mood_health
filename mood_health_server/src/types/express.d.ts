declare namespace Express {
  interface Request {
    user?: {
      userId: number;
      username: string;
      role: string;
    };
  }
}
