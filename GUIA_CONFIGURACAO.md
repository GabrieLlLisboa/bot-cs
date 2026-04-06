# 🤖 Guia Completo de Configuração — Discord Bot

## 📋 O que este bot faz

| Funcionalidade | Descrição |
|---|---|
| 🏗️ Setup do servidor | Cria todas as categorias, canais e cargos automaticamente |
| 🎫 Sistema de tickets | 4 tipos: Compra, Suporte Técnico, Dúvida Geral, Reportar Problema |
| 🛒 Loja integrada | Painel com produtos, seleção e confirmação de pedido |
| 📢 Anúncios | Comando para fazer anúncios com @everyone e imagem |
| 🎭 Gestão de cargos | Adicione cargos a membros via comando |
| 👋 Boas-vindas | DM automático + cargo de Membro ao entrar |
| 📊 Info do servidor | Estatísticas em tempo real |

---

## 🚀 Passo a Passo — Configuração

### 1. Criar o Bot no Discord Developer Portal

1. Acesse [discord.com/developers/applications](https://discord.com/developers/applications)
2. Clique em **"New Application"** → dê um nome ao bot
3. Vá em **"Bot"** no menu lateral
4. Clique em **"Reset Token"** → copie o token gerado
5. Em **"Privileged Gateway Intents"**, ative:
   - ✅ `Server Members Intent`
   - ✅ `Message Content Intent`
6. Vá em **"OAuth2" → "General"** e copie o **Application ID (Client ID)**

---

### 2. Convidar o Bot para seu Servidor

1. Ainda no Developer Portal, vá em **"OAuth2" → "URL Generator"**
2. Marque os escopos:
   - ✅ `bot`
   - ✅ `applications.commands`
3. Em **"Bot Permissions"**, marque:
   - ✅ Administrator (mais simples para teste)
   - *Ou permissões específicas: Manage Channels, Manage Roles, Send Messages, Read Messages, Embed Links, Mention Everyone*
4. Copie a URL gerada e abra no navegador para convidar

---

### 3. Configurar os Arquivos

```bash
# 1. Entrar na pasta
cd discord-bot

# 2. Instalar dependências
npm install

# 3. Copiar o arquivo de configuração
cp .env.example .env
```

4. Abra o arquivo `.env` e preencha:

```env
DISCORD_TOKEN=cole_o_token_do_bot_aqui
CLIENT_ID=cole_o_id_do_bot_aqui
GUILD_ID=cole_o_id_do_servidor_aqui
```

> **Como pegar o ID do servidor:** Ative o Modo Desenvolvedor no Discord (Configurações → Avançado → Modo Desenvolvedor), clique com botão direito no nome do servidor → "Copiar ID"

---

### 4. Iniciar o Bot

```bash
npm start
```

Você verá no console:
```
✅ Bot online como: NomeDoBot#1234
📡 Conectado a 1 servidor(es)
✅ Slash commands registrados com sucesso!
```

---

### 5. Setup do Servidor

No Discord, em qualquer canal onde o bot tenha acesso, execute:

```
/setup
```

O bot irá criar automaticamente:

#### 📁 Categorias e Canais:
```
📋 INFORMAÇÕES
  ├── 📌│regras          (somente leitura)
  ├── 📢│anúncios        (somente leitura)
  ├── 👋│boas-vindas     (somente leitura)
  └── 📊│status-bot      (somente leitura)

💬 COMUNIDADE
  ├── 💬│geral
  ├── 🎮│off-topic
  ├── 🖼️│mídia
  └── 🔊│voz-geral

🛒 LOJA & SERVIÇOS
  ├── 🛍️│loja            (somente leitura)
  ├── 📦│meus-pedidos    (somente leitura)
  └── ⭐│avaliações

🎫 SUPORTE & TICKETS
  ├── 🎫│abrir-ticket    (somente leitura)
  └── 📋│tickets-log     (apenas staff)

💎 ÁREA VIP
  ├── 💎│vip-geral       (apenas VIPs)
  └── 🔊│voz-vip         (apenas VIPs)

🔧 STAFF
  ├── 📋│painel-staff    (apenas staff)
  ├── 💬│chat-staff      (apenas staff)
  ├── 📝│logs-admin      (apenas staff)
  └── 🔊│reunião-staff   (apenas staff)
```

#### 🎭 Cargos criados:
| Cargo | Cor | Função |
|---|---|---|
| 👑 Dono | Dourado | Proprietário do servidor |
| 🛡️ Admin | Vermelho | Administradores |
| 🔧 Suporte | Azul | Atendimento ao cliente |
| ⚔️ Moderador | Verde | Moderação do servidor |
| 💎 VIP | Dourado | Clientes especiais |
| 🛒 Cliente | Rosa | Clientes comuns |
| 👤 Membro | Cinza | Membros padrão (atribuído automaticamente) |

---

### 6. Ativar os Painéis

Após o /setup, ative os sistemas:

```bash
# No canal #loja, execute:
/loja

# No canal #abrir-ticket, execute:
/painel-tickets
```

---

## 📖 Todos os Comandos

| Comando | Permissão | Descrição |
|---|---|---|
| `/setup` | Admin | Cria toda a estrutura do servidor |
| `/painel-tickets` | Admin | Envia o painel de tickets no canal atual |
| `/loja` | Admin | Envia o painel da loja no canal atual |
| `/anuncio` | Admin | Faz um anúncio no canal de anúncios |
| `/fechar-ticket` | Staff | Fecha o ticket do canal atual |
| `/adicionar-cargo` | Staff | Adiciona um cargo a um membro |
| `/info` | Todos | Exibe informações do bot e servidor |

---

## 🛒 Personalizar os Produtos da Loja

Edite a seção `PRODUTOS` no arquivo `bot.js`:

```javascript
PRODUTOS: [
  {
    id: "prod_001",        // ID único (não repita)
    nome: "🥉 Plano Básico",
    descricao: "Acesso básico com suporte por e-mail.",
    preco: "R$ 19,90/mês",
    emoji: "🥉",
  },
  // Adicione quantos produtos quiser...
],
```

---

## ☁️ Hospedar em Produção (Recomendado)

Para o bot ficar online 24/7:

### Opção 1 — Railway (gratuito para começar)
1. Acesse [railway.app](https://railway.app)
2. Conecte seu GitHub e faça upload do projeto
3. Adicione as variáveis de ambiente (.env) no painel
4. Deploy automático!

### Opção 2 — VPS (Hostinger, DigitalOcean, etc.)
```bash
# Instalar PM2 para manter o bot rodando
npm install -g pm2

# Iniciar com PM2
pm2 start bot.js --name discord-bot

# Iniciar automaticamente ao reiniciar o servidor
pm2 startup
pm2 save
```

### Opção 3 — Heroku
```bash
# Criar Procfile
echo "worker: node bot.js" > Procfile

# Deploy via Git ou GitHub Actions
```

---

## 🔧 Solução de Problemas

**❌ "Missing Permissions"** → Verifique se o bot tem permissão de Administrador ou as permissões específicas listadas acima.

**❌ "Unknown Interaction"** → Os slash commands levam alguns minutos para aparecer após o registro. Aguarde ou recarregue o Discord.

**❌ Bot não cria os canais** → Certifique-se de que o cargo do bot está acima dos cargos que ele está tentando criar na hierarquia.

**❌ Ticket não fecha** → Verifique se o bot tem permissão `Manage Channels` no servidor.

---

## 📞 Próximos Passos Sugeridos

- [ ] Integrar um banco de dados (MongoDB/SQLite) para persistência dos tickets
- [ ] Adicionar sistema de avaliação pós-atendimento
- [ ] Implementar integração com gateway de pagamento (Mercado Pago, Stripe)
- [ ] Criar sistema de pontos/fidelidade para clientes
- [ ] Adicionar transcripts de tickets salvos automaticamente
