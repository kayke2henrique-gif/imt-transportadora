# IMT Transportadora

Site corporativo com páginas separadas por categoria, carrossel administrável, área de funcionários, ponto, autorização de usuários, tabela de preços, ouvidoria e rádio.

## Rodar
npm install
npm start

Acesse http://localhost:3000

## Primeiro acesso
E-mail: admin@imttransportadora.com.br
Senha inicial: Troque123!

Troque a senha imediatamente pela opção Meu acesso.

## Funções novas
- Carrossel: Gestor do Site e Presidência podem adicionar, ativar, ocultar e excluir slides.
- Cadastro: usuário pode solicitar acesso; Presidência aprova e escolhe o cargo.
- Meu acesso: alteração de e-mail e senha.
- Gestor do Site: carrossel, preços e visualização da ouvidoria.
- Ponto: tela própria dentro da área do funcionário.
- Rádio: streaming fixo durante a navegação do site. Fechar o navegador pode interromper a reprodução conforme as regras do navegador.

## Produção
Defina SESSION_SECRET forte. O SQLite local é adequado para teste, mas em hospedagem gratuita com filesystem efêmero os dados podem ser perdidos; use banco persistente para produção.
