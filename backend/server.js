import express from 'express';
import cors from 'cors';
import analyzeRoutes from './routes/analyze.routes.js';
import dotenv from 'dotenv';

const app = express();
app.use(cors());
app.use(express.json());
dotenv.config();

app.use('/api', analyzeRoutes);
app.get('/', (req, res) => {
    res.send('Backend running!');
});

app.listen(5000, () => {
    console.log('Server is running on port 5000');
});

