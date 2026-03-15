import discord
from discord.ext import tasks, commands
from discord import app_commands
import groq
import psutil
import requests
import time
import datetime
import json
import os

# --- configuration ---
with open("Discord.txt", "r") as f:
    TOKEN = f.read().strip()
with open("AI.txt", "r") as f:
    GROQ_KEY = f.read().strip()
with open("webhook.txt", "r") as f:
    WEBHOOK_URL = f.read().strip()

# --- initialization ---
intents = discord.Intents.default()
intents.message_content = True
intents.members = True 
bot = commands.Bot(command_prefix="!", intents=intents)
client = groq.Groq(api_key=GROQ_KEY)

start_time = time.time()
total_requests = 0

def get_temp():
    try:
        with open("/sys/class/thermal/thermal_zone0/temp", "r") as f:
            temp = float(f.read()) / 1000
            return f"{temp:.1f}°c"
    except:
        return "n/a"

# --- background tasks ---

@tasks.loop(minutes=1)
async def fast_web_sync():
    """generates data.json and pushes only that file to github every 1 minute"""
    global total_requests
    stats = {
        "temp": get_temp(),
        "requests": total_requests,
        "cpu": psutil.cpu_percent(),
        "last_update": datetime.datetime.now().strftime("%H:%M:%S")
    }
    
    # write the file
    with open("data.json", "w") as f:
        json.dump(stats, f)
    
    # push only the tiny data file to github in the background
    # the '&' at the end ensures the bot doesn't lag while waiting for git
    os.system("git add data.json && git commit -m 'fast sync' && git push origin main &")

@tasks.loop(minutes=5)
async def update_presence():
    """updates the discord status message"""
    server_count = len(bot.guilds)
    total_users = sum(guild.member_count for guild in bot.guilds)
    status_text = f"trusted by {total_users} users in {server_count} servers"
    activity = discord.Activity(type=discord.ActivityType.custom, name="custom", state=status_text)
    await bot.change_presence(activity=activity)

# --- slash commands ---

@bot.tree.command(name="ai", description="ask gpt-oss-20b")
@app_commands.allowed_contexts(guilds=True, dms=True, private_channels=True)
@app_commands.allowed_installs(guilds=True, users=True)
async def ai(interaction: discord.Interaction, prompt: str):
    global total_requests
    await interaction.response.defer()
    total_requests += 1
    try:
        chat_completion = client.chat.completions.create(
            messages=[
                {"role": "system", "content": "answer in 1 sentence only. no caps. no emojis. no comfort. be direct."},
                {"role": "user", "content": prompt}
            ],
            model="openai/gpt-oss-20b",
        )
        await interaction.followup.send(chat_completion.choices[0].message.content)
    except Exception as e:
        await interaction.followup.send(f"error: {e}")

@bot.tree.command(name="ping", description="check bot latency")
async def ping(interaction: discord.Interaction):
    latency = round(bot.latency * 1000)
    await interaction.response.send_message(f"pong. speed: {latency}ms")

@bot.tree.command(name="uptime", description="check bot health and usage")
async def uptime(interaction: discord.Interaction):
    uptime_seconds = int(round(time.time() - start_time))
    readable_time = str(datetime.timedelta(seconds=uptime_seconds))
    temp = get_temp()
    await interaction.response.send_message(
        f"**stats**\nimmortal for: {readable_time}\nrequests handled: {total_requests}\npi temp: {temp}"
    )

@bot.event
async def on_ready():
    await bot.tree.sync()
    if not fast_web_sync.is_running(): fast_web_sync.start()
    if not update_presence.is_running(): update_presence.start()
    requests.post(WEBHOOK_URL, json={"content": "⚡ bot online (v1.1.0-fastsync)"})

bot.run(TOKEN)
