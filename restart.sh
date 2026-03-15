#!/bin/bash
echo "stopping old bot session..."
pkill -f Main.py

echo "fixing log permissions..."
touch log.txt
chmod 666 log.txt

echo "starting bot in the drawer..."
# the > log.txt 2>&1 forces errors and prints into the file immediately
nohup python3 Main.py > log.txt 2>&1 &

echo "done! bot is running at 192.168.1.14"
