let produtosCache = [];
let lojaCache = null;

async function carregarProdutos() {
  const resposta = await fetch('/api/produtos');
  produtosCache = await resposta.json();
}

function itensDetalhados() {
  const carrinho = obterCarrinho();
  return carrinho
    .map((item) => {
      const produto = produtosCache.find((p) => p.id === item.produtoId);
      if (!produto) return null;
      return { ...item, produto };
    })
    .filter(Boolean);
}

function renderizarCarrinho() {
  const lista = document.getElementById('lista-carrinho');
  const itens = itensDetalhados();

  if (itens.length === 0) {
    lista.innerHTML = '<p class="vazio">O seu carrinho está vazio. <a href="/" style="color: var(--cor-accent);">Ver produtos</a></p>';
    document.getElementById('resumo-total').hidden = true;
    document.getElementById('form-checkout').hidden = true;
    return;
  }

  document.getElementById('resumo-total').hidden = false;
  document.getElementById('form-checkout').hidden = false;

  lista.innerHTML = '';
  let total = 0;

  itens.forEach(({ produtoId, quantidade, produto }) => {
    total += produto.preco * quantidade;

    const linha = document.createElement('div');
    linha.className = 'item-carrinho';
    linha.innerHTML = `
      <div>
        <div class="item-carrinho-nome">${produto.nome}</div>
        <div class="item-carrinho-preco">${formatarKz(produto.preco)} cada</div>
      </div>
      <div class="controlo-quantidade">
        <button type="button" data-acao="diminuir" aria-label="Diminuir quantidade">−</button>
        <span>${quantidade}</span>
        <button type="button" data-acao="aumentar" aria-label="Aumentar quantidade">+</button>
      </div>
      <div class="preco">${formatarKz(produto.preco * quantidade)}</div>
      <button type="button" class="remover-item">Remover</button>
    `;

    linha.querySelector('[data-acao="diminuir"]').addEventListener('click', () => {
      ajustarQuantidade(produtoId, -1);
    });
    linha.querySelector('[data-acao="aumentar"]').addEventListener('click', () => {
      ajustarQuantidade(produtoId, 1);
    });
    linha.querySelector('.remover-item').addEventListener('click', () => {
      removerItem(produtoId);
    });

    lista.appendChild(linha);
  });

  document.getElementById('valor-total').textContent = formatarKz(total);
}

function ajustarQuantidade(produtoId, delta) {
  const carrinho = obterCarrinho();
  const item = carrinho.find((i) => i.produtoId === produtoId);
  if (!item) return;
  item.quantidade += delta;
  const carrinhoFiltrado = item.quantidade <= 0
    ? carrinho.filter((i) => i.produtoId !== produtoId)
    : carrinho;
  guardarCarrinho(carrinhoFiltrado);
  renderizarCarrinho();
}

function removerItem(produtoId) {
  const carrinho = obterCarrinho().filter((i) => i.produtoId !== produtoId);
  guardarCarrinho(carrinho);
  renderizarCarrinho();
}

async function finalizarPedido(evento) {
  evento.preventDefault();
  const botao = document.getElementById('botao-finalizar');
  botao.disabled = true;
  botao.textContent = 'A enviar…';

  const dados = new FormData(evento.target);
  const itens = obterCarrinho().map((i) => ({ produtoId: i.produtoId, quantidade: i.quantidade }));

  try {
    const resposta = await fetch('/api/pedidos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        itens,
        cliente: {
          nome: dados.get('nome'),
          telefone: dados.get('telefone'),
          endereco: dados.get('endereco'),
          notas: dados.get('notas'),
        },
      }),
    });

    if (!resposta.ok) throw new Error('Falha ao criar pedido');
    const pedido = await resposta.json();

    mostrarConfirmacao(pedido);
    guardarCarrinho([]);
    document.getElementById('lista-carrinho').hidden = true;
    document.getElementById('resumo-total').hidden = true;
    document.getElementById('form-checkout').hidden = true;
  } catch (erro) {
    botao.disabled = false;
    botao.textContent = 'Finalizar pedido';
    alert('Não foi possível enviar o pedido. Verifique a ligação e tente novamente.');
    console.error(erro);
  }
}

function mostrarConfirmacao(pedido) {
  const bloco = document.getElementById('confirmacao');
  bloco.hidden = false;

  const resumoItens = pedido.itens.map((i) => `${i.quantidade}× ${i.nome}`).join('%0A');
  const mensagemWhatsapp = encodeURIComponent(
    `Olá! Acabei de fazer o pedido #${pedido.id} na Stelanes-Empório:\n${pedido.itens.map((i) => `${i.quantidade}× ${i.nome}`).join('\n')}\nTotal: ${formatarKz(pedido.total)}\nVou enviar o comprovativo do pagamento a seguir.`
  );
  const whatsapp = lojaCache ? `https://wa.me/${lojaCache.whatsapp}?text=${mensagemWhatsapp}` : '#';

  const pagamento = lojaCache?.pagamento;

  bloco.innerHTML = `
    <h2>Pedido recebido ✓</h2>
    <dl>
      <dt>Número do pedido</dt><dd>#${pedido.id}</dd>
      <dt>Total</dt><dd>${formatarKz(pedido.total)}</dd>
      <dt>Estado</dt><dd>Pendente de pagamento</dd>
    </dl>
    <p>${pagamento?.instrucoes || 'Efetue o pagamento e envie o comprovativo pelo WhatsApp.'}</p>
    ${pagamento?.transferencia ? `
      <dl>
        <dt>Banco</dt><dd>${pagamento.transferencia.banco}</dd>
        <dt>IBAN</dt><dd>${pagamento.transferencia.iban}</dd>
        <dt>Titular</dt><dd>${pagamento.transferencia.titular}</dd>
        <dt>MB Way</dt><dd>${pagamento.mbway?.numero || ''}</dd>
      </dl>
    ` : ''}
    <a href="${whatsapp}" target="_blank" rel="noopener" class="botao botao-principal botao-bloco">Enviar comprovativo pelo WhatsApp</a>
  `;
}

document.addEventListener('DOMContentLoaded', async () => {
  lojaCache = await carregarDadosLoja();
  await carregarProdutos();
  renderizarCarrinho();
  document.getElementById('form-checkout').addEventListener('submit', finalizarPedido);
});
