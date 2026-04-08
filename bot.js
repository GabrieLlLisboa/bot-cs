require('dotenv').config();

const {
  Client, GatewayIntentBits, SlashCommandBuilder,
  EmbedBuilder, ActionRowBuilder,
  ButtonBuilder, ButtonStyle,
} = require('discord.js');
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v10');

const TOKEN          = process.env.TOKEN;
const CLIENT_ID      = process.env.CLIENT_ID;
const GUILD_ID       = process.env.GUILD_ID || '';
const CANAL_PRESENCA = process.env.CANAL_PRESENCA;

// Ranks Rocket League
const RANKS = [
  { name: '🥉 Bronze',          value: 'Bronze' },
  { name: '🥈 Prata',           value: 'Prata' },
  { name: '🥇 Ouro',            value: 'Ouro' },
  { name: '💎 Platina',         value: 'Platina' },
  { name: '💠 Diamante',        value: 'Diamante' },
  { name: '👑 Champion',        value: 'Champion' },
  { name: '🏆 Grande Champion', value: 'Grande Champion' },
  { name: '🌟 SSL',             value: 'SSL' },
];

const RANKS_TREINO = [
  ...RANKS,
  { name: '🎮 Todos os ranks', value: 'Todos' },
];

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] });

// amistosos em memória: Map<numero, { time, horario, rank, data, messageId, channelId, confirmados[] }>
const amistosos = new Map();
let contadorAmistoso = 1;

// ============ DEFINIÇÃO DOS COMANDOS ============
const commands = [
  new SlashCommandBuilder()
    .setName('anunciar')
    .setDescription('📢 Faz um embed bonito com a sua mensagem')
    .addStringOption(o => o.setName('titulo').setDescription('Título do anúncio').setRequired(true))
    .addStringOption(o => o.setName('mensagem').setDescription('Conteúdo do anúncio').setRequired(true))
    .addStringOption(o => o.setName('cor').setDescription('Cor hex do embed (ex: #ff0000)').setRequired(false)),

  new SlashCommandBuilder()
    .setName('anunciar-amistoso')
    .setDescription('⚽ Anuncia um amistoso com todas as informações')
    .addStringOption(o => o.setName('time').setDescription('Nome do time adversário').setRequired(true))
    .addStringOption(o => o.setName('horario').setDescription('Horário (ex: 20:00)').setRequired(true))
    .addStringOption(o =>
      o.setName('rank').setDescription('Rank dos jogadores').setRequired(true).addChoices(...RANKS)
    )
    .addStringOption(o => o.setName('data').setDescription('Data (ex: 07/04)').setRequired(false)),

  new SlashCommandBuilder()
    .setName('novo-jogador')
    .setDescription('🎮 Anuncia a entrada de um novo jogador no time')
    .addStringOption(o => o.setName('nome').setDescription('Nome do jogador').setRequired(true))
    .addStringOption(o =>
      o.setName('rank').setDescription('Rank do jogador').setRequired(true).addChoices(...RANKS)
    )
    .addStringOption(o => o.setName('funcao').setDescription('Função (ex: Striker, Goalkeeper...)').setRequired(false)),

  new SlashCommandBuilder()
    .setName('anunciar-treino')
    .setDescription('🏋️ Anuncia um treino para o time')
    .addStringOption(o => o.setName('horario').setDescription('Horário (ex: 21:00)').setRequired(true))
    .addStringOption(o =>
      o.setName('rank').setDescription('Rank convocado').setRequired(true).addChoices(...RANKS_TREINO)
    )
    .addStringOption(o => o.setName('objetivo').setDescription('Para que é o treino').setRequired(true))
    .addStringOption(o => o.setName('data').setDescription('Data (ex: 08/04)').setRequired(false)),
];

// ============ REGISTRO DOS COMANDOS ============
const rest = new REST({ version: '10' }).setToken(TOKEN);

async function registrarComandos() {
  const rota = GUILD_ID
    ? Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID)
    : Routes.applicationCommands(CLIENT_ID);
  await rest.put(rota, { body: commands.map(c => c.toJSON()) });
  console.log('✅ Comandos registrados!');
}

// ============ BOT PRONTO ============
client.once('ready', async () => {
  console.log(`✅ Bot online como ${client.user.tag}`);
  client.user.setActivity('🚀 Gerenciando o time', { type: 3 });
  await registrarComandos();
});

// ============ INTERAÇÕES ============
client.on('interactionCreate', async interaction => {

  // ─── SLASH COMMANDS ───────────────────────────────────────────────────────
  if (interaction.isChatInputCommand()) {

    // /anunciar
    if (interaction.commandName === 'anunciar') {
      await interaction.deferReply({ ephemeral: true }); // ack invisível pro chat

      const titulo   = interaction.options.getString('titulo');
      const mensagem = interaction.options.getString('mensagem');
      const corHex   = interaction.options.getString('cor') || '#5865F2';
      const cor      = parseInt(corHex.replace('#', ''), 16) || 0x5865F2;

      const embed = new EmbedBuilder()
        .setTitle(`📢  ${titulo}`)
        .setDescription(mensagem)
        .setColor(cor)
        .setFooter({
          text: `Anunciado por ${interaction.user.username}`,
          iconURL: interaction.user.displayAvatarURL(),
        })
        .setTimestamp();

      // Manda no canal, não como reply
      await interaction.channel.send({ embeds: [embed] });
      await interaction.editReply({ content: '✅ Anúncio enviado!' });
    }

    // /anunciar-amistoso
    else if (interaction.commandName === 'anunciar-amistoso') {
      await interaction.deferReply({ ephemeral: true });

      const time    = interaction.options.getString('time');
      const horario = interaction.options.getString('horario');
      const rank    = interaction.options.getString('rank');
      const data    = interaction.options.getString('data') || obterDataHoje();
      const numero  = contadorAmistoso++;

      const embed = new EmbedBuilder()
        .setTitle(`⚽  Amistoso Marcado — #${numero}`)
        .setColor(0x57F287)
        .addFields(
          { name: '🆚  Adversário', value: `**${time}**`,    inline: true },
          { name: '📅  Data',       value: `**${data}**`,    inline: true },
          { name: '🕐  Horário',    value: `**${horario}**`, inline: true },
          { name: '🏅  Rank',       value: `**${rank}**`,    inline: true },
          { name: '✅  Confirmados (0)', value: '*Nenhum ainda*', inline: false },
          { name: '\u200B', value: `📌 Clique no botão abaixo para confirmar sua presença!` },
        )
        .setFooter({
          text: `Anunciado por ${interaction.user.username}`,
          iconURL: interaction.user.displayAvatarURL(),
        })
        .setTimestamp();

      const btnConfirmar = new ButtonBuilder()
        .setCustomId(`confirmar_${numero}`)
        .setLabel('✅ Confirmar Presença')
        .setStyle(ButtonStyle.Success);

      const row = new ActionRowBuilder().addComponents(btnConfirmar);

      const msg = await interaction.channel.send({ embeds: [embed], components: [row] });

      amistosos.set(numero, {
        time, horario, rank, data,
        messageId: msg.id,
        channelId: msg.channelId,
        confirmados: [],
      });

      await interaction.editReply({ content: `✅ Amistoso #${numero} anunciado!` });
    }

    // /novo-jogador
    else if (interaction.commandName === 'novo-jogador') {
      await interaction.deferReply({ ephemeral: true });

      const nome   = interaction.options.getString('nome');
      const rank   = interaction.options.getString('rank');
      const funcao = interaction.options.getString('funcao') || 'Não especificada';

      const embed = new EmbedBuilder()
        .setTitle('🎮  Novo Jogador no Time!')
        .setColor(0xEB459E)
        .setDescription('Sejam bem-vindos ao mais novo integrante da nossa equipe! 🎉')
        .addFields(
          { name: '👤  Nome',   value: `**${nome}**`,   inline: true },
          { name: '🏅  Rank',   value: `**${rank}**`,   inline: true },
          { name: '🎯  Função', value: `**${funcao}**`, inline: true },
        )
        .setFooter({ text: 'Bem-vindo ao time! 💪' })
        .setTimestamp();

      await interaction.channel.send({ embeds: [embed] });
      await interaction.editReply({ content: '✅ Novo jogador anunciado!' });
    }

    // /anunciar-treino
    else if (interaction.commandName === 'anunciar-treino') {
      await interaction.deferReply({ ephemeral: true });

      const horario  = interaction.options.getString('horario');
      const rank     = interaction.options.getString('rank');
      const objetivo = interaction.options.getString('objetivo');
      const data     = interaction.options.getString('data') || obterDataHoje();

      const embed = new EmbedBuilder()
        .setTitle('🏋️  Convocação de Treino')
        .setColor(0xFEE75C)
        .setDescription('Atenção jogadores! Treino confirmado. Preparem-se! 💪')
        .addFields(
          { name: '📅  Data',           value: `**${data}**`,     inline: true },
          { name: '🕐  Horário',        value: `**${horario}**`,  inline: true },
          { name: '🏅  Rank Convocado', value: `**${rank}**`,     inline: true },
          { name: '🎯  Objetivo',       value: `**${objetivo}**`, inline: false },
        )
        .setFooter({
          text: `Convocado por ${interaction.user.username}`,
          iconURL: interaction.user.displayAvatarURL(),
        })
        .setTimestamp();

      await interaction.channel.send({ embeds: [embed] });
      await interaction.editReply({ content: '✅ Treino anunciado!' });
    }
  }

  // ─── BOTÃO CONFIRMAR ──────────────────────────────────────────────────────
  if (interaction.isButton() && interaction.customId.startsWith('confirmar_')) {
    const numero = parseInt(interaction.customId.split('_')[1]);
    await processarConfirmacao(interaction, numero);
  }
});

// ============ LÓGICA DE CONFIRMAÇÃO ============
async function processarConfirmacao(interaction, numero) {
  const amistoso = amistosos.get(numero);
  if (!amistoso) {
    return interaction.reply({ content: '❌ Amistoso não encontrado.', ephemeral: true });
  }

  const userId = interaction.user.id;

  if (amistoso.confirmados.includes(userId)) {
    return interaction.reply({
      content: `⚠️ Você já confirmou presença no **Amistoso #${numero}**!`,
      ephemeral: true,
    });
  }

  await interaction.deferReply({ ephemeral: true });
  amistoso.confirmados.push(userId);

  // 1) Atualiza lista de confirmados no embed do amistoso
  try {
    const canal = await interaction.client.channels.fetch(amistoso.channelId);
    const msg   = await canal.messages.fetch(amistoso.messageId);

    const lista = amistoso.confirmados.map((id, i) => `${i + 1}. <@${id}>`).join('\n');

    const embedAtualizado = EmbedBuilder.from(msg.embeds[0])
      .spliceFields(4, 1, {
        name: `✅  Confirmados (${amistoso.confirmados.length})`,
        value: lista,
        inline: false,
      });

    await msg.edit({ embeds: [embedAtualizado] });
  } catch (e) {
    console.error('Erro ao atualizar embed do amistoso:', e);
  }

  // 2) Posta notificação no canal de presença configurado no .env
  try {
    const canalPresenca = await interaction.client.channels.fetch(CANAL_PRESENCA);

    const embedNotif = new EmbedBuilder()
      .setColor(0x57F287)
      .setDescription(
        `✅ <@${userId}> confirmou presença no **Amistoso #${numero}**\n` +
        `🆚 **${amistoso.time}** — 📅 ${amistoso.data} às 🕐 ${amistoso.horario} | 🏅 ${amistoso.rank}`
      )
      .setTimestamp();

    await canalPresenca.send({ embeds: [embedNotif] });
  } catch (e) {
    console.error('Erro ao postar no canal de presença:', e);
  }

  await interaction.editReply({ content: `✅ Presença confirmada no **Amistoso #${numero}**! ⚽` });
}

// ============ UTIL ============
function obterDataHoje() {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}

client.login(TOKEN);