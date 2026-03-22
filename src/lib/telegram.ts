import TelegramBot from 'node-telegram-bot-api';

const token = process.env.TELEGRAM_BOT_TOKEN || '';
const chatIds = (process.env.TELEGRAM_CHAT_IDS || process.env.TELEGRAM_CHAT_ID || '')
  .split(',')
  .map(id => id.trim())
  .filter(Boolean);

let bot: TelegramBot | null = null;

/**
 * Initialiser le bot Telegram
 */
export function initTelegramBot() {
  if (!token || chatIds.length === 0) {
    console.warn('⚠️  Telegram non configuré (token ou chat_ids manquant)');
    return null;
  }

  if (!bot) {
    bot = new TelegramBot(token, { polling: false });
    console.log('✅ Bot Telegram initialisé pour', chatIds.length, 'destinataires');
  }

  return bot;
}

/**
 * Envoyer un message Telegram a tous les destinataires
 */
export async function sendTelegramMessage(
  message: string,
  options?: {
    parse_mode?: 'Markdown' | 'HTML';
    disable_web_page_preview?: boolean;
    reply_markup?: any;
  }
): Promise<boolean> {
  try {
    if (!bot) {
      bot = initTelegramBot();
      if (!bot) return false;
    }

    const results = await Promise.allSettled(
      chatIds.map(chatId =>
        bot!.sendMessage(chatId, message, {
          parse_mode: options?.parse_mode || 'HTML',
          disable_web_page_preview: options?.disable_web_page_preview ?? true,
          reply_markup: options?.reply_markup
        })
      )
    );

    const failures = results.filter(r => r.status === 'rejected');
    if (failures.length > 0) {
      console.error('❌ Telegram: ' + failures.length + ' envois échoués sur ' + chatIds.length);
    }

    return failures.length < chatIds.length;
  } catch (error) {
    console.error('❌ Erreur envoi Telegram:', error);
    return false;
  }
}

/**
 * Envoyer une photo avec caption a tous les destinataires
 */
export async function sendTelegramPhoto(
  photoUrl: string,
  caption: string
): Promise<boolean> {
  try {
    if (!bot) {
      bot = initTelegramBot();
      if (!bot) return false;
    }

    await Promise.allSettled(
      chatIds.map(chatId =>
        bot!.sendPhoto(chatId, photoUrl, {
          caption,
          parse_mode: 'HTML'
        })
      )
    );

    return true;
  } catch (error) {
    console.error('❌ Erreur envoi photo Telegram:', error);
    return false;
  }
}

export { bot };
