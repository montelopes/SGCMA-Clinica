const express = require('express');
const pool = require('../config/db');

const router = express.Router();

// ================= DASHBOARD =================
router.get('/dashboard', async (req, res) => {
  try {
    // Total de consultas hoje
    const [hoje] = await pool.query('SELECT COUNT(*) as total FROM consultas WHERE dt_consulta = date("now")');
    // Médicos ativos
    const [medicos] = await pool.query('SELECT COUNT(*) as total FROM medicos WHERE ativo = 1');
    // Pacientes cadastrados
    const [pacientes] = await pool.query('SELECT COUNT(*) as total FROM pacientes');
    
    // Relatório Mensal
    const [relatorio_mensal] = await pool.query('SELECT * FROM vw_relatorio_mensal');

    res.json({
      consultas_hoje: hoje[0].total,
      medicos_ativos: medicos[0].total,
      total_pacientes: pacientes[0].total,
      relatorio_mensal
    });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// ================= AUDITORIA =================
router.get('/auditoria', async (req, res) => {
  try {
    const [logs] = await pool.query(`
      SELECT l.*, u.nome as usuario_nome 
      FROM log_auditoria l
      LEFT JOIN usuarios u ON l.id_usuario = u.id_usuario
      ORDER BY l.dt_operacao DESC LIMIT 100
    `);
    res.json(logs);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

module.exports = router;
