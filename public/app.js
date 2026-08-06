// ---------- Formatação ----------

function formatarKz(valor) {
  return new Intl.NumberFormat('pt-PT', { maximumFractionDigits: 0 }).format(valor) + ' Kz';
}

// ---------- Carrinho (guardado no browser do cliente) ----------

const CHAVE_CARRINHO = 'stelanes_carrinho';

function obterCarrinho() {
  try {
    return JSON.parse(localStorage.getItem(CHAVE_CARRINHO)) || [];
  } catch {
    return [];
  }
}

function guardarCarrinho(itens) {
  localStorage.setItem(CHAVE_CARRINHO, JSON.stringify(itens));
  atualizarContagemCarrinho();
}

function adicionarAoCarrinho(produtoId, quantidade = 1) {
  const itens = obterCarrinho();
  const existente = itens.find((i) => i.produtoId === produtoId);
  if (existente) {
    existente.quantidade += quantidade;
  } else {
    itens.push({ produtoId, quantidade });
  }
  guardarCarrinho(itens);
}

function atualizarContagemCarrinho() {
  const total = obterCarrinho().reduce((soma, i) => soma + i.quantidade, 0);
  document.querySelectorAll('#contagem-carrinho').forEach((el) => {
    el.textContent = total;
  });
}

// ---------- Dados da loja (rodapé / WhatsApp) ----------

async function carregarDadosLoja() {
  try {
    const resposta = await fetch('/api/loja');
    const loja = await resposta.json();
    document.querySelectorAll('#rodape-nome').forEach((el) => { el.textContent = loja.nome; });
    document.querySelectorAll('#rodape-whatsapp').forEach((el) => {
      el.href = `https://wa.me/${loja.whatsapp}`;
    });
    return loja;
  } catch (erro) {
    console.error('Não foi possível carregar os dados da loja', erro);
    return null;
  }
}

// ---------- Catálogo (página inicial) ----------

async function carregarCatalogo() {
  const grelha = document.getElementById('grelha-produtos');
  if (!grelha) return;

  try {
    const resposta = await fetch('/api/produtos');
    const produtos = await resposta.json();

    const contagem = document.getElementById('contagem-produtos');
    if (contagem) contagem.textContent = `${produtos.length} produto${produtos.length === 1 ? '' : 's'}`;

    if (produtos.length === 0) {
      grelha.innerHTML = '<p class="vazio">Ainda sem produtos disponíveis. Volte em breve.</p>';
      return;
    }

    grelha.innerHTML = '';
    produtos.forEach((produto) => {
      const cartao = document.createElement('article');
      cartao.className = 'cartao-produto';

      const semEstoque = produto.estoque <= 0;

      cartao.innerHTML = `
        <div class="cartao-produto-imagem">
          ${produto.imagem
            ? `<img src="${produto.imagem}" alt="${produto.nome}" loading="lazy">`
            : 'Sem imagem'}
        </div>
        <div class="cartao-produto-corpo">
          <h3>${produto.nome}</h3>
          <p>${produto.descricao || ''}</p>
          ${produto.estoque > 0 && produto.estoque <= 3 ? `<span class="estoque-baixo">Últimas ${produto.estoque} unidades</span>` : ''}
          <span class="preco">${formatarKz(produto.preco)}</span>
          <button class="botao botao-principal botao-bloco" ${semEstoque ? 'disabled' : ''} data-id="${produto.id}">
            ${semEstoque ? 'Esgotado' : 'Adicionar ao carrinho'}
          </button>
        </div>
      `;

      const botao = cartao.querySelector('button');
      if (!semEstoque) {
        botao.addEventListener('click', () => {
          adicionarAoCarrinho(produto.id, 1);
          botao.textContent = 'Adicionado ✓';
          setTimeout(() => { botao.textContent = 'Adicionar ao carrinho'; }, 1200);
        });
      }

      grelha.appendChild(cartao);
    });
  } catch (erro) {
    grelha.innerHTML = '<p class="vazio">Não foi possível carregar os produtos. Tente novamente mais tarde.</p>';
    console.error(erro);
  }
}

// ---------- Arranque ----------

document.addEventListener('DOMContentLoaded', () => {
  atualizarContagemCarrinho();
  carregarDadosLoja();
  carregarCatalogo();
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}
