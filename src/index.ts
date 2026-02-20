import express, { NextFunction } from 'express';
import {Request, Response} from 'express';
import { config } from './config.js';
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import {migrate} from "drizzle-orm/postgres-js/migrator";
import { createUser } from './db/queries/users.js';
import { deleteAllUsers } from './db/queries/users.js';
import { createChirp } from './db/queries/chirps.js';
import { getAllChirps } from './db/queries/chirps.js';
import { getChirpById } from './db/queries/chirps.js';
import {hashPassword, checkPasswordHash} from './auth.js';
import { User } from './db/schema.js';
import { getUserByEmail } from './db/queries/users.js';



// run migration client before the server starts to make sure the database is up to date
const migrationClient = postgres(config.db.dbURL, {max: 1});
await migrate(drizzle(migrationClient), config.db.migrationConfig);

const app = express();

const port = 8080;


// server hits count middleware
function middlewareMetricsInc(req: Request, res: Response, next: NextFunction) {
    config.api.fileServerHits += 1;
    next();
}
// loggin middleware
const middlewareLogResponses = (req: Request, res: Response, next: NextFunction) => {
    res.on("finish", () => {
        const code =res.statusCode;
        if(code !== 200){
            console.log(`[NON-OK] ${req.method} ${req.url} - Status: ${code}`);
        }
    })
    next();
}
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
const ErrorHandler = (err: Error, req: Request, res: Response, next: NextFunction) => {
    console.error(err);
    const status = (err as any).status || 500;
    const messsage = err.message || "Something went wrong on our end"
    res.status(status).json({error: messsage});
}


app.use(middlewareLogResponses);

// End Points:


// Readiness Endpoint
app.get("/api/healthz", (req: Request, res: Response) => {
    res.set("Content-Type", "text/plain; charset=utf-8");
    res.send("OK")
})

// Metrics Endpoint
app.get("/admin/metrics", (req: Request, res: Response) => {
    res.set("Content-Type", "text/html; charset=utf-8");
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
app.post("/admin/reset", async(req: Request, res: Response) => {
    config.api.fileServerHits = 0;
    res.set("Content-Type", "text/plain; charset=utf-8");
    res.send("Hits: 0")
    if(config.api.platform !== "dev") {
        throw new ForbiddenError("Reset endpoint is only available in dev mode");
    }
    await deleteAllUsers();
})
// valid chirp helper


function validateChirp(body: string): { valid: boolean; cleanedBody?: string; error?: string } {
  if (typeof body !== "string" || body.trim() === "") {
    return { valid: false, error: "Chirp is required" };
  }
  if (body.length > 140) {
    return { valid: false, error: "Chirp is too long. Max length is 140" };
  }
  const profaneWords = ["kerfuffle", "sharbert", "fornax"];
  const cleanedBody = body.replace(/\b(kerfuffle|sharbert|fornax)\b/gi, "****");
  return { valid: true, cleanedBody };
}

// Create Chirp Endpoint
app.post("/api/chirps", express.json(), ErrorHandler, async (req: Request, res: Response, next: NextFunction) => {
    const {body, userId} = req.body;
    if(!body || !userId) {
        throw new BadRequestError("Body and userId are required");
    }
    const result = validateChirp(body);
    if (!result.valid) {
        throw new BadRequestError(result.error!);
    }
   try {
    const chirp = await createChirp({ body, userId });
    if (!chirp) return res.status(500).json({ error: "Chirp not created" });
    // Convert snake_case to camelCase for the response
    res.status(201).json({
      id: chirp.id,
      body: chirp.body,
      userId: chirp.userId,
      createdAt: chirp.createdAt,
      updatedAt: chirp.updatedAt,
    });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }

});

//get all chirps endpoint
app.get("/api/chirps", async (req: Request, res: Response) => {
    try{
        const chirps = await getAllChirps();
        const result = chirps.map(chirp => ({
        id: chirp.id,
        body: chirp.body,
        userId: chirp.userId,
        createdAt: chirp.createdAt,
        updatedAt: chirp.updatedAt,
    }));
    res.status(200).json(result);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// get a single chirp by id endpoint
app.get("/api/chirps/:id", express.json(), async (req: Request, res: Response) => {
    let {id} = req.params;
    if (Array.isArray(id)) {
        id = id[0]; // or handle as error if you don't expect arrays
    }
    try {
      const chirp = await getChirpById(id);
      if (!chirp) {
        return res.status(404).json({ error: "Chirp not found" });
      }
      res.status(200).json({
            id: chirp.id,
            body: chirp.body,
            userId: chirp.userId,
            createdAt: chirp.createdAt,
            updatedAt: chirp.updatedAt,
        });
    }catch(err){
        res.status(500).json({ error: "Server error" });
    }
})
    





// Create user endpoint
type UserResponse = Omit<User, "hashed_password">; 
app.post("/api/users", express.json(), ErrorHandler, async (req: Request, res: Response, next: NextFunction) => {
  const {email, password} = req.body;
  const hashedPassword = await hashPassword(password);
  if (!email || !password) {
    throw new BadRequestError("Email and password are required");
  }

  const existingUser = await getUserByEmail(email);
  if (existingUser) {
    throw new BadRequestError("User already exists");
  }
  try {
       const user = await createUser({email, hashedPassword}); 
       if(!user) {
        throw new BadRequestError("User not created");
       }
       res.status(201).json({id: user.id, email: user.email, createdAt: user.createdAt, updatedAt: user.updatedAt});

    } catch(err) {
        throw new BadRequestError("something went wrong")
        next(err);
    }

});

// Login endpoint
app.post("/api/login", express.json(), ErrorHandler, async (req: Request, res: Response, next: NextFunction) => {
  const {email, password} = req.body;
  if (!email || !password) {
    throw new BadRequestError("Email and password are required");
  }

  try {
    const user = await getUserByEmail(email);
    if (!user) {
      return res.status(401).json({ error: "incorrect email or password" });
    }
    const isValidPassword = await checkPasswordHash(password, user.hashedPassword);
    if (!isValidPassword) {
      return res.status(401).json({ error: "incorrect email or password" });
    }
    res.status(200).json({id: user.id, email: user.email, createdAt: user.createdAt, updatedAt: user.updatedAt});
  }catch(err) {}
});

    

//Serve Static File from /app
app.use("/app", middlewareMetricsInc, express.static("./src/app"));

app.use(ErrorHandler);

//(req: Request, res: Response, next: NextFunction) => void;
app.listen(port, () => {
     console.log(`Server is running on port ${port}`);
});

 
