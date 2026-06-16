/**
 * Rota: Novo Agendamento
 * POST /api/agendar  ->  CALL sp_agendar_consulta(?, ?, ?, ?, ?, @id)
 */
const express = require('express');
const pool = require('../config/db');

const router = express.Router();

router.post('/agendar', async (req, res) => {
  const { paciente_id, medico_id, data_consulta, hora_consulta, observacoes } = req.body;

  if (!paciente_id || !medico_id || !data_consulta || !hora_consulta) {
    return res.status(400).json({ erro: 'Campos obrigatórios: paciente_id, medico_id, data_consulta, hora_consulta' });
  }

  const conn = await pool.getConnection();
  try {
    await conn.query(
      'CALL sp_agendar_consulta(?, ?, ?, ?, ?, @novo_id)',
      [paciente_id, medico_id, data_consulta, hora_consulta, observacoes || null]
    );
    const [[out]] = await conn.query('SELECT @novo_id AS consulta_id');

    res.status(201).json({
      sucesso: true,
      mensagem: 'Consulta agendada com sucesso',
      consulta_id: out.consulta_id,
    });
  } catch (err) {
    console.error('Erro em /agendar:', err);
    res.status(400).json({
      sucesso: false,
      erro: err.sqlMessage || 'Falha ao agendar consulta',
    });
  } finally {
    conn.release();
  }
});

module.exports = router;
