# Stelanes-Empório — API + Loja Web

Loja online completa: API (backend) + site instalável como app (PWA), pronta a publicar.
Não precisa de `npm install` — usa apenas o Node.js já incluído.

## Testar no seu computador

1. Instale o [Node.js](https://nodejs.org) (versão 18 ou superior), se ainda não tiver.
2. Abra um terminal na pasta `stelanes-emporio`.
3. Corra:
   ```
   node server.js
   ```
4. Abra `http://localhost:3000` no navegador — vai ver a loja.
5. Abra `http://localhost:3000/admin.html` para gerir produtos e pedidos.
   - Código de administração inicial: `stelanes2026`
   - **Mude este código antes de publicar** (ver secção "Segurança" abaixo).

## Estrutura do projeto

```
stelanes-emporio/
├── server.js          → a API + servidor do site (um único ficheiro, sem dependências)
├── data/
│   ├── loja.json       → nome, contactos e dados de pagamento da loja
│   ├── produtos.json   → catálogo de produtos
│   └── pedidos.json    → pedidos feitos pelos clientes
└── public/              → o site que os clientes veem (catálogo, carrinho, PWA)
    ├── index.html, carrinho.html, admin.html
    ├── style.css, app.js, carrinho.js, admin.js
    ├── manifest.json, sw.js  → tornam o site instalável como app
    └── icons/
```

## Como funciona

- **Catálogo** (`/`): lista os produtos vindos da API (`GET /api/produtos`).
- **Carrinho** (`/carrinho.html`): guardado no telemóvel/navegador do cliente. Ao finalizar, cria um
  pedido (`POST /api/pedidos`) com estado `pendente` e mostra os dados para pagamento por
  transferência ou MB Way, mais um botão para enviar o comprovativo pelo WhatsApp.
- **Administração** (`/admin.html`): protegida por código. Permite adicionar/editar/remover
  produtos, ver os pedidos recebidos e avançar o estado de cada um
  (pendente → pago → enviado, ou cancelado).
- **PWA**: em Android/desktop o navegador oferece "Instalar aplicação"; em iOS, usa-se
  Partilhar → "Adicionar ao ecrã principal". A partir daí abre como uma app normal.

## Antes de publicar — segurança

O código de administração está fixo em `stelanes2026` dentro de `server.js`. **Troque-o** definindo
a variável de ambiente `ADMIN_TOKEN` no serviço onde publicar a loja (nunca deixe o valor de
fábrica em produção). Exemplo ao arrancar manualmente:
```
ADMIN_TOKEN="o-seu-codigo-secreto" node server.js
```

Edite também `data/loja.json` com os dados reais de transferência bancária (banco, IBAN, titular) —
atualmente estão como exemplo.

## Publicar a loja online (para ficar acessível a clientes)

Qualquer serviço que corra Node.js serve. Opções simples e com plano gratuito:
- **Render** (render.com): criar um "Web Service", ligar a um repositório Git com este código,
  comando de arranque `node server.js`, definir `ADMIN_TOKEN` nas variáveis de ambiente.
- **Railway** (railway.app): processo semelhante, deteta o `package.json` automaticamente.

Depois de publicado, terá um endereço público (ex: `https://stelanes-emporio.onrender.com`) —
esse é o link que pode partilhar nas redes sociais e usar para instalar como app.

**Nota:** o catálogo e os pedidos ficam guardados em ficheiros `.json` no próprio servidor. Isto é
simples e funciona bem para começar, mas em alguns serviços gratuitos os ficheiros podem ser
apagados quando o servidor reinicia (armazenamento "efémero"). Se isso acontecer com o serviço que
escolher, avise-me e ajudo a ligar uma base de dados persistente.
