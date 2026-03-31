import express from 'express';
import cors from 'cors';
import analyzeRoutes from './routes/analyze.routes.js';
import dotenv from 'dotenv';

dotenv.config();

const app = express();

app.use(cors({
    origin: [
<<<<<<< HEAD
        "http://localhost:5173",
        "https://your-vercel-app.vercel.app"
=======
        "http://localhost:3000",
        "https://repo-xray.vercel.app"
>>>>>>> b6d47a0 (updating frontend url in cors)
    ],
    credentials: true
}));

app.use(express.json());

app.use('/api', analyzeRoutes);

app.get('/', (req, res) => {
    res.send('Backend running!');
});

app.get('/health', (req, res) => {
    res.send('OK');
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});