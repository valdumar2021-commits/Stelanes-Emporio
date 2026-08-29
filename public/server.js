/**
 * Stelanes-Empório — servidor da API + site da loja
 * Não precisa de "npm install": usa apenas módulos nativos do Node.js.
 * Para arrancar: node server.js
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const url = require('url');

const PORT = process.env.PORT || 3000;
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'stelanes2026';

const DATA_DIR = path.join(__dirname, 'data');
const PUBLIC_DIR = path.join(__dirname, 'public');
const PRODUTOS_FILE = path.join(DATA_DIR, 'produtos.json');
const LOJA_FILE = path.join(DATA_DIR, 'loja.json');
const PEDIDOS_FILE = path.join(DATA_DIR, 'pedidos.json');

// ---------- Utilitários de dados ----------

function lerJSON(ficheiro, valorPadrao) {
  try {
    const conteudo = fs.readFileSync(ficheiro, 'utf-8');
    return JSON.parse(conteudo);
  } catch (erro) {
    return valorPadrao;
  }
}

function escreverJSON(ficheiro, dados) {
  fs.writeFileSync(ficheiro, JSON.stringify(dados, null, 2), 'utf-8');
}

function novoId() {
  return crypto.randomBytes(6).toString('hex');
}

// ---------- Utilitários HTTP ----------

function enviarJSON(res, status, corpo) {
  const texto = JSON.stringify(corpo);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(texto),
  });
  res.end(texto);
}

function lerCorpo(req) {
  return new Promise((resolve, reject) => {
    let partes = [];
    let tamanho = 0;
    req.on('data', (chunk) => {
      tamanho += chunk.length;
      if (tamanho > 2 * 1024 * 1024) { // limite de 2MB
        reject(new Error('corpo demasiado grande'));
        req.destroy();
        return;
      }
      partes.push(chunk);
    });
    req.on('end', () => {
      if (partes.length === 0) return resolve({});
      try {
        resolve(JSON.parse(Buffer.concat(partes).toString('utf-8')));
      } catch (erro) {
        reject(erro);
      }
    });
    req.on('error', reject);
  });
}

function autenticado(req) {
  const token = req.headers['x-admin-token'];
  return token && token === ADMIN_TOKEN;
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
};

function servirFicheiroEstatico(req, res, pathname) {
  let caminhoRelativo = pathname === '/' ? '/index.html' : pathname;
  // impede sair da pasta public/ (path traversal)
  const caminhoAbsoluto = path.normalize(path.join(PUBLIC_DIR, caminhoRelativo));
  if (!caminhoAbsoluto.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    return res.end('Proibido');
  }
  fs.readFile(caminhoAbsoluto, (erro, conteudo) => {
    if (erro) {
      // fallback amigável para páginas não encontradas
      fs.readFile(path.join(PUBLIC_DIR, 'index.html'), (erro2, indexConteudo) => {
        if (erro2) {
          res.writeHead(404);
          return res.end('Não encontrado');
        }
        res.writeHead(200, { 'Content-Type': MIME['.html'] });
        res.end(indexConteudo);
      });
      return;
    }
    const ext = path.extname(caminhoAbsoluto);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(conteudo);
  });
}

// ---------- Rotas da API ----------

async function tratarAPI(req, res, pathname, query) {
  // GET /api/loja
  if (pathname === '/api/loja' && req.method === 'GET') {
    return enviarJSON(res, 200, lerJSON(LOJA_FILE, {}));
  }

  // PUT /api/loja (admin)
  if (pathname === '/api/loja' && req.method === 'PUT') {
    if (!autenticado(req)) return enviarJSON(res, 401, { erro: 'Não autorizado' });
    const corpo = await lerCorpo(req);
    const atual = lerJSON(LOJA_FILE, {});
    const atualizado = { ...atual, ...corpo };
    escreverJSON(LOJA_FILE, atualizado);
    return enviarJSON(res, 200, atualizado);
  }

  // GET /api/produtos
  if (pathname === '/api/produtos' && req.method === 'GET') {
    return enviarJSON(res, 200, lerJSON(PRODUTOS_FILE, []));
  }

  // POST /api/produtos (admin)
  if (pathname === '/api/produtos' && req.method === 'POST') {
    if (!autenticado(req)) return enviarJSON(res, 401, { erro: 'Não autorizado' });
    const corpo = await lerCorpo(req);
    if (!corpo.nome || typeof corpo.preco !== 'number') {
      return enviarJSON(res, 400, { erro: 'nome e preco são obrigatórios' });
    }
    const produtos = lerJSON(PRODUTOS_FILE, []);
    const produto = {
      id: novoId(),
      nome: corpo.nome,
      descricao: corpo.descricao || '',
      preco: corpo.preco,
      estoque: typeof corpo.estoque === 'number' ? corpo.estoque : 0,
      imagem: corpo.imagem || '',
      criadoEm: new Date().toISOString(),
    };
    produtos.push(produto);
    escreverJSON(PRODUTOS_FILE, produtos);
    return enviarJSON(res, 201, produto);
  }

  // /api/produtos/:id (GET, PUT, DELETE)
  const matchProduto = pathname.match(/^\/api\/produtos\/([a-zA-Z0-9_-]+)$/);
  if (matchProduto) {
    const id = matchProduto[1];
    const produtos = lerJSON(PRODUTOS_FILE, []);
    const indice = produtos.findIndex((p) => p.id === id);

    if (req.method === 'GET') {
      if (indice === -1) return enviarJSON(res, 404, { erro: 'Produto não encontrado' });
      return enviarJSON(res, 200, produtos[indice]);
    }

    if (req.method === 'PUT') {
      if (!autenticado(req)) return enviarJSON(res, 401, { erro: 'Não autorizado' });
      if (indice === -1) return enviarJSON(res, 404, { erro: 'Produto não encontrado' });
      const corpo = await lerCorpo(req);
      produtos[indice] = { ...produtos[indice], ...corpo, id };
      escreverJSON(PRODUTOS_FILE, produtos);
      return enviarJSON(res, 200, produtos[indice]);
    }

    if (req.method === 'DELETE') {
      if (!autenticado(req)) return enviarJSON(res, 401, { erro: 'Não autorizado' });
      if (indice === -1) return enviarJSON(res, 404, { erro: 'Produto não encontrado' });
      const [removido] = produtos.splice(indice, 1);
      escreverJSON(PRODUTOS_FILE, produtos);
      return enviarJSON(res, 200, removido);
    }
  }

  // POST /api/pedidos (criar pedido — público)
  if (pathname === '/api/pedidos' && req.method === 'POST') {
    const corpo = await lerCorpo(req);
    if (!Array.isArray(corpo.itens) || corpo.itens.length === 0) {
      return enviarJSON(res, 400, { erro: 'O pedido precisa de pelo menos um item' });
    }
    if (!corpo.cliente || !corpo.cliente.nome || !corpo.cliente.telefone) {
      return enviarJSON(res, 400, { erro: 'Nome e telefone do cliente são obrigatórios' });
    }

    const produtos = lerJSON(PRODUTOS_FILE, []);
    let total = 0;
    const itensValidados = [];
    for (const item of corpo.itens) {
      const produto = produtos.find((p) => p.id === item.produtoId);
      if (!produto) continue;
      const quantidade = Math.max(1, parseInt(item.quantidade, 10) || 1);
      total += produto.preco * quantidade;
      itensValidados.push({
        produtoId: produto.id,
        nome: produto.nome,
        preco: produto.preco,
        quantidade,
      });
    }
    if (itensValidados.length === 0) {
      return enviarJSON(res, 400, { erro: 'Nenhum item válido no pedido' });
    }

    const pedidos = lerJSON(PEDIDOS_FILE, []);
    const pedido = {
      id: novoId(),
      itens: itensValidados,
      total,
      cliente: {
        nome: corpo.cliente.nome,
        telefone: corpo.cliente.telefone,
        endereco: corpo.cliente.endereco || '',
        notas: corpo.cliente.notas || '',
      },
      status: 'pendente',
      criadoEm: new Date().toISOString(),
    };
    pedidos.push(pedido);
    escreverJSON(PEDIDOS_FILE, pedidos);
    return enviarJSON(res, 201, pedido);
  }

  // GET /api/pedidos (admin)
  if (pathname === '/api/pedidos' && req.method === 'GET') {
    if (!autenticado(req)) return enviarJSON(res, 401, { erro: 'Não autorizado' });
    return enviarJSON(res, 200, lerJSON(PEDIDOS_FILE, []));
  }

  // PUT /api/pedidos/:id (admin — atualizar status)
  const matchPedido = pathname.match(/^\/api\/pedidos\/([a-zA-Z0-9_-]+)$/);
  if (matchPedido && req.method === 'PUT') {
    if (!autenticado(req)) return enviarJSON(res, 401, { erro: 'Não autorizado' });
    const id = matchPedido[1];
    const pedidos = lerJSON(PEDIDOS_FILE, []);
    const indice = pedidos.findIndex((p) => p.id === id);
    if (indice === -1) return enviarJSON(res, 404, { erro: 'Pedido não encontrado' });
    const corpo = await lerCorpo(req);
    pedidos[indice] = { ...pedidos[indice], ...corpo, id };
    escreverJSON(PEDIDOS_FILE, pedidos);
    return enviarJSON(res, 200, pedidos[indice]);
  }

  return enviarJSON(res, 404, { erro: 'Rota da API não encontrada' });
}

// ---------- Servidor principal ----------

const servidor = http.createServer(async (req, res) => {
  const { pathname, query } = url.parse(req.url, true);

  try {
    if (pathname.startsWith('/api/')) {
      await tratarAPI(req, res, pathname, query);
    } else {
      servirFicheiroEstatico(req, res, pathname);
    }
  } catch (erro) {
    console.error(erro);
    enviarJSON(res, 500, { erro: 'Erro interno do servidor' });
  }
});

servidor.listen(PORT, () => {
  console.log(`Stelanes-Empório a correr em http://localhost:${PORT}`);
  console.log(`Token de admin atual: ${ADMIN_TOKEN} (defina a variável de ambiente ADMIN_TOKEN para mudar)`);
});
