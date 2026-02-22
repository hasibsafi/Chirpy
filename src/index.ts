import express, { NextFunction } from 'express';
import { Request, Response } from 'express';
import { config } from './config.js';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { createUser } from './db/queries/users.js';
import { deleteAllUsers } from './db/queries/users.js';
import { createChirp } from './db/queries/chirps.js';
import { getAllChirps } from './db/queries/chirps.js';
import { getChirpById } from './db/queries/chirps.js';
import { hashPassword, checkPasswordHash } from './auth.js';
import { User } from './db/schema.js';
import { getUserByEmail } from './db/queries/users.js';
import { makeJWT } from './auth.js';
import { getBearerToken, validateJWT } from './auth.js';
import { createRefreshToken } from './db/queries/refreshTokens.js';
import { makeRefreshToken } from './auth.js';
import { getUserFromRefreshToken } from './db/queries/refreshTokens.js';
import { revokeRefreshToken } from './db/queries/refreshTokens.js';
import { updateUser } from './db/queries/users.js';
import { deleteChirpById } from './db/queries/chirps.js';
import { upgradeUserToChirpyRed } from './db/queries/users.js';
import { getAPIKey } from './auth.js';
import { getUserById } from './db/queries/users.js';

// run migration client before the server starts to make sure the database is up to date
const migrationClient = postgres(config.db.dbURL, { max: 1 });
await migrate(drizzle(migrationClient), config.db.migrationConfig);

const app = express();

const port = 8080;

// server hits count middleware
function middlewareMetricsInc(req: Request, res: Response, next: NextFunction) {
  config.api.fileServerHits += 1;
  next();
}
// loggin middleware
const middlewareLogResponses = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  res.on('finish', () => {
    const code = res.statusCode;
    if (code !== 200) {
      console.log(`[NON-OK] ${req.method} ${req.url} - Status: ${code}`);
    }
  });
  next();
};
// Custom error classes
class BadRequestError extends Error {
  status: number;
  constructor(message: string) {
    super(message);
    this.status = 400;
  }
}
class UnauthorizedError extends Error {
  status: number;
  constructor(message: string) {
    super(message);
    this.status = 401;
  }
}
class ForbiddenError extends Error {
  status: number;
  constructor(message: string) {
    super(message);
    this.status = 403;
  }
}
class NotFoundError extends Error {
  status: number;
  constructor(message: string) {
    super(message);
    this.status = 404;
  }
}

// Erro handler middleware
const ErrorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  console.error(err);
  const status = (err as any).status || 500;
  const messsage = err.message || 'Something went wrong on our end';
  res.status(status).json({ error: messsage });
};

app.use(middlewareLogResponses);

// End Points:

// Readiness Endpoint
app.get('/api/healthz', (req: Request, res: Response) => {
  res.set('Content-Type', 'text/plain; charset=utf-8');
  res.send('OK');
});

// Metrics Endpoint
app.get('/admin/metrics', (req: Request, res: Response) => {
  res.set('Content-Type', 'text/html; charset=utf-8');
  res.send(`
<html>
    <body>
        <h1>Welcome, Chirpy Admin</h1>
        <p>Chirpy has been visited ${config.api.fileServerHits} times!</p>
    </body>
</html>
    `);
});
// Reset Endpoint and Delete ALL Users in the database
app.post('/admin/reset', async (req: Request, res: Response) => {
  config.api.fileServerHits = 0;
  res.set('Content-Type', 'text/plain; charset=utf-8');
  res.send('Hits: 0');
  if (config.api.platform !== 'dev') {
    throw new ForbiddenError('Reset endpoint is only available in dev mode');
  }
  await deleteAllUsers();
});
// valid chirp helper

function validateChirp(body: string): {
  valid: boolean;
  cleanedBody?: string;
  error?: string;
} {
  if (typeof body !== 'string' || body.trim() === '') {
    return { valid: false, error: 'Chirp is required' };
  }
  if (body.length > 140) {
    return { valid: false, error: 'Chirp is too long. Max length is 140' };
  }
  const profaneWords = ['kerfuffle', 'sharbert', 'fornax'];
  const cleanedBody = body.replace(/\b(kerfuffle|sharbert|fornax)\b/gi, '****');
  return { valid: true, cleanedBody };
}

// Create Chirp Endpoint
app.post(
  '/api/chirps',
  express.json(),
  ErrorHandler,
  async (req: Request, res: Response, next: NextFunction) => {
    const { body } = req.body;
    if (!body) {
      throw new BadRequestError('Body and userId are required');
    }
    let userId: string;
    try {
      const token = getBearerToken(req);
      userId = validateJWT(token, config.api.jwtSecret);
    } catch (err) {
      throw new UnauthorizedError('Invalid or expired token');
    }
    const result = validateChirp(body);
    if (!result.valid) {
      throw new BadRequestError(result.error!);
    }
    try {
      const chirp = await createChirp({
        body: result.cleanedBody! ?? body,
        userId,
      });
      if (!chirp) return res.status(500).json({ error: 'Chirp not created' });
      // Convert snake_case to camelCase for the response
      res.status(201).json({
        id: chirp.id,
        body: chirp.body,
        userId: chirp.userId,
        createdAt: chirp.createdAt,
        updatedAt: chirp.updatedAt,
      });
    } catch (err) {
      res.status(500).json({ error: 'Server error' });
    }
  }
);

//get all chirps endpoint
app.get('/api/chirps', async (req: Request, res: Response) => {
  try {
    const authorId = req.query.authorId;
    const chirpsList = await getAllChirps(
      typeof authorId === 'string' ? authorId : undefined
    );
    let result = chirpsList.map((chirp) => ({
      id: chirp.id,
      body: chirp.body,
      userId: chirp.userId,
      createdAt: chirp.createdAt,
      updatedAt: chirp.updatedAt,
    }));
    const sort = req.query.sort;
    if (sort === 'desc') {
      result = result.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    } else {
      // asc or default
      result = result.sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
    }
    res.status(200).json(result);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// get a single chirp by id endpoint
app.get(
  '/api/chirps/:id',
  express.json(),
  async (req: Request, res: Response) => {
    let { id } = req.params;
    if (Array.isArray(id)) {
      id = id[0]; // or handle as error if you don't expect arrays
    }
    try {
      const chirp = await getChirpById(id);
      if (!chirp) {
        return res.status(404).json({ error: 'Chirp not found' });
      }
      res.status(200).json({
        id: chirp.id,
        body: chirp.body,
        userId: chirp.userId,
        createdAt: chirp.createdAt,
        updatedAt: chirp.updatedAt,
      });
    } catch (err) {
      res.status(500).json({ error: 'Server error' });
    }
  }
);

// delete a chirp by id endpoint
app.delete(
  '/api/chirps/:id',
  express.json(),
  async (req: Request, res: Response) => {
    let { id } = req.params;
    if (Array.isArray(id)) {
      id = id[0];
    }
    let userId: string;
    try {
      const token = getBearerToken(req);
      userId = validateJWT(token, config.api.jwtSecret);
    } catch (err) {
      throw new UnauthorizedError('Invalid or expired token');
    }
    const chirp = await getChirpById(id);
    if (!chirp) {
      return res.status(404).json({ error: 'Chirp not found' });
    }
    if (chirp.userId !== userId) {
      return res
        .status(403)
        .json({ error: 'You are not authorized to delete this chirp' });
    }
    await deleteChirpById(id);
    res.status(204).send();
  }
);

// Create user endpoint
// could also use: type UserResponse = Omit<User, "hashed_password">;
app.post(
  '/api/users',
  express.json(),
  ErrorHandler,
  async (req: Request, res: Response, next: NextFunction) => {
    const { email, password } = req.body;
    const hashedPassword = await hashPassword(password);
    if (!email || !password) {
      throw new BadRequestError('Email and password are required');
    }

    const existingUser = await getUserByEmail(email);
    if (existingUser) {
      throw new BadRequestError('User already exists');
    }
    try {
      const user = await createUser({ email, hashedPassword });
      if (!user) {
        throw new BadRequestError('User not created');
      }
      res.status(201).json({
        id: user.id,
        email: user.email,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        isChirpyRed: user.isChirpyRed,
      });
    } catch (err) {
      throw new BadRequestError('something went wrong');
      next(err);
    }
  }
);

// Login endpoint
app.post(
  '/api/login',
  express.json(),
  ErrorHandler,
  async (req: Request, res: Response, next: NextFunction) => {
    const { email, password, expiresInSeconds } = req.body;
    if (!email || !password) {
      throw new BadRequestError('Email and password are required');
    }

    try {
      const user = await getUserByEmail(email);
      if (!user) {
        return res.status(401).json({ error: 'incorrect email or password' });
      }
      const isValidPassword = await checkPasswordHash(
        password,
        user.hashedPassword
      );
      if (!isValidPassword) {
        return res.status(401).json({ error: 'incorrect email or password' });
      }
      const ONE_HOUR = 3600;
      const expiresIn =
        typeof expiresInSeconds === 'number'
          ? Math.min(expiresInSeconds, ONE_HOUR)
          : ONE_HOUR;
      const accessToken = makeJWT(user.id, expiresIn, config.api.jwtSecret);

      const refreshToken = makeRefreshToken();
      const sixtyDaysFromNow = new Date();
      sixtyDaysFromNow.setDate(sixtyDaysFromNow.getDate() + 60);
      await createRefreshToken(refreshToken, user.id, sixtyDaysFromNow);
      res.status(200).json({
        id: user.id,
        email: user.email,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        token: accessToken,
        refreshToken,
        isChirpyRed: user.isChirpyRed,
      });
    } catch (err) {}
  }
);

// Refresh Token Endpoint
app.post(
  '/api/refresh',
  ErrorHandler,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const refreshToken = getBearerToken(req);
      const tokenRecord = await getUserFromRefreshToken(refreshToken);

      if (!tokenRecord) {
        return res
          .status(401)
          .json({ error: 'Invalid or expired refresh token' });
      }
      if (tokenRecord.revokedAt) {
        return res
          .status(401)
          .json({ error: 'Refresh token has been revoked' });
      }
      if (new Date() > tokenRecord.expiresAt) {
        return res.status(401).json({ error: 'Refresh token has expired' });
      }

      const ONE_HOUR = 3600;
      const accessToken = makeJWT(
        tokenRecord.id,
        ONE_HOUR,
        config.api.jwtSecret
      );

      res.status(200).json({ token: accessToken });
    } catch (err) {
      return res
        .status(401)
        .json({ error: 'Invalid or expired refresh token' });
    }
  }
);

// Revoke Refresh Token Endpoint
app.post(
  '/api/revoke',
  ErrorHandler,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const refreshToken = getBearerToken(req);
      await revokeRefreshToken(refreshToken);
      res.status(204).send();
    } catch (err) {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }
  }
);

// Update User Endpoint
app.put(
  '/api/users',
  express.json(),
  ErrorHandler,
  async (req: Request, res: Response, next: NextFunction) => {
    const { email, password } = req.body;
    if (!email || !password) {
      throw new BadRequestError('Email and password are required');
    }

    let userId: string;
    try {
      const token = getBearerToken(req);
      userId = validateJWT(token, config.api.jwtSecret);
    } catch (err) {
      throw new UnauthorizedError('Invalid or expired token');
    }
    const hashedPassword = await hashPassword(password);

    try {
      const user = await updateUser(userId, { email, hashedPassword });
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      res.status(200).json({
        id: user.id,
        email: user.email,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        isChirpyRed: user.isChirpyRed,
      });
    } catch (err) {
      throw new BadRequestError('something went wrong');
      next(err);
    }
  }
);

// Upgrade User to Chirpy Red Endpoint
app.post(
  '/api/polka/webhooks',
  express.json(),
  ErrorHandler,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const apiKey = getAPIKey(req);
      if (apiKey !== config.api.polkaKey) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
    } catch (err) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { event, data } = req.body;
    if (event !== 'user.upgraded') {
      return res.status(204).send();
    }
    const userId = data?.userId;
    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    const user = await upgradeUserToChirpyRed(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.status(204).send();
  }
);

//Serve Static File from /app
app.use('/app', middlewareMetricsInc, express.static('./src/app'));

app.use(ErrorHandler);

//(req: Request, res: Response, next: NextFunction) => void;
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

// Get current user (requires auth)
app.get('/api/users/me', ErrorHandler, async (req: Request, res: Response) => {
  let userId: string;
  try {
    const token = getBearerToken(req);
    userId = validateJWT(token, config.api.jwtSecret);
  } catch {
    throw new UnauthorizedError('Invalid or expired token');
  }
  const user = await getUserById(userId);
  if (!user) {
    throw new NotFoundError('User not found');
  }
  res.status(200).json({
    id: user.id,
    email: user.email,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    isChirpyRed: user.isChirpyRed,
  });
});
