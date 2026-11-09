const { Client, GatewayIntentBits, Partials, EmbedBuilder, AuditLogEvent } = require('discord.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildModeration
    ],
    partials: [Partials.Message, Partials.Channel, Partials.GuildMember]
});

// ===================== الإعدادات والـ IDs =====================
const TOKEN = 'حط_توكن_البوت_هنا';
const HONEY_POT_CHANNEL_ID = 'حط_ايدي_قناة_الهاني_هوب_هنا';

const MEMBER_LOG_CHANNEL_ID = 'حط_ايدي_قناة_لوجز_الأعضاء_هنا';   // (بان، كيك، تايم أوت، والهاني هوب)
const SERVER_LOG_CHANNEL_ID = 'حط_ايدي_قناة_لوجز_السيرفر_هنا'; // (قنوات ورولات)
// =============================================================

client.once('ready', async () => {
    console.log(`تم تسجيل الدخول بنجاح باسم: ${client.user.tag}`);

    // إرسال رسالة تحذيرية تثبيتية في قناة الهاني هوب تلقائياً للتنبيه
    try {
        const honeyChannel = client.channels.cache.get(HONEY_POT_CHANNEL_ID);
        if (honeyChannel) {
            // نتحقق لو القناة فاضية عشان ما نكررش الرسالة كل ما البوت يعمل ريستارت
            const messages = await honeyChannel.messages.fetch({ limit: 5 });
            if (messages.size === 0) {
                const embed = new EmbedBuilder()
                    .setTitle('⚠️ تنبيه هام جداً!')
                    .setDescription('ممنوع الكتابة أو إرسال أي رسائل في هذه القناة نهائياً!\n\n**أي رسالة سيتم إرسالها هنا ستؤدي إلى حظر (Ban) صاحبها فوراً بشكل تلقائي.** هذه القناة مخصصة للأمان فقط.')
                    .setColor('#ffcc00')
                    .setTimestamp();
                
                const sentMsg = await honeyChannel.send({ embeds: [embed] });
                // تثبيت الرسالة عشان تظل ظاهرة للجميع فوق
                await sentMsg.pin().catch(() => {});
            }
        }
    } catch (error) {
        console.error('خطأ أثناء إرسال رسالة التحذير في الهاني هوب:', error);
    }
});

// 1. نظام الهاني هوب (Honey Pot) لصيد البوتات أو الأعضاء المخالفين
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    if (message.channel.id === HONEY_POT_CHANNEL_ID) {
        try {
            await message.delete();
            
            if (message.member && message.member.bannable) {
                await message.guild.members.ban(message.author.id, { 
                    reason: 'محاولة الكتابة في قناة الهاني هوب الممنوعة (اشتباه بوت / سبام)' 
                });

                const logChannel = message.guild.channels.cache.get(MEMBER_LOG_CHANNEL_ID);
                if (logChannel) {
                    const embed = new EmbedBuilder()
                        .setTitle('🚨 تم اصطياد مخالف / بوت (هاني هوب)!')
                        .setColor('#ff0000')
                        .addFields(
                            { name: 'المستخدم', value: `${message.author.tag} (<@${message.author.id}>)`, inline: true },
                            { name: 'الإجراء', value: 'تم حظره تلقائياً من قناة الهاني هوب', inline: false }
                        )
                        .setTimestamp();
                    logChannel.send({ embeds: [embed] });
                }
            }
        } catch (error) {
            console.error('خطأ أثناء التعامل مع رسالة الهاني هوب:', error);
        }
    }
});

// 2. لوجز السيرفر (قنوات ورولات) -> تروح على SERVER_LOG_CHANNEL_ID

client.on('channelDelete', (channel) => {
    sendServerLog(channel.guild, '🗑️ حذف قناة', `تم حذف القناة: **${channel.name}**`, '#ff9900');
});

client.on('channelUpdate', (oldChannel, newChannel) => {
    if (oldChannel.name !== newChannel.name) {
        sendServerLog(newChannel.guild, '✏️ تعديل اسم قناة', `تم تغيير اسم القناة من **${oldChannel.name}** إلى **${newChannel.name}**`, '#3498db');
    }
});

client.on('roleUpdate', (oldRole, newRole) => {
    if (oldRole.name !== newRole.name) {
        sendServerLog(newRole.guild, '🛡️ تعديل رتبة', `تم تغيير اسم الرتبة من **${oldRole.name}** إلى **${newRole.name}**`, '#f1c40f');
    }
});

client.on('roleDelete', (role) => {
    sendServerLog(role.guild, '❌ حذف رتبة', `تم حذف الرتبة: **${role.name}**`, '#e74c3c');
});


// 3. لوجز الأعضاء وعقوباتهم (بان، كيك، تايم أوت) -> تروح على MEMBER_LOG_CHANNEL_ID

// مراقبة حظر الأعضاء (Ban)
client.on('guildBanAdd', async (ban) => {
    try {
        const fetchedLogs = await ban.guild.fetchAuditLogs({
            limit: 1,
            type: AuditLogEvent.MemberBanAdd,
        });
        const banLog = fetchedLogs.entries.first();
        const executor = banLog ? banLog.executor : 'غير معروف';
        const reason = banLog?.reason || 'بدون سبب أُذكر';

        const embed = new EmbedBuilder()
            .setTitle('🔨 حظر عضو (Ban)')
            .setColor('#990000')
            .addFields(
                { name: 'العضو المحظور', value: `${ban.user.tag} (<@${ban.user.id}>)`, inline: true },
                { name: 'بواسطة المشرف', value: `${executor.tag || executor}`, inline: true },
                { name: 'السبب', value: reason, inline: false }
            )
            .setTimestamp();

        const logChannel = ban.guild.channels.cache.get(MEMBER_LOG_CHANNEL_ID);
        if (logChannel) logChannel.send({ embeds: [embed] });
    } catch (error) {
        console.error('خطأ في جلب لوج الحظر:', error);
    }
});

// مراقبة التايم أوت (Timeout)
client.on('guildMemberUpdate', async (oldMember, newMember) => {
    try {
        const fetchedLogs = await newMember.guild.fetchAuditLogs({
            limit: 1,
            type: AuditLogEvent.MemberUpdate,
        });
        const updateLog = fetchedLogs.entries.first();

        if (oldMember.communicationDisabledUntilTimestamp !== newMember.communicationDisabledUntilTimestamp) {
            const executor = updateLog ? updateLog.executor : 'غير معروف';
            const isTimedOut = newMember.isCommunicationDisabled();
            
            const title = isTimedOut ? '⏳ إعطاء تايم أوت لعضو (Timeout)' : '🔓 إزالة التايم أوت عن العضو';
            const color = isTimedOut ? '#e67e22' : '#2ecc71';
            
            const embed = new EmbedBuilder()
                .setTitle(title)
                .setColor(color)
                .addFields(
                    { name: 'العضو', value: `${newMember.user.tag} (<@${newMember.id}>)`, inline: true },
                    { name: 'بواسطة المشرف', value: `${executor.tag || executor}`, inline: true }
                )
                .setTimestamp();

            const logChannel = newMember.guild.channels.cache.get(MEMBER_LOG_CHANNEL_ID);
            if (logChannel) logChannel.send({ embeds: [embed] });
        }
    } catch (error) {
        console.error('خطأ في جلب لوج تحديث العضو:', error);
    }
});

// مراقبة طرد الأعضاء (Kick)
client.on('guildMemberRemove', async (member) => {
    try {
        const fetchedLogs = await member.guild.fetchAuditLogs({
            limit: 1,
            type: AuditLogEvent.MemberKick,
        });
        const kickLog = fetchedLogs.entries.first();

        if (kickLog && kickLog.target.id === member.id && (Date.now() - kickLog.createdTimestamp < 5000)) {
            const { executor, reason } = kickLog;

            const embed = new EmbedBuilder()
                .setTitle('👢 طرد عضو (Kick)')
                .setColor('#d35400')
                .addFields(
                    { name: 'العضو المطرود', value: `${member.user.tag} (<@${member.id}>)`, inline: true },
                    { name: 'بواسطة المشرف', value: `${executor.tag}`, inline: true },
                    { name: 'السبب', value: reason || 'بدون سبب أُذكر', inline: false }
                )
                .setTimestamp();

            const logChannel = member.guild.channels.cache.get(MEMBER_LOG_CHANNEL_ID);
            if (logChannel) logChannel.send({ embeds: [embed] });
        }
    } catch (error) {
        console.error('خطأ في جلب لوج الطرد:', error);
    }
});

// دوال مساعدة لإرسال اللوجز لكل قناة على حدة
function sendServerLog(guild, title, description, color) {
    const logChannel = guild.channels.cache.get(SERVER_LOG_CHANNEL_ID);
    if (!logChannel) return;

    const embed = new EmbedBuilder()
        .setTitle(title)
        .setDescription(description)
        .setColor(color)
        .setTimestamp();

    logChannel.send({ embeds: [embed] }).catch(console.error);
}

// تشغيل البوت
client.login(TOKEN);
