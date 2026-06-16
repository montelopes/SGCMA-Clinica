/**
 * Rota: Prontuário / Histórico do Paciente
 * GET /api/historico-paciente?paciente_id=123  ->  SELECT * FROM vw_historico_paciente
 *
 * Campos JSON (ex: metadados com Pressão Arterial e Temperatura) são
 * automaticamente parseados antes do envio ao frontend.
 */
const express = require('express');
const pool = require('../config/db');

const router = express.Router();

router.get('/historico-paciente', async (req, res) => {
  const { paciente_id } = req.query;
  try {
    let rows;
    if (paciente_id) {
      [rows] = await pool.query(
        'SELECT * FROM vw_historico_paciente WHERE paciente_id = ?',
        [paciente_id]
      );
    } else {
      [rows] = await pool.query('SELECT * FROM vw_historico_paciente');
    }

    // Parse seguro de colunas JSON (mysql2 já parseia tipo JSON nativo,
    // mas tratamos caso a view retorne TEXT/VARCHAR com JSON serializado).
    const parsed = rows.map((row) => {
      const out = { ...row };
      for (const key of Object.keys(out)) {
        const val = out[key];
        if (typeof val === 'string' && (val.startsWith('{') || val.startsWith('['))) {
          try { out[key] = JSON.parse(val); } catch (_) { /* mantém string */ }
        }
      }
      return out;
    });

    res.json(parsed);
  } catch (err) {
    console.error('Erro em /historico-paciente:', err);
    res.status(500).json({ erro: 'Falha ao carregar histórico', detalhe: err.sqlMessage || err.message });
  }
});

module.exports = router;
