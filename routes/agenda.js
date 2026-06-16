/**
 * Rota: Painel da Recepção
 * GET /api/agenda-diaria  ->  SELECT * FROM vw_agenda_diaria
 */
const express = require('express');
const pool = require('../config/db');

const router = express.Router();

router.get('/agenda-diaria', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM vw_agenda_diaria');
    res.json(rows);
  } catch (err) {
    console.error('Erro em /agenda-diaria:', err);
    res.status(500).json({ erro: 'Falha ao carregar agenda diária', detalhe: err.sqlMessage || err.message });
  }
});

module.exports = router;
