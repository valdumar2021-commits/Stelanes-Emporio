const CHAVE_TOKEN = 'stelanes_admin_token';

function obterToken() {
  return localStorage.getItem(CHAVE_TOKEN) || '';
}

async function pedidoAutenticado(caminho, opcoes = {}) {
  const resposta = await fetch(caminho, {
    ...opcoes,
    headers: {
      'Content-Type': 'application/json',
      'x-admin-token': obterToken(),
      ...(opcoes.headers || {}),
    },
  });
  if (resposta.status === 401) throw new Error('não autorizado');
  return resposta;
}

// ---------- Portão de acesso ----------

async function validarToken(token) {
  const resposta = await fetch('/api/pedidos', { headers: { 'x-admin-token': token } });
  return resposta.status !== 401;
}

document.getElementById('form-gate').addEventListener('submit', async (evento) => {
  evento.preventDefault();
  const token = document.getElementById('campo-token').value.trim();
  const erro = document.getElementById('erro-gate');
  erro.textContent = '';

  const valido = await validarToken(token);
  if (!valido) {
    erro.textContent = 'Código incorreto. Tente novamente.';
    return;
  }
  localStorage.setItem(CHAVE_TOKEN, token);
  entrarNoPainel();
});

async function entrarNoPainel() {
  document.getElementById('gate-admin').hidden = true;
  document.getElementById('painel-admin').hidden = false;
  await Promise.all([carregarProdutosAdmin(), carregarLojaAdmin()]);
  await carregarPedidosAdmin();
}

// ---------- Abas ----------

document.querySelectorAll('.aba-botao').forEach((botao) => {
  botao.addEventListener('click', () => {
    document.querySelectorAll('.aba-botao').forEach((b) => b.classList.remove('ativa'));
    botao.classList.add('ativa');
    ['produtos', 'pedidos', 'loja'].forEach((nome) => {
      document.getElementById(`aba-${nome}`).hidden = nome !== botao.dataset.aba;
    });
  });
});

// ---------- Produtos ----------

async function carregarProdutosAdmin() {
  const resposta = await fetch('/api/produtos');
  const produtos = await resposta.json();
  const corpo = document.getElementById('tabela-produtos');
  corpo.innerHTML = '';

  produtos.forEach((produto) => {
    const linha = document.createElement('tr');
    linha.innerHTML = `
      <td>${produto.nome}</td>
      <td>${formatarKz(produto.preco)}</td>
      <td>${produto.estoque}</td>
      <td>
        <button class="acao-linha" data-acao="editar">Editar</button>
        <button class="acao-linha" data-acao="remover">Remover</button>
      </td>
    `;
    linha.querySelector('[data-acao="editar"]').addEventListener('click', () => editarProduto(produto));
    linha.querySelector('[data-acao="remover"]').addEventListener('click', () => removerProduto(produto));
    corpo.appendChild(linha);
  });
}

document.getElementById('form-produto').addEventListener('submit', async (evento) => {
  evento.preventDefault();
  const mensagem = document.getElementById('mensagem-produto');
  mensagem.textContent = '';
  mensagem.className = 'mensagem-estado';

  const corpo = {
    nome: document.getElementById('produto-nome').value.trim(),
    preco: Number(document.getElementById('produto-preco').value),
    estoque: Number(document.getElementById('produto-estoque').value) || 0,
    imagem: document.getElementById('produto-imagem').value.trim(),
    descricao: document.getElementById('produto-descricao').value.trim(),
  };

  try {
    const resposta = await pedidoAutenticado('/api/produtos', { method: 'POST', body: JSON.stringify(corpo) });
    if (!resposta.ok) throw new Error('falha ao criar');
    evento.target.reset();
    document.getElementById('produto-estoque').value = 1;
    mensagem.textContent = 'Produto adicionado ✓';
    mensagem.classList.add('sucesso');
    carregarProdutosAdmin();
  } catch (erro) {
    mensagem.textContent = 'Não foi possível adicionar o produto.';
    mensagem.classList.add('erro');
  }
});

async function editarProduto(produto) {
  const novoPreco = prompt(`Novo preço para "${produto.nome}" (Kz):`, produto.preco);
  if (novoPreco === null) return;
  const novoEstoque = prompt(`Novo estoque para "${produto.nome}":`, produto.estoque);
  if (novoEstoque === null) return;

  try {
    await pedidoAutenticado(`/api/produtos/${produto.id}`, {
      method: 'PUT',
      body: JSON.stringify({ preco: Number(novoPreco), estoque: Number(novoEstoque) }),
    });
    carregarProdutosAdmin();
  } catch {
    alert('Não foi possível atualizar o produto.');
  }
}

async function removerProduto(produto) {
  if (!confirm(`Remover "${produto.nome}" da loja?`)) return;
  try {
    await pedidoAutenticado(`/api/produtos/${produto.id}`, { method: 'DELETE' });
    carregarProdutosAdmin();
  } catch {
    alert('Não foi possível remover o produto.');
  }
}

// ---------- Pedidos ----------

const PROXIMO_ESTADO = {
  pendente: { rotulo: 'Marcar como pago', destino: 'pago' },
  pago: { rotulo: 'Marcar como enviado', destino: 'enviado' },
  enviado: null,
  cancelado: null,
};

async function carregarPedidosAdmin() {
  const resposta = await pedidoAutenticado('/api/pedidos');
  const pedidos = await resposta.json();
  const corpo = document.getElementById('tabela-pedidos');
  corpo.innerHTML = '';

  if (pedidos.length === 0) {
    corpo.innerHTML = '<tr><td colspan="6">Ainda sem pedidos.</td></tr>';
    return;
  }

  pedidos
    .slice()
    .reverse()
    .forEach((pedido) => {
      const linha = document.createElement('tr');
      const itensTexto = pedido.itens.map((i) => `${i.quantidade}× ${i.nome}`).join(', ');
      const proximo = PROXIMO_ESTADO[pedido.status];

      linha.innerHTML = `
        <td>#${pedido.id}</td>
        <td>${pedido.cliente.nome}<br><span style="color:var(--cor-texto-suave); font-size:0.78rem;">${pedido.cliente.telefone}</span></td>
        <td>${itensTexto}</td>
        <td>${formatarKz(pedido.total)}</td>
        <td><span class="etiqueta-estado etiqueta-${pedido.status}">${pedido.status}</span></td>
        <td>
          ${proximo ? `<button class="acao-linha" data-acao="avancar">${proximo.rotulo}</button>` : ''}
          ${pedido.status !== 'cancelado' && pedido.status !== 'enviado' ? `<button class="acao-linha" data-acao="cancelar">Cancelar</button>` : ''}
        </td>
      `;

      if (proximo) {
        linha.querySelector('[data-acao="avancar"]').addEventListener('click', () => atualizarEstadoPedido(pedido.id, proximo.destino));
      }
      const botaoCancelar = linha.querySelector('[data-acao="cancelar"]');
      if (botaoCancelar) {
        botaoCancelar.addEventListener('click', () => atualizarEstadoPedido(pedido.id, 'cancelado'));
      }

      corpo.appendChild(linha);
    });
}

async function atualizarEstadoPedido(id, novoEstado) {
  try {
    await pedidoAutenticado(`/api/pedidos/${id}`, { method: 'PUT', body: JSON.stringify({ status: novoEstado }) });
    carregarPedidosAdmin();
  } catch {
    alert('Não foi possível atualizar o pedido.');
  }
}

// ---------- Dados da loja ----------

async function carregarLojaAdmin() {
  const resposta = await fetch('/api/loja');
  const loja = await resposta.json();
  document.getElementById('loja-nome').value = loja.nome || '';
  document.getElementById('loja-whatsapp').value = loja.whatsapp || '';
  document.getElementById('loja-descricao').value = loja.descricao || '';
  document.getElementById('loja-iban').value = loja.pagamento?.transferencia?.iban || '';
  document.getElementById('loja-mbway').value = loja.pagamento?.mbway?.numero || '';
  document.getElementById('loja-instrucoes').value = loja.pagamento?.instrucoes || '';
}

document.getElementById('form-loja').addEventListener('submit', async (evento) => {
  evento.preventDefault();
  const mensagem = document.getElementById('mensagem-loja');
  mensagem.textContent = '';
  mensagem.className = 'mensagem-estado';

  const respostaAtual = await fetch('/api/loja');
  const atual = await respostaAtual.json();

  const corpo = {
    nome: document.getElementById('loja-nome').value.trim(),
    whatsapp: document.getElementById('loja-whatsapp').value.trim(),
    descricao: document.getElementById('loja-descricao').value.trim(),
    pagamento: {
      ...atual.pagamento,
      transferencia: { ...atual.pagamento?.transferencia, iban: document.getElementById('loja-iban').value.trim() },
      mbway: { numero: document.getElementById('loja-mbway').value.trim() },
      instrucoes: document.getElementById('loja-instrucoes').value.trim(),
    },
  };

  try {
    const resposta = await pedidoAutenticado('/api/loja', { method: 'PUT', body: JSON.stringify(corpo) });
    if (!resposta.ok) throw new Error('falha');
    mensagem.textContent = 'Alterações guardadas ✓';
    mensagem.classList.add('sucesso');
  } catch {
    mensagem.textContent = 'Não foi possível guardar as alterações.';
    mensagem.classList.add('erro');
  }
});

// ---------- Arranque ----------

(async function iniciar() {
  const token = obterToken();
  if (token && (await validarToken(token))) {
    entrarNoPainel();
  }
})();
