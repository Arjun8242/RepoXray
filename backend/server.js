import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import pool from './db.js';  
import repoRoutes from './routes/repo.routes.js';

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api', repoRoutes);
app.get('/', (req, res) => {
    res.send('Backend running!');
});

app.get("/test-db", async (req, res) => {
  const result = await pool.query("SELECT NOW()")
  res.json(result.rows)
});

app.listen(5000, () => {
    console.log('Server is running on port 5000');
});

