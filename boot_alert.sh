#!/bin/bash
# wait 10 seconds for wifi to connect after boot
sleep 10
URL="https://discord.com/api/webhooks/1480180172685705286/keGpH_rM18PtFfg2WoEtBy5jddjX5mvyvRN9Q99Oh6VoFtxx90GpQhWytNDYPwfpNfQh"
curl -H "Content-Type: application/json" -X POST -d '{"content": "⚡ **Pi 3 Online!** The bot at 192.168.1.14 is starting up."}' $URL
