'use strict';

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('connect', () => {
  // Connection established
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

/**
 * Execute a query against the pool
 * @param {string} text - SQL query string
 * @param {Array} params - Query parameters
 * @returns {Promise<import('pg').QueryResult>}
 */
const query = (text, params) => pool.query(text, params);

/**
 * Get a client from the pool for transactions
 * @returns {Promise<import('pg').PoolClient>}
 */
const getClient = () => pool.connect();

module.exports = { pool, query, getClient };
