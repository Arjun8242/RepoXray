import pkg from 'pg';

const { Pool } = pkg;

const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'codebase_ai',
    password: 'postgres123',
    port: 5433,
});

export default pool;