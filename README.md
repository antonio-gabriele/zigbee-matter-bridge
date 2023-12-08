# zigbee-matter-bridge
Zigbee Matter Bridge

This project is a WORKING smart implementation of Zigbee Matter Bridge, in compliance with actual matter.js specifications.
It works with all major Zigbee Coordinator Chip Vendor (Conbee, Texas, Silabs, etc).

Work is in progress, so stay sync.

Zigbee Dongle Coordinator configuration is in src/Supervisor.ts, that you need to edit.

## User Manual
```
git clone https://github.com/antonio-gabriele/zigbee-matter-bridge
cd  zigbee-matter-bridge
nano src/Supervisor.ts
npm install
npm run start
```

## Status

- Google Home App: I cannot pair Bridge Device with my Google Home App, despite I added it into my account.
- Alexa: I can use OnOff, Dimmer, Temperature, Humidity. Bad data report on OnOff and Dimmer. Also no routine on those clusters. Bad work by Amazon.
- Home Assistant: I can use OnOff, Dimmer. No Temperature or Humidity. But on forums, seen to be my personal problem. Data report is excellent.
- Pay attention: Matter latest specifications (1.2) don't have Energy Measurement device type. So it's not possible to use 0B04 Cluster. We have to wait.

## Purpose

The purpose of this project is to develop a zero-configuration device that home automation integrators can install and allow bridge between home hubs (Alexa, Google Home, Samsung Smart Things) and legacy home automation system (Zigbee, KNX, Modbus). Despite Zigbee configuration can be automated and inferred, KNX and Modbus can't. I will implement html page to perform association between group address and commands/attributes. Same for Modbus. Nothing will be between Zigbee/KNX/Modbus and Home Hub.

## Change log

2023-12-08 - Added Binary Input Cluster, Updated matter.js to 0.7.2 Release, Fixed some workaround, Refactoring.

## To Do

Check about Google Home App commissioning error.

Check about Home Assistant missing temperature and humidity sensors.