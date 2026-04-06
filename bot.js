// ============================================================
//  DISCORD BOT COMPLETO - Tickets, Compras, Cargos e mais
//  Dependências: discord.js v14
//  Instalar: npm install discord.js @discordjs/rest
// ============================================================

const {
  Client,
  GatewayIntentBits,
  Partials,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  ChannelType,
  PermissionFlagsBits,
  SlashCommandBuilder,
  REST,
  Routes,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  Collection,
} = require("discord.js");

require("dotenv").config();

// ── Configuração central ──────────────────────────────────────
const CONFIG = {
  TOKEN: process.env.DISCORD_TOKEN,
  CLIENT_ID: process.env.CLIENT_ID,
  GUILD_ID: process.env.GUILD_ID,

  // Cores
  CORES: {
    PRIMARIA: 0x5865f2,   // Blurple Discord
    SUCESSO:  0x57f287,   // Verde
    ERRO:     0xed4245,   // Vermelho
    AVISO:    0xfee75c,   // Amarelo
    INFO:     0x5865f2,
    TICKET:   0xeb459e,   // Rosa
    LOJA:     0xf0b132,   // Dourado
  },

  // IDs dos cargos (serão criados pelo comando /setup)
  CARGOS: {
    DONO:     "DONO",
    ADMIN:    "ADMIN",
    SUPORTE:  "SUPORTE",
    MODERADOR:"MODERADOR",
    CLIENTE:  "CLIENTE",
    VIP:      "VIP",
    MEMBRO:   "MEMBRO",
  },

  // Prefix para nomes de canais de ticket
  TICKET_PREFIX: "ticket-",

  // Produtos da loja (personalize aqui)
  PRODUTOS: [
    {
      id: "prod_001",
      nome: "🥉 Plano Básico",
      descricao: "Acesso básico com suporte por e-mail.",
      preco: "R$ 19,90/mês",
      emoji: "🥉",
    },
    {
      id: "prod_002",
      nome: "🥈 Plano Profissional",
      descricao: "Suporte prioritário + recursos avançados.",
      preco: "R$ 49,90/mês",
      emoji: "🥈",
    },
    {
      id: "prod_003",
      nome: "🥇 Plano Premium",
      descricao: "Acesso total, suporte VIP 24h.",
      preco: "R$ 99,90/mês",
      emoji: "🥇",
    },
    {
      id: "prod_004",
      nome: "⚡ Serviço Avulso",
      descricao: "Consultoria ou serviço único sob demanda.",
      preco: "Sob consulta",
      emoji: "⚡",
    },
  ],
};

// ── Instância do cliente ──────────────────────────────────────
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
  ],
  partials: [Partials.Channel, Partials.Message, Partials.GuildMember],
});

// ── Armazenamento em memória (substitua por banco de dados em produção)
const ticketsAbertos = new Map();   // channelId → { userId, tipo, produto }
const comprasPendentes = new Map(); // channelId → { userId, produto }

// ============================================================
//  SLASH COMMANDS — Definição
// ============================================================
const comandos = [
  new SlashCommandBuilder()
    .setName("setup")
    .setDescription("⚙️ Configura toda a estrutura do servidor (apenas admin)")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  new SlashCommandBuilder()
    .setName("painel-tickets")
    .setDescription("🎫 Envia o painel de abertura de tickets no canal atual")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  new SlashCommandBuilder()
    .setName("loja")
    .setDescription("🛒 Envia o painel da loja no canal atual")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  new SlashCommandBuilder()
    .setName("anuncio")
    .setDescription("📢 Faz um anúncio no canal de divulgação")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption((o) =>
      o.setName("titulo").setDescription("Título do anúncio").setRequired(true)
    )
    .addStringOption((o) =>
      o.setName("mensagem").setDescription("Conteúdo do anúncio").setRequired(true)
    )
    .addStringOption((o) =>
      o.setName("imagem").setDescription("URL de imagem (opcional)").setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName("fechar-ticket")
    .setDescription("🔒 Fecha o ticket atual")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  new SlashCommandBuilder()
    .setName("adicionar-cargo")
    .setDescription("🎭 Adiciona um cargo a um membro")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .addUserOption((o) =>
      o.setName("usuario").setDescription("Usuário").setRequired(true)
    )
    .addStringOption((o) =>
      o
        .setName("cargo")
        .setDescription("Cargo a adicionar")
        .setRequired(true)
        .addChoices(
          { name: "Cliente", value: "CLIENTE" },
          { name: "VIP", value: "VIP" },
          { name: "Moderador", value: "MODERADOR" },
          { name: "Suporte", value: "SUPORTE" },
          { name: "Admin", value: "ADMIN" }
        )
    ),

  new SlashCommandBuilder()
    .setName("info")
    .setDescription("ℹ️ Informações do bot e do servidor"),
];

// ============================================================
//  REGISTRO DOS COMANDOS
// ============================================================
async function registrarComandos() {
  const rest = new REST({ version: "10" }).setToken(CONFIG.TOKEN);
  try {
    console.log("📡 Registrando slash commands...");
    await rest.put(Routes.applicationGuildCommands(CONFIG.CLIENT_ID, CONFIG.GUILD_ID), {
      body: comandos.map((c) => c.toJSON()),
    });
    console.log("✅ Slash commands registrados com sucesso!");
  } catch (err) {
    console.error("❌ Erro ao registrar comandos:", err);
  }
}

// ============================================================
//  FUNÇÃO: SETUP COMPLETO DO SERVIDOR
// ============================================================
async function setupServidor(guild, interaction) {
  await interaction.deferReply({ ephemeral: true });

  const criados = { categorias: [], canais: [], cargos: [] };

  // ── 1. Criar Cargos ────────────────────────────────────────
  const definicaoCargos = [
    { nome: "👑 Dono",       cor: 0xffd700, hoist: true,  pos: 9 },
    { nome: "🛡️ Admin",      cor: 0xff4444, hoist: true,  pos: 8 },
    { nome: "🔧 Suporte",    cor: 0x5865f2, hoist: true,  pos: 7 },
    { nome: "⚔️ Moderador",  cor: 0x57f287, hoist: true,  pos: 6 },
    { nome: "💎 VIP",        cor: 0xf0b132, hoist: true,  pos: 5 },
    { nome: "🛒 Cliente",    cor: 0xeb459e, hoist: false, pos: 4 },
    { nome: "👤 Membro",     cor: 0x99aab5, hoist: false, pos: 3 },
  ];

  for (const def of definicaoCargos) {
    const existente = guild.roles.cache.find((r) => r.name === def.nome);
    if (!existente) {
      const cargo = await guild.roles.create({
        name: def.nome,
        color: def.cor,
        hoist: def.hoist,
        mentionable: true,
        reason: "Setup automático do bot",
      });
      criados.cargos.push(cargo.name);
    }
  }

  // Buscar cargos criados
  const getCargo = (nome) => guild.roles.cache.find((r) => r.name === nome);
  const cargoAdmin    = getCargo("🛡️ Admin");
  const cargoSuporte  = getCargo("🔧 Suporte");
  const cargoMod      = getCargo("⚔️ Moderador");
  const cargoVIP      = getCargo("💎 VIP");
  const cargoCliente  = getCargo("🛒 Cliente");
  const cargoMembro   = getCargo("👤 Membro");
  const everyone      = guild.roles.everyone;

  // ── 2. Criar Categorias e Canais ──────────────────────────
  const estrutura = [
    {
      categoria: "📋 INFORMAÇÕES",
      canais: [
        { nome: "📌│regras",       tipo: "text",  soLeitura: true },
        { nome: "📢│anúncios",     tipo: "text",  soLeitura: true },
        { nome: "👋│boas-vindas",   tipo: "text",  soLeitura: true },
        { nome: "📊│status-bot",   tipo: "text",  soLeitura: true },
      ],
    },
    {
      categoria: "💬 COMUNIDADE",
      canais: [
        { nome: "💬│geral",        tipo: "text"  },
        { nome: "🎮│off-topic",    tipo: "text"  },
        { nome: "🖼️│mídia",        tipo: "text"  },
        { nome: "🔊│voz-geral",    tipo: "voice" },
      ],
    },
    {
      categoria: "🛒 LOJA & SERVIÇOS",
      canais: [
        { nome: "🛍️│loja",         tipo: "text",  soLeitura: true },
        { nome: "📦│meus-pedidos", tipo: "text",  soLeitura: true },
        { nome: "⭐│avaliações",    tipo: "text"  },
      ],
    },
    {
      categoria: "🎫 SUPORTE & TICKETS",
      canais: [
        { nome: "🎫│abrir-ticket", tipo: "text",  soLeitura: true },
        { nome: "📋│tickets-log",  tipo: "text",  soLeitura: true, apenasStaff: true },
      ],
    },
    {
      categoria: "💎 ÁREA VIP",
      canais: [
        { nome: "💎│vip-geral",    tipo: "text",  apenasVIP: true },
        { nome: "🔊│voz-vip",      tipo: "voice", apenasVIP: true },
      ],
    },
    {
      categoria: "🔧 STAFF",
      canais: [
        { nome: "📋│painel-staff",  tipo: "text", apenasStaff: true },
        { nome: "💬│chat-staff",    tipo: "text", apenasStaff: true },
        { nome: "📝│logs-admin",    tipo: "text", apenasStaff: true },
        { nome: "🔊│reunião-staff", tipo: "voice",apenasStaff: true },
      ],
    },
  ];

  for (const bloco of estrutura) {
    // Verificar se categoria já existe
    let categoria = guild.channels.cache.find(
      (c) => c.type === ChannelType.GuildCategory && c.name === bloco.categoria
    );

    if (!categoria) {
      const permsCat = [
        { id: everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
        { id: guild.members.me.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ManageChannels] },
      ];

      categoria = await guild.channels.create({
        name: bloco.categoria,
        type: ChannelType.GuildCategory,
        permissionOverwrites: permsCat,
      });
      criados.categorias.push(bloco.categoria);
    }

    for (const canal of bloco.canais) {
      const existeCanal = guild.channels.cache.find((c) => c.name === canal.nome);
      if (existeCanal) continue;

      // Montar permissões
      const perms = [
        { id: guild.members.me.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels] },
      ];

      if (canal.apenasStaff) {
        perms.push({ id: everyone.id,      deny:  [PermissionFlagsBits.ViewChannel] });
        if (cargoAdmin)   perms.push({ id: cargoAdmin.id,   allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] });
        if (cargoSuporte) perms.push({ id: cargoSuporte.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] });
        if (cargoMod)     perms.push({ id: cargoMod.id,     allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] });
      } else if (canal.apenasVIP) {
        perms.push({ id: everyone.id,    deny:  [PermissionFlagsBits.ViewChannel] });
        if (cargoVIP)     perms.push({ id: cargoVIP.id,     allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] });
        if (cargoAdmin)   perms.push({ id: cargoAdmin.id,   allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] });
      } else if (canal.soLeitura) {
        perms.push({ id: everyone.id, allow: [PermissionFlagsBits.ViewChannel], deny: [PermissionFlagsBits.SendMessages] });
        if (cargoMembro)  perms.push({ id: cargoMembro.id,  allow: [PermissionFlagsBits.ViewChannel] });
        if (cargoCliente) perms.push({ id: cargoCliente.id, allow: [PermissionFlagsBits.ViewChannel] });
      } else {
        perms.push({ id: everyone.id,    allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] });
      }

      const novoCanal = await guild.channels.create({
        name: canal.nome,
        type: canal.tipo === "voice" ? ChannelType.GuildVoice : ChannelType.GuildText,
        parent: categoria.id,
        permissionOverwrites: perms,
      });
      criados.canais.push(novoCanal.name);
    }
  }

  // ── 3. Enviar mensagens iniciais ──────────────────────────
  await enviarMensagensIniciais(guild);

  // ── Responder ─────────────────────────────────────────────
  const embed = new EmbedBuilder()
    .setTitle("✅ Setup Concluído!")
    .setColor(CONFIG.CORES.SUCESSO)
    .addFields(
      { name: "🏷️ Cargos criados",      value: criados.cargos.length > 0 ? criados.cargos.join(", ") : "Já existiam",      inline: false },
      { name: "📁 Categorias criadas",   value: criados.categorias.length > 0 ? criados.categorias.join(", ") : "Já existiam", inline: false },
      { name: "💬 Canais criados",       value: `${criados.canais.length} canais configurados`,                               inline: false }
    )
    .setFooter({ text: "Use /painel-tickets e /loja para ativar os painéis!" })
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}

// ── Mensagens iniciais nos canais ─────────────────────────────
async function enviarMensagensIniciais(guild) {
  // Regras
  const canalRegras = guild.channels.cache.find((c) => c.name === "📌│regras");
  if (canalRegras) {
    const msgs = await canalRegras.messages.fetch({ limit: 5 });
    if (msgs.size === 0) {
      await canalRegras.send({
        embeds: [
          new EmbedBuilder()
            .setTitle("📋 Regras do Servidor")
            .setColor(CONFIG.CORES.PRIMARIA)
            .setDescription(
              "**Bem-vindo! Por favor, leia e respeite todas as regras.**\n\n" +
              "**§1** — Respeite todos os membros. Sem ofensas, discriminação ou assédio.\n" +
              "**§2** — Não faça spam ou flood de mensagens.\n" +
              "**§3** — Proibido conteúdo adulto, violência ou conteúdo ilegal.\n" +
              "**§4** — Não divulgue outros servidores sem autorização da staff.\n" +
              "**§5** — Use os canais corretos para cada tipo de mensagem.\n" +
              "**§6** — Siga as diretrizes da comunidade Discord.\n" +
              "**§7** — Decisões da staff são finais. Abra um ticket para contestar.\n\n" +
              "*O descumprimento das regras resultará em punição.*"
            )
            .setTimestamp(),
        ],
      });
    }
  }

  // Boas-vindas
  const canalBV = guild.channels.cache.find((c) => c.name === "👋│boas-vindas");
  if (canalBV) {
    const msgs = await canalBV.messages.fetch({ limit: 5 });
    if (msgs.size === 0) {
      await canalBV.send({
        embeds: [
          new EmbedBuilder()
            .setTitle("👋 Bem-vindo ao Servidor!")
            .setColor(CONFIG.CORES.SUCESSO)
            .setDescription(
              "Estamos felizes em ter você aqui! 🎉\n\n" +
              "📌 Leia as **regras** antes de participar.\n" +
              "🛒 Visite a **loja** para conhecer nossos serviços.\n" +
              "🎫 Abra um **ticket** se precisar de ajuda.\n\n" +
              "*Aproveite sua estadia!*"
            )
            .setTimestamp(),
        ],
      });
    }
  }
}

// ============================================================
//  PAINEL DE TICKETS
// ============================================================
async function enviarPainelTickets(canal, guild) {
  const embed = new EmbedBuilder()
    .setTitle("🎫 Central de Atendimento")
    .setColor(CONFIG.CORES.TICKET)
    .setDescription(
      "Precisa de ajuda? Nossa equipe está aqui! Escolha o tipo de atendimento abaixo:\n\n" +
      "🛒 **Compra / Pedido** — Dúvidas sobre produtos, pagamentos ou pedidos\n" +
      "🔧 **Suporte Técnico** — Problemas com o serviço ou produto adquirido\n" +
      "💬 **Dúvida Geral** — Qualquer outra dúvida ou informação\n" +
      "🚨 **Reportar Problema** — Bugs, erros ou denúncias\n\n" +
      "*Clique no botão correspondente para abrir seu ticket.*"
    )
    .setFooter({ text: "Apenas um ticket por usuário por vez." })
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("ticket_compra").setLabel("Compra / Pedido").setStyle(ButtonStyle.Success).setEmoji("🛒"),
    new ButtonBuilder().setCustomId("ticket_suporte").setLabel("Suporte Técnico").setStyle(ButtonStyle.Primary).setEmoji("🔧"),
    new ButtonBuilder().setCustomId("ticket_duvida").setLabel("Dúvida Geral").setStyle(ButtonStyle.Secondary).setEmoji("💬"),
    new ButtonBuilder().setCustomId("ticket_problema").setLabel("Reportar Problema").setStyle(ButtonStyle.Danger).setEmoji("🚨")
  );

  await canal.send({ embeds: [embed], components: [row] });
}

// ── Criar canal de ticket ─────────────────────────────────────
async function criarTicket(interaction, tipo) {
  const guild = interaction.guild;
  const usuario = interaction.user;

  // Verificar se já tem ticket aberto
  for (const [channelId, dados] of ticketsAbertos) {
    if (dados.userId === usuario.id) {
      const canalExistente = guild.channels.cache.get(channelId);
      if (canalExistente) {
        return interaction.reply({
          content: `❌ Você já possui um ticket aberto: ${canalExistente}`,
          ephemeral: true,
        });
      }
    }
  }

  // Buscar categoria de tickets
  const categoria = guild.channels.cache.find(
    (c) => c.type === ChannelType.GuildCategory && c.name === "🎫 SUPORTE & TICKETS"
  );

  const cargoSuporteObj = guild.roles.cache.find((r) => r.name === "🔧 Suporte");
  const cargoAdminObj   = guild.roles.cache.find((r) => r.name === "🛡️ Admin");

  const nomeCanal = `${CONFIG.TICKET_PREFIX}${usuario.username.toLowerCase().replace(/[^a-z0-9]/g, "")}`;

  const perms = [
    { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
    { id: usuario.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
    { id: guild.members.me.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels] },
  ];
  if (cargoSuporteObj) perms.push({ id: cargoSuporteObj.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] });
  if (cargoAdminObj)   perms.push({ id: cargoAdminObj.id,   allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] });

  const canalTicket = await guild.channels.create({
    name: nomeCanal,
    type: ChannelType.GuildText,
    parent: categoria?.id,
    topic: `Ticket de ${usuario.tag} | Tipo: ${tipo}`,
    permissionOverwrites: perms,
  });

  ticketsAbertos.set(canalTicket.id, { userId: usuario.id, tipo, produto: null });

  const tiposLabel = {
    ticket_compra:   "🛒 Compra / Pedido",
    ticket_suporte:  "🔧 Suporte Técnico",
    ticket_duvida:   "💬 Dúvida Geral",
    ticket_problema: "🚨 Reportar Problema",
  };

  const embedTicket = new EmbedBuilder()
    .setTitle(`${tiposLabel[tipo] || "🎫 Ticket"} — #${canalTicket.name}`)
    .setColor(CONFIG.CORES.TICKET)
    .setDescription(
      `Olá ${usuario}! 👋\n\n` +
      `Seu ticket foi aberto com sucesso.\n` +
      `Nossa equipe irá atendê-lo em breve.\n\n` +
      `**Tipo:** ${tiposLabel[tipo]}\n` +
      `**Aberto em:** <t:${Math.floor(Date.now() / 1000)}:F>`
    )
    .setFooter({ text: "Descreva sua situação detalhadamente para agilizarmos o atendimento." })
    .setTimestamp();

  // Se for compra, mostrar produtos
  let componentesExtra = [];
  if (tipo === "ticket_compra") {
    const selectProdutos = new StringSelectMenuBuilder()
      .setCustomId("selecionar_produto")
      .setPlaceholder("📦 Selecione o produto de interesse...")
      .addOptions(
        CONFIG.PRODUTOS.map((p) => ({
          label: p.nome,
          description: `${p.descricao} — ${p.preco}`,
          value: p.id,
          emoji: p.emoji,
        }))
      );
    componentesExtra.push(new ActionRowBuilder().addComponents(selectProdutos));
  }

  const rowFechar = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("fechar_ticket").setLabel("Fechar Ticket").setStyle(ButtonStyle.Danger).setEmoji("🔒"),
    new ButtonBuilder().setCustomId("assumir_ticket").setLabel("Assumir Atendimento").setStyle(ButtonStyle.Success).setEmoji("✋")
  );

  await canalTicket.send({
    content: `${usuario} ${cargoSuporteObj ? cargoSuporteObj : ""}`,
    embeds: [embedTicket],
    components: [...componentesExtra, rowFechar],
  });

  // Log
  const canalLog = guild.channels.cache.find((c) => c.name === "📋│tickets-log");
  if (canalLog) {
    await canalLog.send({
      embeds: [
        new EmbedBuilder()
          .setTitle("📋 Novo Ticket Aberto")
          .setColor(CONFIG.CORES.INFO)
          .addFields(
            { name: "Usuário",    value: `${usuario.tag} (${usuario.id})`, inline: true },
            { name: "Tipo",       value: tiposLabel[tipo],                 inline: true },
            { name: "Canal",      value: `${canalTicket}`,                 inline: true }
          )
          .setTimestamp(),
      ],
    });
  }

  await interaction.reply({ content: `✅ Seu ticket foi criado: ${canalTicket}`, ephemeral: true });
}

// ── Fechar ticket ─────────────────────────────────────────────
async function fecharTicket(interaction) {
  const canal = interaction.channel;
  const dados = ticketsAbertos.get(canal.id);

  if (!canal.name.startsWith(CONFIG.TICKET_PREFIX)) {
    return interaction.reply({ content: "❌ Este comando só pode ser usado em canais de ticket.", ephemeral: true });
  }

  const embed = new EmbedBuilder()
    .setTitle("🔒 Ticket Encerrado")
    .setColor(CONFIG.CORES.ERRO)
    .setDescription(`Ticket encerrado por ${interaction.user}.\nO canal será excluído em 10 segundos.`)
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });

  // Log
  const canalLog = interaction.guild.channels.cache.find((c) => c.name === "📋│tickets-log");
  if (canalLog && dados) {
    const usuarioOriginal = await interaction.client.users.fetch(dados.userId).catch(() => null);
    await canalLog.send({
      embeds: [
        new EmbedBuilder()
          .setTitle("🔒 Ticket Fechado")
          .setColor(CONFIG.CORES.AVISO)
          .addFields(
            { name: "Canal",      value: canal.name,                                          inline: true },
            { name: "Usuário",    value: usuarioOriginal ? usuarioOriginal.tag : dados.userId, inline: true },
            { name: "Fechado por",value: interaction.user.tag,                                 inline: true }
          )
          .setTimestamp(),
      ],
    });
  }

  ticketsAbertos.delete(canal.id);
  comprasPendentes.delete(canal.id);

  setTimeout(() => canal.delete().catch(() => {}), 10_000);
}

// ============================================================
//  PAINEL DA LOJA
// ============================================================
async function enviarPainelLoja(canal) {
  const embed = new EmbedBuilder()
    .setTitle("🛍️ Nossa Loja")
    .setColor(CONFIG.CORES.LOJA)
    .setDescription("Confira nossos produtos e serviços disponíveis!\nClique em **Comprar** para abrir um atendimento.")
    .setTimestamp();

  CONFIG.PRODUTOS.forEach((p) => {
    embed.addFields({
      name: `${p.emoji} ${p.nome}`,
      value: `${p.descricao}\n💰 **${p.preco}**`,
      inline: true,
    });
  });

  embed.setFooter({ text: "Pagamentos via Pix, cartão ou boleto. Nossa equipe irá orientá-lo!" });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("ticket_compra").setLabel("🛒 Quero Comprar!").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId("ver_avaliações").setLabel("⭐ Ver Avaliações").setStyle(ButtonStyle.Secondary)
  );

  await canal.send({ embeds: [embed], components: [row] });
}

// ============================================================
//  EVENTO: READY
// ============================================================
client.once("ready", async () => {
  console.log(`\n✅ Bot online como: ${client.user.tag}`);
  console.log(`📡 Conectado a ${client.guilds.cache.size} servidor(es)\n`);
  client.user.setActivity("🎫 Abrindo tickets | /ajuda", { type: 3 });
  await registrarComandos();
});

// ============================================================
//  EVENTO: INTERACTIONCREATE (Slash Commands + Botões + Selects)
// ============================================================
client.on("interactionCreate", async (interaction) => {
  // ── SLASH COMMANDS ────────────────────────────────────────
  if (interaction.isChatInputCommand()) {
    const { commandName, guild } = interaction;

    if (commandName === "setup") {
      await setupServidor(guild, interaction);
    }

    else if (commandName === "painel-tickets") {
      await enviarPainelTickets(interaction.channel, guild);
      await interaction.reply({ content: "✅ Painel de tickets enviado!", ephemeral: true });
    }

    else if (commandName === "loja") {
      await enviarPainelLoja(interaction.channel);
      await interaction.reply({ content: "✅ Painel da loja enviado!", ephemeral: true });
    }

    else if (commandName === "anuncio") {
      const titulo  = interaction.options.getString("titulo");
      const msg     = interaction.options.getString("mensagem");
      const imagem  = interaction.options.getString("imagem");

      const canalAnuncio = guild.channels.cache.find((c) => c.name === "📢│anúncios");
      if (!canalAnuncio) return interaction.reply({ content: "❌ Canal de anúncios não encontrado.", ephemeral: true });

      const embed = new EmbedBuilder()
        .setTitle(`📢 ${titulo}`)
        .setDescription(msg)
        .setColor(CONFIG.CORES.AVISO)
        .setAuthor({ name: interaction.user.tag, iconURL: interaction.user.displayAvatarURL() })
        .setTimestamp();

      if (imagem) embed.setImage(imagem);

      await canalAnuncio.send({ content: "@everyone", embeds: [embed] });
      await interaction.reply({ content: "✅ Anúncio enviado!", ephemeral: true });
    }

    else if (commandName === "fechar-ticket") {
      await fecharTicket(interaction);
    }

    else if (commandName === "adicionar-cargo") {
      const alvo      = interaction.options.getMember("usuario");
      const nomeCargo = interaction.options.getString("cargo");

      const mapaCargoNome = {
        CLIENTE:   "🛒 Cliente",
        VIP:       "💎 VIP",
        MODERADOR: "⚔️ Moderador",
        SUPORTE:   "🔧 Suporte",
        ADMIN:     "🛡️ Admin",
      };

      const cargo = guild.roles.cache.find((r) => r.name === mapaCargoNome[nomeCargo]);
      if (!cargo) return interaction.reply({ content: "❌ Cargo não encontrado. Execute /setup primeiro.", ephemeral: true });

      await alvo.roles.add(cargo);
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setDescription(`✅ Cargo **${cargo.name}** adicionado a ${alvo}!`)
            .setColor(CONFIG.CORES.SUCESSO),
        ],
        ephemeral: true,
      });
    }

    else if (commandName === "info") {
      const embed = new EmbedBuilder()
        .setTitle("ℹ️ Informações do Bot")
        .setColor(CONFIG.CORES.PRIMARIA)
        .setThumbnail(client.user.displayAvatarURL())
        .addFields(
          { name: "🤖 Bot",           value: client.user.tag,                                     inline: true },
          { name: "🏠 Servidor",       value: guild.name,                                          inline: true },
          { name: "👥 Membros",        value: guild.memberCount.toString(),                        inline: true },
          { name: "🎫 Tickets Abertos",value: ticketsAbertos.size.toString(),                      inline: true },
          { name: "⚙️ Comandos",       value: comandos.length.toString(),                          inline: true },
          { name: "📡 Ping",           value: `${client.ws.ping}ms`,                              inline: true }
        )
        .setFooter({ text: "Bot criado com discord.js v14" })
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
    }
  }

  // ── BOTÕES ────────────────────────────────────────────────
  else if (interaction.isButton()) {
    const { customId } = interaction;

    // Abrir tickets (de qualquer painel)
    if (["ticket_compra", "ticket_suporte", "ticket_duvida", "ticket_problema"].includes(customId)) {
      await criarTicket(interaction, customId);
    }

    else if (customId === "fechar_ticket") {
      await fecharTicket(interaction);
    }

    else if (customId === "assumir_ticket") {
      const embed = new EmbedBuilder()
        .setDescription(`✋ ${interaction.user} assumiu este atendimento!`)
        .setColor(CONFIG.CORES.SUCESSO);
      await interaction.reply({ embeds: [embed] });
    }

    else if (customId === "ver_avaliações") {
      const canal = interaction.guild.channels.cache.find((c) => c.name === "⭐│avaliações");
      await interaction.reply({
        content: canal ? `Veja as avaliações em ${canal}!` : "Canal de avaliações não encontrado.",
        ephemeral: true,
      });
    }

    else if (customId === "confirmar_compra") {
      const dados = comprasPendentes.get(interaction.channel.id);
      if (!dados) return interaction.reply({ content: "❌ Nenhuma compra pendente.", ephemeral: true });

      const produto = CONFIG.PRODUTOS.find((p) => p.id === dados.produtoId);
      const embedConf = new EmbedBuilder()
        .setTitle("🛒 Pedido Confirmado!")
        .setColor(CONFIG.CORES.SUCESSO)
        .setDescription(
          `**Produto:** ${produto?.nome || dados.produtoId}\n` +
          `**Preço:** ${produto?.preco || "A combinar"}\n\n` +
          `Nossa equipe irá entrar em contato com as **instruções de pagamento** em breve!\n\n` +
          `💡 *Aguarde um membro da equipe retornar seu atendimento.*`
        )
        .setTimestamp();

      await interaction.reply({ embeds: [embedConf] });

      // Notificar staff
      const canalStaff = interaction.guild.channels.cache.find((c) => c.name === "📋│painel-staff");
      if (canalStaff) {
        await canalStaff.send({
          embeds: [
            new EmbedBuilder()
              .setTitle("🛒 Nova Compra Pendente!")
              .setColor(CONFIG.CORES.LOJA)
              .addFields(
                { name: "Usuário",  value: `<@${dados.userId}>`,          inline: true },
                { name: "Produto",  value: produto?.nome || dados.produtoId, inline: true },
                { name: "Canal",    value: `${interaction.channel}`,      inline: true }
              )
              .setTimestamp(),
          ],
        });
      }
    }
  }

  // ── SELECT MENUS ──────────────────────────────────────────
  else if (interaction.isStringSelectMenu()) {
    if (interaction.customId === "selecionar_produto") {
      const produtoId = interaction.values[0];
      const produto   = CONFIG.PRODUTOS.find((p) => p.id === produtoId);

      comprasPendentes.set(interaction.channel.id, {
        userId:    interaction.user.id,
        produtoId,
      });

      const dadosTicket = ticketsAbertos.get(interaction.channel.id);
      if (dadosTicket) dadosTicket.produto = produtoId;

      const embed = new EmbedBuilder()
        .setTitle(`${produto?.emoji || "📦"} ${produto?.nome || produtoId}`)
        .setColor(CONFIG.CORES.LOJA)
        .setDescription(
          `**Descrição:** ${produto?.descricao}\n` +
          `**Valor:** ${produto?.preco}\n\n` +
          `Clique em **Confirmar Pedido** para prosseguir com a compra.\n` +
          `Nossa equipe enviará as instruções de pagamento em breve.`
        )
        .setFooter({ text: "Você pode fechar este ticket a qualquer momento." })
        .setTimestamp();

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("confirmar_compra").setLabel("✅ Confirmar Pedido").setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId("fechar_ticket").setLabel("❌ Cancelar").setStyle(ButtonStyle.Danger)
      );

      await interaction.reply({ embeds: [embed], components: [row] });
    }
  }
});

// ============================================================
//  EVENTO: GUILDMEMBERADD (boas-vindas automáticas)
// ============================================================
client.on("guildMemberAdd", async (member) => {
  // Dar cargo de membro automaticamente
  const cargoMembro = member.guild.roles.cache.find((r) => r.name === "👤 Membro");
  if (cargoMembro) await member.roles.add(cargoMembro).catch(() => {});

  // Mensagem de boas-vindas no DM
  await member.send({
    embeds: [
      new EmbedBuilder()
        .setTitle(`👋 Bem-vindo(a) ao ${member.guild.name}!`)
        .setColor(CONFIG.CORES.SUCESSO)
        .setDescription(
          `Olá, ${member.user.username}! Seja muito bem-vindo(a)!\n\n` +
          `📋 Leia as **regras** do servidor.\n` +
          `🛒 Visite nossa **loja** para conhecer os serviços.\n` +
          `🎫 Abra um **ticket** se precisar de ajuda.\n\n` +
          `Esperamos que aproveite sua estadia! 🎉`
        )
        .setThumbnail(member.guild.iconURL())
        .setTimestamp(),
    ],
  }).catch(() => {}); // Ignorar se DMs estiverem fechados
});

// ============================================================
//  INICIAR BOT
// ============================================================
client.login(CONFIG.TOKEN);
