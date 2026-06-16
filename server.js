/**
 * SGCMA - Sistema de Gerenciamento de Clínica Médica e Agendamento
 * Servidor Express principal
 */
const express = require('express');
const cors = require('cors');
const path = require('path');



const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Arquivos estáticos (frontend)
app.use(express.static(path.join(__dirname, 'public')));

// Rotas da API
const authRoutes = require('./routes/auth');
const cadastrosRoutes = require('./routes/cadastros');
const gerencialRoutes = require('./routes/gerencial');
const agendaRoutes = require('./routes/agenda');
const agendarRoutes = require('./routes/agendar');
const historicoRoutes = require('./routes/historico');

app.use('/api/auth', authRoutes);
app.use('/api', cadastrosRoutes);
app.use('/api', gerencialRoutes);
app.use('/api', agendaRoutes);
app.use('/api', agendarRoutes);
app.use('/api', historicoRoutes);

// Handler de erro global
app.use((err, req, res, next) => {
  console.error('Erro não tratado:', err);
  res.status(500).json({ erro: 'Erro interno do servidor' });
});

app.listen(PORT, () => {
  console.log(`SGCMA rodando em http://localhost:${PORT}`);
});