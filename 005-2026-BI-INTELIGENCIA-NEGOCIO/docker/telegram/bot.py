"""Bot Telegram BI stub · Fase 1 · solo /start con whitelist. Handlers completos en SPEC-004."""
import os
import logging
from telegram import Update
from telegram.ext import Application, CommandHandler, ContextTypes

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

AUTHORIZED_CHATS = {
    int(c.strip())
    for c in os.environ.get("TELEGRAM_AUTHORIZED_CHATS", "").split(",")
    if c.strip()
}


def is_authorized(update: Update) -> bool:
    return update.effective_chat.id in AUTHORIZED_CHATS


async def start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not is_authorized(update):
        await update.message.reply_text("Acceso no autorizado.")
        return
    await update.message.reply_text(
        "BI Innovadataco · Fase 1\n"
        "Comandos disponibles próximamente en SPEC-004.\n"
        "Por ahora solo monitoreo activo."
    )


def write_pid():
    with open("/tmp/bot.pid", "w") as f:
        f.write(str(os.getpid()))


def main() -> None:
    token = os.environ["TELEGRAM_BOT_TOKEN"]
    app = Application.builder().token(token).build()
    app.add_handler(CommandHandler("start", start))
    write_pid()
    logger.info("Bot BI arrancando (long-polling)")
    app.run_polling()


if __name__ == "__main__":
    main()
