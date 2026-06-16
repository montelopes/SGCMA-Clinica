# SGCMA - Sistema de Gerenciamento de Clínica Médica e Agendamento

Aplicação web full-stack para gestão de clínica médica, integrada ao banco MySQL `sgcma_db`.

## Stack
- **Backend:** Node.js + Express + mysql2
- **Frontend:** HTML5 + CSS3 + JavaScript Vanilla
- **Banco:** MySQL 8.0 (`sgcma_db`)

## Estrutura
```
sgcma/
├── server.js              # Servidor Express principal
├── package.json
├── config/
│   └── db.js              # Pool de conexão MySQL
├── routes/
│   ├── agenda.js          # GET  /api/agenda-diaria
│   ├── agendar.js         # POST /api/agendar (CALL sp_agendar_consulta)
│   └── historico.js       # GET  /api/historico-paciente
└── public/
    ├── index.html         # SPA com 3 abas
    ├── style.css
    └── app.js
```

## Pré-requisitos do Banco
O banco `sgcma_db` deve conter:
- View `vw_agenda_diaria`
- View `vw_historico_paciente` (com coluna JSON para metadados clínicos)
- Procedure `sp_agendar_consulta(paciente_id, medico_id, data, hora, observacoes, OUT novo_id)`
- Usuário `app_admin` com senha `SenhaAdminForte@2026` e permissão no banco

## Como rodar
```bash
npm install
npm start
```
Acesse: http://localhost:3000

## Endpoints
| Método | Rota                       | Descrição                             |
|--------|----------------------------|---------------------------------------|
| GET    | /api/agenda-diaria         | Consultas do dia (vw_agenda_diaria)   |
| POST   | /api/agendar               | Cria consulta via sp_agendar_consulta |
| GET    | /api/historico-paciente    | Histórico (vw_historico_paciente)     |

### Exemplo POST /api/agendar
```json
{
  "paciente_id": 1,
  "medico_id": 2,
  "data_consulta": "2026-06-20",
  "hora_consulta": "14:30",
  "observacoes": "Primeira consulta"
}
```
