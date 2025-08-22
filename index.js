const { 
  Client, GatewayIntentBits, 
  EmbedBuilder, ButtonBuilder, 
  ButtonStyle, ActionRowBuilder, 
  ModalBuilder, TextInputBuilder, 
  TextInputStyle 
} = require("discord.js");

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });

// 🌟 المتغيرات
let ticketCount = {
  "الإدارة": 0,
  "العامة": 0,
  "الديسكورد": 0,
  "السيرفر": 0,
  "السيارات": 0
};

let openTickets = new Map(); // لمعرفة التذاكر المفتوحة لكل عضو
let closedTicketsCount = new Map(); // لتتبع التذاكر المغلقة لكل عضو

// 🛡️ الآيدي الرولات
const managerRoleId = "ايدي_رول_Manager"; // الإدارة
const teamRoleId = "ايدي_رول_TicketTeam"; // Ticket Team
const blacklistRoleId = "ايدي_رول_Blacklist"; // ممنوع فتح تذاكر

client.once("ready", () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

// 🟣 أمر إرسال الإمبيد الرئيسي (بس للإدارة)
client.on("messageCreate", async (message) => {
  if (message.content === "!Ticket") {
    if (!message.member.roles.cache.has(managerRoleId)) return;

    const embed = new EmbedBuilder()
      .setTitle("🎟️ نظام التذاكر")
      .setDescription("اختر نوع الشكوى من الأزرار بالأسفل:")
      .setColor(0x800080) // بنفسجي
      .setFooter({ text: "Ticket System V3.0 - جميع الحقوق محفوظة" })
      .setImage("https://cdn.discordapp.com/attachments/1407427459837722665/1408113949957689478/logo.png")
      .setThumbnail("https://cdn.discordapp.com/attachments/1407427459837722665/1408113949957689478/logo.png");

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("الإدارة").setLabel("شكاوي الإدارة").setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId("العامة").setLabel("شكاوي عامة").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId("الديسكورد").setLabel("شكاوي الديسكورد").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId("السيرفر").setLabel("شكاوي السيرفر").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("السيارات").setLabel("شكاوي السيارات").setStyle(ButtonStyle.Secondary)
    );

    message.channel.send({ embeds: [embed], components: [row] });
  }

  // 🟣 Ticket log
  if (message.content === "!Ticket log") {
    if (!message.member.roles.cache.has(managerRoleId)) return;
    const totalOpen = Array.from(openTickets.values()).flat().length;
    const totalClosed = Array.from(closedTicketsCount.values()).reduce((a,b)=>a+b,0);

    const logEmbed = new EmbedBuilder()
      .setTitle("📊 إحصائيات التذاكر")
      .addFields(
        { name: "التذاكر المفتوحة", value: `${totalOpen}`, inline: true },
        { name: "التذاكر المغلقة", value: `${totalClosed}`, inline: true }
      )
      .setColor(0x800080)
      .setFooter({ text: "Ticket System V3.0" })
      .setTimestamp();

    message.channel.send({ embeds: [logEmbed] });
  }

  // 🟣 أمر تكتات Ticket Team
  if (message.content.startsWith("!تكتات")) {
    if (!message.member.roles.cache.has(teamRoleId)) return;
    const member = message.mentions.members.first();
    if (!member) return message.reply("❌ الرجاء منشن العضو.");

    const count = closedTicketsCount.get(member.id) || 0;
    message.channel.send(`📊 عدد التذاكر التي أغلقها ${member.user.tag}: **${count}**`);
  }
});

// 🟣 عند ضغط الزر لفتح الاستمارة
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isButton()) return;

  if (interaction.member.roles.cache.has(blacklistRoleId)) {
    return interaction.reply({ content: "🚫 أنت ممنوع من فتح التذاكر.", ephemeral: true });
  }

  // فتح تذكرة واحدة فقط بنفس الوقت
  const userId = interaction.user.id;
  if ((openTickets.get(userId) || []).length > 0) {
    return interaction.reply({ content: "🚫 يجب إغلاق التذكرة الحالية قبل فتح جديدة.", ephemeral: true });
  }

  // إنشاء المودال
  const modal = new ModalBuilder()
    .setCustomId(`modal_${interaction.customId}`)
    .setTitle(`📝 استمارة ${interaction.customId}`);

  // 7 أسئلة مختلفة لكل نوع
  const questions = [
    new TextInputBuilder().setCustomId("q1").setLabel("ما سبب الشكوى؟").setStyle(TextInputStyle.Paragraph).setRequired(true),
    new TextInputBuilder().setCustomId("q2").setLabel("ضد من؟").setStyle(TextInputStyle.Short).setRequired(true),
    new TextInputBuilder().setCustomId("q3").setLabel("متى حدثت؟").setStyle(TextInputStyle.Short).setRequired(true),
    new TextInputBuilder().setCustomId("q4").setLabel("أين؟").setStyle(TextInputStyle.Short).setRequired(false),
    new TextInputBuilder().setCustomId("q5").setLabel("تفاصيل إضافية").setStyle(TextInputStyle.Paragraph).setRequired(false),
    new TextInputBuilder().setCustomId("q6").setLabel("هل لديك دليل؟").setStyle(TextInputStyle.Short).setRequired(false),
    new TextInputBuilder().setCustomId("q7").setLabel("ملاحظات أخرى").setStyle(TextInputStyle.Paragraph).setRequired(false)
  ];

  modal.addComponents(
    ...questions.map(q => new ActionRowBuilder().addComponents(q))
  );

  await interaction.showModal(modal);
});

// 🟣 استلام بيانات المودال وإنشاء روم التذكرة
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isModalSubmit()) return;

  const type = interaction.customId.replace("modal_","");

  ticketCount[type]++;
  const ticketName = `شكوى-${type}-${ticketCount[type]}`;

  const channel = await interaction.guild.channels.create({
    name: ticketName,
    type: 0,
    permissionOverwrites: [
      { id: interaction.guild.id, deny: ["ViewChannel"] },
      { id: interaction.user.id, allow: ["ViewChannel","SendMessages","AttachFiles"] },
      { id: managerRoleId, allow: ["ViewChannel","SendMessages","ManageChannels"] },
      { id: teamRoleId, allow: ["ViewChannel","SendMessages","ManageChannels"] }
    ]
  });

  // تحديث الخرائط
  openTickets.set(interaction.user.id, [...(openTickets.get(interaction.user.id)||[]), channel.id]);

  await interaction.reply({ content: `✅ تم إنشاء تذكرتك: ${channel}`, ephemeral: true });

  const embed = new EmbedBuilder()
    .setTitle(`📋 شكوى: ${type}`)
    .setColor(0xff00ff)
    .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
    .setImage("https://cdn.discordapp.com/attachments/1407427459837722665/1408113949957689478/logo.png")
    .addFields(
      { name: "1️⃣", value: interaction.fields.getTextInputValue("q1") },
      { name: "2️⃣", value: interaction.fields.getTextInputValue("q2") },
      { name: "3️⃣", value: interaction.fields.getTextInputValue("q3") },
      { name: "4️⃣", value: interaction.fields.getTextInputValue("q4") || "لا يوجد" },
      { name: "5️⃣", value: interaction.fields.getTextInputValue("q5") || "لا يوجد" },
      { name: "6️⃣", value: interaction.fields.getTextInputValue("q6") || "لا يوجد" },
      { name: "7️⃣", value: interaction.fields.getTextInputValue("q7") || "لا يوجد" }
    )
    .setFooter({ text: `Ticket System V3.0 - ${interaction.user.tag}` })
    .setTimestamp();

  const closeRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("close_ticket").setLabel("🔒 إغلاق التذكرة").setStyle(ButtonStyle.Danger)
  );

  await channel.send({ content: `<@${interaction.user.id}>`, embeds: [embed], components: [closeRow] });
});

// 🟣 إغلاق التذكرة
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isButton()) return;

  if (interaction.customId === "close_ticket") {
    if (!interaction.member.roles
