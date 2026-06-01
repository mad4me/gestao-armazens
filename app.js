let dadosApp = { estatisticas: {}, produtos: [], clientes: [], armazens: [], movimentacoes: [] };
let moduloParaRemover = null;
let idParaRemover = null;

document.addEventListener("DOMContentLoaded", async () => {
    
    // ==========================================
    // 🔒 FLUXO DE SEGURANÇA E AUTENTICAÇÃO
    // ==========================================
    if (!localStorage.getItem("utilizador_sessao")) {
        console.log("Acesso negado: Redirecionando para a página de autenticação...");
        window.location.href = "login.html";
        return; // Para a execução do script imediatamente
    }

    const userSessao = localStorage.getItem("utilizador_sessao") || "Admin";
    const campoNome = document.querySelector(".user-name");
    const campoAvatar = document.querySelector(".avatar");
    
    if (campoNome) campoNome.innerText = userSessao;
    if (campoAvatar) campoAvatar.innerText = userSessao.substring(0, 2).toUpperCase();

    const btnLogout = document.getElementById("menu-logout");
    if (btnLogout) {
        btnLogout.addEventListener("click", (e) => {
            e.preventDefault();
            localStorage.removeItem("utilizador_sessao");
            window.location.href = "login.html"; // Redireciona de volta após limpar o token
        });
    }

    // ==========================================
    // 📦 COMUNICAÇÃO DE DADOS (FETCH API)
    // ==========================================
    if (!localStorage.getItem("dados_wareflow")) {
        try {
            console.log("A inicializar dados a partir do ficheiro dados.json...");
            const resposta = await fetch("dados.json");
            if (!resposta.ok) throw new Error("Erro ao aceder ao ficheiro de dados JSON.");
            const dadosDoFicheiro = await resposta.json();
            
            localStorage.setItem("dados_wareflow", JSON.stringify(dadosDoFicheiro));
        } catch (erro) {
            console.error("Falha no fetch inicial. A usar fallback vazio:", erro);
            const dadosIniciaisVazios = { estatisticas: { totalProdutos: 0, stockBaixo: 0, totalClientes: 0 }, clientes: [], armazens: [], produtos: [], movimentacoes: [] };
            localStorage.setItem("dados_wareflow", JSON.stringify(dadosIniciaisVazios));
        }
    }
    
    dadosApp = JSON.parse(localStorage.getItem("dados_wareflow"));

    // Inicialização da Interface Dinâmica
    atualizarIndicadoresDashboard();
    renderizarTabelaClientes(dadosApp.clientes);
    renderizarTabelaArmazens(dadosApp.armazens);
    renderizarTabelaProdutos(dadosApp.produtos);
    renderizarTabelaMovimentacoes(dadosApp.movimentacoes);

    configurarCliquesSidebar();
    configurarPesquisasEmTempoReal();
    configurarSubmissaoFormulario();
    configurarBotoesModalRemocao();
});

function salvarDadosNoStorage() {
    localStorage.setItem("dados_wareflow", JSON.stringify(dadosApp));
}

function configurarCliquesSidebar() {
    const rotas = [
        { b: "menu-dashboard", p: "pag-dashboard" },
        { b: "menu-clientes", p: "pag-clientes" },
        { b: "menu-armazens", p: "pag-armazens" },
        { b: "menu-produtos", p: "pag-produtos" },
        { b: "menu-movimentacoes", p: "pag-movimentacoes" }
    ];

    rotas.forEach(r => {
        const btn = document.getElementById(r.b);
        if (btn) {
            btn.addEventListener("click", (e) => {
                e.preventDefault();
                document.querySelectorAll(".nav-item").forEach(i => i.classList.remove("active"));
                btn.classList.add("active");

                document.querySelectorAll(".aba-conteudo").forEach(pag => pag.classList.add("hidden"));
                document.getElementById(r.p).classList.remove("hidden");
            });
        }
    });
}

function atualizarIndicadoresDashboard() {
    dadosApp.estatisticas.totalProdutos = dadosApp.produtos.length;
    dadosApp.estatisticas.totalClientes = dadosApp.clientes.length;
    dadosApp.estatisticas.stockBaixo = dadosApp.produtos.filter(p => Number(p.quantidade) < 20).length;

    document.getElementById("dash-total-prod").innerText = dadosApp.estatisticas.totalProdutos;
    document.getElementById("dash-stock-baixo").innerText = dadosApp.estatisticas.stockBaixo;
    document.getElementById("dash-total-cli").innerText = dadosApp.estatisticas.totalClientes;

    const containerBarras = document.getElementById("dashboard-barras-armazens");
    if (containerBarras) {
        containerBarras.innerHTML = "";
        
        if (!dadosApp.armazens || dadosApp.armazens.length === 0) {
            containerBarras.innerHTML = `<p style="color:gray; font-size:13px; font-style:italic;">Nenhum armazém registado para apresentar taxas de ocupação.</p>`;
            return;
        }

        dadosApp.armazens.forEach(arm => {
            const totalUnidadesNoArmazem = dadosApp.produtos
                .filter(p => p.armazem === arm.nome)
                .reduce((acumulado, prod) => acumulado + Number(prod.quantidade), 0);

            const capacidadeMaxima = parseInt(arm.capacidade) || 1000;
            let percentagem = Math.round((totalUnidadesNoArmazem / capacidadeMaxima) * 100);
            if (percentagem > 100) percentagem = 100;
            if (isNaN(percentagem)) percentagem = 0;

            containerBarras.innerHTML += `
                <div>
                    <p style="font-size:12px; margin-bottom:4px; font-weight:600;">${arm.nome} (${percentagem}% - ${totalUnidadesNoArmazem}/${capacidadeMaxima} un)</p>
                    <div style="background:#e2e8f0; border-radius:4px; height:12px;">
                        <div style="background:#2563eb; width:${percentagem}%; height:100%; border-radius:4px; transition: width 0.3s ease;"></div>
                    </div>
                </div>`;
        });
    }
}

function renderizarTabelaClientes(lista) {
    const tbody = document.getElementById("tabela-clientes-body");
    if (!tbody) return;
    tbody.innerHTML = "";
    lista.forEach(c => {
        const bClass = c.status === "Ativo" ? "badge-ok" : "badge-baixo";
        tbody.innerHTML += `<tr>
            <td><strong>${c.id}</strong></td><td>${c.nome}</td><td>${c.contacto}</td><td>${c.localizacao}</td>
            <td><span class="badge ${bClass}">${c.status}</span></td>
            <td><button class="btn-action delete" onclick="removerRegisto('clientes', '${c.id}')">[Remover]</button></td>
        </tr>`;
    });
}

function renderizarTabelaArmazens(lista) {
    const tbody = document.getElementById("tabela-armazens-body");
    if (!tbody) return;
    tbody.innerHTML = "";
    lista.forEach(a => {
        tbody.innerHTML += `<tr>
            <td><strong>${a.id}</strong></td><td>${a.nome}</td><td>${a.localizacao}</td>
            <td><span style="color:#2563eb;font-weight:bold;">${a.capacidade} un</span></td><td>${a.responsavel}</td>
            <td><button class="btn-action delete" onclick="removerRegisto('armazens', '${a.id}')">[Remover]</button></td>
        </tr>`;
    });
}

function renderizarTabelaProdutos(lista) {
    const tbody = document.getElementById("tabela-produtos-body");
    if (!tbody) return;
    tbody.innerHTML = "";
    lista.forEach(p => {
        const bClass = Number(p.quantidade) < 20 ? "badge-baixo" : "badge-ok";
        const estadoTexto = Number(p.quantidade) < 20 ? "Stock Baixo" : "OK";
        tbody.innerHTML += `<tr>
            <td><strong>#${p.id}</strong></td><td>${p.nome}</td><td>${p.categoria}</td><td>${p.armazem}</td><td>${p.quantidade} un</td>
            <td><span class="badge ${bClass}">${estadoTexto}</span></td>
            <td><button class="btn-action delete" onclick="removerRegisto('produtos', '${p.id}')">[Remover]</button></td>
        </tr>`;
    });
}

function renderizarTabelaMovimentacoes(lista) {
    const tbody = document.getElementById("tabela-movimentacoes-body");
    if (!tbody) return;
    tbody.innerHTML = "";
    lista.forEach(m => {
        const tClass = m.tipo === "Entrada" ? "badge-ok" : "badge-baixo";
        tbody.innerHTML += `<tr><td>#${m.id}</td><td>${m.data}</td><td><strong>${m.produto}</strong></td><td><span class="badge ${tClass}">${m.tipo}</span></td><td>${m.qtd} un</td><td><span style="color:gray;">${m.utilizador}</span></td></tr>`;
    });
}

function configurarPesquisasEmTempoReal() {
    document.getElementById("busca-clientes").addEventListener("input", (e) => {
        const txt = e.target.value.toLowerCase();
        renderizarTabelaClientes(dadosApp.clientes.filter(c => c.nome.toLowerCase().includes(txt)));
    });
    document.getElementById("busca-armazens").addEventListener("input", (e) => {
        const txt = e.target.value.toLowerCase();
        renderizarTabelaArmazens(dadosApp.armazens.filter(a => a.nome.toLowerCase().includes(txt)));
    });
    document.getElementById("busca-produtos").addEventListener("input", (e) => {
        const txt = e.target.value.toLowerCase();
        renderizarTabelaProdutos(dadosApp.produtos.filter(p => p.nome.toLowerCase().includes(txt)));
    });
}

function removerRegisto(modulo, id) {
    moduloParaRemover = modulo;
    idParaRemover = id;
    document.getElementById("modal-confirmacao").classList.add("active");
}

function configurarBotoesModalRemocao() {
    document.getElementById("btn-cancelar-remover").addEventListener("click", () => {
        document.getElementById("modal-confirmacao").classList.remove("active");
        moduloParaRemover = null;
        idParaRemover = null;
    });

    document.getElementById("btn-confirmar-remover").addEventListener("click", () => {
        if (moduloParaRemover && idParaRemover) {
            dadosApp[moduloParaRemover] = dadosApp[moduloParaRemover].filter(item => item.id !== idParaRemover);
            
            salvarDadosNoStorage();
            atualizarIndicadoresDashboard();
            
            if (moduloParaRemover === 'clientes') renderizarTabelaClientes(dadosApp.clientes);
            if (moduloParaRemover === 'armazens') renderizarTabelaArmazens(dadosApp.armazens);
            if (moduloParaRemover === 'produtos') renderizarTabelaProdutos(dadosApp.produtos);
        }
        document.getElementById("modal-confirmacao").classList.remove("active");
        moduloParaRemover = null;
        idParaRemover = null;
    });
}

function abrirModal(tipo) {
    const modal = document.getElementById("modal-global");
    document.getElementById("modal-titulo").innerText = `Adicionar Novo em: ${tipo}`;
    const container = document.getElementById("campos-dinamicos");

    if (tipo === 'Clientes') {
        container.innerHTML = `<div class="form-group"><label>Nome do Cliente</label><input type="text" id="f-c-nome" required></div><div class="form-group"><label>Contacto</label><input type="text" id="f-c-con" required></div><div class="form-group"><label>Cidade</label><input type="text" id="f-c-loc" required></div>`;
    } else if (tipo === 'Armazéns') {
        container.innerHTML = `<div class="form-group"><label>Nome do Armazém</label><input type="text" id="f-a-nome" required></div><div class="form-group"><label>Localização</label><input type="text" id="f-a-loc" required></div><div class="form-group"><label>Capacidade Máxima (unidades)</label><input type="number" id="f-a-cap" value="1000" required></div><div class="form-group"><label>Responsável</label><input type="text" id="f-a-res" required></div>`;
    } else if (tipo === 'Produtos') {
        let opcoesArmazens = "";
        if (dadosApp.armazens.length === 0) {
            opcoesArmazens = `<option value="">Registe um Armazém Primeiro!</option>`;
        } else {
            dadosApp.armazens.forEach(a => {
                opcoesArmazens += `<option value="${a.nome}">${a.nome}</option>`;
            });
        }
        
        container.innerHTML = `<div class="form-group"><label>Nome do Artigo</label><input type="text" id="f-p-nome" required></div><div class="form-group"><label>Categoria</label><input type="text" id="f-p-cat" required></div><div class="form-group"><label>Armazém Destino</label><select id="f-p-arm" required>${opcoesArmazens}</select></div><div class="form-group"><label>Quantidade</label><input type="number" id="f-p-qtd" required></div>`;
    }
    modal.classList.add("active");
}

function fecharModal() {
    document.getElementById("modal-global").classList.remove("active");
    const feedback = document.getElementById("form-feedback");
    feedback.classList.add("hidden");
    feedback.className = "form-feedback"; 
}

function configurarSubmissaoFormulario() {
    const form = document.getElementById("form-global");
    form.addEventListener("submit", (e) => {
        e.preventDefault();
        const titulo = document.getElementById("modal-titulo").innerText;
        const feedback = document.getElementById("form-feedback");
        const operadorAtivo = localStorage.getItem("utilizador_sessao") || "Admin";

        feedback.classList.remove("hidden");

        if (titulo.includes("Clientes")) {
            const nome = document.getElementById("f-c-nome").value;
            dadosApp.clientes.unshift({ id: "C" + Math.floor(100 + Math.random() * 900), nome, contacto: document.getElementById("f-c-con").value, localizacao: document.getElementById("f-c-loc").value, status: "Ativo" });
            renderizarTabelaClientes(dadosApp.clientes);
            feedback.innerText = `Sucesso: O cliente "${nome}" foi registado na View do sistema.`;
        } else if (titulo.includes("Armazéns")) {
            const nome = document.getElementById("f-a-nome").value;
            dadosApp.armazens.unshift({ id: "A" + (dadosApp.armazens.length + 1), nome, localizacao: document.getElementById("f-a-loc").value, capacidade: document.getElementById("f-a-cap").value, responsavel: document.getElementById("f-a-res").value });
            renderizarTabelaArmazens(dadosApp.armazens);
            feedback.innerText = `Sucesso: O complexo "${nome}" foi criado com sucesso.`;
        } else if (titulo.includes("Produtos")) {
            const nome = document.getElementById("f-p-nome").value;
            const armazemSelecionado = document.getElementById("f-p-arm").value;
            const qtd = parseInt(document.getElementById("f-p-qtd").value);

            if (!armazemSelecionado) {
                feedback.className = "form-feedback error";
                feedback.innerText = "Erro: É obrigatório criar e selecionar um armazém ativo.";
                return;
            }

            dadosApp.produtos.unshift({ id: Math.floor(10000 + Math.random() * 90000).toString(), nome, categoria: document.getElementById("f-p-cat").value, armazem: armazemSelecionado, quantidade: qtd, estado: qtd < 20 ? "Stock Baixo" : "OK" });
            renderizarTabelaProdutos(dadosApp.produtos);
            
            dadosApp.movimentacoes.unshift({
                id: "M" + Math.floor(900 + Math.random() * 99),
                data: new Date().toISOString().replace('T', ' ').substring(0, 16),
                produto: nome,
                tipo: "Entrada",
                qtd: qtd,
                utilizador: operadorAtivo
            });
            renderizarTabelaMovimentacoes(dadosApp.movimentacoes);
            
            feedback.innerText = `Sucesso: O artigo "${nome}" deu entrada no sistema.`;
        }

        salvarDadosNoStorage();
        atualizarIndicadoresDashboard();
        feedback.className = "form-feedback success";
        form.reset();
        setTimeout(fecharModal, 2000);
    });
}
