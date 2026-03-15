#!/bin/bash
while true
do
    # only push if the data file exists
    if [ -f "data.json" ]; then
        git add data.json
        git commit -m "pi status update [automated]"
        git push origin main
    fi
    # wait 5 minutes (300 seconds)
    sleep 300
done
