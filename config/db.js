/**
 * Pool de conexões MySQL para o banco sgcma_db
 * Adaptado para funcionar localmente e na nuvem (Clever Cloud)
 */
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  // Se existir a variável da Clever Cloud, usa ela. Senão, usa 'localhost'
  host: process.env.MYSQL_ADDON_HOST || 'localhost',
  port: process.env.MYSQL_ADDON_PORT || 3306,
  user: process.env.MYSQL_ADDON_USER || 'app_admin',
  password: process.env.MYSQL_ADDON_PASSWORD || 'SenhaAdminForte@2026',
  database: process.env.MYSQL_ADDON_DB || 'sgcma_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

module.exports = pool;