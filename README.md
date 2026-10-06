# IMT Transportadora — site completo

Este projeto é um ponto de partida funcional com:
- Site público responsivo
- Logo IMT integrada
- Carrossel de banners/fotos
- Serviços
- Sobre Nós
- Ouvidoria pública
- Login de funcionários
- Controle de ponto: Começar / Pausar / Retomar / Finalizar
- Contratos e empresas parceiras
- Tabela de preços
- Painel administrativo
- Criação de usuários e definição de cargos
- Controle de acesso à Ouvidoria
- Banco SQLite local

## Como rodar
1. Instale Node.js 18 ou superior.
2. Abra um terminal nesta pasta.
3. Rode `npm install`
4. Rode `npm start`
5. Abra `http://localhost:3000`

## Primeiro acesso
E-mail: `admin@imttransportadora.com.br`
Senha: `Troque123!`

IMPORTANTE: troque a senha imediatamente e, em produção, defina `SESSION_SECRET` com uma chave forte.

## Para colocar na internet
Você precisará de:
- um domínio (ex.: imttransportadora.com.br)
- hospedagem compatível com Node.js
- HTTPS
- banco de dados persistente
- backup

O projeto já está estruturado para receber domínio e hospedagem, mas o domínio/hospedagem precisam ser contratados em uma conta do proprietário.

## Próximas melhorias recomendadas
- Upload de contratos em PDF
- Fotos reais da frota pelo painel
- Relatórios de ponto por período
- Aprovação/assinatura digital de contratos
- Recuperação de senha por e-mail
- 2FA para administradores
- Banco PostgreSQL para produção
- Auditoria de alterações
- Política de privacidade/LGPD
