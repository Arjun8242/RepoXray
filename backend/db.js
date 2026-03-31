import 'dotenv/config';
import pkg from 'pg';
const { Pool } = pkg;

const connectionString = process.env.DATABASE_URL?.trim();

if (!connectionString) {
    throw new Error('DATABASE_URL is not set. Configure it in the environment before starting backend.');
}

const pool = new Pool({
    connectionString,
    ssl: {
        rejectUnauthorized: false, 
    },
});

export default pool;